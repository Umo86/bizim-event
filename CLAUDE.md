# Bizim Event — project guide for Claude Code

@AGENTS.md

Bilingual (Turkish default / English) **worldwide marketplace** for the Turkish-speaking community, modelled on Tagvenue
but with three listing types: **venues, caterers, performers**. Customers search, compare, enquire, receive offers and
confirm bookings. Businesses list, manage enquiries/calendars and pay a flat subscription. Admins verify and moderate.

## Business model (do not drift from this)

- Businesses pay **£6/month or £60/year per business page**, billed in GBP via **Stripe Billing**. **90-day free trial
  that starts when an admin APPROVES the business** (not at sign-up), no card needed to start it.
- **No commission. Customers pay nothing to Bizim Event.** Deposits and balances go directly from customer to business;
  we only _record_ deposit/balance status. Show: "Payments are made directly to the business. Bizim Event does not handle
  booking payments." No Stripe Connect.
- Listings are public while the subscription is `trialing` (trial not ended), `active`, `comped`, or `past_due` inside a
  7-day grace period; `canceled` stays visible until `current_period_end`. Otherwise hidden — **never deleted**.

## Hard constraints

- **Free tiers only.** Vercel (Hobby while building — move to Pro before the first paid subscription; Hobby is
  non-commercial), **Neon Postgres** free plan, Cloudflare R2, Pusher sandbox, Upstash Redis, Resend. **No Supabase, no
  Firebase.**
- Neon free: 1 GB storage, 100 CU-hours/month, 5 GB egress, scale-to-zero. Over the limit = DB paused until next month.
  - Never store images/files/large blobs in Postgres — URLs/R2 keys only.
  - Cache public pages (`"use cache"` + `cacheTag`, revalidate on edits/approvals/reviews/subscription changes).
  - Never poll the DB on a timer from the browser (chat falls back to 15 s polling only while the tab is visible).
  - Paginate everything, select only needed columns, index every filter.
- Vercel Hobby cron = once a day → **one** job at `/api/cron/daily` (Bearer `CRON_SECRET`). Time-based states are also
  computed **lazily on read** (`src/server/rules.ts`) so a missed run never shows a wrong state.
- Vercel Image Optimization is **off** (`images.unoptimized`); images are resized to WebP in the browser (400/1200/2000px)
  and served from R2 with `srcset`.

## Stack

Next.js 16 (App Router, **Cache Components** on, `proxy.ts` not middleware — read `node_modules/next/dist/docs/` before
using an API you're unsure of) · TypeScript strict · Tailwind v4 (tokens in `src/app/globals.css`) · next-intl (locale via
`next/root-params`) · Drizzle ORM + drizzle-kit · Neon serverless driver (pooled) / node-postgres (local, CI, migrations)
· Better Auth (email+password with verification, magic link, Google, organization plugin) · Stripe Billing · R2 via AWS
SDK presigned PUTs · Pusher · Upstash Redis + ratelimit · Resend + React Email · MapLibre + OpenFreeMap · Google Places
(behind adapter) · Frankfurter FX · Zod · React Hook Form · Vitest · Playwright.

## Architecture

```
src/
  app/[locale]/…           pages (root layout lives here; locales tr | en, tr default, always prefixed)
  app/api/auth/[...all]    Better Auth handler (rate-limited)
  app/api/cron/daily       the one daily job
  proxy.ts                 next-intl locale routing + country cookie from x-vercel-ip-country
  i18n/                    routing, navigation, request config
  db/schema/*.ts           Drizzle schema (auth, geo, taxonomy, business, listings, engagement, platform)
  db/index.ts              getDb() — lazy; Neon Pool for *.neon.tech, else node-postgres
  server/dal/              DATA-ACCESS LAYER — the only place that queries the DB for app code
  server/dal/guards.ts     requireUser / requireAdmin / requireBusinessMember / requireBookingParty / requireEnquiryParty
  server/rules.ts          pure business rules (visibility, lazy expiry, business days, MRR) — unit tested
  server/internal/         trusted internals called only after authorisation (visibility refresh, daily job)
  lib/adapters/            email, storage, realtime, sms, geocode, fx, billing, redis, translate, turnstile
  emails/                  React Email templates (TR/EN via next-intl messages)
messages/tr.json, en.json  ALL UI strings — never hard-code user-facing text
drizzle/                   SQL migrations (0000 = extensions + immutable_unaccent + geo_point domain)
scripts/                   migrate, seed
tests/unit, tests/integration
```

