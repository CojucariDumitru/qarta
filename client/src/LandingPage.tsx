import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Gift,
  QrCode,
  Star,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

const FEATURES = [
  {
    icon: QrCode,
    title: 'QR-меню',
    text: 'Гость сканирует код на столе и заказывает сам — без ожидания официанта и бумажных меню.',
  },
  {
    icon: Star,
    title: 'Система лояльности',
    text: 'Кэшбэк баллами с каждого заказа, уровни Bronze/Silver/Gold и оплата баллами до 50% чека.',
  },
  {
    icon: Bell,
    title: 'Заказы и вызовы',
    text: 'Живая доска заказов и карта зала: официант видит новый заказ и вызов за секунды.',
  },
  {
    icon: Users,
    title: 'CRM гостей',
    text: 'Кто ходит, сколько тратит, какой уровень лояльности — вся база в одном экране.',
  },
  {
    icon: BarChart3,
    title: 'Аналитика',
    text: 'Выручка по дням, средний чек, топ блюд. Видно, что продаётся, а что лежит мёртвым грузом.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Управление меню',
    text: 'Стоп-лист в один клик, цены и фото меняются мгновенно у всех гостей.',
  },
];

const PLANS = [
  {
    name: 'Витрина',
    price: '49',
    features: ['QR-меню с фото', 'Неограниченно столов', 'Стоп-лист и цены онлайн'],
  },
  {
    name: 'Pro',
    price: '99',
    hot: true,
    features: ['Всё из «Витрины»', 'Заказы со стола + вызов официанта', 'Карта зала и доска заказов', 'CRM гостей'],
  },
  {
    name: 'Premium',
    price: '149',
    features: ['Всё из Pro', 'Глубокая аналитика', 'Приоритетная поддержка 24/7'],
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
            Для ресторанов
          </Link>
          <Link
            to="/m/t1"
            className="bg-flame text-ink font-bold rounded-full px-4 py-2 flex items-center gap-1.5"
          >
            Демо <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      {/* hero — asymmetric, huge type */}
      <header className="max-w-6xl mx-auto px-5 pt-14 pb-20 grid lg:grid-cols-12 gap-10 items-end">
        <div className="lg:col-span-7">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="display text-4xl sm:text-6xl font-extrabold leading-[1.05]"
          >
            Меню в QR.
            <br />
            Заказ со стола.
            <br />
            <span className="text-flame">Гость возвращается.</span>
          </motion.h1>
          <p className="text-muted mt-6 max-w-md text-lg">
            QARTA — платформа для ресторанов: электронное меню, заказы без официанта и система
            лояльности, которая превращает случайных гостей в постоянных.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/m/t1" className="bg-flame text-ink font-bold rounded-2xl px-6 py-4">
              Открыть демо-меню
            </Link>
            <Link to="/admin" className="border hairline rounded-2xl px-6 py-4 font-semibold">
              Кабинет ресторана
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
              <img
                src="https://res.cloudinary.com/dozr400tl/image/upload/c_fill,g_auto,w_600,h_400,f_auto,q_auto/grindhouse/menu/og-smash"
                className="w-full h-36 object-cover"
              />
              <div className="p-4">
                <p className="text-[9px] tracking-[0.25em] text-flame font-bold">СТОЛ 3 · GRINDHOUSE</p>
                <p className="font-bold mt-1 text-sm">The OG Smash</p>
                <p className="text-muted text-[11px] mt-0.5">Двойная смэш-котлета, чеддер…</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-flame font-bold text-sm">$12.99</span>
                  <span className="bg-flame text-ink text-[11px] font-bold rounded-full px-3 py-1.5">
                    В корзину
                  </span>
                </div>
                <div className="mt-3 rounded-xl bg-flame/10 border border-flame/30 px-3 py-2 flex items-center gap-2">
                  <Star size={11} className="text-flame fill-flame" />
                  <span className="text-[10px] text-flame font-semibold">Кэшбэк 5% баллами</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </header>

      {/* loyalty gift banner — the reel offer */}
      <div className="border-y hairline bg-flame/5">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-wrap items-center gap-4 justify-between">
          <p className="flex items-center gap-3 font-semibold">
            <Gift className="text-flame" size={22} />
            Дарим систему лояльности при подключении годового пакета
          </p>
          <Link to="/m/t1" className="text-flame font-bold flex items-center gap-1 text-sm">
            Попробовать <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* features — hairline rows, not cards */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <h2 className="display text-3xl font-extrabold mb-10">
          Что внутри<span className="text-flame">.</span>
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
          Тарифы<span className="text-flame">.</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-3xl p-7 border ${
                p.hot ? 'border-flame bg-flame/5 relative' : 'hairline'
              }`}
            >
              {p.hot && (
                <span className="absolute -top-3 left-7 bg-flame text-ink text-[11px] font-bold rounded-full px-3 py-1">
                  Популярный
                </span>
              )}
              <p className="font-bold text-lg">{p.name}</p>
              <p className="display text-4xl font-extrabold mt-3">
                ${p.price}
                <span className="text-sm text-muted font-normal"> /мес</span>
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
                  <Gift size={13} /> Лояльность в подарок при оплате за год
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
          <Link to="/admin" className="hover:text-cream">Вход для персонала</Link>
        </div>
        <p className="display font-extrabold text-[18vw] leading-none text-center text-cream/[0.04] select-none -mb-[6vw]">
          QARTA
        </p>
      </footer>
    </div>
  );
}
