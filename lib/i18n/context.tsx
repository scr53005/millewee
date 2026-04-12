'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { translations, languages, type Language, type TranslationKey } from './translations';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  /** Returns the localized value of a DB row field, e.g. localized(dish, 'name') reads dish.name_fr / name_en / name_lb */
  localized: (row: object, field: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'millewee_lang';

function detectLanguage(): Language {
  // 1. localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && languages.some((l) => l.code === stored)) {
      return stored as Language;
    }
  }
  // 2. Browser language
  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language.split('-')[0] as Language;
    if (languages.some((l) => l.code === browserLang)) {
      return browserLang;
    }
  }
  // 3. Default
  return 'fr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLanguageState(detectLanguage());
    setMounted(true);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language][key] || translations.fr[key] || key;
    },
    [language],
  );

  const localized = useCallback(
    (row: object, field: string): string => {
      const r = row as Record<string, unknown>;
      // Try current language first, then FR fallback
      return (r[`${field}_${language}`] as string) || (r[`${field}_fr`] as string) || '';
    },
    [language],
  );

  // Avoid hydration mismatch — render with 'fr' on server, detect on client
  if (!mounted) {
    return (
      <I18nContext.Provider value={{ language: 'fr', setLanguage, t, localized }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, localized }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
