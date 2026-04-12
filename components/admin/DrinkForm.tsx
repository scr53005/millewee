'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrilingualInput } from './TrilingualInput';
import { AvailabilityToggle } from './AvailabilityToggle';
import { useCategories } from '@/hooks/use-categories';
import type { Drink } from '@/hooks/use-drinks';
import { Plus, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SizeForm {
  size: string;
  price_eur: string;
  discount: string;
  image_url: string;
}

interface SelectionForm {
  id?: number;
  name_fr: string;
  name_en: string;
  name_lb: string;
  price_delta: string;
  sort_order: number;
  is_available: boolean;
}

interface DrinkFormProps {
  drink?: Drink;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  loading?: boolean;
}

const emptySize: SizeForm = { size: '', price_eur: '', discount: '', image_url: '' };
const emptySelection: SelectionForm = { name_fr: '', name_en: '', name_lb: '', price_delta: '0', sort_order: 0, is_available: true };

export function DrinkForm({ drink, onSubmit, onCancel, loading }: DrinkFormProps) {
  const { data: categories = [] } = useCategories('drinks');

  const [nameFr, setNameFr] = useState(drink?.name_fr || '');
  const [nameEn, setNameEn] = useState(drink?.name_en || '');
  const [nameLb, setNameLb] = useState(drink?.name_lb || '');
  const [descFr, setDescFr] = useState(drink?.description_fr || '');
  const [descEn, setDescEn] = useState(drink?.description_en || '');
  const [descLb, setDescLb] = useState(drink?.description_lb || '');
  const [selectionMode, setSelectionMode] = useState<string>(drink?.selection_mode || 'none');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
    drink?.categories.map((c) => c.category_id) || []
  );
  const [sizes, setSizes] = useState<SizeForm[]>(
    drink?.sizes.map((s) => ({
      size: s.size,
      price_eur: String(s.price_eur),
      discount: s.discount != null ? String(s.discount) : '',
      image_url: s.image_url || '',
    })) || [{ ...emptySize }]
  );
  const [selections, setSelections] = useState<SelectionForm[]>(
    drink?.selections.map((s) => ({
      id: s.id,
      name_fr: s.name_fr,
      name_en: s.name_en || '',
      name_lb: s.name_lb || '',
      price_delta: String(s.price_delta),
      sort_order: s.sort_order,
      is_available: s.is_available,
    })) || []
  );

  const toggleCategory = (id: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const addSize = () => setSizes((prev) => [...prev, { ...emptySize }]);
  const removeSize = (idx: number) => setSizes((prev) => prev.filter((_, i) => i !== idx));
  const updateSize = (idx: number, field: keyof SizeForm, value: string) => {
    setSizes((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const addSelection = () => setSelections((prev) => [...prev, { ...emptySelection, sort_order: prev.length }]);
  const removeSelection = (idx: number) => setSelections((prev) => prev.filter((_, i) => i !== idx));
  const updateSelection = (idx: number, field: keyof SelectionForm, value: string | number | boolean) => {
    setSelections((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name_fr: nameFr,
      name_en: nameEn,
      name_lb: nameLb,
      description_fr: descFr,
      description_en: descEn,
      description_lb: descLb,
      selection_mode: selectionMode === 'none' ? null : selectionMode,
      category_ids: selectedCategoryIds,
      sizes: sizes.filter((s) => s.size && s.price_eur).map((s) => ({
        size: s.size,
        price_eur: parseFloat(s.price_eur),
        discount: s.discount ? parseFloat(s.discount) : undefined,
        image_url: s.image_url,
      })),
      selections: selections.map((s) => ({
        name_fr: s.name_fr,
        name_en: s.name_en,
        name_lb: s.name_lb,
        price_delta: parseFloat(s.price_delta) || 0,
        sort_order: s.sort_order,
        is_available: s.is_available,
      })),
    });
  };

  return (
    <ScrollArea className="max-h-[80vh]">
      <form onSubmit={handleSubmit} className="space-y-5 pr-4">
        <TrilingualInput label="Nom" required valueFr={nameFr} valueEn={nameEn} valueLb={nameLb}
          onChangeFr={setNameFr} onChangeEn={setNameEn} onChangeLb={setNameLb} />

        <TrilingualInput label="Description" multiline valueFr={descFr} valueEn={descEn} valueLb={descLb}
          onChangeFr={setDescFr} onChangeEn={setDescEn} onChangeLb={setDescLb} />

        <div className="space-y-1.5">
          <Label className="text-gray-700">Mode de sélection</Label>
          <Select value={selectionMode} onValueChange={(v) => v && setSelectionMode(v)}>
            <SelectTrigger className="bg-white text-gray-900 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun</SelectItem>
              <SelectItem value="selection">Sélection</SelectItem>
              <SelectItem value="variant">Variante</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Categories */}
        <div className="space-y-1.5">
          <Label className="text-gray-700">Catégories</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button key={cat.id} type="button" onClick={() => toggleCategory(cat.id)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  selectedCategoryIds.includes(cat.id)
                    ? 'bg-[#d4a24e] text-[#1a1310] border-[#d4a24e]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}>
                {cat.name_fr}
              </button>
            ))}
          </div>
        </div>

        {/* Sizes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-gray-700">Tailles & Prix <span className="text-red-500">*</span></Label>
            <Button type="button" variant="ghost" size="sm" onClick={addSize}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
            </Button>
          </div>
          {sizes.map((s, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input value={s.size} onChange={(e) => updateSize(idx, 'size', e.target.value)}
                placeholder="Taille (ex: 0.30L)" className="bg-white text-gray-900 text-sm flex-1" required />
              <Input value={s.price_eur} onChange={(e) => updateSize(idx, 'price_eur', e.target.value)}
                placeholder="Prix" type="number" step="0.01" className="bg-white text-gray-900 text-sm w-24" required />
              <Input value={s.discount} onChange={(e) => updateSize(idx, 'discount', e.target.value)}
                placeholder="Remise" type="number" step="0.01" className="bg-white text-gray-900 text-sm w-20" />
              {sizes.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                  onClick={() => removeSize(idx)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Selections */}
        {selectionMode !== 'none' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-700">Sélections</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addSelection}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
              </Button>
            </div>
            {selections.map((s, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded-md">
                <div className="flex-1 space-y-1.5">
                  <Input value={s.name_fr} onChange={(e) => updateSelection(idx, 'name_fr', e.target.value)}
                    placeholder="Nom (FR)" className="bg-white text-gray-900 text-sm" required />
                  <div className="flex gap-2 items-center">
                    <Input value={s.price_delta} onChange={(e) => updateSelection(idx, 'price_delta', e.target.value)}
                      placeholder="Delta prix" type="number" step="0.01" className="bg-white text-gray-900 text-sm w-24" />
                    <AvailabilityToggle isAvailable={s.is_available}
                      onToggle={() => updateSelection(idx, 'is_available', !s.is_available)} />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                  onClick={() => removeSelection(idx)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white py-3">
          <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
          <Button type="submit" disabled={loading} className="bg-[#d4a24e] text-[#1a1310] hover:bg-[#c4922e]">
            {loading ? 'Enregistrement...' : drink ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </ScrollArea>
  );
}
