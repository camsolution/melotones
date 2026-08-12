export const metadata = {
  title: 'Politique de confidentialité',
  description: "Comment Melotones collecte, utilise et protège vos données personnelles.",
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-10 md:py-14">
      <h1 className="font-display font-extrabold text-3xl text-gray-800 mb-2">Politique de confidentialité</h1>
      <p className="text-sm text-gray-400 mb-8">Dernière mise à jour : août 2026</p>

      <div className="prose prose-sm max-w-none text-gray-600 space-y-6">
        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">1. Qui sommes-nous</h2>
          <p>Melotones est un service de génération de chansons personnalisées par intelligence artificielle, accessible sur melotones.co.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">2. Données que nous collectons</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Compte</strong> : adresse email, et si vous utilisez la connexion Google, votre nom et votre photo de profil Google.</li>
            <li><strong>Contenu généré</strong> : l'occasion, le style musical et le message que vous fournissez pour créer votre chanson, ainsi que le fichier audio et l'image de couverture générés.</li>
            <li><strong>Paiement</strong> : le montant, le moyen de paiement choisi et, selon le mode de paiement, une référence de transaction. Nous ne stockons jamais vos identifiants bancaires ou de mobile money — les paiements automatisés sont traités directement par notre prestataire de paiement (PayDunya), qui ne nous transmet que la confirmation de paiement.</li>
            <li><strong>Messagerie d'assistance</strong> : le contenu des conversations avec notre assistant ou notre équipe support.</li>
            <li><strong>Données techniques</strong> : cookies de session nécessaires à la connexion, et un signal de présence (dernière activité) pour les statistiques internes.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">3. Comment nous utilisons ces données</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Créer et gérer votre compte et vos chansons.</li>
            <li>Traiter vos achats de Chansons et vos demandes de remboursement.</li>
            <li>Répondre à vos demandes via notre messagerie d'assistance.</li>
            <li>Vous envoyer, si vous ne vous êtes pas désinscrit, des communications marketing occasionnelles (chaque email contient un lien de désinscription).</li>
            <li>Assurer la sécurité et le bon fonctionnement du service.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">4. Partage avec des tiers</h2>
          <p>Pour fonctionner, Melotones transmet certaines données à des prestataires techniques, uniquement dans la mesure nécessaire à leur rôle :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>MusicGPT</strong> : génération de la musique à partir de votre message (le contenu de votre message est transmis).</li>
            <li><strong>Google (Gemini)</strong> : génération assistée de suggestions de paroles, si vous utilisez cette fonctionnalité.</li>
            <li><strong>PayDunya</strong> : traitement des paiements Mobile Money et carte bancaire.</li>
            <li><strong>Supabase</strong> : hébergement de la base de données, authentification et stockage des fichiers.</li>
            <li><strong>Resend</strong> : envoi des emails transactionnels et marketing.</li>
            <li><strong>Cloudflare</strong> : vérification anti-robot (Turnstile) lors de la connexion.</li>
          </ul>
          <p>Nous ne vendons jamais vos données personnelles.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">5. Partage public de vos chansons</h2>
          <p>Vos chansons sont privées par défaut. Vous pouvez choisir de rendre une chanson publique (visible dans la section Explorer) — ce choix est toujours volontaire et réversible depuis la page de la chanson.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">6. Conservation et suppression</h2>
          <p>Vos données sont conservées tant que votre compte est actif. Vous pouvez demander la suppression de votre compte et de vos données en nous contactant à l'adresse ci-dessous.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">7. Sécurité</h2>
          <p>L'accès à vos données est protégé par authentification et des règles d'accès strictes au niveau de la base de données. Aucune méthode de transmission ou de stockage n'est totalement infaillible, mais nous mettons en œuvre des mesures raisonnables pour protéger vos informations.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">8. Vos droits</h2>
          <p>Vous pouvez à tout moment demander l'accès, la correction ou la suppression de vos données personnelles, ou vous désinscrire des emails marketing via le lien présent dans chaque email.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">9. Contact</h2>
          <p>Pour toute question relative à cette politique ou à vos données, contactez-nous à <a href="mailto:camsolutiontechnologies@gmail.com" className="text-brand-600 hover:underline">camsolutiontechnologies@gmail.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
