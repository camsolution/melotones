import { GoogleGenerativeAI } from '@google/generative-ai';
import { computeAnalytics } from '@/lib/analytics';
import { computeProviderBalanceEstimate } from '@/lib/providerBalance';
import { computeAgentReport } from '@/lib/agentReport';

// L'admin dépose une mission en langage libre dans l'espace de travail et
// attend une vraie réponse (pas juste une tâche silencieuse) — cette
// fonction construit le contexte réel du produit (mêmes données que le
// rapport agent PDF) et demande à Gemini une réponse ancrée dedans.
//
// Volontairement PAS un exécuteur d'actions : l'agent ne publie rien,
// ne dépense rien, ne modifie aucune donnée sensible tout seul — cohérent
// avec le reste du projet (aucune publication/paiement automatique sans
// validation humaine). Si la mission demande une action réelle, la
// consigne explicite lui demande de la décrire plutôt que de prétendre
// l'avoir faite.
export async function answerMission(missionText: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const [analytics, providerBalance, report] = await Promise.all([
    computeAnalytics().catch(() => null),
    computeProviderBalanceEstimate().catch(() => null),
    computeAgentReport().catch(() => null),
  ]);

  const context = {
    analytics: analytics ? {
      visiteursUniques30j: analytics.uniqueVisitors,
      inscriptions30j: analytics.signupsInPeriod,
      tauxInscription: analytics.signupRate,
      utilisateursTotal: analytics.totalUsers,
      utilisateursActives: analytics.activatedUsers,
      tauxActivation: analytics.activationRate,
      payants: analytics.payingUsers,
      tauxConversion: analytics.conversionRate,
    } : null,
    soldeFournisseurMusicGPT: providerBalance ? {
      estimeUsd: providerBalance.estimatedRemainingUsd,
      generationsRestantesEstimees: providerBalance.estimatedRemainingGenerations,
    } : null,
    pipelineCreatifCanva: report?.pipelineCounts ?? null,
    tachesEnAttente: report?.pendingTasks.map((t) => t.title) ?? null,
    performanceReseauxSociaux: report ? {
      publicationsSuivies: report.social.rows.length,
      publicationsAvecStats: report.social.withStats.length,
      analyseExistante: report.social.strategyNote,
    } : null,
  };

  // Modèle différent des autres fonctionnalités IA du projet (toutes sur
  // gemini-3.6-flash) — le quota gratuit Gemini (20 req/jour) est compté par
  // modèle, pas partagé au niveau du projet (confirmé en direct le
  // 2026-08-16 : gemini-3.1-flash-lite répond alors que gemini-3.6-flash est
  // à sec). Isole l'agent de mission du quota déjà tendu du reste de l'app,
  // sans avoir besoin d'activer la facturation. À retirer si un jour la
  // facturation est confirmée active — un seul modèle partagé sera plus simple.
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

  const prompt = `Tu es l'agent opérationnel de Melotones (plateforme de chansons personnalisées par IA pour la diaspora africaine). L'admin te confie une mission en langage libre et attend une vraie réponse.

Données réelles actuelles du produit (utilise-les, n'invente jamais un chiffre qui n'y figure pas — si une donnée nécessaire manque, dis-le clairement) :
${JSON.stringify(context, null, 2)}

Mission de l'admin : "${missionText}"

Consignes :
- Réponds en français, de façon directe et actionnable (pas de blabla générique).
- Base-toi UNIQUEMENT sur les données fournies ci-dessus pour toute analyse ou chiffre.
- Tu ne peux exécuter aucune action réelle toi-même (publier, envoyer un email à un utilisateur, dépenser de l'argent, modifier une donnée sensible) — si la mission en demande une, explique clairement ce qu'il faudrait faire et où (quel onglet du dashboard, quelle action), sans jamais prétendre l'avoir déjà fait.
- Si les données fournies ne permettent pas de répondre complètement, dis-le honnêtement plutôt que de deviner.
- 150 mots maximum.`;

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 25_000)),
    ]);
    return result.response.text().trim();
  } catch (err) {
    console.error('answerMission failed:', err);
    return null;
  }
}
