# Millewee — Project Status

**Last updated**: 2026-04-13

---

## Phase 1: Scaffold + Data Model — COMPLETE

- [x] Next.js 15 scaffold (App Router, TypeScript, Tailwind CSS v4, Turbopack)
- [x] shadcn/ui init (base-nova style, Base UI primitives, Lucide icons)
- [x] Brand identity CSS (light+dark palettes, custom tokens)
- [x] Fonts (Playfair Display display + DM Sans body)
- [x] ThemeProvider + ThemeToggle (next-themes, dark default)
- [x] Landing page with logo, green wall strip, tagline
- [x] Prisma 7 setup (18 models, `prisma.config.ts`, `@prisma/adapter-pg`)
- [x] Local dev + Vercel prod databases, seed script, copy-data script
- [x] Translation script (Claude API via Haiku 4.5, trilingual FR/EN/LB)
- [x] QR code generation script (44 tables, branded stickers)
- [x] Vercel deployment working

### Data files location

Raw menu data in `public/dishes-raw/` (gitignored):
- `Millewee dishes.csv` — 52 dishes across 8 categories
- `millewee boissons.csv` — 45 drinks across 11 categories (Latin-1 encoded, semicolon-delimited)

---

## Phase 2: Admin Menu Management — COMPLETE

- [x] **Auth layer** — `proxy.ts` (Next.js 16 convention), `/api/admin/auth` (POST login / DELETE logout), cookie-based session
- [x] **Admin layout** — forced light theme, `font-sans`, QueryProvider, Toaster
- [x] **Admin dashboard** — nav cards (Catégories, Plats, Boissons, Allergènes, Plats de la Semaine)
- [x] **Navigation header** — horizontal nav bar with all pages, active page highlighted with amber bg + 1.5px ring, back arrow to dashboard
- [x] **Login page** — shadcn Card, amber branding, Suspense-wrapped `useSearchParams`
- [x] **Shared utilities**:
  - `lib/admin/schemas.ts` — Zod schemas for all entities
  - `components/admin/TrilingualInput.tsx` — FR/EN/LB tab switcher
  - `components/admin/AvailabilityToggle.tsx` — inline toggle
  - `app/providers/QueryProvider.tsx` — React Query wrapper
- [x] **Category CRUD** — API routes (GET/POST/PUT/DELETE), React Query hook, two-tab page (Plats/Boissons) with amber active tab styling, FK-protected delete
- [x] **Dish CRUD** — API routes (full CRUD + allergens + variants), DishForm (trilingual, price, discount, categories, allergens, variants), table page with category filter
- [x] **Drink CRUD** — API routes (full CRUD + sizes replace-all + selections), DrinkForm (trilingual, sizes, selections, selection mode, categories), table page with category filter and price range display
- [x] **Allergen matrix** — read-only allergen API, checkbox matrix (dishes × 14 EU allergens), search filter, sticky first column with amber header
- [x] **Weekly specials CRUD** — API routes, dish dropdown, date range, special price, table page
- [x] **Table headers** — light amber background (`#fdf6e9`) + bold text across all admin tables
- [x] **Schema fix** — added `discount Float? @default(1.0)` to `dish`, changed `drink_size.discount` to `Float?`
- [x] **Allergen icon fix** — Soja emoji changed from 🫘 (not supported on Windows 10) to 🌱

### Files created in Phase 2 (~30 files)

```
proxy.ts                                   # Auth guard (Next.js 16 proxy convention)
app/admin/layout.tsx                       # Light theme wrapper + QueryProvider
app/admin/page.tsx                         # Dashboard with nav cards
app/admin/login/page.tsx                   # Login form (Suspense-wrapped)
app/admin/categories/page.tsx              # Category CRUD
app/admin/dishes/page.tsx                  # Dish CRUD
app/admin/drinks/page.tsx                  # Drink CRUD
app/admin/allergens/page.tsx               # Allergen assignment matrix
app/admin/weekly-specials/page.tsx         # Weekly specials CRUD
app/api/admin/auth/route.ts               # Login/logout
app/api/admin/categories/route.ts          # GET/POST
app/api/admin/categories/[id]/route.ts     # PUT/DELETE
app/api/admin/dishes/route.ts              # GET/POST
app/api/admin/dishes/[id]/route.ts         # PUT/DELETE
app/api/admin/dishes/[id]/allergens/route.ts  # PUT (replace set)
app/api/admin/drinks/route.ts              # GET/POST
app/api/admin/drinks/[id]/route.ts         # PUT/DELETE
app/api/admin/allergens/route.ts           # GET (read-only)
app/api/admin/weekly-specials/route.ts     # GET/POST
app/api/admin/weekly-specials/[id]/route.ts  # PUT/DELETE
app/providers/QueryProvider.tsx             # React Query provider
lib/admin/schemas.ts                       # Zod validation schemas
hooks/use-categories.ts                    # React Query hook
hooks/use-dishes.ts                        # React Query hook
hooks/use-drinks.ts                        # React Query hook
hooks/use-allergens.ts                     # React Query hook
hooks/use-weekly-specials.ts               # React Query hook
components/admin/AdminHeader.tsx           # Nav header (all pages, active highlight)
components/admin/TrilingualInput.tsx        # FR/EN/LB input with tabs
components/admin/DishForm.tsx              # Dish create/edit dialog
components/admin/DrinkForm.tsx             # Drink create/edit dialog
components/admin/AvailabilityToggle.tsx     # Inline toggle
scripts/update-allergen-icon.ts            # DB allergen icon updater
```

