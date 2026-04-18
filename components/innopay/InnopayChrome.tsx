'use client';

import { useEffect, useState } from 'react';
import MiniWallet, { WalletReopenButton } from './MiniWallet';
import BottomBanner from './BottomBanner';
import { useBalance } from '@/hooks/innopay/useBalance';
import { useWalletPulse } from '@/hooks/use-wallet-pulse';
import { useI18n } from '@/lib/i18n';

const WALLET_HIDDEN_KEY = 'innopay_wallet_hidden';

export function InnopayChrome() {
  const { language, t } = useI18n();
  const [accountName, setAccountName] = useState<string | null>(null);
  const [walletHidden, setWalletHidden] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAccountName(localStorage.getItem('innopay_accountName'));
    setWalletHidden(localStorage.getItem(WALLET_HIDDEN_KEY) === '1');

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'innopay_accountName') {
        setAccountName(localStorage.getItem('innopay_accountName'));
      }
      if (e.key === WALLET_HIDDEN_KEY) {
        setWalletHidden(localStorage.getItem(WALLET_HIDDEN_KEY) === '1');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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
