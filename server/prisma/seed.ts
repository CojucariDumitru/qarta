import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { earnPoints } from '../src/loyalty';

const prisma = new PrismaClient();

/** Dish photos hosted in Cloudinary under qarta/menu (see scripts/upload-images.mjs). */
const cld = (id: string, t = 'c_fill,g_auto,w_900,h_900') =>
  `https://res.cloudinary.com/dozr400tl/image/upload/${t},f_auto,q_auto/qarta/menu/${id}`;
/** A couple of drink photos reused from the grindhouse upload. */
const cldGh = (id: string, t = 'c_fill,g_auto,w_900,h_900') =>
  `https://res.cloudinary.com/dozr400tl/image/upload/${t},f_auto,q_auto/grindhouse/${id}`;

type SeedItem = {
  name: string;
  description: string;
  image: string;
  ayce?: boolean; // default true
  price?: number; // only for non-AYCE items
  popular?: boolean;
  spicy?: boolean;
};

const MENU: Record<string, SeedItem[]> = {
  'Sushi & Rolls': [
    { name: 'Salmon Nigiri', description: 'Fresh salmon over hand-pressed rice, brushed with soy. 2 pcs.', image: cld('salmon-nigiri'), popular: true },
    { name: 'California Roll', description: 'Crab stick, avocado and cucumber rolled in tobiko. 8 pcs.', image: cld('california-roll'), popular: true },
    { name: 'Spicy Tuna Roll', description: 'Tuna, sriracha mayo and scallions. Brings the heat. 8 pcs.', image: cld('spicy-tuna-roll'), spicy: true },
    { name: 'Philadelphia Roll', description: 'Smoked salmon, cream cheese and cucumber. 8 pcs.', image: cld('philadelphia-roll') },
    { name: 'Sashimi Platter', description: "Chef's selection of the day's freshest cuts. 6 pcs.", image: cld('sashimi-platter'), popular: true },
    { name: 'Tamago Nigiri', description: 'Sweet layered omelette over rice. A quiet classic. 2 pcs.', image: cld('tamago-nigiri') },
  ],
  'Ramen & Soups': [
    { name: 'Tonkotsu Ramen', description: 'Rich 12-hour pork bone broth, chashu, egg, black garlic oil.', image: cld('tonkotsu-ramen'), popular: true },
    { name: 'Shoyu Ramen', description: 'Clear soy broth, bamboo shoots, nori and soft egg.', image: cld('shoyu-ramen') },
    { name: 'Spicy Miso Ramen', description: 'Miso broth with chili oil, minced pork and corn.', image: cld('spicy-miso-ramen'), spicy: true },
    { name: 'Miso Soup', description: 'Tofu, wakame and scallions. The warm-up.', image: cld('miso-soup') },
    { name: 'Beef Udon', description: 'Thick wheat noodles in dashi with sweet-simmered beef.', image: cld('beef-udon') },
  ],
  'Onigiri & Rice': [
    { name: 'Salmon Onigiri', description: 'Hand-shaped rice ball with flaked salted salmon in nori.', image: cld('salmon-onigiri') },
    { name: 'Katsudon', description: 'Crispy pork cutlet and egg simmered over steamed rice.', image: cld('katsudon'), popular: true },
    { name: 'Chicken Fried Rice', description: 'Wok-fried rice with chicken, egg and scallions.', image: cld('fried-rice') },
  ],
  'Robata Skewers': [
    { name: 'Chicken Yakitori', description: 'Charcoal-grilled chicken skewers glazed with sweet tare. 2 pcs.', image: cld('yakitori'), popular: true },
    { name: 'Beef Skewers', description: 'Marinated beef grilled over open flame. 2 pcs.', image: cld('beef-skewers') },
    { name: 'Shrimp Skewers', description: 'Garlic-butter shrimp with a squeeze of lime. 2 pcs.', image: cld('shrimp-skewers') },
  ],
  'Sides': [
    { name: 'Gyoza', description: 'Pan-fried pork dumplings with ponzu dip. 5 pcs.', image: cld('gyoza'), popular: true },
    { name: 'Edamame', description: 'Steamed soybeans with flaky sea salt.', image: cld('edamame') },
    { name: 'Takoyaki', description: 'Osaka-style octopus balls, bonito flakes, kewpie mayo. 6 pcs.', image: cld('takoyaki') },
    { name: 'Karaage', description: 'Japanese fried chicken, impossibly crispy. 6 pcs.', image: cld('karaage') },
  ],
  'Desserts': [
    { name: 'Mochi Ice Cream', description: 'Chewy rice dough around ice cream. 3 pcs.', image: cld('mochi-ice-cream') },
    { name: 'Matcha Ice Cream', description: 'Stone-ground green tea, properly bitter-sweet.', image: cld('matcha-ice-cream') },
    { name: 'Dorayaki', description: 'Honey pancakes with sweet red bean filling.', image: cld('dorayaki') },
  ],
  'Drinks': [
    { name: 'Ramune', description: 'Japanese marble soda. Pop the ball.', image: cld('ramune'), ayce: false, price: 3.9 },
    { name: 'Green Tea', description: 'Freshly brewed sencha, hot or iced.', image: cld('green-tea'), ayce: false, price: 2.5 },
    { name: 'Jasmine Iced Tea', description: 'Cold-steeped jasmine tea over ice.', image: cld('jasmine-tea'), ayce: false, price: 3.5 },
    { name: 'Cola', description: 'Classic, ice cold.', image: cldGh('menu/cola'), ayce: false, price: 2.9 },
  ],
};

