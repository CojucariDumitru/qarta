import { Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';
import type { AdminTable, Config } from '../types';

/** Standalone A4-printable sheet of table QR codes (no sidebar chrome). */
export default function QrPrintPage() {
  if (!localStorage.getItem('qarta_token')) return <Navigate to="/admin/login" replace />;

  const { data: tables } = useQuery({
    queryKey: ['admin-tables'],
    queryFn: async () => (await api.get<AdminTable[]>('/admin/tables')).data,
  });
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: async () => (await api.get<Config>('/config')).data,
  });

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .qr-grid { gap: 0 !important; }
          .qr-card { break-inside: avoid; border-style: dashed !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 bg-white border-b border-black/10 px-6 py-4 flex items-center justify-between">
        <Link to="/admin/tables" className="flex items-center gap-2 text-sm text-black/60 hover:text-black">
          <ArrowLeft size={16} /> Back to floor map
        </Link>
        <p className="text-sm text-black/60">Cut along the dashed lines · one card per table</p>
        <button
          onClick={() => window.print()}
          className="bg-black text-white font-bold rounded-full px-5 py-2.5 text-sm flex items-center gap-2"
        >
          <Printer size={15} /> Print
        </button>
      </div>

      <div className="qr-grid max-w-3xl mx-auto grid grid-cols-2 gap-4 p-6">
        {tables?.map((t) => (
          <div key={t.id} className="qr-card border border-black/20 rounded-2xl p-6 text-center">
            <p className="text-[10px] tracking-[0.3em] font-bold text-black/50">
              {(config?.name ?? 'QARTA').toUpperCase()}
            </p>
            <p className="text-3xl font-extrabold mt-1" style={{ fontFamily: 'Unbounded, sans-serif' }}>
              Table {t.number}
            </p>
            <p className="text-xs text-black/50 mb-4">{t.zone}</p>
            <div className="inline-block p-3 border border-black/10 rounded-xl">
              <QRCodeSVG value={`${location.origin}/m/${t.code}`} size={148} />
            </div>
            <p className="text-sm font-semibold mt-4">Scan to see the menu & order</p>
            <p className="text-[10px] text-black/40 mt-1">
              {location.origin}/m/{t.code}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
