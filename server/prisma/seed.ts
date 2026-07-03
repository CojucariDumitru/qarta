import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { earnPoints } from '../src/loyalty';

const prisma = new PrismaClient();

/** Food photos already hosted in Cloudinary (uploaded for the GRINDHOUSE project). */
const cld = (id: string, t = 'c_fill,g_auto,w_900,h_900') =>
  `https://res.cloudinary.com/dozr400tl/image/upload/${t},f_auto,q_auto/grindhouse/${id}`;

const MENU: Record<string, { name: string; description: string; price: number; image: string; popular?: boolean; spicy?: boolean }[]> = {
  'Бургеры': [
    { name: 'The OG Smash', description: 'Двойная смэш-котлета, американский чеддер, фирменный соус, пикули, лук на картофельной булочке.', price: 12.99, image: cld('menu/og-smash'), popular: true },
    { name: 'Double Down', description: 'Две котлеты по четверти фунта, двойной чеддер, двойной соус. Когда одной мало.', price: 16.99, image: cld('menu/double-down'), popular: true },
    { name: 'Spicy Diablo', description: 'Смэш-котлета, пеппер-джек, обожжённый релиш из халапеньо, айоли с призрачным перцем.', price: 14.99, image: cld('menu/spicy-diablo'), popular: true, spicy: true },
    { name: 'The Mushroom Cloud', description: 'Смэш-котлета, швейцарский сыр, карамелизованные грибы, трюфельный майонез.', price: 15.49, image: cld('menu/mushroom-cloud') },
    { name: 'BBQ Bacon Stack', description: 'Котлета, бекон двойного копчения, луковые кольца, BBQ-соус, чеддер.', price: 15.99, image: cld('menu/bbq-bacon') },
    { name: 'Truffle Shuffle', description: 'Котлета, трюфельный сыр, руккола, конфи из лука.', price: 17.99, image: cld('menu/truffle-shuffle') },
  ],
  'Картофель': [
    { name: 'OG Fries', description: 'Классический хрустящий картофель с морской солью.', price: 4.99, image: cld('menu/og-fries'), popular: true },
    { name: 'Cheese Bomb', description: 'Картофель под расплавленным чеддером и зелёным луком.', price: 6.99, image: cld('menu/cheese-bomb') },
    { name: 'Truffle Parm', description: 'Картофель с трюфельным маслом и пармезаном.', price: 7.99, image: cld('menu/truffle-parm') },
    { name: 'Chili Fries', description: 'Картофель с мясным чили, сыром и халапеньо.', price: 8.49, image: cld('menu/chili-fries'), spicy: true },
  ],
  'Закуски': [
    { name: 'Onion Rings', description: 'Луковые кольца в хрустящей панировке с соусом ранч.', price: 5.99, image: cld('menu/onion-rings') },
    { name: 'Mac Bites', description: 'Жареные шарики мак-н-чиз с острым кетчупом.', price: 6.49, image: cld('menu/mac-bites') },
    { name: 'Coleslaw', description: 'Хрустящий капустный салат на яблочном уксусе.', price: 3.99, image: cld('menu/coleslaw') },
  ],
  'Шейки': [
    { name: 'Vanilla Shake', description: 'Классический ванильный милкшейк со взбитыми сливками.', price: 6.99, image: cld('menu/vanilla-shake'), popular: true },
    { name: 'Oreo Shake', description: 'Милкшейк с печеньем Oreo и шоколадной крошкой.', price: 7.49, image: cld('menu/oreo-shake') },
    { name: 'Strawberry Shake', description: 'Милкшейк с клубникой и сливками.', price: 7.49, image: cld('menu/strawberry-shake') },
  ],
  'Напитки': [
    { name: 'House Lemonade', description: 'Домашний лимонад с мятой.', price: 3.99, image: cld('menu/lemonade') },
    { name: 'Cola', description: 'Классическая кола со льдом.', price: 2.99, image: cld('menu/cola') },
  ],
};

