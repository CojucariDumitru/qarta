import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma';
import { env } from '../env';
import { requireAdmin } from '../middleware/auth';
import { tierFor } from '../loyalty';

export const adminRouter = Router();

adminRouter.post('/login', async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Введите email и пароль' });
  const user = await prisma.user.findUnique({ where: { email: body.data.email } });
  if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash)))
    return res.status(401).json({ error: 'Неверный email или пароль' });
  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, name: user.name });
});

adminRouter.use(requireAdmin);

const ACTIVE = ['NEW', 'ACCEPTED', 'PREPARING', 'SERVED'];

/** Live orders board (active by default, ?all=1 for history). */
adminRouter.get('/orders', async (req, res) => {
  const where = req.query.all ? {} : { status: { in: ACTIVE } };
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      items: true,
      table: { select: { number: true, zone: true } },
      guest: { select: { name: true, phone: true } },
    },
  });
  res.json(orders);
});

adminRouter.patch('/orders/:id/status', async (req, res) => {
  const body = z
    .object({ status: z.enum(['NEW', 'ACCEPTED', 'PREPARING', 'SERVED', 'PAID', 'CANCELLED']) })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Неверный статус' });
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: body.data.status },
  });
  res.json(order);
});

/** Floor map: tables with their active orders and open waiter calls. */
adminRouter.get('/tables', async (_req, res) => {
  const tables = await prisma.table.findMany({
    orderBy: { number: 'asc' },
    include: {
      orders: {
        where: { status: { in: ACTIVE } },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
          comment: true,
          items: { select: { id: true, name: true, qty: true } },
        },
      },
      calls: { where: { status: 'OPEN' }, select: { id: true, createdAt: true } },
    },
  });
  res.json(tables);
});

/** Reposition a table on the floor plan (map editor drag). */
adminRouter.patch('/tables/:id/position', async (req, res) => {
  const body = z
    .object({ posX: z.number().min(0).max(100), posY: z.number().min(0).max(100) })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Неверные координаты' });
  res.json(await prisma.table.update({ where: { id: req.params.id }, data: body.data }));
});

adminRouter.post('/calls/:id/resolve', async (req, res) => {
  await prisma.waiterCall.update({ where: { id: req.params.id }, data: { status: 'RESOLVED' } });
  res.json({ ok: true });
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
  price: z.number().positive(),
  image: z.string().url(),
  categoryId: z.string(),
  available: z.boolean().default(true),
  popular: z.boolean().default(false),
  spicy: z.boolean().default(false),
});

adminRouter.post('/menu', async (req, res) => {
  const body = itemSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Неверные данные блюда' });
  res.status(201).json(await prisma.menuItem.create({ data: body.data }));
});

adminRouter.patch('/menu/:id', async (req, res) => {
  const body = itemSchema.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Неверные данные блюда' });
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
    include: { loyalty: true, _count: { select: { orders: true } } },
  });
  res.json(
    guests.map((g) => ({
      id: g.id,
      phone: g.phone,
      name: g.name,
      visits: g._count.orders,
      points: g.loyalty?.points ?? 0,
      totalSpent: Number(g.loyalty?.totalSpent ?? 0),
      tier: tierFor(Number(g.loyalty?.totalSpent ?? 0)).label,
      createdAt: g.createdAt,
    }))
  );
});

/** Dashboard stats: revenue, orders, avg check, top dishes, 7-day series. */
adminRouter.get('/stats', async (_req, res) => {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(dayStart.getTime() - 6 * 86400_000);
  const DONE = { notIn: ['CANCELLED'] };

  const [today, week, guests, topRaw] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: { gte: dayStart }, status: DONE },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: weekAgo }, status: DONE },
      select: { total: true, createdAt: true },
    }),
    prisma.guest.count(),
    prisma.orderItem.groupBy({
      by: ['name'],
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 5,
    }),
  ]);

  const series = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * 86400_000);
    const next = new Date(d.getTime() + 86400_000);
    const revenue = week
      .filter((o) => o.createdAt >= d && o.createdAt < next)
      .reduce((s, o) => s + Number(o.total), 0);
    return { date: d.toISOString().slice(0, 10), revenue: Math.round(revenue * 100) / 100 };
  });

  const todayRevenue = Number(today._sum.total ?? 0);
  res.json({
    todayRevenue,
    todayOrders: today._count,
    avgCheck: today._count ? Math.round((todayRevenue / today._count) * 100) / 100 : 0,
    guests,
    topDishes: topRaw.map((t) => ({ name: t.name, qty: t._sum.qty ?? 0 })),
    series,
  });
});
