import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { money, type Category, type MenuItem } from '../types';

type Draft = Partial<MenuItem> & { price?: string };

export default function MenuAdminPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Draft | null>(null);

  const { data: categories } = useQuery({
    queryKey: ['admin-menu'],
    queryFn: async () => (await api.get<Category[]>('/admin/menu')).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-menu'] });
    qc.invalidateQueries({ queryKey: ['menu'] });
  };

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        name: d.name,
        description: d.description ?? '',
        price: Number(d.price),
        image: d.image,
        categoryId: d.categoryId,
        available: d.available ?? true,
        popular: d.popular ?? false,
        spicy: d.spicy ?? false,
      };
      return d.id ? api.patch(`/admin/menu/${d.id}`, payload) : api.post('/admin/menu', payload);
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/menu/${id}`),
    onSuccess: invalidate,
  });

  const toggle = useMutation({
    mutationFn: async (i: MenuItem) => api.patch(`/admin/menu/${i.id}`, { available: !i.available }),
    onSuccess: invalidate,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="display text-2xl font-extrabold">Меню</h1>
        <button
          onClick={() => setEditing({ categoryId: categories?.[0]?.id })}
          className="bg-flame text-ink font-bold rounded-full px-4 py-2 text-sm flex items-center gap-1.5"
        >
          <Plus size={15} /> Блюдо
        </button>
      </div>

      {categories?.map((c) => (
        <div key={c.id} className="mb-7">
          <p className="text-sm text-muted mb-2">{c.name}</p>
          <div className="divide-y divide-[rgba(245,243,238,0.09)] border-y hairline">
            {c.items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-2.5">
                <img src={i.image} className="w-10 h-10 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${i.available ? '' : 'line-through text-muted'}`}>
                    {i.name}
                  </p>
                  <p className="text-xs text-muted">{money(i.price)}</p>
                </div>
                <button
                  onClick={() => toggle.mutate(i)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border ${
                    i.available ? 'border-emerald-500/40 text-emerald-300' : 'hairline text-muted'
                  }`}
                >
                  {i.available ? 'в продаже' : 'скрыто'}
                </button>
                <button onClick={() => setEditing({ ...i })} className="text-muted hover:text-cream p-1">
                  <Pencil size={15} />
                </button>
                <button onClick={() => remove.mutate(i.id)} className="text-muted hover:text-red-400 p-1">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* editor modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/70 z-50 grid place-items-center p-5 overflow-y-auto">
          <div className="bg-paper rounded-3xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="display font-bold text-lg">{editing.id ? 'Изменить блюдо' : 'Новое блюдо'}</h3>
              <button onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <div className="space-y-2">
              <Field label="Название" value={editing.name ?? ''} onChange={(v) => setEditing({ ...editing, name: v })} />
              <Field label="Описание" value={editing.description ?? ''} onChange={(v) => setEditing({ ...editing, description: v })} />
              <Field label="Цена, $" value={String(editing.price ?? '')} onChange={(v) => setEditing({ ...editing, price: v })} />
              <Field label="URL фото" value={editing.image ?? ''} onChange={(v) => setEditing({ ...editing, image: v })} />
              <label className="block text-xs text-muted">
                Категория
                <select
                  value={editing.categoryId}
                  onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                  className="w-full mt-1 bg-ink rounded-xl px-3 py-2.5 border hairline outline-none text-cream text-sm"
                >
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <div className="flex gap-4 pt-1 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={editing.popular ?? false} onChange={(e) => setEditing({ ...editing, popular: e.target.checked })} className="accent-[#FF6B2C]" />
                  Хит
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={editing.spicy ?? false} onChange={(e) => setEditing({ ...editing, spicy: e.target.checked })} className="accent-[#FF6B2C]" />
                  Острое
                </label>
              </div>
            </div>
            <button
              onClick={() => save.mutate(editing)}
              disabled={save.isPending || !editing.name || !editing.price || !editing.image}
              className="w-full mt-5 bg-flame text-ink font-bold rounded-2xl py-3.5 disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </div>
      )}
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
        className="w-full mt-1 bg-ink rounded-xl px-3 py-2.5 border hairline outline-none text-cream text-sm"
      />
    </label>
  );
}
