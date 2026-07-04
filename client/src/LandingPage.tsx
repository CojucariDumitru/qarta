import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Check,
  Gift,
  LayoutGrid,
  QrCode,
  Star,
  Users,
} from 'lucide-react';

const img = (id: string, t = 'c_fill,g_auto,w_600,h_400') =>
  `https://res.cloudinary.com/dozr400tl/image/upload/${t},f_auto,q_auto/qarta/menu/${id}`;

const FEATURES = [
  {
    icon: QrCode,
    title: 'QR ordering',
    text: 'Guests scan the table code, set their party size and order rounds themselves — no waiting for a waiter.',
  },
  {
    icon: Check,
    title: 'Delivery tracking',
    text: 'Every plate is ticked off as it lands on the table. Guests see live status; nothing gets lost.',
  },
  {
    icon: LayoutGrid,
    title: 'Live floor map',
    text: 'A real map of your room: seated tables, pending items, waiter calls. Drag tables to match your layout.',
  },
  {
    icon: Star,
    title: 'Built-in loyalty',
    text: 'Cashback in points on every bill with Bronze / Silver / Gold tiers. Points pay up to 50% of the next visit.',
  },
  {
    icon: Users,
    title: 'Guest CRM',
    text: 'Who returns, how much they spend, what tier they hold — the whole base in one screen.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    text: 'Revenue by day, covers, average per cover and the dishes your kitchen actually sells.',
  },
];

const PLANS = [
  {
    name: 'Menu',
    price: '49',
    features: ['QR menu with photos', 'Unlimited tables', 'Instant 86 / price changes'],
  },
  {
    name: 'Pro',
    price: '99',
    hot: true,
    features: [
      'Everything in Menu',
      'AYCE sessions & round limits',
      'Table ordering + delivery ticking',
      'Live floor map & waiter calls',
      'Guest CRM',
    ],
  },
  {
    name: 'Premium',
    price: '149',
    features: ['Everything in Pro', 'Deep analytics', 'Priority 24/7 support'],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* nav */}
      <nav className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <p className="display font-extrabold text-xl">
          QARTA<span className="text-flame">.</span>
        </p>
        <div className="flex items-center gap-5 text-sm">
          <Link to="/admin" className="text-muted hover:text-cream hidden sm:block">
            For restaurants
          </Link>
          <Link to="/m/t1" className="bg-flame text-ink font-bold rounded-full px-4 py-2 flex items-center gap-1.5">
            Live demo <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      {/* hero */}
      <header className="max-w-6xl mx-auto px-5 pt-14 pb-20 grid lg:grid-cols-12 gap-10 items-end">
        <div className="lg:col-span-7">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="display text-4xl sm:text-6xl font-extrabold leading-[1.05]"
          >
            All-you-can-eat,
            <br />
            minus the chaos.
            <br />
            <span className="text-flame">Scan. Order. Served.</span>
          </motion.h1>
          <p className="text-muted mt-6 max-w-md text-lg">
            QARTA runs your AYCE floor: guests order rounds from their phones, the kitchen sees every
            plate, waiters tick off what's delivered, and the bill closes itself.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/m/t1" className="bg-flame text-ink font-bold rounded-2xl px-6 py-4">
              Try the demo menu
            </Link>
            <Link to="/admin" className="border hairline rounded-2xl px-6 py-4 font-semibold">
              Staff panel
            </Link>
          </div>
        </div>

        {/* phone mockup */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-5 justify-self-center lg:justify-self-end"
        >
          <div className="w-64 rounded-[2.2rem] border-2 border-line bg-paper p-3 shadow-2xl rotate-2">
            <div className="rounded-[1.7rem] overflow-hidden bg-ink">
              <img src={img('salmon-nigiri')} className="w-full h-36 object-cover" />
              <div className="p-4">
                <p className="text-[9px] tracking-[0.25em] text-flame font-bold">TABLE 3 · 4 GUESTS · AYCE</p>
                <p className="font-bold mt-1 text-sm">Salmon Nigiri</p>
                <p className="text-muted text-[11px] mt-0.5">Fresh salmon over hand-pressed rice…</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] tracking-wider bg-flame/15 text-flame rounded-full px-2.5 py-1 font-bold">
                    AYCE
                  </span>
                  <span className="bg-flame text-ink text-[11px] font-bold rounded-full px-3 py-1.5">Add to round</span>
                </div>
                <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 flex items-center gap-2">
                  <Check size={11} className="text-emerald-300" />
                  <span className="text-[10px] text-emerald-300 font-semibold">Round 2 · Gyoza delivered</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </header>

      {/* loyalty gift banner */}
      <div className="border-y hairline bg-flame/5">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-wrap items-center gap-4 justify-between">
          <p className="flex items-center gap-3 font-semibold">
            <Gift className="text-flame" size={22} />
            Loyalty program free with any annual plan
          </p>
          <Link to="/m/t1" className="text-flame font-bold flex items-center gap-1 text-sm">
            See it live <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* features */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <h2 className="display text-3xl font-extrabold mb-10">
          What's inside<span className="text-flame">.</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-x-14">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="flex gap-5 py-6 border-b hairline">
              <f.icon className="text-flame shrink-0 mt-1" size={20} />
              <div>
                <p className="font-bold">{f.title}</p>
                <p className="text-muted text-sm mt-1">{f.text}</p>
              </div>
              <span className="display text-muted/40 ml-auto text-sm">0{i + 1}</span>
            </div>
          ))}
        </div>
      </section>

      {/* pricing */}
      <section className="max-w-6xl mx-auto px-5 pb-24">
        <h2 className="display text-3xl font-extrabold mb-10">
          Pricing<span className="text-flame">.</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <div key={p.name} className={`rounded-3xl p-7 border ${p.hot ? 'border-flame bg-flame/5 relative' : 'hairline'}`}>
              {p.hot && (
                <span className="absolute -top-3 left-7 bg-flame text-ink text-[11px] font-bold rounded-full px-3 py-1">
                  Most popular
                </span>
              )}
              <p className="font-bold text-lg">{p.name}</p>
              <p className="display text-4xl font-extrabold mt-3">
                ${p.price}
                <span className="text-sm text-muted font-normal"> /mo</span>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-muted">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-flame">—</span> {f}
                  </li>
                ))}
              </ul>
              {p.hot && (
                <p className="mt-5 text-xs text-flame font-semibold flex items-center gap-1.5">
                  <Gift size={13} /> Loyalty free on annual billing
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* footer */}
      <footer className="border-t hairline overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 py-10 flex items-center justify-between text-sm text-muted">
          <span>© 2026 QARTA</span>
          <Link to="/admin" className="hover:text-cream">Staff sign in</Link>
        </div>
        <p className="display font-extrabold text-[18vw] leading-none text-center text-cream/[0.04] select-none -mb-[6vw]">
          QARTA
        </p>
      </footer>
    </div>
  );
}
