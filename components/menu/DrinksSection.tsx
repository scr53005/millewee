'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useMenuDrinks, type MenuDrink } from '@/hooks/use-menu';
import { DrinkCard } from './DrinkCard';

export function DrinksSection() {
  const { t, localized } = useI18n();
  const { data, isLoading } = useMenuDrinks();
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const tabsRef = useRef<HTMLDivElement>(null);
  const isScrollingToRef = useRef(false);

  const categories = data?.categories ?? [];
  const drinks = data?.drinks ?? [];

  // Group drinks by category
  const drinksByCategory = new Map<number, MenuDrink[]>();
  for (const cat of categories) {
    const catDrinks = drinks.filter((d) =>
      d.categories.some((c) => c.category_id === cat.id),
    );
    if (catDrinks.length > 0) {
      drinksByCategory.set(cat.id, catDrinks);
    }
  }

  const visibleCategories = categories.filter((c) => drinksByCategory.has(c.id));

  useEffect(() => {
    if (activeCategory === null && visibleCategories.length > 0) {
      setActiveCategory(visibleCategories[0].id);
    }
  }, [activeCategory, visibleCategories]);

  const handleScroll = useCallback(() => {
    if (isScrollingToRef.current) return;

    const entries = Array.from(sectionRefs.current.entries());
    for (const [catId, el] of entries) {
      const rect = el.getBoundingClientRect();
      if (rect.top <= 170 && rect.bottom > 170) {
        setActiveCategory(catId);
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToCategory = (catId: number) => {
    setActiveCategory(catId);
    const el = sectionRefs.current.get(catId);
    if (!el) return;

    isScrollingToRef.current = true;
    // Offset for sticky headers: menu header (~57px) + dishes/drinks toggle (~45px) + category tabs (~40px)
    const stickyOffset = 140;
    const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset;
    window.scrollTo({ top, behavior: 'smooth' });
    setTimeout(() => {
      isScrollingToRef.current = false;
    }, 800);
  };

  useEffect(() => {
    if (!tabsRef.current || activeCategory === null) return;
    const activeTab = tabsRef.current.querySelector(`[data-cat-id="${activeCategory}"]`);
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategory]);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">{t('misc.loading')}</div>
    );
  }

  if (visibleCategories.length === 0) return null;

  return (
    <section id="drinks-section">
      {/* Section title */}
      <h2 className="font-display text-xl font-bold text-foreground px-3 pt-6 pb-2">
        {t('nav.drinks')}
      </h2>

      {/* Sticky category tabs */}
      <div className="sticky top-[94px] z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div
          ref={tabsRef}
          className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-hide"
        >
          {visibleCategories.map((cat) => {
            const isActive = cat.id === activeCategory;
            const catName = localized(cat, 'name');
            return (
              <button
                key={cat.id}
                data-cat-id={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`px-3 py-1 text-sm rounded-full whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {catName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category sections */}
      <div className="px-3 pb-4">
        {visibleCategories.map((cat) => {
          const catDrinks = drinksByCategory.get(cat.id) ?? [];
          const catName = localized(cat, 'name');
          return (
            <div
              key={cat.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(cat.id, el);
              }}
              className="pt-4"
            >
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {catName}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {catDrinks.map((drink) => (
                  <DrinkCard key={drink.drink_id} drink={drink} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
