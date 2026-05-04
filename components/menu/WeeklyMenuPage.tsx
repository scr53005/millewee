'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useCart } from '@/hooks/use-cart';
import { useMenuSpecials } from '@/hooks/use-menu';
import { type CartItemDish } from '@/lib/cart/types';
import { MenuHeader } from './MenuHeader';
import { DrinksSection } from './DrinksSection';
import { FloatingCartButton } from './FloatingCartButton';
import { CartSheet } from './CartSheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Sparkles, UtensilsCrossed, Wine } from 'lucide-react';

type WeeklyTab = 'specials' | 'drinks';

interface WeeklyMenuPageProps {
  onBackToHero?: () => void;
}

export function WeeklyMenuPage({ onBackToHero }: WeeklyMenuPageProps) {
  const [cartOpen, setCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WeeklyTab>('specials');
  const { t, localized } = useI18n();
  const { addItem } = useCart();
  const { data: specials = [], isLoading, isError } = useMenuSpecials();

  const handleAdd = (special: (typeof specials)[0]) => {
    const dish = special.dish;
    const item: CartItemDish = {
      type: 'dish',
      dishId: dish.dish_id,
      name_fr: dish.name_fr,
      name_en: dish.name_en,
      name_lb: dish.name_lb,
      basePrice: special.special_price ?? dish.price_eur,
      discount: dish.discount ?? 1.0,
      allergenIcons: dish.allergens.map((a) => a.allergen.icon || '\u26a0'),
      imageUrl: dish.image_url,
    };

    addItem(item);
  };

  return (
    <div className="min-h-screen bg-background">
      <MenuHeader onCartOpen={() => setCartOpen(true)} onLogoClick={onBackToHero} />

      <div className="sticky top-[57px] z-25 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex max-w-4xl mx-auto">
          <button
            onClick={() => setActiveTab('specials')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-base font-bold transition-colors ${
              activeTab === 'specials'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <UtensilsCrossed className="h-5 w-5" />
            {t('menu.specials')}
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
        {activeTab === 'drinks' ? (
          <DrinksSection />
        ) : (
          <section className="px-3 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-bold text-foreground">
                {t('menu.specials')}
              </h2>
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground py-8">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('misc.loading')}
              </div>
            )}

            {isError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-4 text-sm text-destructive">
                {t('misc.error')}
              </div>
            )}

            {!isLoading && !isError && specials.length === 0 && (
              <div className="rounded-lg border border-border bg-card px-3 py-8 text-center text-muted-foreground">
                {t('menu.noWeeklySpecials')}
              </div>
            )}

            {!isLoading && !isError && specials.length > 0 && (
              <div className="space-y-3">
                {specials.map((special) => {
                  const dish = special.dish;
                  const name = localized(dish, 'name');
                  const description = special.description || localized(dish, 'description');
                  const originalPrice = dish.price_eur;
                  const specialPrice = special.special_price ?? originalPrice;
                  const hasSpecialPrice =
                    special.special_price != null && special.special_price < originalPrice;

                  return (
                    <article
                      key={special.id}
                      className="rounded-lg border border-primary/25 bg-card newspaper-texture p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-card-foreground">{name}</h3>
                            <Badge className="bg-primary text-primary-foreground">
                              {t('badge.special')}
                            </Badge>
                          </div>
                          {description && (
                            <p className="text-sm text-muted-foreground mt-1">{description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-primary">
                            {specialPrice.toFixed(2)} {'\u20ac'}
                          </div>
                          {hasSpecialPrice && (
                            <div className="text-xs text-muted-foreground line-through">
                              {originalPrice.toFixed(2)} {'\u20ac'}
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleAdd(special)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('cart.add')}
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      <FloatingCartButton onClick={() => setCartOpen(true)} />
      <CartSheet open={cartOpen} onOpenChange={(open) => setCartOpen(open)} />
    </div>
  );
}

