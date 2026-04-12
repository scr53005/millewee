'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrilingualInput } from './TrilingualInput';
import { AvailabilityToggle } from './AvailabilityToggle';
import { useAllergens } from '@/hooks/use-allergens';
import { useCategories } from '@/hooks/use-categories';
import type { Dish, DishVariant } from '@/hooks/use-dishes';
import { Plus, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VariantForm {
  id?: number;
  name_fr: string;
  name_en: string;
  name_lb: string;
  price_eur: string;
  sort_order: number;
  is_available: boolean;
}

interface DishFormProps {
  dish?: Dish;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  loading?: boolean;
}

function variantToForm(v: DishVariant): VariantForm {
  return {
    id: v.id,
    name_fr: v.name_fr,
    name_en: v.name_en || '',
    name_lb: v.name_lb || '',
    price_eur: v.price_eur != null ? String(v.price_eur) : '',
    sort_order: v.sort_order,
    is_available: v.is_available,
  };
}

const emptyVariant: VariantForm = {
  name_fr: '', name_en: '', name_lb: '', price_eur: '', sort_order: 0, is_available: true,
};

export function DishForm({ dish, onSubmit, onCancel, loading }: DishFormProps) {
  const { data: allergens = [] } = useAllergens();
  const { data: categories = [] } = useCategories('dishes');

  // Form state
  const [nameFr, setNameFr] = useState(dish?.name_fr || '');
  const [nameEn, setNameEn] = useState(dish?.name_en || '');
  const [nameLb, setNameLb] = useState(dish?.name_lb || '');
  const [descFr, setDescFr] = useState(dish?.description_fr || '');
  const [descEn, setDescEn] = useState(dish?.description_en || '');
  const [descLb, setDescLb] = useState(dish?.description_lb || '');
  const [priceEur, setPriceEur] = useState(dish ? String(dish.price_eur) : '');
  const [discount, setDiscount] = useState(dish?.discount != null ? String(dish.discount) : '1.0');
  const [imageUrl, setImageUrl] = useState(dish?.image_url || '');
  const [isAvailable, setIsAvailable] = useState(dish?.is_available ?? true);
  const [isPopular, setIsPopular] = useState(dish?.is_popular ?? false);
  const [isNew, setIsNew] = useState(dish?.is_new ?? false);
  const [sortOrder, setSortOrder] = useState(dish?.sort_order ?? 0);
  const [hasVariants, setHasVariants] = useState(dish?.has_variants ?? false);
  const [selectionLabel, setSelectionLabel] = useState(dish?.selection_label || '');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
    dish?.categories.map((c) => c.category_id) || []
  );
  const [selectedAllergenIds, setSelectedAllergenIds] = useState<number[]>(
    dish?.allergens.map((a) => a.allergen_id) || []
  );
  const [variants, setVariants] = useState<VariantForm[]>(
    dish?.variants.map(variantToForm) || []
  );

  const toggleCategory = (id: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleAllergen = (id: number) => {
    setSelectedAllergenIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const addVariant = () => setVariants((prev) => [...prev, { ...emptyVariant, sort_order: prev.length }]);
  const removeVariant = (idx: number) => setVariants((prev) => prev.filter((_, i) => i !== idx));
  const updateVariant = (idx: number, field: keyof VariantForm, value: string | number | boolean) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
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
      price_eur: parseFloat(priceEur),
      discount: parseFloat(discount) || 1.0,
      image_url: imageUrl,
      is_available: isAvailable,
      is_popular: isPopular,
      is_new: isNew,
      sort_order: sortOrder,
      has_variants: hasVariants,
      selection_label: selectionLabel,
      category_ids: selectedCategoryIds,
      allergen_ids: selectedAllergenIds,
      variants: variants.map((v) => ({
        name_fr: v.name_fr,
        name_en: v.name_en,
        name_lb: v.name_lb,
        price_eur: v.price_eur ? parseFloat(v.price_eur) : undefined,
        sort_order: v.sort_order,
        is_available: v.is_available,
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

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-gray-700">Prix (EUR) <span className="text-red-500">*</span></Label>
            <Input type="number" step="0.01" min="0" required value={priceEur}
              onChange={(e) => setPriceEur(e.target.value)} className="bg-white text-gray-900" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-700">Remise</Label>
            <Input type="number" step="0.01" min="0" value={discount}
              onChange={(e) => setDiscount(e.target.value)} className="bg-white text-gray-900" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-700">Ordre</Label>
            <Input type="number" value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className="bg-white text-gray-900" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-gray-700">Image URL</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..." className="bg-white text-gray-900" />
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="rounded" />
            Disponible
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isPopular} onChange={(e) => setIsPopular(e.target.checked)} className="rounded" />
            Populaire
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="rounded" />
            Nouveau
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} className="rounded" />
            Variantes
          </label>
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

        {/* Allergens */}
        <div className="space-y-1.5">
          <Label className="text-gray-700">Allergènes</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {allergens.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-xs text-gray-700 py-0.5">
                <input type="checkbox" checked={selectedAllergenIds.includes(a.id)}
                  onChange={() => toggleAllergen(a.id)} className="rounded" />
                <span>{a.icon} {a.name_fr}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Variants */}
        {hasVariants && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-700">Variantes</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addVariant}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
              </Button>
            </div>
            {selectionLabel !== undefined && (
              <Input value={selectionLabel} onChange={(e) => setSelectionLabel(e.target.value)}
                placeholder="Label de sélection (ex: Taille, Type...)" className="bg-white text-gray-900 text-sm" />
            )}
            {variants.map((v, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded-md">
                <div className="flex-1 space-y-1.5">
                  <Input value={v.name_fr} onChange={(e) => updateVariant(idx, 'name_fr', e.target.value)}
                    placeholder="Nom (FR)" className="bg-white text-gray-900 text-sm" required />
                  <div className="flex gap-2">
                    <Input value={v.price_eur} onChange={(e) => updateVariant(idx, 'price_eur', e.target.value)}
                      placeholder="Prix (optionnel)" type="number" step="0.01" className="bg-white text-gray-900 text-sm w-28" />
                    <AvailabilityToggle isAvailable={v.is_available}
                      onToggle={() => updateVariant(idx, 'is_available', !v.is_available)} />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                  onClick={() => removeVariant(idx)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white py-3">
          <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
          <Button type="submit" disabled={loading} className="bg-[#d4a24e] text-[#1a1310] hover:bg-[#c4922e]">
            {loading ? 'Enregistrement...' : dish ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </ScrollArea>
  );
}
