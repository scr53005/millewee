import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { StandardWeekFormData } from '@/lib/admin/schemas';

export interface StandardWeekRow {
  service_id: number;
  service_name_fr: string;
  service_name_en: string;
  service_name_lb: string;
  scope: 'restaurant' | 'kitchen';
  sort_order: number;
  mon: string | null;
  tue: string | null;
  wed: string | null;
  thu: string | null;
  fri: string | null;
  sat: string | null;
  sun: string | null;
}

interface RegenerateScheduleResponse {
  generated: number;
}

export function useStandardWeek() {
  return useQuery<StandardWeekRow[]>({
    queryKey: ['standard-week'],
    queryFn: async () => {
      const res = await fetch('/api/admin/standard-week');
      if (!res.ok) throw new Error('Failed to fetch standard week');
      return res.json();
    },
  });
}

export function useSaveStandardWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StandardWeekFormData) => {
      const res = await fetch('/api/admin/standard-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standard-week'] });
      qc.invalidateQueries({ queryKey: ['current-schedule'] });
      qc.invalidateQueries({ queryKey: ['public-current-schedule'] });
    },
  });
}

export function useRegenerateSchedule() {
  const qc = useQueryClient();
  return useMutation<RegenerateScheduleResponse, Error, number | undefined>({
    mutationFn: async (weeks = 4) => {
      const res = await fetch('/api/admin/schedule/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeks }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to regenerate');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-schedule'] });
      qc.invalidateQueries({ queryKey: ['public-current-schedule'] });
    },
  });
}
