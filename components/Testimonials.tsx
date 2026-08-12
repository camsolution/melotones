'use client';
import { Star } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PublicTestimonial } from '@/lib/testimonials';

export default function Testimonials({ testimonials }: { testimonials: PublicTestimonial[] }) {
  const { t } = useLanguage();
  if (testimonials.length === 0) return null;

  return (
    <section className="py-12">
      <h2 className="font-display text-3xl font-bold mb-6 text-gray-800">{t('Ce que nos utilisateurs en disent', 'What our users say')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((tst) => (
          <div key={tst.id} className="card">
            <div className="flex gap-0.5 mb-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`w-4 h-4 ${n <= tst.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
              ))}
            </div>
            <p className="text-sm text-gray-600">« {tst.message} »</p>
          </div>
        ))}
      </div>
    </section>
  );
}