### Base UI / shadcn quirk (Next.js 16 + shadcn base-nova)

The Select, Dialog, and Tabs components use Base UI primitives which pass extra `eventDetails` parameters to callbacks like `onValueChange` and `onOpenChange`. Direct `setState` dispatchers don't type-check — always wrap in an arrow function: `onValueChange={(v) => v && setValue(v)}`, `onOpenChange={(open) => setOpen(open)}`.

DropdownMenuTrigger renders its own `<button>` — never nest a `<Button>` inside it. Use className directly on the trigger instead.

---

## Phase 3: Customer Menu & Cart — IN PROGRESS

Customer-facing menu browsing and cart functionality. This is what restaurant guests see when they scan a QR code (`millewee.innopay.lu/?table=N`).

### Completed

- [x] **i18n system** — `lib/i18n/` (translations.ts, context.tsx, index.ts). FR/EN/LB with `t()` for UI strings and `localized(row, field)` for DB rows. Persisted in `localStorage('millewee_lang')`
- [x] **Table context** — `lib/table-context.tsx`. Reads `?table=N` from URL, stores in localStorage. Wrapped in Suspense via `TableDetector.tsx`
- [x] **Public menu API routes** — read-only, no auth, available items only:
  - `app/api/menu/dishes/route.ts` — dishes with variants, allergens, categories
  - `app/api/menu/drinks/route.ts` — drinks with sizes, selections, categories
  - `app/api/menu/specials/route.ts` — active weekly specials (date-filtered)
- [x] **Menu data hooks** — `hooks/use-menu.ts` (useMenuDishes, useMenuDrinks, useMenuSpecials)
- [x] **Cart state machine** — `lib/cart/types.ts` + `lib/cart/reducer.ts` + `hooks/use-cart.tsx`. useReducer pattern (ADD/REMOVE/UPDATE_QUANTITY/UPDATE_COMMENT/CLEAR/HYDRATE). localStorage persistence with 7-day expiry, cross-tab sync via StorageEvent
- [x] **Customer layout** — `app/(customer)/layout.tsx` with QueryProvider > I18nProvider > CartProvider > TableDetector. Old `app/page.tsx` renamed to `page.old.tsx`
- [x] **Menu header** — sticky header with logo, "Millewee" title (Playfair Display, large), language switcher (dropdown), "Table N" indicator, theme toggle, cart button with item count badge
- [x] **Dishes/Drinks toggle** — sticky tab bar below header to switch between dishes and drinks views (only one rendered at a time)
- [x] **Dish cards** — tap-to-expand with newspaper texture. Collapsed: name, price, discount strike-through, popular/new badges, allergen icons, quick-add button. Expanded: description, Next.js `<Image>`, variant selector, add-to-cart button
- [x] **Drink cards** — size pill selector, selection picker, price calculation per size + delta. Next.js `<Image>` for size images
- [x] **Category sections** — sticky horizontal category tabs with scroll-spy. Scroll-to-category with sticky header offset. Dishes in single column, drinks in responsive grid
- [x] **Weekly specials banner** — horizontal scroll of special cards with special pricing, add-to-cart
- [x] **Cart sheet** — slide-out sheet with item list, quantity ±, per-item comments (separate placeholders for dishes vs drinks), remove, total, disabled order button ("Payment coming soon"), clear cart
- [x] **Floating cart button** — fixed FAB showing total price + item count, opens cart sheet
- [x] **CSS additions** — `.newspaper-texture` (SVG pattern), `.scrollbar-hide` (hidden scrollbar for horizontal scroll)
- [x] **Allergen A/B testing** — Two menu variants running in parallel:
  - **Variant A** (`page_A.tsx`): inline allergen emoji icons in collapsed dish card view
  - **Variant B** (`page_B.tsx`): allergen info button in expanded view, opens `AllergenModal` with emoji + name
  - Entry page (`page.tsx`) shows landing page with variant toggle buttons
  - `DishCard.tsx` accepts `allergenDisplay: 'inline' | 'modal'` prop
  - `AllergenModal.tsx` — small Dialog modal showing allergen details for a dish
  - `DishesSection.tsx` passes `allergenDisplay` prop through to DishCard
