'use client';
import { useEffect, useState, useCallback } from 'react';

type PurchaseRequest = {
  id: string; user_id: string; user_email?: string; pack_id: string; credits: number; price_fcfa: number;
  payment_method: string; payment_reference: string | null; coupon_id: string | null; status: string; created_at: string;
};
type Stats = { totalUsers: number; totalGenerations: number; pendingRequests: number; totalRevenueFcfa: number };
type AdminUser = { id: string; email: string; created_at: string; last_sign_in_at: string | null; balance: number; is_admin: boolean; generations_count: number };
type AdminGeneration = { id: string; user_email: string; occasion: string; style: string; status: string; created_at: string };
type PricingPack = { id: string; credits: number; price_fcfa: number; label: string; active: boolean; sort_order: number };
type Coupon = { id: string; code: string; partner_id: string; discount_percent: number; quota: number | null; used_count: number; active: boolean };
type Partner = { id: string; name: string; contact_email: string | null; contact_phone: string | null; notes: string | null; active: boolean; coupons: Coupon[] };
type Ad = { id: string; advertiser_name: string; media_url: string; media_type: 'image' | 'video'; target_url: string | null; active: boolean; sort_order: number };
type FeaturedSong = { id: string; generation_id: string; active: boolean; generation: { id: string; occasion: string; style: string; status: string } | null };
type RefundRequest = {
  id: string; generation_id: string; user_id: string; user_email?: string; credits: number; reason: string | null;
  status: string; created_at: string; reviewed_by: string | null; generation: { occasion: string; style: string; status: string } | null;
};
type LiveStats = {
  onlineCount: number; processingGenerations: number; pendingPurchaseRequests: number;
  pendingRefundRequests: number; openChatConversations: number; revenueTodayFcfa: number; newSignupsToday: number;
  unacknowledgedProviderErrors: number;
};
type ProviderError = {
  id: string; generation_id: string | null; user_id: string; user_email?: string; provider: string; message: string;
  created_at: string; acknowledged: boolean; generation: { occasion: string; style: string } | null;
};

const LIVE_POLL_MS = 5000;
const CHAT_POLL_MS = 4000;

type ChatConversation = { id: string; user_id: string; user_email?: string; status: string; created_at: string; last_message_at: string };
type ChatMessage = { id: string; sender: string; content: string; created_at: string };
type EmailCampaign = {
  id: string; subject: string; body_html: string; status: string; audience: string;
  recipient_count: number | null; sent_count: number; created_at: string; sent_at: string | null;
  headline: string | null; cta_label: string | null; cta_url: string | null; promo_code: string | null; error_message: string | null;
};

const TABS = ['overview', 'requests', 'users', 'generations', 'pricing', 'partners', 'ads', 'featured', 'refunds', 'messages', 'emailing', 'alerts'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Vue d'ensemble",
  requests: 'Demandes',
  users: 'Utilisateurs',
  generations: 'Chansons',
  pricing: 'Tarifs',
  partners: 'Partenaires',
  ads: 'Publicité',
  featured: 'Vedette',
  refunds: 'Remboursements',
  messages: 'Messages',
  emailing: 'Emailing',
  alerts: 'Alertes',
};

