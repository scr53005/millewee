# Millewee — Project Status

**Last updated**: 2026-03-17
**Plan file**: `C:\Users\Sorin\.claude\plans\floofy-stirring-pascal.md`

---

## Phase 1: Scaffold + Data Model

### DONE

- [x] **Next.js 15 scaffold** — App Router, TypeScript, Tailwind CSS v4, Turbopack
- [x] **shadcn/ui init** — `components.json` configured (base-nova style, Radix, Lucide icons)
- [x] **shadcn button component** added (`components/ui/button.tsx`)
- [x] **Brand identity CSS** — `app/globals.css` with full light+dark palettes
  - Light: cream bg `#faf6f0`, dark leather text `#2a1f17`, amber primary `#d4a24e`
  - Dark: dark leather bg `#1a1310`, cream text `#f5f0e8`, khaki-green `#7a8a4e`
  - Custom tokens: `--mw-green`, `--mw-sunflower`, `--mw-leather`, `--mw-stone`, `--mw-amber`
- [x] **Fonts** — Playfair Display (display) + DM Sans (body) via `next/font/google` in `app/layout.tsx`
- [x] **ThemeProvider** — `app/providers/ThemeProvider.tsx` wrapping `next-themes`
- [x] **ThemeToggle** — `components/ThemeToggle.tsx` (sun/moon, mounted guard)
- [x] **Root layout** — `app/layout.tsx` with fonts, ThemeProvider (defaultTheme="dark", enableSystem)
- [x] **Landing page** — `app/page.tsx` with logo, green wall strip, tagline, sample buttons, color swatches
  - Logo: `/images/logo_millewee_transp.png` (w-48 h-48, dark:brightness-0 dark:invert)
  - Green wall: `/images/green-wall-1.PNG` (decorative strip under logo, -mt-2, opacity-85)
  - Logo+strip group pinned near top with `mt-6`
- [x] **`.gitignore`** — added `/public/images-raw/` and `/public/dishes-raw/`
- [x] **Prisma 7 setup**
  - `prisma.config.ts` — loads `.env.local` then `.env` (via `dotenv`), reads `POSTGRES_URL`
  - `prisma/schema.prisma` — all 18 models, validates successfully
  - `lib/prisma.ts` — singleton with `@prisma/adapter-pg`, dev-mode globalThis caching
  - Dependencies: `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`
- [x] **Local dev database** — PostgreSQL `millewee` owned by `Sorin`, `POSTGRES_URL` in `.env.local`
- [x] **`prisma db push`** — all 18 tables synced to local DB
- [x] **`prisma generate`** — client generated (v7.5.0)
- [x] **`.env.local` created** — `POSTGRES_URL`, Hive accounts (`millewee` PROD / `innodemo` DEV), restaurant ID `millewee`
- [x] **Scripts directory** — `scripts/` with `qrcodes/` subfolder
  - `scripts/qrcodes/milleweeuri.txt` — `http://millewee.innopay.lu/?table=`
  - `scripts/qrcodes/milleweetables.csv` — 44 tables (1-47, missing 8/14/16)
- [x] **Seed script** — `scripts/seed.ts` (run via `npx tsx scripts/seed.ts`), parses:
  - `public/dishes-raw/Millewee dishes.csv` (comma-delimited, UTF-8) → categories, dishes, dish_variants, allergens, dish_allergens
  - `public/dishes-raw/millewee boissons.csv` (semicolon-delimited, Latin-1) → categories, drinks, drink_sizes, drink_selections
  - EU allergen reference data (codes 1-14, trilingual FR/EN/LB)
  - Restaurant tables from `scripts/qrcodes/milleweetables.csv` (21-47 = terrasse, rest = intérieur)
