import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CategoryFormData } from '@/lib/admin/schemas';

interface Category {
  id: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  type: string;
  sort_order: number;
  is_active: boolean;
}

export function useCategories(type?: string) {
  return useQuery<Category[]>({
    queryKey: ['categories', type],
    queryFn: async () => {
      const url = type ? `/api/admin/categories?type=${type}` : '/api/admin/categories';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CategoryFormData> & { id: number }) => {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}
