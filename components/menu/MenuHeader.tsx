'use client';

import Image from 'next/image';
import { useI18n, languages } from '@/lib/i18n';
import { useTable } from '@/lib/table-context';
import { useCart } from '@/hooks/use-cart';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ShoppingBag } from 'lucide-react';

interface MenuHeaderProps {
  onCartOpen: () => void;
}

export function MenuHeader({ onCartOpen }: MenuHeaderProps) {
  const { language, setLanguage, t } = useI18n();
  const { tableNumber } = useTable();
  const { totalItems } = useCart();

  const currentLang = languages.find((l) => l.code === language)!;

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between px-3 py-2 max-w-4xl mx-auto">
        {/* Logo + title */}
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10 shrink-0">
            <Image
              src="/images/logo_millewee_transp.png"
              alt="Millewee"
              fill
              sizes="40px"
              className="object-contain dark:brightness-0 dark:invert"
              priority
            />
          </div>
          <span className="font-display text-2xl font-bold text-foreground">Millewee</span>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5">
          {/* Table indicator */}
          {tableNumber && (
            <span className="text-xs font-medium text-muted-foreground px-1.5">
              {t('table.label')} {tableNumber}
            </span>
          )}

          {/* Language switcher — DropdownMenuTrigger already renders <button>, don't nest a Button inside */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md px-2 h-8 text-sm hover:bg-muted transition-colors">
              {currentLang.flag}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {languages.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={language === lang.code ? 'font-semibold' : ''}
                >
                  <span className="mr-1.5">{lang.flag}</span>
                  {lang.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Cart button — plain button, not nested */}
          <button
            className="relative inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-muted transition-colors"
            onClick={onCartOpen}
          >
            <ShoppingBag className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