### Rules for code changes

1. **Authorisation:** every DAL function takes a `DalContext` (`{ db, user }`) and calls a guard before touching data.
   Never import `@/db` from components, pages or route handlers — go through `src/server/dal`. Public queries return
   only `listings.is_public = true` and `reviews.status = 'published'`. Guards return `FORBIDDEN` for both "missing" and
   "not yours" so IDs can't be probed.
2. **`listings.is_public` is derived** — only `refreshBusinessVisibility()` writes it. Call it after any change to
   business status, listing status, or subscription.
3. **Bilingual content**: business-entered fields are `*_tr` / `*_en`; at least one required; show the other as a
   fallback with a "shown in Turkish/English" note (`pickLocalized`).
4. **Turkish text** sorts with `trCollator`, slugs with `slugify` (ı→i, ğ→g …), DB search uses `immutable_unaccent` +
   `pg_trgm`. Turkish runs ~25% longer than English — size buttons/cards for it.
5. **Money**: prices are always shown in the listing's own currency; `price_from_gbp` exists only for cross-currency
   sort/filter; "≈ £X" hints are labelled approximate.
6. **Time**: store `timestamptz`; show event times in the listing's IANA time zone.
7. **Accessibility**: brand turquoise `#0E9AA7` and coral `#FF6B5B` fail 4.5:1 behind white text, so text-on-colour uses
   `*-strong` tokens (`#0B7D87`, `#CC3F31`). Keep the brand hexes for fills/accents.
8. **Schema change** → edit `src/db/schema`, run `pnpm db:generate`, commit the SQL. CI fails if they drift.
   `geography(Point,4326)` is exposed as the `geo_point` domain because drizzle-kit quotes custom type names.
9. **Copy Tagvenue's layout patterns only** — never its logo, wording, colours or images.
10. **Raw SQL subqueries**: reference outer columns with `qualified(table, column)` from `@/db/sql`. Drizzle drops the
    table name in single-table selects, so `${listings.id}` inside `(select … from listing_media m …)` silently binds to
    `m.id`.
11. **Classes**: extra classes go through `buttonVariants({ …, className })` / `cn()` (tailwind-merge). Never
    concatenate class strings onto a variant — `inline-flex` vs `hidden` then depends on stylesheet order.
12. **Admin checks**: the session role comes from Better Auth's 5-minute cookie cache; `requireAdmin` re-reads the role
    from the database. Don't gate anything sensitive on `ctx.user.role` alone.
13. **Unanswered ≠ no**: optional facts a business hasn't answered are `null` (e.g. `venue_details.alcohol`), never a
    default that claims something.

### Onboarding & listings (Phase 2)

- Wizard: `/[locale]/business/[id]/setup/[step]` (info → location → currency → listing → photos → pricing → event-types
  → details → cancellation → review). Forms autosave per field (`useAutosave`, 1 s debounce); the server keeps the valid
  fields and reports invalid ones (`pickValidFields`), "Save and continue" validates the step strictly.
- Review flow: `draft → pending_review → approved | changes_requested | rejected`; approval starts the 90-day trial.
  Edits to approved listings stay live; a new listing on an approved business is reviewed on its own.
- Completeness (`src/lib/completeness.ts`) drives the progress bar and the submit gate (venues need 5 photos, others 3).
- Uploads: the browser resizes to WebP 400/1200/2000 (EXIF/GPS dropped) → presigned PUT to R2 (`pnpm r2:cors` once) →
  the server HEAD-checks and registers the media. Without R2, development uses `/api/dev-upload` (`.dev-uploads/`);
  production refuses uploads until R2 is configured.
