'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

interface TableContextType {
  tableNumber: string | null;
  /** Customer-editable table override (canonical across spokes — see SPOKE-DOCUMENTATION.md). */
  setTable: (tableId: string) => void;
}

const TableContext = createContext<TableContextType>({ tableNumber: null, setTable: () => {} });

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

  // Customer-initiated table change (e.g. they moved tables). Mirrors indiesmenu:
  // update state + localStorage, and keep ?table= in the URL so a reload / shared
  // link preserves the choice. Other query params are left intact.
  const setTable = useCallback((tableId: string) => {
    const trimmed = tableId.trim();
    if (!trimmed) return;
    setTableNumber(trimmed);
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // localStorage may be unavailable (private mode / blocked) — state still updates.
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('table', trimmed);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  return (
    <TableContext.Provider value={{ tableNumber, setTable }}>
      {children}
    </TableContext.Provider>
  );
}

export function useTable() {
  return useContext(TableContext);
}