// Floor plan is a 100×64 viewBox; posX/posY are table centers.
const TABLES = [
  { number: 1, code: 't1', seats: 2, zone: 'Main Hall', shape: 'round', posX: 13, posY: 24 },
  { number: 2, code: 't2', seats: 2, zone: 'Main Hall', shape: 'round', posX: 13, posY: 43 },
  { number: 3, code: 't3', seats: 4, zone: 'Main Hall', shape: 'square', posX: 31, posY: 27 },
  { number: 4, code: 't4', seats: 4, zone: 'Main Hall', shape: 'square', posX: 31, posY: 48 },
  { number: 5, code: 't5', seats: 6, zone: 'Main Hall', shape: 'rect', posX: 51, posY: 34 },
  { number: 6, code: 't6', seats: 2, zone: 'Terrace', shape: 'round', posX: 76, posY: 16 },
  { number: 7, code: 't7', seats: 4, zone: 'Terrace', shape: 'square', posX: 76, posY: 38 },
  { number: 8, code: 't8', seats: 4, zone: 'Terrace', shape: 'square', posX: 89, posY: 52 },
];

const GUESTS = [
  { phone: '+15550100101', name: 'Emma' },
  { phone: '+15550100102', name: 'Daniel' },
  { phone: '+15550100103', name: 'Sofia' },
  { phone: '+15550100104', name: 'Marcus' },
];

const AYCE_PRICE = 29.9;

async function main() {
  console.log('Seeding QARTA (KAIYO AYCE)…');

  await prisma.loyaltyTransaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.tableSession.deleteMany();
  await prisma.waiterCall.deleteMany();
  await prisma.loyaltyAccount.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.table.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      email: 'admin@qarta.app',
      passwordHash: await bcrypt.hash('Qarta2024!', 10),
      name: 'KAIYO Staff',
    },
  });

  await prisma.settings.create({
    data: { id: 1, name: 'KAIYO', tagline: 'Asian Grill & Sushi · All You Can Eat', aycePrice: AYCE_PRICE, roundLimit: 5 },
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
            image: i.image,
            ayce: i.ayce ?? true,
            price: i.price ?? 0,
            popular: i.popular ?? false,
            spicy: i.spicy ?? false,
          })),
        },
      },
    });
  }
  console.log(`  ✓ menu: ${Object.values(MENU).flat().length} items`);

  await prisma.table.createMany({ data: TABLES });

  const guests = [];
  for (const g of GUESTS) {
    guests.push(await prisma.guest.create({ data: { ...g, loyalty: { create: {} } } }));
  }

  // Historical CLOSED sessions over the past week → revenue chart, CRM, loyalty balances.
  const tables = await prisma.table.findMany();
  const paidItems = await prisma.menuItem.findMany({ where: { ayce: false } });
  const ayceItems = await prisma.menuItem.findMany({ where: { ayce: true } });
  let created = 0;
  for (let day = 6; day >= 0; day--) {
    const perDay = 2 + ((day * 7) % 3); // 2..4 sessions/day
    for (let k = 0; k < perDay; k++) {
      const guest = guests[(day + k) % guests.length];
      const table = tables[(day * 3 + k) % tables.length];
      const party = 2 + ((day + k) % 3); // 2..4 people
      const openedAt = new Date(Date.now() - day * 86400_000 - (k + 3) * 3600_000);
      const closedAt = new Date(openedAt.getTime() + 90 * 60_000);

      const drink = paidItems[(day + k) % paidItems.length];
      const extras = Number(drink.price) * party;
      const bill = party * AYCE_PRICE + extras;

      const account = await prisma.loyaltyAccount.findUnique({ where: { guestId: guest.id } });
      const earned = earnPoints(bill, Number(account!.totalSpent));

      const session = await prisma.tableSession.create({
        data: {
          tableId: table.id,
          guestId: guest.id,
          guests: party,
          status: 'CLOSED',
          total: bill,
          openedAt,
          closedAt,
        },
      });
      // one delivered round per historical session (for top-dishes stats)
      const picks = [
        ayceItems[(day * 5 + k) % ayceItems.length],
        ayceItems[(day * 5 + k + 9) % ayceItems.length],
      ];
      await prisma.order.create({
        data: {
          sessionId: session.id,
          status: 'DONE',
          extrasTotal: extras,
          createdAt: openedAt,
          items: {
            create: [
              ...picks.map((p) => ({ menuItemId: p.id, name: p.name, ayce: true, price: 0, qty: party, delivered: true })),
              { menuItemId: drink.id, name: drink.name, ayce: false, price: drink.price, qty: party, delivered: true },
            ],
          },
        },
      });
      await prisma.loyaltyAccount.update({
        where: { id: account!.id },
        data: { points: { increment: earned }, totalSpent: { increment: bill } },
      });
      await prisma.loyaltyTransaction.create({
        data: { accountId: account!.id, sessionId: session.id, type: 'EARN', points: earned, createdAt: closedAt },
      });
      created++;
    }
  }
  console.log(`  ✓ tables: ${TABLES.length}, guests: ${guests.length}, closed sessions: ${created}`);
  console.log('Done. Staff login: admin@qarta.app / Qarta2024!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
