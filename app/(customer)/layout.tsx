'use client';

import { QueryProvider } from '@/app/providers/QueryProvider';
import { I18nProvider } from '@/lib/i18n';
import { CartProvider } from '@/hooks/use-cart';
import { WalletPulseProvider } from '@/hooks/use-wallet-pulse';
import { TableDetector } from '@/components/menu/TableDetector';
import { InnopayChrome } from '@/components/innopay';
import { Toaster } from '@/components/ui/sonner';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <I18nProvider>
        <CartProvider>
          <WalletPulseProvider>
            <TableDetector>
              {children}
              <InnopayChrome />
              <Toaster />
            </TableDetector>
          </WalletPulseProvider>
        </CartProvider>
      </I18nProvider>
    </QueryProvider>
  );
}
