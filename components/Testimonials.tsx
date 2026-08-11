'use client';
import { Star, Quote } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const testimonials = [
  { name: 'Aminata S.', role: 'Maman et passionnée de musique', text: 'J’ai offert une chanson pour l’anniversaire de ma fille. Toute la famille a pleuré de joie. IziMelo, c’est magique.', avatar: 'https://ui-avatars.com/api/?name=Aminata+S&background=7c3aed&color=fff' },
  { name: 'Koffi M.', role: 'DJ professionnel', text: 'La qualité des mélodies est bluffante. J’ai personnalisé un morceau pour un mariage, le rendu était digne d’un studio.', avatar: 'https://ui-avatars.com/api/?name=Koffi+M&background=db2777&color=fff' },
  { name: 'Inès B.', role: 'Étudiante', text: 'J’ai rédigé un message d’excuse en chanson. Inattendu, original, et ça a marché ! Merci IziMelo.', avatar: 'https://ui-avatars.com/api/?name=Ines+B&background=8b5cf6&color=fff' },
];

export default function Testimonials() {
  const { t } = useLanguage();
  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-800">{t('Ils ont osé, ils ont adoré', 'They dared, they loved it')}</h2>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">{t('Des milliers de personnes transforment leurs émotions en chansons. Découvrez leurs retours.', 'Thousands of people turn their emotions into songs. Discover their feedback.')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {testimonials.map((t, i) => (
          <div key={i} className="card hover:scale-[1.02] transition-transform duration-300">
            <Quote className="w-8 h-8 text-brand-200 mb-3" />
            <p className="text-gray-700 mb-4 italic">« {t.text} »</p>
            <div className="flex items-center gap-3 mt-auto">
              <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
              <div>
                <p className="font-semibold text-gray-800">{t.name}</p>
                <p className="text-sm text-gray-500">{t.role}</p>
              </div>
              <div className="ml-auto flex gap-1">
                {[...Array(5)].map((_, j) => (<Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
