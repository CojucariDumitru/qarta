import { useEffect, useRef } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutGrid,
  ListOrdered,
  LogOut,
  Settings,
  UtensilsCrossed,
  Users,
  BarChart3,
} from 'lucide-react';
import { api } from '../api';
import type { AdminRound } from '../types';

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: BarChart3 },
  { to: '/admin/orders', label: 'Rounds', icon: ListOrdered, badge: true },
  { to: '/admin/tables', label: 'Floor', icon: LayoutGrid },
  { to: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/admin/guests', label: 'Guests', icon: Users },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

/** Two-tone chime for a fresh round (works after any user interaction with the page). */
function chime() {
  try {
    const ctx = new AudioContext();
    const note = (t: number, f: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.07, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    };
    note(0, 880);
    note(0.18, 1318);
  } catch {
    /* no audio available */
  }
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const authed = !!localStorage.getItem('qarta_token');

  // watch active rounds on every staff page: badge + chime on new
  const { data: active } = useQuery({
    queryKey: ['admin-orders-watch'],
    queryFn: async () => (await api.get<AdminRound[]>('/admin/orders')).data,
    refetchInterval: 6000,
    enabled: authed,
  });
  const newCount = active?.filter((o) => o.status === 'NEW').length ?? 0;

  const prev = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!active) return;
    const ids = new Set(active.filter((o) => o.status === 'NEW').map((o) => o.id));
    if (prev.current && [...ids].some((id) => !prev.current!.has(id))) chime();
    prev.current = ids;
  }, [active]);

  useEffect(() => {
    document.title = newCount > 0 ? `(${newCount}) Rounds — QARTA` : 'QARTA — staff';
    return () => {
      document.title = 'QARTA — QR menu & ordering for AYCE restaurants';
    };
  }, [newCount]);

  if (!authed) return <Navigate to="/admin/login" replace />;

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r hairline md:min-h-screen p-4 md:p-5 flex md:flex-col gap-1 items-center md:items-stretch overflow-x-auto">
        <p className="display font-extrabold text-lg text-flame mr-4 md:mr-0 md:mb-6">QARTA</p>
        {NAV.map(({ to, end, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm whitespace-nowrap ${
                isActive ? 'bg-flame text-ink font-bold' : 'text-muted hover:text-cream'
              }`
            }
          >
            <Icon size={16} /> {label}
            {badge && newCount > 0 && (
              <span className="ml-auto bg-flame text-ink text-[10px] font-bold rounded-full min-w-[18px] h-[18px] grid place-items-center px-1">
                {newCount}
              </span>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => {
            localStorage.removeItem('qarta_token');
            navigate('/admin/login');
          }}
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-cream md:mt-auto"
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      <main className="flex-1 p-5 md:p-8 max-w-6xl">
        <Outlet />
      </main>
    </div>
  );
}
