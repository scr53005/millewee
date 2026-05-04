import { useQuery } from '@tanstack/react-query';

// ─── Types matching API responses ───

export interface MenuCategory {
  id: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  type: string;
  sort_order: number;
}

export interface MenuDishVariant {
  id: number;
  dish_id: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  price_eur: number | null;
  sort_order: number;
  is_available: boolean;
}

export interface MenuDishAllergen {
  dish_id: number;
  allergen_id: number;
  allergen: { id: number; name_fr: string; name_en: string | null; icon: string | null };
}

export interface MenuDishCategory {
  category_id: number;
  dish_id: number;
  category: { id: number; name_fr: string; type: string };
}

export interface MenuDish {
  dish_id: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  description_fr: string | null;
  description_en: string | null;
  description_lb: string | null;
  price_eur: number;
  discount: number | null;
  image_url: string | null;
  is_available: boolean;
  is_popular: boolean;
  is_new: boolean;
  sort_order: number;
  has_variants: boolean;
  selection_label: string | null;
  variants: MenuDishVariant[];
  allergens: MenuDishAllergen[];
  categories: MenuDishCategory[];
}

export interface MenuDrinkSize {
  drink_id: number;
  size: string;
  price_eur: number;
  discount: number | null;
  image_url: string | null;
}

export interface MenuDrinkSelection {
  id: number;
  drink_id: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  price_delta: number;
  sort_order: number;
  is_available: boolean;
}

export interface MenuDrinkCategory {
  category_id: number;
  drink_id: number;
  category: { id: number; name_fr: string; type: string };
}

export interface MenuDrink {
  drink_id: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  description_fr: string | null;
  description_en: string | null;
  description_lb: string | null;
  selection_mode: string | null;
  sizes: MenuDrinkSize[];
  selections: MenuDrinkSelection[];
  categories: MenuDrinkCategory[];
}

export interface MenuSpecial {
  id: number;
  dish_id: number;
  start_date: string;
  end_date: string;
  special_price: number | null;
  description: string | null;
  is_active: boolean;
  dish: MenuDish;
}

// ─── Hooks ───

export function useMenuDishes() {
  return useQuery<{ categories: MenuCategory[]; dishes: MenuDish[] }>({
    queryKey: ['menu', 'dishes'],
    queryFn: async () => {
      const res = await fetch('/api/menu/dishes');
      if (!res.ok) throw new Error('Failed to fetch menu dishes');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useMenuDrinks() {
  return useQuery<{ categories: MenuCategory[]; drinks: MenuDrink[] }>({
    queryKey: ['menu', 'drinks'],
    queryFn: async () => {
      const res = await fetch('/api/menu/drinks');
      if (!res.ok) throw new Error('Failed to fetch menu drinks');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMenuSpecials() {
  return useQuery<MenuSpecial[]>({
    queryKey: ['menu', 'specials'],
    queryFn: async () => {
      const res = await fetch('/api/menu/specials');
      if (!res.ok) throw new Error('Failed to fetch specials');
      return res.json();
    },
    // Owners edit weekly specials live from the admin dashboard. Keep this
    // query fresh so the customer menu reflects changes immediately when
    // returning from admin or refocusing the tab.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}
