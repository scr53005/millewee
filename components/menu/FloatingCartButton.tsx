'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import Draggable from '@/components/innopay/Draggable';
import { ShoppingBag } from 'lucide-react';

interface FloatingCartButtonProps {
  onClick: () => void;
}

const FLOATING_CART_POSITION_KEY = 'millewee_floating_cart_position';
const ESTIMATED_BUTTON_WIDTH = 152;
const DEFAULT_TOP_OFFSET = 138;

function getDefaultPosition() {
  const viewportWidth = window.innerWidth;
  const menuWidth = Math.min(viewportWidth, 896);
  const menuRightEdge = (viewportWidth + menuWidth) / 2;
  const x = Math.max(12, menuRightEdge - ESTIMATED_BUTTON_WIDTH - 12);

  return { x, y: DEFAULT_TOP_OFFSET };
}

function getInitialPosition() {
  try {
    const stored = localStorage.getItem(FLOATING_CART_POSITION_KEY);
    if (!stored) return getDefaultPosition();

    const parsed = JSON.parse(stored) as { x?: unknown; y?: unknown };
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return getDefaultPosition();
    }

    return { x: parsed.x, y: parsed.y };
  } catch {
    return getDefaultPosition();
  }
}

export function FloatingCartButton({ onClick }: FloatingCartButtonProps) {
  const { totalItems, totalPrice } = useCart();
  const [initialPosition, setInitialPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setInitialPosition(getInitialPosition());
  }, []);

  if (totalItems === 0 || !initialPosition) return null;

  return (
    <Draggable
      className="z-30"
      initialPosition={initialPosition}
      onPositionChange={(position) => {
        localStorage.setItem(FLOATING_CART_POSITION_KEY, JSON.stringify(position));
      }}
    >
      <button
        onClick={onClick}
        aria-label="Ouvrir le panier"
        className="flex min-h-12 items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
      >
        <ShoppingBag className="h-5 w-5" />
        <span className="font-semibold text-sm">{totalPrice.toFixed(2)} {'\u20ac'}</span>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground text-xs font-bold text-primary">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      </button>
    </Draggable>
  );
}
