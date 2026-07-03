import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { money, STATUS_LABEL, type Order, type OrderStatus } from '../types';

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  NEW: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'SERVED',
  SERVED: 'PAID',
};

const BADGE: Record<OrderStatus, string> = {
  NEW: 'bg-flame text-ink',
  ACCEPTED: 'bg-amber-500/20 text-amber-300',
  PREPARING: 'bg-sky-500/20 text-sky-300',
  SERVED: 'bg-emerald-500/20 text-emerald-300',
  PAID: 'bg-emerald-600 text-ink',
  CANCELLED: 'bg-red-500/20 text-red-300',
};

export default function OrdersPage() {
  const [showAll, setShowAll] = useState(false);
  const qc = useQueryClient();

  const { data: orders } = useQuery({
    queryKey: ['admin-orders', showAll],
    queryFn: async () => (await api.get<Order[]>(`/admin/orders${showAll ? '?all=1' : ''}`)).data,
    refetchInterval: 5000,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) =>
      api.patch(`/admin/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orders'] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="display text-2xl font-extrabold">Заказы</h1>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-sm text-muted border hairline rounded-full px-4 py-1.5"
        >
          {showAll ? 'Только активные' : 'Вся история'}
        </button>
      </div>

      {orders?.length === 0 && <p className="text-muted">Активных заказов нет — гости пока думают.</p>}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {orders?.map((o) => (
          <div key={o.id} className="rounded-2xl border hairline p-4 flex flex-col">
            <div className="flex items-center justify-between">
              <p className="font-bold">
                №{o.number} · Стол {o.table?.number}
              </p>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${BADGE[o.status]}`}>
                {STATUS_LABEL[o.status]}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {new Date(o.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              {o.guest && ` · ${o.guest.name ?? o.guest.phone}`}
            </p>
            <div className="mt-3 space-y-1 text-sm flex-1">
              {o.items.map((i) => (
                <div key={i.id} className="flex justify-between">
                  <span>{i.name} × {i.qty}</span>
                  <span className="text-muted">{money(Number(i.price) * i.qty)}</span>
                </div>
              ))}
            </div>
            {o.comment && <p className="text-xs text-flame mt-2">💬 {o.comment}</p>}
            <div className="flex items-center justify-between border-t hairline mt-3 pt-3">
              <p className="font-bold">{money(o.total)}</p>
              <div className="flex gap-2">
                {o.status !== 'PAID' && o.status !== 'CANCELLED' && (
                  <>
                    <button
                      onClick={() => setStatus.mutate({ id: o.id, status: 'CANCELLED' })}
                      className="text-xs text-muted border hairline rounded-full px-3 py-1.5"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={() => setStatus.mutate({ id: o.id, status: NEXT[o.status]! })}
                      className="text-xs font-bold bg-flame text-ink rounded-full px-3 py-1.5"
                    >
                      → {STATUS_LABEL[NEXT[o.status]!]}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
