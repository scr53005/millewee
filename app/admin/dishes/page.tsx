'use client';

import { useState } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AvailabilityToggle } from '@/components/admin/AvailabilityToggle';
import { DishForm } from '@/components/admin/DishForm';
import { useDishes, useCreateDish, useUpdateDish, useDeleteDish, type Dish } from '@/hooks/use-dishes';
import { useCategories } from '@/hooks/use-categories';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DishesPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | undefined>();

  const { data: categories = [] } = useCategories('dishes');
  const { data: dishes = [], isLoading } = useDishes(
    categoryFilter !== 'all' ? parseInt(categoryFilter) : undefined
  );
  const createDish = useCreateDish();
  const updateDish = useUpdateDish();
  const deleteDish = useDeleteDish();

  const openCreate = () => {
    setEditingDish(undefined);
    setDialogOpen(true);
  };

  const openEdit = (dish: Dish) => {
    setEditingDish(dish);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      if (editingDish) {
        await updateDish.mutateAsync({ id: editingDish.dish_id, ...data });
        toast.success('Plat mis à jour');
      } else {
        await createDish.mutateAsync(data as Parameters<typeof createDish.mutateAsync>[0]);
        toast.success('Plat créé');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (e: React.MouseEvent, dish: Dish) => {
    e.stopPropagation();
    if (!confirm(`Supprimer "${dish.name_fr}" ?`)) return;
    try {
      await deleteDish.mutateAsync(dish.dish_id);
      toast.success('Plat supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleToggle = async (dish: Dish) => {
    try {
      await updateDish.mutateAsync({ id: dish.dish_id, is_available: !dish.is_available });
    } catch {
      toast.error('Erreur de mise à jour');
    }
  };

  return (
    <div>
      <AdminHeader />
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
            <SelectTrigger className="w-48 bg-white text-gray-900">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name_fr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} size="sm" className="bg-[#d4a24e] text-[#1a1310] hover:bg-[#c4922e]">
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-center py-8">Chargement...</p>
        ) : dishes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucun plat</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="w-24 text-right">Prix</TableHead>
                <TableHead className="w-20 text-center">Dispo</TableHead>
                <TableHead className="w-32">Badges</TableHead>
                <TableHead className="w-20 text-center">Var.</TableHead>
                <TableHead className="w-20 text-center">All.</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {dishes.map((dish) => (
                <TableRow key={dish.dish_id} className="cursor-pointer hover:bg-gray-50" onClick={() => openEdit(dish)}>
                  <TableCell className="font-medium text-gray-900">{dish.name_fr}</TableCell>
                  <TableCell className="text-right text-gray-700">
                    {Number(dish.price_eur).toFixed(2)} &euro;
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <AvailabilityToggle isAvailable={dish.is_available} onToggle={() => handleToggle(dish)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {dish.is_popular && <Badge variant="secondary" className="text-xs">Pop</Badge>}
                      {dish.is_new && <Badge className="bg-green-100 text-green-700 text-xs">New</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-gray-500">{dish.variants.length || '—'}</TableCell>
                  <TableCell className="text-center text-gray-500">{dish.allergens.length || '—'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700"
                      onClick={(e) => handleDelete(e, dish)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
        <DialogContent className="bg-white max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {editingDish ? `Modifier: ${editingDish.name_fr}` : 'Nouveau plat'}
            </DialogTitle>
          </DialogHeader>
          <DishForm
            dish={editingDish}
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
            loading={createDish.isPending || updateDish.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
