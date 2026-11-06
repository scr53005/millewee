import { describe, expect, it } from 'vitest';
import { initialPaymentState, paymentReducer, type PaymentState } from './paymentStateMachine';

describe('paymentReducer', () => {
  it('guest checkout failure while redirecting ends in error (the spinner stops)', () => {
    const redirecting = paymentReducer(initialPaymentState, { type: 'SELECT_FLOW', flow: 3 });
    expect(redirecting.status).toBe('redirecting');

    const failed = paymentReducer(redirecting, { type: 'ERROR', error: 'Connexion impossible' });
    expect(failed).toEqual({ status: 'error', flow: 3, error: 'Connexion impossible', canRetry: true });
  });

  it('error from redirecting keeps an explicit canRetry=false', () => {
    const redirecting: PaymentState = { status: 'redirecting', flow: 3, returnUrl: '' };
    expect(paymentReducer(redirecting, { type: 'ERROR', error: 'x', canRetry: false }))
      .toMatchObject({ status: 'error', canRetry: false });
  });

  it('error from processing still works (Flow 6, waiter call)', () => {
    const processing = paymentReducer(initialPaymentState, { type: 'SELECT_FLOW', flow: 6 });
    expect(paymentReducer(processing, { type: 'ERROR', error: 'x' }))
      .toEqual({ status: 'error', flow: 6, error: 'x', canRetry: true });
  });

  it('dismissing the error returns to idle', () => {
    const error: PaymentState = { status: 'error', flow: 3, error: 'x', canRetry: true };
    expect(paymentReducer(error, { type: 'DISMISS_BANNER' })).toEqual({ status: 'idle' });
  });
});
