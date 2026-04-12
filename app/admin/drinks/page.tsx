'use client';

import { useState } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DrinkForm } from '@/components/admin/DrinkForm';
import { useDrinks, useCreateDrink, useUpdateDrink, useDeleteDrink, type Drink } from '@/hooks/use-drinks';
import { useCategories } from '@/hooks/use-categories';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DrinksPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDrink, setEditingDrink] = useState<Drink | undefined>();

  const { data: categories = [] } = useCategories('drinks');
  const { data: drinks = [], isLoading } = useDrinks(
    categoryFilter !== 'all' ? parseInt(categoryFilter) : undefined
  );
  const createDrink = useCreateDrink();
  const updateDrink = useUpdateDrink();
  const deleteDrink = useDeleteDrink();

  const openCreate = () => {
    setEditingDrink(undefined);
    setDialogOpen(true);
  };

  const openEdit = (drink: Drink) => {
    setEditingDrink(drink);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      if (editingDrink) {
        await updateDrink.mutateAsync({ id: editingDrink.drink_id, ...data });
        toast.success('Boisson mise à jour');
      } else {
        await createDrink.mutateAsync(data as Parameters<typeof createDrink.mutateAsync>[0]);
        toast.success('Boisson créée');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (e: React.MouseEvent, drink: Drink) => {
    e.stopPropagation();
    if (!confirm(`Supprimer "${drink.name_fr}" ?`)) return;
    try {
      await deleteDrink.mutateAsync(drink.drink_id);
      toast.success('Boisson supprimée');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  // Format price range from sizes
  const priceRange = (drink: Drink) => {
    if (drink.sizes.length === 0) return '—';
    const prices = drink.sizes.map((s) => Number(s.price_eur));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `${min.toFixed(2)} \u20ac` : `${min.toFixed(2)} - ${max.toFixed(2)} \u20ac`;
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
        ) : drinks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune boisson</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="w-36 text-right">Prix</TableHead>
                <TableHead className="w-20 text-center">Tailles</TableHead>
                <TableHead className="w-24 text-center">Sélections</TableHead>
                <TableHead className="w-24">Mode</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drinks.map((drink) => (
                <TableRow key={drink.drink_id} className="cursor-pointer hover:bg-gray-50" onClick={() => openEdit(drink)}>
                  <TableCell className="font-medium text-gray-900">{drink.name_fr}</TableCell>
                  <TableCell className="text-right text-gray-700">{priceRange(drink)}</TableCell>
                  <TableCell className="text-center text-gray-500">{drink.sizes.length}</TableCell>
                  <TableCell className="text-center text-gray-500">{drink.selections.length || '—'}</TableCell>
                  <TableCell>
                    {drink.selection_mode && (
                      <Badge variant="secondary" className="text-xs">{drink.selection_mode}</Badge>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700"
                      onClick={(e) => handleDelete(e, drink)}>
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
              {editingDrink ? `Modifier: ${editingDrink.name_fr}` : 'Nouvelle boisson'}
            </DialogTitle>
          </DialogHeader>
          <DrinkForm
            drink={editingDrink}
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
            loading={createDrink.isPending || updateDrink.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
