import { useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Check,
  ChevronRight,
  CookingPot,
  Flame,
  Minus,
  Plus,
  Receipt,
  Star,
  Timer,
  Users,
  X,
} from 'lucide-react';
import { api } from '../api';
import { useGuest } from './useGuest';
import { minutesSince, money, pts, type Category, type Config, type MenuItem, type SessionDetail, type TableInfo } from '../types';

interface CartLine {
  item: MenuItem;
  qty: number;
}

export default function MenuPage() {
  const { tableCode = '' } = useParams();
  const qc = useQueryClient();

  const config = useQuery({
    queryKey: ['config'],
    queryFn: async () => (await api.get<Config>('/config')).data,
  });
  const table = useQuery({
    queryKey: ['table', tableCode],
    queryFn: async () => (await api.get<TableInfo>(`/tables/${tableCode}`)).data,
    refetchInterval: 10_000,
  });

  const sessionId = table.data?.session?.id ?? null;

  if (table.isError)
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <p className="display text-2xl mb-2">Table not found</p>
          <p className="text-muted">Check the QR code or ask our staff for help.</p>
        </div>
      </div>
    );

  if (table.data && !sessionId)
    return (
      <PartyGate
        table={table.data}
        tableCode={tableCode}
        config={config.data}
        onStarted={() => qc.invalidateQueries({ queryKey: ['table', tableCode] })}
      />
    );

  return sessionId ? <Seating tableCode={tableCode} sessionId={sessionId} /> : null;
}

/* ── start screen: party size ──────────────────────────────────── */

function PartyGate({
  table,
  tableCode,
  config,
  onStarted,
}: {
  table: TableInfo;
  tableCode: string;
  config?: Config;
  onStarted: () => void;
}) {
  const [guests, setGuests] = useState(2);
  const { guest } = useGuest();

  const start = useMutation({
    mutationFn: async () => api.post('/sessions', { tableCode, guests, guestId: guest?.guestId }),
    onSuccess: onStarted,
  });

  // production mode: staff seats guests; this screen just waits for the seating to open
  if (config && !config.guestCanOpen)
    return (
      <div className="min-h-screen max-w-lg mx-auto px-6 flex flex-col justify-center pb-16 text-center">
        <p className="text-[11px] tracking-[0.25em] text-flame font-semibold">
          TABLE {table.number} · {table.zone.toUpperCase()}
        </p>
        <h1 className="display text-4xl font-extrabold mt-2">{config.name}</h1>
        <p className="text-muted mt-1">{config.tagline}</p>
        <div className="mt-8 rounded-3xl border hairline p-6">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-flame animate-pulse" />
          <p className="font-bold text-lg mt-3">One moment…</p>
          <p className="text-muted text-sm mt-1">
            Our staff will open your table shortly. The menu appears here automatically.
          </p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen max-w-lg mx-auto px-6 flex flex-col justify-center pb-16">
      <p className="text-[11px] tracking-[0.25em] text-flame font-semibold">
        TABLE {table.number} · {table.zone.toUpperCase()}
      </p>
      <h1 className="display text-4xl font-extrabold mt-2">{config?.name ?? 'KAIYO'}</h1>
      <p className="text-muted mt-1">{config?.tagline ?? 'All You Can Eat'}</p>

      <div className="mt-8 rounded-3xl border hairline p-6">
        <p className="font-bold text-lg">
          All You Can Eat · <span className="text-flame">{money(config?.aycePrice ?? 29.9)}</span>
          <span className="text-muted text-sm font-normal"> / person</span>
        </p>
        <p className="text-muted text-sm mt-1">
          Order unlimited rounds from the whole menu. Drinks are charged separately.
        </p>

        <p className="text-sm text-muted mt-6 mb-2 flex items-center gap-1.5">
          <Users size={14} /> How many of you?
        </p>
        <div className="flex items-center justify-between border hairline rounded-2xl px-5 py-3">
          <button onClick={() => setGuests((g) => Math.max(1, g - 1))} className="p-2">
            <Minus size={20} />
          </button>
          <span className="display text-3xl font-extrabold">{guests}</span>
          <button onClick={() => setGuests((g) => Math.min(12, g + 1))} className="p-2">
            <Plus size={20} />
          </button>
        </div>

        <button
          onClick={() => start.mutate()}
          disabled={start.isPending}
          className="w-full mt-5 bg-flame text-ink font-bold rounded-2xl py-4 active:scale-[0.99] disabled:opacity-50"
        >
          {start.isPending ? 'Starting…' : `Start · ${money((config?.aycePrice ?? 29.9) * guests)}`}
        </button>
        {start.isError && (
          <p className="text-red-400 text-xs mt-2 text-center">Could not start — try again</p>
        )}
      </div>
    </div>
  );
}

