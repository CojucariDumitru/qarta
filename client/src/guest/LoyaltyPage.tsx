import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, LogOut, Star, TrendingUp } from 'lucide-react';
import { api } from '../api';
import { useGuest } from './useGuest';
import { pts, type GuestCard } from '../types';

export default function LoyaltyPage() {
  const { guest, logout } = useGuest();
  const navigate = useNavigate();
  const [card, setCard] = useState<GuestCard | null>(null);

  useEffect(() => {
    if (!guest) return;
    api.get<GuestCard>(`/loyalty/${guest.guestId}`).then((r) => setCard(r.data));
  }, [guest?.guestId]);

  if (!guest)
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <p className="display text-2xl mb-2">Карта не найдена</p>
          <p className="text-muted mb-4">Отсканируйте QR на столе и войдите по номеру телефона.</p>
          <Link to="/m/t1" className="text-flame font-semibold">Открыть демо-меню →</Link>
        </div>
      </div>
    );

  const c = card ?? guest;
  const progress = c.nextTier
    ? Math.min(1, c.totalSpent / (c.totalSpent + c.nextTier.remaining))
    : 1;

  return (
    <div className="min-h-screen max-w-lg mx-auto px-5 pt-6 pb-16">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft size={20} /></button>
        <button onClick={() => { logout(); navigate('/'); }} className="p-2 -mr-2 text-muted"><LogOut size={18} /></button>
      </div>

      {/* the card */}
      <div className="mt-4 rounded-3xl bg-gradient-to-br from-flame to-[#B33A0E] p-6 text-ink relative overflow-hidden">
        <p className="text-[11px] tracking-[0.25em] font-bold opacity-70">QARTA LOYALTY · {c.tier.label.toUpperCase()}</p>
        <p className="display text-4xl font-extrabold mt-3">${pts(c.points)}</p>
        <p className="text-sm font-semibold opacity-70">баллов на карте</p>
        <div className="flex items-end justify-between mt-6">
          <div>
            <p className="font-bold">{c.name ?? 'Гость'}</p>
            <p className="text-sm opacity-70">{c.phone}</p>
          </div>
          <div className="bg-white rounded-xl p-2">
            <QRCodeSVG value={`qarta:guest:${c.guestId}`} size={64} />
          </div>
        </div>
      </div>

      {/* tier progress */}
      <div className="mt-5 rounded-2xl border hairline p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-semibold">
            <TrendingUp size={15} className="text-flame" /> Кэшбэк {Math.round(c.tier.rate * 100)}%
          </span>
          {c.nextTier && (
            <span className="text-muted text-xs">
              до {c.nextTier.label} ({Math.round(c.nextTier.rate * 100)}%) — ещё ${c.nextTier.remaining.toFixed(0)}
            </span>
          )}
        </div>
        <div className="h-1.5 bg-ink rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-flame rounded-full" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-xs text-muted mt-2">Всего потрачено: ${c.totalSpent.toFixed(2)}</p>
      </div>

      {/* history */}
      <h2 className="display text-lg font-semibold mt-7 mb-3">История</h2>
      <div className="space-y-2">
        {card?.transactions?.length ? (
          card.transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b hairline pb-2 text-sm">
              <span className="flex items-center gap-2">
                <Star size={13} className={t.type === 'EARN' ? 'text-flame fill-flame' : 'text-muted'} />
                {t.type === 'EARN' ? 'Начисление' : 'Списание'}
              </span>
              <span className={t.type === 'EARN' ? 'text-flame font-semibold' : 'text-muted'}>
                {t.points > 0 ? '+' : '−'}${pts(Math.abs(t.points))}
              </span>
            </div>
          ))
        ) : (
          <p className="text-muted text-sm">Пока нет операций — сделайте первый заказ.</p>
        )}
      </div>
    </div>
  );
}
