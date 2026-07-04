import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma';
import { env } from '../env';
import { requireAdmin } from '../middleware/auth';
import { earnPoints, tierFor } from '../loyalty';
import { sessionDetail } from './public';

export const adminRouter = Router();

adminRouter.post('/login', async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Enter email and password' });
  const user = await prisma.user.findUnique({ where: { email: body.data.email } });
  if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, name: user.name });
});

adminRouter.use(requireAdmin);

/** Floor map: tables with their open session (pending-item count) and open calls. */
adminRouter.get('/tables', async (_req, res) => {
  const tables = await prisma.table.findMany({
    orderBy: { number: 'asc' },
    include: {
      sessions: {
        where: { status: 'OPEN' },
        include: {
          orders: {
            where: { status: { not: 'CANCELLED' } },
            include: { items: { select: { qty: true, delivered: true } } },
          },
        },
      },
      calls: { where: { status: 'OPEN' }, select: { id: true, kind: true, createdAt: true } },
    },
  });
  res.json(
    tables.map((t) => {
      const s = t.sessions[0];
      const pending = s
        ? s.orders.flatMap((o) => o.items).reduce((n, i) => n + (i.delivered ? 0 : i.qty), 0)
        : 0;
      return {
        id: t.id,
        number: t.number,
        code: t.code,
        seats: t.seats,
        zone: t.zone,
        posX: t.posX,
        posY: t.posY,
        shape: t.shape,
        calls: t.calls,
        session: s
          ? { id: s.id, guests: s.guests, openedAt: s.openedAt, pendingItems: pending }
          : null,
      };
    })
  );
});

/** Reposition a table on the floor plan (map editor drag). */
adminRouter.patch('/tables/:id/position', async (req, res) => {
  const body = z
    .object({ posX: z.number().min(0).max(100), posY: z.number().min(0).max(100) })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid coordinates' });
  res.json(await prisma.table.update({ where: { id: req.params.id }, data: body.data }));
});

/** Open a seating from the staff side. */
adminRouter.post('/sessions', async (req, res) => {
  const body = z
    .object({ tableId: z.string(), guests: z.number().int().min(1).max(20) })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid party size' });
  const existing = await prisma.tableSession.findFirst({
    where: { tableId: body.data.tableId, status: 'OPEN' },
  });
  if (existing) return res.status(409).json({ error: 'Table already has an open seating' });
  const s = await prisma.tableSession.create({ data: body.data });
  res.status(201).json(s);
});

adminRouter.get('/sessions/:id', async (req, res) => {
  const s = await sessionDetail(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  res.json(s);
});

/** Adjust party size. */
adminRouter.patch('/sessions/:id', async (req, res) => {
  const body = z.object({ guests: z.number().int().min(1).max(20) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid party size' });
  res.json(
    await prisma.tableSession.update({ where: { id: req.params.id }, data: body.data })
  );
});

/**
 * Close the seating and settle the bill:
 * guests × AYCE price + extras − optional loyalty redeem; cashback earned on the result.
 */
adminRouter.post('/sessions/:id/close', async (req, res) => {
  const body = z
    .object({ redeemPoints: z.number().int().min(0).default(0) })
    .safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: 'Invalid request' });

  const s = await prisma.tableSession.findUnique({
    where: { id: req.params.id },
    include: { orders: { where: { status: { not: 'CANCELLED' } } } },
  });
  if (!s || s.status !== 'OPEN') return res.status(404).json({ error: 'Open session not found' });

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const extras = s.orders.reduce((sum, o) => sum + Number(o.extrasTotal), 0);
  const gross = s.guests * Number(settings!.aycePrice) + extras;

  const result = await prisma.$transaction(async (tx) => {
    let discount = 0;
    let account = null;
    if (s.guestId) {
      account = await tx.loyaltyAccount.findUnique({ where: { guestId: s.guestId } });
      if (account && body.data.redeemPoints > 0) {
        const usable = Math.min(
          body.data.redeemPoints,
          account.points,
          Math.floor(gross * 0.5 * 100)
        );
        discount = usable / 100;
        if (usable > 0) {
          await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: { points: { decrement: usable } },
          });
          await tx.loyaltyTransaction.create({
            data: { accountId: account.id, sessionId: s.id, type: 'REDEEM', points: -usable },
          });
        }
      }
    }
    const total = Math.max(0, gross - discount);

    let earned = 0;
    if (account) {
      earned = earnPoints(total, Number(account.totalSpent));
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: { increment: earned }, totalSpent: { increment: total } },
      });
      await tx.loyaltyTransaction.create({
        data: { accountId: account.id, sessionId: s.id, type: 'EARN', points: earned },
      });
    }

    await tx.tableSession.update({
      where: { id: s.id },
      data: { status: 'CLOSED', closedAt: new Date(), discount, total },
    });
    // everything outstanding is implicitly settled
    await tx.waiterCall.updateMany({
      where: { tableId: s.tableId, status: 'OPEN' },
      data: { status: 'RESOLVED' },
    });
    await tx.orderItem.updateMany({
      where: { order: { sessionId: s.id, status: 'NEW' } },
      data: { delivered: true },
    });
    await tx.order.updateMany({
      where: { sessionId: s.id, status: 'NEW' },
      data: { status: 'DONE' },
    });
    return { total, discount, earned };
  });

  res.json({ ...result, gross, extras, ayceTotal: s.guests * Number(settings!.aycePrice) });
});

