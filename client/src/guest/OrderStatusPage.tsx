import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, ChefHat, HandPlatter, Receipt, Star } from 'lucide-react';
import { api } from '../api';
import { money, pts, STATUS_LABEL, type Order } from '../types';

const STEPS = [
  { key: 'NEW', label: 'Отправлен', icon: Receipt },
  { key: 'ACCEPTED', label: 'Принят', icon: Check },
  { key: 'PREPARING', label: 'Готовится', icon: ChefHat },
  { key: 'SERVED', label: 'Подан', icon: HandPlatter },
] as const;

export default function OrderStatusPage() {
  const { tableCode = '', orderId = '' } = useParams();
  const { state } = useLocation() as { state?: { earned?: number } };

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => (await api.get<Order>(`/orders/${orderId}`)).data,
    refetchInterval: 5000,
  });

  const stepIndex = order ? STEPS.findIndex((s) => s.key === order.status) : 0;
  const active = stepIndex === -1 ? STEPS.length : stepIndex; // PAID/CANCELLED → all done

  return (
    <div className="min-h-screen max-w-lg mx-auto px-5 pt-8 pb-16">
      <p className="text-[11px] tracking-[0.25em] text-flame font-semibold">QARTA · ЗАКАЗ №{order?.number ?? '…'}</p>
      <h1 className="display text-3xl font-extrabold mt-1">
        {order?.status === 'CANCELLED' ? 'Заказ отменён' : STATUS_LABEL[order?.status ?? 'NEW']}
      </h1>
      <p className="text-muted text-sm mt-1">Стол {order?.table?.number} · GRINDHOUSE</p>

      {!!state?.earned && state.earned > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 rounded-2xl bg-flame/10 border border-flame/30 p-4 flex items-center gap-3"
        >
          <Star className="text-flame fill-flame shrink-0" size={20} />
          <div>
            <p className="font-bold text-flame">+${pts(state.earned)} баллами</p>
            <p className="text-xs text-muted">Кэшбэк начислен на вашу карту лояльности</p>
          </div>
        </motion.div>
      )}

      {/* progress steps */}
      {order?.status !== 'CANCELLED' && (
        <div className="mt-8 space-y-0">
          {STEPS.map((s, i) => {
            const done = i <= active;
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full grid place-items-center border ${
                      done ? 'bg-flame text-ink border-flame' : 'border-line text-muted'
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-px h-8 ${i < active ? 'bg-flame' : 'bg-line'}`} />
                  )}
                </div>
                <p className={`pt-2.5 font-semibold ${done ? '' : 'text-muted'}`}>{s.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* receipt */}
      <div className="mt-8 rounded-2xl border hairline p-5">
        <div className="space-y-2 text-sm">
          {order?.items.map((i) => (
            <div key={i.id} className="flex justify-between">
              <span>{i.name} × {i.qty}</span>
              <span className="text-muted">{money(Number(i.price) * i.qty)}</span>
            </div>
          ))}
        </div>
        <div className="border-t hairline mt-3 pt-3 space-y-1 text-sm">
          {Number(order?.discount) > 0 && (
            <div className="flex justify-between text-flame">
              <span>Баллы</span><span>−{money(order!.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base">
            <span>Итого</span><span>{money(order?.total ?? 0)}</span>
          </div>
        </div>
      </div>

      <Link
        to={`/m/${tableCode}`}
        className="block text-center mt-6 border hairline rounded-2xl py-3.5 font-semibold active:scale-[0.99]"
      >
        Вернуться в меню
      </Link>
    </div>
  );
}