- [x] **Seed executed** — 14 allergens, 8 dish categories, 52 dishes (7 variants, 260 allergen links), 11 drink categories, 45 drinks (43 sizes, 35 selections), 44 tables
- [x] **Category translations** — all 19 categories (8 dish + 11 drink) have FR/EN/LB names, hardcoded in seed script
- [x] **Translation script** — `scripts/translate-table.ts` (reusable, Claude API via Haiku 4.5)
  - Takes any table name as input, auto-detects `_fr/_en/_lb` column groups
  - Translates missing languages from whichever has data
  - Supports `--dry-run`, batches in chunks of 25, logs token usage
  - Requires `ANTHROPIC_API_KEY` in `.env.local`
- [x] **Translations executed** — dish (79 translations), drink (54), dish_variant (7), drink_selection (35). Total cost: ~$0.04
- [x] **Seed script: sequence resets** — `ALTER SEQUENCE ... RESTART WITH 1` on all auto-increment tables, so IDs always start at 1 on re-seed
- [x] **GitHub repo** — `scr53005/millewee` (private), first commit pushed
- [x] **Vercel project** — imported from GitHub, build script fixed (`prisma generate && next build`)
- [x] **Favicon** — custom favicon.ico from logo (via GIMP)
- [x] **shadcn components added** — badge, card, dialog, dropdown-menu, input, label, scroll-area, select, sheet, sonner, table, tabs

- [x] **Vercel Prisma PostgreSQL** — prod DB created, connection strings auto-set by Vercel (preview+prod only, not dev). Hive account + restaurant ID env vars also set. Build succeeds.
- [x] **Data copy script** — `scripts/copy-data.ts` copies all seeded data from dev → prod DB (reads `POSTGRES_URL_DEV` + `POSTGRES_URL_PROD`)
- [x] **QR code generation script** — `scripts/qrcodes/generateqrs.py` (segno + Pillow + python-docx)
  - Branded stickers: Millewee logo, "Table: X", QR with Innopay logo overlay, "Scan to order!" bubble, URL
  - Sitka Small font, Millewee amber/cream color scheme, 5cm × 5.25cm stickers
  - DOCX output: 5×3 landscape grid (15 per page), 44 tables = 3 pages
  - Run: `python generateqrs.py` (or `--t` for test mode with 4 tables)
- [x] **Fruits rouges fix** — CSV parsing quirk corrected in both dev and prod databases

### Phase 1 complete.

### Data files location

Raw menu data in `public/dishes-raw/` (gitignored):
- `Millewee dishes.csv` — 52 dishes across 8 categories
- `millewee boissons.csv` — 45 drinks across 11 categories (Latin-1 encoded, semicolon-delimited)
- `Millewee dishes.xlsx`, `millewee boissons.xlsx` — original Excel files (xlsx not used by seed, avoided due to npm vulnerabilities)

---

## Phase 2: Admin Menu Management (not started)

- [ ] Admin login + middleware auth (`middleware.ts`, `app/api/admin/auth/route.ts`)
- [ ] Dish management page (`app/admin/menu/page.tsx`) — CRUD, prices, images, availability, variants
- [ ] Drink management page (`app/admin/drinks/page.tsx`) — CRUD, sizes+prices, selections, images per size
- [ ] Category management (`app/admin/categories/page.tsx`)
- [ ] Allergen assignment view (`app/admin/allergens/page.tsx`)
- [ ] Weekly specials CRUD (`app/admin/specials/page.tsx`)

---

## Phase 3–6: Not started

See plan file for full details on:
- Phase 3: Customer menu & cart (tap-to-expand dish cards, drink size/selection pickers, CartSheet, i18n FR/EN/LB)
- Phase 4: Payment integration (port CB state machine, MiniWallet, all flows, guardrails)
- Phase 5: Admin CO page (merchant-hub registration, Redis streams, fulfill)
- Phase 6: Polish & deploy

---

## Dev Server

- **Port 3003**: `npx next dev --turbopack -p 3003`
- Node warning: `eslint-visitor-keys@5.0.1` wants Node `^22.13.0` — current is `v22.12.0`. Non-breaking, upgrade when convenient.

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
| Animation | TBD | CSS-only vs Framer Motion, decide during UI build |
