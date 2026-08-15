'use client';
import { useEffect, useState, useCallback } from 'react';
import AnalyticsChart, { AnalyticsSeriesPoint } from './AnalyticsChart';

type PurchaseRequest = {
  id: string; user_id: string; user_email?: string; pack_id: string; credits: number; price_fcfa: number;
  payment_method: string; payment_reference: string | null; coupon_id: string | null; status: string; created_at: string;
  provider: string | null; provider_status: string | null;
};
type Stats = { totalUsers: number; totalGenerations: number; pendingRequests: number; totalRevenueFcfa: number };
type AdminUser = { id: string; email: string; created_at: string; last_sign_in_at: string | null; balance: number; is_admin: boolean; generations_count: number };
type AdminGeneration = { id: string; user_email: string; occasion: string; style: string; status: string; created_at: string };
type PricingPack = { id: string; credits: number; price_fcfa: number; label: string; active: boolean; sort_order: number };
type Coupon = { id: string; code: string; partner_id: string; discount_percent: number; quota: number | null; used_count: number; active: boolean };
type Partner = {
  id: string; name: string; contact_email: string | null; contact_phone: string | null; notes: string | null;
  active: boolean; coupons: Coupon[]; commission_percent: number;
  totalSales: number; totalRevenueFcfa: number; totalCommissionFcfa: number;
};
type Ad = { id: string; advertiser_name: string; media_url: string; media_type: 'image' | 'video'; target_url: string | null; active: boolean; sort_order: number };
type FeaturedSong = { id: string; generation_id: string; active: boolean; generation: { id: string; occasion: string; style: string; status: string } | null };
type RefundRequest = {
  id: string; generation_id: string; user_id: string; user_email?: string; credits: number; reason: string | null;
  status: string; created_at: string; reviewed_by: string | null; generation: { occasion: string; style: string; status: string } | null;
};
type LiveStats = {
  onlineCount: number; processingGenerations: number; pendingPurchaseRequests: number;
  pendingRefundRequests: number; openChatConversations: number; revenueTodayFcfa: number; newSignupsToday: number;
  unacknowledgedProviderErrors: number; providerBalanceUsd: number; providerBalanceGenerations: number | null;
};
type ProviderBalance = {
  toppedUpUsd: number; costPerGenerationUsd: number; toppedUpAt: string | null;
  consumedSinceTopUp: number; estimatedRemainingUsd: number; estimatedRemainingGenerations: number | null;
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

const TABS = ['overview', 'analytics', 'automation', 'requests', 'users', 'generations', 'pricing', 'partners', 'ads', 'featured', 'refunds', 'messages', 'emailing', 'testimonials', 'alerts', 'credentials'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Vue d'ensemble",
  analytics: 'Analytics',
  automation: 'Automatisation',
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
  testimonials: 'Avis',
  alerts: 'Alertes',
  credentials: 'Identifiants',
};

type Testimonial = {
  id: string; user_id: string; user_email: string; generation_id: string | null;
  rating: number; message: string; consent_public: boolean; status: 'pending' | 'approved' | 'rejected'; created_at: string;
  review_type?: string;
  moderation_action?: string;
  moderation_categories?: string[];
  moderation_confidence?: number;
  moderation_severity?: string;
  admin_alert_severity?: string | null;
  moderation_language?: string | null;
  language_confidence?: number;
  reviewed_by?: string | null;
  admin_notes?: string | null;
  moderation_policy_version?: string;
};

type AutomationRun = {
  id: string; agent_slug: string; status: 'success' | 'alert' | 'failure';
  summary: string | null; details: any; ran_at: string;
};

type HumanTask = {
  id: string; title: string; description: string | null; source: string;
  status: 'pending' | 'done' | 'dismissed'; created_at: string; completed_at: string | null;
};

type CanvaStatus = {
  configured: boolean; connected: boolean; expiresAt: string | null;
  lastRefreshedAt: string | null; connectedAt: string | null; scopes: string | null; lastError: string | null;
};

type TiktokStatus = CanvaStatus;
type MetaStatus = CanvaStatus;
type YoutubeStatus = CanvaStatus;

type CredentialEntry = {
  key: string; label: string; kind: 'oauth' | 'apikey';
  configured: boolean; connected?: boolean;
  expiresAt?: string | null; lastRefreshedAt?: string | null; lastError?: string | null;
  envVars: string[]; rotateUrl: string;
};

type CanvaSyncReport = {
  dryRun: boolean; rootFolder: string | null; foldersScanned: number; designsFound: number;
  toCreate: number; toUpdate: number; unchanged: number; manualCheck: number;
  items: { action: string; title: string; folderName: string; reason?: string }[];
  error?: string;
};

type ContentAsset = {
  id: string; canva_design_id: string; canva_folder_name: string | null; canva_edit_url: string | null;
  thumbnail_url: string | null; title: string; platform: string | null; status: string;
  canva_updated_at: string | null; last_sync_at: string | null;
  suggested_caption_fr: string | null; suggested_caption_en: string | null; suggested_hashtags: string | null;
};

const ASSET_STATUSES = ['DISCOVERED', 'CLASSIFIED', 'DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'EXPORTING', 'EXPORTED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED', 'REJECTED', 'MANUAL_UPLOAD_REQUIRED'];

type AssetPriority = { rank: number; label: string; tone: 'urgent' | 'ready' | 'blocked' | 'progress' | 'done' };

// Ordonne les assets par étape réelle du pipeline (légende → approbation →
// publication) au lieu de l'ordre brut de la base, pour que l'admin sache
// toujours quoi faire en premier sans avoir à deviner parmi ~50 cartes
// identiques.
function getAssetPriority(a: ContentAsset, tiktokConnected: boolean, youtubeConnected: boolean): AssetPriority {
  if (a.status === 'MANUAL_UPLOAD_REQUIRED') {
    return { rank: 1, label: 'À finaliser : ouvre TikTok/YouTube Studio pour publier réellement', tone: 'urgent' };
  }
  if (a.status === 'FAILED') {
    return { rank: 2, label: "Échec : vérifie l'erreur puis relance ou annule", tone: 'urgent' };
  }
  if (a.status === 'DISCOVERED' || a.status === 'CLASSIFIED' || a.status === 'READY_FOR_REVIEW') {
    if (!a.suggested_caption_fr) {
      return { rank: 3, label: "Étape 1 : génère la légende IA avant d'approuver", tone: 'ready' };
    }
    return { rank: 4, label: 'Étape 2 : prêt à approuver', tone: 'ready' };
  }
  if (a.status === 'APPROVED') {
    if (tiktokConnected || youtubeConnected) {
      return { rank: 5, label: 'Étape 3 : prêt à publier', tone: 'ready' };
    }
    return { rank: 6, label: 'En attente : connecte TikTok ou YouTube pour publier', tone: 'blocked' };
  }
  if (a.status === 'EXPORTING' || a.status === 'EXPORTED' || a.status === 'SCHEDULED') {
    return { rank: 7, label: 'En cours — rien à faire pour le moment', tone: 'progress' };
  }
  return { rank: 8, label: a.status === 'REJECTED' ? 'Annulé' : 'Terminé', tone: 'done' };
}

const PRIORITY_BADGE_CLASSES: Record<AssetPriority['tone'], string> = {
  urgent: 'bg-amber-100 text-amber-700',
  ready: 'bg-green-100 text-green-700',
  blocked: 'bg-gray-100 text-gray-500',
  progress: 'bg-blue-100 text-blue-700',
  done: 'bg-gray-50 text-gray-400',
};

const AUTOMATION_AGENTS: { slug: string; name: string; schedule: string; description: string }[] = [
  { slug: 'backup', name: 'Sauvegarde hebdomadaire', schedule: 'Chaque lundi 08:00 UTC', description: 'Exporte toutes les tables + fichiers Storage, lien de téléchargement envoyé par email (7 jours).' },
  { slug: 'growth-digest', name: 'Rapport de croissance', schedule: 'Chaque lundi 09:00 UTC', description: 'Visiteurs, inscriptions, activation, conversion, solde MusicGPT — envoyé par email.' },
  { slug: 'health-monitor', name: 'Surveillance santé', schedule: 'Chaque jour 07:00 UTC', description: 'Coupe-circuit fournisseur, remboursements en attente, erreurs des dernières 24h, solde bas — alerte par email si besoin.' },
  { slug: 'content-generator', name: 'Contenu réseaux sociaux', schedule: 'Chaque jeudi 10:00 UTC', description: 'Génère 2 nouveaux visuels + légendes (angle rotatif), envoyés par email pour publication manuelle.' },
  { slug: 'onboarding-sequence', name: 'Séquence d\'activation', schedule: 'Chaque jour 11:00 UTC', description: 'J0 bienvenue à tous les nouveaux comptes, puis J2/J7 relancent les comptes restés inactifs (jamais généré, jamais acheté) vers leur premier achat — respecte la désinscription.' },
];

const AUDIENCE_LABELS: Record<string, string> = { all: 'Tous les utilisateurs', active: 'Utilisateurs actifs (≥1 chanson)', inactive: 'Utilisateurs inactifs (0 chanson)' };

type Analytics = {
  periodDays: number; uniqueVisitors: number; totalPageviews: number; signupsInPeriod: number; signupRate: number | null;
  totalUsers: number; activatedUsers: number; activationRate: number | null; payingUsers: number; conversionRate: number | null;
  series: AnalyticsSeriesPoint[];
  totalShares: number; sharesByChannel: Record<string, number>;
};

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
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
  const [providerBalance, setProviderBalance] = useState<ProviderBalance | null>(null);
  const [topUpForm, setTopUpForm] = useState({ topped_up_usd: '', cost_per_generation_usd: '' });
  const [savingTopUp, setSavingTopUp] = useState(false);
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
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
  const [editBalanceValue, setEditBalanceValue] = useState('');
  const [newPartner, setNewPartner] = useState({ name: '', contact_email: '', contact_phone: '' });
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
  const [editCommissionValue, setEditCommissionValue] = useState<Record<string, string>>({});
  const [newCoupon, setNewCoupon] = useState<Record<string, { code: string; discount_percent: string; quota: string }>>({});
  const [newAd, setNewAd] = useState({ advertiser_name: '', media_url: '', media_type: 'image' as 'image' | 'video', target_url: '' });
  const [automationRuns, setAutomationRuns] = useState<AutomationRun[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [humanTasks, setHumanTasks] = useState<HumanTask[]>([]);
  const [newTask, setNewTask] = useState({ title: '', description: '' });
  const [missionText, setMissionText] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedGenIds, setSelectedGenIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [canvaStatus, setCanvaStatus] = useState<CanvaStatus | null>(null);
  const [tiktokStatus, setTiktokStatus] = useState<TiktokStatus | null>(null);
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [youtubeStatus, setYoutubeStatus] = useState<YoutubeStatus | null>(null);
  const [canvaSyncReport, setCanvaSyncReport] = useState<CanvaSyncReport | null>(null);
  const [canvaSyncing, setCanvaSyncing] = useState(false);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetStatusFilter, setAssetStatusFilter] = useState('all');
  const [canvaPromptAngle, setCanvaPromptAngle] = useState('');
  const [canvaPromptResult, setCanvaPromptResult] = useState<string | null>(null);
  const [canvaPromptLoading, setCanvaPromptLoading] = useState(false);
  const [canvaPromptCopied, setCanvaPromptCopied] = useState(false);
  const [canvaExporting, setCanvaExporting] = useState(false);
  const [canvaExportProgress, setCanvaExportProgress] = useState<{ done: number; total: number } | null>(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetBusyId, setAssetBusyId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialEntry[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [statsRes, analyticsRes, automationRunsRes, testimonialsRes, humanTasksRes, reqRes, usersRes, genRes, priceRes, partnersRes, adsRes, featuredRes, allGenRes, refundsRes, campaignsRes, providerErrorsRes, providerBalanceRes, canvaStatusRes, tiktokStatusRes, metaStatusRes, youtubeStatusRes, credentialsRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/analytics'),
      fetch('/api/admin/automation/runs'),
      fetch('/api/admin/testimonials'),
      fetch('/api/admin/human-tasks'),
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
      fetch('/api/admin/provider-balance'),
      fetch('/api/admin/canva/status'),
      fetch('/api/admin/tiktok/status'),
      fetch('/api/admin/meta/status'),
      fetch('/api/admin/youtube/status'),
      fetch('/api/admin/credentials/status'),
    ]);
    if (statsRes.ok) setStats(await statsRes.json());
    if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    if (automationRunsRes.ok) setAutomationRuns(await automationRunsRes.json());
    if (testimonialsRes.ok) setTestimonials(await testimonialsRes.json());
    if (humanTasksRes.ok) setHumanTasks(await humanTasksRes.json());
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
    if (providerBalanceRes.ok) setProviderBalance(await providerBalanceRes.json());
    if (canvaStatusRes.ok) setCanvaStatus(await canvaStatusRes.json());
    if (tiktokStatusRes.ok) setTiktokStatus(await tiktokStatusRes.json());
    if (metaStatusRes.ok) setMetaStatus(await metaStatusRes.json());
    if (youtubeStatusRes.ok) setYoutubeStatus(await youtubeStatusRes.json());
    if (credentialsRes.ok) setCredentials((await credentialsRes.json()).entries || []);
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

  const handleSaveTopUp = async () => {
    const topped_up_usd = Number(topUpForm.topped_up_usd);
    const cost_per_generation_usd = Number(topUpForm.cost_per_generation_usd);
    if (!topUpForm.topped_up_usd || isNaN(topped_up_usd) || isNaN(cost_per_generation_usd)) return;
    setSavingTopUp(true);
    const res = await fetch('/api/admin/provider-balance', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topped_up_usd, cost_per_generation_usd }),
    });
    setSavingTopUp(false);
    if (res.ok) { setTopUpForm({ topped_up_usd: '', cost_per_generation_usd: '' }); loadAll(); }
    else alert('Erreur enregistrement.');
  };

  const handleRequestAction = async (id: string, action: 'approve' | 'reject', isPayDunyaUnconfirmed?: boolean) => {
    if (action === 'approve' && isPayDunyaUnconfirmed) {
      const ok = confirm("Ce paiement PayDunya n'a pas encore été confirmé comme payé par le fournisseur. Approuver manuellement créditera les Chansons SANS vérifier que le client a réellement payé. Continuer ?");
      if (!ok) return;
    }
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

  const handleSetBalance = async (userId: string) => {
    const value = Number(editBalanceValue);
    if (!Number.isFinite(value) || value < 0) { alert('Solde invalide.'); return; }
    setBusyId(userId);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance_set: value }),
    });
    setBusyId(null);
    setEditingBalanceId(null);
    if (res.ok) loadAll(); else alert('Erreur modification crédits.');
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Supprimer définitivement le compte "${email}" et toutes ses données (chansons, achats, conversations) ? Cette action est irréversible.`)) return;
    setBusyId(userId);
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    setBusyId(null);
    if (res.ok) loadAll(); else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Erreur suppression utilisateur.');
    }
  };

  const toggleUserSelect = (id: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllUsers = (ids: string[]) => {
    setSelectedUserIds(prev => (prev.size === ids.length ? new Set() : new Set(ids)));
  };

  const handleBulkDeleteUsers = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Supprimer définitivement ${ids.length} compte(s) et toutes leurs données ? Cette action est irréversible.`)) return;
    setBulkDeleting(true);
    const failures: string[] = [];
    for (const id of ids) {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) failures.push(id);
    }
    setBulkDeleting(false);
    setSelectedUserIds(new Set());
    await loadAll();
    if (failures.length > 0) alert(`${failures.length} suppression(s) ont échoué.`);
  };

  const handleHumanTaskAction = async (id: string, action: 'done' | 'dismiss' | 'reopen') => {
    setBusyId(id);
    const res = await fetch(`/api/admin/human-tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

  const handleDeleteHumanTask = async (id: string) => {
    if (!confirm('Supprimer définitivement cette tâche ?')) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/human-tasks/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

  const handleCreateHumanTask = async () => {
    if (!newTask.title.trim()) return;
    setBusyId('new-task');
    const res = await fetch('/api/admin/human-tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTask.title.trim(), description: newTask.description.trim(), source: 'admin' }),
    });
    setBusyId(null);
    if (res.ok) { setNewTask({ title: '', description: '' }); loadAll(); }
    else alert('Erreur.');
  };

  // Espace de travail IA (P0 #3 du plan de croissance) : une mission écrite
  // librement devient une tâche priorisable dans la même file que les tâches
  // manuelles — pas de nouvelle table, pas de nouvel agent, juste un point
  // d'entrée dédié à des objectifs de croissance plutôt qu'à des todos.
  const handleSubmitMission = async () => {
    const text = missionText.trim();
    if (!text) return;
    setBusyId('new-mission');
    const title = text.length > 70 ? `${text.slice(0, 70)}…` : text;
    const res = await fetch('/api/admin/human-tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: text, source: 'mission' }),
    });
    setBusyId(null);
    if (res.ok) { setMissionText(''); loadAll(); }
    else alert('Erreur création tâche.');
  };

  const handleCanvaSync = async (dryRun: boolean) => {
    setCanvaSyncing(true);
    const res = await fetch('/api/admin/canva/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun }),
    });
    setCanvaSyncing(false);
    if (res.ok) setCanvaSyncReport(await res.json());
    else alert('Erreur de synchronisation Canva.');
  };

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    const params = new URLSearchParams();
    if (assetStatusFilter !== 'all') params.set('status', assetStatusFilter);
    if (assetSearch.trim()) params.set('q', assetSearch.trim());
    const res = await fetch(`/api/admin/canva/assets?${params.toString()}`);
    setAssetsLoading(false);
    if (res.ok) setAssets(await res.json());
  }, [assetStatusFilter, assetSearch]);

  useEffect(() => {
    if (assetLibraryOpen) loadAssets();
  }, [assetLibraryOpen, loadAssets]);

  const handleAssetStatusChange = async (id: string, newStatus: string) => {
    setAssetBusyId(id);
    const res = await fetch(`/api/admin/canva/assets/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }),
    });
    setAssetBusyId(null);
    if (res.ok) setAssets(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    else alert('Erreur de mise à jour du statut.');
  };

  const handleSuggestCaption = async (id: string) => {
    setAssetBusyId(id);
    const res = await fetch(`/api/admin/canva/assets/${id}/suggest-caption`, { method: 'POST' });
    const data = await res.json();
    setAssetBusyId(null);
    if (res.ok) {
      setAssets(prev => prev.map(a => a.id === id ? { ...a, suggested_caption_fr: data.captionFr, suggested_caption_en: data.captionEn, suggested_hashtags: data.hashtags } : a));
    } else {
      alert(`Échec : ${data.error}`);
    }
  };

  const handleGenerateCanvaPrompt = async () => {
    if (!canvaPromptAngle.trim()) return;
    setCanvaPromptLoading(true);
    setCanvaPromptCopied(false);
    const res = await fetch('/api/admin/canva/generate-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angle: canvaPromptAngle }),
    });
    const data = await res.json();
    setCanvaPromptLoading(false);
    if (res.ok) setCanvaPromptResult(data.prompt);
    else alert(`Échec : ${data.error}`);
  };

  const handleCopyCanvaPrompt = async () => {
    if (!canvaPromptResult) return;
    await navigator.clipboard.writeText(canvaPromptResult);
    setCanvaPromptCopied(true);
    setTimeout(() => setCanvaPromptCopied(false), 2000);
  };

  // Traite les assets non exportés par lots (respecte maxDuration côté route) —
  // le bouton se rappelle lui-même tant qu'il reste des assets à traiter,
  // pour sortir les designs Canva de Canva et les rendre indépendants de
  // l'abonnement (voir human_task dismissed sur l'Autofill Enterprise).
  const handleExportCanvaAssets = async () => {
    setCanvaExporting(true);
    let done = 0;
    let total = 0;
    try {
      for (;;) {
        const res = await fetch('/api/admin/canva/export-assets', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) { alert(`Échec : ${data.error}`); break; }
        done += data.exported;
        total = data.remaining + done;
        setCanvaExportProgress({ done, total });
        if (data.remaining === 0) break;
      }
    } finally {
      setCanvaExporting(false);
    }
  };

  const handlePublishTiktok = async (id: string) => {
    setAssetBusyId(id);
    const res = await fetch(`/api/admin/canva/assets/${id}/publish-tiktok`, { method: 'POST' });
    const data = await res.json();
    setAssetBusyId(null);
    if (res.ok) {
      alert(`Déposé en brouillon TikTok (statut : ${data.tiktokStatus}). Ouvre l'app TikTok pour finaliser et publier.`);
      loadAssets();
    } else {
      alert(`Échec : ${data.error}`);
      loadAssets();
    }
  };

  const handlePublishYoutube = async (id: string) => {
    setAssetBusyId(id);
    const res = await fetch(`/api/admin/canva/assets/${id}/publish-youtube`, { method: 'POST' });
    const data = await res.json();
    setAssetBusyId(null);
    if (res.ok) {
      alert(`Déposée sur YouTube en privé (id: ${data.videoId}). Ouvre YouTube Studio pour finaliser et changer la visibilité.`);
      loadAssets();
    } else {
      alert(`Échec : ${data.error}`);
      loadAssets();
    }
  };

  const handleTestimonialAction = async (id: string, action: string) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/testimonials/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (!confirm('Supprimer définitivement cet avis ?')) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur.');
  };

  const handleDeleteGeneration = async (id: string) => {
    if (!confirm('Supprimer définitivement cette génération ?')) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/generations/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (res.ok) loadAll(); else alert('Erreur suppression.');
  };

  const toggleGenSelect = (id: string) => {
    setSelectedGenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllGens = (ids: string[]) => {
    setSelectedGenIds(prev => (prev.size === ids.length ? new Set() : new Set(ids)));
  };

  const handleBulkDeleteGenerations = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Supprimer définitivement ${ids.length} génération(s) ? Cette action est irréversible.`)) return;
    setBulkDeleting(true);
    const failures: string[] = [];
    for (const id of ids) {
      const res = await fetch(`/api/admin/generations/${id}`, { method: 'DELETE' });
      if (!res.ok) failures.push(id);
    }
    setBulkDeleting(false);
    setSelectedGenIds(new Set());
    await loadAll();
    if (failures.length > 0) alert(`${failures.length} suppression(s) ont échoué.`);
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

  const handleUpdateCommission = async (id: string) => {
    const value = editCommissionValue[id];
    const pct = Number(value);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { alert('Commission invalide (0 à 100).'); return; }
    setBusyId(id);
    const res = await fetch(`/api/admin/partners/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commission_percent: pct }),
    });
    setBusyId(null);
    if (res.ok) { setEditingCommissionId(null); loadAll(); } else alert('Erreur mise à jour commission.');
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 mb-6">
          <div className="card !p-3 text-center relative overflow-hidden">
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xl font-bold text-green-600">{live.onlineCount}</p>
            <p className="text-[10px] leading-tight text-gray-500">En ligne</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-xl font-bold text-orange-500">{live.processingGenerations}</p>
            <p className="text-[10px] leading-tight text-gray-500">Génération en cours</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-xl font-bold text-brand-600">{live.pendingPurchaseRequests}</p>
            <p className="text-[10px] leading-tight text-gray-500">Achats en attente</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-xl font-bold text-brand-600">{live.pendingRefundRequests}</p>
            <p className="text-[10px] leading-tight text-gray-500">Remb. en attente</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-xl font-bold text-pink-600">{live.openChatConversations}</p>
            <p className="text-[10px] leading-tight text-gray-500">Chats à traiter</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-xl font-bold text-green-600">{live.revenueTodayFcfa.toLocaleString('fr-FR')}</p>
            <p className="text-[10px] leading-tight text-gray-500">Revenus aujourd'hui</p>
          </div>
          <div className="card !p-3 text-center">
            <p className="text-xl font-bold text-gray-700">{live.newSignupsToday}</p>
            <p className="text-[10px] leading-tight text-gray-500">Inscrits aujourd'hui</p>
          </div>
          <div className="card !p-3 text-center">
            <p className={`text-xl font-bold ${live.unacknowledgedProviderErrors > 0 ? 'text-red-600' : 'text-gray-700'}`}>{live.unacknowledgedProviderErrors}</p>
            <p className="text-[10px] leading-tight text-gray-500">Alertes fournisseur</p>
          </div>
          <div className="card !p-3 text-center">
            <p className={`text-xl font-bold ${live.providerBalanceGenerations !== null && live.providerBalanceGenerations < 20 ? 'text-red-600' : 'text-gray-700'}`}>
              {live.providerBalanceGenerations !== null ? live.providerBalanceGenerations : `$${live.providerBalanceUsd.toFixed(0)}`}
            </p>
            <p className="text-[10px] leading-tight text-gray-500">{live.providerBalanceGenerations !== null ? 'Générations MusicGPT restantes' : 'Solde MusicGPT (USD)'}</p>
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
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card text-center"><p className="text-3xl font-bold text-brand-600">{stats.totalUsers}</p><p className="text-sm text-gray-500">Utilisateurs</p></div>
            <div className="card text-center"><p className="text-3xl font-bold text-brand-600">{stats.totalGenerations}</p><p className="text-sm text-gray-500">Chansons générées</p></div>
            <div className="card text-center"><p className="text-3xl font-bold text-orange-500">{stats.pendingRequests}</p><p className="text-sm text-gray-500">Demandes en attente</p></div>
            <div className="card text-center"><p className="text-3xl font-bold text-green-600">{stats.totalRevenueFcfa.toLocaleString('fr-FR')} FCFA</p><p className="text-sm text-gray-500">Revenus validés</p></div>
          </div>

          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Solde fournisseur MusicGPT</h2>
                <p className="text-xs text-gray-500">MusicGPT n'expose aucune API de solde — estimation calculée à partir d'un dernier rechargement connu et du nombre réel de générations lancées depuis.</p>
              </div>
              <a href="https://musicgpt.com/api-dashboard" target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs flex-none">Renouveler chez MusicGPT ↗</a>
            </div>

            {providerBalance && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="p-3 rounded-xl bg-gray-50 text-center">
                  <p className="text-xl font-bold text-gray-800">${providerBalance.estimatedRemainingUsd.toFixed(2)}</p>
                  <p className="text-[11px] text-gray-500">Solde estimé</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 text-center">
                  <p className="text-xl font-bold text-gray-800">{providerBalance.estimatedRemainingGenerations ?? '—'}</p>
                  <p className="text-[11px] text-gray-500">Générations restantes (est.)</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 text-center">
                  <p className="text-xl font-bold text-gray-800">{providerBalance.consumedSinceTopUp}</p>
                  <p className="text-[11px] text-gray-500">Consommées depuis le rechargement</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 text-center">
                  <p className="text-xl font-bold text-gray-800">{providerBalance.toppedUpAt ? new Date(providerBalance.toppedUpAt).toLocaleDateString('fr-FR') : '—'}</p>
                  <p className="text-[11px] text-gray-500">Dernier rechargement</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 items-center border-t border-gray-100 pt-4">
              <label className="text-sm text-gray-500">Montant rechargé ($)
                <input type="number" min="0" step="0.01" value={topUpForm.topped_up_usd} onChange={e => setTopUpForm(f => ({ ...f, topped_up_usd: e.target.value }))} className="ml-2 w-28 border border-gray-300 rounded px-2 py-1.5" />
              </label>
              <label className="text-sm text-gray-500">Coût / génération ($)
                <input type="number" min="0" step="0.001" value={topUpForm.cost_per_generation_usd} onChange={e => setTopUpForm(f => ({ ...f, cost_per_generation_usd: e.target.value }))} className="ml-2 w-24 border border-gray-300 rounded px-2 py-1.5" />
              </label>
              <button disabled={savingTopUp || !topUpForm.topped_up_usd} onClick={handleSaveTopUp} className="btn-primary text-sm">Enregistrer le rechargement</button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">À faire après chaque recharge sur MusicGPT — le compteur de générations restantes se met ensuite à jour automatiquement à chaque nouvelle chanson lancée.</p>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div>
          <h2 className="text-lg font-bold mb-1 text-gray-800">Tunnel de conversion</h2>
          <p className="text-xs text-gray-400 mb-4">Visiteurs anonymes suivis depuis l'activation du suivi — les étapes suivantes couvrent tout l'historique.</p>
          {!analytics ? (
            <p className="text-gray-500">Chargement…</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card">
                <p className="text-2xl font-bold text-brand-600">{analytics.uniqueVisitors}</p>
                <p className="text-xs text-gray-500 mt-1">Visiteurs uniques ({analytics.periodDays}j)</p>
              </div>
              <div className="card">
                <p className="text-2xl font-bold text-brand-600">{analytics.totalPageviews}</p>
                <p className="text-xs text-gray-500 mt-1">Pages vues ({analytics.periodDays}j)</p>
              </div>
              <div className="card">
                <p className="text-2xl font-bold text-brand-600">{analytics.signupsInPeriod}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Inscriptions ({analytics.periodDays}j)
                  {analytics.signupRate !== null && <span className="block text-gray-400">{(analytics.signupRate * 100).toFixed(1)}% des visiteurs</span>}
                </p>
              </div>
              <div className="card">
                <p className="text-2xl font-bold text-brand-600">{analytics.totalUsers}</p>
                <p className="text-xs text-gray-500 mt-1">Utilisateurs au total</p>
              </div>
              <div className="card">
                <p className="text-2xl font-bold text-brand-600">{analytics.activatedUsers}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Utilisateurs activés (≥1 chanson terminée)
                  {analytics.activationRate !== null && <span className="block text-gray-400">{(analytics.activationRate * 100).toFixed(1)}% du total</span>}
                </p>
              </div>
              <div className="card">
                <p className="text-2xl font-bold text-brand-600">{analytics.payingUsers}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Utilisateurs payants
                  {analytics.conversionRate !== null && <span className="block text-gray-400">{(analytics.conversionRate * 100).toFixed(1)}% du total</span>}
                </p>
              </div>
            </div>
          )}

          {analytics && analytics.series.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold mb-2 text-gray-700">Évolution</h3>
              <AnalyticsChart data={analytics.series} />
            </div>
          )}

          {analytics && (
            <div className="mt-8">
              <h3 className="text-sm font-bold mb-1 text-gray-700">Partages ({analytics.periodDays}j)</h3>
              <p className="text-xs text-gray-400 mb-3">
                Clics sur les boutons de partage des pages chanson publiques — permet de vérifier si les messages
                personnalisés et le CTA augmentent réellement le partage, plutôt que de le supposer.
              </p>
              {analytics.totalShares === 0 ? (
                <p className="text-gray-500 text-sm">Aucun partage suivi sur la période.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="card">
                    <p className="text-2xl font-bold text-brand-600">{analytics.totalShares}</p>
                    <p className="text-xs text-gray-500 mt-1">Total partages</p>
                  </div>
                  {Object.entries(analytics.sharesByChannel).sort((a, b) => b[1] - a[1]).map(([channel, count]) => (
                    <div key={channel} className="card">
                      <p className="text-2xl font-bold text-brand-600">{count}</p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">{channel}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'automation' && (
        <div>
          <h3 className="text-sm font-bold mb-2 text-gray-700">Connexions externes</h3>
          <div className="card mb-6 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-800">Canva</span>
                {!canvaStatus?.configured ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">Non configuré</span>
                ) : canvaStatus.connected ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Connecté</span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Déconnecté</span>
                )}
              </div>
              {canvaStatus?.connected && (
                <p className="text-xs text-gray-500">
                  Dernier rafraîchissement : {canvaStatus.lastRefreshedAt ? new Date(canvaStatus.lastRefreshedAt).toLocaleString('fr-FR') : '—'}
                </p>
              )}
              {canvaStatus?.lastError && (
                <p className="text-xs text-red-500 mt-1">Erreur : {canvaStatus.lastError}</p>
              )}
              {!canvaStatus?.configured && (
                <p className="text-xs text-gray-400 mt-1">CANVA_CLIENT_ID / CANVA_CLIENT_SECRET manquants côté serveur.</p>
              )}
            </div>
            {canvaStatus?.configured && (
              <div className="flex gap-2 flex-none">
                <a href="/api/admin/canva/authorize" className="btn-secondary text-xs px-4 py-2">
                  {canvaStatus.connected ? 'Reconnecter Canva' : 'Connecter Canva'}
                </a>
                {canvaStatus.connected && (
                  <button disabled={canvaSyncing} onClick={() => handleCanvaSync(true)} className="btn-secondary text-xs px-4 py-2 disabled:opacity-50">
                    {canvaSyncing ? 'Analyse…' : 'Aperçu synchronisation'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="card mb-6 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-800">TikTok</span>
                {!tiktokStatus?.configured ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">Non configuré</span>
                ) : tiktokStatus.connected ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Connecté</span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Déconnecté</span>
                )}
              </div>
              {tiktokStatus?.connected && (
                <p className="text-xs text-gray-500">
                  Dernier rafraîchissement : {tiktokStatus.lastRefreshedAt ? new Date(tiktokStatus.lastRefreshedAt).toLocaleString('fr-FR') : '—'} · scopes : {tiktokStatus.scopes || '—'}
                </p>
              )}
              {tiktokStatus?.lastError && (
                <p className="text-xs text-red-500 mt-1">Erreur : {tiktokStatus.lastError}</p>
              )}
              {!tiktokStatus?.configured && (
                <p className="text-xs text-gray-400 mt-1">TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET manquants côté serveur.</p>
              )}
              {tiktokStatus?.configured && (
                <p className="text-xs text-amber-600 mt-1">
                  La publication directe (video.publish) ne fonctionne que si l'app a été auditée par TikTok — sinon les vidéos restent en brouillon privé (limite de la plateforme).
                </p>
              )}
            </div>
            {tiktokStatus?.configured && (
              <a href="/api/admin/tiktok/authorize" className="btn-secondary text-xs px-4 py-2 flex-none">
                {tiktokStatus.connected ? 'Reconnecter TikTok' : 'Connecter TikTok'}
              </a>
            )}
          </div>

          <div className="card mb-6 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-800">Meta (Facebook / Instagram)</span>
                {!metaStatus?.configured ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">Non configuré</span>
                ) : metaStatus.connected ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Connecté</span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Déconnecté</span>
                )}
              </div>
              {metaStatus?.connected && (
                <p className="text-xs text-gray-500">
                  Dernier rafraîchissement : {metaStatus.lastRefreshedAt ? new Date(metaStatus.lastRefreshedAt).toLocaleString('fr-FR') : '—'}
                </p>
              )}
              {metaStatus?.lastError && <p className="text-xs text-red-500 mt-1">Erreur : {metaStatus.lastError}</p>}
              {!metaStatus?.configured && (
                <p className="text-xs text-gray-400 mt-1">META_APP_ID / META_APP_SECRET manquants côté serveur.</p>
              )}
              {metaStatus?.configured && (
                <p className="text-xs text-amber-600 mt-1">
                  Un compte Instagram professionnel doit être lié à une Page Facebook pour être géré ici — c'est une exigence de Meta, pas de ce code.
                </p>
              )}
            </div>
            {metaStatus?.configured && (
              <a href="/api/admin/meta/authorize" className="btn-secondary text-xs px-4 py-2 flex-none">
                {metaStatus.connected ? 'Reconnecter Meta' : 'Connecter Meta'}
              </a>
            )}
          </div>

          <div className="card mb-6 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-800">YouTube</span>
                {!youtubeStatus?.configured ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">Non configuré</span>
                ) : youtubeStatus.connected ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Connecté</span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Déconnecté</span>
                )}
              </div>
              {youtubeStatus?.connected && (
                <p className="text-xs text-gray-500">
                  Dernier rafraîchissement : {youtubeStatus.lastRefreshedAt ? new Date(youtubeStatus.lastRefreshedAt).toLocaleString('fr-FR') : '—'}
                </p>
              )}
              {youtubeStatus?.lastError && <p className="text-xs text-red-500 mt-1">Erreur : {youtubeStatus.lastError}</p>}
              {!youtubeStatus?.configured && (
                <p className="text-xs text-gray-400 mt-1">YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET manquants côté serveur.</p>
              )}
            </div>
            {youtubeStatus?.configured && (
              <a href="/api/admin/youtube/authorize" className="btn-secondary text-xs px-4 py-2 flex-none">
                {youtubeStatus.connected ? 'Reconnecter YouTube' : 'Connecter YouTube'}
              </a>
            )}
          </div>

          {canvaSyncReport && (
            <div className="card mb-6">
              {canvaSyncReport.error ? (
                <p className="text-sm text-red-600">{canvaSyncReport.error}</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-800 mb-1">
                    {canvaSyncReport.dryRun ? 'Aperçu (aucune écriture)' : 'Synchronisation confirmée'} — dossier « {canvaSyncReport.rootFolder} »
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    {canvaSyncReport.foldersScanned} sous-dossiers · {canvaSyncReport.designsFound} designs trouvés
                  </p>
                  <div className="flex gap-4 text-xs mb-3">
                    <span className="text-green-700">{canvaSyncReport.toCreate} nouveaux</span>
                    <span className="text-brand-600">{canvaSyncReport.toUpdate} mis à jour</span>
                    <span className="text-gray-500">{canvaSyncReport.unchanged} inchangés</span>
                    {canvaSyncReport.manualCheck > 0 && (
                      <span className="text-amber-600">{canvaSyncReport.manualCheck} doublons potentiels à vérifier</span>
                    )}
                  </div>
                  {canvaSyncReport.manualCheck > 0 && (
                    <div className="mb-3 space-y-1">
                      {canvaSyncReport.items.filter(i => i.action === 'MANUAL_CHECK').map((i, idx) => (
                        <p key={idx} className="text-xs text-amber-700">⚠ « {i.title} » ({i.folderName}) — {i.reason}</p>
                      ))}
                    </div>
                  )}
                  {canvaSyncReport.dryRun && (canvaSyncReport.toCreate > 0 || canvaSyncReport.toUpdate > 0) && (
                    <button disabled={canvaSyncing} onClick={() => handleCanvaSync(false)} className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
                      {canvaSyncing ? 'Écriture…' : `Confirmer (écrire ${canvaSyncReport.toCreate + canvaSyncReport.toUpdate} entrées)`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <div className="card !p-4 mb-6">
            <h4 className="text-sm font-bold text-gray-800 mb-1">Générer un prompt pour l'IA de Canva</h4>
            <p className="text-xs text-gray-400 mb-3">
              Décris un angle (ex: "anniversaire", "diaspora"), colle le résultat dans l'IA de Canva — elle génère le visuel, sur la charte Melotones.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <input
                value={canvaPromptAngle} onChange={e => setCanvaPromptAngle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleGenerateCanvaPrompt(); }}
                placeholder="Angle marketing…" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                disabled={canvaPromptLoading || !canvaPromptAngle.trim()}
                onClick={handleGenerateCanvaPrompt}
                className="btn-primary text-sm px-4 disabled:opacity-50"
              >
                {canvaPromptLoading ? 'Génération…' : '✨ Générer'}
              </button>
            </div>
            {canvaPromptResult && (
              <div>
                <textarea
                  readOnly value={canvaPromptResult} rows={10}
                  className="w-full text-xs font-mono border border-gray-200 rounded-lg p-3 mb-2 bg-gray-50"
                />
                <button onClick={handleCopyCanvaPrompt} className="btn-secondary text-xs px-4 py-2">
                  {canvaPromptCopied ? '✓ Copié' : 'Copier le prompt'}
                </button>
              </div>
            )}
          </div>

          <div className="card !p-4 mb-6">
            <h4 className="text-sm font-bold text-gray-800 mb-1">Exporter les designs Canva vers le stockage Melotones</h4>
            <p className="text-xs text-gray-400 mb-3">
              Télécharge une copie de chaque design synchronisé dans le bucket Storage Melotones — rend la bibliothèque indépendante de l'abonnement Canva.
            </p>
            <button disabled={canvaExporting} onClick={handleExportCanvaAssets} className="btn-secondary text-sm px-4 py-2 disabled:opacity-50">
              {canvaExporting ? `Export en cours… (${canvaExportProgress?.done ?? 0}/${canvaExportProgress?.total ?? '?'})` : 'Exporter tous les designs'}
            </button>
            {!canvaExporting && canvaExportProgress && (
              <p className="text-xs text-gray-500 mt-2">{canvaExportProgress.done}/{canvaExportProgress.total} exportés.</p>
            )}
          </div>

          <button onClick={() => setAssetLibraryOpen(o => !o)} className="text-sm font-bold text-brand-600 hover:text-brand-700 mb-3">
            {assetLibraryOpen ? '▾' : '▸'} Bibliothèque de contenu Canva
          </button>
          {assetLibraryOpen && (
            <div className="mb-8">
              <p className="text-xs text-gray-400 mb-3">
                Le statut est une étiquette posée ici manuellement — aucune publication, export ou programmation réelle n'est déclenchée (aucun réseau social n'est connecté à ce jour).
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  value={assetSearch} onChange={e => setAssetSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') loadAssets(); }}
                  placeholder="Rechercher un titre…" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <select value={assetStatusFilter} onChange={e => setAssetStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="all">Tous les statuts</option>
                  {ASSET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={loadAssets} className="btn-secondary text-sm px-4">Filtrer</button>
              </div>
              {assetsLoading ? (
                <p className="text-sm text-gray-400">Chargement…</p>
              ) : assets.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun asset ne correspond.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {assets
                    .map(a => ({ asset: a, priority: getAssetPriority(a, !!tiktokStatus?.connected, !!youtubeStatus?.connected) }))
                    .sort((x, y) => x.priority.rank - y.priority.rank)
                    .map((item, idx) => {
                    const a = item.asset;
                    const priority = item.priority;
                    return (
                    <div key={a.id} className="card !p-2 relative">
                      <div className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full bg-gray-900/80 text-white text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 mb-2">
                        {a.thumbnail_url && <img src={a.thumbnail_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                      </div>
                      <p className="text-xs font-semibold text-gray-800 truncate" title={a.title}>{a.title}</p>
                      <p className="text-[10px] text-gray-400 truncate mb-1">{a.platform} · {a.canva_folder_name}</p>
                      <p className={`text-[10px] font-semibold rounded px-1.5 py-0.5 mb-1.5 ${PRIORITY_BADGE_CLASSES[priority.tone]}`}>{priority.label}</p>
                      {(a.status === 'DISCOVERED' || a.status === 'CLASSIFIED' || a.status === 'READY_FOR_REVIEW') ? (
                        <div className="flex gap-1 mb-1.5">
                          <button
                            disabled={assetBusyId === a.id}
                            onClick={() => handleAssetStatusChange(a.id, 'APPROVED')}
                            className="flex-1 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 rounded px-1.5 py-1 disabled:opacity-50"
                          >
                            ✓ Approuver
                          </button>
                          <button
                            disabled={assetBusyId === a.id}
                            onClick={() => handleAssetStatusChange(a.id, 'REJECTED')}
                            className="flex-1 text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 rounded px-1.5 py-1 disabled:opacity-50"
                          >
                            ✕ Annuler
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            a.status === 'APPROVED' ? 'bg-green-100 text-green-700'
                            : a.status === 'REJECTED' ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>{a.status}</span>
                          <button
                            disabled={assetBusyId === a.id}
                            onClick={() => handleAssetStatusChange(a.id, 'DISCOVERED')}
                            className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                          >
                            Revenir en attente
                          </button>
                        </div>
                      )}
                      <select
                        value={a.status} disabled={assetBusyId === a.id}
                        onChange={e => handleAssetStatusChange(a.id, e.target.value)}
                        className="w-full text-[10px] border border-gray-200 rounded px-1.5 py-1 mb-1.5"
                      >
                        {ASSET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {a.canva_edit_url && (
                        <a href={a.canva_edit_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-600 hover:underline block mb-1">Ouvrir dans Canva</a>
                      )}
                      <button
                        disabled={assetBusyId === a.id}
                        onClick={() => handleSuggestCaption(a.id)}
                        className="w-full text-[10px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded px-1.5 py-1 mb-1 disabled:opacity-50"
                      >
                        {assetBusyId === a.id ? 'Génération…' : (a.suggested_caption_fr ? '↻ Régénérer légende (IA)' : '✨ Générer légende (IA)')}
                      </button>
                      {a.suggested_caption_fr && (
                        <div className="text-[10px] bg-gray-50 border border-gray-100 rounded p-1.5 mb-1.5 space-y-1">
                          <p className="text-gray-700">{a.suggested_caption_fr}</p>
                          <p className="text-gray-400 italic">{a.suggested_caption_en}</p>
                          <p className="text-brand-600">{a.suggested_hashtags}</p>
                        </div>
                      )}
                      {a.status === 'APPROVED' && tiktokStatus?.connected && (
                        <button
                          disabled={assetBusyId === a.id}
                          onClick={() => handlePublishTiktok(a.id)}
                          className="w-full text-[10px] font-semibold text-white bg-gray-900 rounded px-1.5 py-1 mb-1 disabled:opacity-50"
                        >
                          {assetBusyId === a.id ? 'Envoi…' : 'Publier sur TikTok (brouillon)'}
                        </button>
                      )}
                      {a.status === 'APPROVED' && youtubeStatus?.connected && (
                        <button
                          disabled={assetBusyId === a.id}
                          onClick={() => handlePublishYoutube(a.id)}
                          className="w-full text-[10px] font-semibold text-white bg-red-600 rounded px-1.5 py-1 disabled:opacity-50"
                        >
                          {assetBusyId === a.id ? 'Envoi…' : 'Publier sur YouTube (privé)'}
                        </button>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <h2 className="text-lg font-bold mb-1 text-gray-800">Centre de contrôle — Agents autonomes</h2>
          <p className="text-xs text-gray-400 mb-4">
            Chaque agent tourne comme une routine cloud planifiée, indépendante de ce dashboard, et rapporte son résultat ici après chaque exécution.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {AUTOMATION_AGENTS.map(agent => {
              const lastRun = automationRuns.find(r => r.agent_slug === agent.slug);
              const statusColor = !lastRun ? 'bg-gray-100 text-gray-500'
                : lastRun.status === 'success' ? 'bg-green-100 text-green-700'
                : lastRun.status === 'alert' ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700';
              const statusLabel = !lastRun ? 'Jamais exécuté'
                : lastRun.status === 'success' ? 'OK'
                : lastRun.status === 'alert' ? 'Alerte'
                : 'Échec';
              return (
                <div key={agent.slug} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">{agent.name}</p>
                      <p className="text-xs text-gray-400">{agent.schedule}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${statusColor}`}>{statusLabel}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{agent.description}</p>
                  {lastRun && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                      <p>{new Date(lastRun.ran_at).toLocaleString('fr-FR')}</p>
                      {lastRun.summary && <p className="mt-1 text-gray-700">{lastRun.summary}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <h3 className="text-sm font-bold mb-1 text-gray-700">🧭 Espace de travail — donne une mission</h3>
          <p className="text-xs text-gray-400 mb-3">
            Écris un objectif en langage libre (ex : « Analyse pourquoi les visiteurs ne s'inscrivent pas suffisamment »). Elle devient une tâche priorisable ci-dessous — aucune exécution automatique n'est déclenchée.
          </p>
          <div className="card flex flex-col gap-2 mb-6">
            <textarea
              value={missionText} onChange={e => setMissionText(e.target.value)}
              placeholder="Ta mission…" rows={3} maxLength={1000}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
            />
            <button
              disabled={busyId === 'new-mission' || !missionText.trim()}
              onClick={handleSubmitMission}
              className="btn-primary text-sm px-4 self-end disabled:opacity-50"
            >
              {busyId === 'new-mission' ? 'Envoi…' : 'Envoyer à l\'équipe →'}
            </button>
          </div>

          <h3 className="text-sm font-bold mb-2 text-gray-700">
            Tâches humaines en attente {humanTasks.filter(t => t.status === 'pending').length > 0 && (
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{humanTasks.filter(t => t.status === 'pending').length}</span>
            )}
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Rappelées automatiquement chaque semaine dans le rapport de croissance par email. Les agents peuvent aussi en déposer une eux-mêmes quand ils détectent quelque chose qui a besoin de votre validation.
          </p>
          <div className="space-y-2 mb-4">
            {humanTasks.filter(t => t.status === 'pending').length === 0 && (
              <p className="text-gray-500 text-sm">Aucune tâche en attente.</p>
            )}
            {humanTasks.filter(t => t.status === 'pending').map(t => (
              <div key={t.id} className="card flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.title}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-1">{t.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {t.source === 'admin' ? 'Ajoutée manuellement' : t.source === 'mission' ? 'Mission déposée depuis l\'espace de travail' : `Déposée par ${t.source.replace('agent:', "l'agent ")}`}
                    {' · '}{new Date(t.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex gap-2 flex-none">
                  <button disabled={busyId === t.id} onClick={() => handleHumanTaskAction(t.id, 'done')} className="btn-secondary text-xs px-3 py-1">Fait</button>
                  <button disabled={busyId === t.id} onClick={() => handleHumanTaskAction(t.id, 'dismiss')} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Ignorer</button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mb-1">Ajout rapide (todo simple, sans passer par l'espace de travail) :</p>
          <div className="card flex flex-col sm:flex-row gap-2 mb-4">
            <input
              value={newTask.title} onChange={e => setNewTask(s => ({ ...s, title: e.target.value }))}
              placeholder="Nouvelle tâche…" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={newTask.description} onChange={e => setNewTask(s => ({ ...s, description: e.target.value }))}
              placeholder="Détail (optionnel)" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <button disabled={busyId === 'new-task' || !newTask.title.trim()} onClick={handleCreateHumanTask} className="btn-secondary text-sm px-4 disabled:opacity-50">Ajouter</button>
          </div>
          {humanTasks.filter(t => t.status !== 'pending').length > 0 && (
            <details className="mb-8">
              <summary className="text-xs text-gray-400 cursor-pointer mb-2">Tâches traitées ({humanTasks.filter(t => t.status !== 'pending').length})</summary>
              <div className="space-y-2">
                {humanTasks.filter(t => t.status !== 'pending').map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 text-sm border-b border-gray-100 py-2">
                    <div>
                      <span className={t.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-400 line-through'}>{t.title}</span>
                      <span className="ml-2 text-xs text-gray-400">{t.status === 'done' ? 'Fait' : 'Ignorée'}</span>
                    </div>
                    <div className="flex gap-2 flex-none">
                      <button disabled={busyId === t.id} onClick={() => handleHumanTaskAction(t.id, 'reopen')} className="text-xs text-brand-600 hover:text-brand-700">Rouvrir</button>
                      <button disabled={busyId === t.id} onClick={() => handleDeleteHumanTask(t.id)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          <h3 className="text-sm font-bold mb-2 text-gray-700">Historique des exécutions</h3>
          {automationRuns.length === 0 ? (
            <p className="text-gray-500">Aucune exécution enregistrée pour l'instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-4">Agent</th>
                    <th className="py-2 pr-4">Statut</th>
                    <th className="py-2 pr-4">Résumé</th>
                    <th className="py-2 pr-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {automationRuns.map(r => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4">{AUTOMATION_AGENTS.find(a => a.slug === r.agent_slug)?.name || r.agent_slug}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${r.status === 'success' ? 'bg-green-100 text-green-700' : r.status === 'alert' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {r.status === 'success' ? 'OK' : r.status === 'alert' ? 'Alerte' : 'Échec'}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{r.summary || '—'}</td>
                      <td className="py-2 pr-4 text-gray-400">{new Date(r.ran_at).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div>
          <h2 className="text-lg font-bold mb-4 text-gray-800">En attente ({pending.length})</h2>
          {pending.length === 0 ? <p className="text-gray-500 mb-8">Aucune demande en attente.</p> : (
            <div className="space-y-3 mb-8">
              {pending.map(r => {
                const isPayDunya = r.provider === 'paydunya';
                const confirmedPaid = r.provider_status === 'completed';
                return (
                <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{r.user_email || r.user_id}</p>
                    <p className="text-sm text-gray-600">{r.credits} chansons · {r.price_fcfa.toLocaleString('fr-FR')} FCFA · {r.payment_method}</p>
                    {isPayDunya && (
                      <p className={`text-xs font-semibold mt-0.5 ${confirmedPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                        PayDunya — statut fournisseur : {r.provider_status || 'en attente de notification'}
                        {confirmedPaid && ' (le webhook devrait le créditer automatiquement sous peu)'}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busyId === r.id} onClick={() => handleRequestAction(r.id, 'approve', isPayDunya && !confirmedPaid)} className="btn-primary text-sm">Approuver</button>
                    <button disabled={busyId === r.id} onClick={() => handleRequestAction(r.id, 'reject')} className="btn-secondary text-sm">Rejeter</button>
                  </div>
                </div>
              );})}
            </div>
          )}
          <h2 className="text-lg font-bold mb-4 text-gray-800">Historique</h2>
          <div className="space-y-2">
            {processed.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm text-gray-600 border-b border-gray-100 py-2">
                <span>{r.user_email || r.user_id} — {r.credits} chansons — {r.price_fcfa.toLocaleString('fr-FR')} FCFA</span>
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
          <div className="mb-3 flex items-center gap-3 text-xs">
            <span className="text-gray-500">{selectedUserIds.size} sélectionné(s)</span>
            <button
              disabled={bulkDeleting || selectedUserIds.size === 0}
              onClick={() => handleBulkDeleteUsers(Array.from(selectedUserIds))}
              className="text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed underline"
            >
              Supprimer la sélection
            </button>
            <button
              disabled={bulkDeleting || users.length === 0}
              onClick={() => handleBulkDeleteUsers(users.map(u => u.id))}
              className="text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed underline"
            >
              Tout supprimer
            </button>
          </div>
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedUserIds.size === users.length}
                    onChange={() => toggleAllUsers(users.map(u => u.id))}
                  />
                </th>
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
                  <td className="py-2 pr-4">
                    <input type="checkbox" checked={selectedUserIds.has(u.id)} onChange={() => toggleUserSelect(u.id)} />
                  </td>
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4 font-semibold">
                    {editingBalanceId === u.id ? (
                      <span className="flex items-center gap-1">
                        <input
                          type="number" min={0} autoFocus value={editBalanceValue}
                          onChange={e => setEditBalanceValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSetBalance(u.id); if (e.key === 'Escape') setEditingBalanceId(null); }}
                          className="w-16 border border-gray-300 rounded px-1 py-0.5 text-xs"
                        />
                        <button disabled={busyId === u.id} onClick={() => handleSetBalance(u.id)} className="text-xs text-brand-600 hover:text-brand-700">OK</button>
                        <button onClick={() => setEditingBalanceId(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </span>
                    ) : (
                      <button onClick={() => { setEditingBalanceId(u.id); setEditBalanceValue(String(u.balance)); }} className="hover:underline decoration-dotted" title="Modifier le solde">
                        {u.balance}
                      </button>
                    )}
                  </td>
                  <td className="py-2 pr-4">{u.generations_count}</td>
                  <td className="py-2 pr-4">
                    <button disabled={busyId === u.id} onClick={() => handleToggleAdmin(u.id, u.is_admin)} className={`text-xs px-2 py-1 rounded-full ${u.is_admin ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_admin ? 'Admin' : 'Utilisateur'}
                    </button>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="py-2 pr-4 flex gap-1 flex-wrap">
                    <button disabled={busyId === u.id} onClick={() => handleCreditAdjust(u.id, 1)} className="btn-secondary text-xs px-2 py-1">+1</button>
                    <button disabled={busyId === u.id} onClick={() => handleCreditAdjust(u.id, -1)} className="btn-secondary text-xs px-2 py-1">-1</button>
                    <button disabled={busyId === u.id} onClick={() => handleCreditAdjust(u.id, 5)} className="btn-secondary text-xs px-2 py-1">+5</button>
                    <button disabled={busyId === u.id} onClick={() => handleDeleteUser(u.id, u.email)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">Supprimer</button>
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
              <button key={s} onClick={() => { setGenFilter(s); setSelectedGenIds(new Set()); }} className={`text-xs px-3 py-1 rounded-full ${genFilter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
            ))}
          </div>
          <div className="mb-3 flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1 text-gray-500">
              <input
                type="checkbox"
                checked={generations.length > 0 && selectedGenIds.size === generations.length}
                onChange={() => toggleAllGens(generations.map(g => g.id))}
              />
              {selectedGenIds.size} sélectionné(s)
            </label>
            <button
              disabled={bulkDeleting || selectedGenIds.size === 0}
              onClick={() => handleBulkDeleteGenerations(Array.from(selectedGenIds))}
              className="text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed underline"
            >
              Supprimer la sélection
            </button>
            <button
              disabled={bulkDeleting || generations.length === 0}
              onClick={() => handleBulkDeleteGenerations(generations.map(g => g.id))}
              className="text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed underline"
            >
              Tout supprimer
            </button>
          </div>
          <div className="space-y-2">
            {generations.map(g => (
              <div key={g.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-2">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={selectedGenIds.has(g.id)} onChange={() => toggleGenSelect(g.id)} />
                  <div>
                    <p className="text-gray-800">{g.user_email} — {g.occasion} / {g.style}</p>
                    <p className="text-xs text-gray-400">{new Date(g.created_at).toLocaleString('fr-FR')}</p>
                  </div>
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
              <label className="text-sm text-gray-500">Chansons
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
                  <a href={`/api/admin/partners/${p.id}/report?format=csv`} className="btn-secondary text-xs">CSV</a>
                  <a href={`/api/admin/partners/${p.id}/report?format=pdf`} className="btn-secondary text-xs">PDF</a>
                  <button disabled={busyId === p.id} onClick={() => handleDeletePartner(p.id)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 bg-gray-50 rounded-xl p-3">
                <div>
                  <p className="text-xs text-gray-400">Ventes</p>
                  <p className="font-semibold text-gray-800">{p.totalSales}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Chiffre d'affaires</p>
                  <p className="font-semibold text-gray-800">{p.totalRevenueFcfa.toLocaleString('fr-FR')} FCFA</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Commission</p>
                  {editingCommissionId === p.id ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={100} autoFocus
                        value={editCommissionValue[p.id] ?? String(p.commission_percent)}
                        onChange={e => setEditCommissionValue(v => ({ ...v, [p.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateCommission(p.id); if (e.key === 'Escape') setEditingCommissionId(null); }}
                        className="w-14 border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                      <span className="text-xs text-gray-400">%</span>
                      <button disabled={busyId === p.id} onClick={() => handleUpdateCommission(p.id)} className="text-xs text-brand-600 hover:text-brand-700">OK</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => { setEditingCommissionId(p.id); setEditCommissionValue(v => ({ ...v, [p.id]: String(p.commission_percent) })); }}
                      className="font-semibold text-gray-800 hover:underline decoration-dotted"
                      title="Modifier le taux de commission"
                    >
                      {p.commission_percent}%
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400">Commission due</p>
                  <p className="font-semibold text-brand-700">{p.totalCommissionFcfa.toLocaleString('fr-FR')} FCFA</p>
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


      {tab === 'testimonials' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 mb-2">Avis soumis par de vrais utilisateurs après une chanson. Rien n'apparaît sur le site tant qu'un avis n'est pas approuvé ici — et même approuvé, il ne s'affiche publiquement que si l'auteur a coché le consentement.</p>
          {testimonials.length === 0 && <p className="text-gray-500">Aucun avis pour l'instant.</p>}
          {testimonials.map(tst => (
            <div key={tst.id} className="card">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 font-medium">{tst.user_email}</p>
                  <p className="text-amber-500 text-sm">{'★'.repeat(tst.rating)}{'☆'.repeat(5 - tst.rating)}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    tst.status === 'approved' ? 'bg-green-100 text-green-700' :
                    tst.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                  }`}>{tst.status === 'approved' ? 'Approuvé' : tst.status === 'rejected' ? 'Rejeté' : 'En attente'}</span>
                  {!tst.consent_public && <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600">Pas public</span>}
                  {tst.moderation_action && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      tst.moderation_action === 'HIDE_AND_ALERT_ADMIN' ? 'bg-red-100 text-red-700' :
                      tst.moderation_action === 'HUMAN_REVIEW' ? 'bg-orange-100 text-orange-700' :
                      tst.moderation_action === 'ALLOW' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>Modération: {tst.moderation_action}</span>
                  )}
                  {tst.moderation_severity && <span className="text-xs text-gray-500">Sévérité: {tst.moderation_severity}</span>}
                  {tst.moderation_confidence && <span className="text-xs text-gray-500">Confiance: {(tst.moderation_confidence * 100).toFixed(0)}%</span>}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2 break-words">{tst.message}</p>
              {tst.moderation_categories && tst.moderation_categories.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">Catégories: {tst.moderation_categories.join(', ')}</p>
              )}
              {tst.admin_notes && <p className="text-xs text-gray-500 mt-1 italic">Note admin: {tst.admin_notes}</p>}
              <p className="text-xs text-gray-400 mt-1">{new Date(tst.created_at).toLocaleString('fr-FR')}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                {tst.status !== 'approved' && (
                  <button disabled={busyId === tst.id} onClick={() => handleTestimonialAction(tst.id, 'approve')} className="btn-secondary text-xs px-3 py-1">Approuver</button>
                )}
                {tst.status !== 'rejected' && (
                  <button disabled={busyId === tst.id} onClick={() => handleTestimonialAction(tst.id, 'reject')} className="btn-secondary text-xs px-3 py-1">Rejeter</button>
                )}
                <button disabled={busyId === tst.id} onClick={() => handleTestimonialAction(tst.id, 'hide')} className="btn-secondary text-xs px-3 py-1">Masquer</button>
                <button disabled={busyId === tst.id} onClick={() => handleTestimonialAction(tst.id, 'restore')} className="btn-secondary text-xs px-3 py-1">Restaurer</button>
                <button disabled={busyId === tst.id} onClick={() => handleTestimonialAction(tst.id, 'mark_spam')} className="btn-secondary text-xs px-3 py-1">Spam</button>
                <button disabled={busyId === tst.id} onClick={() => handleTestimonialAction(tst.id, 'mark_abuse')} className="btn-secondary text-xs px-3 py-1">Abus</button>
                <button disabled={busyId === tst.id} onClick={() => handleDeleteTestimonial(tst.id)} className="text-xs text-red-400 hover:text-red-600 px-3 py-1">Supprimer</button>
              </div>
            </div>
          ))}
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

      {tab === 'credentials' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 mb-2">
            Vue d'ensemble de tous les identifiants de services tiers utilisés par Melotones. Les valeurs elles-mêmes
            ne sont jamais affichées ici — elles vivent uniquement dans les variables d'environnement Vercel. Cette
            liste sert à voir en un coup d'œil ce qui est configuré, connecté, ou en erreur.
          </p>
          {credentials.map(c => (
            <div key={c.key} className="card flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800">{c.label}</p>
                  {!c.configured ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Non configuré</span>
                  ) : c.kind === 'oauth' ? (
                    c.connected ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Connecté</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Déconnecté</span>
                    )
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Configuré</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 font-mono mt-1">{c.envVars.join(' · ')}</p>
                {c.kind === 'oauth' && c.connected && (
                  <p className="text-xs text-gray-400 mt-1">
                    Dernier rafraîchissement : {c.lastRefreshedAt ? new Date(c.lastRefreshedAt).toLocaleString('fr-FR') : '—'}
                    {c.expiresAt ? ` · expire : ${new Date(c.expiresAt).toLocaleString('fr-FR')}` : ''}
                  </p>
                )}
                {c.lastError && <p className="text-xs text-red-500 mt-1">Erreur : {c.lastError}</p>}
              </div>
              <a href={c.rotateUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs flex-none">
                Gérer / faire tourner →
              </a>
            </div>
          ))}
          {credentials.length === 0 && <p className="text-gray-500">Chargement…</p>}
        </div>
      )}
    </div>
  );
}
