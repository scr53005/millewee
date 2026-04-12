'use client';

import { useCart } from '@/hooks/use-cart';
import { ShoppingBag } from 'lucide-react';

interface FloatingCartButtonProps {
  onClick: () => void;
}

export function FloatingCartButton({ onClick }: FloatingCartButtonProps) {
  const { totalItems, totalPrice } = useCart();

  if (totalItems === 0) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
    >
      <ShoppingBag className="h-5 w-5" />
      <span className="font-semibold text-sm">{totalPrice.toFixed(2)} {'\u20ac'}</span>
      <span className="bg-primary-foreground text-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
        {totalItems > 99 ? '99+' : totalItems}
      </span>
    </button>
  );
}
