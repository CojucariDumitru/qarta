import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ExternalLink, Move, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';
import { money, STATUS_LABEL, type AdminTable, type OrderStatus } from '../types';

/* Floor plan drawn in a fixed 100×64 viewBox; table posX/posY are centers. */
const VB = { w: 100, h: 64 };

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  NEW: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'SERVED',
  SERVED: 'PAID',
};

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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-tables'] });
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  const resolveCall = useMutation({
    mutationFn: async (id: string) => api.post(`/admin/calls/${id}/resolve`),
    onSuccess: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) =>
      api.patch(`/admin/orders/${id}/status`, { status }),
    onSuccess: invalidate,
  });
  const savePos = useMutation({
    mutationFn: async ({ id, x, y }: { id: string; x: number; y: number }) =>
      api.patch(`/admin/tables/${id}/position`, { posX: x, posY: y }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tables'] }),
  });

  const selected = tables?.find((t) => t.id === selectedId) ?? null;
  const pos = (t: AdminTable) => local[t.id] ?? { x: t.posX, y: t.posY };

  /* pointer coords → viewBox coords */
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
      [id]: {
        x: Math.min(96, Math.max(4, p.x - dx)),
        y: Math.min(60, Math.max(4, p.y - dy)),
      },
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
        <h1 className="display text-2xl font-extrabold">Карта зала</h1>
        <button
          onClick={() => {
            setEdit((v) => !v);
            setSelectedId(null);
          }}
          className={`text-sm rounded-full px-4 py-1.5 flex items-center gap-1.5 border ${
            edit ? 'bg-flame text-ink border-flame font-bold' : 'hairline text-muted'
          }`}
        >
          <Move size={14} /> {edit ? 'Готово' : 'Редактор'}
        </button>
      </div>

      {edit && (
        <p className="text-xs text-flame mb-3">Перетащите столы — расстановка сохраняется автоматически.</p>
      )}

      {/* legend */}
      <div className="flex gap-4 text-xs text-muted mb-3">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-paper border border-line inline-block" /> свободен</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 inline-block" /> занят</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-flame inline-block" /> вызов официанта</span>
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
              onPointerDown={onTableDown(t)}
              onClick={() => !edit && setSelectedId(t.id)}
            />
          ))}
        </svg>
      </div>

      {/* table drawer */}
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="display text-xl font-extrabold">Стол №{selected.number}</h2>
                  <p className="text-muted text-xs mt-0.5">{selected.zone} · {selected.seats} мест</p>
                </div>
                <button onClick={() => setSelectedId(null)}><X size={20} /></button>
              </div>

              {selected.calls[0] && (
                <button
                  onClick={() => resolveCall.mutate(selected.calls[0].id)}
                  className="mt-4 w-full bg-flame text-ink font-bold rounded-2xl py-3 flex items-center justify-center gap-2 animate-pulse"
                >
                  <Bell size={16} /> Гость зовёт — принять вызов
                </button>
              )}

              <h3 className="text-sm text-muted mt-6 mb-2">Активные заказы</h3>
              {selected.orders.length === 0 && (
                <p className="text-sm text-muted border hairline rounded-2xl p-4">Стол свободен.</p>
              )}
              <div className="space-y-3">
                {selected.orders.map((o) => (
                  <div key={o.id} className="rounded-2xl border hairline p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold">№{o.number}</span>
                      <span className="text-muted text-xs">{STATUS_LABEL[o.status]} · {money(o.total)}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted space-y-0.5">
                      {o.items.map((i) => (
                        <p key={i.id}>{i.name} × {i.qty}</p>
                      ))}
                    </div>
                    {o.comment && <p className="text-xs text-flame mt-2">💬 {o.comment}</p>}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setStatus.mutate({ id: o.id, status: 'CANCELLED' })}
                        className="text-xs text-muted border hairline rounded-full px-3 py-1.5"
                      >
                        Отмена
                      </button>
                      {NEXT[o.status] && (
                        <button
                          onClick={() => setStatus.mutate({ id: o.id, status: NEXT[o.status]! })}
                          className="text-xs font-bold bg-flame text-ink rounded-full px-3 py-1.5"
                        >
                          → {STATUS_LABEL[NEXT[o.status]!]}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="text-sm text-muted mt-6 mb-2">QR стола</h3>
              <div className="rounded-2xl bg-white p-4 grid place-items-center">
                <QRCodeSVG value={`${location.origin}/m/${selected.code}`} size={150} />
                <p className="text-ink/60 text-[11px] mt-2">{location.origin}/m/{selected.code}</p>
              </div>
              <a
                href={`/m/${selected.code}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 w-full border hairline rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <ExternalLink size={14} /> Открыть меню стола
              </a>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── static floor-plan decor ───────────────────────────────────── */

function Decor() {
  const wall = 'rgba(245,243,238,0.22)';
  const faint = 'rgba(245,243,238,0.35)';
  return (
    <g>
      {/* outer walls */}
      <rect x={1} y={1} width={98} height={62} rx={2} fill="none" stroke={wall} strokeWidth={0.8} />
      {/* hall/terrace divider with a passage */}
      <line x1={65} y1={1} x2={65} y2={22} stroke={wall} strokeWidth={0.8} />
      <line x1={65} y1={34} x2={65} y2={63} stroke={wall} strokeWidth={0.8} />
      {/* bar */}
      <rect x={4} y={3.5} width={24} height={5.5} rx={1.2} fill="rgba(255,107,44,0.10)" stroke="rgba(255,107,44,0.4)" strokeWidth={0.4} />
      <text x={16} y={7.1} textAnchor="middle" fontSize={2.6} fill={faint} fontWeight={700} letterSpacing={0.8}>БАР</text>
      {/* kitchen */}
      <rect x={44} y={3.5} width={18} height={7} rx={1.2} fill="rgba(245,243,238,0.04)" stroke={wall} strokeWidth={0.4} />
      <text x={53} y={7.7} textAnchor="middle" fontSize={2.6} fill={faint} fontWeight={700} letterSpacing={0.8}>КУХНЯ</text>
      {/* wc */}
      <rect x={52} y={54} width={10} height={7} rx={1.2} fill="rgba(245,243,238,0.04)" stroke={wall} strokeWidth={0.4} />
      <text x={57} y={58.3} textAnchor="middle" fontSize={2.4} fill={faint} fontWeight={700}>WC</text>
      {/* entrance */}
      <line x1={8} y1={63} x2={18} y2={63} stroke="#0A0A0D" strokeWidth={1.4} />
      <path d="M 13 59 l 0 3 m -1.6 -1.6 l 1.6 1.6 l 1.6 -1.6" stroke={faint} strokeWidth={0.5} fill="none" />
      <text x={13} y={57.6} textAnchor="middle" fontSize={2.2} fill={faint} letterSpacing={0.6}>ВХОД</text>
      {/* zone labels */}
      <text x={33} y={20} textAnchor="middle" fontSize={5} fill="rgba(245,243,238,0.06)" fontWeight={800} letterSpacing={2}>ЗАЛ</text>
      <text x={82} y={30} textAnchor="middle" fontSize={5} fill="rgba(245,243,238,0.06)" fontWeight={800} letterSpacing={2}>ТЕРРАСА</text>
      {/* terrace plants along the right wall */}
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
  onClick,
  onPointerDown,
}: {
  table: AdminTable;
  cx: number;
  cy: number;
  selected: boolean;
  edit: boolean;
  onClick: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const busy = table.orders.length > 0;
  const call = table.calls.length > 0;

  const stroke = call ? '#FF6B2C' : busy ? 'rgba(52,211,153,0.9)' : 'rgba(245,243,238,0.35)';
  const fill = call ? 'rgba(255,107,44,0.18)' : busy ? 'rgba(52,211,153,0.12)' : '#141419';
  const chairFill = 'rgba(245,243,238,0.28)';

  /* body size by shape */
  const size: { r: number } | { w: number; h: number } =
    table.shape === 'rect'
      ? { w: 15, h: 8 }
      : table.shape === 'round'
        ? { r: 4.2 }
        : { w: 8.5, h: 8.5 };
  const halfW = 'r' in size ? size.r : size.w / 2;
  const halfH = 'r' in size ? size.r : size.h / 2;

  /* chair ticks around the body */
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
    const hw = 15 / 2;
    const hh = 8 / 2;
    [-4.2, 0, 4.2].forEach((dx) => {
      chairs.push(
        { x: cx + dx - 1.4, y: cy - hh - 1.9, w: 2.8, h: 1.2 },
        { x: cx + dx - 1.4, y: cy + hh + 0.7, w: 2.8, h: 1.2 }
      );
    });
    void hw;
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
        <text x={cx} y={cy + 2.9} textAnchor="middle" fontSize={1.8} fill="rgba(245,243,238,0.65)">
          {money(table.orders.reduce((s, o) => s + Number(o.total), 0))}
        </text>
      )}
      {call && <circle cx={cx + halfW - 0.3} cy={cy - halfH + 0.3} r={1.3} fill="#FF6B2C" />}
    </g>
  );
}
