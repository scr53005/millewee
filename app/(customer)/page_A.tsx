'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { WeeklySpecialsBanner } from '@/components/menu/WeeklySpecialsBanner';
import { DishesSection } from '@/components/menu/DishesSection';
import { DrinksSection } from '@/components/menu/DrinksSection';
import { FloatingCartButton } from '@/components/menu/FloatingCartButton';
import { CartSheet } from '@/components/menu/CartSheet';
import { UtensilsCrossed, Wine } from 'lucide-react';

type MenuTab = 'dishes' | 'drinks';

export function MenuPageA() {
  const [cartOpen, setCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MenuTab>('dishes');
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <MenuHeader onCartOpen={() => setCartOpen(true)} />

      {/* Dishes / Drinks toggle */}
      <div className="sticky top-[57px] z-25 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex max-w-4xl mx-auto">
          <button
            onClick={() => setActiveTab('dishes')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-base font-bold transition-colors ${
              activeTab === 'dishes'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <UtensilsCrossed className="h-5 w-5" />
            {t('nav.dishes')}
          </button>
          <button
            onClick={() => setActiveTab('drinks')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-base font-bold transition-colors ${
              activeTab === 'drinks'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wine className="h-5 w-5" />
            {t('nav.drinks')}
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto pb-20">
        <WeeklySpecialsBanner />
        {activeTab === 'dishes' ? <DishesSection /> : <DrinksSection />}
      </main>
      <FloatingCartButton onClick={() => setCartOpen(true)} />
      <CartSheet open={cartOpen} onOpenChange={(open) => setCartOpen(open)} />
    </div>
  );
}
