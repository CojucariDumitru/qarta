import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api } from '../api';
import { money, type AdminRound } from '../types';

const BADGE: Record<string, string> = {
  NEW: 'bg-flame text-ink',
  DONE: 'bg-emerald-600 text-ink',
  CANCELLED: 'bg-red-500/20 text-red-300',
};
const LABEL: Record<string, string> = { NEW: 'In kitchen', DONE: 'Done', CANCELLED: 'Cancelled' };

export default function OrdersPage() {
  const [showAll, setShowAll] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['admin-orders', showAll],
    queryFn: async () => (await api.get<AdminRound[]>(`/admin/orders${showAll ? '?all=1' : ''}`)).data,
    refetchInterval: 5000,
  });
  // undelivered rounds first, then completed ones (still visible while the table is seated)
  const rounds = data
    ? [...data].sort((a, b) =>
        a.status === b.status ? 0 : a.status === 'NEW' ? -1 : b.status === 'NEW' ? 1 : 0
      )
    : undefined;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
    qc.invalidateQueries({ queryKey: ['admin-tables'] });
  };

  const markItem = useMutation({
    mutationFn: async ({ id, delivered }: { id: string; delivered: boolean }) =>
      api.patch(`/admin/order-items/${id}/delivered`, { delivered }),
    onSuccess: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/orders/${id}/status`, { status }),
    onSuccess: invalidate,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="display text-2xl font-extrabold">Rounds</h1>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-sm text-muted border hairline rounded-full px-4 py-1.5"
        >
          {showAll ? 'Active only' : 'Full history'}
        </button>
      </div>

      {rounds?.length === 0 && <p className="text-muted">No seated tables right now — the kitchen breathes.</p>}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {rounds?.map((o) => (
          <div
            key={o.id}
            className={`rounded-2xl border hairline p-4 flex flex-col ${o.status === 'DONE' ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center justify-between">
              <p className="font-bold">
                #{o.number} · Table {o.session.table.number}
              </p>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${BADGE[o.status]}`}>
                {LABEL[o.status]}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {new Date(o.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              {' · '}
              {o.session.guests}p{o.session.guest?.name ? ` · ${o.session.guest.name}` : ''}
            </p>

            <div className="mt-3 space-y-1.5 text-sm flex-1">
              {o.items.map((i) => (
                <button
                  key={i.id}
                  onClick={() => markItem.mutate({ id: i.id, delivered: !i.delivered })}
                  disabled={o.status === 'CANCELLED'}
                  className="w-full flex items-center gap-2.5 text-left group"
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

            {o.status === 'NEW' && (
              <div className="flex gap-2 mt-3 pt-3 border-t hairline">
                <button
                  onClick={() => setStatus.mutate({ id: o.id, status: 'CANCELLED' })}
                  className="text-xs text-muted border hairline rounded-full px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStatus.mutate({ id: o.id, status: 'DONE' })}
                  className="text-xs font-bold bg-flame text-ink rounded-full px-3 py-1.5 ml-auto"
                >
                  Mark all delivered
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
