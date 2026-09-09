# WhatsNearYou — setup

A map-first discovery site for Hyderabad's Ganesh pandals. Built on the
HydCafeMap architecture (see `HANDOFF.md`), with a time dimension added:
every place has an active period, and past seasons are archived rather
than deleted.

Run these in order. Steps 1–3 need you; step 4 onward is just `npm run dev`.

---

## 1. Create the Supabase project

Dashboard → **New project**.

| Field | Value |
|---|---|
| Name | `whats-near-you` |
| Region | Southeast Asia (Singapore) |
| Database password | anything — save it in your password manager |

Wait for it to finish provisioning (about two minutes).

## 2. Put the keys in `.env.local`

**Project Settings → API** gives you three values. Copy
`.env.local.example` to `.env.local` and fill them in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

The anon key ships in every browser that loads the site — that is normal
and safe, because every table's row-level security assumes it is public.
The service-role key bypasses RLS entirely; it stays server-side, and the
missing `NEXT_PUBLIC_` prefix is what keeps Next.js from bundling it into
client JavaScript.

## 3. Run the migrations

Supabase Dashboard → **SQL Editor** → New query. Paste and run each file
in `supabase/migrations/` **in order**:

```
0001_admins.sql        admin identity, is_admin(), password recovery
0002_places.sql        the pandals themselves, with the time dimension
0003_events.sql        city news (the ticker and the News panel)
0004_advertising.sql   billboards + the /advertise enquiry inbox
0005_search_logs.sql   what people search for, including zero-result queries
```

Every file is idempotent (`if not exists`, `drop policy if exists`), so
re-running one is safe if you lose your place.

**Then verify it actually applied**, rather than trusting that it did:

```
npm run verify:db
```

This checks the schema with the service role, then probes row-level
security from outside with the **anon key** — the key that ships in every
browser that loads the site, so what it can do is what anyone can do.

Two things about reading its output:

- A line marked `????` means the check could not prove anything, almost
  always because the table it targets is empty. An empty table returns no
  rows to a SELECT whether the policy refused it or there was simply
  nothing there. That is reported honestly rather than as a pass.
- INSERT probes assert on the **error code** (`42501` is the policy
  refusing; `23502`/`23514` would mean it reached a constraint, i.e. RLS
  had already let it through). UPDATE and DELETE probes assert on
  **effect** instead, by re-reading the data afterwards. They have to: a
  `USING` clause acts as a row filter, so a correct policy leaves the
  statement matching zero rows — and a statement matching zero rows
  succeeds. "No error" is the expected result of a good policy there, and
  checking the error alone would flag every correctly-locked table as a
  hole.

Re-run it after any migration, and after seeding.

## 4. Create your admin account

```
node --env-file=.env.local scripts/create-admin.mjs owner@whatsnearyou.admin "a-long-password"
```

The ID only has to be email-shaped — nothing is ever emailed to it. There
is deliberately no self-signup path into the `admins` table.

Optional, and worth doing once: set a recovery code so a forgotten
password does not lock you out of your own console.

```
node --env-file=.env.local scripts/set-admin-recovery.mjs owner@whatsnearyou.admin
```

## 5. Load the 15 pandals

Two steps on purpose — the first is offline and reviewable, the second
touches the database.

```
npm run parse:sheet     # CSV -> scripts/seed-pandals.json, with a report
npm run seed            # dry run, prints what it would do
npm run seed:write      # actually inserts
```

`parse-sheet.mjs` writes `scripts/seed-pandals.json` and prints a report
of everything it changed or refused. Read it. The current run reports:

- **15 kept**, 5 skipped for having no coordinates (`Warasiguda Big Ganesh
  Mandap` plus the four coverage-count rows at the bottom of the sheet).
- **2 coordinates converted from DMS** — Ashok Yuvajana Sangam and YMCA
  Ganesha were stored as `17°26'02.7"N`, which `parseFloat` would have
  read as `17`, i.e. the Arabian Sea.
- **2 area names look misspelled in the sheet** — "Subash Road" and
  "Jubliee Bus Stand (JBS)". Kept verbatim: silently correcting a proper
  noun during an import is how a dataset and its source stop agreeing.
  Fix them in the spreadsheet and re-run.
- **Ramnagar Ka Raja and Trishul Youth Association are 2 m apart**, so
  their pins overlap until one of the coordinates is corrected.

Re-running is safe: the seed matches on `(name, season)` and updates
rather than inserting a second copy.

## 6. Run it

```
npm run dev
```

- `/` — the public map
- `/admin` — the same map with the operator tools, behind sign-in
- `/advertise` — the public enquiry form

## 7. Deploy

Vercel → **Add New → Project** → import `shashankmukkala/whats-near-you`.
Framework, build command and output directory are all detected; nothing to
change there.

Add four environment variables **before the first deploy**, each for
Production, Preview and Development:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | same as `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | same as `.env.local` |
| `NEXT_PUBLIC_SITE_URL` | the deployment's own URL — see below |

`NEXT_PUBLIC_SITE_URL` is a chicken-and-egg: you do not know the URL until
after the first deploy. Deploy once, copy the domain Vercel assigns, set
the variable, then redeploy. Skipping it is not cosmetic — it is
`metadataBase`, so every link preview would advertise an `og:image` at the
deployment's own localhost and forwards would unfurl with no image.

`vercel.json` pins functions to **`sin1` (Singapore)**, the same region as
the Supabase project. Each page load makes three database round trips
(`/api/places`, `/api/events`, `/api/billboards`), so those dominate the
latency — putting the functions next to the database beats putting them
next to the user. If you ever move the database, move this too.

The build itself needs no environment variables (the Supabase client is
created lazily), so a misconfigured deploy will build fine and then serve
an empty map rather than failing loudly. After deploying, check
`https://<your-domain>/api/places` returns 15 rows.

---

## The season

`lib/season.ts` holds the current window, confirmed as 14–25 September
2026 for every pandal in the sheet:

```ts
export const CURRENT_SEASON = "ganesh-2026";
export const SEASON_STARTS_AT = "2026-09-14T00:00:00+05:30";
export const SEASON_ENDS_AT   = "2026-09-25T23:59:59+05:30";
```

Per-pandal overrides live on the row — the admin form edits `starts_at`
and `ends_at` directly, because immersion dates genuinely differ between
pandals in most years.

The map's default view is **not archived, and not already finished**, not
the stricter "on right now". Today is before the 14th, so a strict
live-only default would open on an empty map during exactly the fortnight
when people are planning. "Live now" is a toggle in the top bar instead.

**Next year**: archive this season's rows (the card's admin panel has an
Archive button, or `update places set archived_at = now() where season =
'ganesh-2026'`), bump `CURRENT_SEASON`, and seed new rows. Nothing is
deleted — how long a pandal has been running is exactly the kind of thing
only you would know.

## Things deliberately not built

Reviews, star ratings, GPS check-ins, visit tracking, points, leaderboard,
rewards, bookmarks and collections are all absent by decision, not
oversight — a pandal is not scored out of five. With nothing to sign in
*for*, there is also no public sign-in: the only session in the app is the
admin one, which is why there is no `profiles` table and no user-privacy
surface to get wrong.

## Before every commit

```
npx tsc --noEmit
npx eslint .
npm run build
```

All three, every time.
