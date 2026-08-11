'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'fr' | 'en';

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (fr: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'fr',
  setLang: () => {},
  t: (fr) => fr,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('fr');

  // Au chargement, si l'utilisateur est connecté, on récupère la langue
  // enregistrée sur son profil — c'est cette valeur qui fera foi pour la
  // langue des voix générées, pas un simple choix local éphémère.
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => { if (d.language === 'fr' || d.language === 'en') setLangState(d.language); })
      .catch(() => {});
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: l }),
    }).catch(() => {});
  };

  const t = (fr: string, en: string) => (lang === 'fr' ? fr : en);
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
