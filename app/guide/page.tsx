import Link from 'next/link';

export const metadata = {
  title: 'Idées de chansons personnalisées par occasion',
  description: "Guides pour offrir une chanson personnalisée par IA : mariage, anniversaire, ou cadeau musical à distance pour la diaspora.",
  alternates: { canonical: '/guide' },
};

const guides = [
  { href: '/guide/chanson-mariage', title: 'Chanson personnalisée pour un mariage', desc: "Comment composer le morceau parfait pour des mariés, dans un style africain ou international." },
  { href: '/guide/chanson-anniversaire', title: 'Chanson personnalisée pour un anniversaire', desc: "Surprendre un proche avec une chanson d'anniversaire unique, écrite pour lui." },
  { href: '/guide/cadeau-diaspora', title: 'Envoyer un cadeau musical depuis l\'étranger', desc: "Pour la diaspora africaine : offrir un cadeau émotionnellement fort à un proche resté au pays, en quelques minutes." },
  { href: '/guide/chanson-hommage', title: 'Chanson hommage personnalisée', desc: "Rendre hommage à un être cher avec une chanson composée à partir de vos souvenirs, dans un style sincère." },
  { href: '/guide/chanson-naissance', title: 'Chanson pour une naissance ou un baptême', desc: "Accueillir un bébé avec une chanson composée à partir de son prénom et de vos vœux." },
  { href: '/guide/chanson-remerciement', title: 'Chanson pour dire merci', desc: "Transformer votre reconnaissance envers quelqu'un en une chanson qui prend le temps d'exister." },
];

export default function GuideIndexPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-10 md:py-14">
      <h1 className="font-display font-extrabold text-3xl text-gray-800 mb-3">Idées de chansons personnalisées</h1>
      <p className="text-gray-600 mb-8">Des guides pratiques pour savoir quand et comment offrir une chanson composée par IA, selon l'occasion.</p>
      <div className="space-y-4">
        {guides.map((g) => (
          <Link key={g.href} href={g.href} className="block rounded-2xl border border-gray-200 bg-white p-6 hover:border-brand-300 transition-colors">
            <h2 className="font-display font-bold text-lg text-gray-800 mb-1">{g.title}</h2>
            <p className="text-sm text-gray-500">{g.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
