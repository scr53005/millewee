'use client';

import { Suspense } from 'react';
import { TableProvider } from '@/lib/table-context';

/** Wraps children in TableProvider inside a Suspense boundary (required by useSearchParams) */
export function TableDetector({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <TableProvider>{children}</TableProvider>
    </Suspense>
  );
}
