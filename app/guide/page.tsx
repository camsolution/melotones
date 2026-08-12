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

const faqs = [
  { q: 'Combien coûte une chanson personnalisée ?', a: "À partir de 1 200 FCFA pour une chanson (pack Découverte). Le prix baisse par pack : 950 FCFA/chanson avec le pack Populaire (4 chansons), 944 FCFA/chanson avec le pack Créateur (9 chansons)." },
  { q: 'Combien de temps faut-il pour recevoir sa chanson ?', a: "En général entre 30 et 90 secondes après validation du message, selon le style musical choisi." },
  { q: 'Quels styles musicaux sont disponibles ?', a: "16 styles africains et internationaux : Afrobeat, Amapiano, Zouk, Gospel, Coupé-Décalé, Zouglou, Highlife et d'autres." },
  { q: 'Comment payer sur Melotones ?', a: "Par Mobile Money ou carte bancaire, via PayDunya, pour le Sénégal." },
  { q: 'Mon message personnel reste-t-il privé ?', a: "Oui. Même si vous partagez votre chanson ou l'affichez publiquement sur la page Explorer, votre message personnel n'est jamais rendu public — seuls l'occasion, le style et l'audio sont montrés." },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function GuideIndexPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-10 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <h1 className="font-display font-extrabold text-3xl text-gray-800 mb-3">Idées de chansons personnalisées</h1>
      <p className="text-gray-600 mb-8">Des guides pratiques pour savoir quand et comment offrir une chanson composée par IA, selon l'occasion.</p>
      <div className="space-y-4 mb-12">
        {guides.map((g) => (
          <Link key={g.href} href={g.href} className="block rounded-2xl border border-gray-200 bg-white p-6 hover:border-brand-300 transition-colors">
            <h2 className="font-display font-bold text-lg text-gray-800 mb-1">{g.title}</h2>
            <p className="text-sm text-gray-500">{g.desc}</p>
          </Link>
        ))}
      </div>

      <h2 className="font-display font-bold text-2xl text-gray-800 mb-4">Questions fréquentes</h2>
      <div className="space-y-4">
        {faqs.map((f) => (
          <details key={f.q} className="rounded-2xl border border-gray-200 bg-white p-5 group">
            <summary className="font-display font-semibold text-gray-800 cursor-pointer list-none flex items-center justify-between">
              {f.q}
              <span className="text-gray-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
            </summary>
            <p className="text-sm text-gray-500 mt-3">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
