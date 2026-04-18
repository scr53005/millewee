/**
 * Balance API Module
 * Centralized balance fetching with localStorage sync
 * Adapted from croque-bedaine/src/lib/innopay/balance.ts
 */

export interface BalanceResponse {
  balance: number;
  source: string; // 'hive-engine' | 'localStorage-cache' | 'optimistic-update'
  timestamp: number;
}

const HIVE_ENGINE_API = 'https://api.hive-engine.com/rpc/contracts';

/**
 * Fetch EURO balance for a Hive account directly from Hive-Engine
 * (Client-side implementation - no API route needed)
 */
export async function fetchEuroBalance(accountName: string): Promise<BalanceResponse> {
  console.log('[BALANCE API] Fetching balance for:', accountName);

  try {
    const response = await fetch(HIVE_ENGINE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'find',
        params: {
          contract: 'tokens',
          table: 'balances',
          query: {
            account: accountName,
            symbol: 'EURO'
          },
          limit: 1
        },
        id: 1
      })
    });

    if (!response.ok) {
      throw new Error(`Hive-Engine API returned ${response.status}`);
    }

    const data = await response.json();
    const result = data.result?.[0];
    const euroBalance = result ? parseFloat(result.balance) : 0;

    console.log('[BALANCE API] Retrieved balance:', euroBalance, 'from hive-engine');

    return {
      balance: parseFloat(euroBalance.toFixed(2)),
      source: 'hive-engine',
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[BALANCE API] Fetch failed:', error);
    throw error;
  }
}

/**
 * Get cached balance from localStorage (optimistic fallback)
 */
export function getCachedBalance(): { balance: number; timestamp: number } | null {
  const cachedBalance = localStorage.getItem('innopay_lastBalance');
  const cachedTimestamp = localStorage.getItem('innopay_lastBalance_timestamp');

  if (!cachedBalance) {
    return null;
  }

  return {
    balance: parseFloat(cachedBalance),
    timestamp: cachedTimestamp ? parseInt(cachedTimestamp, 10) : 0,
  };
}

/**
 * Save balance to localStorage cache
 */
export function saveCachedBalance(balance: number, timestamp: number = Date.now()): void {
  localStorage.setItem('innopay_lastBalance', balance.toFixed(2));
  localStorage.setItem('innopay_lastBalance_timestamp', timestamp.toString());
  console.log('[BALANCE API] Cached balance:', balance);
}

/**
 * Check if cached balance is stale (older than 60 seconds)
 */
export function isCachedBalanceStale(): boolean {
  const cached = getCachedBalance();
  if (!cached) return true;

  const now = Date.now();
  const age = now - cached.timestamp;
  const isStale = age > 60000; // 60 seconds

  console.log('[BALANCE API] Cache age:', Math.round(age / 1000), 'seconds', isStale ? '(stale)' : '(fresh)');
  return isStale;
}
