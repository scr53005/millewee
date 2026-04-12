'use client';

import { QueryProvider } from '@/app/providers/QueryProvider';
import { I18nProvider } from '@/lib/i18n';
import { CartProvider } from '@/hooks/use-cart';
import { TableDetector } from '@/components/menu/TableDetector';
import { Toaster } from '@/components/ui/sonner';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <I18nProvider>
        <CartProvider>
          <TableDetector>
            {children}
            <Toaster />
          </TableDetector>
        </CartProvider>
      </I18nProvider>
    </QueryProvider>
  );
}
