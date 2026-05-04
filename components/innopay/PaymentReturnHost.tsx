'use client';

import { Suspense, useEffect, useReducer } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/hooks/use-cart';
import { useWalletPulse } from '@/hooks/use-wallet-pulse';
import { useI18n } from '@/lib/i18n';
import {
  initialPaymentState,
  paymentReducer,
  type Credentials,
  type Language,
} from '@/lib/innopay/paymentStateMachine';
import { getInnopayUrl } from '@/lib/innopay/utils';
import StatusBanners from './StatusBanners';

const messages: Record<Language, {
  finalizing: string;
  orderTransmitted: string;
  accountCreatedAndOrder: string;
  finalizationError: string;
}> = {
  fr: {
    finalizing: 'Finalisation de la commande...',
    orderTransmitted: 'Votre commande a ete transmise en cuisine!',
    accountCreatedAndOrder: 'Compte cree et commande transmise!',
    finalizationError: 'Une erreur est survenue lors de la finalisation',
  },
  en: {
    finalizing: 'Finalizing order...',
    orderTransmitted: 'Your order has been sent to the kitchen!',
    accountCreatedAndOrder: 'Account created and order transmitted!',
    finalizationError: 'An error occurred during finalization',
  },
  lb: {
    finalizing: 'Bestellung gett ofgeschloss...',
    orderTransmitted: "Ar Bestellung gouf an d'Kichen gescheckt!",
    accountCreatedAndOrder: 'Kont erstallt a Bestellung iwwerdroen!',
    finalizationError: 'E Fehler ass beim Ofschloss opgetrueden',
  },
};

interface PaymentReturnHostProps {
  language?: Language;
}

function notifyCredentialsChanged() {
  window.dispatchEvent(new Event('innopay:credentials-updated'));
}

function cleanPaymentParams(
  params: ReturnType<typeof useSearchParams>,
  pathname: string,
  router: ReturnType<typeof useRouter>,
) {
  const next = new URLSearchParams();
  const table = params.get('table');
  const menu = params.get('menu');

  if (table) next.set('table', table);
  if (menu) next.set('menu', menu);

  const qs = next.toString();
  router.replace(qs ? `${pathname}?${qs}` : pathname);
}

