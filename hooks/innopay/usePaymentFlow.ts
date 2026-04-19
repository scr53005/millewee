/**
 * usePaymentFlow Hook
 * Main orchestration hook for payment flows.
 *
 * Adapted from croque-bedaine for Next.js App Router:
 *   - react-router-dom useSearchParams → next/navigation useSearchParams + useRouter
 *   - setSearchParams({...}) → router.replace('?...')
 *   - localStorage reads guarded for SSR
 *   - Trilingual (FR/EN/LB) banner messages via `language` option
 */

'use client';

import React, { useReducer, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  paymentReducer,
  initialPaymentState,
  PaymentState,
  PaymentEvent,
  FlowType,
  Credentials,
  Language,
  getBannerMessage,
} from '@/lib/innopay/paymentStateMachine';
import {
  getInnopayUrl,
  distriate,
  checkDuplicateMemo,
  storeMemoBeforeOrder,
} from '@/lib/innopay/utils';

// Guest checkout processing fee (5%)
const GUEST_CHECKOUT_FEE_RATE = 0.05;

/** Round UP to nearest cent for guest checkout total with 5% processing fee. */
function calculateGuestCheckoutTotal(baseAmount: number): number {
  const totalWithFee = baseAmount * (1 + GUEST_CHECKOUT_FEE_RATE);
  return Math.ceil(totalWithFee * 100) / 100;
}

/** Trilingual message map for in-hook dispatches (not banner defaults). */
const messages: Record<Language, {
  waiterCalling: string;
  paying: string;
  finalizing: string;
  orderTransmitted: string;
  accountCreatedAndOrder: string;
  processorTimeout: string;
  paymentError: string;
  waiterCallFailed: string;
  finalizationError: string;
  flow6PayError: string;
}> = {
  fr: {
    waiterCalling: 'Appel en cours...',
    paying: 'Paiement en cours...',
    finalizing: 'Finalisation de la commande...',
    orderTransmitted: 'Votre commande a été transmise en cuisine!',
    accountCreatedAndOrder: 'Compte créé et commande transmise!',
    processorTimeout: 'Le processeur de paiements ne répond pas. Veuillez réessayer ou contacter contact@innopay.lu',
    paymentError: 'Erreur lors du paiement. Veuillez contacter contact@innopay.lu',
    waiterCallFailed: "Echec de l'appel serveur",
    finalizationError: 'Une erreur est survenue lors de la finalisation',
    flow6PayError: 'Erreur lors du paiement',
  },
  en: {
    waiterCalling: 'Calling waiter...',
    paying: 'Processing payment...',
    finalizing: 'Finalizing order...',
    orderTransmitted: 'Your order has been sent to the kitchen!',
    accountCreatedAndOrder: 'Account created and order transmitted!',
    processorTimeout: 'The payment processor is not responding. Please try again or contact contact@innopay.lu',
    paymentError: 'Payment error. Please contact contact@innopay.lu',
    waiterCallFailed: 'Waiter call failed',
    finalizationError: 'An error occurred during finalization',
    flow6PayError: 'Payment error',
  },
  lb: {
    waiterCalling: 'Kellner g\u00ebtt geruff...',
    paying: 'Bezuelung leeft...',
    finalizing: 'Bestellung g\u00ebtt ofgeschloss...',
    orderTransmitted: '\u00c4r Bestellung gouf an d\'Kichen geschéckt!',
    accountCreatedAndOrder: 'Kont erstallt a Bestellung iwwerdroen!',
    processorTimeout: 'De Bezuelungsprozessor \u00e4ntwert net. Probéiert nach eng Kéier oder kontaktéiert contact@innopay.lu',
    paymentError: 'Bezuelungsfehler. Kontaktéiert w.e.g. contact@innopay.lu',
    waiterCallFailed: 'Kellner-Ruff feelgeschloen',
    finalizationError: 'E Fehler ass beim Ofschloss opgetrueden',
    flow6PayError: 'Bezuelungsfehler',
  },
};

