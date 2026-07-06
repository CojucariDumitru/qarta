export interface Config {
  name: string;
  tagline: string;
  aycePrice: number;
  roundLimit: number;
  timeLimitMin: number;
  guestCanOpen: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  ayce: boolean;
  price: string;
  image: string;
  available: boolean;
  popular: boolean;
  spicy: boolean;
  categoryId: string;
}

export interface Category {
  id: string;
  name: string;
  sort: number;
  items: MenuItem[];
}

export interface TableInfo {
  id: string;
  number: number;
  zone: string;
  session: { id: string; guests: number; openedAt: string } | null;
}

export type RoundStatus = 'NEW' | 'DONE' | 'CANCELLED';

export interface RoundItem {
  id: string;
  name: string;
  ayce: boolean;
  price: string;
  qty: number;
  delivered: boolean;
}

export interface Round {
  id: string;
  number: number;
  status: RoundStatus;
  extrasTotal: string;
  comment?: string | null;
  createdAt: string;
  items: RoundItem[];
}

export interface SessionDetail {
  id: string;
  status: 'OPEN' | 'CLOSED';
  guests: number;
  openedAt: string;
  closedAt?: string | null;
  table: { number: number; zone: string; code: string };
  loyaltyGuest: { id: string; name: string | null; phone: string } | null;
  orders: Round[];
  bill: {
    aycePrice: number;
    ayceTotal: number;
    extras: number;
    discount: number;
    total: number;
  };
  roundLimit: number;
}

export interface GuestCard {
  guestId: string;
  phone: string;
  name: string | null;
  points: number;
  totalSpent: number;
  tier: { name: string; label: string; rate: number };
  nextTier: { label: string; rate: number; remaining: number } | null;
  transactions?: LoyaltyTx[];
}

export interface LoyaltyTx {
  id: string;
  type: 'EARN' | 'REDEEM';
  points: number;
  createdAt: string;
}

export interface AdminTable {
  id: string;
  number: number;
  code: string;
  seats: number;
  zone: string;
  posX: number;
  posY: number;
  shape: 'round' | 'square' | 'rect';
  calls: { id: string; kind: 'WAITER' | 'BILL'; createdAt: string }[];
  session: { id: string; guests: number; openedAt: string; pendingItems: number } | null;
}

export interface AdminRound extends Round {
  session: {
    id: string;
    guests: number;
    table: { number: number; zone: string };
    guest: { name: string | null } | null;
  };
}

export interface CrmGuest {
  id: string;
  phone: string;
  name: string | null;
  visits: number;
  points: number;
  totalSpent: number;
  tier: string;
  createdAt: string;
}

export interface Stats {
  todayRevenue: number;
  todaySessions: number;
  covers: number;
  avgPerCover: number;
  openNow: number;
  topDishes: { name: string; qty: number }[];
  series: { date: string; revenue: number }[];
}

export interface Settings {
  name: string;
  tagline: string;
  aycePrice: number;
  roundLimit: number;
  timeLimitMin: number;
  guestCanOpen: boolean;
}

/** Whole minutes since an ISO timestamp. */
export const minutesSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);

export const money = (v: number | string) => `$${Number(v).toFixed(2)}`;
export const pts = (p: number) => `${(p / 100).toFixed(2)}`;