function PaymentReturnHostInner({ language = 'fr' }: PaymentReturnHostProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { clearCart } = useCart();
  const { startOrderPulsing } = useWalletPulse();
  const [state, dispatch] = useReducer(paymentReducer, initialPaymentState);
  const t = messages[language] || messages.fr;

  useEffect(() => {
    const paymentSuccess = searchParams.get('payment');
    const accountCreated = searchParams.get('account_created');
    const orderSuccess = searchParams.get('order_success');
    const topupSuccess = searchParams.get('topup_success');
    const sessionId = searchParams.get('session_id');
    const credentialToken = searchParams.get('credential_token');
    const error = searchParams.get('error');

    const isReturn =
      paymentSuccess === 'success' ||
      accountCreated === 'true' ||
      orderSuccess === 'true' ||
      topupSuccess === 'true' ||
      sessionId ||
      credentialToken;

    if (!isReturn && paymentSuccess !== 'cancelled' && !error) return;

    if (paymentSuccess === 'cancelled') {
      dispatch({ type: 'RESET' });
      cleanPaymentParams(searchParams, pathname, router);
      return;
    }

    if (error) {
      dispatch({ type: 'RETURN_FROM_HUB', params: searchParams });
      dispatch({ type: 'ERROR', error: decodeURIComponent(error) });
      cleanPaymentParams(searchParams, pathname, router);
      return;
    }

    let cancelled = false;

    async function processReturn() {
      dispatch({ type: 'RETURN_FROM_HUB', params: searchParams });
      dispatch({ type: 'PROCESSING_UPDATE', message: t.finalizing });

      try {
        const hubUrl = getInnopayUrl();
        const flowPending = localStorage.getItem('innopay_flow_pending');
        const shouldFetchCredentials = credentialToken || (sessionId && flowPending !== null);
        let credentialsFetched = false;
        let credentials: Credentials | null = null;

        if (shouldFetchCredentials) {
          const response = await fetch(`${hubUrl}/api/account/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentialToken ? { credentialToken } : { sessionId }),
          });

          if (response.ok) {
            const data = await response.json();
            localStorage.setItem('innopay_accountName', data.accountName);
            localStorage.setItem('innopay_masterPassword', data.masterPassword);
            const activeKey = data.keys?.active?.privateKey || data.activeKey;
            const postingKey = data.keys?.posting?.privateKey || data.postingKey;
            const memoKey = data.keys?.memo?.privateKey || data.memoKey;
            if (activeKey) localStorage.setItem('innopay_activePrivate', activeKey);
            if (postingKey) localStorage.setItem('innopay_postingPrivate', postingKey);
            if (memoKey) localStorage.setItem('innopay_memoPrivate', memoKey);

            if (data.euroBalance !== undefined) {
              localStorage.setItem('innopay_lastBalance', data.euroBalance.toFixed(2));
              localStorage.setItem('innopay_lastBalance_timestamp', Date.now().toString());

              const currentFlow = localStorage.getItem('innopay_flow_pending');
              if (
                currentFlow === 'flow4_create_account_only' ||
                (currentFlow === 'flow5_create_and_pay' && sessionId)
              ) {
                localStorage.setItem(
                  'innopay_balance_trustUntil',
                  (Date.now() + 60 * 1000).toString(),
                );
              }
            }

            credentials = {
              accountName: data.accountName,
              masterPassword: data.masterPassword,
              activeKey: activeKey || '',
              postingKey: postingKey || '',
            };
            credentialsFetched = true;
            notifyCredentialsChanged();
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.warn('[PaymentReturnHost] Failed to fetch credentials:', response.status, errorData);
          }
        }

        const hasPayment =
          paymentSuccess === 'success' || orderSuccess === 'true' || topupSuccess === 'true';
        const isAccountOnly =
          accountCreated === 'true' || flowPending === 'flow4_create_account_only';

        if (cancelled) return;

        if (credentialsFetched && credentials && isAccountOnly && !hasPayment) {
          dispatch({ type: 'ACCOUNT_CREATED', credentials });
          localStorage.removeItem('innopay_flow_pending');
        } else if (hasPayment || sessionId) {
          clearCart();
          dispatch({
            type: 'PAYMENT_SUCCESS',
            orderId: sessionId || undefined,
            message: credentialsFetched ? t.accountCreatedAndOrder : t.orderTransmitted,
          });
          localStorage.removeItem('innopay_flow_pending');

          const storedMemo = localStorage.getItem('innopay_latestMemoContent');
          if (storedMemo) startOrderPulsing();
        } else if (credentialsFetched && credentials) {
          dispatch({ type: 'ACCOUNT_CREATED', credentials });
          localStorage.removeItem('innopay_flow_pending');
        }

        cleanPaymentParams(searchParams, pathname, router);

        if (credentialsFetched || orderSuccess === 'true') {
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (err) {
        console.error('[PaymentReturnHost] Error:', err);
        if (!cancelled) {
          dispatch({ type: 'ERROR', error: t.finalizationError, canRetry: true });
          cleanPaymentParams(searchParams, pathname, router);
        }
      }
    }

    processReturn();

    return () => {
      cancelled = true;
    };
  }, [clearCart, pathname, router, searchParams, startOrderPulsing, t]);

  const bannerStatus =
    state.status === 'redirecting'
      ? 'redirecting'
      : state.status === 'processing'
        ? 'processing'
        : state.status === 'success'
          ? 'success'
          : state.status === 'error'
            ? 'error'
            : state.status === 'account_created'
              ? 'account_created'
              : 'idle';

  return (
    <StatusBanners
      status={bannerStatus}
      message={
        state.status === 'success'
          ? state.message
          : state.status === 'error'
            ? state.error
            : state.status === 'processing'
              ? state.message
              : undefined
      }
      language={language}
      onDismiss={() => dispatch({ type: 'DISMISS_BANNER' })}
    />
  );
}

export function PaymentReturnHost(props: PaymentReturnHostProps) {
  const { language } = useI18n();

  return (
    <Suspense fallback={null}>
      <PaymentReturnHostInner language={props.language || language} />
    </Suspense>
  );
}

