'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useI18n } from '@/lib/i18n';
import { MenuPageA } from './page_A';
import { MenuPageB } from './page_B';

type Variant = null | 'A' | 'B';

export default function Home() {
  const [variant, setVariant] = useState<Variant>(null);
  const { t } = useI18n();

  const toggleVariant = () => setVariant((v) => (v === 'A' ? 'B' : 'A'));

  if (variant === 'A') return <MenuPageA onToggleVariant={toggleVariant} />;
  if (variant === 'B') return <MenuPageB onToggleVariant={toggleVariant} />;

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
          onClick={() => setVariant('A')}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity text-center"
        >
          {t('landing.variantA')}
          <span className="block text-xs opacity-75 mt-0.5">{t('landing.variantAHint')}</span>
        </button>
        <button
          onClick={() => setVariant('B')}
          className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity text-center"
        >
          {t('landing.variantB')}
          <span className="block text-xs opacity-75 mt-0.5">{t('landing.variantBHint')}</span>
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        {t('landing.themeHint')}
      </p>
    </div>
  );
}
