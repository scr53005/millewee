'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';
import { useCart } from '@/hooks/use-cart';
import { useScheduleStatus } from '@/hooks/use-current-schedule';
import { type MenuDish } from '@/hooks/use-menu';
import { type CartItemDish } from '@/lib/cart/types';
import { AllergenIcons } from './AllergenIcons';
import { AllergenModal } from './AllergenModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, ChevronUp, Info } from 'lucide-react';
// import { toast } from 'sonner';

export type AllergenDisplayMode = 'inline' | 'modal';

interface DishCardProps {
  dish: MenuDish;
  allergenDisplay?: AllergenDisplayMode;
}

export function DishCard({ dish, allergenDisplay = 'inline' }: DishCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [allergenModalOpen, setAllergenModalOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>(
    dish.has_variants && dish.variants.length > 0 ? dish.variants[0].id : undefined,
  );
  const { t, localized } = useI18n();
  const { addItem } = useCart();
  const { kitchenOpen } = useScheduleStatus();

  const discount = dish.discount ?? 1.0;
  const hasDiscount = discount < 1.0;
  const displayPrice = dish.price_eur * discount;

  const selectedVariant = dish.variants.find((v) => v.id === selectedVariantId);
  const variantPrice = selectedVariant?.price_eur != null ? selectedVariant.price_eur : null;
  const finalPrice = variantPrice != null ? variantPrice * discount : displayPrice;

  const allergenInfos = dish.allergens.map((a) => ({
    icon: a.allergen.icon,
    name: a.allergen.name_fr,
  }));

  const description = localized(dish, 'description');
  const name = localized(dish, 'name');

  const handleAdd = () => {
    const item: CartItemDish = {
      type: 'dish',
      dishId: dish.dish_id,
      name_fr: dish.name_fr,
      name_en: dish.name_en,
      name_lb: dish.name_lb,
      basePrice: dish.price_eur,
      discount,
      allergenIcons: allergenInfos.map((a) => a.icon || '\u26a0'),
      imageUrl: dish.image_url,
    };

    if (selectedVariant) {
      item.variantId = selectedVariant.id;
      item.variantName_fr = selectedVariant.name_fr;
      item.variantName_en = selectedVariant.name_en;
      item.variantName_lb = selectedVariant.name_lb;
      item.variantPrice = selectedVariant.price_eur != null ? selectedVariant.price_eur : undefined;
    }

    addItem(item);
    // toast.success(`${name} — ${t('cart.add')}`);
  };

  // Quick add (collapsed mode, no variants)
  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!kitchenOpen) return;
    if (dish.has_variants && dish.variants.length > 1) {
      setExpanded(true);
      return;
    }
    handleAdd();
  };

  return (
    <div
      className="rounded-lg border border-border bg-card overflow-hidden transition-all cursor-pointer newspaper-texture"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Collapsed view */}
      <div className="flex items-center justify-between p-3 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-card-foreground truncate">{name}</span>
            {dish.is_popular && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {t('badge.popular')}
              </Badge>
            )}
            {dish.is_new && (
              <Badge className="text-[10px] h-4 px-1.5 bg-mw-green text-white">
                {t('badge.new')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-semibold text-primary">
              {finalPrice.toFixed(2)} {'\u20ac'}
            </span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                {(variantPrice ?? dish.price_eur).toFixed(2)} {'\u20ac'}
              </span>
            )}
            {/* Variant A: inline allergen emojis in collapsed view */}
            {allergenDisplay === 'inline' && <AllergenIcons allergens={allergenInfos} />}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleQuickAdd}
            disabled={!kitchenOpen}
            title={!kitchenOpen ? t('schedule.kitchenClosed') : undefined}
          >
            <Plus className="h-4 w-4" />
          </Button>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded view */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2" onClick={(e) => e.stopPropagation()}>
          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}

          {/* Image */}
          {dish.image_url && (
            <div className="relative w-full h-32 rounded-md overflow-hidden bg-muted">
              <Image
                src={dish.image_url}
                alt={name}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover"
              />
            </div>
          )}

          {/* Variant selector */}
          {dish.has_variants && dish.variants.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {dish.selection_label || t('item.variants')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {dish.variants.map((v) => {
                  const vName = localized(v, 'name');
                  const isSelected = v.id === selectedVariantId;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-card-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {vName}
                      {v.price_eur != null && (
                        <span className="ml-1 opacity-75">
                          {(Number(v.price_eur) * discount).toFixed(2)}{'\u20ac'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add button + allergen info button */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleAdd}
              disabled={!kitchenOpen}
              title={!kitchenOpen ? t('schedule.kitchenClosed') : undefined}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('cart.add')} — {finalPrice.toFixed(2)} {'\u20ac'}
            </Button>

            {/* Variant B: allergen info button in expanded view */}
            {allergenDisplay === 'modal' && allergenInfos.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 px-2"
                onClick={() => setAllergenModalOpen(true)}
              >
                <Info className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Allergen modal (variant B) */}
      {allergenDisplay === 'modal' && (
        <AllergenModal
          open={allergenModalOpen}
          onOpenChange={(open) => setAllergenModalOpen(open)}
          allergens={allergenInfos}
          dishName={name}
        />
      )}
    </div>
  );
}
