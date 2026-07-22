import { PrivateKey, cryptoUtils } from '@hiveio/dhive';

// Secure wallet hand-off: SPOKE → HUB. The spoke holds the wallet (active+memo);
// to move it to wallet.innopay.lu WITHOUT a round-trip and WITHOUT exposing any
// private key, the spoke builds a SELF-TIMESTAMPED challenge and signs it with the
// ACTIVE key. The customer navigates to the hub carrying (account, ts, nonce, sig);
// the hub verifies the signature against the account's on-chain ACTIVE authority
// (proof of possession), checks freshness + single-use, then imports active+memo
// from ITS OWN DB. No secret ever rides in the URL — only a public account name
// and a one-time signature. Active-key (not memo): we're handing out the active
// key, so the customer must prove they hold it (no memo→active escalation).

const HANDOFF_PREFIX = 'innopay-wallet-handoff';

export interface HandoffProof {
  account: string;
  ts: number; // ms epoch, for freshness
  nonce: string; // random, for single-use
  sig: string; // active-key signature over the message
}

/** The exact string that gets signed — hub rebuilds it identically to verify. */
export function handoffMessage(account: string, ts: number, nonce: string): string {
  return `${HANDOFF_PREFIX}:${account}:${ts}:${nonce}`;
}

/**
 * Build + sign a hand-off proof with the account's ACTIVE private key (WIF, from
 * the keystore). Client-side dhive signing — the key never leaves the device.
 */
export function buildHandoffProof(account: string, activeWif: string): HandoffProof {
  const ts = Date.now();
  const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const message = handoffMessage(account, ts, nonce);
  const sig = PrivateKey.fromString(activeWif).sign(cryptoUtils.sha256(message)).toString();
  return { account, ts, nonce, sig };
}

/** Encode a proof as URL search params for the hub navigation. */
export function handoffParams(proof: HandoffProof): Record<string, string> {
  return {
    handoff_account: proof.account,
    handoff_ts: String(proof.ts),
    handoff_nonce: proof.nonce,
    handoff_sig: proof.sig,
  };
}
