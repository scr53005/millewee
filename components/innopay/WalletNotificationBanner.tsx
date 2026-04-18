/**
 * WalletNotificationBanner Component
 *
 * Blue draggable banner that appears when user wants to order/pay.
 * Contains buttons for:
 * - Import Account
 * - Create Account (Flow 5)
 * - External Wallet (hive:// with FreeNow workaround)
 * - Guest Checkout (Flow 3)
 *
 * Adapted from croque-bedaine with trilingual support (FR/EN/LB).
 */

'use client';

import React, { useState, useCallback } from 'react';
import Draggable from './Draggable';
import { getInnopayUrl, getHiveAccount, generateDistriatedHiveOp } from '@/lib/innopay/utils';

interface WalletNotificationBannerProps {
  visible: boolean;
  onClose: () => void;
  cartTotal: number;
  cartMemo: string;
  table: string;
  onImportAccount: () => void;
  onGuestCheckout: () => void;
  onCreateAccount: () => void;
  isCallWaiterFlow?: boolean;
  isSafariBanner?: boolean;
  language?: 'fr' | 'en' | 'lb';
  topOffset?: number;
  zIndex?: number;
}

export default function WalletNotificationBanner({
  visible,
  onClose,
  cartTotal,
  cartMemo,
  table,
  onImportAccount,
  onGuestCheckout,
  onCreateAccount,
  isCallWaiterFlow = false,
  isSafariBanner = false,
  language = 'fr',
  topOffset = 80,
  zIndex = 8990,
}: WalletNotificationBannerProps) {
  const [showExternalWalletWarning, setShowExternalWalletWarning] = useState(false);
  const [pendingHiveUrl, setPendingHiveUrl] = useState('');
  const [freeNowOpened, setFreeNowOpened] = useState(false);
  const [guestCheckoutClicked, setGuestCheckoutClicked] = useState(false);

  const translations = {
    fr: {
      title: '\uD83D\uDCB3 Pour commander, creez votre portefeuille Innopay',
      subtitle: 'Gratuit et instantane - Pas besoin d\'installer d\'application',
      importAccount: 'Importer un compte',
      createAccount: 'Cr\u00e9er un compte',
      externalWallet: 'Portefeuille externe',
      guestCheckout: 'Commandez sans compte',
      warningTitle: 'Portefeuille externe',
      warningText: 'Ceci va ouvrir votre application Hive Keychain ou Ecency.',
      warningNote: 'Note: Si l\'application FreeNow (taxi) s\'ouvre a la place, revenez ici et utilisez les options de secours.',
      openKeychain: 'Ouvrir Hive Keychain',
      cancel: 'Annuler',
      freeNowTitle: 'FreeNow s\'est ouvert?',
      freeNowText: 'Pas de souci! Utilisez une de ces alternatives:',
      payWithInnopay: 'Payer avec Innopay',
      copyLink: 'Copier le lien de transaction',
      retryAnyway: 'Reessayer quand meme',
      copyTip: 'Astuce: Ouvrez Hive Keychain manuellement, puis collez le lien copie.',
      linkCopied: 'Lien copie! Ouvrez Hive Keychain et collez le lien.',
      nothingToOrder: 'Rien a commander !',
    },
    en: {
      title: '\uD83D\uDCB3 To order, create your Innopay wallet',
      subtitle: 'Free and instant - No app installation required',
      importAccount: 'Import account',
      createAccount: 'Create account',
      externalWallet: 'External wallet',
      guestCheckout: 'Order without account',
      warningTitle: 'External wallet',
      warningText: 'This will open your Hive Keychain or Ecency app.',
      warningNote: 'Note: If FreeNow (taxi) app opens instead, come back here and use the backup options.',
      openKeychain: 'Open Hive Keychain',
      cancel: 'Cancel',
      freeNowTitle: 'FreeNow opened?',
      freeNowText: 'No worries! Use one of these alternatives:',
      payWithInnopay: 'Pay with Innopay',
      copyLink: 'Copy transaction link',
      retryAnyway: 'Retry anyway',
      copyTip: 'Tip: Open Hive Keychain manually, then paste the copied link.',
      linkCopied: 'Link copied! Open Hive Keychain and paste the link.',
      nothingToOrder: 'Nothing to order!',
    },
    lb: {
      title: '\uD83D\uDCB3 Fir ze bestellen, erstellt Ären Innopay Portmonni',
      subtitle: 'Gratis an direkt - Keng App z\'installéieren',
      importAccount: 'Kont importéieren',
      createAccount: 'Kont erstellen',
      externalWallet: 'Extern Portmonni',
      guestCheckout: 'Ouni Kont bestellen',
      warningTitle: 'Extern Portmonni',
      warningText: 'Dëst \u00f6ffnet Är Hive Keychain oder Ecency App.',
      warningNote: 'Notiz: Wann d\'FreeNow (Taxi) App sech \u00f6ffnet, kommt hei zeréck a benotzt d\'Reserveoptiounen.',
      openKeychain: 'Hive Keychain opmaachen',
      cancel: 'Ofbriechen',
      freeNowTitle: 'FreeNow huet sech opgemach?',
      freeNowText: 'Kee Problem! Benotzt eng vun dësen Alternativen:',
      payWithInnopay: 'Mat Innopay bezuelen',
      copyLink: 'Transaktiounslink kopéieren',
      retryAnyway: 'Trotzdem nach eng Kéier probéieren',
      copyTip: 'Tipp: Maacht Hive Keychain manuell op, da peggt de kopéierte Link.',
      linkCopied: 'Link kopéiert! Maacht Hive Keychain op a peggt de Link.',
      nothingToOrder: 'N\u00e4ischt ze bestellen!',
    },
  };

  const t = translations[language] || translations.fr;

  const generateHiveUrl = useCallback(() => {
    const recipient = getHiveAccount();
    const memo = isCallWaiterFlow
      ? `Un serveur est appele TABLE ${table}`
      : cartMemo;
    const amount = isCallWaiterFlow ? '0.020' : cartTotal.toFixed(3);

    return generateDistriatedHiveOp({
      recipient,
      amountHbd: amount,
      memo,
    });
  }, [cartTotal, cartMemo, table, isCallWaiterFlow]);

  const handleExternalWallet = useCallback(() => {
    if (!isCallWaiterFlow && cartTotal <= 0) {
      alert(t.nothingToOrder);
      return;
    }

    console.log('[EXTERNAL WALLET] User requested external wallet - showing warning modal');
    const hiveOpUrl = generateHiveUrl();
    setPendingHiveUrl(hiveOpUrl);
    setFreeNowOpened(false);
    setShowExternalWalletWarning(true);
  }, [cartTotal, isCallWaiterFlow, generateHiveUrl, t.nothingToOrder]);

  const proceedWithExternalWallet = useCallback(() => {
    if (!pendingHiveUrl) return;

    console.log('[EXTERNAL WALLET] User confirmed - opening hive:// URL');

    let protocolHandlerWorked = false;
    let blurTime = 0;

    const blurHandler = () => {
      blurTime = Date.now();
      console.log('[EXTERNAL WALLET] Page lost focus - protocol handler might have worked');
    };

    const focusHandler = () => {
      if (blurTime > 0) {
        const blurDuration = Date.now() - blurTime;
        console.log(`[EXTERNAL WALLET] Page regained focus after ${blurDuration}ms`);

        if (blurDuration > 2000) {
          protocolHandlerWorked = true;
          console.log('[EXTERNAL WALLET] Blur duration suggests successful app switch');
          setShowExternalWalletWarning(false);
          onClose();
        } else {
          console.log('[EXTERNAL WALLET] Short blur - likely Safari error or FreeNow');
          setFreeNowOpened(true);
        }
      }
    };

    window.addEventListener('blur', blurHandler);
    window.addEventListener('focus', focusHandler);

    try {
      window.location.href = pendingHiveUrl;
    } catch (error) {
      console.log('[EXTERNAL WALLET] Failed to open hive:// URL:', error);
      setFreeNowOpened(true);
    }

    setTimeout(() => {
      window.removeEventListener('blur', blurHandler);
      window.removeEventListener('focus', focusHandler);

      if (!protocolHandlerWorked) {
        console.log('[EXTERNAL WALLET] Protocol handler did not work - showing recovery options');
        setFreeNowOpened(true);
      }
    }, 3000);
  }, [pendingHiveUrl, onClose]);

  const copyHiveUrlToClipboard = useCallback(async () => {
    if (!pendingHiveUrl) return;
    try {
      await navigator.clipboard.writeText(pendingHiveUrl);
      alert(t.linkCopied);
    } catch (error) {
      console.error('[EXTERNAL WALLET] Failed to copy to clipboard:', error);
      prompt('Copy this link and paste it in Hive Keychain:', pendingHiveUrl);
    }
  }, [pendingHiveUrl, t.linkCopied]);

  const handleCreateAccount = useCallback(() => {
    console.log(`[WalletNotificationBanner] Create Account clicked - isSafariBanner: ${isSafariBanner}`);
    onCreateAccount();
  }, [onCreateAccount, isSafariBanner]);

  if (!visible) return null;

  return (
    <>
      {/* Main Banner */}
      <Draggable
        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 shadow-lg rounded-lg"
        style={{
          top: `${topOffset}px`,
          width: '100%',
          maxWidth: '896px',
          zIndex,
        }}
        initialPosition={{ x: 0, y: 0 }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="text-white opacity-50 text-xs flex-shrink-0">
            :::
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm md:text-base">
              {t.title}
            </p>
            <p className="text-xs md:text-sm opacity-90 mt-1">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <button
              onClick={onImportAccount}
              className="px-3 py-1.5 rounded-lg font-normal text-xs transition-colors w-[120px] text-center bg-sky-200 text-gray-800 hover:bg-sky-300"
              style={{ whiteSpace: 'normal', lineHeight: '1.3' }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {t.importAccount}
            </button>

            <button
              onClick={handleCreateAccount}
              className="bg-white text-blue-600 px-4 py-3 rounded-lg font-bold text-base hover:bg-blue-50 transition-colors w-[180px] text-center flex items-center justify-center gap-2"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <span>{t.createAccount}</span>
              <img src="/favicon-48x48.png" alt="innopay" className="w-10 h-10" />
            </button>

            <button
              onClick={handleExternalWallet}
              className="bg-black text-red-500 px-4 py-3 rounded-lg font-semibold text-sm hover:bg-gray-900 transition-colors w-[180px] text-center"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              title="Use external wallet app like Hive Keychain or Ecency"
            >
              {t.externalWallet}
            </button>

            <button
              onClick={() => {
                setGuestCheckoutClicked(true);
                onGuestCheckout();
              }}
              className={`bg-gray-600 bg-opacity-60 px-3 py-1.5 rounded-lg font-normal text-xs hover:bg-opacity-70 transition-all w-[120px] text-center ${
                guestCheckoutClicked ? 'italic text-gray-400' : 'text-gray-100'
              }`}
              style={{ whiteSpace: 'normal', lineHeight: '1.3' }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {t.guestCheckout}
            </button>
          </div>

          <div className="flex-shrink-0 w-2">
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 transition-colors p-1"
              aria-label="Fermer"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              x
            </button>
          </div>
        </div>
      </Draggable>

      {/* External Wallet Warning Modal - FreeNow collision workaround */}
      {showExternalWalletWarning && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl relative">
            <button
              onClick={() => {
                setShowExternalWalletWarning(false);
                setPendingHiveUrl('');
                setFreeNowOpened(false);
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              x
            </button>

            {!freeNowOpened ? (
              <>
                <div className="text-center mb-4">
                  <span className="text-4xl">!</span>
                </div>
                <h3 className="text-lg font-bold mb-3 text-gray-800 text-center">
                  {t.warningTitle}
                </h3>
                <p className="text-sm text-gray-600 mb-4 text-center">
                  {t.warningText}
                </p>
                <p className="text-xs text-orange-600 mb-4 text-center bg-orange-50 p-2 rounded">
                  <strong>Note:</strong> {t.warningNote}
                </p>
                <div className="space-y-2">
                  <button
                    onClick={proceedWithExternalWallet}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    {t.openKeychain}
                  </button>
                  <button
                    onClick={() => {
                      setShowExternalWalletWarning(false);
                      setPendingHiveUrl('');
                    }}
                    className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm"
                  >
                    {t.cancel}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <span className="text-4xl">T</span>
                </div>
                <h3 className="text-lg font-bold mb-3 text-gray-800 text-center">
                  {t.freeNowTitle}
                </h3>
                <p className="text-sm text-gray-600 mb-4 text-center">
                  {t.freeNowText}
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setShowExternalWalletWarning(false);
                      setPendingHiveUrl('');
                      setFreeNowOpened(false);
                    }}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    {t.payWithInnopay}
                  </button>
                  <button
                    onClick={copyHiveUrlToClipboard}
                    className="w-full bg-gray-600 text-white py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors text-sm"
                  >
                    {t.copyLink}
                  </button>
                  <button
                    onClick={proceedWithExternalWallet}
                    className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm"
                  >
                    {t.retryAnyway}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  {t.copyTip}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
