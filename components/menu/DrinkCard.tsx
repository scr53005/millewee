'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';
import { useCart } from '@/hooks/use-cart';
import { type MenuDrink } from '@/hooks/use-menu';
import { type CartItemDrink } from '@/lib/cart/types';
import { Button } from '@/components/ui/button';
import { Check, Plus } from 'lucide-react';
// import { toast } from 'sonner';

interface DrinkCardProps {
  drink: MenuDrink;
}

export function DrinkCard({ drink }: DrinkCardProps) {
  const { t, localized } = useI18n();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const addedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (addedTimeoutRef.current) clearTimeout(addedTimeoutRef.current);
    };
  }, []);

  const flashAdded = () => {
    if (addedTimeoutRef.current) clearTimeout(addedTimeoutRef.current);
    setAdded(true);
    addedTimeoutRef.current = setTimeout(() => setAdded(false), 850);
  };

  // Default to first size
  const [selectedSize, setSelectedSize] = useState(drink.sizes[0]?.size ?? '');
  const [selectedSelectionId, setSelectedSelectionId] = useState<number | undefined>(undefined);

  const currentSize = useMemo(
    () => drink.sizes.find((s) => s.size === selectedSize),
    [drink.sizes, selectedSize],
  );

  const currentSelection = useMemo(
    () => drink.selections.find((s) => s.id === selectedSelectionId),
    [drink.selections, selectedSelectionId],
  );

  const discount = currentSize?.discount ?? 1.0;
  const basePrice = currentSize?.price_eur ?? 0;
  const delta = currentSelection ? currentSelection.price_delta : 0;
  const finalPrice = (basePrice + delta) * discount;

  const name = localized(drink, 'name');
  const hasMultipleSizes = drink.sizes.length > 1;
  const hasSelections = drink.selections.length > 0;

  const handleAdd = () => {
    if (!currentSize) return;

    const item: CartItemDrink = {
      type: 'drink',
      drinkId: drink.drink_id,
      name_fr: drink.name_fr,
      name_en: drink.name_en,
      name_lb: drink.name_lb,
      size: currentSize.size,
      sizePrice: currentSize.price_eur,
      discount,
      selectionId: currentSelection?.id,
      selectionName_fr: currentSelection?.name_fr,
      selectionName_en: currentSelection?.name_en ?? null,
      selectionName_lb: currentSelection?.name_lb ?? null,
      selectionDelta: delta,
      imageUrl: currentSize.image_url,
    };

    addItem(item);
    flashAdded();
    // toast.success(`${name} — ${t('cart.add')}`);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      {/* Image (from selected size) */}
      {currentSize?.image_url && (
        <div className="relative w-full h-28 rounded-md overflow-hidden bg-muted -mt-1 -mx-1" style={{ width: 'calc(100% + 0.5rem)' }}>
          <Image
            src={currentSize.image_url}
            alt={name}
            fill
            sizes="(max-width: 768px) 50vw, 300px"
            className="object-cover"
          />
        </div>
      )}

      {/* Name + price row */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-card-foreground">{name}</span>
        <span className="text-sm font-semibold text-primary shrink-0">
          {finalPrice.toFixed(2)} {'\u20ac'}
        </span>
      </div>

      {/* Size selector */}
      {hasMultipleSizes && (
        <div className="flex flex-wrap gap-1.5">
          {drink.sizes.map((s) => {
            const isSelected = s.size === selectedSize;
            return (
              <button
                key={s.size}
                onClick={() => setSelectedSize(s.size)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-card-foreground border-border hover:border-primary/50'
                }`}
              >
                {s.size}
                <span className="ml-1 opacity-75">
                  {(s.price_eur * (s.discount ?? 1.0)).toFixed(2)}{'\u20ac'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Selection picker */}
      {hasSelections && (
        <div className="flex flex-wrap gap-1.5">
          {drink.selections.map((s) => {
            const sName = localized(s, 'name');
            const isSelected = s.id === selectedSelectionId;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSelectionId(isSelected ? undefined : s.id)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-card-foreground border-border hover:border-primary/50'
                }`}
              >
                {sName}
                {s.price_delta > 0 && (
                  <span className="ml-1 opacity-75">+{Number(s.price_delta).toFixed(2)}{'\u20ac'}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Add button */}
      <Button
        size="sm"
        className={`w-full bg-primary text-primary-foreground hover:bg-primary/90 ${added ? 'add-success' : ''}`}
        onClick={handleAdd}
        disabled={!currentSize}
      >
        {added ? <Check className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
        {added ? t('cart.added') : t('cart.add')}
      </Button>
    </div>
  );
}
