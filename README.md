# Bizim Event

Bilingual (Türkçe / English) marketplace for venues, caterers and performers for the Turkish-speaking community —
worldwide. Businesses pay a flat £6/month or £60/year after a 3-month free trial; no commission; customers pay nothing.

Built with Next.js 16, Neon Postgres (PostGIS), Drizzle, Better Auth, Stripe Billing, Cloudflare R2 and Vercel — all on
free tiers. See [CLAUDE.md](./CLAUDE.md) for the architecture, rules and phase checklist.

## Status

| Phase | Scope                                                          | State |
| ----- | -------------------------------------------------------------- | ----- |
| 0     | Scaffold, i18n, auth, adapters, CI, cron                       | ✅    |
| 1     | Full schema, migrations, DAL + guards + tests, seed data       | ✅    |
| 2     | Business onboarding wizard, listing editor, uploads, approvals | ✅    |
| 3–8   | Billing, discovery, bookings, trust, SEO, hardening            | ⏳    |

## Run it locally

Requires Node 20.9+, pnpm, and Postgres 16 with PostGIS (or a free Neon branch).

```bash
pnpm install
cp .env.example .env.local        # set DATABASE_URL and BETTER_AUTH_SECRET at minimum
pnpm db:migrate                   # extensions + full schema
pnpm db:seed                      # countries, taxonomies, demo data, admin user
pnpm dev                          # http://localhost:3000 → redirects to /tr or /en
```

Without provider keys the app still runs: emails are printed to the console and kept in `.dev-emails/outbox.jsonl`
(open the verification link from there), chat and SMS use stubs, address search uses OpenStreetMap (Photon) instead of
Google Places, and photo uploads are stored in `.dev-uploads/` instead of R2 (development only — production uploads
need R2).

## Test accounts

`pnpm db:seed` creates test data: 57 businesses (22 venues with 30 listings, 15 caterers, 20 performers) in London,
Birmingham, Manchester, Istanbul, Izmir, Berlin and Amsterdam, in every review and subscription state, plus customers,
enquiries, bookings and reviews. Every test account is on `@bizimevent.test`; the password is `BizimEvent!2026` on a
local database and `SEED_PASSWORD` anywhere else.

| Login                                         | What you'll find                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `admin@bizimevent.test`                       | the approval queue at `/tr/admin/approvals`                             |
| `venue1@` … `venue22@bizimevent.test`         | one venue business each (live, on trial, subscribed, pending or hidden) |
| `caterer1@` … `caterer15@bizimevent.test`     | one catering business each                                              |
| `performer1@` … `performer20@bizimevent.test` | one act each                                                            |
| `newbusiness@bizimevent.test`                 | a verified account with nothing set up — try "List your business"       |
| `customer1@` … `customer8@bizimevent.test`    | customers                                                               |

The seed prints which login is live, waiting for approval or hidden. `pnpm db:seed --reset` recreates the test data and
`pnpm db:seed --remove-demo` deletes it; both touch only `@bizimevent.test` accounts and what they own. Remove it before
launch: once search is live (Phase 4), approved test listings would be public.

## Tests

```bash
pnpm test        # unit + integration (integration needs TEST_DATABASE_URL, Postgres with PostGIS)
pnpm test:e2e    # Playwright, against `pnpm dev` and your local database (run pnpm db:seed first)
```

The end-to-end tests sign up a venue (Turkish), a caterer (English) and a performer (Turkish, phone-sized screen), check
that they can't log in before verifying their email, verify from the email, log out and back in, complete the set-up
wizard with photo uploads, have the admin approve them, then add, submit and approve a second listing. They also log
in with the seeded test accounts. GitHub runs them on every push (the E2E workflow).

## Deploy (Vercel + Neon)

1. Import the GitHub repo into Vercel (region `lhr1` is set in `vercel.json`).
2. Vercel → Storage / Marketplace → **Neon** (free plan) → connect to the project. Pick the London region
   (`aws-eu-west-2`) so the database sits next to the functions. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. Add `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` (your domain), and
   `CRON_SECRET`. Other keys are optional for now — see `.env.example`.
4. Photos: create an R2 bucket, allow public reads (r2.dev subdomain or a custom domain such as
   `media.bizimevent.co.uk`), create an S3 API token for that bucket, and set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and `R2_PUBLIC_URL`. Then run `pnpm r2:cors` once so browsers may upload
   straight to the bucket from your domain. Until R2 is set, uploads are switched off in production.
5. Email: verify your domain in Resend and set `RESEND_API_KEY` and `EMAIL_FROM`. Sign-up needs it — new accounts can't
   log in until they click the link in their verification email.
6. Set up the database. Easiest, from GitHub: add the repository secrets `DATABASE_URL_UNPOOLED` (Neon's direct
   connection string) and `SEED_PASSWORD` (12+ characters, only for test data), then Actions → **Database** → Run
   workflow → "set up (migrations and reference data)" or "set up and add test data". "check (change nothing)" shows
   what's there; "remove test data" deletes only the `@bizimevent.test` accounts. From your machine instead:
   `DATABASE_URL_UNPOOLED=… pnpm db:migrate`, then `DATABASE_URL_UNPOOLED=… pnpm db:seed --no-demo` (reference data
   only) or `SEED_PASSWORD=… DATABASE_URL_UNPOOLED=… pnpm db:seed` (with test data). Run the migrations again whenever
   a new one is added.
7. Deploy. The daily cron (`/api/cron/daily`) is registered from `vercel.json`.

> Vercel Hobby is for non-commercial use. Build and test on Hobby, then move to Pro before Bizim Event takes its first
> paid subscription.

## Scripts

`pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e` · `pnpm format` ·
`pnpm db:generate` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:status` · `pnpm db:studio` · `pnpm r2:cors`
