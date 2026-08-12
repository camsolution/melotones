import Link from 'next/link';

export const metadata = {
  title: 'Chanson personnalisée pour un mariage',
  description: "Offrez aux mariés une chanson unique composée par IA, dans un style africain (Afrobeat, Zouk, Kompa...) ou international. Prête en quelques minutes.",
  alternates: { canonical: '/guide/chanson-mariage' },
};

export default function ChansonMariagePage() {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-10 md:py-14 prose prose-sm">
      <h1 className="font-display font-extrabold text-3xl text-gray-800 mb-4 not-prose">Chanson personnalisée pour un mariage</h1>

      <p className="text-gray-600">Un mariage est l'une des occasions où un cadeau musical fait le plus d'effet : les mariés se souviennent souvent davantage d'un geste personnel que d'un objet. Une chanson composée spécialement pour eux — avec leurs prénoms, leur histoire, une anecdote qui leur appartient — devient un souvenir qu'ils peuvent réécouter des années après.</p>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Comment ça fonctionne</h2>
      <ol className="text-gray-600 space-y-2">
        <li><strong>1. Choisissez l'occasion</strong> — « Mariage » dans le formulaire de création.</li>
        <li><strong>2. Choisissez un style musical</strong> — Zouk et Kompa pour une ambiance festive et romantique, Gospel pour une tonalité solennelle, Afrobeat ou Amapiano pour une célébration dansante, ou tout autre style parmi la sélection disponible.</li>
        <li><strong>3. Écrivez votre message</strong> — les prénoms des mariés, comment vous les avez rencontrés, un souvenir, ou simplement vos vœux de bonheur.</li>
        <li><strong>4. Recevez la chanson</strong> — générée en quelques minutes, prête à écouter, télécharger et partager.</li>
      </ol>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Quel style choisir pour un mariage ?</h2>
      <p className="text-gray-600">Il n'y a pas de règle absolue — le meilleur choix dépend des goûts des mariés et de l'ambiance de la cérémonie. Le <strong>Zouk</strong> et le <strong>Kompa</strong> conviennent bien à un moment romantique (ouverture de bal), l'<strong>Afrobeat</strong> et l'<strong>Amapiano</strong> à une réception festive, et le <strong>Gospel</strong> ou l'<strong>Acoustic</strong> à un ton plus intime. Tous les styles sont écoutables en exemple avant de vous décider.</p>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Pour les organisateurs d'événements</h2>
      <p className="text-gray-600">Si vous organisez des mariages professionnellement (wedding planner, salle de fête, DJ), Melotones propose un programme partenaire avec code de réduction dédié. <Link href="/login" className="text-brand-600 hover:underline">Contactez-nous</Link> pour en discuter.</p>

      <div className="not-prose mt-10 rounded-2xl bg-gradient-to-r from-brand-600 via-magenta-500 to-amber-500 p-8 text-center">
        <p className="font-display font-bold text-xl text-white mb-4">Composez la chanson des mariés dès maintenant</p>
        <Link href="/signup" className="inline-block bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl shadow-lg">Créer un compte gratuit</Link>
      </div>
    </div>
  );
}
