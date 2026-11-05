'use client';

import { useEffect, useState } from 'react';
import { shouldShowRubisTeaser } from '@innopay/ui';
import MiniWallet, { RubisTeaser, WalletReopenButton } from './SharedMiniWallet';
import BottomBanner from './BottomBanner';
import { useBalance } from '@/hooks/innopay/useBalance';
import { useWalletPulse } from '@/hooks/use-wallet-pulse';
import { useI18n } from '@/lib/i18n';
import { getAccountName, purgeForbidden, ensureReady } from '@/lib/innopay/keystore';
import {
  RUBIS_EARNABLE, isPaymentReturn, markTeaserShown, readSpendRubisFirst, readTeaserShown,
  writeSpendRubisFirst,
} from '@/lib/innopay/rubis';

const WALLET_HIDDEN_KEY = 'innopay_wallet_hidden';

export function InnopayChrome() {
  const { language, t } = useI18n();
  const [accountName, setAccountName] = useState<string | null>(null);
  const [walletHidden, setWalletHidden] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Start "shown" so nothing plays before the session flag has been read.
  const [teaserShown, setTeaserShown] = useState(true);
  const [paymentReturn, setPaymentReturn] = useState(false);
  const [spendRubisFirst, setSpendRubisFirst] = useState(true);

  useEffect(() => {
    setMounted(true);
    setTeaserShown(readTeaserShown(sessionStorage));
    setPaymentReturn(isPaymentReturn(window.location.search));
    setSpendRubisFirst(readSpendRubisFirst(localStorage));
    // One-time, idempotent purge of legacy forbidden keys (master password / posting
    // key) from returning customers' browsers — SPOKE-KEY-SECURITY.md §4 step 3.
    purgeForbidden();
    // Kick off the at-rest-key unlock (decrypt active+memo into memory, migrating
    // any legacy plaintext) so the sync getters are ready by interaction time —
    // SPOKE-KEY-SECURITY.md §9. Fire-and-forget; getAccountName() below is plaintext
    // and doesn't depend on it (no UI flicker).
    void ensureReady();
    setAccountName(getAccountName());
    setWalletHidden(localStorage.getItem(WALLET_HIDDEN_KEY) === '1');

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'innopay_accountName') {
        setAccountName(getAccountName());
      }
      if (e.key === WALLET_HIDDEN_KEY) {
        setWalletHidden(localStorage.getItem(WALLET_HIDDEN_KEY) === '1');
      }
    };
    const onCredentialsUpdated = () => {
      setAccountName(getAccountName());
      setWalletHidden(localStorage.getItem(WALLET_HIDDEN_KEY) === '1');
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('innopay:credentials-updated', onCredentialsUpdated);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('innopay:credentials-updated', onCredentialsUpdated);
    };
  }, []);

  const { balance, rubis, source } = useBalance(accountName, { enabled: !!accountName });
  const { pulseState, resetPulse } = useWalletPulse();

  // An order in flight (pulse) or a hub return being finalised counts as "paying": no teaser.
  const paying = paymentReturn || pulseState !== 'none';
  // Only a fresh chain read may say "0 RUBIS"; a cached or optimistic value could be out of date.
  const confirmedRubis = source === 'hive-engine' ? rubis : null;
  // Only while the wallet card is actually on screen (not minimised).
  const holderTeaser = !!accountName && !walletHidden && shouldShowRubisTeaser({
    earnable: RUBIS_EARNABLE, balance: confirmedRubis, paying, shownThisSession: teaserShown,
  });
  // A guest has no balance: 0 is the honest input (guest checkout earns nothing).
  const guestTeaser = mounted && !accountName && shouldShowRubisTeaser({
    earnable: RUBIS_EARNABLE, balance: 0, paying, shownThisSession: teaserShown,
  });

  // Remember at the start, so a reload during the 3 s does not replay it. The local state
  // flips only at the end, because flipping it now would stop the teaser at once.
  useEffect(() => {
    if (holderTeaser || guestTeaser) markTeaserShown(sessionStorage);
  }, [holderTeaser, guestTeaser]);
  const handleTeaserEnd = () => setTeaserShown(true);

  const handleSpendRubisFirstChange = (value: boolean) => {
    setSpendRubisFirst(value);
    writeSpendRubisFirst(localStorage, value);
  };

  const handleClose = () => {
    localStorage.setItem(WALLET_HIDDEN_KEY, '1');
    setWalletHidden(true);
  };

  const handleReopen = () => {
    localStorage.removeItem(WALLET_HIDDEN_KEY);
    setWalletHidden(false);
  };

  if (!mounted) return <BottomBanner language={language} />;

  const showWallet = !!accountName && !walletHidden && balance !== null;

  return (
    <>
      {showWallet && (
        <MiniWallet
          language={language}
          balance={{ accountName: accountName!, euroBalance: balance }}
          onClose={handleClose}
          visible
          title={t('wallet.title')}
          balanceSource={source ?? undefined}
          pulseState={pulseState}
          onPulseReset={resetPulse}
          rubisBalance={rubis}
          rubisEarnable={RUBIS_EARNABLE}
          rubisTeaser={holderTeaser}
          onRubisTeaserEnd={handleTeaserEnd}
          spendRubisFirst={spendRubisFirst}
          onSpendRubisFirstChange={handleSpendRubisFirstChange}
        />
      )}
      {/* Sits just above the 30 px BottomBanner; millewee's cart button floats near the top. */}
      <RubisTeaser show={guestTeaser} onEnd={handleTeaserEnd} language={language} bottom={44} />
      {!!accountName && walletHidden && (
        <WalletReopenButton onClick={handleReopen} visible language={language} />
      )}
      <BottomBanner language={language} />
    </>
  );
}
