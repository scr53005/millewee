'use client';

import { useI18n } from '@/lib/i18n';
import { useCart } from '@/hooks/use-cart';
import { useMenuSpecials } from '@/hooks/use-menu';
import { type CartItemDish } from '@/lib/cart/types';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles } from 'lucide-react';
// import { toast } from 'sonner';

export function WeeklySpecialsBanner() {
  const { t, localized } = useI18n();
  const { addItem } = useCart();
  const { data: specials = [] } = useMenuSpecials();

  if (specials.length === 0) return null;

  const handleAdd = (special: (typeof specials)[0]) => {
    const dish = special.dish;
    const discount = dish.discount ?? 1.0;

    const item: CartItemDish = {
      type: 'dish',
      dishId: dish.dish_id,
      name_fr: dish.name_fr,
      name_en: dish.name_en,
      name_lb: dish.name_lb,
      basePrice: special.special_price ?? dish.price_eur,
      discount,
      allergenIcons: dish.allergens.map((a) => a.allergen.icon || '⚠'),
      imageUrl: dish.image_url,
    };

    addItem(item);
    // const name = localized(dish, 'name');
    // toast.success(`${name} — ${t('cart.add')}`);
  };

  return (
    <section className="px-3 pt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">
          {t('menu.specials')}
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {specials.map((special) => {
          const dish = special.dish;
          const name = localized(dish, 'name');
          const originalPrice = dish.price_eur;
          const specialPrice = special.special_price ?? originalPrice;
          const hasSpecialPrice = special.special_price != null && special.special_price < originalPrice;

          return (
            <div
              key={special.id}
              className="min-w-[200px] max-w-[240px] shrink-0 rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-1.5"
            >
              <div className="font-medium text-card-foreground text-sm">{name}</div>
              {special.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{special.description}</p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-primary">
                  {specialPrice.toFixed(2)} {'\u20ac'}
                </span>
                {hasSpecialPrice && (
                  <span className="text-xs text-muted-foreground line-through">
                    {originalPrice.toFixed(2)} {'\u20ac'}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={() => handleAdd(special)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('cart.add')}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
