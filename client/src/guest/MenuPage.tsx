import { useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, Star, Plus, Minus, X, Bell, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { useGuest } from './useGuest';
import { money, pts, type Category, type MenuItem, type Order } from '../types';

interface CartLine {
  item: MenuItem;
  qty: number;
}

export default function MenuPage() {
  const { tableCode = '' } = useParams();
  const navigate = useNavigate();
  const { guest, identify, refresh } = useGuest();

  const table = useQuery({
    queryKey: ['table', tableCode],
    queryFn: async () => (await api.get(`/tables/${tableCode}`)).data,
  });
  const menu = useQuery({
    queryKey: ['menu'],
    queryFn: async () => (await api.get<Category[]>('/menu')).data,
  });

  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheet, setSheet] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [calledAt, setCalledAt] = useState<number | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const count = cart.reduce((s, l) => s + l.qty, 0);
  const subtotal = cart.reduce((s, l) => s + Number(l.item.price) * l.qty, 0);

  const add = (item: MenuItem, qty: number) => {
    setCart((c) => {
      const i = c.findIndex((l) => l.item.id === item.id);
      if (i === -1) return [...c, { item, qty }];
      const next = [...c];
      next[i] = { ...next[i], qty: next[i].qty + qty };
      return next;
    });
  };
  const setQty = (id: string, qty: number) =>
    setCart((c) => (qty <= 0 ? c.filter((l) => l.item.id !== id) : c.map((l) => (l.item.id === id ? { ...l, qty } : l))));

  const callWaiter = useMutation({
    mutationFn: async () => api.post('/waiter-call', { tableCode }),
    onSuccess: () => setCalledAt(Date.now()),
  });

  if (table.isError)
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <p className="display text-2xl mb-2">Стол не найден</p>
          <p className="text-muted">Проверьте QR-код или обратитесь к персоналу.</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen max-w-lg mx-auto pb-32">
      {/* header */}
      <header className="px-5 pt-6 pb-4 flex items-start justify-between">
        <div>
          <p className="text-[11px] tracking-[0.25em] text-flame font-semibold">QARTA · СТОЛ {table.data?.number ?? '…'}</p>
          <h1 className="display text-3xl font-extrabold mt-1">GRINDHOUSE</h1>
          <p className="text-muted text-sm mt-0.5">{table.data?.zone} · смэш-бургеры и стритфуд</p>
        </div>
        <button
          onClick={() => (guest ? navigate('/loyalty') : setPhoneOpen(true))}
          className="shrink-0 rounded-full border hairline px-3 py-2 text-xs font-semibold flex items-center gap-1.5"
        >
          <Star size={13} className="text-flame" />
          {guest ? `$${pts(guest.points)}` : 'Бонусы'}
        </button>
      </header>

      {/* waiter call */}
      <div className="px-5 mb-3">
        <button
          onClick={() => callWaiter.mutate()}
          disabled={!!calledAt}
          className="w-full rounded-xl border hairline py-2.5 text-sm text-muted flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <Bell size={15} className={calledAt ? 'text-flame' : ''} />
          {calledAt ? 'Официант уже идёт к вам' : 'Позвать официанта'}
        </button>
      </div>

      {/* category tabs */}
      <nav className="sticky top-0 z-20 bg-ink/90 backdrop-blur border-b hairline px-3 py-2 flex gap-1 overflow-x-auto">
        {menu.data?.map((c) => (
          <button
            key={c.id}
            onClick={() => sectionRefs.current[c.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm text-muted hover:text-cream"
          >
            {c.name}
          </button>
        ))}
      </nav>

      {/* sections */}
      {menu.data?.map((c) => (
        <section key={c.id} ref={(el) => (sectionRefs.current[c.id] = el)} className="px-5 pt-7 scroll-mt-14">
          <h2 className="display text-lg font-semibold mb-4">{c.name}</h2>
          <div className="space-y-4">
            {c.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSheet(item)}
                className="w-full flex gap-4 text-left group"
              >
                <div className="flex-1 py-1 border-b hairline pb-4">
                  <p className="font-semibold flex items-center gap-1.5">
                    {item.name}
                    {item.popular && <Star size={12} className="text-flame fill-flame" />}
                    {item.spicy && <Flame size={12} className="text-flame" />}
                  </p>
                  <p className="text-muted text-[13px] mt-1 line-clamp-2">{item.description}</p>
                  <p className="mt-2 font-semibold text-flame">{money(item.price)}</p>
                </div>
                <div className="relative shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className="w-24 h-24 rounded-2xl object-cover"
                  />
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      add(item, 1);
                    }}
                    className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-flame text-ink grid place-items-center shadow-lg active:scale-90"
                  >
                    <Plus size={16} strokeWidth={3} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* floating cart bar */}
      <AnimatePresence>
        {count > 0 && (
          <motion.button
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            onClick={() => setCartOpen(true)}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-md bg-flame text-ink rounded-2xl px-5 py-4 flex items-center justify-between font-bold shadow-2xl z-30"
          >
            <span className="flex items-center gap-2">
              <span className="bg-ink/15 rounded-full w-6 h-6 grid place-items-center text-sm">{count}</span>
              Корзина
            </span>
            <span className="flex items-center gap-1">
              {money(subtotal)} <ChevronRight size={18} />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <ItemSheet item={sheet} onClose={() => setSheet(null)} onAdd={add} />
      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        setQty={setQty}
        subtotal={subtotal}
        tableCode={tableCode}
        onNeedPhone={() => setPhoneOpen(true)}
        onPlaced={async (order) => {
          setCart([]);
          setCartOpen(false);
          if (guest) await refresh().catch(() => {});
          navigate(`/m/${tableCode}/order/${order.id}`, { state: { earned: order.earned } });
        }}
      />
      <PhoneSheet open={phoneOpen} onClose={() => setPhoneOpen(false)} identify={identify} />
    </div>
  );
}

/* ── item bottom sheet ─────────────────────────────────────────── */

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-paper rounded-t-3xl z-50 max-h-[90dvh] overflow-y-auto"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ItemSheet({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem, qty: number) => void;
}) {
  const [qty, setQtyLocal] = useState(1);
  return (
    <Sheet open={!!item} onClose={onClose}>
      {item && (
        <div>
          <div className="relative">
            <img src={item.image} alt={item.name} className="w-full h-64 object-cover rounded-t-3xl" />
            <button onClick={onClose} className="absolute top-4 right-4 bg-ink/70 rounded-full p-2">
              <X size={18} />
            </button>
          </div>
          <div className="p-5">
            <h3 className="display text-xl font-bold flex items-center gap-2">
              {item.name}
              {item.spicy && <Flame size={16} className="text-flame" />}
            </h3>
            <p className="text-muted text-sm mt-2">{item.description}</p>
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-4 border hairline rounded-full px-3 py-2">
                <button onClick={() => setQtyLocal((q) => Math.max(1, q - 1))}><Minus size={16} /></button>
                <span className="font-bold w-5 text-center">{qty}</span>
                <button onClick={() => setQtyLocal((q) => Math.min(20, q + 1))}><Plus size={16} /></button>
              </div>
              <button
                onClick={() => {
                  onAdd(item, qty);
                  setQtyLocal(1);
                  onClose();
                }}
                className="bg-flame text-ink font-bold rounded-full px-6 py-3 active:scale-95"
              >
                Добавить · {money(Number(item.price) * qty)}
              </button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ── cart sheet with loyalty redeem ────────────────────────────── */

function CartSheet({
  open,
  onClose,
  cart,
  setQty,
  subtotal,
  tableCode,
  onNeedPhone,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartLine[];
  setQty: (id: string, qty: number) => void;
  subtotal: number;
  tableCode: string;
  onNeedPhone: () => void;
  onPlaced: (order: Order) => void;
}) {
  const { guest } = useGuest();
  const [comment, setComment] = useState('');
  const [redeem, setRedeem] = useState(0);

  const maxRedeem = useMemo(() => {
    if (!guest) return 0;
    return Math.min(guest.points, Math.floor(subtotal * 0.5 * 100));
  }, [guest, subtotal]);
  const discount = Math.min(redeem, maxRedeem) / 100;
  const total = Math.max(0, subtotal - discount);

  const place = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Order>('/orders', {
        tableCode,
        guestId: guest?.guestId,
        comment: comment || undefined,
        redeemPoints: Math.min(redeem, maxRedeem),
        items: cart.map((l) => ({ menuItemId: l.item.id, qty: l.qty })),
      });
      return data;
    },
    onSuccess: onPlaced,
  });

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="display text-xl font-bold">Ваш заказ</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="space-y-3">
          {cart.map((l) => (
            <div key={l.item.id} className="flex items-center gap-3 border-b hairline pb-3">
              <img src={l.item.image} className="w-12 h-12 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{l.item.name}</p>
                <p className="text-muted text-xs">{money(l.item.price)}</p>
              </div>
              <div className="flex items-center gap-3 border hairline rounded-full px-2.5 py-1.5">
                <button onClick={() => setQty(l.item.id, l.qty - 1)}><Minus size={14} /></button>
                <span className="text-sm font-bold w-4 text-center">{l.qty}</span>
                <button onClick={() => setQty(l.item.id, l.qty + 1)}><Plus size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Комментарий к заказу…"
          className="w-full mt-4 bg-ink rounded-xl px-4 py-3 text-sm outline-none border hairline focus:border-flame/50"
        />

        {/* loyalty */}
        <div className="mt-4 rounded-2xl border hairline p-4">
          {guest ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Star size={14} className="text-flame fill-flame" /> Бонусы: ${pts(guest.points)}
                </span>
                <span className="text-muted text-xs">{guest.tier.label} · кэшбэк {Math.round(guest.tier.rate * 100)}%</span>
              </div>
              {maxRedeem > 0 && (
                <div className="mt-3">
                  <input
                    type="range"
                    min={0}
                    max={maxRedeem}
                    step={10}
                    value={Math.min(redeem, maxRedeem)}
                    onChange={(e) => setRedeem(Number(e.target.value))}
                    className="w-full accent-[#FF6B2C]"
                  />
                  <p className="text-xs text-muted mt-1">
                    Списать <span className="text-flame font-semibold">${(Math.min(redeem, maxRedeem) / 100).toFixed(2)}</span> баллами
                    (до 50% чека)
                  </p>
                </div>
              )}
            </>
          ) : (
            <button onClick={onNeedPhone} className="w-full text-left text-sm flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Star size={14} className="text-flame" /> Войдите по номеру — получите кэшбэк 5%
              </span>
              <ChevronRight size={16} className="text-muted" />
            </button>
          )}
        </div>

        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between text-muted"><span>Сумма</span><span>{money(subtotal)}</span></div>
          {discount > 0 && (
            <div className="flex justify-between text-flame"><span>Баллы</span><span>−{money(discount)}</span></div>
          )}
          <div className="flex justify-between font-bold text-lg pt-1"><span>Итого</span><span>{money(total)}</span></div>
        </div>

        <button
          onClick={() => place.mutate()}
          disabled={place.isPending || cart.length === 0}
          className="w-full mt-4 bg-flame text-ink font-bold rounded-2xl py-4 active:scale-[0.99] disabled:opacity-50"
        >
          {place.isPending ? 'Отправляем…' : `Заказать · ${money(total)}`}
        </button>
        {place.isError && <p className="text-red-400 text-xs mt-2 text-center">Не удалось отправить заказ</p>}
      </div>
    </Sheet>
  );
}

/* ── phone identify sheet ──────────────────────────────────────── */

function PhoneSheet({
  open,
  onClose,
  identify,
}: {
  open: boolean;
  onClose: () => void;
  identify: (phone: string, name?: string) => Promise<unknown>;
}) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="p-5 pb-8">
        <h3 className="display text-xl font-bold">Карта лояльности</h3>
        <p className="text-muted text-sm mt-1">
          Кэшбэк до 10% баллами с каждого заказа. Баллы можно тратить сразу.
        </p>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 ___ ___ __ __"
          inputMode="tel"
          className="w-full mt-4 bg-ink rounded-xl px-4 py-3.5 outline-none border hairline focus:border-flame/50"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Имя (необязательно)"
          className="w-full mt-2 bg-ink rounded-xl px-4 py-3.5 outline-none border hairline focus:border-flame/50"
        />
        {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
        <button
          onClick={async () => {
            setBusy(true);
            setErr('');
            try {
              await identify(phone, name || undefined);
              onClose();
            } catch {
              setErr('Проверьте номер телефона');
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || phone.replace(/\D/g, '').length < 6}
          className="w-full mt-4 bg-flame text-ink font-bold rounded-2xl py-4 disabled:opacity-50"
        >
          {busy ? 'Секунду…' : 'Получить карту'}
        </button>
      </div>
    </Sheet>
  );
}
