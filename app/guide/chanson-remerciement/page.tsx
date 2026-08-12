import Link from 'next/link';

export const metadata = {
  title: 'Chanson personnalisée pour dire merci',
  description: "Dites merci autrement avec une chanson personnalisée composée par IA. Pour un collègue, un mentor, un proche qui vous a marqué — un remerciement qui se réécoute.",
  alternates: { canonical: '/guide/chanson-remerciement' },
};

export default function ChansonRemerciementPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-10 md:py-14 prose prose-sm">
      <h1 className="font-display font-extrabold text-3xl text-gray-800 mb-4 not-prose">Chanson personnalisée pour dire merci</h1>

      <p className="text-gray-600">« Merci » se dit en une seconde et s'oublie presque aussi vite. Melotones transforme votre reconnaissance — pour un geste, un soutien, une présence — en une chanson complète, un remerciement qui prend le temps d'exister.</p>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Pour qui</h2>
      <ul className="text-gray-600 space-y-2">
        <li>Un collègue ou un mentor qui vous a aidé à un moment clé.</li>
        <li>Un proche présent dans une période difficile.</li>
        <li>Quelqu'un que vous n'avez jamais vraiment remercié comme il fallait.</li>
      </ul>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Écrire le message</h2>
      <p className="text-gray-600">Soyez précis : ce que la personne a fait, ce que ça a changé pour vous. Un style <strong>RnB</strong> ou <strong>Acoustic</strong> pour un ton sincère, ou quelque chose de plus entraînant comme <strong>Afrobeat</strong> si la relation est plus légère.</p>

      <div className="not-prose mt-10 rounded-2xl bg-gradient-to-r from-brand-600 via-magenta-500 to-amber-500 p-8 text-center">
        <p className="font-display font-bold text-xl text-white mb-4">Créez une chanson de remerciement en quelques minutes</p>
        <Link href="/signup" className="inline-block bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl shadow-lg">Créer un compte gratuit</Link>
      </div>
    </div>
  );
}
