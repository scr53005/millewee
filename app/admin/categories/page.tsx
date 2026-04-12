'use client';

import { useState } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AvailabilityToggle } from '@/components/admin/AvailabilityToggle';
import { TrilingualInput } from '@/components/admin/TrilingualInput';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/use-categories';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CategoryForm {
  name_fr: string;
  name_en: string;
  name_lb: string;
  type: 'dishes' | 'drinks';
  sort_order: number;
  is_active: boolean;
}

const emptyForm: CategoryForm = {
  name_fr: '', name_en: '', name_lb: '', type: 'dishes', sort_order: 0, is_active: true,
};

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState('dishes');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

  const { data: categories = [], isLoading } = useCategories(activeTab);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, type: activeTab as 'dishes' | 'drinks' });
    setDialogOpen(true);
  };

  const openEdit = (cat: typeof categories[0]) => {
    setEditingId(cat.id);
    setForm({
      name_fr: cat.name_fr,
      name_en: cat.name_en || '',
      name_lb: cat.name_lb || '',
      type: cat.type as 'dishes' | 'drinks',
      sort_order: cat.sort_order,
      is_active: cat.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateCategory.mutateAsync({ id: editingId, ...form });
        toast.success('Catégorie mise à jour');
      } else {
        await createCategory.mutateAsync(form);
        toast.success('Catégorie créée');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Supprimer la catégorie "${name}" ?`)) return;
    try {
      await deleteCategory.mutateAsync(id);
      toast.success('Catégorie supprimée');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleToggleAvailability = async (cat: typeof categories[0]) => {
    try {
      await updateCategory.mutateAsync({ id: cat.id, is_active: !cat.is_active });
    } catch {
      toast.error('Erreur de mise à jour');
    }
  };

  return (
    <div>
      <AdminHeader />
      <div className="max-w-4xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(String(v))}>
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-gray-100">
              <TabsTrigger value="dishes">Plats</TabsTrigger>
              <TabsTrigger value="drinks">Boissons</TabsTrigger>
            </TabsList>
            <Button onClick={openCreate} size="sm" className="bg-[#d4a24e] text-[#1a1310] hover:bg-[#c4922e]">
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>

          {['dishes', 'drinks'].map((tab) => (
            <TabsContent key={tab} value={tab}>
              {isLoading ? (
                <p className="text-gray-500 text-center py-8">Chargement...</p>
              ) : categories.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucune catégorie</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom (FR)</TableHead>
                      <TableHead>EN</TableHead>
                      <TableHead>LB</TableHead>
                      <TableHead className="w-20 text-center">Ordre</TableHead>
                      <TableHead className="w-20 text-center">Actif</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat) => (
                      <TableRow key={cat.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openEdit(cat)}>
                        <TableCell className="font-medium text-gray-900">{cat.name_fr}</TableCell>
                        <TableCell className="text-gray-500">{cat.name_en || '—'}</TableCell>
                        <TableCell className="text-gray-500">{cat.name_lb || '—'}</TableCell>
                        <TableCell className="text-center text-gray-500">{cat.sort_order}</TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <AvailabilityToggle
                            isAvailable={cat.is_active}
                            onToggle={() => handleToggleAvailability(cat)}
                          />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDelete(cat.id, cat.name_fr)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <TrilingualInput
              label="Nom"
              required
              valueFr={form.name_fr}
              valueEn={form.name_en}
              valueLb={form.name_lb}
              onChangeFr={(v) => setForm((f) => ({ ...f, name_fr: v }))}
              onChangeEn={(v) => setForm((f) => ({ ...f, name_en: v }))}
              onChangeLb={(v) => setForm((f) => ({ ...f, name_lb: v }))}
            />

            {!editingId && (
              <div className="space-y-1.5">
                <Label className="text-gray-700">Type</Label>
                <Select value={form.type} onValueChange={(v) => v && setForm((f) => ({ ...f, type: v as 'dishes' | 'drinks' }))}>
                  <SelectTrigger className="bg-white text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dishes">Plats</SelectItem>
                    <SelectItem value="drinks">Boissons</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-gray-700">Ordre de tri</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                className="bg-white text-gray-900 w-24"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-[#d4a24e] text-[#1a1310] hover:bg-[#c4922e]">
                {editingId ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
