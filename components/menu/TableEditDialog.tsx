'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { validateTableNumber } from '@/lib/innopay/table-validation';

interface TableEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTable: string;
  /** Called with the validated table number (as a string) when the user confirms. */
  onConfirm: (table: string) => void;
}

type DialogError =
  | { kind: 'invalid' }
  | { kind: 'notExist' }
  | { kind: 'gap'; suggestion: number }
  | null;

export function TableEditDialog({
  open,
  onOpenChange,
  currentTable,
  onConfirm,
}: TableEditDialogProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(currentTable);
  const [validTables, setValidTables] = useState<number[]>([]);
  const [error, setError] = useState<DialogError>(null);

  // Each time the dialog opens: seed the input, clear errors, and kick off a
  // background fetch of the real table list. validateTableNumber fails open if
  // the list never arrives, so the customer is never blocked by a backend hiccup.
  useEffect(() => {
    if (!open) return;
    setValue(currentTable);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tables');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.tables)) setValidTables(data.tables);
      } catch {
        // Swallow — fail-open validation handles the empty-list case.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentTable]);

  const commit = (raw: string) => {
    const result = validateTableNumber(raw, validTables);
    switch (result.status) {
      case 'valid':
        onConfirm(String(result.table));
        onOpenChange(false);
        return;
      case 'invalid':
        setError({ kind: 'invalid' });
        return;
      case 'out-of-range':
        setError({ kind: 'notExist' });
        return;
      case 'gap':
        setError({ kind: 'gap', suggestion: result.suggestion });
        return;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{t('table.editTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="table-edit-input">
            {t('table.changePrompt')}
          </label>
          <input
            id="table-edit-input"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(value);
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          {error?.kind === 'invalid' && (
            <p className="text-sm text-destructive">{t('table.invalid')}</p>
          )}
          {error?.kind === 'notExist' && (
            <p className="text-sm text-destructive">{t('table.notExist')}</p>
          )}
          {error?.kind === 'gap' && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">
              <span>
                {t('table.didYouMean')} {error.suggestion}&nbsp;?
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => commit(String(error.suggestion))}
              >
                {t('table.useSuggestion')}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('table.cancel')}
          </Button>
          <Button onClick={() => commit(value)}>{t('table.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
