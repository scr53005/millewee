/**
 * GET /api/balance/euro?account=<accountName>
 * Fetches EURO token balance from Hive-Engine.
 *
 * Tries multiple Hive-Engine endpoints with a 5s per-endpoint timeout.
 * Returns 503 if all endpoints fail.
 *
 * TODO: port indiesmenu's HBD→EUR fallback (requires `lib/currency-service.ts`).
 */

import { NextRequest, NextResponse } from 'next/server';

const HIVE_ENGINE_ENDPOINTS = [
  'https://api.hive-engine.com/rpc/contracts',
  'https://engine.rishipanthee.com/contracts',
  'https://herpc.dtools.dev/contracts',
];

const TIMEOUT_MS = 5000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountName = searchParams.get('account');

  if (!accountName) {
    return NextResponse.json({ error: 'Missing account parameter' }, { status: 400 });
  }

  console.log('[BALANCE API] Fetching EURO balance for:', accountName);

  for (const endpoint of HIVE_ENGINE_ENDPOINTS) {
    try {
      console.log('[BALANCE API] Trying Hive-Engine endpoint:', endpoint);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const balanceResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'find',
          params: {
            contract: 'tokens',
            table: 'balances',
            query: {
              account: accountName,
              symbol: 'EURO',
            },
          },
          id: 1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!balanceResponse.ok) {
        console.warn(
          '[BALANCE API] Non-OK response:',
          balanceResponse.status,
          balanceResponse.statusText,
        );
        continue;
      }

      const balanceData = await balanceResponse.json();

      if (balanceData.result && balanceData.result.length > 0) {
        const euroBalance = parseFloat(balanceData.result[0].balance);
        console.log('[BALANCE API] ✓ EURO balance:', euroBalance);

        return NextResponse.json({
          balance: euroBalance,
          source: 'hive-engine',
          endpoint,
        });
      }

      // Empty result = account has no EURO balance yet (valid state)
      console.log('[BALANCE API] Empty result — account has no EURO token balance');
      return NextResponse.json({
        balance: 0,
        source: 'hive-engine',
        endpoint,
      });
    } catch (error) {
      const err = error as { message?: string; name?: string };
      console.warn('[BALANCE API] Endpoint failed:', endpoint, {
        name: err.name,
        message: err.message,
      });
      // Try next endpoint
    }
  }

  return NextResponse.json(
    { error: 'Unable to fetch balance from any Hive-Engine endpoint' },
    { status: 503 },
  );
}
