import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ServiceFormData } from '@/lib/admin/schemas';

export interface Service {
  id: number;
  name_fr: string;
  name_en: string;
  name_lb: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useServices(activeOnly = false) {
  return useQuery<Service[]>({
    queryKey: ['services', activeOnly],
    queryFn: async () => {
      const url = activeOnly
        ? '/api/admin/services?active_only=true'
        : '/api/admin/services';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    },
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const res = await fetch('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ServiceFormData> & { id: number }) => {
      const res = await fetch(`/api/admin/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/services/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      qc.invalidateQueries({ queryKey: ['standard-week'] });
    },
  });
}
