import { useQuery } from '@tanstack/react-query';

export interface ResolvedService {
  service_id: number;
  name_fr: string;
  name_en: string;
  name_lb: string;
  open: string;
  close: string;
}

export interface CurrentScheduleDay {
  date: string;
  day_of_week: number;
  resolved: ResolvedService[];
}

export function useCurrentSchedule() {
  return useQuery<CurrentScheduleDay[]>({
    queryKey: ['current-schedule'],
    queryFn: async () => {
      const res = await fetch('/api/current-schedule');
      if (!res.ok) throw new Error('Failed to fetch current schedule');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
