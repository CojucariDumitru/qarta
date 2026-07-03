import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { earnPoints, MAX_REDEEM_SHARE, tierFor, TIERS } from '../loyalty';

export const publicRouter = Router();

/** Full menu grouped by category. */
publicRouter.get('/menu', async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { sort: 'asc' },
    include: {
      items: { where: { available: true }, orderBy: { name: 'asc' } },
    },
  });
  res.json(categories);
});

/** Resolve a table by its QR code. */
publicRouter.get('/tables/:code', async (req, res) => {
  const table = await prisma.table.findUnique({ where: { code: req.params.code } });
  if (!table) return res.status(404).json({ error: 'Стол не найден' });
  res.json({ id: table.id, number: table.number, zone: table.zone });
});

/** Identify a guest by phone (creates guest + loyalty account on first visit). */
publicRouter.post('/guests/identify', async (req, res) => {
  const body = z
    .object({ phone: z.string().min(6).max(20), name: z.string().max(60).optional() })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Неверный номер телефона' });

  const phone = body.data.phone.replace(/[^\d+]/g, '');
  const guest = await prisma.guest.upsert({
    where: { phone },
    update: body.data.name ? { name: body.data.name } : {},
    create: {
      phone,
      name: body.data.name,
      loyalty: { create: {} },
    },
    include: { loyalty: true },
  });
  res.json(guestCard(guest));
});

/** Loyalty card with history. */
publicRouter.get('/loyalty/:guestId', async (req, res) => {
  const guest = await prisma.guest.findUnique({
    where: { id: req.params.guestId },
    include: {
      loyalty: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } } },
    },
  });
  if (!guest?.loyalty) return res.status(404).json({ error: 'Гость не найден' });
  res.json({ ...guestCard(guest), transactions: guest.loyalty.transactions });
});

const orderSchema = z.object({
  tableCode: z.string(),
  guestId: z.string().optional(),
  comment: z.string().max(300).optional(),
  redeemPoints: z.number().int().min(0).default(0),
  items: z
    .array(z.object({ menuItemId: z.string(), qty: z.number().int().min(1).max(20) }))
    .min(1),
});

/** Place an order; earns loyalty points, optionally redeems them as a discount. */
publicRouter.post('/orders', async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректный заказ' });
  const { tableCode, guestId, comment, redeemPoints, items } = parsed.data;

  const table = await prisma.table.findUnique({ where: { code: tableCode } });
  if (!table) return res.status(404).json({ error: 'Стол не найден' });

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) }, available: true },
  });
  if (menuItems.length !== items.length)
    return res.status(400).json({ error: 'Некоторые блюда недоступны' });

  const subtotal = items.reduce((sum, i) => {
    const m = menuItems.find((m) => m.id === i.menuItemId)!;
    return sum + Number(m.price) * i.qty;
  }, 0);

  const order = await prisma.$transaction(async (tx) => {
    let discount = 0;
    let account = null;

    if (guestId) {
      account = await tx.loyaltyAccount.findUnique({ where: { guestId } });
      if (account && redeemPoints > 0) {
        const maxByShare = Math.floor(subtotal * MAX_REDEEM_SHARE * 100);
        const usable = Math.min(redeemPoints, account.points, maxByShare);
        discount = usable / 100;
        if (usable > 0) {
          await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: { points: { decrement: usable } },
          });
          await tx.loyaltyTransaction.create({
            data: { accountId: account.id, type: 'REDEEM', points: -usable },
          });
        }
      }
    }

    const total = Math.max(0, subtotal - discount);

    const order = await tx.order.create({
      data: {
        tableId: table.id,
        guestId,
        comment,
        subtotal,
        discount,
        total,
        items: {
          create: items.map((i) => {
            const m = menuItems.find((m) => m.id === i.menuItemId)!;
            return { menuItemId: m.id, name: m.name, price: m.price, qty: i.qty };
          }),
        },
      },
      include: { items: true },
    });

    if (account) {
      const earned = earnPoints(total, Number(account.totalSpent));
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: { increment: earned }, totalSpent: { increment: total } },
      });
      await tx.loyaltyTransaction.create({
        data: { accountId: account.id, orderId: order.id, type: 'EARN', points: earned },
      });
      return { ...order, earned };
    }
    return { ...order, earned: 0 };
  });

  res.status(201).json(order);
});

/** Order status for the guest's polling screen. */
publicRouter.get('/orders/:id', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true, table: { select: { number: true } } },
  });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  res.json(order);
});

/** Call a waiter to the table. */
publicRouter.post('/waiter-call', async (req, res) => {
  const body = z.object({ tableCode: z.string() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Нет кода стола' });
  const table = await prisma.table.findUnique({ where: { code: body.data.tableCode } });
  if (!table) return res.status(404).json({ error: 'Стол не найден' });

  const open = await prisma.waiterCall.findFirst({
    where: { tableId: table.id, status: 'OPEN' },
  });
  if (!open) await prisma.waiterCall.create({ data: { tableId: table.id } });
  res.json({ ok: true });
});

function guestCard(guest: {
  id: string;
  phone: string;
  name: string | null;
  loyalty: { points: number; totalSpent: unknown } | null;
}) {
  const spent = Number(guest.loyalty?.totalSpent ?? 0);
  const tier = tierFor(spent);
  const next = TIERS.find((t) => t.from > spent);
  return {
    guestId: guest.id,
    phone: guest.phone,
    name: guest.name,
    points: guest.loyalty?.points ?? 0,
    totalSpent: spent,
    tier: { name: tier.name, label: tier.label, rate: tier.rate },
    nextTier: next ? { label: next.label, rate: next.rate, remaining: next.from - spent } : null,
  };
}
