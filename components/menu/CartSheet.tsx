'use client';

import { useI18n } from '@/lib/i18n';
import { useCart } from '@/hooks/use-cart';
import { effectivePrice } from '@/lib/cart/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartSheet({ open, onOpenChange }: CartSheetProps) {
  const { t, localized } = useI18n();
  const { items, removeItem, updateQuantity, updateComment, clearCart, totalPrice } = useCart();

  return (
    <Sheet open={open} onOpenChange={(o) => onOpenChange(o)}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            {t('cart.title')}
            {items.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({items.reduce((s, i) => s + i.quantity, 0)} {items.reduce((s, i) => s + i.quantity, 0) === 1 ? t('cart.item') : t('cart.items')})
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-4 -mx-4">
          {items.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              {t('cart.empty')}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((cartItem) => {
                const { item, quantity, comment, key } = cartItem;
                const price = effectivePrice(item);
                const name = localized(item, 'name');

                // Subtitle: variant/size/selection info
                let subtitle = '';
                if (item.type === 'dish' && item.variantName_fr) {
                  subtitle = localized(item, 'variantName') || item.variantName_fr;
                } else if (item.type === 'drink') {
                  const parts: string[] = [];
                  if (item.size) parts.push(item.size);
                  if (item.selectionName_fr) {
                    parts.push(localized(item, 'selectionName') || item.selectionName_fr);
                  }
                  subtitle = parts.join(' \u2014 ');
                }

                return (
                  <div key={key} className="rounded-lg border border-border bg-card p-3 space-y-2">
                    {/* Name + price row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-card-foreground text-sm">{name}</div>
                        {subtitle && (
                          <div className="text-xs text-muted-foreground">{subtitle}</div>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-primary shrink-0">
                        {(price * quantity).toFixed(2)} {'\u20ac'}
                      </span>
                    </div>

                    {/* Quantity + comment + remove row */}
                    <div className="flex items-center gap-2">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQuantity(key, quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-6 text-center">{quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQuantity(key, quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Comment input */}
                      <Input
                        value={comment || ''}
                        onChange={(e) => updateComment(key, e.target.value)}
                        placeholder={t(item.type === 'dish' ? 'cart.commentPlaceholderDish' : 'cart.commentPlaceholderDrink')}
                        maxLength={80}
                        className="h-6 text-xs flex-1"
                      />

                      {/* Remove */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeItem(key)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <SheetFooter className="border-t border-border pt-4">
            {/* Total */}
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-base font-semibold">{t('cart.total')}</span>
              <span className="text-lg font-bold text-primary">
                {totalPrice.toFixed(2)} {'\u20ac'}
              </span>
            </div>

            {/* Order button (disabled — payment is Phase 4) */}
            <Button className="w-full" disabled>
              {t('action.paymentSoon')}
            </Button>

            {/* Clear cart */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={clearCart}
            >
              {t('cart.clear')}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
