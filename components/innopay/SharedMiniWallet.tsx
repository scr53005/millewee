'use client';

import React from 'react';
import { MiniWallet as Wallet, type PulseState } from '@innopay/ui';
import { forgetLocalWallet } from '@/lib/innopay/forget-wallet';
import { getInnopayUrl } from '@/lib/innopay/utils';

export { WalletReopenButton, RubisTeaser } from '@innopay/ui';
export type { PulseState } from '@innopay/ui';
export interface WalletBalance { accountName: string; euroBalance: number }
interface Props {
  balance: WalletBalance;
  onClose: () => void;
  visible: boolean;
  language?: string;
  title?: string;
  initialPosition?: { x: number; y: number };
  balanceSource?: string;
  pulseState?: PulseState;
  onPulseReset?: () => void;
  // RUBIS (RUBIS-PLAN.md §5): the package formats and draws; the chrome supplies the data.
  rubisBalance?: number | null;
  rubisEarnable?: boolean;
  rubisTeaser?: boolean;
  onRubisTeaserEnd?: () => void;
  spendRubisFirst?: boolean;
  onSpendRubisFirstChange?: (value: boolean) => void;
}

/** App adapter: currency, hub navigation and local removal stay here. */
export default function MiniWallet({ balance, balanceSource, ...props }: Props) {
  return <Wallet {...props} accountName={balance.accountName}
    balanceLabel={`${balance.euroBalance.toFixed(2)} €`} accountUrl={`${getInnopayUrl()}/user`}
    cached={balanceSource === 'localStorage-cache'} onForget={() => forgetLocalWallet()} />;
}
