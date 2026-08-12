import Link from 'next/link';

export const metadata = {
  title: 'Chanson personnalisée pour une naissance ou un baptême',
  description: "Accueillez un bébé avec une chanson personnalisée composée par IA à partir de son prénom et de vos vœux. Un cadeau de naissance ou de baptême original, prêt en quelques minutes.",
  alternates: { canonical: '/guide/chanson-naissance' },
};

export default function ChansonNaissancePage() {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-10 md:py-14 prose prose-sm">
      <h1 className="font-display font-extrabold text-3xl text-gray-800 mb-4 not-prose">Chanson personnalisée pour une naissance ou un baptême</h1>

      <p className="text-gray-600">Une nouvelle naissance mérite plus qu'une carte. Melotones transforme le prénom du bébé, un vœu pour son avenir, ou un mot pour les parents, en une chanson complète — un souvenir qu'on garde bien après les félicitations d'usage.</p>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Idées de messages qui fonctionnent bien</h2>
      <ul className="text-gray-600 space-y-2">
        <li>Le prénom du bébé et ce qu'il signifie pour la famille.</li>
        <li>Un vœu simple pour sa vie à venir.</li>
        <li>Un mot de félicitations pour les parents, à écouter en famille.</li>
      </ul>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Quel style choisir</h2>
      <p className="text-gray-600">Pour un ton doux et chaleureux : <strong>Gospel</strong> ou <strong>Acoustic</strong>. Pour célébrer avec la famille au sens large : <strong>Afrobeat</strong> ou l'un des styles régionaux disponibles, plus festifs.</p>

      <div className="not-prose mt-10 rounded-2xl bg-gradient-to-r from-brand-600 via-magenta-500 to-amber-500 p-8 text-center">
        <p className="font-display font-bold text-xl text-white mb-4">Créez une chanson de naissance en quelques minutes</p>
        <Link href="/signup" className="inline-block bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl shadow-lg">Créer un compte gratuit</Link>
      </div>
    </div>
  );
}
