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
import type { AdminRound, AdminTable } from '../types';

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: BarChart3 },
  { to: '/admin/orders', label: 'Rounds', icon: ListOrdered, badge: 'rounds' as const },
  { to: '/admin/tables', label: 'Floor', icon: LayoutGrid, badge: 'calls' as const },
  { to: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/admin/guests', label: 'Guests', icon: Users },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

function playNotes(notes: [number, number][]) {
  try {
    const ctx = new AudioContext();
    for (const [t, f] of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.07, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    }
  } catch {
    /* no audio available */
  }
}

/** Two-tone chime for a fresh round (works after any user interaction with the page). */
const chime = () => playNotes([[0, 880], [0.18, 1318]]);
/** Urgent triple tone for a waiter/bill call. */
const callChime = () => playNotes([[0, 1046], [0.15, 1046], [0.3, 1568]]);

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

  // waiter/bill calls: urgent chime + badge on the Floor tab
  const { data: tables } = useQuery({
    queryKey: ['admin-tables-watch'],
    queryFn: async () => (await api.get<AdminTable[]>('/admin/tables')).data,
    refetchInterval: 6000,
    enabled: authed,
  });
  const callCount = tables?.reduce((n, t) => n + t.calls.length, 0) ?? 0;

  const prevCalls = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!tables) return;
    const ids = new Set(tables.flatMap((t) => t.calls.map((c) => c.id)));
    if (prevCalls.current && [...ids].some((id) => !prevCalls.current!.has(id))) callChime();
    prevCalls.current = ids;
  }, [tables]);

  const badgeCount = (kind?: 'rounds' | 'calls') =>
    kind === 'rounds' ? newCount : kind === 'calls' ? callCount : 0;

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
            {badge && badgeCount(badge) > 0 && (
              <span className="ml-auto bg-flame text-ink text-[10px] font-bold rounded-full min-w-[18px] h-[18px] grid place-items-center px-1">
                {badgeCount(badge)}
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
