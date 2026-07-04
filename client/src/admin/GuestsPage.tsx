import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { pts, type CrmGuest } from '../types';

const TIER_COLOR: Record<string, string> = {
  Bronze: 'text-amber-600',
  Silver: 'text-slate-300',
  Gold: 'text-yellow-400',
};

export default function GuestsPage() {
  const { data: guests } = useQuery({
    queryKey: ['admin-guests'],
    queryFn: async () => (await api.get<CrmGuest[]>('/admin/guests')).data,
  });

  return (
    <div>
      <h1 className="display text-2xl font-extrabold mb-6">Guests · CRM</h1>

      <div className="overflow-x-auto border-y hairline">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted text-xs">
              <th className="py-3 pr-4 font-medium">Guest</th>
              <th className="py-3 pr-4 font-medium">Phone</th>
              <th className="py-3 pr-4 font-medium">Visits</th>
              <th className="py-3 pr-4 font-medium">Spent</th>
              <th className="py-3 pr-4 font-medium">Points</th>
              <th className="py-3 font-medium">Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(245,243,238,0.09)]">
            {guests?.map((g) => (
              <tr key={g.id}>
                <td className="py-3 pr-4 font-semibold">{g.name ?? 'Guest'}</td>
                <td className="py-3 pr-4 text-muted">{g.phone}</td>
                <td className="py-3 pr-4">{g.visits}</td>
                <td className="py-3 pr-4">${g.totalSpent.toFixed(2)}</td>
                <td className="py-3 pr-4 text-flame font-semibold">${pts(g.points)}</td>
                <td className={`py-3 font-bold ${TIER_COLOR[g.tier] ?? ''}`}>{g.tier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {guests?.length === 0 && <p className="text-muted mt-4">No guests yet.</p>}
    </div>
  );
}
