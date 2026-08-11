'use client';
import { useEffect, useState, useCallback } from 'react';

type PurchaseRequest = {
  id: string; user_id: string; pack_id: string; credits: number; price_fcfa: number;
  payment_method: string; payment_reference: string | null; status: string; created_at: string;
};
type Stats = { totalUsers: number; totalGenerations: number; pendingRequests: number; totalRevenueFcfa: number };
type AdminUser = { id: string; email: string; created_at: string; last_sign_in_at: string | null; balance: number; is_admin: boolean; generations_count: number };
type AdminGeneration = { id: string; user_email: string; occasion: string; style: string; status: string; created_at: string };
type PricingPack = { id: string; credits: number; price_fcfa: number; label: string; active: boolean; sort_order: number };
type Coupon = { id: string; code: string; partner_id: string; discount_percent: number; quota: number | null; used_count: number; active: boolean };
type Partner = { id: string; name: string; contact_email: string | null; contact_phone: string | null; notes: string | null; active: boolean; coupons: Coupon[] };
type Ad = { id: string; advertiser_name: string; media_url: string; media_type: 'image' | 'video'; target_url: string | null; active: boolean; sort_order: number };

const TABS = ['overview', 'requests', 'users', 'generations', 'pricing', 'partners', 'ads'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Vue d'ensemble",
  requests: 'Demandes',
  users: 'Utilisateurs',
  generations: 'Chansons',
  pricing: 'Tarifs',
  partners: 'Partenaires',
  ads: 'Publicité',
};

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [generations, setGenerations] = useState<AdminGeneration[]>([]);
  const [genFilter, setGenFilter] = useState('all');
  const [pricing, setPricing] = useState<PricingPack[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newPartner, setNewPartner] = useState({ name: '', contact_email: '', contact_phone: '' });
  const [newCoupon, setNewCoupon] = useState<Record<string, { code: string; discount_percent: string; quota: string }>>({});
  const [newAd, setNewAd] = useState({ advertiser_name: '', media_url: '', media_type: 'image' as 'image' | 'video', target_url: '' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [statsRes, reqRes, usersRes, genRes, priceRes, partnersRes, adsRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/purchase-requests'),
      fetch('/api/admin/users'),
      fetch(`/api/admin/generations?status=${genFilter}`),
      fetch('/api/admin/pricing'),
      fetch('/api/admin/partners'),
      fetch('/api/admin/ads'),
    ]);
    if (statsRes.ok) setStats(await statsRes.json());
    if (reqRes.ok) setRequests(await reqRes.json());
    if (usersRes.ok) setUsers(await usersRes.json());
    if (genRes.ok) setGenerations(await genRes.json());
    if (priceRes.ok) setPricing(await priceRes.json());
    if (partnersRes.ok) setPartners(await partnersRes.json());
    if (adsRes.ok) setAds(await adsRes.json());
    setLoading(false);
  }, [genFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRequestAction = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    const res = await fetch(`/api/admin/purchase-requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur lors du traitement.');
  };

  const handleCreditAdjust = async (userId: string, delta: number) => {
    setBusyId(userId);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance_delta: delta }),
    });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur ajustement crédits.');
  };

  const handleToggleAdmin = async (userId: string, current: boolean) => {
    setBusyId(userId);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_admin: !current }),
    });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur changement statut admin.');
  };

  const handleDeleteGeneration = async (id: string) => {
    if (!confirm('Supprimer définitivement cette génération ?')) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/generations/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur suppression.');
  };

  const handlePricingUpdate = async (id: string, field: string, value: any) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/pricing/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }),
    });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur mise à jour tarif.');
  };

  const handleCreatePartner = async () => {
    if (!newPartner.name.trim()) return;
    setBusyId('new-partner');
    const res = await fetch('/api/admin/partners', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPartner),
    });
    setBusyId(null);
    if (res.ok) { setNewPartner({ name: '', contact_email: '', contact_phone: '' }); loadAll(); } else alert('Erreur création partenaire.');
  };

  const handleDeletePartner = async (id: string) => {
    if (!confirm('Supprimer ce partenaire et ses coupons ?')) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/partners/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur suppression.');
  };

  const handleCreateCoupon = async (partnerId: string) => {
    const form = newCoupon[partnerId];
    if (!form?.code || !form?.discount_percent) return;
    setBusyId('new-coupon-' + partnerId);
    const res = await fetch('/api/admin/coupons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code, partner_id: partnerId,
        discount_percent: Number(form.discount_percent),
        quota: form.quota ? Number(form.quota) : null,
      }),
    });
    setBusyId(null);
    if (res.ok) { setNewCoupon(prev => ({ ...prev, [partnerId]: { code: '', discount_percent: '', quota: '' } })); loadAll(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Erreur création coupon.'); }
  };

  const handleToggleCoupon = async (id: string, current: boolean) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/coupons/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !current }),
    });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Supprimer ce coupon ?')) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

  const handleCreateAd = async () => {
    if (!newAd.advertiser_name.trim() || !newAd.media_url.trim()) return;
    setBusyId('new-ad');
    const res = await fetch('/api/admin/ads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAd),
    });
    setBusyId(null);
    if (res.ok) { setNewAd({ advertiser_name: '', media_url: '', media_type: 'image', target_url: '' }); loadAll(); }
    else alert('Erreur création publicité.');
  };

  const handleToggleAd = async (id: string, current: boolean) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/ads/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !current }),
    });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

  const handleDeleteAd = async (id: string) => {
    if (!confirm('Supprimer cette publicité ?')) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/ads/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

  const pending = requests.filter(r => r.status === 'pending');
  const processed = requests.filter(r => r.status !== 'pending');

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Dashboard Admin — Melotones</h1>

      <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-200 pb-2">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {TAB_LABELS[t]}
            {t === 'requests' && pending.length > 0 ? ` (${pending.length})` : ''}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 mb-6">Chargement…</p>}

      {tab === 'overview' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center"><p className="text-3xl font-bold text-brand-600">{stats.totalUsers}</p><p className="text-sm text-gray-500">Utilisateurs</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-brand-600">{stats.totalGenerations}</p><p className="text-sm text-gray-500">Chansons générées</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-orange-500">{stats.pendingRequests}</p><p className="text-sm text-gray-500">Demandes en attente</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-green-600">{stats.totalRevenueFcfa.toLocaleString('fr-FR')} FCFA</p><p className="text-sm text-gray-500">Revenus validés</p></div>
        </div>
      )}

      {tab === 'requests' && (
        <div>
          <h2 className="text-lg font-bold mb-4 text-gray-800">En attente ({pending.length})</h2>
          {pending.length === 0 ? <p className="text-gray-500 mb-8">Aucune demande en attente.</p> : (
            <div className="space-y-3 mb-8">
              {pending.map(r => (
                <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{r.user_id}</p>
                    <p className="text-sm text-gray-600">{r.credits} notes · {r.price_fcfa.toLocaleString('fr-FR')} FCFA · {r.payment_method}</p>
                    <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busyId === r.id} onClick={() => handleRequestAction(r.id, 'approve')} className="btn-primary text-sm">Approuver</button>
                    <button disabled={busyId === r.id} onClick={() => handleRequestAction(r.id, 'reject')} className="btn-secondary text-sm">Rejeter</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <h2 className="text-lg font-bold mb-4 text-gray-800">Historique</h2>
          <div className="space-y-2">
            {processed.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm text-gray-600 border-b border-gray-100 py-2">
                <span>{r.user_id} — {r.credits} notes — {r.price_fcfa.toLocaleString('fr-FR')} FCFA</span>
                <span className={r.status === 'approved' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                  {r.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Crédits</th>
                <th className="py-2 pr-4">Chansons</th>
                <th className="py-2 pr-4">Admin</th>
                <th className="py-2 pr-4">Inscrit le</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4 font-semibold">{u.balance}</td>
                  <td className="py-2 pr-4">{u.generations_count}</td>
                  <td className="py-2 pr-4">
                    <button disabled={busyId === u.id} onClick={() => handleToggleAdmin(u.id, u.is_admin)} className={`text-xs px-2 py-1 rounded-full ${u.is_admin ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_admin ? 'Admin' : 'Utilisateur'}
                    </button>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="py-2 pr-4 flex gap-1">
                    <button disabled={busyId === u.id} onClick={() => handleCreditAdjust(u.id, 1)} className="btn-secondary text-xs px-2 py-1">+1</button>
                    <button disabled={busyId === u.id} onClick={() => handleCreditAdjust(u.id, -1)} className="btn-secondary text-xs px-2 py-1">-1</button>
                    <button disabled={busyId === u.id} onClick={() => handleCreditAdjust(u.id, 5)} className="btn-secondary text-xs px-2 py-1">+5</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'generations' && (
        <div>
          <div className="mb-4 flex gap-2">
            {['all', 'queued', 'processing', 'completed', 'failed'].map(s => (
              <button key={s} onClick={() => setGenFilter(s)} className={`text-xs px-3 py-1 rounded-full ${genFilter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
            ))}
          </div>
          <div className="space-y-2">
            {generations.map(g => (
              <div key={g.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-2">
                <div>
                  <p className="text-gray-800">{g.user_email} — {g.occasion} / {g.style}</p>
                  <p className="text-xs text-gray-400">{new Date(g.created_at).toLocaleString('fr-FR')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={
                    g.status === 'completed' ? 'text-green-600' :
                    g.status === 'failed' ? 'text-red-500' :
                    'text-orange-500'
                  }>{g.status}</span>
                  <button disabled={busyId === g.id} onClick={() => handleDeleteGeneration(g.id)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'pricing' && (
        <div className="space-y-3">
          {pricing.map(p => (
            <div key={p.id} className="card flex flex-wrap items-center gap-4">
              <span className="font-semibold text-gray-800 w-28">{p.label}</span>
              <label className="text-sm text-gray-500">Notes
                <input type="number" defaultValue={p.credits} onBlur={e => handlePricingUpdate(p.id, 'credits', Number(e.target.value))} className="ml-2 w-20 border border-gray-300 rounded px-2 py-1" />
              </label>
              <label className="text-sm text-gray-500">Prix (FCFA)
                <input type="number" defaultValue={p.price_fcfa} onBlur={e => handlePricingUpdate(p.id, 'price_fcfa', Number(e.target.value))} className="ml-2 w-28 border border-gray-300 rounded px-2 py-1" />
              </label>
              <button
                onClick={() => handlePricingUpdate(p.id, 'active', !p.active)}
                className={`text-xs px-3 py-1 rounded-full ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {p.active ? 'Actif' : 'Désactivé'}
              </button>
            </div>
          ))}
          <p className="text-xs text-gray-400 mt-2">Modifie une valeur puis clique en dehors du champ pour l'enregistrer.</p>
        </div>
      )}

      {tab === 'partners' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Nouveau partenaire</h2>
            <div className="flex flex-wrap gap-3">
              <input placeholder="Nom" value={newPartner.name} onChange={e => setNewPartner(p => ({ ...p, name: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[160px]" />
              <input placeholder="Email de contact" value={newPartner.contact_email} onChange={e => setNewPartner(p => ({ ...p, contact_email: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[160px]" />
              <input placeholder="Téléphone" value={newPartner.contact_phone} onChange={e => setNewPartner(p => ({ ...p, contact_phone: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[140px]" />
              <button disabled={busyId === 'new-partner'} onClick={handleCreatePartner} className="btn-primary text-sm">Ajouter</button>
            </div>
          </div>

          {partners.map(p => (
            <div key={p.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-gray-800">{p.name}</h3>
                  <p className="text-xs text-gray-500">{p.contact_email} {p.contact_phone && `· ${p.contact_phone}`}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`/api/admin/partners/${p.id}/report`} className="btn-secondary text-xs">Télécharger le rapport CSV</a>
                  <button disabled={busyId === p.id} onClick={() => handleDeletePartner(p.id)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {p.coupons.map(c => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span className="font-mono font-semibold text-brand-700">{c.code}</span>
                    <span className="text-gray-600">-{c.discount_percent}%</span>
                    <span className="text-gray-500">{c.used_count}{c.quota !== null ? ` / ${c.quota}` : ''} utilisations</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleToggleCoupon(c.id, c.active)} className={`text-xs px-2 py-1 rounded-full ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {c.active ? 'Actif' : 'Désactivé'}
                      </button>
                      <button onClick={() => handleDeleteCoupon(c.id)} className="text-xs text-red-400 hover:text-red-600">Suppr.</button>
                    </div>
                  </div>
                ))}
                {p.coupons.length === 0 && <p className="text-xs text-gray-400">Aucun coupon pour ce partenaire.</p>}
              </div>

              <div className="flex flex-wrap gap-2 items-center border-t border-gray-100 pt-3">
                <input placeholder="CODE" value={newCoupon[p.id]?.code || ''} onChange={e => setNewCoupon(prev => ({ ...prev, [p.id]: { ...prev[p.id], code: e.target.value.toUpperCase(), discount_percent: prev[p.id]?.discount_percent || '', quota: prev[p.id]?.quota || '' } }))} className="border border-gray-300 rounded px-2 py-1.5 text-sm w-32 uppercase" />
                <input type="number" placeholder="% remise" value={newCoupon[p.id]?.discount_percent || ''} onChange={e => setNewCoupon(prev => ({ ...prev, [p.id]: { ...prev[p.id], code: prev[p.id]?.code || '', discount_percent: e.target.value, quota: prev[p.id]?.quota || '' } }))} className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24" />
                <input type="number" placeholder="Quota (vide=illimité)" value={newCoupon[p.id]?.quota || ''} onChange={e => setNewCoupon(prev => ({ ...prev, [p.id]: { ...prev[p.id], code: prev[p.id]?.code || '', discount_percent: prev[p.id]?.discount_percent || '', quota: e.target.value } }))} className="border border-gray-300 rounded px-2 py-1.5 text-sm w-40" />
                <button disabled={busyId === 'new-coupon-' + p.id} onClick={() => handleCreateCoupon(p.id)} className="btn-secondary text-xs">Créer un coupon</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'ads' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Nouvelle publicité</h2>
            <div className="flex flex-wrap gap-3">
              <input placeholder="Nom de l'annonceur" value={newAd.advertiser_name} onChange={e => setNewAd(a => ({ ...a, advertiser_name: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[160px]" />
              <input placeholder="URL du média (image ou vidéo)" value={newAd.media_url} onChange={e => setNewAd(a => ({ ...a, media_url: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[220px]" />
              <select value={newAd.media_type} onChange={e => setNewAd(a => ({ ...a, media_type: e.target.value as 'image' | 'video' }))} className="border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="image">Image</option>
                <option value="video">Vidéo</option>
              </select>
              <input placeholder="Lien de destination (optionnel)" value={newAd.target_url} onChange={e => setNewAd(a => ({ ...a, target_url: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[180px]" />
              <button disabled={busyId === 'new-ad'} onClick={handleCreateAd} className="btn-primary text-sm">Ajouter</button>
            </div>
          </div>

          <div className="space-y-3">
            {ads.map(ad => (
              <div key={ad.id} className="card flex flex-wrap items-center gap-4">
                {ad.media_type === 'image' ? (
                  <img src={ad.media_url} alt="" className="w-20 h-14 object-cover rounded-lg flex-none" />
                ) : (
                  <video src={ad.media_url} muted className="w-20 h-14 object-cover rounded-lg flex-none" />
                )}
                <div className="flex-1 min-w-[160px]">
                  <p className="font-semibold text-gray-800">{ad.advertiser_name}</p>
                  <p className="text-xs text-gray-500">{ad.media_type} {ad.target_url && `· ${ad.target_url}`}</p>
                </div>
                <button onClick={() => handleToggleAd(ad.id, ad.active)} className={`text-xs px-3 py-1 rounded-full ${ad.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {ad.active ? 'Actif' : 'Désactivé'}
                </button>
                <button disabled={busyId === ad.id} onClick={() => handleDeleteAd(ad.id)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
              </div>
            ))}
            {ads.length === 0 && <p className="text-gray-500">Aucune publicité pour le moment.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
