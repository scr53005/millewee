'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';
import { useCart } from '@/hooks/use-cart';
import { useScheduleStatus } from '@/hooks/use-current-schedule';
import { getDishVideoUrl } from '@/lib/dish-videos';
import { type MenuDish } from '@/hooks/use-menu';
import { type CartItemDish } from '@/lib/cart/types';
import { AllergenIcons } from './AllergenIcons';
import { AllergenModal } from './AllergenModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Plus, ChevronDown, ChevronUp, Info, Volume2, VolumeX } from 'lucide-react';
// import { toast } from 'sonner';

export type AllergenDisplayMode = 'inline' | 'modal';

interface DishCardProps {
  dish: MenuDish;
  allergenDisplay?: AllergenDisplayMode;
}

export function DishCard({ dish, allergenDisplay = 'inline' }: DishCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [allergenModalOpen, setAllergenModalOpen] = useState(false);
  const [addedControl, setAddedControl] = useState<'quick' | 'expanded' | null>(null);
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
  const videoUrl = getDishVideoUrl(dish.dish_id);

  // Tap-to-unmute. Mobile browsers (iOS Safari especially) refuse to autoplay
  // any video with audio, so we start muted and let the customer's tap supply
  // the "user gesture" that unlocks sound. Resets every time the card is
  // re-expanded — the <video> element only mounts when expanded.
  const videoRef = useRef<HTMLVideoElement>(null);
  const addedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [audioUnmuted, setAudioUnmuted] = useState(false);

  useEffect(() => {
    return () => {
      if (addedTimeoutRef.current) clearTimeout(addedTimeoutRef.current);
    };
  }, []);

  const flashAdded = (control: 'quick' | 'expanded') => {
    if (addedTimeoutRef.current) clearTimeout(addedTimeoutRef.current);
    setAddedControl(control);
    addedTimeoutRef.current = setTimeout(() => setAddedControl(null), 850);
  };
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setAudioUnmuted(!v.muted);
    // Some browsers pause when toggling muted; nudge it back into playback.
    void v.play().catch(() => {});
  };

  const handleAdd = (control: 'quick' | 'expanded' = 'expanded') => {
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
    flashAdded(control);
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
    handleAdd('quick');
  };

  return (
    <div
      className="rounded-lg border border-border bg-card overflow-hidden transition-all cursor-pointer newspaper-texture"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header \u2014 compact: 2 rows (name / price+allergens). Expanded: 1 row
          (name + badges + price), allergens drop into the expanded body so we
          can give the image more vertical room. */}
      <div className={`flex items-center justify-between gap-2 ${expanded ? 'px-3 pt-3 pb-1.5' : 'p-3'}`}>
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
            {expanded && (
              <>
                <span className="ml-auto text-sm font-semibold text-primary">
                  {finalPrice.toFixed(2)} {'\u20ac'}
                </span>
                {hasDiscount && (
                  <span className="text-xs text-muted-foreground line-through">
                    {(variantPrice ?? dish.price_eur).toFixed(2)} {'\u20ac'}
                  </span>
                )}
              </>
            )}
          </div>
          {!expanded && (
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
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 text-primary hover:bg-primary/10 active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${addedControl === 'quick' ? 'w-auto px-2 add-success' : 'w-8'}`}
            onClick={handleQuickAdd}
            disabled={!kitchenOpen}
            title={!kitchenOpen ? t('schedule.kitchenClosed') : undefined}
            aria-label={addedControl === 'quick' ? t('cart.added') : t('cart.add')}
          >
            {addedControl === 'quick' ? (
              <>
                <Check className="h-4 w-4" />
                <span className="ml-1 text-xs font-semibold">{t('cart.added')}</span>
              </>
            ) : (
              <Plus className="h-4 w-4" />
            )}
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

          {/* Image or video. aspect-[4/3] matches the optimizer's 800x600 max
              output so images fill the box cleanly without ugly cropping that
              the previous fixed h-32 caused. Video uses the still image as its
              poster so the visual lands instantly while the MP4 streams. */}
          {videoUrl ? (
            <div className="relative w-full aspect-[4/3] rounded-md overflow-hidden bg-muted">
              <video
                ref={videoRef}
                src={videoUrl}
                poster={dish.image_url ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={toggleMute}
                aria-label={audioUnmuted ? 'Mute video' : 'Unmute video'}
                className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/55 text-white hover:bg-black/75 transition-colors"
              >
                {audioUnmuted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            dish.image_url && (
              <div className="relative w-full aspect-[4/3] rounded-md overflow-hidden bg-muted">
                <Image
                  src={dish.image_url}
                  alt={name}
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-cover"
                />
              </div>
            )
          )}

          {/* Allergens (inline mode only) — moved here from the header so the
              header in expanded view can stay a single tight row. */}
          {allergenDisplay === 'inline' && allergenInfos.length > 0 && (
            <AllergenIcons allergens={allergenInfos} />
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
              className={`flex-1 bg-primary text-primary-foreground hover:bg-primary/90 ${addedControl === 'expanded' ? 'add-success' : ''}`}
              onClick={() => handleAdd('expanded')}
              disabled={!kitchenOpen}
              title={!kitchenOpen ? t('schedule.kitchenClosed') : undefined}
            >
              {addedControl === 'expanded' ? <Check className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {addedControl === 'expanded' && t('cart.added')}
              <span className={addedControl === 'expanded' ? 'hidden' : ''}>
              {t('cart.add')} — {finalPrice.toFixed(2)} {'\u20ac'}
              </span>
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
