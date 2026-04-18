/**
 * Sync transfers from merchant-hub Redis stream into our local `transfers` table.
 * This is the ONLY place that reads from the merchant-hub Redis stream and ACKs.
 *
 * Called periodically by the CO page (elected poller) or manually by an admin.
 *
 * Environment isolation:
 *   - PROD account: `millewee` → consumer group `sync-prod`
 *   - DEV account:  `innodemo` → consumer group `sync-dev`
 *   The two environments share the same Redis backing store but have separate
 *   consumer groups, so messages flow to exactly one environment.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || 'millewee';
const PROD_ACCOUNT = 'millewee';
const DEV_ACCOUNT = 'innodemo';

function getMerchantHubUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MERCHANT_HUB_URL || 'https://merchant-hub-theta.vercel.app'
  ).replace(/\/$/, '');
}

/** Determine which Hive account this deployment filters by. */
function getEnvironmentAccount(): string {
  const hiveAccount = process.env.HIVE_ACCOUNT || process.env.NEXT_PUBLIC_HIVE_ACCOUNT;

  if (hiveAccount) {
    console.warn(`[SYNC] Using HIVE_ACCOUNT from env: ${hiveAccount}`);
    return hiveAccount;
  }

  // Fallback: infer from POSTGRES_URL (dev uses localhost/innopaydb)
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  const isDev = databaseUrl.includes('localhost') || databaseUrl.includes('innopaydb');
  const account = isDev ? DEV_ACCOUNT : PROD_ACCOUNT;
  console.warn(`[SYNC] Using POSTGRES_URL detection: ${account}`);
  return account;
}

function getEnvLabel(account: string): 'prod' | 'dev' {
  return account === PROD_ACCOUNT ? 'prod' : 'dev';
}

export async function POST() {
  const merchantHubUrl = getMerchantHubUrl();
  const environmentAccount = getEnvironmentAccount();
  const env = getEnvLabel(environmentAccount);
  const consumerId = `sync-${env}`;

  console.warn(`[SYNC] Environment account: ${environmentAccount}, env: ${env}`);

  try {
    // 1. Consume from merchant-hub Redis stream
    const consumeRes = await fetch(
      `${merchantHubUrl}/api/transfers/consume?restaurantId=${RESTAURANT_ID}&consumerId=${consumerId}&count=50&env=${env}`,
    );

    if (!consumeRes.ok) {
      throw new Error(`Failed to consume from merchant-hub: ${consumeRes.statusText}`);
    }

    const data = await consumeRes.json();

    if (!data.transfers || data.transfers.length === 0) {
      return NextResponse.json({
        message: 'No new transfers',
        synced: 0,
        pending: data.pending || 0,
      });
    }

    console.warn(`[SYNC] Received ${data.transfers.length} transfers from merchant-hub`);

    // 2. Insert each transfer (filtered by environment account)
    const messagesToAck: string[] = [];
    let insertedCount = 0;
    let filteredCount = 0;

    for (const transfer of data.transfers) {
      try {
        // Belt-and-suspenders: only process transfers addressed to our account
        if (transfer.to_account !== environmentAccount) {
          filteredCount++;
          // ACK anyway — won't ever be relevant to this env, would otherwise loop via XAUTOCLAIM
          messagesToAck.push(transfer.messageId);
          continue;
        }

        const existing = await prisma.transfers.findUnique({
          where: { id: BigInt(transfer.id) },
        });

        if (!existing) {
          await prisma.transfers.create({
            data: {
              id: BigInt(transfer.id),
              from_account: transfer.from_account,
              to_account: transfer.to_account,
              amount: transfer.amount,
              symbol: transfer.symbol,
              memo: transfer.memo,
              parsed_memo: transfer.memo, // Hydrated at display time
              fulfilled: false,
              received_at: transfer.received_at
                ? new Date(transfer.received_at)
                : new Date(),
            },
          });
          console.warn(`[SYNC] Inserted transfer ${transfer.id} for ${transfer.to_account}`);
          insertedCount++;
        } else {
          console.warn(`[SYNC] Transfer ${transfer.id} already exists`);
        }

        messagesToAck.push(transfer.messageId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[SYNC] Error processing transfer ${transfer.id}:`, message);
        // Don't ACK this one — stays pending in Redis for retry
      }
    }

    // 3. ACK successfully processed messages
    if (messagesToAck.length > 0) {
      try {
        const ackRes = await fetch(`${merchantHubUrl}/api/transfers/ack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: RESTAURANT_ID,
            messageIds: messagesToAck,
            env,
          }),
        });

        if (ackRes.ok) {
          const ackData = await ackRes.json();
          console.warn(`[SYNC] ACKed ${ackData.acknowledged}/${messagesToAck.length} messages`);
        } else {
          console.error(`[SYNC] ACK failed:`, await ackRes.text());
        }
      } catch (err) {
        console.error('[SYNC] Failed to ACK messages:', err);
      }
    }

    return NextResponse.json({
      message: 'Sync completed',
      received: data.transfers.length,
      inserted: insertedCount,
      filtered: filteredCount,
      acked: messagesToAck.length,
      environment: environmentAccount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[SYNC] Error:', message);
    return NextResponse.json({ error: `Sync failed: ${message}` }, { status: 500 });
  }
}
