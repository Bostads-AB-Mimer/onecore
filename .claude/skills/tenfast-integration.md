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
`signingInProgress`, `draft`. Unconfirmed (no switch case, mapping, or test
references them — if Tenfast sends these, current code silently falls
through to `default`/"Unknown Tenfast stage"): `voided`, `rejected`.

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
