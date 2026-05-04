'use client';

import { Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { languages, useI18n } from '@/lib/i18n';
import { MenuPageB } from './page_B';
import { WeeklyMenuPage } from '@/components/menu/WeeklyMenuPage';

type MenuMode = 'weekly' | 'permanent';

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, setLanguage, t } = useI18n();
  const mode = searchParams.get('menu') as MenuMode | null;

  const setMenuMode = (nextMode: MenuMode | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextMode) params.set('menu', nextMode);
    else params.delete('menu');

    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  };

  if (mode === 'weekly') return <WeeklyMenuPage onBackToHero={() => setMenuMode(null)} />;
  if (mode === 'permanent') return <MenuPageB onToggleVariant={() => setMenuMode(null)} />;

  return (
    <div className="min-h-screen flex flex-col items-center gap-8 p-6">
      {/* Theme toggle in top-right */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Logo + green wall strip */}
      <div className="flex flex-col items-center mt-6">
        <div className="relative w-48 h-48">
          <Image
            src="/images/logo_millewee_transp.png"
            alt="Caf\u00e9-Brasserie Millewee"
            fill
            sizes="192px"
            className="object-contain dark:brightness-0 dark:invert"
            priority
          />
        </div>
        <div className="w-full max-w-md h-8 -mt-2 rounded-lg overflow-hidden opacity-85">
          <Image
            src="/images/green-wall-1.PNG"
            alt=""
            width={800}
            height={20}
            className="w-full h-full object-cover"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Tagline */}
      <h1 className="font-display text-3xl font-bold text-primary text-center">
        Caf{'\u00e9'}-Brasserie Millewee
      </h1>
      <p className="text-muted-foreground text-center max-w-md">
        {t('landing.tagline')}
      </p>

      {/* A/B variant selector */}
      <div className="flex flex-col gap-3 w-full max-w-sm mt-4">
        <button
          onClick={() => setMenuMode('weekly')}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity text-center"
        >
          {t('landing.weeklyMenu')}
          <span className="block text-xs opacity-75 mt-0.5">{t('landing.weeklyMenuHint')}</span>
        </button>
        <button
          onClick={() => setMenuMode('permanent')}
          className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity text-center"
        >
          {t('landing.permanentMenu')}
          <span className="block text-xs opacity-75 mt-0.5">{t('landing.permanentMenuHint')}</span>
        </button>
      </div>

      <div className="flex items-center justify-center gap-2" aria-label="Choisir la langue">
        {languages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLanguage(lang.code)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border text-xl transition-colors ${
              language === lang.code
                ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
                : 'border-border bg-background hover:bg-muted'
            }`}
            aria-label={lang.name}
            title={lang.name}
          >
            {lang.flag}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        {t('landing.themeHint')}
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
