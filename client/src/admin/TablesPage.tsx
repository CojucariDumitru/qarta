import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, ExternalLink, Minus, Move, Plus, Printer, Receipt, Timer, Users, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';
import { minutesSince, money, pts, type AdminTable, type Config, type SessionDetail } from '../types';
import { useGuestCardQuery } from './useGuestCard';

/* Floor plan drawn in a fixed 100×64 viewBox; table posX/posY are centers. */
const VB = { w: 100, h: 64 };

export default function TablesPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [local, setLocal] = useState<Record<string, { x: number; y: number }>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const { data: tables } = useQuery({
    queryKey: ['admin-tables'],
    queryFn: async () => (await api.get<AdminTable[]>('/admin/tables')).data,
    refetchInterval: edit ? false : 5000,
  });
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: async () => (await api.get<Config>('/config')).data,
  });

  const savePos = useMutation({
    mutationFn: async ({ id, x, y }: { id: string; x: number; y: number }) =>
      api.patch(`/admin/tables/${id}/position`, { posX: x, posY: y }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tables'] }),
  });

  const selected = tables?.find((t) => t.id === selectedId) ?? null;
  const pos = (t: AdminTable) => local[t.id] ?? { x: t.posX, y: t.posY };

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };

  const onTableDown = (t: AdminTable) => (e: React.PointerEvent) => {
    if (!edit) return;
    const p = toSvg(e);
    const c = pos(t);
    drag.current = { id: t.id, dx: p.x - c.x, dy: p.y - c.y };
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events have no active pointer */
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toSvg(e);
    const { id, dx, dy } = drag.current;
    setLocal((l) => ({
      ...l,
      [id]: { x: Math.min(96, Math.max(4, p.x - dx)), y: Math.min(60, Math.max(4, p.y - dy)) },
    }));
  };
  const onUp = () => {
    if (!drag.current) return;
    const { id } = drag.current;
    const c = local[id];
    if (c) savePos.mutate({ id, x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 });
    drag.current = null;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="display text-2xl font-extrabold">Floor map</h1>
        <div className="flex gap-2">
          <Link
            to="/admin/qr"
            className="text-sm rounded-full px-4 py-1.5 flex items-center gap-1.5 border hairline text-muted"
          >
            <Printer size={14} /> Print QRs
          </Link>
          <button
            onClick={() => {
              setEdit((v) => !v);
              setSelectedId(null);
            }}
            className={`text-sm rounded-full px-4 py-1.5 flex items-center gap-1.5 border ${
              edit ? 'bg-flame text-ink border-flame font-bold' : 'hairline text-muted'
            }`}
          >
            <Move size={14} /> {edit ? 'Done' : 'Edit layout'}
          </button>
        </div>
      </div>

      {edit && <p className="text-xs text-flame mb-3">Drag tables — the layout saves automatically.</p>}

      <div className="flex gap-4 text-xs text-muted mb-3">
        <span className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-full bg-paper border border-line inline-block" /> free
        </span>
        <span className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 inline-block" /> seated
        </span>
        <span className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-full bg-flame inline-block" /> calling
        </span>
      </div>

      <div className="rounded-3xl border hairline bg-paper/40 p-2 sm:p-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          className="w-full select-none"
          onPointerMove={onMove}
          onPointerUp={onUp}
          style={{ touchAction: edit ? 'none' : 'auto' }}
        >
          <Decor />
          {tables?.map((t) => (
            <TableShape
              key={t.id}
              table={t}
              cx={pos(t).x}
              cy={pos(t).y}
              selected={t.id === selectedId}
              edit={edit}
              timeLimitMin={config?.timeLimitMin ?? 90}
              onPointerDown={onTableDown(t)}
              onClick={() => !edit && setSelectedId(t.id)}
            />
          ))}
        </svg>
      </div>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-paper border-l hairline z-50 p-5 overflow-y-auto"
            >
              <TableDrawer table={selected} onClose={() => setSelectedId(null)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── drawer: seating management ────────────────────────────────── */

function TableDrawer({ table, onClose }: { table: AdminTable; onClose: () => void }) {
  const qc = useQueryClient();
  const [party, setParty] = useState(2);
  const [redeem, setRedeem] = useState(false);
  const [voidArmed, setVoidArmed] = useState(false);
  const [closed, setClosed] = useState<null | { total: number; discount: number; earned: number }>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-tables'] });
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
    qc.invalidateQueries({ queryKey: ['admin-session'] });
  };

  const session = useQuery({
    queryKey: ['admin-session', table.session?.id],
    queryFn: async () =>
      (await api.get<SessionDetail>(`/admin/sessions/${table.session!.id}`)).data,
    enabled: !!table.session,
    refetchInterval: 5000,
  });
  const card = useGuestCardQuery(session.data?.loyaltyGuest?.id);

  const openSeating = useMutation({
    mutationFn: async () => api.post('/admin/sessions', { tableId: table.id, guests: party }),
    onSuccess: invalidate,
  });
  const setGuests = useMutation({
    mutationFn: async (guests: number) =>
      api.patch(`/admin/sessions/${table.session!.id}`, { guests }),
    onSuccess: invalidate,
  });
  const resolveCall = useMutation({
    mutationFn: async (id: string) => api.post(`/admin/calls/${id}/resolve`),
    onSuccess: invalidate,
  });
  const markItem = useMutation({
    mutationFn: async ({ id, delivered }: { id: string; delivered: boolean }) =>
      api.patch(`/admin/order-items/${id}/delivered`, { delivered }),
    onSuccess: invalidate,
  });
  const closeBill = useMutation({
    mutationFn: async () => {
      const redeemPoints = redeem && card.data ? card.data.points : 0;
      return (await api.post(`/admin/sessions/${table.session!.id}/close`, { redeemPoints })).data;
    },
    onSuccess: (d) => {
      setClosed(d);
      invalidate();
    },
  });
  const voidSeating = useMutation({
    mutationFn: async () => api.post(`/admin/sessions/${table.session!.id}/void`),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const s = session.data;
  const rounds = s ? [...s.orders].reverse().filter((o) => o.status !== 'CANCELLED') : [];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display text-xl font-extrabold">Table {table.number}</h2>
          <p className="text-muted text-xs mt-0.5">
            {table.zone} · {table.seats} seats
          </p>
        </div>
        <button onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      {table.calls.map((c) => (
        <button
          key={c.id}
          onClick={() => resolveCall.mutate(c.id)}
          className="mt-4 w-full bg-flame text-ink font-bold rounded-2xl py-3 flex items-center justify-center gap-2 animate-pulse"
        >
          {c.kind === 'BILL' ? <Receipt size={16} /> : <Bell size={16} />}
          {c.kind === 'BILL' ? 'Bill requested — resolve' : 'Guest is calling — resolve'}
        </button>
      ))}

      {closed ? (
        <div className="mt-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
          <p className="display text-lg font-bold text-emerald-300">Bill settled</p>
          <p className="display text-3xl font-extrabold mt-2">{money(closed.total)}</p>
          {closed.discount > 0 && (
            <p className="text-xs text-muted mt-1">points discount −{money(closed.discount)}</p>
          )}
          {closed.earned > 0 && (
            <p className="text-xs text-flame mt-1">guest earned ${pts(closed.earned)} cashback</p>
          )}
        </div>
      ) : !table.session ? (
        <div className="mt-6 rounded-2xl border hairline p-5">
          <p className="text-sm text-muted mb-3 flex items-center gap-1.5">
            <Users size={14} /> Table is free — open a seating
          </p>
          <div className="flex items-center justify-between border hairline rounded-2xl px-4 py-2 mb-3">
            <button onClick={() => setParty((g) => Math.max(1, g - 1))} className="p-1.5">
              <Minus size={16} />
            </button>
            <span className="display text-xl font-extrabold">{party}</span>
            <button onClick={() => setParty((g) => Math.min(12, g + 1))} className="p-1.5">
              <Plus size={16} />
            </button>
          </div>
          <button
            onClick={() => openSeating.mutate()}
            className="w-full bg-flame text-ink font-bold rounded-2xl py-3"
          >
            Open seating
          </button>
        </div>
      ) : (
        s && (
          <>
            {/* party + bill */}
            <div className="mt-5 rounded-2xl border hairline p-4">
              <div className="flex items-center justify-between text-xs text-muted mb-3 pb-3 border-b hairline">
                <span className="flex items-center gap-1.5">
                  <Timer size={13} /> Seated {minutesSince(s.openedAt)} min
                </span>
                <span>
                  {new Date(s.openedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted">
                  <Users size={14} /> Party
                </span>
                <span className="flex items-center gap-3">
                  <button onClick={() => setGuests.mutate(Math.max(1, s.guests - 1))}>
                    <Minus size={14} />
                  </button>
                  <b className="display">{s.guests}</b>
                  <button onClick={() => setGuests.mutate(Math.min(12, s.guests + 1))}>
                    <Plus size={14} />
                  </button>
                </span>
              </div>
              <div className="mt-3 pt-3 border-t hairline space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>
                    AYCE {money(s.bill.aycePrice)} × {s.guests}
                  </span>
                  <span>{money(s.bill.ayceTotal)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Drinks & extras</span>
                  <span>{money(s.bill.extras)}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>Total</span>
                  <span>{money(s.bill.total)}</span>
                </div>
              </div>
            </div>

            {/* rounds with delivery ticking */}
            <h3 className="text-sm text-muted mt-5 mb-2">
              Rounds · tick what you've brought
            </h3>
            {rounds.length === 0 && (
              <p className="text-sm text-muted border hairline rounded-2xl p-4">No orders yet.</p>
            )}
            <div className="space-y-3">
              {rounds.map((o, idx) => (
                <div key={o.id} className="rounded-2xl border hairline p-4">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="font-bold text-cream">Round {rounds.length - idx}</span>
                    <span>
                      {new Date(o.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {o.status === 'DONE' && <span className="text-emerald-300 ml-2">done</span>}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {o.items.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => markItem.mutate({ id: i.id, delivered: !i.delivered })}
                        className="w-full flex items-center gap-2.5 text-sm text-left group"
                      >
                        <span
                          className={`w-5 h-5 rounded-md border grid place-items-center shrink-0 transition-colors ${
                            i.delivered
                              ? 'bg-emerald-500 border-emerald-500 text-ink'
                              : 'hairline group-hover:border-flame'
                          }`}
                        >
                          {i.delivered && <Check size={13} strokeWidth={3} />}
                        </span>
                        <span className={`flex-1 ${i.delivered ? 'line-through text-muted' : ''}`}>
                          {i.name} × {i.qty}
                        </span>
                        {!i.ayce && <span className="text-muted">{money(Number(i.price) * i.qty)}</span>}
                      </button>
                    ))}
                  </div>
                  {o.comment && <p className="text-xs text-flame mt-2">💬 {o.comment}</p>}
                </div>
              ))}
            </div>

            {/* close bill */}
            <div className="mt-5 rounded-2xl border hairline p-4">
              {s.loyaltyGuest && card.data && (
                <label className="flex items-center justify-between text-sm mb-3">
                  <span>
                    Use <b>{s.loyaltyGuest.name ?? s.loyaltyGuest.phone}</b>'s points ($
                    {pts(card.data.points)})
                  </span>
                  <input
                    type="checkbox"
                    checked={redeem}
                    onChange={(e) => setRedeem(e.target.checked)}
                    className="accent-[#FF6B2C] w-4 h-4"
                  />
                </label>
              )}
              <button
                onClick={() => closeBill.mutate()}
                disabled={closeBill.isPending}
                className="w-full bg-flame text-ink font-bold rounded-2xl py-3.5 disabled:opacity-50"
              >
                {closeBill.isPending ? 'Closing…' : `Close bill · ${money(s.bill.total)}`}
              </button>
              <button
                onClick={() => (voidArmed ? voidSeating.mutate() : setVoidArmed(true))}
                disabled={voidSeating.isPending}
                className={`w-full mt-2 rounded-2xl py-2.5 text-sm border ${
                  voidArmed ? 'border-red-400 text-red-400 font-bold' : 'hairline text-muted'
                }`}
              >
                {voidArmed ? 'Tap again — no bill will be charged' : 'Void seating (no bill)'}
              </button>
            </div>
          </>
        )
      )}

      <h3 className="text-sm text-muted mt-6 mb-2">Table QR</h3>
      <div className="rounded-2xl bg-white p-4 grid place-items-center">
        <QRCodeSVG value={`${location.origin}/m/${table.code}`} size={150} />
        <p className="text-ink/60 text-[11px] mt-2">
          {location.origin}/m/{table.code}
        </p>
      </div>
      <a
        href={`/m/${table.code}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 mb-2 w-full border hairline rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
      >
        <ExternalLink size={14} /> Open guest view
      </a>
    </>
  );
}

/* ── static floor-plan decor ───────────────────────────────────── */

function Decor() {
  const wall = 'rgba(245,243,238,0.22)';
  const faint = 'rgba(245,243,238,0.35)';
  return (
    <g>
      <rect x={1} y={1} width={98} height={62} rx={2} fill="none" stroke={wall} strokeWidth={0.8} />
      <line x1={65} y1={1} x2={65} y2={22} stroke={wall} strokeWidth={0.8} />
      <line x1={65} y1={34} x2={65} y2={63} stroke={wall} strokeWidth={0.8} />
      <rect x={4} y={3.5} width={24} height={5.5} rx={1.2} fill="rgba(255,107,44,0.10)" stroke="rgba(255,107,44,0.4)" strokeWidth={0.4} />
      <text x={16} y={7.1} textAnchor="middle" fontSize={2.6} fill={faint} fontWeight={700} letterSpacing={0.8}>SUSHI BAR</text>
      <rect x={44} y={3.5} width={18} height={7} rx={1.2} fill="rgba(245,243,238,0.04)" stroke={wall} strokeWidth={0.4} />
      <text x={53} y={7.7} textAnchor="middle" fontSize={2.6} fill={faint} fontWeight={700} letterSpacing={0.8}>KITCHEN</text>
      <rect x={52} y={54} width={10} height={7} rx={1.2} fill="rgba(245,243,238,0.04)" stroke={wall} strokeWidth={0.4} />
      <text x={57} y={58.3} textAnchor="middle" fontSize={2.4} fill={faint} fontWeight={700}>WC</text>
      <line x1={8} y1={63} x2={18} y2={63} stroke="#0A0A0D" strokeWidth={1.4} />
      <path d="M 13 59 l 0 3 m -1.6 -1.6 l 1.6 1.6 l 1.6 -1.6" stroke={faint} strokeWidth={0.5} fill="none" />
      <text x={13} y={57.6} textAnchor="middle" fontSize={2.2} fill={faint} letterSpacing={0.6}>ENTRANCE</text>
      <text x={33} y={20} textAnchor="middle" fontSize={5} fill="rgba(245,243,238,0.06)" fontWeight={800} letterSpacing={2}>MAIN HALL</text>
      <text x={82} y={30} textAnchor="middle" fontSize={5} fill="rgba(245,243,238,0.06)" fontWeight={800} letterSpacing={2}>TERRACE</text>
      {[8, 20, 32, 44, 56].map((y) => (
        <circle key={y} cx={97} cy={y} r={1.1} fill="rgba(52,211,153,0.35)" />
      ))}
    </g>
  );
}

/* ── a table with chairs ───────────────────────────────────────── */

function TableShape({
  table,
  cx,
  cy,
  selected,
  edit,
  timeLimitMin,
  onClick,
  onPointerDown,
}: {
  table: AdminTable;
  cx: number;
  cy: number;
  selected: boolean;
  edit: boolean;
  timeLimitMin: number;
  onClick: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const busy = !!table.session;
  const call = table.calls.length > 0;
  const elapsed = table.session ? minutesSince(table.session.openedAt) : 0;
  const overtime = busy && elapsed > timeLimitMin;

  const stroke = call
    ? '#FF6B2C'
    : overtime
      ? 'rgba(251,191,36,0.95)'
      : busy
        ? 'rgba(52,211,153,0.9)'
        : 'rgba(245,243,238,0.35)';
  const fill = call
    ? 'rgba(255,107,44,0.18)'
    : overtime
      ? 'rgba(251,191,36,0.12)'
      : busy
        ? 'rgba(52,211,153,0.12)'
        : '#141419';
  const chairFill = 'rgba(245,243,238,0.28)';

  const size: { r: number } | { w: number; h: number } =
    table.shape === 'rect' ? { w: 15, h: 8 } : table.shape === 'round' ? { r: 4.2 } : { w: 8.5, h: 8.5 };
  const halfW = 'r' in size ? size.r : size.w / 2;
  const halfH = 'r' in size ? size.r : size.h / 2;

  const chairs: { x: number; y: number; w: number; h: number }[] = [];
  if (table.shape === 'round') {
    chairs.push({ x: cx - 5.9, y: cy - 1.4, w: 1.2, h: 2.8 }, { x: cx + 4.7, y: cy - 1.4, w: 1.2, h: 2.8 });
  } else if (table.shape === 'square') {
    const half = 8.5 / 2;
    chairs.push(
      { x: cx - 1.4, y: cy - half - 1.9, w: 2.8, h: 1.2 },
      { x: cx - 1.4, y: cy + half + 0.7, w: 2.8, h: 1.2 },
      { x: cx - half - 1.9, y: cy - 1.4, w: 1.2, h: 2.8 },
      { x: cx + half + 0.7, y: cy - 1.4, w: 1.2, h: 2.8 }
    );
  } else {
    const hh = 8 / 2;
    [-4.2, 0, 4.2].forEach((dx) => {
      chairs.push(
        { x: cx + dx - 1.4, y: cy - hh - 1.9, w: 2.8, h: 1.2 },
        { x: cx + dx - 1.4, y: cy + hh + 0.7, w: 2.8, h: 1.2 }
      );
    });
  }

  return (
    <g
      data-n={table.number}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={call ? 'animate-pulse' : ''}
      style={{ cursor: edit ? 'grab' : 'pointer' }}
    >
      {chairs.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={0.6} fill={chairFill} />
      ))}
      {'r' in size ? (
        <circle cx={cx} cy={cy} r={size.r} fill={fill} stroke={stroke} strokeWidth={selected ? 0.9 : 0.5} />
      ) : (
        <rect
          x={cx - size.w / 2}
          y={cy - size.h / 2}
          width={size.w}
          height={size.h}
          rx={1.4}
          fill={fill}
          stroke={stroke}
          strokeWidth={selected ? 0.9 : 0.5}
        />
      )}
      <text x={cx} y={cy + (busy ? -0.2 : 1.1)} textAnchor="middle" fontSize={3} fontWeight={800} fill="#F5F3EE">
        {table.number}
      </text>
      {busy && (
        <text
          x={cx}
          y={cy + 2.9}
          textAnchor="middle"
          fontSize={1.8}
          fill={overtime ? 'rgba(251,191,36,0.95)' : 'rgba(245,243,238,0.65)'}
        >
          {table.session!.guests}p · {elapsed}m
        </text>
      )}
      {busy && table.session!.pendingItems > 0 && (
        <g>
          <circle cx={cx - halfW + 0.3} cy={cy - halfH + 0.3} r={1.6} fill="#141419" stroke="rgba(52,211,153,0.9)" strokeWidth={0.3} />
          <text x={cx - halfW + 0.3} y={cy - halfH + 0.95} textAnchor="middle" fontSize={1.7} fontWeight={700} fill="rgba(52,211,153,0.95)">
            {table.session!.pendingItems}
          </text>
        </g>
      )}
      {call && <circle cx={cx + halfW - 0.3} cy={cy - halfH + 0.3} r={1.3} fill="#FF6B2C" />}
    </g>
  );
}
