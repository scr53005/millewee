/**
 * MiniWallet Component
 *
 * A draggable wallet indicator that displays the user's Innopay account balance.
 * Adapted from croque-bedaine with trilingual support.
 *
 * Features:
 * - Draggable positioning with constraints
 * - Shows account name (linked to innopay/user) and EURO balance
 * - Collapsible with close button
 * - Post-order pulsing: blue (waiting) -> green (confirmed) -> red (stale/problem)
 *   Double-tap or long-press to reset pulse, close also resets.
 */

'use client';

import React, { useRef, useCallback } from 'react';
import Draggable from './Draggable';
import { getInnopayUrl } from '@/lib/innopay/utils';

export interface WalletBalance {
  accountName: string;
  euroBalance: number;
}

interface MiniWalletProps {
  balance: WalletBalance;
  onClose: () => void;
  visible: boolean;
  title?: string;
  initialPosition?: { x: number; y: number };
  balanceSource?: string;
  pulseState?: 'none' | 'blue' | 'green' | 'green-slow' | 'green-solid' | 'red';
  onPulseReset?: () => void;
}

export default function MiniWallet({
  balance,
  onClose,
  visible,
  title = 'Votre portefeuille Innopay',
  initialPosition,
  balanceSource,
  pulseState = 'none',
  onPulseReset,
}: MiniWalletProps) {
  if (!visible) return null;

  const lastTapRef = useRef(0);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCloseClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (pulseState !== 'none') onPulseReset?.();
    onClose();
  };

  const handleTap = useCallback(() => {
    if (pulseState === 'none' || !onPulseReset) return;
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      onPulseReset();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [pulseState, onPulseReset]);

  const handlePressStart = useCallback(() => {
    if (pulseState === 'none' || !onPulseReset) return;
    longPressRef.current = setTimeout(() => { onPulseReset(); }, 1000);
  }, [pulseState, onPulseReset]);

  const handlePressEnd = useCallback(() => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  }, []);

  const isCached = balanceSource === 'localStorage-cache';
  const balanceClassName = isCached
    ? 'font-bold text-lg italic text-blue-200'
    : 'font-bold text-lg text-white';

  const defaultPosition = {
    x: typeof window !== 'undefined' ? window.innerWidth - 316 : 100,
    y: typeof window !== 'undefined' ? window.innerHeight - 170 : 500
  };

  const gradientMap: Record<string, string> = {
    none: 'from-blue-600 to-blue-700',
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    'green-slow': 'from-green-500 to-green-600',
    'green-solid': 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
  };

  const innopayUrl = getInnopayUrl();

  return (
    <>
      {pulseState !== 'none' && pulseState !== 'green-solid' && (
        <style>{`
          @keyframes walletPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.03); }
          }
        `}</style>
      )}
      <Draggable
        className={`z-[9998] bg-gradient-to-r ${gradientMap[pulseState] || gradientMap.none} text-white px-4 py-3 rounded-lg shadow-lg transition-colors duration-700`}
        initialPosition={initialPosition || defaultPosition}
        style={{
          minWidth: '200px',
          maxWidth: '300px',
          ...(pulseState !== 'none' && pulseState !== 'green-solid'
            ? { animation: `walletPulse ${pulseState === 'green-slow' ? '4s' : '2s'} ease-in-out infinite` }
            : {}),
        }}
      >
        <div
          className="flex items-center justify-between gap-3"
          onClick={handleTap}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
        >
          <div className="text-white opacity-50 text-xs flex-shrink-0">
            :::
          </div>

          <div className="flex-1">
            <p className="text-xs opacity-75 mb-1">{title}</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{'\uD83D\uDCB0'}</span>
              <div>
                <p className={balanceClassName}>{balance.euroBalance.toFixed(2)} EUR</p>
                <a
                  href={`${innopayUrl}/user`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs opacity-75 font-mono underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {balance.accountName}
                </a>
              </div>
            </div>
          </div>

          <button
            onClick={handleCloseClick}
            onMouseDown={handleCloseClick}
            onTouchStart={handleCloseClick}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors flex-shrink-0"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </Draggable>
    </>
  );
}

export function WalletReopenButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-[9998] bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
      aria-label="Voir portefeuille"
    >
      <span className="text-2xl">{'\uD83D\uDCB0'}</span>
    </button>
  );
}
