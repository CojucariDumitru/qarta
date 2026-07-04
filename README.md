# QARTA — QR ordering & loyalty for AYCE restaurants

Guests scan the QR on their table, set the party size and order rounds from their phones; every plate is ticked off as it lands on the table; the bill (AYCE per person + drinks) closes in one tap with loyalty cashback.

**Live:** https://qarta-teal.vercel.app · API: https://qarta-api.vercel.app/api/health

Demo restaurant: **KAIYO** — Asian Grill & Sushi, All You Can Eat ($29.90/person).

## How it works

**Guest** (`/m/:tableCode`, mobile-first)
- Scan the table QR → set party size → the seating opens
- Order unlimited AYCE rounds (sushi, ramen, onigiri, robata skewers…); drinks are priced separately
- Round cap: 5 AYCE items per person per round (configurable)
- **Your table** tab: everything ordered with live status — cooking → delivered ✓ — plus the running bill
- Call waiter / request bill; attach a rewards card for cashback (Bronze 5% / Silver 7% / Gold 10%, redeem up to 50% of a bill)

**Staff** (`/admin`)
- Interactive SVG floor map (sushi bar, kitchen, terrace): seated tables show party size + pending plates, waiter/bill calls pulse; drag tables in edit mode to match your room
- Table drawer: open a seating, adjust the party, **tick off delivered items**, close the bill with optional points redemption
- Rounds board with per-item delivery checkboxes, chime + badge on new rounds
- Menu management with AYCE/priced toggle and 86'ing
- Guest CRM (visits, spend, tier) and dashboard (revenue, covers, avg per cover, top dishes)
- Settings: restaurant name, AYCE price, round limit — applied to guests instantly

## Stack

- `server/` — Express + TypeScript + Prisma → Neon Postgres (runs as a single Vercel serverless function in prod)
- `client/` — React 18 + Vite + Tailwind + Framer Motion + TanStack Query

## Run locally

```bash
# API (port 5056)
cd server && npm install && npm run dev

# Client (port 5175, proxies /api to 5056, exposed on LAN for phone QR testing)
cd client && npm install && npm run dev
```

Demo access:
- Staff: `admin@qarta.app` / `Qarta2024!`
- Guest: any phone number (`+15550100101` — Emma — already has history and points)
- Demo tables: `/m/t1` … `/m/t8`

Dish photos are Wikipedia lead images re-hosted in Cloudinary (`server/scripts/upload-images.mjs`).

## Deploy

Both halves ship to Vercel via CLI: `npx vercel deploy --prod --yes` in `server/` and `client/`.
Server env vars: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`. Client: `VITE_API_URL` in `.env.production`.
