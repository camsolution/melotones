export const metadata = {
  title: "Conditions d'utilisation",
  description: 'Les conditions générales d\'utilisation du service Melotones.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-10 md:py-14">
      <h1 className="font-display font-extrabold text-3xl text-gray-800 mb-2">Conditions d'utilisation</h1>
      <p className="text-sm text-gray-400 mb-8">Dernière mise à jour : août 2026</p>

      <div className="prose prose-sm max-w-none text-gray-600 space-y-6">
        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">1. Objet</h2>
          <p>Melotones (melotones.co) est un service en ligne permettant de créer des chansons personnalisées grâce à l'intelligence artificielle, pour des occasions telles qu'anniversaires, mariages, remerciements ou tout autre événement. En utilisant Melotones, vous acceptez les présentes conditions.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">2. Compte utilisateur</h2>
          <p>La création d'un compte (par email ou via Google) est nécessaire pour générer des chansons. Vous êtes responsable de la confidentialité de vos identifiants et de toute activité effectuée depuis votre compte.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">3. Chansons et paiement</h2>
          <p>La génération d'un titre consomme une "Chanson", achetée via nos offres disponibles dans le menu Chansons. Les prix sont indiqués en FCFA avant tout paiement. Les paiements automatisés sont traités par notre prestataire PayDunya ; les paiements manuels (Wave, Orange Money, virement) sont validés par notre équipe après vérification.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">4. Remboursements</h2>
          <p>En cas d'échec technique avéré de la génération (panne confirmée du fournisseur de génération musicale), votre Chanson vous est remboursée automatiquement. En cas de doute (génération anormalement longue sans réponse claire), une demande de remboursement est soumise à l'approbation de notre équipe.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">5. Contenu généré</h2>
          <p>Vous restez propriétaire du contenu (occasion, message, prénoms) que vous fournissez. Les chansons générées vous sont destinées à un usage personnel ; vous pouvez les télécharger, les partager, et choisir de les rendre publiques sur la page Explorer. Melotones ne garantit pas un résultat identique à chaque génération : le contenu produit par l'intelligence artificielle peut varier.</p>
          <p>Le régime juridique du contenu généré par intelligence artificielle n'est pas encore fixé, ni en droit sénégalais ni dans les textes de l'Organisation Africaine de la Propriété Intellectuelle (OAPI) dont le Sénégal est membre. Melotones ne garantit donc pas que les chansons générées bénéficient d'une protection par le droit d'auteur, et ne fait aucune déclaration quant à la titularité d'éventuels droits sur l'enregistrement audio produit.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">6. Utilisation acceptable</h2>
          <p>Vous vous engagez à ne pas utiliser Melotones pour produire du contenu illégal, haineux, diffamatoire, ou portant atteinte aux droits d'un tiers. Nous nous réservons le droit de suspendre tout compte utilisé de façon abusive.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">7. Limitation de responsabilité</h2>
          <p>Melotones s'appuie sur des services tiers d'intelligence artificielle pour générer les chansons. Nous ne pouvons garantir une disponibilité continue du service ni l'exactitude parfaite du contenu généré. Le service est fourni "en l'état", sans garantie autre que celles prévues par la loi applicable.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">8. Résiliation</h2>
          <p>Vous pouvez cesser d'utiliser Melotones et demander la suppression de votre compte à tout moment. Nous pouvons suspendre ou résilier un compte en cas de violation de ces conditions.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">9. Modifications</h2>
          <p>Ces conditions peuvent être mises à jour. Les modifications importantes vous seront communiquées via le service ou par email.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg text-gray-800 mb-2">10. Contact</h2>
          <p>Pour toute question, contactez-nous à <a href="mailto:camsolutiontechnologies@gmail.com" className="text-brand-600 hover:underline">camsolutiontechnologies@gmail.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