/* ── active seating: Menu / Your table tabs ────────────────────── */

function Seating({ tableCode, sessionId }: { tableCode: string; sessionId: string }) {
  const [tab, setTab] = useState<'menu' | 'table'>('menu');
  const navigate = useNavigate();
  const { guest } = useGuest();

  const menu = useQuery({
    queryKey: ['menu'],
    queryFn: async () => (await api.get<Category[]>('/menu')).data,
  });
  const session = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => (await api.get<SessionDetail>(`/sessions/${sessionId}`)).data,
    refetchInterval: 5000,
  });

  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheet, setSheet] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const s = session.data;
  const pendingCount =
    s?.orders
      .filter((o) => o.status !== 'CANCELLED')
      .flatMap((o) => o.items)
      .reduce((n, i) => n + (i.delivered ? 0 : i.qty), 0) ?? 0;

  const count = cart.reduce((sum, l) => sum + l.qty, 0);
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
    setCart((c) =>
      qty <= 0 ? c.filter((l) => l.item.id !== id) : c.map((l) => (l.item.id === id ? { ...l, qty } : l))
    );

  return (
    <div className="min-h-screen max-w-lg mx-auto pb-32">
      {/* header */}
      <header className="px-5 pt-6 pb-3 flex items-start justify-between">
        <div>
          <p className="text-[11px] tracking-[0.25em] text-flame font-semibold">
            TABLE {s?.table.number ?? '…'} · {s?.guests ?? '…'} GUESTS · AYCE
          </p>
          <h1 className="display text-3xl font-extrabold mt-1">KAIYO</h1>
        </div>
        <button
          onClick={() => navigate('/loyalty')}
          className="shrink-0 rounded-full border hairline px-3 py-2 text-xs font-semibold flex items-center gap-1.5"
        >
          <Star size={13} className="text-flame" />
          {guest ? `$${pts(guest.points)}` : 'Rewards'}
        </button>
      </header>

      {/* tabs */}
      <div className="sticky top-0 z-20 bg-ink/95 backdrop-blur px-5 pt-2 pb-0 border-b hairline">
        <div className="flex gap-6">
          <TabButton active={tab === 'menu'} onClick={() => setTab('menu')}>
            Menu
          </TabButton>
          <TabButton active={tab === 'table'} onClick={() => setTab('table')}>
            Your table
            {pendingCount > 0 && (
              <span className="ml-1.5 bg-flame text-ink text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </TabButton>
        </div>
      </div>

      {tab === 'menu' ? (
        <>
          {/* category chips */}
          <nav className="sticky top-[41px] z-10 bg-ink/90 backdrop-blur border-b hairline px-3 py-2 flex gap-1 overflow-x-auto">
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

          {menu.data?.map((c) => (
            <section key={c.id} ref={(el) => (sectionRefs.current[c.id] = el)} className="px-5 pt-7 scroll-mt-24">
              <h2 className="display text-lg font-semibold mb-4">{c.name}</h2>
              <div className="space-y-4">
                {c.items.map((item) => (
                  <button key={item.id} onClick={() => setSheet(item)} className="w-full flex gap-4 text-left group">
                    <div className="flex-1 py-1 border-b hairline pb-4">
                      <p className="font-semibold flex items-center gap-1.5">
                        {item.name}
                        {item.popular && <Star size={12} className="text-flame fill-flame" />}
                        {item.spicy && <Flame size={12} className="text-flame" />}
                      </p>
                      <p className="text-muted text-[13px] mt-1 line-clamp-2">{item.description}</p>
                      <p className="mt-2 font-semibold">
                        {item.ayce ? (
                          <span className="text-[11px] tracking-wider bg-flame/15 text-flame rounded-full px-2.5 py-1 font-bold">
                            AYCE
                          </span>
                        ) : (
                          <span className="text-flame">{money(item.price)}</span>
                        )}
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <img src={item.image} alt={item.name} loading="lazy" className="w-24 h-24 rounded-2xl object-cover" />
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
        </>
      ) : (
        s && <TableTab session={s} tableCode={tableCode} />
      )}

      {/* floating cart bar */}
      <AnimatePresence>
        {count > 0 && tab === 'menu' && (
          <motion.button
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            onClick={() => setCartOpen(true)}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-md bg-flame text-ink rounded-2xl px-5 py-4 flex items-center justify-between font-bold shadow-2xl z-30"
          >
            <span className="flex items-center gap-2">
              <span className="bg-ink/15 rounded-full w-6 h-6 grid place-items-center text-sm">{count}</span>
              Review round
            </span>
            <ChevronRight size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      <ItemSheet item={sheet} onClose={() => setSheet(null)} onAdd={add} />
      {s && (
        <CartSheet
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          cart={cart}
          setQty={setQty}
          session={s}
          onPlaced={() => {
            setCart([]);
            setCartOpen(false);
            setTab('table');
            session.refetch();
          }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`pb-2.5 text-sm font-bold border-b-2 flex items-center ${
        active ? 'border-flame text-cream' : 'border-transparent text-muted'
      }`}
    >
      {children}
    </button>
  );
}

/* ── "Your table": everything ordered + live delivery status ───── */

function TableTab({ session, tableCode }: { session: SessionDetail; tableCode: string }) {
  const { guest, identify } = useGuest();
  const qc = useQueryClient();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [called, setCalled] = useState<'WAITER' | 'BILL' | null>(null);

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: async () => (await api.get<Config>('/config')).data,
  });
  const elapsed = minutesSince(session.openedAt);
  const limit = config?.timeLimitMin ?? 90;
  const overtime = elapsed > limit;

  const call = useMutation({
    mutationFn: async (kind: 'WAITER' | 'BILL') => api.post('/waiter-call', { tableCode, kind }),
    onSuccess: (_d, kind) => setCalled(kind),
  });
  const attach = useMutation({
    mutationFn: async (guestId: string) => api.post(`/sessions/${session.id}/attach`, { guestId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', session.id] }),
  });

  const rounds = [...session.orders].reverse().filter((o) => o.status !== 'CANCELLED');

  return (
    <div className="px-5 pt-5">
      {/* live bill */}
      <div className="rounded-3xl border hairline p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted flex items-center gap-1.5">
            <Receipt size={14} /> Your bill so far
          </p>
          <span className={`text-xs font-semibold ${overtime ? 'text-flame' : 'text-muted'}`}>
            <Timer size={12} className="inline -mt-0.5 mr-1" />
            {elapsed} / {limit} min
          </span>
        </div>
        <div className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span>
              All You Can Eat · {money(session.bill.aycePrice)} × {session.guests}
            </span>
            <span>{money(session.bill.ayceTotal)}</span>
          </div>
          {session.bill.extras > 0 && (
            <div className="flex justify-between text-muted">
              <span>Drinks & extras</span>
              <span>{money(session.bill.extras)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t hairline mt-2">
            <span>Total</span>
            <span>{money(session.bill.total)}</span>
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          onClick={() => call.mutate('WAITER')}
          className="rounded-2xl border hairline py-3 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <Bell size={15} className={called === 'WAITER' ? 'text-flame' : ''} />
          {called === 'WAITER' ? 'Waiter is coming' : 'Call waiter'}
        </button>
        <button
          onClick={() => call.mutate('BILL')}
          className="rounded-2xl border hairline py-3 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <Receipt size={15} className={called === 'BILL' ? 'text-flame' : ''} />
          {called === 'BILL' ? 'Bill requested' : 'Request bill'}
        </button>
      </div>

      {/* loyalty attach */}
      <div className="mt-3 rounded-2xl border hairline p-4">
        {session.loyaltyGuest ? (
          <p className="text-sm flex items-center gap-2">
            <Star size={14} className="text-flame fill-flame" />
            Cashback lands on <b>{session.loyaltyGuest.name ?? session.loyaltyGuest.phone}</b>'s card when the bill is paid
          </p>
        ) : guest ? (
          <button onClick={() => attach.mutate(guest.guestId)} className="text-sm flex items-center justify-between w-full">
            <span className="flex items-center gap-2">
              <Star size={14} className="text-flame" /> Attach your rewards card — earn {Math.round(guest.tier.rate * 100)}% cashback
            </span>
            <ChevronRight size={16} className="text-muted" />
          </button>
        ) : (
          <button onClick={() => setPhoneOpen(true)} className="text-sm flex items-center justify-between w-full">
            <span className="flex items-center gap-2">
              <Star size={14} className="text-flame" /> Join rewards — 5% cashback on this bill
            </span>
            <ChevronRight size={16} className="text-muted" />
          </button>
        )}
      </div>

      {/* rounds */}
      <h2 className="display text-lg font-semibold mt-7 mb-3">Ordered</h2>
      {rounds.length === 0 && (
        <p className="text-muted text-sm">Nothing yet — open the menu and send your first round.</p>
      )}
      <div className="space-y-4">
        {rounds.map((o, idx) => (
          <div key={o.id} className="rounded-2xl border hairline p-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-bold text-cream">Round {rounds.length - idx}</span>
              <span>
                {new Date(o.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {o.items.map((i) => (
                <div key={i.id} className="flex items-center gap-2.5 text-sm">
                  {i.delivered ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 grid place-items-center shrink-0">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-flame/15 text-flame grid place-items-center shrink-0">
                      <CookingPot size={11} />
                    </span>
                  )}
                  <span className={`flex-1 ${i.delivered ? 'text-muted' : ''}`}>
                    {i.name} × {i.qty}
                  </span>
                  {!i.ayce && <span className="text-muted">{money(Number(i.price) * i.qty)}</span>}
                </div>
              ))}
            </div>
            {o.comment && <p className="text-xs text-flame mt-2.5">💬 {o.comment}</p>}
          </div>
        ))}
      </div>

      <PhoneSheet
        open={phoneOpen}
        onClose={() => setPhoneOpen(false)}
        identify={async (phone, name) => {
          const card = await identify(phone, name);
          await attach.mutateAsync(card.guestId);
        }}
      />
    </div>
  );
}

/* ── bottom sheets ─────────────────────────────────────────────── */

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
                <button onClick={() => setQtyLocal((q) => Math.max(1, q - 1))}>
                  <Minus size={16} />
                </button>
                <span className="font-bold w-5 text-center">{qty}</span>
                <button onClick={() => setQtyLocal((q) => Math.min(20, q + 1))}>
                  <Plus size={16} />
                </button>
              </div>
              <button
                onClick={() => {
                  onAdd(item, qty);
                  setQtyLocal(1);
                  onClose();
                }}
                className="bg-flame text-ink font-bold rounded-full px-6 py-3 active:scale-95"
              >
                Add{item.ayce ? '' : ` · ${money(Number(item.price) * qty)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function CartSheet({
  open,
  onClose,
  cart,
  setQty,
  session,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartLine[];
  setQty: (id: string, qty: number) => void;
  session: SessionDetail;
  onPlaced: () => void;
}) {
  const [comment, setComment] = useState('');

  const cap = session.roundLimit * session.guests;
  const ayceCount = cart.reduce((n, l) => n + (l.item.ayce ? l.qty : 0), 0);
  const extras = cart.reduce((s, l) => s + (l.item.ayce ? 0 : Number(l.item.price) * l.qty), 0);
  const over = ayceCount > cap;

  const place = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/orders', {
        sessionId: session.id,
        comment: comment || undefined,
        items: cart.map((l) => ({ menuItemId: l.item.id, qty: l.qty })),
      });
      return data;
    },
    onSuccess: () => {
      setComment('');
      onPlaced();
    },
  });

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="display text-xl font-bold">This round</h3>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {cart.map((l) => (
            <div key={l.item.id} className="flex items-center gap-3 border-b hairline pb-3">
              <img src={l.item.image} className="w-12 h-12 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{l.item.name}</p>
                <p className="text-muted text-xs">{l.item.ayce ? 'AYCE' : money(l.item.price)}</p>
              </div>
              <div className="flex items-center gap-3 border hairline rounded-full px-2.5 py-1.5">
                <button onClick={() => setQty(l.item.id, l.qty - 1)}>
                  <Minus size={14} />
                </button>
                <span className="text-sm font-bold w-4 text-center">{l.qty}</span>
                <button onClick={() => setQty(l.item.id, l.qty + 1)}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Note for the kitchen…"
          className="w-full mt-4 bg-ink rounded-xl px-4 py-3 text-sm outline-none border hairline focus:border-flame/50"
        />

        {/* round cap */}
        <div className="mt-4 rounded-2xl border hairline p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">AYCE items this round</span>
            <span className={`font-bold ${over ? 'text-red-400' : ''}`}>
              {ayceCount} / {cap}
            </span>
          </div>
          <div className="h-1.5 bg-ink rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${over ? 'bg-red-400' : 'bg-flame'}`}
              style={{ width: `${Math.min(100, (ayceCount / cap) * 100)}%` }}
            />
          </div>
          {over && (
            <p className="text-red-400 text-xs mt-2">
              Max {cap} AYCE items per round for {session.guests} guest{session.guests > 1 ? 's' : ''} — you can always send another round.
            </p>
          )}
          {extras > 0 && (
            <div className="flex justify-between mt-3 pt-3 border-t hairline">
              <span className="text-muted">Drinks & extras</span>
              <span className="font-bold">{money(extras)}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => place.mutate()}
          disabled={place.isPending || cart.length === 0 || over}
          className="w-full mt-4 bg-flame text-ink font-bold rounded-2xl py-4 active:scale-[0.99] disabled:opacity-50"
        >
          {place.isPending ? 'Sending…' : 'Send to kitchen'}
        </button>
        {place.isError && (
          <p className="text-red-400 text-xs mt-2 text-center">
            {(place.error as any)?.response?.data?.error ?? 'Could not send the round'}
          </p>
        )}
      </div>
    </Sheet>
  );
}

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
        <h3 className="display text-xl font-bold">Rewards card</h3>
        <p className="text-muted text-sm mt-1">
          Up to 10% cashback in points on every bill. Spend points on your next visit.
        </p>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          inputMode="tel"
          className="w-full mt-4 bg-ink rounded-xl px-4 py-3.5 outline-none border hairline focus:border-flame/50"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
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
              setErr('Check the phone number');
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || phone.replace(/\D/g, '').length < 6}
          className="w-full mt-4 bg-flame text-ink font-bold rounded-2xl py-4 disabled:opacity-50"
        >
          {busy ? 'One second…' : 'Get my card'}
        </button>
      </div>
    </Sheet>
  );
}
