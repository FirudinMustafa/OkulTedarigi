# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server (Next.js)
- `npm run build` — `prisma generate && next build`
- `npm run start` — start production server
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- `npm run db:push` — push Prisma schema to DB without a migration
- `npm run db:migrate` — `prisma migrate dev`
- `npm run db:seed` — run `prisma/seed.ts`
- `npm run db:studio` — open Prisma Studio
- `npm run db:reset` — **destructive**: `prisma db push --force-reset && prisma db seed`
- `npm run docker:up` / `docker:down` / `docker:logs` — local MySQL via docker-compose
- `npm run setup` / `start:full` — `scripts/setup.js` then `next dev`

No automated test suite exists (no jest/vitest/playwright, no `test` script). QA is done via ad-hoc Node/bash scripts at the repo root and in `scripts/` (e.g. `qa-tests.mjs`, `ui-test.mjs`, `prod-test.mjs`, `scripts/test-payment-flow.js`, `scripts/test-kolaybi.ts`), run directly with `node`/`bash` — treat these as manual verification aids, not CI.

## Architecture

Next.js 16 (App Router) + React 19 + TypeScript (strict), Prisma 6 / MySQL. Path alias `@/*` → `./src/*`.

**i18n**: `next-intl`, four locales (TR default, EN, DE, AR with RTL). Pages live under `src/app/[locale]/...`; API routes under `src/app/api/...` are **not** locale-prefixed. Message catalogs in `messages/{tr,en,de,ar}.json`. Config in `src/i18n/{routing,navigation,request}.ts`. Most user-facing Prisma text fields carry `_en`/`_de`/`_ar` suffix columns for translations — the base (unsuffixed) column is Turkish.

**Roles / panels** (three distinct surfaces, custom auth — no NextAuth):
- **admin** — `src/app/[locale]/admin`, `src/app/api/admin` — manages schools, orders, payments, invoicing.
- **mudur** (school director) — `src/app/[locale]/mudur`, `src/app/api/mudur` — per-school view, scoped by `schoolId`.
- **veli** (parent, public) — root-level flow: `paket` (package selection) → `siparis` (order) → `odeme` (checkout) → `siparis-onay` / `siparis-takip` (confirmation/tracking), plus `kvkk` and `mesafeli-satis` legal pages.

Auth is a hand-rolled JWT scheme in `src/lib/auth.ts`: `jose` (HS256), `bcryptjs` (cost 12) for password hashing, cookie-based sessions via `next/headers`. JWT payload carries `type: 'admin' | 'mudur'` and `schoolId` for mudur sessions. Route protection/locale handling is in `src/middleware.ts`. Production refuses to boot with a missing/default `JWT_SECRET`.

**Data model** (`prisma/schema.prisma`, MySQL) centers on `Order`:
`School` → `Class` → `Package`/`PackageItem` → `Order` → `OrderStudent`/`OrderItem` (item/student snapshot at order time). `Order` itself embeds payment, e-fatura/KolayBi, and cargo tracking fields directly (not separate join tables). Supporting models: `CancelRequest` (cancellation/refund workflow), `SchoolPayment` (payouts to schools), `DeliveryDocument` (bulk delivery documents), `Discount` (coupon codes), `Setting` (DB-backed key/value config), `SystemLog`/`RateLimitLog`, `Admin`. Key enum: `OrderStatus` progresses `NEW → PAYMENT_PENDING → PAID → CONFIRMED → INVOICED → SHIPPED → DELIVERED → COMPLETED` (plus `CANCELLED`/`REFUNDED`/`UNDELIVERED`).

**External integrations** — each has a `USE_MOCK_*` env flag so local dev can run without real credentials. `next.config.ts`'s CSP header is the authoritative list of which external domains are actually wired up; trust it over docs when they disagree.

- **PayNKolay** (`src/lib/paynkolay.ts`) — hosted 3D Secure payment page, current/live payment provider. `src/lib/iyzico.ts` is a legacy/superseded integration still present in the tree — don't use it for new work, and don't trust README.md's "Entegrasyonlar" section, which still describes the old Iyzico setup.
- **Yurtiçi Kargo** (`src/lib/yurtici-kargo.ts`, `src/lib/shipping-label.ts`) — SOAP shipping integration, live in prod. `ARAS_*` env vars are legacy/unused (README also incorrectly documents Aras Kargo as current).
- **KolayBi** (`src/lib/kolaybi.ts`, `src/lib/auto-invoice.ts`) — e-fatura/invoicing, live in prod.

**Other `src/lib/` utilities worth knowing about**: rate limiting, security helpers, logger, PDF/Excel export (jspdf, pdfkit, exceljs), email (Resend), SMS (Twilio), Gemini-powered chatbot (`@google/generative-ai`).

`docs/` contains a prior audit trail (system overview, findings, fixes, test reports across several audit phases) — consult it for historical context on past security/QA work rather than re-deriving it from scratch.
