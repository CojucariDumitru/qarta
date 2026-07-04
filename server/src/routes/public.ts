import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { tierFor, TIERS } from '../loyalty';

export const publicRouter = Router();

async function getSettings() {
  return (
    (await prisma.settings.findUnique({ where: { id: 1 } })) ??
    (await prisma.settings.create({ data: { id: 1 } }))
  );
}

/** Restaurant profile + AYCE pricing. */
publicRouter.get('/config', async (_req, res) => {
  const s = await getSettings();
  res.json({
    name: s.name,
    tagline: s.tagline,
    aycePrice: Number(s.aycePrice),
    roundLimit: s.roundLimit,
  });
});

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

/** Resolve a table by its QR code, with its open session if any. */
publicRouter.get('/tables/:code', async (req, res) => {
  const table = await prisma.table.findUnique({
    where: { code: req.params.code },
    include: { sessions: { where: { status: 'OPEN' }, select: { id: true, guests: true, openedAt: true } } },
  });
  if (!table) return res.status(404).json({ error: 'Table not found' });
  res.json({
    id: table.id,
    number: table.number,
    zone: table.zone,
    session: table.sessions[0] ?? null,
  });
});

/** Start a seating: party size × AYCE price. Reuses the open session if one exists. */
publicRouter.post('/sessions', async (req, res) => {
  const body = z
    .object({
      tableCode: z.string(),
      guests: z.number().int().min(1).max(20),
      guestId: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid party size' });

  const table = await prisma.table.findUnique({ where: { code: body.data.tableCode } });
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const existing = await prisma.tableSession.findFirst({
    where: { tableId: table.id, status: 'OPEN' },
  });
  if (existing) return res.json({ id: existing.id, existing: true });

  const session = await prisma.tableSession.create({
    data: { tableId: table.id, guests: body.data.guests, guestId: body.data.guestId },
  });
  res.status(201).json({ id: session.id, existing: false });
});

/** Attach a loyalty card to the seating (cashback lands here on close). */
publicRouter.post('/sessions/:id/attach', async (req, res) => {
  const body = z.object({ guestId: z.string() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Missing guest' });
  const session = await prisma.tableSession.findUnique({ where: { id: req.params.id } });
  if (!session || session.status !== 'OPEN')
    return res.status(404).json({ error: 'Session not found' });
  await prisma.tableSession.update({
    where: { id: session.id },
    data: { guestId: body.data.guestId },
  });
  res.json({ ok: true });
});

/** Full session state: rounds, per-item delivery, live bill preview. Guests poll this. */
publicRouter.get('/sessions/:id', async (req, res) => {
  const session = await sessionDetail(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

export async function sessionDetail(id: string) {
  const s = await prisma.tableSession.findUnique({
    where: { id },
    include: {
      table: { select: { number: true, zone: true, code: true } },
      guest: { select: { id: true, name: true, phone: true } },
      orders: {
        orderBy: { createdAt: 'asc' },
        include: { items: { orderBy: { name: 'asc' } } },
      },
    },
  });
  if (!s) return null;
  const settings = await getSettings();
  const extras = s.orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.extrasTotal), 0);
  const ayceTotal = s.guests * Number(settings.aycePrice);
  return {
    id: s.id,
    status: s.status,
    guests: s.guests,
    openedAt: s.openedAt,
    closedAt: s.closedAt,
    table: s.table,
    loyaltyGuest: s.guest,
    orders: s.orders,
    bill: {
      aycePrice: Number(settings.aycePrice),
      ayceTotal,
      extras,
      discount: Number(s.discount),
      total: s.status === 'CLOSED' ? Number(s.total) : ayceTotal + extras,
    },
    roundLimit: settings.roundLimit,
  };
}

const orderSchema = z.object({
  sessionId: z.string(),
  comment: z.string().max(300).optional(),
  items: z
    .array(z.object({ menuItemId: z.string(), qty: z.number().int().min(1).max(20) }))
    .min(1),
});

/** Send a round of items to the kitchen. AYCE items are capped per round. */
publicRouter.post('/orders', async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid order' });
  const { sessionId, comment, items } = parsed.data;

  const session = await prisma.tableSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== 'OPEN')
    return res.status(409).json({ error: 'This seating is closed — ask the staff to reopen' });

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) }, available: true },
  });
  if (menuItems.length !== items.map((i) => i.menuItemId).filter((v, i, a) => a.indexOf(v) === i).length)
    return res.status(400).json({ error: 'Some items are no longer available' });

  const settings = await getSettings();
  const ayceCount = items.reduce((sum, i) => {
    const m = menuItems.find((m) => m.id === i.menuItemId)!;
    return sum + (m.ayce ? i.qty : 0);
  }, 0);
  const cap = settings.roundLimit * session.guests;
  if (ayceCount > cap)
    return res.status(400).json({
      error: `Max ${cap} AYCE items per round for ${session.guests} guest${session.guests > 1 ? 's' : ''} — send this round in parts`,
    });

  const extrasTotal = items.reduce((sum, i) => {
    const m = menuItems.find((m) => m.id === i.menuItemId)!;
    return sum + (m.ayce ? 0 : Number(m.price) * i.qty);
  }, 0);

  const order = await prisma.order.create({
    data: {
      sessionId,
      comment,
      extrasTotal,
      items: {
        create: items.map((i) => {
          const m = menuItems.find((m) => m.id === i.menuItemId)!;
          return {
            menuItemId: m.id,
            name: m.name,
            ayce: m.ayce,
            price: m.ayce ? 0 : m.price,
            qty: i.qty,
          };
        }),
      },
    },
    include: { items: true },
  });
  res.status(201).json(order);
});

/** Call a waiter / ask for the bill. */
publicRouter.post('/waiter-call', async (req, res) => {
  const body = z
    .object({ tableCode: z.string(), kind: z.enum(['WAITER', 'BILL']).default('WAITER') })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Missing table code' });
  const table = await prisma.table.findUnique({ where: { code: body.data.tableCode } });
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const open = await prisma.waiterCall.findFirst({
    where: { tableId: table.id, status: 'OPEN', kind: body.data.kind },
  });
  if (!open) await prisma.waiterCall.create({ data: { tableId: table.id, kind: body.data.kind } });
  res.json({ ok: true });
});

/** Identify a guest by phone (creates guest + loyalty account on first visit). */
publicRouter.post('/guests/identify', async (req, res) => {
  const body = z
    .object({ phone: z.string().min(6).max(20), name: z.string().max(60).optional() })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid phone number' });

  const phone = body.data.phone.replace(/[^\d+]/g, '');
  const guest = await prisma.guest.upsert({
    where: { phone },
    update: body.data.name ? { name: body.data.name } : {},
    create: { phone, name: body.data.name, loyalty: { create: {} } },
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
  if (!guest?.loyalty) return res.status(404).json({ error: 'Guest not found' });
  res.json({ ...guestCard(guest), transactions: guest.loyalty.transactions });
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