- [x] **Toast removal** — add-to-cart toasts commented out in DishCard, DrinkCard, WeeklySpecialsBanner (toast import retained as comment for potential re-enablement)

### Known issues / TODO

- [ ] Scroll-spy threshold values may need fine-tuning on different screen sizes
- [ ] No dish/drink images in DB yet — admin UI has `image_url` field but no upload mechanism (Phase 6)
- [ ] Order button is disabled — payment integration is Phase 4
- [ ] A/B allergen testing: decide which variant wins, then promote it to `page.tsx` and remove the other
- [ ] Not yet deployed to production (ready to deploy)

### Files created in Phase 3 (~26 files)

```
lib/i18n/translations.ts                  # FR/EN/LB translation maps (~40 keys)
lib/i18n/context.tsx                       # I18nProvider + useI18n hook
lib/i18n/index.ts                          # Re-exports
lib/table-context.tsx                      # Table number from URL + localStorage
lib/cart/types.ts                          # CartItemDish, CartItemDrink, effectivePrice
lib/cart/reducer.ts                        # Cart state machine (useReducer)
hooks/use-menu.ts                          # useMenuDishes, useMenuDrinks, useMenuSpecials
hooks/use-cart.tsx                         # CartProvider + useCart hook
app/api/menu/dishes/route.ts              # Public dishes API
app/api/menu/drinks/route.ts              # Public drinks API
app/api/menu/specials/route.ts            # Active weekly specials API
app/(customer)/layout.tsx                  # Customer layout with all providers
app/(customer)/page.tsx                    # Entry page with A/B variant toggle
app/(customer)/page_A.tsx                  # Menu variant A (inline allergens)
app/(customer)/page_B.tsx                  # Menu variant B (modal allergens)
components/menu/TableDetector.tsx          # Suspense-wrapped TableProvider
components/menu/MenuHeader.tsx             # Sticky header with logo, lang, cart
components/menu/AllergenIcons.tsx          # Inline emoji allergen display
components/menu/AllergenModal.tsx          # Dialog modal for allergen details
components/menu/DishCard.tsx               # Tap-to-expand dish card (A/B prop)
components/menu/DrinkCard.tsx              # Drink card with size/selection pickers
components/menu/DishesSection.tsx          # Scroll-spy dishes by category
components/menu/DrinksSection.tsx          # Scroll-spy drinks by category
components/menu/WeeklySpecialsBanner.tsx   # Horizontal specials scroll
components/menu/CartSheet.tsx              # Cart slide-out sheet
components/menu/FloatingCartButton.tsx     # Fixed FAB with total
```

---

## Phase 4+5: Payment Integration + CO Page (planned)

Phases 4 and 5 merged — payment and CO page share the `transfers` table and merchant-hub integration; the CO page is needed to validate end-to-end "table to kitchen" flow.

**Reference**: Follow `SPOKE-DOCUMENTATION.md` (Next.js + Prisma spoke path). Copy from indiesmenu (backend) + croque-bedaine (state machine style).

### Key decisions (April 2026)

- **Hive accounts**: PROD = `millewee`, DEV = `innodemo`
- **Merchant-hub registration**: Add to `merchant-hub/lib/config.ts` (see SPOKE-DOCUMENTATION.md "Merchant-Hub Registration" section)
- **i18n**: Full trilingual (FR/EN/LB) for all innopay UI strings
- **Call waiter**: Yes, same as indiesmenu/croque-bedaine
- **Delayed ordering**: NOT in MVP, but design must accommodate it (keep `CartItem` extensible for `delayedTiming`)

### Payment integration tasks

