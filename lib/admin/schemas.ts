import { z } from 'zod';

// ─── Categories ───

export const categorySchema = z.object({
  name_fr: z.string().min(1, 'Nom français requis'),
  name_en: z.string().optional().default(''),
  name_lb: z.string().optional().default(''),
  type: z.enum(['dishes', 'drinks']),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

// ─── Dishes ───

export const dishVariantSchema = z.object({
  id: z.number().optional(), // present when editing
  name_fr: z.string().min(1, 'Nom français requis'),
  name_en: z.string().optional().default(''),
  name_lb: z.string().optional().default(''),
  price_eur: z.coerce.number().positive().optional(),
  sort_order: z.coerce.number().int().default(0),
  is_available: z.boolean().default(true),
});

export const dishSchema = z.object({
  name_fr: z.string().min(1, 'Nom français requis'),
  name_en: z.string().optional().default(''),
  name_lb: z.string().optional().default(''),
  description_fr: z.string().optional().default(''),
  description_en: z.string().optional().default(''),
  description_lb: z.string().optional().default(''),
  price_eur: z.coerce.number().positive('Prix requis'),
  discount: z.coerce.number().positive().default(1.0),
  image_url: z.string().optional().default(''),
  is_available: z.boolean().default(true),
  is_popular: z.boolean().default(false),
  is_new: z.boolean().default(false),
  sort_order: z.coerce.number().int().default(0),
  has_variants: z.boolean().default(false),
  selection_label: z.string().optional().default(''),
  category_ids: z.array(z.number()).default([]),
  allergen_ids: z.array(z.number()).default([]),
  variants: z.array(dishVariantSchema).default([]),
});

export type DishFormData = z.infer<typeof dishSchema>;
export type DishVariantFormData = z.infer<typeof dishVariantSchema>;

// ─── Drinks ───

export const drinkSizeSchema = z.object({
  size: z.string().min(1, 'Taille requise'),
  price_eur: z.coerce.number().positive('Prix requis'),
  discount: z.coerce.number().positive().optional(),
  image_url: z.string().optional().default(''),
});

export const drinkSelectionSchema = z.object({
  id: z.number().optional(),
  name_fr: z.string().min(1, 'Nom français requis'),
  name_en: z.string().optional().default(''),
  name_lb: z.string().optional().default(''),
  price_delta: z.coerce.number().default(0),
  sort_order: z.coerce.number().int().default(0),
  is_available: z.boolean().default(true),
});

export const drinkSchema = z.object({
  name_fr: z.string().min(1, 'Nom français requis'),
  name_en: z.string().optional().default(''),
  name_lb: z.string().optional().default(''),
  description_fr: z.string().optional().default(''),
  description_en: z.string().optional().default(''),
  description_lb: z.string().optional().default(''),
  selection_mode: z.enum(['selection', 'variant']).nullable().optional(),
  category_ids: z.array(z.number()).default([]),
  sizes: z.array(drinkSizeSchema).min(1, 'Au moins une taille requise'),
  selections: z.array(drinkSelectionSchema).default([]),
});

export type DrinkFormData = z.infer<typeof drinkSchema>;
export type DrinkSizeFormData = z.infer<typeof drinkSizeSchema>;
export type DrinkSelectionFormData = z.infer<typeof drinkSelectionSchema>;

// ─── Weekly Specials ───

export const weeklySpecialSchema = z.object({
  dish_id: z.coerce.number().int().positive('Plat requis'),
  start_date: z.string().min(1, 'Date de début requise'),
  end_date: z.string().min(1, 'Date de fin requise'),
  special_price: z.coerce.number().positive().optional(),
  description: z.string().optional().default(''),
  is_active: z.boolean().default(true),
});

export type WeeklySpecialFormData = z.infer<typeof weeklySpecialSchema>;

// ─── Services ───

export const servicesSchema = z.object({
  name_fr: z.string().min(1, 'Nom français requis'),
  name_en: z.string().min(1, 'Nom anglais requis'),
  name_lb: z.string().min(1, 'Nom luxembourgeois requis'),
  sort_order: z.coerce.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true),
});

export type ServiceFormData = z.infer<typeof servicesSchema>;

// ─── Standard Week ───

const intervalSchema = z
  .union([
    z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/, 'Format HH:MM-HH:MM').refine(
      (s) => {
        const [o, c] = s.split('-');
        return o < c;
      },
      { message: "L'heure de fermeture doit être après l'ouverture" },
    ),
    z.literal(''),
    z.null(),
  ])
  .transform((v) => (v === '' ? null : v));

export const standardWeekSchema = z.object({
  service_id: z.coerce.number().int().positive(),
  mon: intervalSchema,
  tue: intervalSchema,
  wed: intervalSchema,
  thu: intervalSchema,
  fri: intervalSchema,
  sat: intervalSchema,
  sun: intervalSchema,
});

export type StandardWeekFormData = z.infer<typeof standardWeekSchema>;

export const regenerateScheduleSchema = z.object({
  weeks: z.coerce.number().int().positive().max(52).default(4),
});
