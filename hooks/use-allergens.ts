import { useQuery } from '@tanstack/react-query';

export interface Allergen {
  id: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  icon: string | null;
}

export function useAllergens() {
  return useQuery<Allergen[]>({
    queryKey: ['allergens'],
    queryFn: async () => {
      const res = await fetch('/api/admin/allergens');
      if (!res.ok) throw new Error('Failed to fetch allergens');
      return res.json();
    },
  });
}
