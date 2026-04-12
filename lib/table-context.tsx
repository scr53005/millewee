'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

interface TableContextType {
  tableNumber: string | null;
}

const TableContext = createContext<TableContextType>({ tableNumber: null });

const STORAGE_KEY = 'millewee_table';

/** Must be rendered inside a <Suspense> boundary (useSearchParams requirement) */
export function TableProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [tableNumber, setTableNumber] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get('table');
    if (fromUrl) {
      setTableNumber(fromUrl);
      localStorage.setItem(STORAGE_KEY, fromUrl);
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setTableNumber(stored);
    }
  }, [searchParams]);

  return (
    <TableContext.Provider value={{ tableNumber }}>
      {children}
    </TableContext.Provider>
  );
}

export function useTable() {
  return useContext(TableContext);
}
