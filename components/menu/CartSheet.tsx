/**
 * CartSheet with innopay payment integration.
 *
 * Hosts `usePaymentFlow` (state machine) and renders the full payment UI:
 *   - WalletNotificationBanner (blue flow selector)
 *   - StatusBanners (yellow/green/grey/redirecting progress banners)
 *   - ImportAccountModal + GuestCheckoutModal
 *   - Call-waiter reason modal
 *
 * Order button behavior:
 *   - No account      → opens WalletNotificationBanner (Flow 3/4/5 selector)
 *   - Account + balance ≥ cart → Flow 6 (pay with account, local signature)
 *   - Account + balance < cart → Flow 7 (top-up + pay, redirects to hub)
 *
 * Flow 6 cooldown: after a successful Flow 6 payment a 12s cooldown blocks
 * the order button so the next payment sees a freshly fetched blockchain balance
 * rather than the optimistic `currentBalance - cartTotal`.
 */

'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { useCart } from '@/hooks/use-cart';
import { useWalletPulse } from '@/hooks/use-wallet-pulse';
import { useScheduleStatus } from '@/hooks/use-current-schedule';
import { useInnopayCart } from '@/hooks/innopay/useInnopayCart';
import { usePaymentFlow } from '@/hooks/innopay/usePaymentFlow';
import { useBalance } from '@/hooks/innopay/useBalance';
import { effectivePrice } from '@/lib/cart/types';
import { getHiveAccount } from '@/lib/innopay/utils';
import { getAccountName } from '@/lib/innopay/keystore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingBag, Minus, Plus, Trash2, Bell, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  WalletNotificationBanner,
  StatusBanners,
  ImportAccountModal,
  GuestCheckoutModal,
} from '@/components/innopay';

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartSheet({ open, onOpenChange }: CartSheetProps) {
  const { language, t } = useI18n();
  // `clearCart` is still used by usePaymentFlow's onCartClear callback; the
  // user-facing "Vider le panier" button is commented out below.
  const { items, removeItem, updateQuantity, updateComment, clearCart, subtotal, tip, setTip, totalPrice } = useCart();
  const { startOrderPulsing } = useWalletPulse();
  const { restaurantOpen, kitchenOpen } = useScheduleStatus();
  const { table, getMemo } = useInnopayCart();

  const cartHasDishes = useMemo(() => items.some((i) => i.item.type === 'dish'), [items]);
  // Interim block (Phase B): if restaurant is closed, no orders. If kitchen is closed
  // but the cart has dishes, refuse the order. Drinks-only carts are still allowed
  // when the kitchen is closed (restaurant remains open). Delayed-orders UX will
  // replace this gate later.
  const scheduleBlocked: 'restaurant' | 'kitchen' | null = !restaurantOpen
    ? 'restaurant'
    : !kitchenOpen && cartHasDishes
      ? 'kitchen'
      : null;

  // Read account name once and keep it reactive across tabs via the storage event
  const [accountName, setAccountName] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return getAccountName();
  });

  useEffect(() => {
    const syncAccount = () => {
      setAccountName(getAccountName());
    };
    window.addEventListener('storage', syncAccount);
    return () => window.removeEventListener('storage', syncAccount);
  }, []);

  const hasAccount = !!accountName;
  const { balance, updateBalance, refetch: refetchBalance } = useBalance(accountName, {
    enabled: hasAccount,
  });

  // Level 3 guardrail: skip duplicate check when user confirms "send anyway"
  const skipDuplicateCheckRef = useRef(false);

  const { state, ui, actions } = usePaymentFlow({
    cartTotal: totalPrice,
    cartMemo: getMemo(),
    table: table || '',
    restaurantId: 'millewee',
    hiveAccount: getHiveAccount(),
    language,
    onCartClear: clearCart,
    onPaymentSuccess: (newBalance) => {
      updateBalance(newBalance);
    },
    onDuplicateDetected: () => {
      setShowDuplicateModal(true);
    },
    // In-app Flow 6 ("pay with wallet") never leaves the tab, so the pulse
    // machine gets no focus/visibility event to re-arm its poll. Kick it
    // explicitly when the wallet payment lands, mirroring how the external-wallet
    // redirect path drives `startOrderPulsing` via `onExternalWalletRedirect`.
    onPulseStart: startOrderPulsing,
    skipDuplicateCheckRef,
  });

  // Flow 6 cooldown: block ordering until blockchain finalizes previous payment
  const [flow6Cooldown, setFlow6Cooldown] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      const until = localStorage.getItem('innopay_flow6_cooldown_until');
      if (!until) {
        setFlow6Cooldown(0);
        return;
      }
      const remaining = Math.ceil((parseInt(until, 10) - Date.now()) / 1000);
      if (remaining > 0) {
        setFlow6Cooldown(remaining);
      } else {
        localStorage.removeItem('innopay_flow6_cooldown_until');
        setFlow6Cooldown(0);
        refetchBalance();
      }
    };
    tick();
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(tick, 1000);
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [open, refetchBalance]);

  // Local modal/banner state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [waiterReason, setWaiterReason] = useState('');
  const [isCallWaiterFlow, setIsCallWaiterFlow] = useState(false);

  // Tip panel state (UI only — tip itself lives in the cart reducer).
  const [tipPanelOpen, setTipPanelOpen] = useState(false);
  const [tipInput, setTipInput] = useState('');

  // Pre-fill the custom-amount input when opening the panel with an existing
  // tip set, so "Modifier" feels like editing rather than starting over.
  useEffect(() => {
    if (tipPanelOpen) {
      setTipInput(tip > 0 ? tip.toFixed(2) : '');
    }
  }, [tipPanelOpen, tip]);

  const applyTipPercent = useCallback(
    (pct: number) => {
      if (subtotal <= 0) return;
      const value = Math.round(subtotal * pct * 100) / 100;
      setTip(value);
      setTipPanelOpen(false);
    },
    [subtotal, setTip],
  );

  const parsedTipInput = parseFloat(tipInput.replace(',', '.'));
  const applyTipCustom = useCallback(() => {
    if (!isFinite(parsedTipInput) || parsedTipInput < 0) return;
    setTip(parsedTipInput);
    setTipPanelOpen(false);
  }, [parsedTipInput, setTip]);

  const tipSoftWarning =
    isFinite(parsedTipInput) && subtotal > 0 && parsedTipInput > subtotal * 0.3;

  const bannerStatus = useMemo(() => {
    if (state.status === 'redirecting') return 'redirecting';
    if (state.status === 'processing') return 'processing';
    if (state.status === 'success') return 'success';
    if (state.status === 'waiter_called') return 'waiter_called';
    if (state.status === 'error') return 'error';
    if (state.status === 'account_created') return 'account_created';
    return 'idle';
  }, [state.status]);

  // --- Handlers ---

  const handleOrder = useCallback(async () => {
    if (items.length === 0 || flow6Cooldown > 0) return;

    if (scheduleBlocked === 'restaurant') {
      toast.error(t('schedule.restaurantClosed'));
      return;
    }
    if (scheduleBlocked === 'kitchen') {
      toast.error(t('schedule.kitchenClosed'));
      return;
    }

    setIsCallWaiterFlow(false);
    onOpenChange(false);

    if (hasAccount) {
      if (balance !== null && balance >= totalPrice) {
        await actions.payWithAccount(balance);
      } else {
        await actions.selectFlow(7);
      }
    } else {
      actions.openFlowSelector();
    }
  }, [items.length, flow6Cooldown, scheduleBlocked, t, hasAccount, balance, totalPrice, actions, onOpenChange]);

  const handleCallWaiterClick = useCallback(() => {
    onOpenChange(false);
    setWaiterReason('');
    setShowWaiterModal(true);
  }, [onOpenChange]);

  const handleWaiterConfirm = useCallback(async () => {
    setShowWaiterModal(false);
    setIsCallWaiterFlow(true);
    if (hasAccount) {
      await actions.callWaiter(waiterReason);
    } else {
      actions.openFlowSelector();
    }
  }, [hasAccount, actions, waiterReason]);

  const handleGuestCheckout = useCallback(() => {
    actions.dismissBanner();
    setShowGuestModal(true);
  }, [actions]);

  const proceedWithGuestCheckout = useCallback(() => {
    actions.selectFlow(3);
  }, [actions]);

  const handleCreateAccount = useCallback(() => {
    actions.selectFlow(items.length === 0 ? 4 : 5);
  }, [actions, items.length]);

  const handleDuplicateConfirm = useCallback(() => {
    setShowDuplicateModal(false);
    skipDuplicateCheckRef.current = true;
    handleOrder();
  }, [handleOrder]);

  // Keep banner dismissable outside the sheet, so status survives the sheet closing
  const handleCloseBanner = useCallback(() => {
    actions.reset();
    setIsCallWaiterFlow(false);
  }, [actions]);

  // --- Derived UI state for the order button ---
  const orderButtonContent = (() => {
    if (flow6Cooldown > 0) {
      return (
        <>
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          Solde... {flow6Cooldown}s
        </>
      );
    }
    if (ui.isLoading && !isCallWaiterFlow) {
      return (
        <>
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          {t('action.ordering')}
        </>
      );
    }
    return (
      <>
        <ShoppingBag className="h-4 w-4 mr-1.5" />
        {t('action.order')}
      </>
    );
  })();

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex flex-col w-full sm:max-w-md pb-[30px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              {t('cart.title')}
              {items.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  (
                  {items.reduce((s, i) => s + i.quantity, 0)}{' '}
                  {items.reduce((s, i) => s + i.quantity, 0) === 1
                    ? t('cart.item')
                    : t('cart.items')}
                  )
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 -mx-4">
            {items.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                {t('cart.empty')}
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((cartItem) => {
                  const { item, quantity, comment, key } = cartItem;
                  const price = effectivePrice(item);
                  const name = item.name_fr; // UI label in active language handled elsewhere if needed
                  let subtitle = '';
                  if (item.type === 'dish' && item.variantName_fr) {
                    subtitle = item.variantName_fr;
                  } else if (item.type === 'drink') {
                    const parts: string[] = [];
                    if (item.size) parts.push(item.size);
                    if (item.selectionName_fr) parts.push(item.selectionName_fr);
                    subtitle = parts.join(' \u2014 ');
                  }
                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-border bg-card p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-card-foreground text-sm">
                            {name}
                          </div>
                          {subtitle && (
                            <div className="text-xs text-muted-foreground">{subtitle}</div>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-primary shrink-0">
                          {(price * quantity).toFixed(2)} {'\u20ac'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(key, quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center">{quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(key, quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <Input
                          value={comment || ''}
                          onChange={(e) => updateComment(key, e.target.value)}
                          placeholder={t(
                            item.type === 'dish'
                              ? 'cart.commentPlaceholderDish'
                              : 'cart.commentPlaceholderDrink',
                          )}
                          maxLength={80}
                          className="h-6 text-xs flex-1"
                        />

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                          onClick={() => removeItem(key)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <SheetFooter className="border-t border-border pt-4">
            {items.length > 0 && (
              <>
                {/* Total / breakdown */}
                {tip > 0 ? (
                  <div className="w-full mb-2 space-y-0.5">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{t('tip.subtotal')}</span>
                      <span>{subtotal.toFixed(2)} {'\u20ac'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{t('tip.label')}</span>
                      <span>{tip.toFixed(2)} {'\u20ac'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold">{t('cart.total')}</span>
                      <span className="text-lg font-bold text-primary">
                        {totalPrice.toFixed(2)} {'\u20ac'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-base font-semibold">{t('cart.total')}</span>
                    <span className="text-lg font-bold text-primary">
                      {totalPrice.toFixed(2)} {'\u20ac'}
                    </span>
                  </div>
                )}

                {/* Tip toggle */}
                <button
                  type="button"
                  onClick={() => setTipPanelOpen((o) => !o)}
                  className="w-full text-sm border border-border rounded-md py-2 px-3 mb-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <span>
                    {tip > 0
                      ? t('tip.modifyButton').replace('{amount}', tip.toFixed(2))
                      : t('tip.button')}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${tipPanelOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Tip panel */}
                {tipPanelOpen && (
                  <div className="w-full mb-3 p-3 border border-border rounded-md bg-muted/20 space-y-2">
                    <div className="flex gap-2">
                      {[0.1, 0.15, 0.2].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => applyTipPercent(pct)}
                          disabled={subtotal <= 0}
                          className="flex-1 py-2 px-2 border border-border rounded-md hover:bg-primary/10 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('tip.percent').replace('{n}', String(Math.round(pct * 100)))}
                          <span className="block text-xs opacity-75 mt-0.5">
                            {(subtotal * pct).toFixed(2)} {'\u20ac'}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground block">
                        {t('tip.pickAmount')}
                      </label>
                      <div className="flex gap-2 items-center">
                        {/* Width sized for at most "99.99" — the practical max
                            tip — leaving the Ajouter button comfortable. */}
                        <input
                          type="text"
                          inputMode="decimal"
                          value={tipInput}
                          onChange={(e) => {
                            // Allow only digits and a single dot/comma; cap at 2 decimals.
                            const cleaned = e.target.value.replace(/[^0-9.,]/g, '');
                            const normalized = cleaned.replace(',', '.');
                            const match = normalized.match(/^(\d*)(\.\d{0,2})?/);
                            setTipInput(match ? match[0] : '');
                          }}
                          placeholder="0.00"
                          className="w-16 flex-none h-9 border border-border rounded-md px-2 text-sm text-right bg-card text-card-foreground"
                        />
                        <span className="text-sm text-muted-foreground">{'€'}</span>
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1"
                          onClick={applyTipCustom}
                          disabled={!isFinite(parsedTipInput) || parsedTipInput < 0}
                        >
                          {t('tip.add')}
                        </Button>
                      </div>
                      {tipSoftWarning && (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          {t('tip.softWarning')}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {t('tip.hardCapNote')}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Commander + bell */}
            <div className="flex gap-2 w-full">
              <Button
                className="flex-1"
                onClick={handleOrder}
                disabled={
                  items.length === 0 ||
                  ui.isLoading ||
                  flow6Cooldown > 0 ||
                  scheduleBlocked !== null
                }
                title={
                  scheduleBlocked === 'restaurant'
                    ? t('schedule.restaurantClosed')
                    : scheduleBlocked === 'kitchen'
                      ? t('schedule.kitchenClosed')
                      : undefined
                }
              >
                {orderButtonContent}
              </Button>

              <Button
                variant="outline"
                className="px-3"
                onClick={handleCallWaiterClick}
                disabled={ui.isLoading}
                title={t('waiter.call')}
              >
                {ui.isLoading && isCallWaiterFlow ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/*
              "Vider le panier" link intentionally commented out (2026-05-09):
              per-item trash buttons cover the use case and the vertical line
              was wanted back for the tip toggle. Restore this block if
              customer feedback shows people miss the bulk-clear.

              {items.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={clearCart}
                >
                  {t('cart.clear')}
                </Button>
              )}
            */}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Innopay payment flow UI — rendered outside the Sheet so they survive it closing */}
      <WalletNotificationBanner
        visible={ui.showFlowSelector}
        onClose={handleCloseBanner}
        cartTotal={totalPrice}
        cartMemo={getMemo()}
        table={table || ''}
        onImportAccount={() => {
          actions.dismissBanner();
          setShowImportModal(true);
        }}
        onGuestCheckout={handleGuestCheckout}
        onCreateAccount={handleCreateAccount}
        onExternalWalletRedirect={startOrderPulsing}
        isCallWaiterFlow={isCallWaiterFlow}
        language={language}
      />

      <ImportAccountModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          setAccountName(getAccountName());
          toast.success(language === 'fr' ? 'Compte importe !' : 'Account imported!');
          actions.reset();
        }}
        language={language}
      />

      <GuestCheckoutModal
        visible={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        onProceed={proceedWithGuestCheckout}
        isProcessing={state.status === 'redirecting'}
        totalPrice={totalPrice}
        totalPriceNoDiscount={totalPrice}
        discountAmount={0}
        language={language}
      />

      <StatusBanners
        status={bannerStatus}
        message={ui.bannerMessage}
        onDismiss={actions.dismissBanner}
        table={table || ''}
        language={language}
      />

      {/* Call-waiter reason modal */}
      <Dialog open={showWaiterModal} onOpenChange={setShowWaiterModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              {t('waiter.call')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              placeholder={t('waiter.reasonPlaceholder')}
              value={waiterReason}
              maxLength={80}
              onChange={(e) => setWaiterReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleWaiterConfirm();
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowWaiterModal(false)}>
              {t('waiter.cancel')}
            </Button>
            <Button onClick={handleWaiterConfirm}>
              <Bell className="h-4 w-4 mr-1" />
              {t('waiter.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate-order confirmation modal (Level 3 guardrail) */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('payment.duplicateTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t('payment.duplicateMessage')}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowDuplicateModal(false)}>
              {t('payment.duplicateCancel')}
            </Button>
            <Button onClick={handleDuplicateConfirm}>{t('payment.duplicateConfirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