adminRouter.post('/calls/:id/resolve', async (req, res) => {
  await prisma.waiterCall.update({ where: { id: req.params.id }, data: { status: 'RESOLVED' } });
  res.json({ ok: true });
});

/** Mark one line of a round as brought to the table (or undo). */
adminRouter.patch('/order-items/:id/delivered', async (req, res) => {
  const body = z.object({ delivered: z.boolean() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid request' });
  const item = await prisma.orderItem.update({
    where: { id: req.params.id },
    data: { delivered: body.data.delivered },
  });
  // a round with every line delivered is done
  const siblings = await prisma.orderItem.findMany({ where: { orderId: item.orderId } });
  const done = siblings.every((i) => i.delivered);
  await prisma.order.update({
    where: { id: item.orderId },
    data: { status: done ? 'DONE' : 'NEW' },
  });
  res.json({ ok: true, orderDone: done });
});

/** Live rounds board (active by default, ?all=1 for history). */
adminRouter.get('/orders', async (req, res) => {
  const where = req.query.all ? {} : { status: 'NEW' };
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      items: { orderBy: { name: 'asc' } },
      session: {
        select: {
          id: true,
          guests: true,
          table: { select: { number: true, zone: true } },
          guest: { select: { name: true } },
        },
      },
    },
  });
  res.json(orders);
});

adminRouter.patch('/orders/:id/status', async (req, res) => {
  const body = z.object({ status: z.enum(['NEW', 'DONE', 'CANCELLED']) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid status' });
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: body.data.status },
  });
  if (body.data.status === 'DONE')
    await prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { delivered: true } });
  res.json(order);
});

/** Menu management. */
adminRouter.get('/menu', async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { sort: 'asc' },
    include: { items: { orderBy: { name: 'asc' } } },
  });
  res.json(categories);
});

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  ayce: z.boolean().default(true),
  price: z.number().min(0).default(0),
  image: z.string().url(),
  categoryId: z.string(),
  available: z.boolean().default(true),
  popular: z.boolean().default(false),
  spicy: z.boolean().default(false),
});

adminRouter.post('/menu', async (req, res) => {
  const body = itemSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid item' });
  res.status(201).json(await prisma.menuItem.create({ data: body.data }));
});

adminRouter.patch('/menu/:id', async (req, res) => {
  const body = itemSchema.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid item' });
  res.json(await prisma.menuItem.update({ where: { id: req.params.id }, data: body.data }));
});

adminRouter.delete('/menu/:id', async (req, res) => {
  await prisma.menuItem.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/** Guest CRM with loyalty summary. */
adminRouter.get('/guests', async (_req, res) => {
  const guests = await prisma.guest.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      loyalty: true,
      _count: { select: { sessions: { where: { status: 'CLOSED' } } } },
    },
  });
  res.json(
    guests.map((g) => ({
      id: g.id,
      phone: g.phone,
      name: g.name,
      visits: g._count.sessions,
      points: g.loyalty?.points ?? 0,
      totalSpent: Number(g.loyalty?.totalSpent ?? 0),
      tier: tierFor(Number(g.loyalty?.totalSpent ?? 0)).label,
      createdAt: g.createdAt,
    }))
  );
});

/** Dashboard: revenue & covers from closed sessions, top dishes, 7-day series. */
adminRouter.get('/stats', async (_req, res) => {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(dayStart.getTime() - 6 * 86400_000);

  const [today, week, openNow, topRaw] = await Promise.all([
    prisma.tableSession.aggregate({
      where: { status: 'CLOSED', closedAt: { gte: dayStart } },
      _sum: { total: true, guests: true },
      _count: true,
    }),
    prisma.tableSession.findMany({
      where: { status: 'CLOSED', closedAt: { gte: weekAgo } },
      select: { total: true, closedAt: true },
    }),
    prisma.tableSession.count({ where: { status: 'OPEN' } }),
    prisma.orderItem.groupBy({
      by: ['name'],
      where: { order: { status: { not: 'CANCELLED' } } },
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 5,
    }),
  ]);

  const series = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * 86400_000);
    const next = new Date(d.getTime() + 86400_000);
    const revenue = week
      .filter((s) => s.closedAt && s.closedAt >= d && s.closedAt < next)
      .reduce((sum, s) => sum + Number(s.total), 0);
    return { date: d.toISOString().slice(0, 10), revenue: Math.round(revenue * 100) / 100 };
  });

  const todayRevenue = Number(today._sum.total ?? 0);
  const covers = Number(today._sum.guests ?? 0);
  res.json({
    todayRevenue,
    todaySessions: today._count,
    covers,
    avgPerCover: covers ? Math.round((todayRevenue / covers) * 100) / 100 : 0,
    openNow,
    topDishes: topRaw.map((t) => ({ name: t.name, qty: t._sum.qty ?? 0 })),
    series,
  });
});

/** Restaurant settings (name, AYCE price, round limit). */
adminRouter.get('/settings', async (_req, res) => {
  const s =
    (await prisma.settings.findUnique({ where: { id: 1 } })) ??
    (await prisma.settings.create({ data: { id: 1 } }));
  res.json({ ...s, aycePrice: Number(s.aycePrice) });
});

adminRouter.patch('/settings', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1).max(60).optional(),
      tagline: z.string().max(120).optional(),
      aycePrice: z.number().positive().optional(),
      roundLimit: z.number().int().min(1).max(20).optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid settings' });
  const s = await prisma.settings.update({ where: { id: 1 }, data: body.data });
  res.json({ ...s, aycePrice: Number(s.aycePrice) });
});
