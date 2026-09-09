# WhatsNearYou

A map-first discovery site for Hyderabad's Ganesh pandals. Full-screen dark
map, curated pandals, and a live "what's on right now" signal for a festival
that lasts about ten days a year.

**Setup and operations live in [SETUP.md](SETUP.md).** Architecture and the
reasoning inherited from the project this was built on are in
[HANDOFF.md](HANDOFF.md).

---

## The one thing that makes this different

Most place-discovery products assume their places are permanent. A cafe
exists until it closes. **A pandal exists for about ten days a year**, and
everything else follows from that:

- Every place carries `starts_at` / `ends_at`, from the first migration —
  not bolted on later.
- The map's default view is "not archived, and not finished yet", *not*
  "on right now". A strict live-only default shows an empty map during
  exactly the fortnight when people are planning.
- Recurrence is **new rows per season**, so "this pandal has run for six
  years" stays answerable. Last year's rows are archived, never deleted.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
MapLibre GL 6 · three.js · Supabase (Postgres + Auth + RLS) · Vercel

No ORM and no migration CLI — raw `@supabase/supabase-js` and hand-written
SQL run in order.

## Layout

```
app/            routes; / is the map, /admin is the same map with tools
components/     MapExperience.tsx is the orchestrator — deliberately flat
lib/            season.ts (the time dimension), vocabulary.ts, searchMatch.ts
supabase/       numbered SQL migrations, RLS correct from 0001
scripts/        import, seeding, admin creation, database verification
```

## Commands

```
npm run dev          the map at http://localhost:3000
npm run verify:db    schema check, then RLS probed from outside with the anon key
npm run parse:sheet  research CSV -> scripts/seed-pandals.json, with a report
npm run seed         dry run
npm run seed:write   insert
```

Before every commit: `npx tsc --noEmit`, `npx eslint .`, `npm run build`.
All three, every time.

## Two conventions worth keeping

**Verify against the live database, not the migration files.** They drift.
`npm run verify:db` probes row-level security from outside using the anon
key — the key that ships in every browser — because that is the only
position that tells you what a visitor can actually do. It reports
`????` rather than a pass when a check cannot prove anything, which is
usually an empty table.

**Write down the reason, and name the bug.** The comments here are dense
and almost always explain *why*, often naming the specific failure that
motivated the line. That style is the most valuable thing inherited from
the previous project. When you fix something subtle, write down what broke.

## Not built, on purpose

Reviews, star ratings, GPS check-ins, visit tracking, points, leaderboards,
rewards, bookmarks, collections. A pandal is not scored out of five. With
nothing left to sign in *for*, there is no public sign-in either — the only
session in the app is the admin one.
