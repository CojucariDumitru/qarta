import { useCallback, useSyncExternalStore } from 'react';
import { api } from '../api';
import type { GuestCard } from '../types';

/** Guest identity shared across all components and persisted in localStorage. */
let current: GuestCard | null = (() => {
  const raw = localStorage.getItem('qarta_guest');
  return raw ? JSON.parse(raw) : null;
})();

const listeners = new Set<() => void>();

function set(g: GuestCard | null) {
  current = g;
  if (g) localStorage.setItem('qarta_guest', JSON.stringify({ ...g, transactions: undefined }));
  else localStorage.removeItem('qarta_guest');
  listeners.forEach((l) => l());
}

export function useGuest() {
  const guest = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current
  );

  const identify = useCallback(async (phone: string, name?: string) => {
    const { data } = await api.post<GuestCard>('/guests/identify', { phone, name });
    set(data);
    return data;
  }, []);

  const refresh = useCallback(async () => {
    if (!current) return null;
    const { data } = await api.get<GuestCard>(`/loyalty/${current.guestId}`);
    set(data);
    return data;
  }, []);

  const logout = useCallback(() => set(null), []);

  return { guest, identify, refresh, logout };
}
