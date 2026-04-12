'use client';

import { useState, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAllergens } from '@/hooks/use-allergens';
import { useDishes } from '@/hooks/use-dishes';
import { toast } from 'sonner';
import { Search } from 'lucide-react';

export default function AllergensPage() {
  const [search, setSearch] = useState('');
  const { data: allergens = [] } = useAllergens();
  const { data: dishes = [], refetch } = useDishes();

  const filteredDishes = dishes.filter((d) =>
    d.name_fr.toLowerCase().includes(search.toLowerCase())
  );

  const isDishAllergen = useCallback(
    (dishId: number, allergenId: number) => {
      const dish = dishes.find((d) => d.dish_id === dishId);
      return dish?.allergens.some((a) => a.allergen_id === allergenId) ?? false;
    },
    [dishes]
  );

  const toggleAllergen = async (dishId: number, allergenId: number) => {
    const dish = dishes.find((d) => d.dish_id === dishId);
    if (!dish) return;

    const currentIds = dish.allergens.map((a) => a.allergen_id);
    const newIds = currentIds.includes(allergenId)
      ? currentIds.filter((id) => id !== allergenId)
      : [...currentIds, allergenId];

    try {
      const res = await fetch(`/api/admin/dishes/${dishId}/allergens`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allergen_ids: newIds }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await refetch();
    } catch {
      toast.error('Erreur de mise à jour');
    }
  };

  return (
    <div>
      <AdminHeader />
      <div className="max-w-full mx-auto p-4">
        <div className="mb-4 relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un plat..."
            className="pl-9 bg-white text-gray-900"
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-white z-10 min-w-[180px]">Plat</TableHead>
                {allergens.map((a) => (
                  <TableHead key={a.id} className="text-center w-10 px-1">
                    <div className="flex flex-col items-center gap-0.5" title={a.name_fr}>
                      <span className="text-base">{a.icon}</span>
                      <span className="text-[10px] leading-tight">{a.id}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDishes.map((dish) => (
                <TableRow key={dish.dish_id}>
                  <TableCell className="sticky left-0 bg-white z-10 font-medium text-gray-900 text-sm">
                    {dish.name_fr}
                  </TableCell>
                  {allergens.map((a) => (
                    <TableCell key={a.id} className="text-center px-1">
                      <input
                        type="checkbox"
                        checked={isDishAllergen(dish.dish_id, a.id)}
                        onChange={() => toggleAllergen(dish.dish_id, a.id)}
                        className="rounded cursor-pointer"
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
