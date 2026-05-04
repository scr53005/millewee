'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEYS_TO_CLEAR = [
  'innopay_accountName',
  'innopay_masterPassword',
  'innopay_activePrivate',
  'innopay_postingPrivate',
  'innopay_memoPrivate',
  'innopay_import_attempts',
  'innopay_accounts',
  'innopay_wallet_credentials',
  'innopay_lastBalance',
  'innopay_lastBalance_timestamp',
  'innopay_balance_trustUntil',
  'innopay_pending_order',
  'innopay_flow_pending',
  'innopay_flow5_pending',
  'innopay_flow6_cooldown_until',
  'innopay_latestMemoContent',
  'innopay_latestMemoDateTime',
  'innopay_fulfilledDetectedAt',
  'innopay_orderConfirmedForMemo',
  'innopay_wallet_hidden',
  'millewee_floating_cart_position',
  'millewee_cart',
  'cart',
];

function isDevHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname.includes('127.0.0.1') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.')
  );
}

export function DevClearStorageButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isDevHost(window.location.hostname));
  }, []);

  if (!visible) return null;

  const handleClear = () => {
    if (!confirm('Clear all localStorage and sessionStorage (dev only)? Table and menu will be preserved.')) {
      return;
    }

    const currentParams = new URLSearchParams(window.location.search);
    const preserved = new URLSearchParams();
    const table = currentParams.get('table');
    const menu = currentParams.get('menu');

    if (table) preserved.set('table', table);
    if (menu) preserved.set('menu', menu);

    for (const key of STORAGE_KEYS_TO_CLEAR) {
      localStorage.removeItem(key);
    }
    sessionStorage.clear();

    console.log('[DEV] localStorage and sessionStorage cleared, preserving:', {
      table,
      menu,
    });
    alert('Storage cleared! Reloading...');

    const query = preserved.toString();
    window.location.href = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
  };

  return (
    <div className="fixed left-2 top-1/2 z-[10001] -translate-y-1/2">
      <button
        onClick={handleClear}
        className="rounded bg-red-600 px-3 py-1 font-mono text-xs text-white shadow-lg hover:bg-red-700"
        title="Development only: Clear localStorage and sessionStorage"
      >
        Clear LS
      </button>
    </div>
  );
}
