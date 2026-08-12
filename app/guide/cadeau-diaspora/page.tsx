import Link from 'next/link';

export const metadata = {
  title: "Envoyer un cadeau musical à un proche resté au pays",
  description: "Pour la diaspora africaine : offrez à distance une chanson personnalisée par IA, dans un style musical africain, payable en Mobile Money. Livrée en quelques minutes.",
  alternates: { canonical: '/guide/cadeau-diaspora' },
};

export default function CadeauDiasporaPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-10 md:py-14 prose prose-sm">
      <h1 className="font-display font-extrabold text-3xl text-gray-800 mb-4 not-prose">Envoyer un cadeau musical à un proche resté au pays</h1>

      <p className="text-gray-600">Vivre loin de sa famille ne facilite pas les gestes du quotidien : un anniversaire manqué, un mariage auquel on ne peut pas assister, une pensée qu'on aimerait exprimer autrement qu'au téléphone. Melotones permet d'envoyer un cadeau différent — une chanson composée pour l'occasion, dans un style que le destinataire reconnaîtra comme sien.</p>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Pourquoi une chanson plutôt qu'un autre cadeau</h2>
      <ul className="text-gray-600 space-y-2">
        <li>Ça arrive instantanément, sans délai de livraison ni frais de transport.</li>
        <li>C'est un geste personnel, pas un objet générique.</li>
        <li>Le destinataire peut la réécouter, la partager avec la famille, la garder.</li>
      </ul>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Des styles qui parlent au pays</h2>
      <p className="text-gray-600">Afrobeat, Amapiano, Coupé-Décalé, Zouglou, Highlife, Kompa, musique nigériane, arabe... la sélection de styles couvre plusieurs régions d'Afrique et des Caraïbes, pour que la chanson sonne familière à celui ou celle qui la reçoit.</p>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Paiement adapté</h2>
      <p className="text-gray-600">Le paiement se fait par Mobile Money (Orange Money, Wave, Free Money...) ou carte bancaire, sans avoir besoin d'un compte bancaire local — utile pour payer depuis l'étranger tout en restant dans les moyens de paiement que le destinataire connaît.</p>

      <div className="not-prose mt-10 rounded-2xl bg-gradient-to-r from-brand-600 via-magenta-500 to-amber-500 p-8 text-center">
        <p className="font-display font-bold text-xl text-white mb-4">Offrez une chanson à distance dès aujourd'hui</p>
        <Link href="/signup" className="inline-block bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl shadow-lg">Créer un compte gratuit</Link>
      </div>
    </div>
  );
}