- [ ] Merchant-hub registration (`merchant-hub/lib/config.ts` + env vars + deploy)
- [ ] `transfers` model in Prisma schema + migration
- [ ] Environment config (`lib/environment.ts` — `isPrivateNetwork()`, `EnvironmentConfig`)
- [ ] Innopay utility files (`lib/innopay/utils.ts`, `hive.ts`, `config.ts`)
- [ ] Payment state machine (`state/innopay/paymentStateMachine.ts`)
- [ ] Payment hooks (`hooks/innopay/usePaymentFlow.ts`, `useInnopayCart.ts`, `useBalance.ts`)
- [ ] UI components (`components/innopay/Draggable.tsx`, `MiniWallet.tsx`, `BottomBanner.tsx`, `WalletNotificationBanner.tsx`, `ImportAccountModal.tsx`)
- [ ] All payment flows (Flow 3 guest, Flow 5 account+pay, Flow 6 wallet, Flow 7 topup, Flow 8 import)
- [ ] Guardrails (L1 account link, L2 pulsing, L3 dedup modal)
- [ ] Flow 6 cooldown (12s post-payment)
- [ ] Cart integration — wire CartSheet order button to `usePaymentFlow`
- [ ] Trilingual innopay translation keys in `lib/i18n/translations.ts`
- [ ] Env vars on Vercel (`NEXT_PUBLIC_HUB_URL`, `NEXT_PUBLIC_MERCHANT_HUB_URL`, `NEXT_PUBLIC_HIVE_ACCOUNT`, `NEXT_PUBLIC_RESTAURANT_ID`)

### CO page tasks

- [ ] API routes (`/api/transfers/sync-from-merchant-hub`, `/api/transfers/unfulfilled`, `/api/fulfill`, `/api/balance/euro`, `/api/check-mine`)
- [ ] Admin CO page (`app/admin/current_orders/page.tsx`)
- [ ] Merchant-hub polling + Redis stream consumption
- [ ] Order display with memo hydration
- [ ] Fulfill workflow
- [ ] Bell sounds for new orders

---

## Phase 6: Polish & Deploy (not started)

- **AI-powered image upload pipeline**:
  1. Admin uploads raw photo via admin UI
  2. Image stored in Vercel Blob (not `public/` — runtime uploads can't write to static assets on Vercel)
  3. Serverless function optimizes with `sharp` (800x600, 75% quality, like indiesmenu's `optimize-images.js`)
  4. Claude vision API identifies the dish/drink from image + DB name list — single call handles both recognition and fuzzy matching
  5. Admin confirms match ("Cheeseburger image matched to dish #33 — 95% confidence")
  6. Optimized Blob URL written to `image_url` column in DB
  - Requires: `@vercel/blob` package, Claude API key, admin upload form
- Animation (CSS or Framer Motion)
- Performance optimization
- Full Vercel production deployment
- QR code stickers printed and deployed

---

## Dev Server

- **Port 3002**: `npx next dev --turbopack -p 3002`

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| DB per environment | Yes (dev + prod) | Safe seed iteration, destructive schema changes, matches merchant-hub env separation |
| Prisma version | 7 | New project, `prisma.config.ts` pattern, `@prisma/adapter-pg` |
| Dishes vs drinks | Separate tables | Different structures (variants vs sizes/selections), proven in other spokes |
| Allergens | Direct on dishes | EU codes 1-14, no ingredient junction (simpler than indiesmenu) |
| State machine | useReducer (CB pattern) | NOT indiesmenu's scattered useState |
| Dish card UX | Tap-to-expand | Compact by default (screen density), photo on demand |
| Trilingual | FR, EN, LB | `_fr`, `_en`, `_lb` columns on all name/description fields |
| i18n approach | Context + `localized()` helper | No i18n library needed — DB already trilingual |
| Menu data fetching | React Query (client-side) | 5-min staleTime for dishes/drinks, 2-min for specials |
| Cart persistence | localStorage + cross-tab sync | 7-day expiry, versioned (v1), StorageEvent for sync |
| Menu navigation | Dishes/Drinks toggle + category scroll-spy | Top-level tab to switch, sub-categories with sticky tabs |
| Images | Next.js `<Image>` component | Lazy loading, responsive sizing, WebP negotiation |
| Animation | TBD | CSS-only vs Framer Motion, decide during UI build |
| Admin auth | Simple password + cookie | Fit for 2-3 person team, same as indiesmenu |
| Admin theme | Forced light mode | Back-office tool, avoids doubling theme work |
| shadcn variant | base-nova (Base UI) | Matches Next.js 16, but requires arrow-wrapped callbacks |
| Next.js proxy | `proxy.ts` (not `middleware.ts`) | Next.js 16 convention, renamed export |
