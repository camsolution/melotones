import Link from 'next/link';

export const metadata = {
  title: 'Chanson personnalisée pour un anniversaire',
  description: "Surprenez un proche avec une chanson d'anniversaire unique, composée par IA à partir de votre message. Styles africains et internationaux, prête en quelques minutes.",
  alternates: { canonical: '/guide/chanson-anniversaire' },
};

export default function ChansonAnniversairePage() {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-10 md:py-14 prose prose-sm">
      <h1 className="font-display font-extrabold text-3xl text-gray-800 mb-4 not-prose">Chanson personnalisée pour un anniversaire</h1>

      <p className="text-gray-600">Un message d'anniversaire s'oublie vite. Une chanson, elle, se réécoute. Melotones transforme votre message — le prénom de la personne, un souvenir partagé, une blague récurrente — en une chanson complète, dans le style musical de votre choix.</p>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Idées de messages qui fonctionnent bien</h2>
      <ul className="text-gray-600 space-y-2">
        <li>Un souvenir précis partagé avec la personne (un voyage, une soirée, une habitude).</li>
        <li>Une qualité qui la caractérise, racontée avec humour ou tendresse.</li>
        <li>Un vœu simple et sincère pour l'année qui commence.</li>
      </ul>
      <p className="text-gray-600">Plus le message est personnel, plus la chanson sonne juste — inutile d'être un parolier, l'IA s'occupe de la mise en musique.</p>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Quel style pour quel anniversaire ?</h2>
      <p className="text-gray-600">Pour un ton léger et festif : <strong>Afrobeat</strong>, <strong>Amapiano</strong> ou <strong>Coupé-Décalé</strong>. Pour quelque chose de plus doux et personnel : <strong>Acoustic</strong> ou <strong>RnB</strong>. Pour un clin d'œil culturel : <strong>Zouglou</strong>, <strong>Highlife</strong> ou l'un des styles régionaux disponibles.</p>

      <div className="not-prose mt-10 rounded-2xl bg-gradient-to-r from-brand-600 via-magenta-500 to-amber-500 p-8 text-center">
        <p className="font-display font-bold text-xl text-white mb-4">Créez une chanson d'anniversaire en quelques minutes</p>
        <Link href="/signup" className="inline-block bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl shadow-lg">Créer un compte gratuit</Link>
      </div>
    </div>
  );
}
