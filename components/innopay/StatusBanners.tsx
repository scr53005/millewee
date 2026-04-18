/**
 * StatusBanners Component
 *
 * Displays payment status banners:
 * - Blue: Redirecting (with spinner)
 * - Yellow: Payment processing/success (with spinner)
 * - Grey: Transmission error
 * - Green: Final success (order transmitted, account created)
 * - Blue: Waiter called
 *
 * Adapted from croque-bedaine with trilingual support (FR/EN/LB).
 */

'use client';

import React from 'react';

type BannerStatus =
  | 'redirecting'
  | 'processing'
  | 'success'
  | 'error'
  | 'error_no_payment'
  | 'account_created'
  | 'waiter_called'
  | 'idle';

interface StatusBannersProps {
  status: BannerStatus;
  message?: string;
  subMessage?: string;
  onDismiss?: () => void;
  onShowOrder?: () => void;
  onClearCart?: () => void;
  table?: string;
  language?: 'fr' | 'en' | 'lb';
}

export default function StatusBanners({
  status,
  message,
  subMessage,
  onDismiss,
  onShowOrder,
  onClearCart,
  table,
  language = 'fr',
}: StatusBannersProps) {
  const translations = {
    fr: {
      redirecting: {
        title: 'Initialisation du processeur de paiements',
        subtitle: 'Veuillez patienter...',
      },
      processing: {
        title: 'Paiement r\u00e9ussi!',
        subtitle: 'Commande en cours de transmission...',
      },
      success: {
        title: 'Votre commande a ete transmise et est en cours de preparation',
        button: 'OK',
      },
      error: {
        title: 'Une erreur de transmission s\'est produite',
        subtitle: 'Veuillez appeler un serveur et nous en excuser',
        showOrder: 'Commande',
        clear: 'Effacer',
      },
      accountCreated: {
        title: 'Votre portefeuille Innopay est pret, vous pouvez deja commander',
        button: 'OK',
      },
      waiterCalled: {
        title: 'Un serveur arrive a votre table!',
        subtitle: 'Table',
        button: 'OK',
      },
    },
    en: {
      redirecting: {
        title: 'Initializing payment processor',
        subtitle: 'Please wait...',
      },
      processing: {
        title: 'Payment successful!',
        subtitle: 'Order being transmitted...',
      },
      success: {
        title: 'Your order has been transmitted and is being prepared',
        button: 'OK',
      },
      error: {
        title: 'A transmission error occurred',
        subtitle: 'Please call a waiter and accept our apologies',
        showOrder: 'Order',
        clear: 'Clear',
      },
      accountCreated: {
        title: 'Your Innopay wallet is ready, you can start ordering',
        button: 'OK',
      },
      waiterCalled: {
        title: 'A waiter is coming to your table!',
        subtitle: 'Table',
        button: 'OK',
      },
    },
    lb: {
      redirecting: {
        title: 'Bezuelungsprozessor g\u00ebtt initialis\u00e9iert',
        subtitle: 'W.e.g. waarden...',
      },
      processing: {
        title: 'Bezuelung erfollegr\u00e4ich!',
        subtitle: 'Bestellung g\u00ebtt iwwerdroe...',
      },
      success: {
        title: '\u00c4r Bestellung gouf iwwerdroe a g\u00ebtt virbereet',
        button: 'OK',
      },
      error: {
        title: 'En Iwwerdroungsfehler ass opgetrueden',
        subtitle: 'Rufft w.e.g. e Kellner a entsch\u00ebllegt Iech',
        showOrder: 'Bestellung',
        clear: 'L\u00e4schen',
      },
      accountCreated: {
        title: '\u00c4re Innopay Portmonni ass prett, Dir k\u00ebnnt elo bestellen',
        button: 'OK',
      },
      waiterCalled: {
        title: 'E Kellner k\u00ebnnt un \u00c4ren D\u00ebsch!',
        subtitle: 'D\u00ebsch',
        button: 'OK',
      },
    },
  };

  const t = translations[language] || translations.fr;

  if (status === 'idle') return null;

  if (status === 'redirecting') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9000] bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            <div>
              <p className="font-semibold text-base md:text-lg">
                {message || t.redirecting.title}
              </p>
              <p className="text-sm opacity-90">
                {subMessage || t.redirecting.subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9000] bg-gradient-to-r from-yellow-500 to-yellow-600 text-blue-700 px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700"></div>
            <div>
              <p className="font-semibold text-base md:text-lg">
                {message || t.processing.title}
              </p>
              <p className="text-sm opacity-90">
                {subMessage || t.processing.subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9020] bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">V</span>
            <div>
              <p className="font-semibold text-base md:text-lg">
                {message || t.success.title}
              </p>
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="bg-white text-green-700 px-4 py-2 rounded-lg font-semibold hover:bg-green-50 transition-colors ml-4"
            >
              {t.success.button}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-[9000] bg-gradient-to-r from-yellow-500 to-yellow-600 text-blue-700 px-4 py-3 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">V</span>
              <p className="font-semibold text-base md:text-lg">
                {t.processing.title}
              </p>
            </div>
          </div>
        </div>

        <div className="fixed left-0 right-0 z-[8990] bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-4 shadow-lg" style={{ top: '60px' }}>
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col items-center gap-3">
              <div className="text-center">
                <p className="font-semibold text-base md:text-lg">
                  {message || t.error.title}
                </p>
                <p className="text-sm opacity-90">
                  {subMessage || t.error.subtitle}
                </p>
              </div>
              <div className="flex gap-3">
                {onShowOrder && (
                  <button
                    onClick={onShowOrder}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-md opacity-80 hover:opacity-100"
                  >
                    {t.error.showOrder}
                  </button>
                )}
                {onClearCart && (
                  <button
                    onClick={onClearCart}
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors shadow-md opacity-80 hover:opacity-100"
                  >
                    {t.error.clear}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (status === 'error_no_payment') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9000] bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center gap-3">
            <div className="text-center">
              <p className="font-semibold text-base md:text-lg">
                {message || t.error.title}
              </p>
              <p className="text-sm opacity-90">
                {subMessage || t.error.subtitle}
              </p>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="bg-white text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                OK
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'account_created') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9000] bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">V</span>
            <div>
              <p className="font-semibold text-base md:text-lg">
                {message || t.accountCreated.title}
              </p>
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="bg-white text-green-700 px-4 py-2 rounded-lg font-semibold hover:bg-green-50 transition-colors ml-4"
            >
              {t.accountCreated.button}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'waiter_called') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9020] bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{'\uD83D\uDD14'}</span>
            <div>
              <p className="font-semibold text-base md:text-lg">
                {message || t.waiterCalled.title}
              </p>
              {table && (
                <p className="text-sm opacity-90">
                  {t.waiterCalled.subtitle} {table}
                </p>
              )}
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="bg-white text-blue-700 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors ml-4"
            >
              {t.waiterCalled.button}
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
