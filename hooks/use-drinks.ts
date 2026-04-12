import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DrinkFormData } from '@/lib/admin/schemas';

export interface DrinkSize {
  drink_id: number;
  size: string;
  price_eur: number;
  discount: number | null;
  image_url: string | null;
}

export interface DrinkSelection {
  id: number;
  drink_id: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  price_delta: number;
  sort_order: number;
  is_available: boolean;
}

export interface DrinkCategory {
  category_id: number;
  drink_id: number;
  category: { id: number; name_fr: string; type: string };
}

export interface Drink {
  drink_id: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  description_fr: string | null;
  description_en: string | null;
  description_lb: string | null;
  selection_mode: string | null;
  sizes: DrinkSize[];
  selections: DrinkSelection[];
  categories: DrinkCategory[];
}

export function useDrinks(categoryId?: number) {
  return useQuery<Drink[]>({
    queryKey: ['drinks', categoryId],
    queryFn: async () => {
      const url = categoryId ? `/api/admin/drinks?category_id=${categoryId}` : '/api/admin/drinks';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch drinks');
      return res.json();
    },
  });
}

export function useCreateDrink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: DrinkFormData) => {
      const res = await fetch('/api/admin/drinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drinks'] }),
  });
}

export function useUpdateDrink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<DrinkFormData> & { id: number }) => {
      const res = await fetch(`/api/admin/drinks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drinks'] }),
  });
}

export function useDeleteDrink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/drinks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drinks'] }),
  });
}
