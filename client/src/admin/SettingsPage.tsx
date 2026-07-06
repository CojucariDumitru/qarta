import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Settings } from '../types';

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<Settings>('/admin/settings')).data,
  });

  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () =>
      api.patch('/admin/settings', {
        name: form!.name,
        tagline: form!.tagline,
        aycePrice: Number(form!.aycePrice),
        roundLimit: Number(form!.roundLimit),
        timeLimitMin: Number(form!.timeLimitMin),
        guestCanOpen: form!.guestCanOpen,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['config'] });
    },
  });

  if (!form) return null;

  return (
    <div className="max-w-md">
      <h1 className="display text-2xl font-extrabold mb-6">Settings</h1>

      <div className="space-y-3">
        <Field label="Restaurant name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Tagline" value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} />
        <Field
          label="AYCE price per person, $"
          value={String(form.aycePrice)}
          onChange={(v) => setForm({ ...form, aycePrice: v as unknown as number })}
        />
        <Field
          label="AYCE items per person per round"
          value={String(form.roundLimit)}
          onChange={(v) => setForm({ ...form, roundLimit: v as unknown as number })}
        />
        <Field
          label="Seating time limit, minutes"
          value={String(form.timeLimitMin)}
          onChange={(v) => setForm({ ...form, timeLimitMin: v as unknown as number })}
        />
        <label className="flex items-center justify-between text-sm py-2 border-b hairline">
          <span>
            Guests can start a seating themselves
            <span className="block text-xs text-muted mt-0.5">
              Off = staff opens tables from the Floor map (recommended in production)
            </span>
          </span>
          <input
            type="checkbox"
            checked={form.guestCanOpen}
            onChange={(e) => setForm({ ...form, guestCanOpen: e.target.checked })}
            className="accent-[#FF6B2C] w-4 h-4"
          />
        </label>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-5 bg-flame text-ink font-bold rounded-2xl px-6 py-3.5 disabled:opacity-50"
      >
        {save.isPending ? 'Saving…' : 'Save'}
      </button>
      {save.isSuccess && <p className="text-emerald-300 text-sm mt-2">Saved — guests see it immediately.</p>}
      {save.isError && <p className="text-red-400 text-sm mt-2">Check the values and try again.</p>}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-paper rounded-xl px-4 py-3 border hairline outline-none text-cream text-sm focus:border-flame/50"
      />
    </label>
  );
}
