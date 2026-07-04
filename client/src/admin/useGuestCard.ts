import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { GuestCard } from '../types';

/** Loyalty card of the guest attached to a seating (for redeem-at-close). */
export function useGuestCardQuery(guestId?: string) {
  return useQuery({
    queryKey: ['guest-card', guestId],
    queryFn: async () => (await api.get<GuestCard>(`/loyalty/${guestId}`)).data,
    enabled: !!guestId,
  });
}
