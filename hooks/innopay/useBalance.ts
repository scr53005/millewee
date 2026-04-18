/**
 * useBalance Hook
 * React Query hook for fetching and managing account balance
 * Adapted from croque-bedaine for Next.js (no changes needed — import path is identical)
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchEuroBalance,
  getCachedBalance,
  saveCachedBalance,
  type BalanceResponse,
} from '@/lib/innopay/balance';

interface UseBalanceOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

interface UseBalanceReturn {
  balance: number | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  source: string | null;
  refetch: () => void;
  updateBalance: (newBalance: number) => void;
}

/**
 * Hook to fetch and manage EURO balance for a Hive account.
 *
 * Features:
 * - Automatic caching (React Query)
 * - Optimistic localStorage fallback via placeholderData
 * - Trust window for Flow 4/5 (new account creation) — blockchain takes time to propagate
 * - Optimistic updates (for post-payment scenarios)
 */
export function useBalance(
  accountName: string | null,
  options: UseBalanceOptions = {}
): UseBalanceReturn {
  const { enabled = true, refetchInterval = false } = options;
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, status, fetchStatus } = useQuery<
    BalanceResponse,
    Error
  >({
    queryKey: ['balance', accountName],
    queryFn: async () => {
      console.log('[useBalance] Fetching balance for:', accountName);
      if (!accountName) {
        throw new Error('No account name provided');
      }

      // Trust window for Flow 4/5 — webhook has full control of balance calculation,
      // blockchain may lag behind. Read from cache until window expires.
      if (typeof window !== 'undefined') {
        const trustUntil = localStorage.getItem('innopay_balance_trustUntil');
        if (trustUntil) {
          const trustUntilTime = parseInt(trustUntil);
          const now = Date.now();

          if (now < trustUntilTime) {
            const cached = getCachedBalance();
            if (cached) {
              const remainingSeconds = Math.ceil((trustUntilTime - now) / 1000);
              console.log(
                '[useBalance] Trust window active (',
                remainingSeconds,
                's remaining) - using webhook-calculated balance:',
                cached.balance
              );
              return {
                balance: cached.balance,
                source: 'webhook-trusted-cache',
                timestamp: cached.timestamp,
              };
            }
          } else {
            console.log('[useBalance] Trust window expired - switching to blockchain query');
            localStorage.removeItem('innopay_balance_trustUntil');
          }
        }
      }

      console.log('[useBalance] Fetching fresh balance from blockchain');
      const result = await fetchEuroBalance(accountName);
      saveCachedBalance(result.balance, result.timestamp);

      console.log(
        '[useBalance] Fresh balance received:',
        result.balance,
        'source:',
        result.source
      );
      return result;
    },
    enabled: enabled && !!accountName,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval,
    placeholderData: () => {
      if (!accountName) return undefined;

      const cached = getCachedBalance();
      if (cached) {
        console.log(
          '[useBalance] Using cached balance as placeholder:',
          cached.balance,
          '(will refetch fresh data immediately)'
        );
        return {
          balance: cached.balance,
          source: 'localStorage-cache',
          timestamp: cached.timestamp,
        };
      }
      return undefined;
    },
    retry: 2,
  });

  if (enabled && accountName) {
    console.log('[useBalance] Query state:', {
      accountName,
      status,
      fetchStatus,
      hasData: !!data,
      balance: data?.balance,
      source: data?.source,
    });
  }

  const updateBalanceMutation = useMutation({
    mutationFn: async (newBalance: number) => {
      saveCachedBalance(newBalance);
      return newBalance;
    },
    onSuccess: (newBalance) => {
      queryClient.setQueryData<BalanceResponse>(['balance', accountName], () => ({
        balance: newBalance,
        source: 'optimistic-update',
        timestamp: Date.now(),
      }));
      console.log('[useBalance] Optimistic balance update:', newBalance);
    },
  });

  return {
    balance: data?.balance ?? null,
    isLoading,
    isError,
    error: error as Error | null,
    source: data?.source ?? null,
    refetch: () => {
      refetch();
    },
    updateBalance: (newBalance: number) => {
      updateBalanceMutation.mutate(newBalance);
    },
  };
}

/**
 * Helper hook to invalidate balance query (force refetch).
 * Useful after payments or top-ups.
 */
export function useInvalidateBalance() {
  const queryClient = useQueryClient();

  return (accountName: string) => {
    console.log('[useBalance] Invalidating balance cache for:', accountName);
    queryClient.invalidateQueries({ queryKey: ['balance', accountName] });
  };
}
