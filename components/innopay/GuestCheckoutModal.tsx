/**
 * GuestCheckoutModal Component
 *
 * Warning modal shown before guest checkout to inform user about:
 * - 5% additional fee (card processing)
 * - Discount forfeiture if applicable
 *
 * Adapted from croque-bedaine with trilingual support (FR/EN/LB).
 */

'use client';

import React from 'react';

interface GuestCheckoutModalProps {
  visible: boolean;
  onClose: () => void;
  onProceed: () => void;
  isProcessing?: boolean;
  totalPrice: number;
  totalPriceNoDiscount: number;
  discountAmount: number;
  language?: 'fr' | 'en' | 'lb';
}

export default function GuestCheckoutModal({
  visible,
  onClose,
  onProceed,
  isProcessing = false,
  totalPrice,
  totalPriceNoDiscount,
  discountAmount,
  language = 'fr',
}: GuestCheckoutModalProps) {
  const translations = {
    fr: {
      title: 'Commander sans compte',
      feeWarning: 'Commander sans compte implique une',
      feeHighlight: 'charge supplementaire de',
      feePercent: '5%',
      feeCause: 'liee aux commissions de carte bancaire.',
      discountWarning: 'En commandant sans creer un compte vous',
      discountHighlight: 'renoncez a un discount de:',
      continueAndPay: 'Continuer et payer',
      goBack: 'Revenir pour beneficier',
      redirecting: 'Redirection...',
    },
    en: {
      title: 'Order without account',
      feeWarning: 'Ordering without an account includes an',
      feeHighlight: 'additional charge of',
      feePercent: '5%',
      feeCause: 'due to credit card processing fees.',
      discountWarning: 'By ordering without creating an account you',
      discountHighlight: 'forfeit a discount of:',
      continueAndPay: 'Continue and pay',
      goBack: 'Go back to benefit',
      redirecting: 'Redirecting...',
    },
    lb: {
      title: 'Ouni Kont bestellen',
      feeWarning: 'Bestellen ouni Kont enthält eng',
      feeHighlight: 'zous\u00e4tzlech Charge vu',
      feePercent: '5%',
      feeCause: 'wéinst Kreditkaarten-Kommissiounen.',
      discountWarning: 'Wann Dir ouni Kont bestellt, verz\u00e4icht Dir op en Discount vu:',
      discountHighlight: '',
      continueAndPay: 'Weider a bezuelen',
      goBack: 'Zeréck fir ze profitéieren',
      redirecting: 'Weiderleitung...',
    },
  };

  const t = translations[language] || translations.fr;

  const guestPrice = (totalPriceNoDiscount * 1.05).toFixed(2);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-gray-700 text-gray-300 rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-center">{t.title}</h3>

        <p className="text-sm mb-3">
          {t.feeWarning}{' '}
          <span className="text-red-600 font-semibold">
            {t.feeHighlight}{' '}
            <span className="text-red-500 font-bold">{t.feePercent}</span>
          </span>{' '}
          {t.feeCause}
        </p>

        {discountAmount > 0 && (
          <p className="text-sm mb-4">
            {t.discountWarning}{' '}
            {t.discountHighlight && (
              <span className="text-red-600 font-semibold">
                {t.discountHighlight}{' '}
              </span>
            )}
            <span className="text-red-500 font-bold">{discountAmount.toFixed(2)} EUR</span>
          </p>
        )}

        <div className="flex flex-col gap-3 mt-6">
          <button
            disabled={isProcessing}
            onClick={onProceed}
            className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
              isProcessing
                ? 'bg-gray-500 text-gray-400 cursor-not-allowed'
                : 'bg-black text-gray-300 hover:bg-gray-900'
            }`}
          >
            {isProcessing
              ? t.redirecting
              : <>{t.continueAndPay}{' '}<span className="text-red-500">{guestPrice} EUR</span></>
            }
          </button>

          <button
            onClick={onClose}
            className="bg-white text-blue-600 px-4 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            {t.goBack}
          </button>
        </div>
      </div>
    </div>
  );
}