interface UsePaymentFlowOptions {
  cartTotal: number;
  cartMemo: string;
  table: string;
  restaurantId: string;
  hiveAccount: string;
  language?: Language;
  onCartClear: () => void;
  onCredentialsReceived?: (credentials: Credentials) => void;
  onPaymentSuccess?: (newBalance: number) => void;
  onDuplicateDetected?: () => void;
  onPulseStart?: (memoPrefix: string) => void;
  skipDuplicateCheckRef?: React.MutableRefObject<boolean>;
}

interface PaymentFlowUI {
  showFlowSelector: boolean;
  showYellowBanner: boolean;
  showGreenBanner: boolean;
  showGreyBanner: boolean;
  showRedirectingBanner: boolean;
  showMiniWallet: boolean;
  isLoading: boolean;
  bannerMessage: string;
  errorMessage: string | null;
  canRetry: boolean;
}

interface PaymentFlowActions {
  openFlowSelector: () => void;
  selectFlow: (flow: FlowType) => Promise<void>;
  payWithAccount: (currentBalance: number) => Promise<void>;
  callWaiter: (reason?: string) => Promise<void>;
  retry: () => void;
  reset: () => void;
  dismissBanner: () => void;
}

interface UsePaymentFlowReturn {
  state: PaymentState;
  ui: PaymentFlowUI;
  actions: PaymentFlowActions;
  hasAccount: boolean;
}