- Addresses: Google Places (New) when `GOOGLE_PLACES_API_KEY` is set, otherwise Photon (OpenStreetMap); manual entry
  always works. Show the provider's attribution under suggestions. Cities are created on demand (deduped by place id,
  then country + English slug); currency and time zone are prefilled from the address.
- Testimonials on "List your business" come from `src/content/testimonials.ts` and stay hidden until there are real
  quotes — never invent them.

### Billing (Phase 3)

- Plans live in `src/lib/plans.ts` (£6/month, £60/year, GBP, Stripe lookup keys, trial/grace/reminder constants). The
  Stripe product, prices and Customer Portal configuration are created on first use (`ensurePrices`,
  `ensurePortalConfiguration`) — never hard-code Stripe ids.
- Provider (`src/lib/adapters/billing.ts`): `stripe` when `STRIPE_SECRET_KEY` is set; `dev` simulator in development and
  tests without keys (`/[locale]/dev/checkout`, `/[locale]/dev/billing-portal`, signed short-lived tokens, `notFound()`
  otherwise); `disabled` in production without keys (trials run, plans can't be bought). `dev_…` customer/subscription
  ids belong to the simulator only.
- `subscriptions.status` is ours (trialing | active | past_due | canceled | expired | comped); `stripe_status` is Stripe's
  raw status (`trialing` there = a paid plan that starts when the free trial ends). The UI reads `billingState()` from
  `src/server/rules.ts`; Stripe → ours in `mapStripeStatus`; the 7-day grace is set once by `nextGraceUntil`.
- Every change goes through `applySubscriptionSnapshot()` (`src/server/internal/billing.ts`): row lock, comped stays
  comped, a second live subscription for the same business is audited and ignored, then `refreshBusinessVisibility()`.
  Webhooks (`/api/stripe/webhook`): signature checked on the raw body, idempotent via `processed_webhooks` in the same
  transaction, the subscription re-read from Stripe (events arrive out of order), emails after the response.
  `/api/billing/return` syncs the finished checkout right away so the owner doesn't wait for the webhook.
- Emails come from before/after rows (`billingNoticeFor`), so replays never send twice. Checkout during the trial passes
  `trial_end` (only with >49 h left: Stripe needs 48 h) so nothing is charged before the trial ends.
- Daily job: settles expired trials and graces (emails), trial reminders 30/7/1 days before the end
  (`trial_reminders_sent` stores the days-left values), prunes `processed_webhooks` after 30 days.
- Admin billing (`/[locale]/admin/billing`): setup checklist, MRR and counts (test businesses excluded; yearly = £5/month),
  filters, extend trial (7/14/30/90 days), free access on/off — all audited.

### Content and legal pages

- About, How it works, Help and Contact copy lives in messages (`about`, `howItWorks`, `help`, `contact`). The legal
  documents (terms of use, business terms, privacy, cookies) live in `src/content/legal/*.ts` as bilingual structured
  text — links written `[label](/path)`, rendered by `RichText` — served at `/[locale]/legal/[doc]` and prerendered.
  Prices, trial and grace in them come from `src/lib/plans.ts`. The Turkish versions say the English one applies.
- Company details for those pages come from `src/content/company.ts` (null = left out) and the contact address from
  `CONTACT_EMAIL` (`src/server/contact.ts`). Never invent either.
- Keep the privacy policy's provider list in step with `src/lib/adapters`, and the cookie policy with the cookies the
  site sets (`src/i18n/routing.ts`, `src/proxy.ts`, Better Auth).
- Every link must lead somewhere: the page crawl (`tests/e2e/pages.spec.ts`) fails on a link that 404s.

### Cities on the homepage (interim, before Phase 4)

- Featured cities, their taglines and photos live in `src/content/cities.ts` (the seed reads the same list). Photos are
  free Unsplash License images hotlinked from `images.unsplash.com` (resized via URL params for `srcset`, see
  `src/lib/unsplash.ts`) and every photographer is credited under the grid. Never use Unsplash+ photos.
- The homepage grid orders cities for the visitor's country (cookie), so it renders inside `<Suspense>`; no database
  call is involved.
- Page banners use `<PhotoBackdrop>` (`src/components/cities/photo-backdrop.tsx`) with a key from `BACKDROPS` in
  `src/content/cities.ts` (homepage hero = London). Its overlays keep white text at 4.5:1 over any photo; put body
  text only where the tint is 85%+ (the left of a `left` overlay, anywhere on `even`, the bottom of `bottom`). Forms,
  the setup wizard and admin screens stay photo-free so they read quickly.
- Unknown URLs hit `[locale]/[...rest]` → `notFound()`, so they get the styled, localised 404.
- `/[locale]/search` is a "coming soon" page (noindex) so the header tabs, hero form and city tiles never 404. Phase 4
  replaces it with real search; keep its `type`, `country`, `city` and `place` parameters.

## Data model (summary)

Better Auth: `user` (+ role customer|business|admin, phone, preferred_locale, country_iso2, marketing opt-ins), `session`,
`account`, `verification`, `organization`, `member`, `invitation` · Geo: `countries` (all ISO 3166-1, TR/EN names &
slugs, default currency, km|mi, is_visible), `cities` (google_place_id unique, TR/EN, centre, timezone, listing_count,
images), `areas` · Taxonomy (bilingual): `event_types`, `venue_types`, `act_types`, `cuisines`, `service_styles`,
`languages`, `amenities`, `cancellation_policies` · Business: `businesses`, `subscription_plans`, `plan_prices`,
`subscriptions` · Listings: `listings` (generated `search_vector`), `listing_capacities`, `listing_prices`,
`listing_media`, `venue_details`, `caterer_details`, `performer_details`, `listing_amenities`, `listing_event_types`,
`availability_blocks`, `ical_feeds` · Engagement: `shortlists`, `event_plans`, `enquiries`, `messages`, `viewings`,
`offers`, `bookings`, `reviews` · Platform: `notifications`, `notification_preferences`, `reports`, `seo_pages`,
`blog_posts`, `help_articles`, `audit_log`, `processed_webhooks`, `listing_stats_daily`, `fx_rates`, `quick_replies`.

## Commands

```
pnpm dev | build | lint | typecheck | test
pnpm test:e2e        # Playwright: sign-up → wizard → approval, test logins, billing (re-seeds first; E2E_RESEED=0 skips)
pnpm db:generate     # SQL migration from schema changes
pnpm db:migrate      # apply migrations (uses DATABASE_URL_UNPOOLED)
pnpm db:seed         # reference data + test data (once); --reset recreates it, --remove-demo deletes it,
                     # --no-demo = reference data only
pnpm db:status       # read-only summary: migrations (applied of total), reference data, businesses, admins
pnpm db:make-admin   # <email> [--remove]: give a verified account admin rights (Database workflow option too)
pnpm r2:cors         # one-off: allow browser uploads to the R2 bucket from the app's origin
pnpm format          # Prettier (printWidth 120)
```

Integration tests need `TEST_DATABASE_URL` pointing at Postgres with PostGIS (CI uses `postgis/postgis:16-3.4`);
they are skipped when it's unset.

### Test data and end-to-end tests

- **Test data = every account on `@bizimevent.test`** (`.test` is reserved, so no real person can own one) and what it
  owns. `--reset` / `--remove-demo` delete exactly that, so they are safe on the live database. Logins say what they
  are: `venue1…22@`, `caterer1…15@`, `performer1…20@` (each owns one business), `admin@`, `customer1…8@`,
  `newbusiness@` (verified, nothing set up). The seed prints which one is live, pending or hidden, plus a paying, an
  overdue and a free venue. Seeded paid subscriptions use `dev_…` ids, so the billing simulator can manage them.
- Password `BizimEvent!2026` on a local database only; anywhere else the seed refuses without `SEED_PASSWORD` (12+), so
  the test admin never has a password that's in the repo. Test data must not reach real people: fictional phone ranges
  (Ofcom/BNetzA drama numbers) or none, `.example` emails, no social handles, slugs end in `-test`.
- **Remove the test data before launch** (`pnpm db:seed --remove-demo` or the Database workflow) — Phase 4 makes
  approved listings public.
- **Live database:** GitHub → Actions → **Database** workflow (manual): check / set up (migrations + reference data) /
  add, recreate or remove test data. Needs repo secrets `DATABASE_URL_UNPOOLED` and, for test data, `SEED_PASSWORD`.
- Without Resend, development writes every email to `.dev-emails/outbox.jsonl` (gitignored); e2e tests open verification
  links from there.
- E2E (`tests/e2e`; the `E2E` workflow runs them against `pnpm dev` + a Postgres service, skipping docs-only pushes):
  copy comes from `messages/*.json`; wrap CSS and text locators in `visible()` — Next keeps recently visited pages
  mounted but hidden, so their inputs (same ids) are still in the DOM; each browser context gets its own client IP for
  the auth rate limits (3 logins per IP in quick succession); `E2E_SCREENSHOTS=dir` saves a full-page screenshot per
  step. Specs that change seeded accounts (billing, business review) re-seed when Playwright retries them.
- `tests/e2e/pages.spec.ts` opens every page as a visitor, customer, owners in each state and the admin (EN desktop and
  TR phone; TR phone only on CI pushes, both on the weekly/manual run via `E2E_FULL_CRAWL=1`) and fails on "not found",
  browser errors, failed requests and sideways scrolling at phone width. Wide content goes in an `overflow-x-auto`
  box; fieldsets need `min-w-0` for that to work (`Group` sets it). Add new pages to its lists.
- Better Auth's instance is cached on `globalThis` in development: restart `pnpm dev` after changing `src/lib/auth.ts`.
- Better Auth rate limits: built-in rules (sign-in/sign-up 3 per 10 s per IP and path, else 30/min); `/get-session` is
  exempt (served from the cookie cache; limiting it made shared IPs look logged out). Upstash adds 10 auth POSTs/min
  per IP in production.

## Phase checklist (stop for review after each)

- [x] **Phase 0 — Scaffold:** Next.js 16, Tailwind tokens, next-intl tr/en + switcher, country cookie + IP default, Neon
      via Drizzle, Better Auth (sign up/in/out, magic link, Google, email verification), base layout, provider adapters,
      CLAUDE.md, .env.example, CI, vercel.json daily cron.
- [x] **Phase 1 — Data & geography:** full schema, migrations, extensions, indexes, DAL + guards + authorisation tests,
      all countries, lookup tables, seed script.
- [x] **Phase 2 — Business onboarding & listings:** "List your business" page, 10-step wizard for venues, caterers and
      performers (worldwide address, currency, time zone), Places/Photon address search, browser-resized R2 uploads,
      listing editor, admin approval queue with request-changes/reject, notification emails.
- [x] **Phase 3 — Subscriptions:** Stripe Checkout + Customer Portal (prices and portal created on first use), signed
      idempotent webhooks, local billing simulator, trial reminders, 7-day grace, owner billing page and overview banner,
      admin billing (MRR, extend trial, free access), Pricing page.
- [ ] Phase 4 — Discovery (homepage, PostGIS search + filters, FX hints, MapLibre, detail pages, shortlist, compare)
- [ ] Phase 5 — Enquiries, chat & bookings (event plans, Pusher chat, viewings, offers, requests, calendars, iCal)
- [ ] Phase 6 — Trust & comms (reviews, Star Business, response metrics, notifications, reports/disputes)
- [ ] Phase 7 — Growth & admin (SEO engine, sitemaps, JSON-LD, blog, help, back office, MRR, system usage)
- [ ] Phase 8 — Hardening (Playwright flows, a11y audit, Lighthouse ≥ 90, security review, full README)
