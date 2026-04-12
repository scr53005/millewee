'use client';

import { useState } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AvailabilityToggle } from '@/components/admin/AvailabilityToggle';
import { useWeeklySpecials, useCreateWeeklySpecial, useUpdateWeeklySpecial, useDeleteWeeklySpecial, type WeeklySpecial } from '@/hooks/use-weekly-specials';
import { useDishes } from '@/hooks/use-dishes';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface SpecialForm {
  dish_id: string;
  start_date: string;
  end_date: string;
  special_price: string;
  description: string;
  is_active: boolean;
}

const emptyForm: SpecialForm = {
  dish_id: '', start_date: '', end_date: '', special_price: '', description: '', is_active: true,
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-LU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Extract YYYY-MM-DD from ISO string
function toInputDate(dateStr: string) {
  return dateStr.slice(0, 10);
}

export default function WeeklySpecialsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SpecialForm>(emptyForm);

  const { data: specials = [], isLoading } = useWeeklySpecials();
  const { data: dishes = [] } = useDishes();
  const createSpecial = useCreateWeeklySpecial();
  const updateSpecial = useUpdateWeeklySpecial();
  const deleteSpecial = useDeleteWeeklySpecial();

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (special: WeeklySpecial) => {
    setEditingId(special.id);
    setForm({
      dish_id: String(special.dish_id),
      start_date: toInputDate(special.start_date),
      end_date: toInputDate(special.end_date),
      special_price: special.special_price != null ? String(special.special_price) : '',
      description: special.description || '',
      is_active: special.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      dish_id: parseInt(form.dish_id),
      start_date: form.start_date,
      end_date: form.end_date,
      special_price: form.special_price ? parseFloat(form.special_price) : undefined,
      description: form.description,
      is_active: form.is_active,
    };

    try {
      if (editingId) {
        await updateSpecial.mutateAsync({ id: editingId, ...data });
        toast.success('Plat de la semaine mis à jour');
      } else {
        await createSpecial.mutateAsync(data);
        toast.success('Plat de la semaine créé');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce plat de la semaine ?')) return;
    try {
      await deleteSpecial.mutateAsync(id);
      toast.success('Supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleToggle = async (special: WeeklySpecial) => {
    try {
      await updateSpecial.mutateAsync({ id: special.id, is_active: !special.is_active });
    } catch {
      toast.error('Erreur de mise à jour');
    }
  };

  return (
    <div>
      <AdminHeader />
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex justify-end mb-4">
          <Button onClick={openCreate} size="sm" className="bg-[#d4a24e] text-[#1a1310] hover:bg-[#c4922e]">
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-center py-8">Chargement...</p>
        ) : specials.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucun plat de la semaine</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plat</TableHead>
                <TableHead className="w-28">Du</TableHead>
                <TableHead className="w-28">Au</TableHead>
                <TableHead className="w-24 text-right">Prix spécial</TableHead>
                <TableHead className="w-20 text-center">Actif</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {specials.map((special) => (
                <TableRow key={special.id}>
                  <TableCell className="font-medium text-gray-900">{special.dish.name_fr}</TableCell>
                  <TableCell className="text-gray-600 text-sm">{formatDate(special.start_date)}</TableCell>
                  <TableCell className="text-gray-600 text-sm">{formatDate(special.end_date)}</TableCell>
                  <TableCell className="text-right text-gray-700">
                    {special.special_price != null ? `${Number(special.special_price).toFixed(2)} \u20ac` : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <AvailabilityToggle isAvailable={special.is_active} onToggle={() => handleToggle(special)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(special)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(special.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {editingId ? 'Modifier le plat de la semaine' : 'Nouveau plat de la semaine'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-gray-700">Plat <span className="text-red-500">*</span></Label>
              <Select value={form.dish_id} onValueChange={(v) => v && setForm((f) => ({ ...f, dish_id: v }))}>
                <SelectTrigger className="bg-white text-gray-900">
                  <SelectValue placeholder="Sélectionner un plat" />
                </SelectTrigger>
                <SelectContent>
                  {dishes.map((dish) => (
                    <SelectItem key={dish.dish_id} value={String(dish.dish_id)}>
                      {dish.name_fr} ({Number(dish.price_eur).toFixed(2)} &euro;)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700">Date de début <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.start_date} required
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="bg-white text-gray-900" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-700">Date de fin <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.end_date} required
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="bg-white text-gray-900" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-gray-700">Prix spécial (optionnel)</Label>
              <Input type="number" step="0.01" min="0" value={form.special_price}
                onChange={(e) => setForm((f) => ({ ...f, special_price: e.target.value }))}
                placeholder="Laisser vide = prix normal" className="bg-white text-gray-900 w-36" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-gray-700">Description</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Description optionnelle..."
                className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-[#d4a24e] text-[#1a1310] hover:bg-[#c4922e]"
                disabled={createSpecial.isPending || updateSpecial.isPending}>
                {editingId ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
