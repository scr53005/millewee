# Millewee — Project Status

**Last updated**: 2026-05-10

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

> **Lesson learned — always create TWO local dev databases from day one:**
> - `{spoke}` — the regular dev DB (e.g. `millewee`)
> - `{spoke}_shadow` — the Prisma shadow DB (e.g. `millewee_shadow`)
>
> Both owned by the local `Sorin` user, both pointed at by `.env.local`:
> ```
> POSTGRES_URL="postgresql://Sorin@localhost:5432/{spoke}?schema=public"
> SHADOW_DATABASE_URL="postgresql://Sorin@localhost:5432/{spoke}_shadow?schema=public"
> ```
> `prisma.config.ts` must read both (`datasource.url` + `datasource.shadowDatabaseUrl`). The shadow DB is dev-only — no `SHADOW_DATABASE_URL` is ever set on Vercel.
>
> **Use `prisma migrate dev` from the very first schema change — avoid `prisma db push`.** `db push` creates no migration history, and transitioning later requires a manual baseline (`migrate diff --from-empty --to-schema ... --script > 0_init/migration.sql` + `migrate resolve --applied 0_init`) AND is prone to encoding corruption on PowerShell (`>` defaults to UTF-16 LE and captures dotenv stdout — the resulting file silently breaks shadow DB replay with misleading "Can't reach database server" errors). Baselining is fine as a one-off rescue, but starting clean with `migrate dev` is strictly simpler.
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
- [x] **Landing menu split** — Hero page retained, but choices are now URL-driven: `?menu=weekly` shows weekly specials plus drinks/cart/call-waiter, `?menu=permanent` shows the former Variant B permanent menu
- [x] **Landing i18n + language persistence** — hero copy is trilingual FR/EN/LB, flag buttons persist `millewee_lang` in localStorage and restore on next visit
- [x] **Dev-only localStorage reset** — `DevClearStorageButton` added for private/dev hosts; clears Innopay/cart/flow test state while preserving table, menu, and language
- [x] **Floating cart placement** — cart button no longer occupies the MiniWallet corner; it anchors near the categories area and composes with `Draggable`, with persisted position
- [x] **PWA shell** — manifest, service worker, offline page, install icons, service-worker headers, and registration component added; production build verified
- [x] **PWA `color-scheme` declaration** (2026-05-10) — `app/layout.tsx` viewport now exports `colorScheme: "light dark"`, opting out of Chrome / Samsung Internet auto-dark force-darken when the customer flips the in-app toggle to light while the OS is in dark mode. Also fixed the apple-touch-icon casing (`logo2-512x512.PNG` → `.png`) after the `public/` rename.
- [x] **Logo dark-mode compatibility** (2026-05-10) — replaced the runtime `dark:brightness-0 dark:invert` CSS hack with two pre-baked PNG variants. `scripts/generate-logo-variants.py` (Pillow) reads `logo_millewee_transp.png` and emits `_light.png` (walnut `#1a1310` for light bg) and `_dark.png` (cream `#f5f0e8` for dark bg). MenuHeader and the hero render both `<Image>`s with `dark:hidden` / `hidden dark:block` — exactly one shows at a time, no filter passes. Future polychrome variants drop in without code change.
- [x] **DishCard expanded view reflow** (2026-05-10) — when expanded, the header collapses to one row (name + badges + price right-aligned via `ml-auto`), bottom padding tightens (`pb-3` → `pb-1.5`), allergens (inline mode) move into the expanded body. Image/video container switches from a fixed `h-32` to `aspect-[4/3]`, matching the optimizer's 800x600 max output and roughly doubling the image area on a phone.
- [x] **Pilot dish video** (2026-05-10, dish #33 cheeseburger) — Vercel Blob (`millewee-media`) hosts the MP4, `lib/dish-videos.ts` carries a hand-curated `dish_id → blob URL` map (DB column to follow once the pilot validates). Rendered in the expanded DishCard via `<video autoplay muted loop playsInline>` with the still image as `poster`. Tap-to-unmute speaker overlay (Lucide `Volume2` / `VolumeX`) — required because mobile browsers block autoplay-with-sound.

### Known issues / TODO

- [ ] Scroll-spy threshold values may need fine-tuning on different screen sizes
- [ ] No dish/drink images in DB yet — admin UI has `image_url` field but no upload mechanism (Phase 6)
- [x] ~~Order button is disabled — payment integration is Phase 4~~ — payment wired in Phase 4
- [x] ~~A/B allergen testing: decide which variant wins, then promote it to `page.tsx` and remove the other~~ — Variant B is the permanent menu; Variant A remains historical/reference code
- [x] ~~Not yet deployed to production (ready to deploy)~~ — deployed to prod

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

## Phase 4+5: Payment Integration + CO Page — DEPLOYED, TESTING PARTIAL

Phases 4 and 5 merged — payment and CO page share the `transfers` table and merchant-hub integration; the CO page validates the end-to-end "table to kitchen" flow.

**Reference**: Followed `SPOKE-DOCUMENTATION.md` (Next.js + Prisma spoke path). Backend patterns copied from indiesmenu, state-machine style from croque-bedaine.

> **Testing status (2026-05-07)**: Deployed to prod/dev and partially exercised. Verified end-to-end: **Flow 3** (guest checkout), **Flow 5** (account creation + pay), **Flow 6** (external wallet → HBD sweep), **Flow 7** (wallet topup from Stripe / existing-wallet return), **Flow 8** (import existing account). Still to exercise: Flow 4 (Stripe topup without order); call-waiter; duplicate-order modal; per-order mute.
> Verified working on the CO page: 30s per-order reminder, merchant-hub wake-up, fulfill workflow, late-threshold amber card, and automatic thermal printing implementation.

### Key decisions (April 2026)

- **Hive accounts**: PROD = `millewee`, DEV = `innodemo`
- **Merchant-hub registration**: added in `merchant-hub/lib/config.ts`. Env vars `MILLEWEE_ACCOUNT` / `MILLEWEE_DEV_ACCOUNT` on the (prod-only) merchant-hub Vercel project
- **i18n**: Full trilingual (FR/EN/LB) for all innopay UI strings
- **Call waiter**: Yes, same as indiesmenu/croque-bedaine, red pulsing card on CO page
- **Delayed ordering**: NOT in MVP, but `CartItem` is extensible for `delayedTiming` when needed

### Payment integration — implemented

- [x] Merchant-hub registration (`merchant-hub/lib/config.ts` + env vars on Vercel)
- [x] `transfers` model in Prisma schema + migration
- [x] Environment config (`lib/environment.ts` — `isPrivateNetwork()`, `EnvironmentConfig`)
- [x] Innopay utility files (`lib/innopay/utils.ts`, `hive.ts`, `config.ts`)
- [x] Payment state machine (`state/innopay/paymentStateMachine.ts`)
- [x] Payment hooks (`hooks/innopay/usePaymentFlow.ts`, `useInnopayCart.ts`, `useBalance.ts`)
- [x] UI components (`MiniWallet.tsx`, `BottomBanner.tsx`, `WalletNotificationBanner.tsx`, `ImportAccountModal.tsx`, `WalletReopenButton.tsx`)
- [x] `InnopayChrome.tsx` — host for MiniWallet + WalletReopenButton + BottomBanner, wired into customer layout
- [x] All payment flows wired (Flow 3 guest, Flow 5 account+pay, Flow 6 wallet, Flow 7 topup, Flow 8 import) — **Flows 3, 5, 6, 7, 8 tested; Flow 4 still to exercise**
- [x] Flow 5 to Flow 7 existing-wallet return path — hub can return a credential token after using an existing wallet during create-account-and-pay; Millewee imports the wallet via `PaymentReturnHost`
- [x] Guardrails (L1 account link, L2 pulsing, L3 dedup modal) — implemented, **dedup modal not yet exercised**
- [x] Flow 6 cooldown (12s post-payment) — implemented, **confirmed via Flow 6 prod test**
- [x] Cart integration — CartSheet order button wired to `usePaymentFlow`
- [x] Global payment return host — `PaymentReturnHost` mounted in customer layout handles Stripe/hub return params, credential import, cart clear, pulse start, and banners even when returning to the hero page
- [x] Trilingual innopay translation keys in `lib/i18n/translations.ts`
- [x] Env vars on Vercel
- [x] `allowedDevOrigins` in `next.config.ts` for LAN phone testing

### CO page — implemented

- [x] API routes (`/api/transfers/sync-from-merchant-hub`, `/api/transfers/unfulfilled`, `/api/fulfill`, `/api/balance/euro`, `/api/check-mine`)
- [x] Admin CO page (`app/admin/current_orders/page.tsx`)
- [x] Merchant-hub polling + Redis stream consumption (per-env consumer groups `sync-dev` / `sync-prod`)
- [x] Order display with memo hydration (dishes / drinks split, per-item comments, per-item variants)
- [x] Distriate-identifier grouping (EURO + HBD legs on one card)
- [x] Call-waiter red pulsing card, never grouped — **not yet tested**
- [x] Late threshold (10 min → amber card) — verified in prod
- [x] Fulfill workflow (group-aware, acknowledges all transfer IDs) — verified in prod
- [x] Bell sound on new arrival (`bell.mp3`) — verified in prod
- [x] Per-order reminder every 30s — verified in prod
- [x] Per-order card mute button with global-sound gating (group-atomic toggle) — implemented, **not yet tested**
- [x] Sound-enable confirmation ring — verified in prod (via bell.mp3 fix)
- [x] Merchant-hub wake-up call on page mount — verified in prod; since upgraded to full single-poller election (2026-04-19)
- [x] CO memo hydration reliability fix — polling now uses the latest menu lookup, so newly arrived codified orders hydrate to DB dish/drink names without requiring a manual refresh
- [x] CO hydration warnings — visible warning if the CO page cannot load menu data, or if an order memo references a dish/drink ID that is missing from the DB lookup
- [x] Automatic thermal printing — lifted/adapted from indiesmenu: hidden iframe print queue, auto-print for new non-waiter orders, retry after menu hydration, separate CUISINE/BAR tickets, manual print button, and group-level print key to avoid duplicate prints

### Remaining

- [x] ~~**BUG: Call-waiter fails on the Flow-6-like path**~~ — resolved 2026-05-09. Root cause: client-side `dhive` was failing in mobile browsers. Fix: route the call-waiter `custom_json` operation through the hub's `/api/sign-and-broadcast` endpoint, the same path Flow 6 Leg 1 already uses. `executeWaiterCall` no longer imports `dhive`, no longer reads the active key from localStorage for client-side signing. Verified end-to-end in dev with the local wallet path. SPOKE-DOCUMENTATION.md updated with the canonical pattern; indies and croque-bedaine flagged for future retrofit. `signAndBroadcastOperation` left as a documented unused fallback in `lib/innopay/utils.ts`.
- [x] ~~**BUG: Flow 3 success banner does not appear on return** from Stripe checkout~~ — resolved
- [x] ~~Exercise Flows 5 and 7 end-to-end~~ — tested successfully
- [x] ~~Implement automatic thermal printer output on CO page~~ — implemented via indiesmenu lift-and-shift/adaptation
- [x] ~~Merchant-hub dashboard card for Millewee~~ — done
- [x] ~~(carryover) Flow 6 EURO transfer memo missing order data~~ — fixed across all three spokes (2026-04-19)
- [x] ~~(carryover) Flow 6 stale balance — needs fresh blockchain fetch + 10s cooldown between consecutive Flow 6 orders~~ — 12s cooldown + fresh balance fetch in place, verified via Flow 6 prod test

### Prioritized backlog

_(Empty — all prior items completed; new ones land here as they're identified.)_

> Admin/operational backlog (opening-hours model, accounting, etc.) is tracked in the [Admin dashboard](#admin-dashboard) section below.

### Remaining tests

- [ ] Exercise Flow 4 end-to-end (Stripe topup without order)
- [ ] Test call-waiter, dedup modal, and per-order mute
- [ ] Test thermal printer output on the real kitchen printer

---

## Admin dashboard

Cross-cutting admin tooling under `/admin/*`. Reuses Phase 2's auth (`proxy.ts`), `AdminHeader`, and the dashboard card grid. Items below were previously tracked as "Prioritized backlog" inside Phase 4+5 and have been promoted to their own section as the surface grew.

### Completed

- [x] **Opening-hours page + dashboard entry** (2026-05-07)
  - Dashboard card added for `/admin/opening-hours`.
  - "Horaires" / "Services" tab controls replaced with conservative native buttons using explicit colors and no Base UI/Tabs styling — avoids invisible tab controls on older tablet browsers.
  - 3-table data model (`services`, `standard_week`, `current_schedule`) per `~/.claude/plans/synthetic-doodling-star.md` iter 1a.

- [x] **History page** (2026-05-07)
  - Added `/admin/history` page and `/api/orders/history`.
  - Added dashboard card and direct access button/link from the CO page.
  - Uses fulfilled orders, hydrated memos, day grouping, load-more paging, and kitchen-friendly navigation.

- [x] **Restaurant vs kitchen hours model — Phase A: data model + admin UI** (2026-05-09)
  - Distinction between restaurant-wide hours (drinks, bar) and kitchen-only hours (dishes, delayed slots) modelled via a `scope` column on `services` (`'restaurant' | 'kitchen'`). Plan: `~/.claude/plans/crackling-simmering-saucepan.md` (companion to `synthetic-doodling-star.md`).
  - **Schema + API**:
    - Migration `add_service_scope`: `ALTER TABLE services ADD COLUMN scope TEXT NOT NULL DEFAULT 'restaurant'`. Existing rows default to `'restaurant'`.
    - Zod `servicesSchema` accepts `scope` (defaults to `'restaurant'`).
    - `/api/admin/services` POST/PATCH validate `scope` (PATCH with explicit allowlist check).
    - `/api/admin/standard-week` GET surfaces `scope` per row.
    - `regenerate()` denormalises `scope` into each `current_schedule.resolved` entry, exposed by `/api/current-schedule`.
  - **Admin UI** (`/admin/opening-hours`):
    - Scope radio (Restaurant / Cuisine) in the service create/edit dialog.
    - Colour-coded badge next to each service name in the Services tab list (amber `Restaurant`, green `Cuisine`).
    - Horaires grid grouped by scope with section headers (Restaurant section / Cuisine section).
    - Soft warning banner above the grid when a kitchen interval falls outside the union of restaurant intervals on a given day. Non-blocking — save still works.
  - **Seed**:
    - `seedOpeningHours()` now creates three services: Ouverture (restaurant, Mon–Sun 10:00–23:59), Déjeuner (kitchen, Mon–Sat 11:45–14:00, Sun closed), Dîner (kitchen, Mon–Sat 18:00–22:00, Sun closed). Destructive — wipes and reseeds, idempotency not needed.

- [x] **Restaurant vs kitchen hours — Phase B: customer-side gate (interim block)** (2026-05-09)
  - Module-level `current_schedule` cache + React Query loader (`<CurrentScheduleLoader />`) mounted in the customer layout root, populated inside the queryFn so synchronous helpers see fresh values on the first render after data arrives.
  - Synchronous helpers in `hooks/use-current-schedule.ts`: `isRestaurantOpen`, `isKitchenOpen`, `getKitchenCloseTime`, `getNextKitchenOpening`, `getNextOpenDay`, `getValidTimeSlots(requireKitchen)`, plus a convenience `useScheduleStatus()` that subscribes + returns derived booleans. Dev bypass on `localhost` / `127.0.0.1` / `192.168.*` (mirrors indies/CB pattern).
  - UX wiring (interim — not the indies/CB delayed-order experience yet):
    - `ScheduleClosedBanner` rendered above the menu in both `MenuPageB` and `WeeklyMenuPage`. Red banner when restaurant closed, amber banner when kitchen closed but restaurant open.
    - DishCard quick-add (+) and expanded "Ajouter" buttons disabled + tooltip when kitchen is closed.
    - Weekly-special add buttons disabled + label switches to "Cuisine fermée" when kitchen is closed.
    - CartSheet `handleOrder` gated: blocks submission with toast when restaurant closed, refuses dish-containing carts with toast when kitchen closed (drinks-only carts still allowed). Order button disabled accordingly.
  - Trilingual i18n keys added: `schedule.restaurantClosed`, `schedule.kitchenClosed`, `schedule.reopensAt`, `schedule.reopensOn`.

- [x] **Tips for waiters — Step 1: front-end** (2026-05-10)
  - **CartSheet tip panel** — toggle button between "Total" and "Commandez!" + bell line. Expanded panel shows three preset percentage buttons (10% / 15% / 20%), a "Choisissez un montant" custom input (Decimal 10,2), and an "Ajouter le pourboire" submit. Hybrid behaviour: presets apply immediately, custom input requires submit.
  - **Cart state** — `lib/cart/types.ts` `CartState` extended with `tip: number`; reducer extended with `SET_TIP`; auto-clamps `tip` to ≤ subtotal × 0.5 on every items-changing action so a later subtotal drop doesn't leave a runaway tip. localStorage version bumped (v1 → v2). `totalPrice` is now `subtotal + tip`; `subtotal` exposed separately for breakdown display.
  - **UX guardrails** — soft warning above 30% of subtotal, hard cap at 50% (anti-laundering). Once a tip is applied the panel collapses; toggle label becomes "Pourboire 2.50 € (modifier)" and reopens the panel for editing. Breakdown lines (Sous-total / Pourboire / Total) only render when `tip > 0`.
  - **Memo** — `T:X.XX` segment added to the codified memo via `useInnopayCart.getMemo()` when `tip > 0`. Position adjacent to the items section, before ` TABLE N`. Backwards-compatible: older non-tipped orders just don't carry the segment.
  - **"Vider le panier"** commented out (not deleted) to save vertical line; per-item trash buttons cover the case.
  - **Trilingual i18n keys** added: `tip.button`, `tip.modifyButton` (with `{amount}` placeholder), `tip.subtotal`, `tip.label`, `tip.pickAmount`, `tip.add`, `tip.percent` (with `{n}` placeholder), `tip.softWarning`, `tip.hardCapNote`.
  - **Verified end-to-end** — tips render on CO page order cards (small "+ pourboire X.XX €" chip) and on the thermal printer ticket. The printer rendering is currently more than the minimum required ("a bit much") — to be tightened during step-2 back-end work.

### Remaining

- [ ] **Tips for waiters — Step 2: back-end / admin** *(top priority; step 1 front-end completed 2026-05-10, see Admin dashboard > Completed)*
  - Distribution to a shared waiter+kitchen "tirelire" account. Add a `tip_eur` column to the `transfers` table (parsed from memo at hydration) so the future accounting page can sum tips separately.
  - **Printer rendering tightening** — the front-end pass left tips visible on the thermal printer ticket; that's "a bit much" and should be tightened during this back-end pass (e.g., footer-only line, or hide on the kitchen ticket and keep on the bar/receipt ticket).
  - Discussion logged 2026-05-09, decisions pending — see below.

    **Architecture decision: split at innopay (recommended) vs split at restaurant.**
    - *A. Split at innopay* — innopay receives one transfer of the grand total (e.g., 14.00€) from the customer, then issues two outgoing transfers: order leg → `millewee` (12.50€), tip leg → `millewee-tips` (1.50€). Cleanest separation of funds; tip never sits in the restaurant operator's account; on-chain audit trail via `millewee-tips` history.
    - *B. Split at restaurant* — innopay sends the full 14.00€ to `millewee`; a subsequent op moves 1.50€ from `millewee` to `millewee-tips`. Requires `innopay` to hold active-key authority on `millewee` (heavy ceremony, real trust surface). **Rejected** unless option A proves operationally infeasible.
    - *C. Memo-only* (no on-chain split, restaurant honor system) — rejected by user.

    **Atomicity within option A.** Hive transactions support multiple ops. Practical recipe:
    - If both legs fit in HBD: **one Hive transaction with 2 native `transfer` ops**, atomic on-chain.
    - If both legs fall back to EURO: **one Hive transaction with 2 `custom_json` ops** (atomic on Hive base layer; Hive-Engine sidechain settles each shortly after — failure rare since innopay knows its own balances).
    - Mixed (one leg HBD, one leg EURO): two separate transactions. The base+sidechain async settlement makes mixed-op single-tx atomicity inconsistent across leg types.

    **HBD/EURO allocation when innopay is short on HBD.**
    - *Order leg gets HBD first*, tip leg gets the leftovers / EURO fallback. Simpler bookkeeping (one debtor at a time); HBD interest matters more on operating revenue than on lumpy tips. Proportional split (89%/11%) is possible but adds complexity for marginal benefit.
    - Tip-leg EURO fallback recorded in the existing `outstanding_debt` table with `to_account: millewee-tips`. Liman's settlement job iterates over rows by account, so the new account just shows up — no schema change.

    **Memo formats.**
    - Customer → innopay: `<dishes> T:1.50 TABLE 5 kcs-inno-abc-1234` (already implemented in `useInnopayCart.getMemo()`).
    - innopay → millewee (order leg): same shape, **keep the `T:1.50` segment** so the millewee CO page can render a "+ pourboire 1.50 €" chip on the order card. Restaurant operator sees that the patron tipped, even though the money went elsewhere.
    - innopay → millewee-tips (tip leg): `tip 1.50 for-table 5 ref:abc-1234 kcs-inno-abc-1234`. The `ref:abc-1234` reuses the order's distriate-id so the two legs are linkable; `for-table N` lets a future tirelire-distribution dashboard route the tip to the actual waiter assigned to the table.

    **Tip ledger (millewee-tips reporting).** Three options, increasing fidelity:
    - *(1) No app-side ledger.* `millewee-tips` is a passive Hive account; balance and history read directly from Hive RPC. Manager checks via Hive Keychain or a small "Tirelire" admin page. Start here.
    - *(2) Mirror in DB.* Register `millewee-tips` in merchant-hub, get a `tips` table populated by HAF polling. Same machinery as `millewee`, different account. Enables SQL aggregation on the accounting page.
    - *(3) Single transfers table, source-tagged.* Add a `category` column on the existing `transfers` table; merchant-hub routes both accounts. Cleaner long-term, a touch more work.

    **Setup checklist** (before any code):
    1. Create the `millewee-tips` Hive account. **Open question 1**: who custodies the active key on day 1? Best guess: innopay holds it (matches Flow-7 trust model, lowest friction); restaurant requests payouts via a future UI.
    2. Add `MILLEWEE_TIPS_ACCOUNT` env var to merchant-hub and innopay (and possibly the spoke if we want to display "Pourboire envoyé à @millewee-tips" anywhere).
    3. Update innopay's webhook handler (Flow 6/7 paths in `handleTopup` and Flow 6 leg-2 logic): parse `T:X.XX` from the customer memo, compute `orderEur = totalEur - tipEur`, issue the two outgoing legs per the recipe above, track tip-debt separately when the EURO fallback fires.
    4. Optionally register `millewee-tips` in merchant-hub now (HAF starts collecting from day 1, even if no UI yet) — supports option (2) tip ledger when the accounting page is built.

    **Open questions to resolve before implementing:**
    - Q1: who holds the active key for `millewee-tips` initially (innopay vs restaurant owner vs co-custody)?
    - Q2: HBD/EURO allocation — confirm order-first priority over proportional split.
    - Q3: tip leg memo format — accept the proposal above or refine?
    - Q4: register `millewee-tips` in merchant-hub now or defer until accounting page work?
    - Q5: keep `T:1.50` on the order leg's outgoing memo (CO chip) or strip it (cleaner separation)?

- [ ] **Delayed orders — full UX port from indies / croque-bedaine**
  - Replace the interim block (above) with the indies/CB pattern: when kitchen is closed (or the customer wants to schedule), open a `DelayedOrderPanel` with a time picker that only emits kitchen-open slots from `getValidTimeSlots(requireKitchen=true)`. Drinks remain in the broader restaurant-hours window.
  - **Scope**:
    - `TimeWheelPicker.tsx` (CB-style scrolling HH/MM wheel) — clock face / pickerm; CB has the canonical version. `clock.png` already present in `public/images/` for the visual.
    - `DelayedOrderPanel.tsx` (date + time picker + service window indicator).
    - `CartItem.delayedTiming?: DelayedTiming` field — already extensible per current `lib/cart/types.ts`.
    - Memo encoding `P@<datetime>` (pickup) / `T@<datetime>` (table-served) plumbed through `useInnopayCart.getMemo()`.
    - CartSheet UX: detect mixed cart (some delayed, some immediate) and warn; block "Commander" until all dishes have a target time when kitchen is closed.
    - CO page: two-column / sidebar split (live queue left, delayed list right), with delayed orders promoting to live as their time approaches. Lift the indies/CB layout.
    - Banners updated: "Cuisine fermée. Commande programmée pour 18:00."
  - Once landed in millewee, the same surface ports cleanly to indies (iter 1b) and croque (iter 1c) since they already have most of the components.

- [ ] **Accounting / reporting page**
  - Lift/adapt `admin/reporting` from indiesmenu; compare croque-bedaine first because it should be close.
  - Add dashboard card and required API/support code.
  - Preserve HBD/EUR export behavior (date range, totals, CSV/PDF).

- [ ] **Accounting / reporting page**
  - Lift/adapt `admin/reporting` from indiesmenu; compare croque-bedaine first because it should be close.
  - Add dashboard card and required API/support code.
  - Preserve HBD/EUR export behavior (date range, totals, CSV/PDF).

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

## Phase 7: Documentation — Extract "spoke.md" skill (not started)

Complement the existing high-level `SPOKE-DOCUMENTATION.md` (reference manual: what exists, how it works, why) with a practical step-by-step runbook distilled from the Millewee build sequence (Phases 1–5 above).

### Rationale

Millewee was the first spoke built entirely from SPOKE-DOCUMENTATION.md. The experience surfaced the *order* in which things need to happen (scaffold → data model → admin CRUD → customer menu → payment integration → CO page) and the landmines at each step (Prisma 7 adapter, Base UI callback signatures, Next.js 16 `proxy.ts` rename, Stripe webhook path, dead env vars, distriate suffix). SPOKE-DOCUMENTATION.md does not enforce that order — a fresh implementer could start in the wrong place.

### Scope

- Ordered phase checklist (Phase 1 scaffold → Phase 7 docs), each phase as a collapsible section
- For each phase: inputs needed, files to copy (with source spoke), files to build fresh, common landmines
- Cross-links back into SPOKE-DOCUMENTATION.md for the "why" — do not re-explain concepts that already live there
- Kept tight: runbooks rot faster than reference docs, so the goal is "what to do next" not "what everything means"

### Tradeoff

Two documents means two places to update. Mitigation: spoke.md links into SPOKE-DOCUMENTATION.md rather than duplicating content — it stays short (a checklist, not a manual) and only the step order + landmine list are maintained there.

### Deliverable

One new file at project root (or in a `docs/` folder alongside SPOKE-DOCUMENTATION.md). Format: a Claude Code skill if invocable via `/spoke`, otherwise a plain markdown runbook.

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
