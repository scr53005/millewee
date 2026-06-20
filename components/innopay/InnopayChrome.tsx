'use client';

import { useEffect, useState } from 'react';
import MiniWallet, { WalletReopenButton } from './MiniWallet';
import BottomBanner from './BottomBanner';
import { useBalance } from '@/hooks/innopay/useBalance';
import { useWalletPulse } from '@/hooks/use-wallet-pulse';
import { useI18n } from '@/lib/i18n';
import { getAccountName, purgeForbidden, ensureReady } from '@/lib/innopay/keystore';

const WALLET_HIDDEN_KEY = 'innopay_wallet_hidden';

export function InnopayChrome() {
  const { language, t } = useI18n();
  const [accountName, setAccountName] = useState<string | null>(null);
  const [walletHidden, setWalletHidden] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  const { balance, source } = useBalance(accountName, { enabled: !!accountName });
  const { pulseState, resetPulse } = useWalletPulse();

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
          balance={{ accountName: accountName!, euroBalance: balance }}
          onClose={handleClose}
          visible
          title={t('wallet.title')}
          balanceSource={source ?? undefined}
          pulseState={pulseState}
          onPulseReset={resetPulse}
        />
      )}
      {!!accountName && walletHidden && (
        <WalletReopenButton onClick={handleReopen} visible />
      )}
      <BottomBanner language={language} />
    </>
  );
}