const AUDIENCE_LABELS: Record<string, string> = { all: 'Tous les utilisateurs', active: 'Utilisateurs actifs (≥1 chanson)', inactive: 'Utilisateurs inactifs (0 chanson)' };

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
  const [featured, setFeatured] = useState<FeaturedSong[]>([]);
  const [allCompletedGens, setAllCompletedGens] = useState<AdminGeneration[]>([]);
  const [newFeaturedId, setNewFeaturedId] = useState('');
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [providerErrors, setProviderErrors] = useState<ProviderError[]>([]);
  const [live, setLive] = useState<LiveStats | null>(null);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatReply, setChatReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [newCampaign, setNewCampaign] = useState({ subject: '', body_html: '', audience: 'all', headline: '', cta_label: '', cta_url: '', promo_code: '' });
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newPartner, setNewPartner] = useState({ name: '', contact_email: '', contact_phone: '' });
  const [newCoupon, setNewCoupon] = useState<Record<string, { code: string; discount_percent: string; quota: string }>>({});
  const [newAd, setNewAd] = useState({ advertiser_name: '', media_url: '', media_type: 'image' as 'image' | 'video', target_url: '' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [statsRes, reqRes, usersRes, genRes, priceRes, partnersRes, adsRes, featuredRes, allGenRes, refundsRes, campaignsRes, providerErrorsRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/purchase-requests'),
      fetch('/api/admin/users'),
      fetch(`/api/admin/generations?status=${genFilter}`),
      fetch('/api/admin/pricing'),
      fetch('/api/admin/partners'),
      fetch('/api/admin/ads'),
      fetch('/api/admin/featured-songs'),
      fetch('/api/admin/generations?status=completed'),
      fetch('/api/admin/refund-requests'),
      fetch('/api/admin/campaigns'),
      fetch('/api/admin/provider-errors'),
    ]);
    if (statsRes.ok) setStats(await statsRes.json());
    if (reqRes.ok) setRequests(await reqRes.json());
    if (usersRes.ok) setUsers(await usersRes.json());
    if (genRes.ok) setGenerations(await genRes.json());
    if (priceRes.ok) setPricing(await priceRes.json());
    if (partnersRes.ok) setPartners(await partnersRes.json());
    if (adsRes.ok) setAds(await adsRes.json());
    if (featuredRes.ok) setFeatured(await featuredRes.json());
    if (allGenRes.ok) setAllCompletedGens(await allGenRes.json());
    if (refundsRes.ok) setRefunds(await refundsRes.json());
    if (campaignsRes.ok) setCampaigns(await campaignsRes.json());
    if (providerErrorsRes.ok) setProviderErrors(await providerErrorsRes.json());
    setLoading(false);
  }, [genFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const res = await fetch('/api/admin/live-stats');
      if (!cancelled && res.ok) setLive(await res.json());
    };
    poll();
    const id = setInterval(poll, LIVE_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const loadChatConversations = useCallback(async () => {
    const res = await fetch('/api/admin/chat');
    if (res.ok) setChatConversations(await res.json());
  }, []);

  useEffect(() => {
    if (tab !== 'messages') return;
    let cancelled = false;
    const poll = async () => {
      const res = await fetch('/api/admin/chat');
      if (!cancelled && res.ok) setChatConversations(await res.json());
    };
    poll();
    const id = setInterval(poll, CHAT_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'messages' || !selectedChatId) return;
    let cancelled = false;
    const poll = async () => {
      const res = await fetch(`/api/admin/chat/${selectedChatId}`);
      if (!cancelled && res.ok) setChatMessages(await res.json());
    };
    poll();
    const id = setInterval(poll, CHAT_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [tab, selectedChatId]);

  const handleSendChatReply = async () => {
    if (!selectedChatId || !chatReply.trim()) return;
    setSendingReply(true);
    const res = await fetch(`/api/admin/chat/${selectedChatId}/reply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: chatReply.trim() }),
    });
    setSendingReply(false);
    if (res.ok) {
      setChatReply('');
      const [msgRes] = await Promise.all([fetch(`/api/admin/chat/${selectedChatId}`), loadChatConversations()]);
      if (msgRes.ok) setChatMessages(await msgRes.json());
    } else alert('Erreur envoi.');
  };

  const handleCloseChat = async (id: string, reopen: boolean) => {
    const res = await fetch(`/api/admin/chat/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: reopen ? 'reopen' : 'close' }),
    });
    if (res.ok) loadChatConversations(); else alert('Erreur.');
  };

  const handleCreateCampaign = async () => {
    if (!newCampaign.subject.trim() || !newCampaign.body_html.trim()) return;
    setBusyId('new-campaign');
    const res = await fetch('/api/admin/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCampaign),
    });
    setBusyId(null);
    if (res.ok) { setNewCampaign({ subject: '', body_html: '', audience: 'all', headline: '', cta_label: '', cta_url: '', promo_code: '' }); loadAll(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Erreur création campagne.'); }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Supprimer ce brouillon de campagne ?')) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

  const handleSendCampaign = async (c: EmailCampaign) => {
    if (!confirm(`Envoyer "${c.subject}" à l'audience "${AUDIENCE_LABELS[c.audience]}" ? Cette action est irréversible.`)) return;
    setSendingCampaignId(c.id);
    const res = await fetch(`/api/admin/campaigns/${c.id}/send`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setSendingCampaignId(null);
    if (res.ok) { alert(`Envoyée à ${data.sentCount}/${data.recipientCount} destinataires.`); loadAll(); }
    else alert(data.error || 'Erreur envoi.');
  };

  const handleAcknowledgeError = async (id: string) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/provider-errors/${id}`, { method: 'PATCH' });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

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

  const handleCreateFeatured = async () => {
    if (!newFeaturedId) return;
    setBusyId('new-featured');
    const res = await fetch('/api/admin/featured-songs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generation_id: newFeaturedId }),
    });
    setBusyId(null);
    if (res.ok) { setNewFeaturedId(''); loadAll(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Erreur.'); }
  };

  const handleToggleFeatured = async (id: string, current: boolean) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/featured-songs/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !current }),
    });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

  const handleDeleteFeatured = async (id: string) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/featured-songs/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

  const handleRefundAction = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    const res = await fetch(`/api/admin/refund-requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur lors du traitement.');
  };

  const pending = requests.filter(r => r.status === 'pending');
  const processed = requests.filter(r => r.status !== 'pending');
  const pendingRefunds = refunds.filter(r => r.status === 'pending');
  const processedRefunds = refunds.filter(r => r.status !== 'pending');

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Dashboard Admin — Melotones</h1>

      {live && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <div className="card !p-3 text-center relative overflow-hidden">
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-2xl font-bold text-green-600">{live.onlineCount}</p>
            <p className="text-[11px] text-gray-500">En ligne</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{live.processingGenerations}</p>
            <p className="text-[11px] text-gray-500">Génération en cours</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-2xl font-bold text-brand-600">{live.pendingPurchaseRequests}</p>
            <p className="text-[11px] text-gray-500">Achats en attente</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-2xl font-bold text-brand-600">{live.pendingRefundRequests}</p>
            <p className="text-[11px] text-gray-500">Remb. en attente</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-2xl font-bold text-pink-600">{live.openChatConversations}</p>
            <p className="text-[11px] text-gray-500">Chats à traiter</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{live.revenueTodayFcfa.toLocaleString('fr-FR')}</p>
            <p className="text-[11px] text-gray-500">Revenus aujourd'hui</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{live.newSignupsToday}</p>
            <p className="text-[11px] text-gray-500">Inscrits aujourd'hui</p>
          </div>
          <div className="card !p-3 text-center">
            <p className={`text-2xl font-bold ${live.unacknowledgedProviderErrors > 0 ? 'text-red-600' : 'text-gray-700'}`}>{live.unacknowledgedProviderErrors}</p>
            <p className="text-[11px] text-gray-500">Alertes fournisseur</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-200 pb-2">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {TAB_LABELS[t]}
            {t === 'requests' && pending.length > 0 ? ` (${pending.length})` : ''}
            {t === 'refunds' && pendingRefunds.length > 0 ? ` (${pendingRefunds.length})` : ''}
            {t === 'messages' && chatConversations.filter(c => c.status === 'escalated').length > 0 ? ` (${chatConversations.filter(c => c.status === 'escalated').length})` : ''}
            {t === 'alerts' && providerErrors.filter(e => !e.acknowledged).length > 0 ? ` (${providerErrors.filter(e => !e.acknowledged).length})` : ''}
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
                    <p className="font-semibold text-gray-800">{r.user_email || r.user_id}</p>
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
                <span>{r.user_email || r.user_id} — {r.credits} notes — {r.price_fcfa.toLocaleString('fr-FR')} FCFA</span>
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

      {tab === 'featured' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Mettre une chanson en vedette</h2>
            <p className="text-xs text-gray-500 mb-3">Affichée sur l'accueil de tous les utilisateurs — occasion, style et audio uniquement, jamais le message personnel.</p>
            <div className="flex flex-wrap gap-3">
              <select value={newFeaturedId} onChange={e => setNewFeaturedId(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[260px]">
                <option value="">— Choisir une chanson terminée —</option>
                {allCompletedGens.map(g => (
                  <option key={g.id} value={g.id}>{g.occasion} · {g.style} · {g.user_email} · {new Date(g.created_at).toLocaleDateString('fr-FR')}</option>
                ))}
              </select>
              <button disabled={busyId === 'new-featured' || !newFeaturedId} onClick={handleCreateFeatured} className="btn-primary text-sm">Mettre en vedette</button>
            </div>
          </div>

          <div className="space-y-3">
            {featured.map(f => (
              <div key={f.id} className="card flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[160px]">
                  {f.generation ? (
                    <p className="font-semibold text-gray-800 capitalize">{f.generation.occasion} · {f.generation.style}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Chanson supprimée</p>
                  )}
                </div>
                <button onClick={() => handleToggleFeatured(f.id, f.active)} className={`text-xs px-3 py-1 rounded-full ${f.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {f.active ? 'Actif' : 'Désactivé'}
                </button>
                <button disabled={busyId === f.id} onClick={() => handleDeleteFeatured(f.id)} className="text-xs text-red-400 hover:text-red-600">Retirer</button>
              </div>
            ))}
            {featured.length === 0 && <p className="text-gray-500">Aucune chanson en vedette pour le moment.</p>}
          </div>
        </div>
      )}

      {tab === 'refunds' && (
        <div>
          <h2 className="text-lg font-bold mb-4 text-gray-800">En attente ({pendingRefunds.length})</h2>
          {pendingRefunds.length === 0 ? <p className="text-gray-500 mb-8">Aucune demande de remboursement en attente.</p> : (
            <div className="space-y-3 mb-8">
              {pendingRefunds.map(r => (
                <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{r.user_email || r.user_id}</p>
                    <p className="text-sm text-gray-600 capitalize">
                      {r.credits} note{r.credits > 1 ? 's' : ''} · {r.generation ? `${r.generation.occasion} / ${r.generation.style}` : 'chanson supprimée'}
                    </p>
                    {r.reason && <p className="text-xs text-gray-500 italic">{r.reason}</p>}
                    <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busyId === r.id} onClick={() => handleRefundAction(r.id, 'approve')} className="btn-primary text-sm">Approuver</button>
                    <button disabled={busyId === r.id} onClick={() => handleRefundAction(r.id, 'reject')} className="btn-secondary text-sm">Rejeter</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <h2 className="text-lg font-bold mb-4 text-gray-800">Historique</h2>
          <div className="space-y-2">
            {processedRefunds.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm text-gray-600 border-b border-gray-100 py-2 gap-3">
                <span className="min-w-0 truncate">{r.user_email || r.user_id} — {r.credits} note{r.credits > 1 ? 's' : ''}{r.generation ? ` — ${r.generation.occasion} / ${r.generation.style}` : ''}</span>
                <div className="flex items-center gap-2 flex-none">
                  {r.status === 'approved' && !r.reviewed_by && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Automatique</span>
                  )}
                  <span className={r.status === 'approved' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                    {r.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                  </span>
                </div>
              </div>
            ))}
            {processedRefunds.length === 0 && <p className="text-gray-400 text-sm">Aucun historique.</p>}
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[600px]">
          <div className="border border-gray-200 rounded-xl overflow-y-auto bg-white">
            {chatConversations.length === 0 && <p className="text-gray-400 text-sm p-4">Aucune conversation.</p>}
            {chatConversations.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedChatId(c.id); setChatMessages([]); }}
                className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 ${selectedChatId === c.id ? 'bg-brand-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.user_email || c.user_id}</p>
                  {c.status === 'escalated' && <span className="w-2 h-2 rounded-full bg-red-500 flex-none" />}
                </div>
                <p className="text-xs text-gray-400">{new Date(c.last_message_at).toLocaleString('fr-FR')}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full inline-block mt-1 ${
                  c.status === 'escalated' ? 'bg-red-100 text-red-700' : c.status === 'closed' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                }`}>{c.status === 'escalated' ? 'À traiter' : c.status === 'closed' ? 'Fermée' : 'Bot actif'}</span>
              </button>
            ))}
          </div>

          <div className="border border-gray-200 rounded-xl bg-white flex flex-col">
            {!selectedChatId ? (
              <p className="text-gray-400 text-sm p-4 m-auto">Sélectionnez une conversation.</p>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Conversation</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleCloseChat(selectedChatId, false)} className="text-xs text-gray-500 hover:text-gray-700">Fermer</button>
                    <button onClick={() => handleCloseChat(selectedChatId, true)} className="text-xs text-brand-600 hover:text-brand-800">Rouvrir</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map(m => (
                    <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        m.sender === 'admin' ? 'bg-brand-600 text-white' : m.sender === 'bot' ? 'bg-gray-100 text-gray-700' : 'bg-amber-50 text-gray-800 border border-amber-200'
                      }`}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        <p className={`text-[10px] mt-1 ${m.sender === 'admin' ? 'text-brand-100' : 'text-gray-400'}`}>
                          {m.sender === 'user' ? 'Client' : m.sender === 'bot' ? 'Bot' : 'Vous'} · {new Date(m.created_at).toLocaleTimeString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 p-3 border-t border-gray-100">
                  <input
                    value={chatReply}
                    onChange={e => setChatReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSendChatReply(); }}
                    placeholder="Répondre au client…"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button disabled={sendingReply || !chatReply.trim()} onClick={handleSendChatReply} className="btn-primary text-sm">Envoyer</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'emailing' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-bold mb-1 text-gray-800">Nouvelle campagne</h2>
            <p className="text-xs text-gray-500 mb-4">Le contenu accepte du HTML. Un lien de désinscription est ajouté automatiquement à la fin.</p>
            <div className="space-y-3">
              <input
                placeholder="Objet de l'email"
                value={newCampaign.subject}
                onChange={e => setNewCampaign(c => ({ ...c, subject: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                placeholder="Accroche (optionnel, ex. « Idée cadeau »)"
                value={newCampaign.headline}
                onChange={e => setNewCampaign(c => ({ ...c, headline: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Message (le texte après « Bonjour {Prénom}, » — HTML simple autorisé, ex. <p>...</p>)…"
                value={newCampaign.body_html}
                onChange={e => setNewCampaign(c => ({ ...c, body_html: e.target.value }))}
                rows={6}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  placeholder="Code promo (optionnel)"
                  value={newCampaign.promo_code}
                  onChange={e => setNewCampaign(c => ({ ...c, promo_code: e.target.value.toUpperCase() }))}
                  className="border border-gray-300 rounded px-3 py-2 text-sm uppercase"
                />
                <input
                  placeholder="Texte du bouton (défaut : Créer ma chanson)"
                  value={newCampaign.cta_label}
                  onChange={e => setNewCampaign(c => ({ ...c, cta_label: e.target.value }))}
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <input
                  placeholder="Lien du bouton (défaut : /create)"
                  value={newCampaign.cta_url}
                  onChange={e => setNewCampaign(c => ({ ...c, cta_url: e.target.value }))}
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <select value={newCampaign.audience} onChange={e => setNewCampaign(c => ({ ...c, audience: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm">
                  {Object.entries(AUDIENCE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <button disabled={busyId === 'new-campaign'} onClick={handleCreateCampaign} className="btn-primary text-sm">Enregistrer le brouillon</button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {campaigns.map(c => (
              <div key={c.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{c.subject}</p>
                    <p className="text-xs text-gray-500">{AUDIENCE_LABELS[c.audience]} · {new Date(c.created_at).toLocaleString('fr-FR')}</p>
                    {c.status === 'sent' && <p className="text-xs text-green-600 mt-1">Envoyée à {c.sent_count}/{c.recipient_count} destinataires le {c.sent_at && new Date(c.sent_at).toLocaleString('fr-FR')}</p>}
                    {c.status === 'failed' && (
                      <p className="text-xs text-red-600 mt-1">Échec de l'envoi ({c.recipient_count} destinataires visés, 0 livré){c.error_message ? ` — ${c.error_message}` : ''}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      c.status === 'sent' ? 'bg-green-100 text-green-700' : c.status === 'sending' ? 'bg-orange-100 text-orange-700' : c.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                    }`}>{c.status === 'sent' ? 'Envoyée' : c.status === 'sending' ? 'Envoi en cours' : c.status === 'failed' ? 'Échouée' : 'Brouillon'}</span>
                    {(c.status === 'draft' || c.status === 'failed') && (
                      <button disabled={sendingCampaignId === c.id} onClick={() => handleSendCampaign(c)} className="btn-primary text-xs">
                        {sendingCampaignId === c.id ? 'Envoi…' : c.status === 'failed' ? 'Réessayer' : 'Envoyer'}
                      </button>
                    )}
                    {c.status === 'draft' && (
                      <button disabled={busyId === c.id} onClick={() => handleDeleteCampaign(c.id)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {campaigns.length === 0 && <p className="text-gray-500">Aucune campagne pour le moment.</p>}
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 mb-2">Pannes remontées automatiquement par le fournisseur de génération musicale — indépendant des remboursements.</p>
          {providerErrors.map(e => (
            <div key={e.id} className={`card flex flex-wrap items-start justify-between gap-3 ${e.acknowledged ? 'opacity-60' : ''}`}>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800">{e.user_email || e.user_id}{e.generation ? ` — ${e.generation.occasion} / ${e.generation.style}` : ''}</p>
                <p className="text-sm text-gray-600 font-mono break-all">{e.message}</p>
                <p className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString('fr-FR')}</p>
              </div>
              {!e.acknowledged ? (
                <button disabled={busyId === e.id} onClick={() => handleAcknowledgeError(e.id)} className="btn-secondary text-xs flex-none">Marquer comme vu</button>
              ) : (
                <span className="text-xs text-gray-400 flex-none">Vu</span>
              )}
            </div>
          ))}
          {providerErrors.length === 0 && <p className="text-gray-500">Aucune alerte pour le moment.</p>}
        </div>
      )}
    </div>
  );
}