// Floor plan is a 100×64 viewBox; posX/posY are table centers.
// Hall: bar top-left, kitchen top-right, WC bottom-right, entrance bottom-left.
const TABLES = [
  { number: 1, code: 't1', seats: 2, zone: 'Зал', shape: 'round', posX: 13, posY: 24 },
  { number: 2, code: 't2', seats: 2, zone: 'Зал', shape: 'round', posX: 13, posY: 43 },
  { number: 3, code: 't3', seats: 4, zone: 'Зал', shape: 'square', posX: 31, posY: 27 },
  { number: 4, code: 't4', seats: 4, zone: 'Зал', shape: 'square', posX: 31, posY: 48 },
  { number: 5, code: 't5', seats: 6, zone: 'Зал', shape: 'rect', posX: 51, posY: 34 },
  { number: 6, code: 't6', seats: 2, zone: 'Терраса', shape: 'round', posX: 76, posY: 16 },
  { number: 7, code: 't7', seats: 4, zone: 'Терраса', shape: 'square', posX: 76, posY: 38 },
  { number: 8, code: 't8', seats: 4, zone: 'Терраса', shape: 'square', posX: 89, posY: 52 },
];

const GUESTS = [
  { phone: '+77015550101', name: 'Айдана' },
  { phone: '+77015550102', name: 'Дмитрий' },
  { phone: '+77015550103', name: 'Мария' },
  { phone: '+77015550104', name: 'Ерлан' },
];

async function main() {
  console.log('Seeding QARTA…');

  await prisma.loyaltyTransaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.waiterCall.deleteMany();
  await prisma.loyaltyAccount.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.table.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      email: 'admin@qarta.app',
      passwordHash: await bcrypt.hash('Qarta2024!', 10),
      name: 'GRINDHOUSE Admin',
    },
  });

  let sort = 0;
  for (const [name, items] of Object.entries(MENU)) {
    await prisma.category.create({
      data: {
        name,
        sort: sort++,
        items: {
          create: items.map((i) => ({
            name: i.name,
            description: i.description,
            price: i.price,
            image: i.image,
            popular: i.popular ?? false,
            spicy: i.spicy ?? false,
          })),
        },
      },
    });
  }
  console.log(`  ✓ menu: ${Object.values(MENU).flat().length} items`);

  await prisma.table.createMany({ data: TABLES });
  console.log(`  ✓ tables: ${TABLES.length}`);

  const guests = [];
  for (const g of GUESTS) {
    guests.push(
      await prisma.guest.create({ data: { ...g, loyalty: { create: {} } }, include: { loyalty: true } })
    );
  }

  // Historical PAID orders over the past week → CRM stats, chart data, loyalty balances.
  const allItems = await prisma.menuItem.findMany();
  const tables = await prisma.table.findMany();
  let created = 0;
  for (let day = 6; day >= 0; day--) {
    const perDay = 2 + ((day * 7) % 4); // 2..5 orders/day, deterministic
    for (let k = 0; k < perDay; k++) {
      const guest = guests[(day + k) % guests.length];
      const table = tables[(day * 3 + k) % tables.length];
      const picks = [
        allItems[(day * 5 + k) % allItems.length],
        allItems[(day * 5 + k + 7) % allItems.length],
      ];
      const subtotal = picks.reduce((s, p) => s + Number(p.price), 0);
      const at = new Date(Date.now() - day * 86400_000 - (k + 2) * 3600_000);

      const account = await prisma.loyaltyAccount.findUnique({ where: { guestId: guest.id } });
      const earned = earnPoints(subtotal, Number(account!.totalSpent));

      const order = await prisma.order.create({
        data: {
          tableId: table.id,
          guestId: guest.id,
          status: 'PAID',
          subtotal,
          discount: 0,
          total: subtotal,
          createdAt: at,
          items: {
            create: picks.map((p) => ({ menuItemId: p.id, name: p.name, price: p.price, qty: 1 })),
          },
        },
      });
      await prisma.loyaltyAccount.update({
        where: { id: account!.id },
        data: { points: { increment: earned }, totalSpent: { increment: subtotal } },
      });
      await prisma.loyaltyTransaction.create({
        data: { accountId: account!.id, orderId: order.id, type: 'EARN', points: earned, createdAt: at },
      });
      created++;
    }
  }
  console.log(`  ✓ guests: ${guests.length}, historical orders: ${created}`);
  console.log('Done. Admin: admin@qarta.app / Qarta2024!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
