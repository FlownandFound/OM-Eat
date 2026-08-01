# OM-Eat

Ops Manual E(at). A small reference site where BA Euroflyer crew at London
Gatwick record what to eat at each destination during a turnaround. A curated
guide fed by a submission queue — not a feed, not a social network.

Everything is public to read. Anyone can submit a new Find (one specific
thing to eat, at one specific place, at one destination — optionally with
photos) or a correction; nothing appears on the site until one of the two
curators publishes it from `/admin`. Crew can one-tap **Confirm** a Find to
signal its information is still correct.

See [CLAUDE.md](CLAUDE.md) for the full project rules (glossary, trust
model, free-tier constraints, and what is permanently out of scope).

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript, Tailwind), deployed
  on Vercel Hobby
- [Supabase](https://supabase.com) free tier: Postgres, Auth (curators
  only), Storage for Find photos
- No paid APIs, no maps API, no analytics beyond Vercel defaults

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will need the
environment variables below in `.env.local`. Before pushing, the two checks
to pass are `npm run build` and `npm run lint`.

## Environment variables

Required in the Vercel project (and `.env.local` for local development):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server only, never exposed to the client
- `CRON_SECRET` — required; authorises the daily `/api/cron/keepalive`
  Vercel cron that keeps the Supabase free-tier project from pausing

## Layout

| Path | What lives there |
|---|---|
| `app/` | Pages. Server components except the forms and the Confirm button. |
| `app/api/` | The three public write paths: submissions, confirms, keepalive cron. |
| `app/admin/` | Curator queue and Find editor. Unlinked and auth-walled. |
| `lib/supabase/` | One client per trust level — see below. |
| `lib/countries.ts` | Flag and currency symbol per destination country. |
| `proxy.ts` | Auth gate for `/admin` (this Next.js version's middleware file). |
| `supabase/migrations/` | The only place schema changes are allowed. |

Four Supabase clients, deliberately separate: `public.ts` (anon key, public
reads), `server.ts` (service role, public write routes only), `auth.ts`
(cookie-backed curator session, all `/admin` writes), `browser.ts` (curator
sign-in and sign-out).

## Database and storage

- Schema lives in `supabase/migrations/` and is applied with
  `supabase db push`. Never change schema outside a migration — including
  adding a destination, which is an idempotent seed migration.
- A destination in a country not yet on the network also needs a row in
  `lib/countries.ts`, or its prices render without a currency symbol.
- Photos live in the Supabase Storage bucket **`Find-images`** (capital F —
  the bucket was created with this name and the code targets it via
  `FIND_IMAGES_BUCKET` in `lib/images.ts`). Public read, 1 MB per object;
  the client compresses images before upload.

## Admin

`/admin` is unlinked from the public site and auth-walled. The two curator
accounts are created manually in Supabase; public sign-up is disabled. The
queue is at `/admin`, published Finds are managed at `/admin/finds`.

## Deployment

Pushing to `main` deploys to production via Vercel. Database migrations are
applied separately with `supabase db push`.