export function usePaymentFlow(options: UsePaymentFlowOptions): UsePaymentFlowReturn {
  const {
    cartTotal,
    cartMemo,
    table,
    restaurantId,
    hiveAccount,
    language = 'fr',
    onCartClear,
    onCredentialsReceived,
    onPaymentSuccess,
    onDuplicateDetected,
    onPulseStart,
    skipDuplicateCheckRef,
  } = options;

  const t = messages[language] || messages.fr;
  const hubUrl = getInnopayUrl();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [state, dispatch] = useReducer(paymentReducer, initialPaymentState);

  // Check if user has an account (read once at mount; localStorage guarded)
  const hasAccount = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('innopay_accountName');
  }, []);

  // Derive UI state from machine state
  const ui = useMemo((): PaymentFlowUI => ({
    showFlowSelector: state.status === 'selecting_flow',
    showRedirectingBanner: state.status === 'redirecting',
    showYellowBanner: state.status === 'processing',
    showGreenBanner: state.status === 'success' || state.status === 'waiter_called',
    showGreyBanner: state.status === 'error',
    showMiniWallet: state.status === 'account_created' || hasAccount,
    isLoading: state.status === 'redirecting' || state.status === 'processing',
    bannerMessage: getBannerMessage(state, language),
    errorMessage: state.status === 'error' ? state.error : null,
    canRetry: state.status === 'error' && state.canRetry,
  }), [state, hasAccount, language]);

  // Helper to clean URL params while preserving `?table=N`
  const cleanUrl = useCallback(() => {
    const tableParam = searchParams.get('table');
    const target = tableParam ? `${pathname}?table=${tableParam}` : pathname;
    router.replace(target);
  }, [router, pathname, searchParams]);

  // Handle return from hub (URL params)
  useEffect(() => {
    const paymentSuccess = searchParams.get('payment');
    const orderSuccess = searchParams.get('order_success');
    const topupSuccess = searchParams.get('topup_success');
    const sessionId = searchParams.get('session_id');
    const credentialToken = searchParams.get('credential_token');
    const error = searchParams.get('error');

    const isReturn =
      paymentSuccess === 'success' ||
      orderSuccess === 'true' ||
      topupSuccess === 'true' ||
      sessionId ||
      credentialToken;

    if (isReturn) {
      console.log('[usePaymentFlow] Detected return from hub:', {
        paymentSuccess,
        orderSuccess,
        topupSuccess,
        sessionId: !!sessionId,
        credentialToken: !!credentialToken,
      });
      dispatch({ type: 'RETURN_FROM_HUB', params: searchParams });
      processHubReturn(
        searchParams,
        dispatch,
        onCartClear,
        t,
        onCredentialsReceived,
        hubUrl,
        onPulseStart,
      );
      cleanUrl();
    } else if (paymentSuccess === 'cancelled') {
      console.log('[usePaymentFlow] Payment cancelled by user');
      dispatch({ type: 'RESET' });
      cleanUrl();
    } else if (error) {
      dispatch({ type: 'ERROR', error: decodeURIComponent(error) });
      cleanUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Actions
  const openFlowSelector = useCallback(() => {
    dispatch({ type: 'OPEN_FLOW_SELECTOR', cartTotal, hasAccount });
  }, [cartTotal, hasAccount]);

  const selectFlow = useCallback(
    async (flow: FlowType) => {
      dispatch({ type: 'SELECT_FLOW', flow });

      // Flow 6 is handled locally by payWithAccount, not here
      if (flow === 6) return;

      try {
        // 'gst' for guest checkout (internal invoice only), 'kcs' for Distriator cashback
        const distriateTag = flow === 3 ? 'gst' : 'kcs';
        const distriateSuffix = distriate(distriateTag);
        const memoWithSuffix = `${cartMemo} ${distriateSuffix}`;

        // Level 2 duplicate check
        if (!skipDuplicateCheckRef?.current && checkDuplicateMemo(memoWithSuffix)) {
          console.log(`[FLOW ${flow}] Duplicate memo detected, showing warning modal`);
          onDuplicateDetected?.();
          dispatch({ type: 'RESET' });
          return;
        }
        if (skipDuplicateCheckRef) skipDuplicateCheckRef.current = false;
        storeMemoBeforeOrder(memoWithSuffix);

        // Build return URL (preserving table parameter if set)
        const returnUrl = table
          ? `${window.location.origin}${window.location.pathname}?table=${table}`
          : `${window.location.origin}${window.location.pathname}`;

        // Flows 4, 5, 7 — redirect to hub /user page
        if (flow === 4 || flow === 5 || flow === 7) {
          const baseUrl = `${hubUrl}/user`;
          const params = new URLSearchParams();
          params.set('restaurant', restaurantId);
          params.set('restaurant_account', hiveAccount);
          params.set('table', table);
          params.set('order_amount', cartTotal.toFixed(2));
          params.set('memo', memoWithSuffix);
          params.set('return_url', returnUrl);

          if (flow === 4 || flow === 5) {
            params.set('choice', 'create');
          }

          if (flow === 7) {
            const accountName = localStorage.getItem('innopay_accountName');
            if (accountName) params.set('account', accountName);
            params.set('topup_for', 'order');
          }

          const flowMarkers: Record<number, string> = {
            4: 'flow4_create_account_only',
            5: 'flow5_create_and_pay',
            7: 'flow7_topup_and_pay',
          };
          const flowMarker = flowMarkers[flow];
          localStorage.setItem('innopay_flow_pending', flowMarker);
          console.log(`[FLOW ${flow}] Set flow marker: ${flowMarker}`);
          console.log(`[FLOW ${flow}] Redirecting to: ${baseUrl}?${params.toString()}`);

          dispatch({ type: 'START_REDIRECT', returnUrl: `${baseUrl}?${params.toString()}` });
          window.location.href = `${baseUrl}?${params.toString()}`;
          return;
        }

        // Flow 3 — guest checkout via API POST
        let endpoint = '';
        let body: Record<string, unknown> = {};

        if (flow === 3) {
          endpoint = `${hubUrl}/api/checkout/guest`;
          const guestTotal = calculateGuestCheckoutTotal(cartTotal);
          console.log(`[selectFlow] Guest checkout: ${cartTotal}€ + 5% fee = ${guestTotal}€`);
          body = {
            amountEuro: guestTotal,
            recipient: hiveAccount,
            memo: memoWithSuffix,
            returnUrl,
            table,
            restaurantId,
          };
        }

        console.log('[selectFlow] POST to:', endpoint, body);

        // 30s timeout to avoid infinite spinner
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Checkout failed: ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log('[selectFlow] Response:', data);

        const { url } = data;
        if (url) {
          dispatch({ type: 'START_REDIRECT', returnUrl: url });
          window.location.href = url;
        } else {
          throw new Error('No redirect URL received from server');
        }
      } catch (err) {
        console.error('[selectFlow] Error:', err);
        const isTimeout = err instanceof DOMException && err.name === 'AbortError';
        dispatch({
          type: 'ERROR',
          error: isTimeout
            ? t.processorTimeout
            : err instanceof Error
              ? err.message
              : t.paymentError,
          canRetry: true,
        });
      }
    },
    [
      cartTotal,
      cartMemo,
      table,
      hubUrl,
      restaurantId,
      hiveAccount,
      onDuplicateDetected,
      skipDuplicateCheckRef,
      t,
    ],
  );

  const callWaiter = useCallback(
    async (reason?: string) => {
      dispatch({ type: 'SELECT_FLOW', flow: 6 });
      dispatch({ type: 'PROCESSING_UPDATE', message: t.waiterCalling });

      try {
        await executeWaiterCall(table, hiveAccount, hubUrl, hasAccount, reason);
        dispatch({ type: 'WAITER_CALLED', table });
      } catch (err) {
        console.error('[callWaiter] Error:', err);
        dispatch({ type: 'ERROR', error: t.waiterCallFailed, canRetry: true });
      }
    },
    [table, hiveAccount, hubUrl, hasAccount, t],
  );

  // Flow 6 — pay directly with existing account (no redirect)
  const payWithAccount = useCallback(
    async (currentBalance: number) => {
      // Level 2 duplicate check
      const tempMemo = `${cartMemo} kcs-inno-check`;
      if (!skipDuplicateCheckRef?.current && checkDuplicateMemo(tempMemo)) {
        console.log('[FLOW 6] Duplicate memo detected, showing warning modal');
        onDuplicateDetected?.();
        return;
      }
      if (skipDuplicateCheckRef) skipDuplicateCheckRef.current = false;
      storeMemoBeforeOrder(tempMemo);

      dispatch({ type: 'SELECT_FLOW', flow: 6 });
      dispatch({ type: 'PROCESSING_UPDATE', message: t.paying });

      try {
        console.log('[FLOW 6] Starting payment:', { cartTotal, currentBalance, hiveAccount });

        await executeFlow6Payment(cartTotal, cartMemo, table, hiveAccount, hubUrl);

        const newBalance = Math.max(0, currentBalance - cartTotal);

        // 12s cooldown for blockchain propagation (Hive block = 3s + Hive-Engine indexing 3-10s)
        const FLOW6_COOLDOWN_MS = 12000;
        const cooldownUntil = Date.now() + FLOW6_COOLDOWN_MS;
        localStorage.setItem('innopay_balance_trustUntil', cooldownUntil.toString());
        localStorage.setItem('innopay_flow6_cooldown_until', cooldownUntil.toString());
        console.log('[FLOW 6] Cooldown set for 12s — blockchain needs time to finalize');

        onCartClear();
        onPaymentSuccess?.(newBalance);

        dispatch({
          type: 'PAYMENT_SUCCESS',
          message: t.orderTransmitted,
        });

        console.log('[FLOW 6] Payment successful, new balance:', newBalance);

        // Level 3 guardrail: post-order pulsing
        const storedMemo = localStorage.getItem('innopay_latestMemoContent');
        if (storedMemo) onPulseStart?.(storedMemo);
      } catch (err) {
        console.error('[FLOW 6] Payment error:', err);
        dispatch({
          type: 'ERROR',
          error: err instanceof Error ? err.message : t.flow6PayError,
          canRetry: true,
        });
      }
    },
    [
      cartTotal,
      cartMemo,
      table,
      hiveAccount,
      hubUrl,
      onCartClear,
      onPaymentSuccess,
      onPulseStart,
      onDuplicateDetected,
      skipDuplicateCheckRef,
      t,
    ],
  );

  const retry = useCallback(() => dispatch({ type: 'RETRY' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const dismissBanner = useCallback(() => dispatch({ type: 'DISMISS_BANNER' }), []);

  const actions: PaymentFlowActions = useMemo(
    () => ({
      openFlowSelector,
      selectFlow,
      payWithAccount,
      callWaiter,
      retry,
      reset,
      dismissBanner,
    }),
    [openFlowSelector, selectFlow, payWithAccount, callWaiter, retry, reset, dismissBanner],
  );

  return { state, ui, actions, hasAccount };
}

// ============================================================================
// HELPERS
// ============================================================================

async function processHubReturn(
  params: URLSearchParams | ReturnType<typeof useSearchParams>,
  dispatch: React.Dispatch<PaymentEvent>,
  onCartClear: () => void,
  t: typeof messages[Language],
  onCredentialsReceived?: (credentials: Credentials) => void,
  hubUrl?: string,
  onPulseStart?: (memoPrefix: string) => void,
) {
  dispatch({ type: 'PROCESSING_UPDATE', message: t.finalizing });

  try {
    const sessionId = params.get('session_id');
    const credentialToken = params.get('credential_token');
    const orderSuccess = params.get('order_success');

    let credentialsFetched = false;
    const flowPending = localStorage.getItem('innopay_flow_pending');
    const shouldFetchCredentials = credentialToken || (sessionId && flowPending !== null);

    if (hubUrl && shouldFetchCredentials) {
      console.log('[processHubReturn] Fetching credentials:', {
        credentialToken: !!credentialToken,
        sessionId: !!sessionId,
        flowPending,
      });

      const response = await fetch(`${hubUrl}/api/account/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentialToken ? { credentialToken } : { sessionId }),
      });

      if (response.ok) {
        const credentials = await response.json();
        console.log('[processHubReturn] Credentials received for account:', credentials.accountName);

        localStorage.setItem('innopay_accountName', credentials.accountName);
        localStorage.setItem('innopay_masterPassword', credentials.masterPassword);
        localStorage.setItem(
          'innopay_activePrivate',
          credentials.keys?.active?.privateKey || credentials.activeKey,
        );
        localStorage.setItem(
          'innopay_postingPrivate',
          credentials.keys?.posting?.privateKey || credentials.postingKey,
        );

        if (credentials.euroBalance !== undefined) {
          localStorage.setItem('innopay_lastBalance', credentials.euroBalance.toFixed(2));
          localStorage.setItem('innopay_lastBalance_timestamp', Date.now().toString());
          console.log('[processHubReturn] Stored balance to cache:', credentials.euroBalance);

          // Trust window: Flow 4 always; Flow 5 only if sessionId (true Flow 5, not Flow 5→6/7)
          const currentFlow = localStorage.getItem('innopay_flow_pending');
          if (
            currentFlow === 'flow4_create_account_only' ||
            (currentFlow === 'flow5_create_and_pay' && sessionId)
          ) {
            const trustUntil = Date.now() + 60 * 1000;
            localStorage.setItem('innopay_balance_trustUntil', trustUntil.toString());
            const flowName =
              currentFlow === 'flow4_create_account_only' ? 'Flow 4' : 'Flow 5 (true)';
            console.log(
              `[${flowName}] Balance trust window set until:`,
              new Date(trustUntil).toISOString(),
              '- webhook calculated balance is accurate',
            );
          } else if (currentFlow === 'flow5_create_and_pay' && credentialToken) {
            console.log('[Flow 5→6/7] Existing account found - will fetch balance from blockchain');
          }
        }

        onCredentialsReceived?.(credentials);
        credentialsFetched = true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[processHubReturn] Failed to fetch credentials:', response.status, errorData);
      }
    }

    const paymentSuccess = params.get('payment');
    const topupSuccess = params.get('topup_success');
    const hasPayment =
      paymentSuccess === 'success' || orderSuccess === 'true' || topupSuccess === 'true';

    if (hasPayment || sessionId) {
      onCartClear();
      dispatch({
        type: 'PAYMENT_SUCCESS',
        orderId: sessionId || undefined,
        message: credentialsFetched ? t.accountCreatedAndOrder : t.orderTransmitted,
      });

      localStorage.removeItem('innopay_flow_pending');

      const storedMemo = localStorage.getItem('innopay_latestMemoContent');
      if (storedMemo) onPulseStart?.(storedMemo);

      // Safari/iOS balance refresh workaround — reload after 1s for account-bearing flows
      if (credentialsFetched || orderSuccess === 'true') {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } else if (credentialsFetched) {
      // Flow 4 (account creation only, no payment)
      dispatch({
        type: 'ACCOUNT_CREATED',
        credentials: {} as Credentials,
      });
      localStorage.removeItem('innopay_flow_pending');
    }
  } catch (err) {
    console.error('[processHubReturn] Error:', err);
    dispatch({
      type: 'ERROR',
      error: t.finalizationError,
      canRetry: true,
    });
  }
}

async function executeWaiterCall(
  table: string,
  hiveAccount: string,
  hubUrl: string,
  hasAccount: boolean,
  reason?: string,
): Promise<void> {
  const { encodeComment, distriate } = await import('@/lib/innopay/utils');
  const reasonEncoded = reason?.trim() ? ` n:${encodeComment(reason.trim())}` : '';

  if (hasAccount) {
    const { signAndBroadcastOperation, createEuroTransferOperation } = await import(
      '@/lib/innopay/utils'
    );
    const activeKey = localStorage.getItem('innopay_activePrivate');
    const accountName = localStorage.getItem('innopay_accountName');

    if (!activeKey || !accountName) {
      throw new Error('Missing credentials');
    }

    const suffix = distriate();
    const operation = createEuroTransferOperation(
      accountName,
      hiveAccount,
      '0.020',
      `Un serveur est appele${reasonEncoded} TABLE ${table} ${suffix}`,
    );

    await signAndBroadcastOperation(operation, activeKey);
  } else {
    window.location.href = `${hubUrl}/waiter?table=${table}&recipient=${hiveAccount}`;
  }
}

/**
 * Flow 6 — two-leg dual-currency payment.
 *   Leg 1: Customer → innopay (EURO collateral, signed via hub)
 *   Leg 2: innopay → restaurant (HBD preferred, EURO fallback, debt tracking)
 */
async function executeFlow6Payment(
  amount: number,
  memo: string,
  table: string,
  hiveAccount: string,
  hubUrl: string,
): Promise<void> {
  const { createEuroTransferOperation, distriate } = await import('@/lib/innopay/utils');

  const accountName = localStorage.getItem('innopay_accountName')!;
  const activeKey = localStorage.getItem('innopay_activePrivate');
  const masterPassword = localStorage.getItem('innopay_masterPassword');

  const suffix = distriate('kcs');
  const amountEuro = amount.toFixed(3);

  // ── Leg 1: Customer → innopay (EURO collateral) ──
  // Include the full cart memo alongside the distriate suffix so the customer-leg
  // transfer on-chain reflects what was ordered (not just an opaque tag). Matches
  // the memo format used on other flows.
  const memoWithSuffix = memo ? `${memo} ${suffix}` : suffix;
  const euroOp = createEuroTransferOperation(accountName, 'innopay', amountEuro, memoWithSuffix);

  const signPayload: Record<string, unknown> = { operation: euroOp };
  if (activeKey) {
    signPayload.activePrivateKey = activeKey;
  } else if (masterPassword) {
    signPayload.masterPassword = masterPassword;
    signPayload.accountName = accountName;
  }

  console.log('[FLOW 6] Leg 1: Signing EURO transfer to innopay via hub...');
  const signResponse = await fetch(`${hubUrl}/api/sign-and-broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signPayload),
  });

  if (!signResponse.ok) {
    const errData = await signResponse.json().catch(() => ({}));
    throw new Error(errData.message || errData.error || 'Échec de la signature du transfert EURO');
  }

  const { txId: customerTxId, usedFallback } = await signResponse.json();
  console.log(
    `[FLOW 6] Leg 1 OK: EURO transfer TX ${customerTxId}${usedFallback ? ' (innopay authority fallback)' : ''}`,
  );

  // ── Leg 2: innopay → restaurant (HBD sweep + restaurant transfer) ──
  console.log('[FLOW 6] Leg 2: Calling wallet-payment for restaurant transfer...');
  const wpResponse = await fetch(`${hubUrl}/api/wallet-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerAccount: accountName,
      customerTxId,
      recipient: hiveAccount,
      amountEuro,
      orderMemo: memo,
      distriateSuffix: suffix,
    }),
  });

  if (!wpResponse.ok) {
    const errData = await wpResponse.json().catch(() => ({}));
    throw new Error(
      errData.message ||
        errData.error ||
        "Votre paiement a été reçu par Innopay mais la commande n'a pas pu être transmise au restaurant. Veuillez contacter le personnel.",
    );
  }

  const result = await wpResponse.json();
  console.log('[FLOW 6] Leg 2 OK:', {
    innopayTxId: result.innopayTxId,
    transferType: result.innopayTransferType,
    customerHbdShortfall: result.customerHbdShortfall,
  });
}
