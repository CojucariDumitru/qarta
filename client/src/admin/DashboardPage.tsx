import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { money, type Stats } from '../types';

export default function DashboardPage() {
  const { data } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => (await api.get<Stats>('/admin/stats')).data,
    refetchInterval: 15000,
  });

  const max = Math.max(1, ...(data?.series.map((s) => s.revenue) ?? [1]));

  return (
    <div>
      <h1 className="display text-2xl font-extrabold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Revenue today" value={money(data?.todayRevenue ?? 0)} accent />
        <Kpi label="Covers today" value={String(data?.covers ?? 0)} />
        <Kpi label="Avg per cover" value={money(data?.avgPerCover ?? 0)} />
        <Kpi label="Open tables now" value={String(data?.openNow ?? 0)} />
      </div>

      <div className="grid lg:grid-cols-5 gap-3 mt-3">
        <div className="lg:col-span-3 rounded-2xl border hairline p-5">
          <p className="text-sm text-muted mb-4">Revenue, last 7 days</p>
          <div className="flex items-end gap-2 h-40">
            {data?.series.map((s) => (
              <div key={s.date} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-muted">{s.revenue ? `$${Math.round(s.revenue)}` : ''}</span>
                <div
                  className="w-full rounded-t-md bg-flame/80 min-h-[2px]"
                  style={{ height: `${(s.revenue / max) * 100}%` }}
                />
                <span className="text-[10px] text-muted">{s.date.slice(5).replace('-', '/')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border hairline p-5">
          <p className="text-sm text-muted mb-4">Most ordered</p>
          <div className="space-y-3">
            {data?.topDishes.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3 text-sm">
                <span className="display text-flame font-bold w-5">{i + 1}</span>
                <span className="flex-1 truncate">{d.name}</span>
                <span className="text-muted">×{d.qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border hairline p-5 ${accent ? 'bg-flame text-ink border-flame' : ''}`}>
      <p className={`text-xs ${accent ? 'opacity-70 font-semibold' : 'text-muted'}`}>{label}</p>
      <p className="display text-2xl font-extrabold mt-1">{value}</p>
    </div>
  );
}
