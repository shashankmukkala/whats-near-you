# HANDOFF — building WhatsNearYou from the HydCafeMap architecture

Written for a Claude Code session starting the **WhatsNearYou** project.
The reference implementation is `C:\CafeMap\hyd-cafe-map` (a Hyderabad cafe
discovery map with a verified-review system and an advertising product).
Nothing in this document modifies that project — read it, don't edit it.

**WhatsNearYou is a multi-occasion map**: Ganesh pandals, and other
time-bound happenings around a city. That difference from cafes is not
cosmetic and it is the single most important thing on this page — see
[The one architectural change you must make](#the-one-architectural-change-you-must-make)
before copying anything.

---

## 1. What this project got right, and why

Read this section before deciding what to copy. Most of the value in
HydCafeMap is not the code — it is a set of decisions that were arrived at
by getting them wrong first. The commit history and the inline comments
record the failures. Preserve the *reasoning*, and the code follows.

The reference repo comments are unusually dense and almost always explain
**why**, often naming the specific bug that motivated the line. That style
is worth continuing. When you fix something subtle, write down what broke.

---

## 2. Stack

```
Next.js 16.3.3 (App Router)   React 19.2.8      TypeScript 5
Tailwind v4                    shadcn / @base-ui/react
MapLibre GL 6.6                three.js 0.185 (custom map layers)
Supabase (Postgres + Auth + RLS)
```

Deployed on Vercel. No Redis, no queue, no ORM — raw `@supabase/supabase-js`
and hand-written SQL migrations.

**Environment** (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, never NEXT_PUBLIC_
```

The service-role key is required by ~13 route files. Missing it does not
fail the build — `createServiceRoleClient()` throws at request time, so the
app compiles and then half the API 500s. Check for it early.

---

## 3. Architecture

### The shell

`app/page.tsx` renders `<MapExperience isAdmin={false} />`.
`app/admin/page.tsx` renders the same component inside `<AdminGate>` with
`isAdmin`. **One component, two modes.** This was a good decision: the admin
tools sit beside the public map rather than in a separate app, so anything
an operator places is immediately visible in the same view a visitor sees.

`MapExperience.tsx` is the orchestrator (~900 lines). It owns:

- data fetching for every map entity
- all filter state (category, tags, rating, distance) and search state
- which panel is open, and the rule that only one may be open on mobile
- camera control (fly-to, fit-bounds, and the padding that keeps a selected
  pin out from under the open panel)

It is large but deliberately flat. Resist splitting it into contexts —
almost every piece of state here is read by two or three siblings, and the
prop threading is what makes the data flow legible.

### Map-first layout

The public map canvas is `position: absolute; inset: 0` — it **fills the
viewport**, and every panel floats above it. This is why camera padding
matters (§8) and why the ad rail and the panel column collide if you are
not careful (they resolve to the same bottom offset).

```
┌──────────────────────────────────────┐
│  TopBar (search · filters · account) │  floating, rounded
│  LiveTicker                          │
│                                 ┌──┐ │
│            MAP FILLS ALL        │N │ │  vertical edge tab
│                                 │E │ │
│                                 │W │ │
│                                 │S │ │
│                  ┌─────────────────┐ │
│                  │  panel column   │ │  right column ≥1024px,
│  ┌────────────┐  │  (cards stack)  │ │  bottom sheet below
│  │  ad rail   │  └─────────────────┘ │
│  └────────────┘                      │
└──────────────────────────────────────┘
```

---

## 4. Design system — carry this over wholesale

Documented in the reference `README.md` under "Design System", implemented
in `app/globals.css`.

| Token | Hex | Meaning — **enforce this** |
|---|---|---|
| Ink | `#0B0D0E` | page / map foundation |
| Sea glass | `#19302C` | glass navigation surfaces |
| Electric mint | `#79E2B2` | **trust**, primary action, verified state |
| Soft mint | `#B9FFE3` | light accent |
| Coral | `#FF6B6B` | **live signals**, urgency, "happening now" |
| Saffron | `#FF9F1C` | **advertising only** |

**The palette rule is the most valuable thing here, and it was violated
repeatedly.** Amber/saffron leaked into tags, editorial blocks, links and
saved-states across the cafe card, which meant the *advertising* colour was
doing product work while mint — the trust colour — went unused on the one
surface whose entire premise was trust. It took a deliberate pass to undo.

For WhatsNearYou, coral becomes far more load-bearing: a pandal that is
*live right now* is the core signal of the product. Consider making coral
the primary accent and mint the secondary, but keep the one-colour-one-
meaning discipline.

### Glass panels

`.panel-elevated` — translucent dark fill plus `backdrop-filter`. Used by
every floating surface. **Reduce the blur under `@media (pointer: coarse)`**
(the reference drops 28px → 12px and removes `saturate`). Each blurred
surface re-samples everything behind it every frame and this app stacks
them over a live WebGL map; on a mid-range phone that is the difference
between smooth and not.

### Typography

Plus Jakarta Sans throughout. Dark-only — applied server-side in
`app/layout.tsx` via a `dark` class on `<html>`, so there is no
flash-of-light-theme and no theme toggle to keep in sync. Keep this.

**Minimum sizes** (learned the hard way): meta text 12px, action labels
13px, chips 11px. The original card used 10–11px throughout and was a
squint at arm's length on a phone.

---

## 5. Components — what to take

### Take as-is (domain-neutral)

| File | What it does |
|---|---|
| `lib/useMediaQuery.ts` | `useSyncExternalStore`-based, SSR-safe. `MOBILE_QUERY = "(max-width: 1023px)"` |
| `lib/useSwipeToDismiss.ts` | Bottom-sheet drag. Writes `transform` directly to the DOM, never through React state |
| `lib/rateLimit.ts` | In-memory fixed-window limiter with an opportunistic sweep |
| `lib/adminAuth.ts` | `requireAdmin(request)` — token → user → `is_admin()` RPC |
| `lib/adminFetch.ts` | Attaches the admin session token, read at call time |
| `lib/geo.ts` | Haversine + `VISIT_RADIUS_METERS` |
| `lib/useLocationCheckin.ts` | The GPS check-in state machine |
| `lib/recoveryCode.ts` | scrypt + `timingSafeEqual` admin recovery |
| `lib/avatars.ts` | Preset emoji/gradient avatars |
| `components/PanelShell.tsx` | Panel chrome with a close button |
| `components/AdminGate.tsx` | Admin sign-in + `is_admin()` check |
| `components/Map.tsx` | MapLibre init, dark restyle, POI filtering |
| `lib/darkenMapStyle.ts` | Generic style inversion |
| `lib/mapStyle.ts` | Camera constants, building ramp, road overrides |
| `components/ui/*` | shadcn primitives |

### Take and rename (structure is right, naming is cafe-specific)

| From | To (suggested) | Notes |
|---|---|---|
| `CafeMarkers.tsx` | `PlaceMarkers.tsx` | Marker pooling, add/remove diffing, selected state |
| `DetailCard.tsx` | `PlaceCard.tsx` | See §6 for what to strip |
| `SearchResultsPanel.tsx` | keep name | Paginated result list with a shrink-to-fit page size |
| `FeedPanel.tsx` | keep name | Generic list panel |
| `lib/searchMatch.ts` | keep name | Fuzzy matcher — **read §9 before touching** |

### Do not take

`WeatherWidget`, `AirQualityWidget` (already removed from the top bar —
two network calls per page load to report what the phone's status bar
already says), `ModelLayer` (a fully built three.js `.glb` loader with an
empty placement registry — impressive and unused), `EditCafeTaxonomy`,
`lib/categories.ts`, `lib/tags.ts`, and the three `local*Store.ts` dev
fallbacks unless you want the no-Supabase dev mode.

---

## 6. What is cafe-specific — do NOT carry over

**Data model**

- `cost_for_two`, `hours_text`, `maps_url`, `website_or_instagram`
- The four-value category taxonomy in `lib/categories.ts`
  (`Cafe`, `Specialty Coffee`, `Dessert & Bakery`, `Bistro & Kitchen`)
- The 19 tags in `lib/tags.ts` (`Outdoor Seating`, `Specialty Coffee`, …)
- `reviews.favorite_food` — "what would you order again" is a cafe question

**Concepts**

- **Reviews and star ratings.** A pandal is not rated out of five. Its
  equivalents are "I visited", photos, and crowd/queue reports.
- **Bookmarks / Collections** as built ("save cafes to a list") — a
  time-bound occasion wants "remind me" more than "save forever".
- The `cafes.rating` internal Google-sourced field and the strict rule that
  it must never be displayed. That rule was correct *there*; you have no
  such imported rating.

**Copy**

Every string mentioning cafes, coffee, "spots", "places to work". The
onboarding banner's "Reviews here are verified" promise is cafe-framed.

**Two taxonomy lessons worth inheriting even though the taxonomies aren't**

1. `lib/categories.ts` and `lib/tags.ts` are **hardcoded lists that must
   match the data exactly**. When the dataset was replaced, 0 of 85 rows
   matched `CATEGORY_OPTIONS` and every filter chip silently returned an
   empty map. Nothing warned. **Add a `CHECK` constraint on the category
   column from day one** (migration `0036` does this retroactively) so a
   bad import fails loudly instead of emptying a filter.
2. Generate the tag vocabulary *from* the data, not from imagination.

---

## 7. Database patterns

### Migration conventions

Plain `.sql` files, run by hand in the Supabase SQL editor, numbered
`NNNN_description.sql`. No CLI, no checksum table.

**Rules learned painfully:**

- **Every migration must be idempotent** — `if not exists`,
  `drop policy if exists` before `create policy`.
- **Never drop a column expecting a later migration to recreate it.**
  `0016` dropped `ad_type` assuming `0017` would re-add it; `0017` shipped
  empty. `0021` then referenced a column that did not exist, so a clean
  `0001 → 0021` replay failed at the last step. Nobody noticed because the
  live database had been patched by hand.
- **Find constraints by inspecting `pg_constraint`**, never by assuming
  Postgres's auto-generated name. The reference does this in `0025`, `0026`,
  `0029`, `0031`, `0033` — copy the pattern.
- **Verify migrations actually applied.** `0009` was never run against the
  live database for months. The symptom was invisible until probed:
  `reviews.user_id` did not exist, so review posting was broken *and* the
  table was still world-writable.

### RLS philosophy

Reads are public where the content is public. Writes are never public.

```
public read   cafes, events, billboards            (the map itself)
owner-scoped  bookmarks, collections, visited_cafes, points_ledger,
              notifications, profiles, review_checkins
admin-only    ad_enquiries (select/update), cafes/events/billboards (write)
no policy     visit_log, points_config, welcome_bonus_config,
              admin_recovery   → service-role routes only
```

**Test RLS from outside, with the anon key.** The reference's probe:

```
42501  → the policy refused it            (good)
23502 / 23514 → it reached a column constraint, meaning RLS let it
                through   (bad — you have a hole)
```

An empty table returns `[]` either way, so a passing probe on an empty
table proves nothing. Be honest about that in your own checks.

**The two holes worth knowing about**, because they are easy to repeat:

1. `cafes`, `events`, `billboards` carried `with check (true)` from the
   pre-auth MVP for months. Anyone with the anon key — which ships in every
   browser — could publish a billboard, delete events, or add places. Fixed
   in `0037`. **Do not write a permissive policy "for now".**
2. `points_ledger` had an insert policy checking *ownership* but not
   *value*, so a signed-in user could award themselves any number of
   points. Fixed in `0029` by removing client insert entirely: every award
   now comes from a security-definer trigger tied to a verified action, or
   from a service-role admin route.

### Service role vs authed client

- `supabase` — anon, for public reads
- `createAuthedClient(token)` — forwards the caller's JWT so RLS evaluates
  as that user. **Use this in admin routes**, so route authorization and
  database policy agree rather than drifting apart.
- `createServiceRoleClient()` — bypasses RLS. Only for cross-user
  aggregates (leaderboard, analytics) and writes to no-policy tables.

### Privacy pattern worth copying exactly

Do not publish a user's UUID in any public payload. In the reference, the
leaderboard returned `userId` and reviews were readable straight from
PostgREST carrying the same `userId` — joining the two named the author of
every review and listed everywhere they had been. Shortening display names
did not help, because the UUID was the identifier.

The fix (`0039`, `0040`): drop the public read policy on the sensitive
table, serve it through an API route that returns only what the public may
see, and replace `userId` with a server-computed `isMe` boolean.

**For WhatsNearYou this matters more, not less** — a pandal check-in is a
religious-observance record. Treat it as sensitive from the first commit.

---

## 8. Map implementation

- **Tiles**: OpenFreeMap `liberty` style (free, no API key), restyled dark
  at runtime by `lib/darkenMapStyle.ts` — a generic inversion, then
  hand-tuned overrides for buildings (height-keyed charcoal ramp) and roads
  (faint whites so the network reads as structure, not a bright grid).
- **POI filtering**: OSM POIs are narrowed to transit / landmarks / parks.
  The venue class you are mapping is *excluded* deliberately, so OSM's
  unmoderated pins never compete with your curated layer. Do the same for
  whatever WhatsNearYou pins.
- **Camera bounds**: `TELANGANA_BOUNDS` + `renderWorldCopies: false`.
  A rectangle, not a polygon — good enough, and documented as such.
- **Default view**: opens on the densest cluster, not the city centre, and
  starts at `pitch: 0`. 3D is an opt-in toggle because tilt makes clustered
  pins occlude each other.

### Camera padding — copy this, it is not obvious

Because the map fills the viewport and panels float on top, `flyTo({center})`
centres the pin in the *geometric* middle of the container — which is
underneath the open sheet on mobile and under the right column on desktop.
You open a card about a place and cannot see the place.

`MapExperience.cameraPadding()` measures the live container and offsets the
camera into the region still visible. Two things to know:

1. Apply it to **both** `flyTo` and `fitBounds`.
2. MapLibre's `padding` is **persistent camera state**, not a per-call
   argument. It must be cleared when the last panel closes, or the map
   stays permanently offset and every later recentre drifts further.

### three.js custom layers

`BillboardLayer` renders 3D ad panels via a MapLibre custom layer. Two traps:

- Each layer creates its **own `THREE.WebGLRenderer` over the map canvas**.
  A second one collides with the first in React Strict Mode. If you add
  more 3D, consolidate into one shared renderer/scene.
- **Never call `map.triggerRepaint()` unconditionally in `render()`.** That
  pins the map into a permanent render loop, every frame, forever — the
  reference did this even with zero billboards placed, which is the normal
  state. Return early when the scene is empty.

---

## 9. Search

`lib/searchMatch.ts` tokenizes a query, drops stopwords, fuzzy-matches each
token independently against tag / category / area vocabularies, and **ANDs
every criterion found**, so `"work friendly in jublie hills"` resolves to
`Work Friendly` + `Jubilee Hills`. It is genuinely good. Take it.

Four bugs are already fixed in it. Do not reintroduce them:

1. **Prefix matching needs a minimum length.** Without it a one-letter
   token prefix-matched anything starting with that letter — `"u"` matched
   the area `Uppal`, `"b"` matched `Bakery`. Minimum is 3 characters.
2. **Fold accents before tokenizing.** `[^a-z0-9]` replacement turned `ç`
   into a *space*, splitting `"conçu"` into `"con"` + `"u"` — which then
   triggered bug 1. Fold on **both** sides: the tokenizer and the
   `includes()` name match.
3. **Substring matching is too loose** — `"pet"` matched inside
   `"gandiPET"`. Prefix only.
4. **Edit-distance thresholds collide on real vocabulary.** `buffet` and
   `budget` are 2 edits apart. The cutoff is tuned around this.

**Known limitation, not yet fixed:** a two-word area needs both words, so
`"jubilee"` alone does not match `Jubilee Hills`. Affects the two largest
neighbourhoods. Worth fixing in the new project.

**Also:** when a user picks a specific result by name, suppress the group
matcher for that query. Writing the name back into the box made it look
like a fresh search — 58 of 85 cafe names re-triggered a group match that
yanked the map away 350ms after arriving.

---

## 10. Responsive behaviour

**One breakpoint changes behaviour, not just layout: 1024px.**
`lib/useMediaQuery.ts` exists only for that. Anything that merely changes
appearance belongs in a media query.

| | ≥1024px | <1024px |
|---|---|---|
| Panels | right column, 380px, stack | bottom sheets, **one at a time** |
| Sheet width | — | capped 560px and centred (a tablet is also "<1024") |
| Dismiss | close button | swipe down, tap map, Escape, close button |
| Close targets | 32px | **44px** under `pointer: coarse` |
| Ad rail | visible | **yields** when a sheet opens |

### The single-panel rule — implement it as a derived value

This was got wrong once. The rule lived in a `resultsCollapsed` flag set
inside one function, so only that one entry point obeyed it; opening a
sidebar tab while a filter was active stacked two full-height sheets.

Derive it instead:

```ts
const visiblePanel = selected ? "detail"
  : feedTab ? "feed"
  : resultsMatch ? "results"
  : eventsOpen ? "events" : null;
const canShow = (p) => !singlePanelMode || visiblePanel === p;
```

Most specific first. A new call site cannot forget a derived rule.

### Gesture performance

`useSwipeToDismiss` writes `transform` **straight to the DOM node**, not
through `setState`. A drag fires ~60 touchmoves/second and routing those
through React would re-render the whole card each frame. Only `transform`
and `opacity` are touched (both composited), listeners are `passive`, and
the drag only starts when the sheet is scrolled to the top so a flick while
reading does not dismiss.

---

## 11. Auth

**Two entirely separate sessions**, and this is deliberate:

- **Public**: Google OAuth → `lib/useAuth.ts` → `supabase` client
- **Admin**: ID + password → `lib/useAdminAuth.ts` → `adminSupabase`
  client, **different localStorage key**

They were shared once, and signing into the admin console made the operator
appear as a signed-in visitor on the public map; signing out of one signed
out of both.

Admin accounts are created out-of-band by `scripts/create-admin.mjs`
(service role). There is no self-signup path into `admins`, and the table
has no insert policy for anyone.

**`AuthGate` / `useRequireAuth`** wraps an action: if signed in it runs, if
not it opens the sign-in modal and runs the action afterwards. Put the gate
on the **tap**, not on the thing being gated — the prompt should appear
when the user acts, not after a flow has already begun.

Personal features (favourites, visited, collections, leaderboard) all
require sign-in. Opening them signed out showed an empty panel, which reads
as "you have nothing saved" rather than "sign in to save things".

---

## 12. The verified-presence system — the crown jewel

**This is the most reusable and most valuable thing in the codebase, and it
transfers to pandals almost unchanged.**

Two-phase GPS check-in:

```
1. POST /check-in         → creates a short-lived row; records start
                            lat/lng/accuracy; requires accuracy ≤150m
2. wait 30 seconds        → the dwell; you cannot drive past and claim it
3. POST /check-in/verify  → re-reads location, re-checks distance,
                            marks verified_at
4. POST /reviews or /log-visit  → accepts only a verified, unused,
                                  unexpired check-in
```

Enforced at four layers: client gate, server distance re-check, DB unique
index, RLS. The server never trusts a client-supplied user id — it resolves
the JWT itself.

Design details worth keeping:

- **Two-step consent.** Explain *why* location is needed, then require a
  separate tap. Jumping straight to the browser prompt drives people to
  "Block". It also keeps the geolocation call inside a user gesture, which
  some browsers require.
- **300m radius** — deliberately generous. Pins are often geocoded to
  road-level, and phone GPS has real error. A tight radius rejects genuine
  visits, not just fake ones.
- **20-hour cooldown** on repeat-visit rewards, so nobody farms by
  re-verifying from the same seat.
- **One check-in covers both** a review and a visit log. They were separate
  once and made people sit through the 30-second dwell twice.

For pandals this is close to perfect: "I was actually at this pandal" is
exactly the claim worth proving, and it is what a general map cannot offer.

### Points economy

Ledger of earn events, never a running total, so a balance is always
`sum(amount)` and cannot drift. Awards come from security-definer triggers
or admin service-role routes — never a client insert.

**The exploit that was fixed:** deleting a review freed the
one-per-place slot but left its points in place, and nothing rate-limited
check-in creation — so a loop of check in → review → delete paid the full
reward every ~40 seconds. Review deletion was removed. If you add any
"undo" to a rewarded action, check the ledger, not the deletable table.

---

## 13. Advertising system — take the whole thing

Three formats, one `billboards` table discriminated by `ad_type`:

| Format | Rendering | Price shown |
|---|---|---|
| **5-slot map rail** | DOM, bottom centre, `slot_number` 1–5, unique index | ₹1,000 |
| **3D billboard** | three.js custom layer, placed at a coordinate | ₹3,000 |
| **Aircraft banner** | **CSS/DOM overlay**, flies across the upper map | ₹3,000 |

The aircraft is a DOM overlay rather than a three.js object **on purpose**:
it stays readable at `pitch: 0`, which a 3D banner would not.

Enquiry flow is deliberately manual: public `/advertise` form → `pending`
row → admin inbox → approve/reject → admin publishes by hand. Manual
publishing lets the owner verify payment, creative, dates and destination
before anything goes live. Keep this until payments are automated.

**Gotchas already paid for:**

- The ad rail and the panel column resolve to the *same* bottom offset on
  mobile — an open card covered all five paid slots. Bottom chrome must
  yield to an open sheet.
- Centre the rail with `inset-inline` + `margin-inline: auto`, not
  `left: 50% / translateX(-50%)`. Transform-based centring gets clobbered
  by any other rule that animates `transform`.
- On mobile, five slots became a horizontally scrolling row that depended
  on someone noticing it scrolls. It is now a static 5-column grid —
  advertisers pay equally, so all five must be visible.

---

## 14. The one architectural change you must make

**HydCafeMap's places are permanent. WhatsNearYou's are not.**

A cafe exists until it closes. A Ganesh pandal exists for about ten days a
year. Every other occasion you add — festivals, markets, pop-ups, parades —
is the same shape. **The reference schema has no time dimension on its map
entities at all**, and this is the single biggest thing you must add rather
than copy.

`cafes` has no date columns. `events` has `event_date` but is *not*
map-pinned — it feeds a ticker and a drawer, nothing more. Neither is what
you need.

Model the core entity with a lifespan from the first migration:

```sql
create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  occasion_id uuid not null references occasions(id),
  lng double precision not null,
  lat double precision not null,
  starts_at timestamptz,          -- null = permanent
  ends_at   timestamptz,          -- null = permanent
  ...
);
create index places_active_idx on places (starts_at, ends_at);
```

Consequences to design for from the start, not retrofit:

- **The map's default filter is "what is on now"**, not "everything".
  `WHERE now() BETWEEN starts_at AND ends_at` — with null meaning permanent.
- **An occasion dimension.** Ganesh pandals, Bonalu, markets, food festivals.
  This replaces `lib/categories.ts` and is a real table, not a hardcoded
  list, because the set grows every year.
- **Recurrence.** Pandals return annually at roughly the same spot. Decide
  early: new rows each year (simplest, keeps history, my recommendation) or
  a recurrence rule (compact, and much harder to query).
- **Archival.** What happens to last year's pandals? They are valuable —
  "this pandal has been here 6 years" is exactly the kind of thing only you
  would know. Do not delete them; exclude them from the default view.
- **Ad campaigns already have `campaign_end`** (`0032`). That pattern
  extends naturally: an ad for a Ganesh pandal sponsor should expire with
  the festival.

Everything else in this document transfers. This part does not, and
bolting a time dimension onto a schema that assumes permanence is far more
painful than starting with one.

---

## 15. Known-good practices to continue

- **`tsc --noEmit`, `eslint`, `npm run build` before every commit.** All
  three, every time.
- **Verify against the live database, not the migration files.** They
  diverge. The reference's `0009` sat unapplied for months.
- **Probe security from outside** with the anon key, and be precise about
  what a probe does and does not prove.
- Write the *reason* in the comment, naming the bug where there was one.
- Reach for `useSyncExternalStore` for external stores (media queries,
  localStorage) — the codebase already uses it consistently, and React 19's
  lint rules reject `setState` in an effect body.

## 16. Traps that cost real time here

1. **Tailwind v4 utilities live in a cascade layer.** Unlayered CSS beats
   them regardless of source order. A `mt-2` next to a custom class silently
   does nothing.
2. **CSS `:first-child` breaks when you add an element.** Rules targeting
   `> div:first-child` ended up styling a drag handle after one was added
   above the header.
3. **A hover rule that sets `transform` replaces a centring
   `transform`.** The element jumps across the screen on hover.
4. **`justify-content: flex-end` + `overflow`** makes overflowing content
   unreachable in Chrome. Use `margin-block-start: auto` on the first child.
5. **`backdrop-filter` creates a containing block for `position: fixed`
   descendants.** A "full-screen centred" modal inside a blurred parent
   centres itself inside that parent. Portal to `document.body`.
6. **PostgREST `insert().select()` needs SELECT as well as INSERT.**
   Dropping a read policy breaks writes that return the row.
7. **Nominatim cannot forward-geocode Indian plot-number addresses** —
   1 of 48 resolved. Reverse geocoding works fine. Budget for Google's
   Geocoding API if you need building-level accuracy.

## 17. Open issues in the reference (do not inherit)

- **Photos are stored as base64 data URLs inside the row**, and
  `/api/cafes` returns every row with its photo on every page load. Fine at
  5 photos, not at 85. **Use Supabase Storage from day one.**
- The in-memory rate limiter is per-instance on serverless. Fine at low
  traffic; swap for Upstash behind the same function signature when needed.
- Welcome-bonus farming via multiple Google accounts is unsolved.
- **Nothing in the mobile rework has been tested on a real device** — it is
  verified by type-check and build only.
- Pin data quality: only 16 of 85 coordinates match the source CSV. The
  seeded coordinates came from an untraced source with 13–15 decimal places
  (no geocoder produces that). **Validate coordinates at import time** and
  store the geocoding precision alongside them.

---

## 18. Suggested build order

1. Schema first, **with the time dimension** (§14). Occasions, places,
   lifespans, `CHECK` constraints on any enumerated column.
2. RLS correct from migration one. Never a permissive placeholder.
3. Map shell: `Map.tsx`, `darkenMapStyle`, `mapStyle`, markers, camera
   padding.
4. `MapExperience` orchestration with the derived single-panel rule.
5. Design tokens and `.panel-elevated`, with the coarse-pointer blur
   reduction already in place.
6. Search, with all four fixes from §9 present from the start.
7. Auth: public Google + separate admin session, `AdminGate`,
   `requireAdmin`, `adminFetch`.
8. Verified check-in (§12) — this is the differentiator, build it early.
9. Points/leaderboard if the engagement loop matters.
10. Advertising last. It is self-contained and the schema is stable.

Steps 1 and 2 are where the reference lost the most time to rework. Spend
the effort there.
