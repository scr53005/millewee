/**
 * Payment State Machine
 * Manages payment flow states using useReducer pattern
 * Adapted from croque-bedaine with trilingual support (FR/EN/LB)
 *
 * States are mutually exclusive - no more "is yellow banner AND green banner visible?"
 */

// ============================================================================
// TYPES
// ============================================================================

export type FlowType = 3 | 4 | 5 | 6 | 7;

export interface Credentials {
  accountName: string;
  masterPassword: string;
  activeKey: string;
  postingKey: string;
}

export type PaymentState =
  | { status: 'idle' }
  | { status: 'selecting_flow'; cartTotal: number; hasAccount: boolean }
  | { status: 'redirecting'; flow: FlowType; returnUrl: string }
  | { status: 'processing'; flow: FlowType; sessionId?: string; message?: string }
  | { status: 'success'; flow: FlowType; orderId?: string; message: string }
  | { status: 'error'; flow: FlowType; error: string; canRetry: boolean }
  | { status: 'account_created'; credentials: Credentials; flow: FlowType }
  | { status: 'waiter_called'; table: string };

export type PaymentEvent =
  | { type: 'OPEN_FLOW_SELECTOR'; cartTotal: number; hasAccount: boolean }
  | { type: 'SELECT_FLOW'; flow: FlowType }
  | { type: 'START_REDIRECT'; returnUrl: string }
  | { type: 'RETURN_FROM_HUB'; params: URLSearchParams }
  | { type: 'PROCESSING_UPDATE'; message: string }
  | { type: 'PAYMENT_SUCCESS'; orderId?: string; message: string }
  | { type: 'ACCOUNT_CREATED'; credentials: Credentials }
  | { type: 'WAITER_CALLED'; table: string }
  | { type: 'ERROR'; error: string; canRetry?: boolean }
  | { type: 'RETRY' }
  | { type: 'RESET' }
  | { type: 'DISMISS_BANNER' };

// ============================================================================
// REDUCER
// ============================================================================

export function paymentReducer(state: PaymentState, event: PaymentEvent): PaymentState {
  console.log('[PaymentStateMachine]', state.status, '->', event.type);

  switch (state.status) {
    case 'idle':
      if (event.type === 'OPEN_FLOW_SELECTOR') {
        return {
          status: 'selecting_flow',
          cartTotal: event.cartTotal,
          hasAccount: event.hasAccount
        };
      }
      if (event.type === 'RETURN_FROM_HUB') {
        return { status: 'processing', flow: 3 };
      }
      if (event.type === 'SELECT_FLOW') {
        if (event.flow === 6) {
          return { status: 'processing', flow: event.flow };
        } else {
          return { status: 'redirecting', flow: event.flow, returnUrl: '' };
        }
      }
      break;

    case 'selecting_flow':
      if (event.type === 'SELECT_FLOW') {
        return { status: 'redirecting', flow: event.flow, returnUrl: '' };
      }
      if (event.type === 'RESET' || event.type === 'DISMISS_BANNER') {
        return { status: 'idle' };
      }
      break;

    case 'redirecting':
      if (event.type === 'START_REDIRECT') {
        return { ...state, returnUrl: event.returnUrl };
      }
      if (event.type === 'RESET' || event.type === 'DISMISS_BANNER') {
        return { status: 'idle' };
      }
      break;

    case 'processing':
      if (event.type === 'PROCESSING_UPDATE') {
        return { ...state, message: event.message };
      }
      if (event.type === 'PAYMENT_SUCCESS') {
        return {
          status: 'success',
          flow: state.flow,
          orderId: event.orderId,
          message: event.message
        };
      }
      if (event.type === 'ACCOUNT_CREATED') {
        return {
          status: 'account_created',
          credentials: event.credentials,
          flow: state.flow
        };
      }
      if (event.type === 'WAITER_CALLED') {
        return { status: 'waiter_called', table: event.table };
      }
      if (event.type === 'ERROR') {
        return {
          status: 'error',
          flow: state.flow,
          error: event.error,
          canRetry: event.canRetry ?? true
        };
      }
      break;

    case 'success':
    case 'account_created':
    case 'waiter_called':
      if (event.type === 'RESET' || event.type === 'DISMISS_BANNER') {
        return { status: 'idle' };
      }
      break;

    case 'error':
      if (event.type === 'RETRY' && state.canRetry) {
        return { status: 'selecting_flow', cartTotal: 0, hasAccount: false };
      }
      if (event.type === 'RESET' || event.type === 'DISMISS_BANNER') {
        return { status: 'idle' };
      }
      break;
  }

  console.warn('[PaymentStateMachine] Invalid transition:', state.status, '->', event.type);
  return state;
}

export const initialPaymentState: PaymentState = { status: 'idle' };

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export type Language = 'fr' | 'en' | 'lb';

const bannerMessages: Record<Language, {
  redirecting: string;
  processing: string;
  success: string;
  waiterCalled: (table: string) => string;
}> = {
  fr: {
    redirecting: 'Initialisation du processeur de paiements / Veuillez patienter...',
    processing: 'Traitement en cours...',
    success: 'Commande transmise avec succ\u00e8s!',
    waiterCalled: (table) => `Un serveur arrive \u00e0 la table ${table}`,
  },
  en: {
    redirecting: 'Initializing payment processor / Please wait...',
    processing: 'Processing...',
    success: 'Order transmitted successfully!',
    waiterCalled: (table) => `A waiter is coming to table ${table}`,
  },
  lb: {
    redirecting: 'Bezuelungsprozessor gëtt initialiséiert / W.e.g. waarden...',
    processing: 'Gëtt veraarbecht...',
    success: 'Bestellung erfollegräich iwwerdroe!',
    waiterCalled: (table) => `E Kellner kënnt un den Dësch ${table}`,
  },
};

export function getBannerMessage(state: PaymentState, language: Language = 'fr'): string {
  const t = bannerMessages[language] || bannerMessages.fr;

  switch (state.status) {
    case 'redirecting':
      return t.redirecting;
    case 'processing':
      return state.message || t.processing;
    case 'success':
      return state.message || t.success;
    case 'waiter_called':
      return t.waiterCalled(state.table);
    case 'error':
      return state.error;
    default:
      return '';
  }
}

export function buildReturnUrl(flow: FlowType, restaurantId: string): string {
  const base = window.location.origin;
  return `${base}/?flow=${flow}&restaurant=${restaurantId}`;
}

export function buildHubUrl(flow: FlowType, params: {
  hubUrl: string;
  restaurantId: string;
  hiveAccount: string;
  amount: number;
  memo: string;
  table: string;
  returnUrl: string;
}): string {
  const { hubUrl, restaurantId, hiveAccount, amount, memo, table, returnUrl } = params;

  const searchParams = new URLSearchParams({
    restaurant: restaurantId,
    recipient: hiveAccount,
    amount: amount.toFixed(2),
    memo: encodeURIComponent(memo),
    table,
    return_url: returnUrl,
  });

  switch (flow) {
    case 3:
      return `${hubUrl}/api/checkout/guest?${searchParams}`;
    case 4:
      return `${hubUrl}/api/user/create?${searchParams}&account_only=true`;
    case 5:
      return `${hubUrl}/api/user/create?${searchParams}`;
    case 6:
      return '';
    case 7:
      return `${hubUrl}/api/checkout/topup?${searchParams}`;
    default:
      return hubUrl;
  }
}
