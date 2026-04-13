'use client';

import { useI18n } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AllergenInfo {
  icon: string | null;
  name: string;
}

interface AllergenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allergens: AllergenInfo[];
  dishName: string;
}

export function AllergenModal({ open, onOpenChange, allergens, dishName }: AllergenModalProps) {
  const { t } = useI18n();

  if (allergens.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="max-w-xs" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-sm">
            {t('allergens.title')} — {dishName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          {allergens.map((a, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="text-lg leading-none">{a.icon || '\u26a0'}</span>
              <span className="text-sm text-foreground">{a.name}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
