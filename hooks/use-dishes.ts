import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DishFormData } from '@/lib/admin/schemas';

export interface DishVariant {
  id: number;
  dish_id: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  price_eur: number | null;
  sort_order: number;
  is_available: boolean;
}

export interface DishAllergen {
  dish_id: number;
  allergen_id: number;
  allergen: { id: number; name_fr: string; name_en: string | null; icon: string | null };
}

export interface DishCategory {
  category_id: number;
  dish_id: number;
  category: { id: number; name_fr: string; type: string };
}

export interface Dish {
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
  variants: DishVariant[];
  allergens: DishAllergen[];
  categories: DishCategory[];
}

export function useDishes(categoryId?: number) {
  return useQuery<Dish[]>({
    queryKey: ['dishes', categoryId],
    queryFn: async () => {
      const url = categoryId ? `/api/admin/dishes?category_id=${categoryId}` : '/api/admin/dishes';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch dishes');
      return res.json();
    },
  });
}

export function useCreateDish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: DishFormData) => {
      const res = await fetch('/api/admin/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dishes'] }),
  });
}

export function useUpdateDish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<DishFormData> & { id: number }) => {
      const res = await fetch(`/api/admin/dishes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dishes'] }),
  });
}

export function useDeleteDish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/dishes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dishes'] }),
  });
}
