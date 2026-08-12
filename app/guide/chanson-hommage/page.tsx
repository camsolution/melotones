import Link from 'next/link';

export const metadata = {
  title: 'Chanson hommage personnalisée',
  description: "Rendez hommage à un être cher avec une chanson personnalisée composée par IA à partir de vos souvenirs et de votre message. Un geste sincère, dans le style musical de votre choix.",
  alternates: { canonical: '/guide/chanson-hommage' },
};

export default function ChansonHommagePage() {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-10 md:py-14 prose prose-sm">
      <h1 className="font-display font-extrabold text-3xl text-gray-800 mb-4 not-prose">Chanson hommage personnalisée</h1>

      <p className="text-gray-600">Certains hommages méritent plus que des mots. Melotones transforme un souvenir, une qualité qui vous marque, ou simplement ce que vous auriez voulu dire, en une chanson complète — un objet qu'on peut réécouter, partager en famille, garder.</p>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Pour quelles occasions</h2>
      <ul className="text-gray-600 space-y-2">
        <li>Un hommage lors d'une cérémonie ou d'un anniversaire de mémoire.</li>
        <li>Un souvenir à partager en famille, à son propre rythme.</li>
        <li>Une reconnaissance envers quelqu'un qui compte, tant qu'il est encore temps de le lui dire.</li>
      </ul>

      <h2 className="font-display font-bold text-xl text-gray-800 mt-8 mb-3">Écrire le message</h2>
      <p className="text-gray-600">Il n'y a pas de bonne façon de faire — un prénom, un souvenir précis, une phrase que la personne disait souvent, suffisent à donner à l'IA la matière pour composer une chanson qui sonne juste. Les styles <strong>Gospel</strong>, <strong>Acoustic</strong> ou <strong>RnB</strong> se prêtent bien à un ton posé et sincère ; un style plus festif convient aussi pour célébrer une vie plutôt que la pleurer.</p>

      <div className="not-prose mt-10 rounded-2xl bg-gradient-to-r from-brand-600 via-magenta-500 to-amber-500 p-8 text-center">
        <p className="font-display font-bold text-xl text-white mb-4">Créez une chanson hommage en quelques minutes</p>
        <Link href="/signup" className="inline-block bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl shadow-lg">Créer un compte gratuit</Link>
      </div>
    </div>
  );
}
