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

Without provider keys the app still runs: emails are printed to the console (open the verification link from the
terminal), chat and SMS use stubs, address search uses OpenStreetMap (Photon) instead of Google Places, and photo
uploads are stored in `.dev-uploads/` instead of R2 (development only — production uploads need R2).

Seeded logins (password `BizimEvent!2026` — change before any shared deployment):

- `admin@bizimevent.test` — admin
- `owner1@bizimevent.test` … — business owners
- `customer1@bizimevent.test` … — customers

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
5. Run migrations and the seed against Neon from your machine:
   `DATABASE_URL_UNPOOLED=… pnpm db:migrate && DATABASE_URL=… pnpm db:seed`
6. Deploy. The daily cron (`/api/cron/daily`) is registered from `vercel.json`.

> Vercel Hobby is for non-commercial use. Build and test on Hobby, then move to Pro before Bizim Event takes its first
> paid subscription.

## Scripts

`pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm format` · `pnpm db:generate` ·
`pnpm db:migrate` · `pnpm db:seed` · `pnpm db:studio` · `pnpm r2:cors`
