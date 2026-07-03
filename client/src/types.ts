export interface MenuItem {
  id: string;
  name: string;
  description: string;
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

export type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'SERVED' | 'PAID' | 'CANCELLED';

export interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  total: string;
  comment?: string | null;
  createdAt: string;
  earned?: number;
  items: { id: string; name: string; price: string; qty: number }[];
  table?: { number: number; zone?: string };
  guest?: { name: string | null; phone: string } | null;
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
  orders: {
    id: string;
    number: number;
    status: OrderStatus;
    total: string;
    createdAt: string;
    comment?: string | null;
    items: { id: string; name: string; qty: number }[];
  }[];
  calls: { id: string; createdAt: string }[];
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
  todayOrders: number;
  avgCheck: number;
  guests: number;
  topDishes: { name: string; qty: number }[];
  series: { date: string; revenue: number }[];
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: 'Новый',
  ACCEPTED: 'Принят',
  PREPARING: 'Готовится',
  SERVED: 'Подан',
  PAID: 'Оплачен',
  CANCELLED: 'Отменён',
};

export const money = (v: number | string) => `$${Number(v).toFixed(2)}`;
export const pts = (p: number) => `${(p / 100).toFixed(2)}`;
