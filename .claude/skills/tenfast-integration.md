---
name: tenfast-integration
description: >
  Use when working with the Tenfast REST API integration in services/leasing
  (adapters/tenfast/*) — fetching or mapping leases (avtal) or rental objects
  (hyresobjekt), debugging slow endpoints or pagination, adding a new
  avtal/search or hyresobjekt query, or reasoning about lease stage/
  cancellation semantics. Also use when a Zod parse throws or silently drops
  data from a Tenfast response.
---

# Tenfast Integration Gotchas

Tenfast is the parking/lease management REST API integrated via
`services/leasing/src/services/lease-service/adapters/tenfast/`. It has
several non-obvious behaviors that have caused real bugs — check this before
writing a new query or debugging a weird result.

## Pagination is capped and sequential

Every paginated endpoint hard-caps at **100 records per page**, regardless of
a `limit` param you pass (tested up to 1000 — ignored). Pagination is
cursor-based via a `paginate` query param and a `next` cursor in the
response, so pages of the *same* query must be fetched sequentially — there's
no way to parallelize within one query.

- If a query can return thousands of records (e.g. all vacant/soon-vacant
  parking spaces), expect multiple seconds just from round-trip count. No
  workaround found on our side; this has been raised with Tenfast's developer
  to ask for a higher page-size cap.
- **Independent queries** (different filters/endpoints) *can* run
  concurrently via `Promise.all` — that's real savings. Don't try to broaden
  one query's filter to avoid a second query "to save a round trip"; a
  broader filter (e.g. adding `occupied` to a states filter) can mean
  scanning the entire portfolio instead of a targeted subset, which is much
  slower than two narrow concurrent queries.
- The shared `fetchAllPages` helper in `tenfast-adapter.ts` handles the loop.
  Check its current signature before adding a new call site — the first-page
  cursor contract (empty string vs. `null`, whether the `paginate` param is
  omitted or empty on page 1) is the kind of detail that gets refined over
  time; don't assume it from this doc.

## Schema leniency is asymmetric — this has caused live 500s

In `TenfastLeaseSchema`:
- `hyresobjekt` uses `z.array(z.unknown()).transform(...)` with a
  `.safeParse` + flatMap-filter fallback — a single unparseable item is
  **silently dropped**, the rest of the array still parses.
- `hyresgaster` is `z.array(TenfastTenantSchema)` with **no such fallback** —
  one bad item (e.g. an unpopulated ObjectId string instead of a full
  object) fails the **whole array's parse**, which throws inside
  `fetchAllPages` and can 500 the entire endpoint.

**Always pass `populate=hyresobjekt,hyresgaster` together** on any
`avtal/search` or `avtal` query, even if you only care about one of them —
omitting `hyresgaster` from `populate` means it comes back as raw ObjectId
strings, which fails `TenfastTenantSchema` for every record.

If a Zod parse throws inside `fetchAllPages` and you need to see the exact
issue, a quick throwaway script (axios + the schema's own `.safeParse`,
logging `error.issues`) against a live/test Tenfast instance is the fastest
way to isolate which field failed — delete it once diagnosed, don't commit it.

## Enums

Neither `stage` nor `states` is typed as an actual enum anywhere in this
codebase (`stage` is `z.string()` in the Zod schema) — these are Tenfast's
own API values, passed through as free-form strings. Split below into
values this codebase actually has code/tests for vs. values that are only
documented/assumed and haven't been seen exercised here — treat the second
group as "probably real, unconfirmed," not settled fact.

**Lease (avtal) `stage`** — confirmed in code (used in
`helpers/tenfast.ts:calculateLeaseStatus` and
`adapters/tenfast/filters.ts:stageToStatus`): `active`, `upcoming`,
`terminationScheduled`, `archived`, `terminated`, `preTermination`,
`signingInProgress`, `draft`. Also valid, but not mapped in those two (they
fall through to `default`/"Unknown Tenfast stage" there): `voided`,
`rejected`. Tenfast accepts all of these as `filter[stage]` values and
rejects an unknown one with `400 invalidsearchfilter: filter.avtal.stage`.
`tenfast-rental-object-helpers.ts` treats `draft`, `signingInProgress`,
`voided` and `rejected` as never being a tenancy.

**Rental object (hyresobjekt) `states`** — confirmed directly by Tenfast's
own developer (2026-09), so treat this as authoritative rather than
inferred from our code. There are 9 states total; 7 of them (all except
`rental-restriction` and `public`) are derived from the object's linked
leases and are therefore also present in a separate `.avtalStates` field.
Definitions as given:

| State | Meaning |
|---|---|
| `vacant` | No non-terminated lease is linked, **or** a lease exists but its move-in date is in the future |
| `reserved` | At least one unsigned lease is linked |
| `occupied` | At least one signed lease with a move-in date today or in the past |
| `soon-vacant` | An active lease exists that will end within a month |
| `soon-occupied` | An active lease exists whose move-in is within a month |
| `rental-restriction` | The rental object has a block (spärr) |
| `public` | (definition not given) |

Only 7 states were enumerated above even though the developer said there
are 9 total — 2 remain unaccounted for. Don't assume the list is complete;
ask if it matters for what you're building.

Important interaction (confirmed, not hypothetical): **`soon-vacant`
already includes a rental object whose current lease is
`terminationScheduled`, as long as that lease ends within about a month.**
Only `terminationScheduled` leases ending further out are excluded from
`states=vacant,soon-vacant` — those still show as `occupied` until they
fall inside that ~1-month window. So a query for
`filter[stage]=terminationScheduled` via `avtal/search` will overlap with
`soon-vacant` results for near-term terminations — **this overlap is real
and expected, not just a defensive worst-case.** `getAvailabilityForVacantRentalObjects`
handles it by deduping on rental object code, keeping the `soon-vacant`-sourced
record when both queries return the same object (it carries more complete
rental-object data than the record synthesized from the `avtal/search`
response).

## `includeAvtal` on `/hyresvard/hyresobjekt` and `extras/hyresobjekt/batch-get`

Documented values (confirmed from the API docs, 2026-10): `signed` = signed
and not cancelled, `open` = all not cancelled, `all` = every avtal, including
`archived`. The array is **sorted by reference descending and capped at 10**,
so it is fine for "the latest lease" and wrong for full history. The
single-object `extras/hyresobjekt/{externalId}` endpoint has no
`includeAvtal` and never returns `avtal` — probing it tells you nothing.
Migrated objects have no lease history in Tenfast, so an already-vacant
object returns an empty `avtal` until a tenancy ends there.

`typ` values on `/hyresvard/hyresobjekt`: `bostad`, `bostadsrätt`,
`lokal`, `förråd`, `parkering`, `villa`, `mark`, `byggnad`, `våning`,
`reklamtavlor`, `eventyta`. Apartments are `bostad` (`lägenhet` is
rejected with a 400). `states=` (comma list) and `state=` (single) are
mutually exclusive.

## Observed on Tenfast test (2026-10-13)

Counts from `tenfast-test-api`; production may differ.

- For `bostad`, `soon-vacant` is a subset of the `terminationScheduled`
  search: all 137 soon-vacant apartments had a `terminationScheduled` lease
  (`requested: true`, `cancelled: false`) ending within 0–31 days, and 110 of
  them were also `soon-occupied`. Apart from `vacant`, the states query added
  nothing the `avtal/search` queries did not already return.
- `terminationScheduled` has no horizon: 515 `bostad` leases, 339 of them
  ending more than 31 days out.
- 11,125 `active` `bostad` leases, none with an `endDate`. Zero in
  `preTermination`, `signingInProgress`, `draft`, `voided` and `rejected`;
  383 `upcoming` (628 across all types).
- `filter[endDate]=from,to` filters server-side with either end left open
  (`2026-12-01,` cut 515 to 178) and does not match leases without an
  `endDate`.

To probe, run a throwaway script from `services/leasing` with
`pnpm exec ts-node --transpile-only -P tsconfig.json <script>` that imports
`src/common/config` and `adapters/tenfast/tenfast-api`, so it uses the
service's own Tenfast credentials. Print counts and object codes, never
tenant data, and don't commit it.

## Which lease is "the tenancy" of a rental object

`tenfast-rental-object-helpers.ts` does not read lease `stage` for vacancy.
It takes the **latest lease whose `startDate` is in the past** as the current
(or last) tenancy and uses its dates:

- `listingHistorySince` = that lease's `startDate`. Nothing is published
  during a tenancy, so counting closed listings from there equals counting
  from the notice date, and it would also cover a fixed-term lease that ends
  without a notice.
- `vacantFrom` = the day after that lease's `endDate`, clamped to today,
  with rental blocks applied by the callers. No `cancellation` field is
  read: the notice is the notice, the lease's `endDate` is the lease's.
  Assumed, not seen: that Tenfast clears `endDate` when a notice is
  withdrawn. 0 of 800 scanned bostad leases had `cancellation.cancelled`,
  so it could not be checked.

An `upcoming` lease is never the tenancy (it has not started), nor is a
`draft`, `signingInProgress`, `voided` or `rejected` one whatever its dates;
the vacant list already excludes objects that have an upcoming lease.

Observed 2026-10-13, one page each of soon-vacant `bostad`, soon-vacant
`parkering` and occupied `parkering`: every started lease with an end date
was `terminationScheduled` with a notice; no started lease carried an end
date without a notice, and no end date lay beyond 2027. So fixed-term leases
are unobserved in our stock so far, and dropping the `requested` check
changes nothing for current data.

## `cancellation.requested` vs `cancellation.cancelled` — easy to get backwards

On a lease's `cancellation` object:
- `requested: true` — a termination notice **has been given**.
- `cancelled: true` — the termination notice was **itself later withdrawn**
  (i.e. the lease is *not* ending after all). This does NOT mean "the lease
  is cancelled/ended" — that reading is backwards and was an actual bug.

To reliably check "this lease is genuinely still terminating," check
**both**: `cancellation.requested && !cancellation.cancelled`. `requested`
alone doesn't necessarily flip back to `false` when a notice is withdrawn, so
checking only `requested` can produce false positives.

## Query syntax

`/v1/hyresvard/avtal/search` supports nested bracket-notation filters, e.g.:
```
filter[stage]=terminationScheduled&filter[hyresobjekt][typ]=parkering
```
The `populate` param controls whether nested refs (`hyresobjekt`,
`hyresgaster`) come back as raw ObjectId strings or fully-populated objects
— see the schema-leniency section above for why this matters.

**Debugging with curl:** `curl` interprets literal `[...]` in a URL as its
own range/glob syntax and fails with `bad range in URL` — this is a
client-side curl quirk, unrelated to whether Tenfast's server or axios
(Node) accepts raw brackets (they do). Use `curl -g` or
`--data-urlencode` when testing these URLs by hand.

## Tag cache

There's a module-level tag cache in `tenfast-adapter.ts` (5 min TTL). Tests
that verify tag propagation must bust the cache by spying on `Date.now` —
follow the existing `describe('tag propagation')` pattern in
`tenfast-adapter.test.ts` rather than reinventing it.
