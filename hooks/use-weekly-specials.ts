import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WeeklySpecialFormData } from '@/lib/admin/schemas';

export interface WeeklySpecial {
  id: number;
  dish_id: number;
  start_date: string;
  end_date: string;
  special_price: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  dish: {
    dish_id: number;
    name_fr: string;
    price_eur: number;
  };
}

export function useWeeklySpecials(activeOnly = false) {
  return useQuery<WeeklySpecial[]>({
    queryKey: ['weekly-specials', activeOnly],
    queryFn: async () => {
      const url = activeOnly
        ? '/api/admin/weekly-specials?active_only=true'
        : '/api/admin/weekly-specials';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch weekly specials');
      return res.json();
    },
  });
}

export function useCreateWeeklySpecial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: WeeklySpecialFormData) => {
      const res = await fetch('/api/admin/weekly-specials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weekly-specials'] }),
  });
}

export function useUpdateWeeklySpecial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<WeeklySpecialFormData> & { id: number }) => {
      const res = await fetch(`/api/admin/weekly-specials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weekly-specials'] }),
  });
}

export function useDeleteWeeklySpecial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/weekly-specials/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weekly-specials'] }),
  });
}
