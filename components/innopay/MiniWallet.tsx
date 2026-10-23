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
import WalletActions from './WalletActions';
import { forgetLocalWallet } from '@/lib/innopay/forget-wallet';

import { getInnopayUrl } from '@/lib/innopay/utils';

export interface WalletBalance {
  accountName: string;
  euroBalance: number;
}

interface MiniWalletProps {
  balance: WalletBalance;
  onClose: () => void;
  visible: boolean;
  language?: string;
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
  language = 'fr',
  initialPosition,
  balanceSource,
  pulseState = 'none',
  onPulseReset,
}: MiniWalletProps) {

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

  if (!visible) return null;

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
      <Draggable keepInViewport bottomInset={40}
        className={`z-[9998] innopay-miniwallet bg-gradient-to-r ${gradientMap[pulseState] || gradientMap.none} text-white  transition-colors duration-700`}
        initialPosition={initialPosition || defaultPosition}
        style={{
          minWidth: '220px',
          maxWidth: '280px',
          ...(pulseState !== 'none' && pulseState !== 'green-solid'
            ? { animation: `walletPulse ${pulseState === 'green-slow' ? '4s' : '2s'} ease-in-out infinite` }
            : {}),
        }}
      >
        <div
          className="mw-header"
          onClick={handleTap}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
        >
          <svg className="mw-grip" aria-hidden="true" width="7" height="16" viewBox="0 0 7 16" fill="currentColor">
            <circle cx="1" cy="4" r="1" /><circle cx="6" cy="4" r="1" />
            <circle cx="1" cy="8" r="1" /><circle cx="6" cy="8" r="1" />
            <circle cx="1" cy="12" r="1" /><circle cx="6" cy="12" r="1" />
          </svg>

          <div className="mw-info">
            <p className="mw-title">{title}</p>
            <div className="mw-balance-row">
              <svg className="mw-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v10H6a3 3 0 0 1-3-3V7m17 7h-4v3h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <p className={`mw-amount ${balanceClassName}`}>{balance.euroBalance.toFixed(2)} EUR</p>
                <a
                  href={`${innopayUrl}/user`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mw-account font-mono"
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
            className="mw-close"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <WalletActions key={balance.accountName} accountName={balance.accountName} language={language} onForget={() => forgetLocalWallet()} />
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
