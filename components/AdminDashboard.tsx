'use client';
import { useEffect, useState, useCallback } from 'react';

type PurchaseRequest = {
  id: string;
  user_id: string;
  pack_id: string;
  credits: number;
  price_fcfa: number;
  payment_method: string;
  payment_reference: string | null;
  status: string;
  created_at: string;
  user?: { email: string };
};

type Stats = {
  totalUsers: number;
  totalGenerations: number;
  pendingRequests: number;
  totalRevenueFcfa: number;
};

export default function AdminDashboard() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqRes, statsRes] = await Promise.all([
      fetch('/api/admin/purchase-requests'),
      fetch('/api/admin/stats'),
    ]);
    if (reqRes.ok) setRequests(await reqRes.json());
    if (statsRes.ok) setStats(await statsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActingId(id);
    const res = await fetch(`/api/admin/purchase-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setActingId(null);
    if (res.ok) load();
    else alert('Erreur lors du traitement de la demande.');
  };

  const pending = requests.filter(r => r.status === 'pending');
  const processed = requests.filter(r => r.status !== 'pending');

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Dashboard Admin — Melotones</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="card text-center"><p className="text-3xl font-bold text-brand-600">{stats.totalUsers}</p><p className="text-sm text-gray-500">Utilisateurs</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-brand-600">{stats.totalGenerations}</p><p className="text-sm text-gray-500">Chansons générées</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-orange-500">{stats.pendingRequests}</p><p className="text-sm text-gray-500">Demandes en attente</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-green-600">{stats.totalRevenueFcfa.toLocaleString('fr-FR')} FCFA</p><p className="text-sm text-gray-500">Revenus validés</p></div>
        </div>
      )}

      <h2 className="text-xl font-bold mb-4 text-gray-800">Demandes en attente ({pending.length})</h2>
      {loading ? (
        <p className="text-gray-500">Chargement…</p>
      ) : pending.length === 0 ? (
        <p className="text-gray-500 mb-10">Aucune demande en attente.</p>
      ) : (
        <div className="space-y-3 mb-10">
          {pending.map(r => (
            <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-800">{r.user?.email || r.user_id}</p>
                <p className="text-sm text-gray-600">{r.credits} notes · {r.price_fcfa.toLocaleString('fr-FR')} FCFA · {r.payment_method}</p>
                {r.payment_reference && <p className="text-xs text-gray-400">Réf : {r.payment_reference}</p>}
                <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="flex gap-2">
                <button disabled={actingId === r.id} onClick={() => handleAction(r.id, 'approve')} className="btn-primary text-sm">Approuver</button>
                <button disabled={actingId === r.id} onClick={() => handleAction(r.id, 'reject')} className="btn-secondary text-sm">Rejeter</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-xl font-bold mb-4 text-gray-800">Historique</h2>
      <div className="space-y-2">
        {processed.map(r => (
          <div key={r.id} className="flex items-center justify-between text-sm text-gray-600 border-b border-gray-100 py-2">
            <span>{r.user?.email || r.user_id} — {r.credits} notes — {r.price_fcfa.toLocaleString('fr-FR')} FCFA</span>
            <span className={r.status === 'approved' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
              {r.status === 'approved' ? 'Approuvée' : 'Rejetée'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
