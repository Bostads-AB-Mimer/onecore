---
name: leasing-test-conventions
description: >
  Use when writing or reviewing tests in
  services/leasing/src/services/lease-service/tests/ — covers test-data
  construction (fishery factories), AdapterResult narrowing, mocking idioms,
  fake-timer cache-busting, and which stylistic choices are genuine
  repeated conventions vs. mixed per-file preference. Use before writing a
  new test file, or deciding how to structure assertions/mocks for a leasing
  test, so new tests match real patterns instead of inventing a style or
  copying a one-off.
---

# Leasing Service Test Conventions

Based on a survey of all 42 files under
`services/leasing/src/services/lease-service/tests/`. Conventions below are
split into **solid** (repeated across most files, or adopted as practice
going forward — follow these) and **mixed** (multiple idioms genuinely
coexist — pick one deliberately, don't assume there's a single "right"
answer to copy).

Two items below (Arrange/Act/Assert comments, mock reset via
`beforeEach(jest.restoreAllMocks)`) were a minority pattern as of this
survey but have been adopted as practice going forward (2026-10) — new
tests should follow them even though most _existing_ files predate the
decision and don't. Don't rewrite an existing file just to retrofit these;
apply them when touching a file anyway or writing a new one.

## Solid conventions — follow these

### Arrange/Act/Assert comments

Label the three phases of every test with `// Arrange`, `// Act`, `//
Assert` comments, even when a phase is one line:

```ts
it('returns the lease id when Tenfast accepts the request', async () => {
  // Arrange
  const mockLease = factory.tenfastLease.build()
  ;(request as jest.Mock).mockResolvedValue({ status: 200, data: mockLease })

  // Act
  const result = await tenfastAdapter.createLease(
    contact,
    'CODE',
    new Date(),
    true
  )

  // Assert
  expect(result).toEqual({ ok: true, data: mockLease.externalId })
})
```

As of the 2026-10 survey this was only consistently present in
`tenfast-adapter.test.ts` and `routes/rentalObjects.test.ts` (39 of 42
files had no structural labeling) — it's now the standard to write new
tests with, not something you'll see everywhere yet.

### Mock reset: `beforeEach(jest.restoreAllMocks)`

Reset mocks between tests with the point-free form, once per `describe`
block (or file) that uses `jest.spyOn`/`jest.mock`:

```ts
describe(tenfastAdapter.createLease, () => {
  beforeEach(jest.restoreAllMocks)
  // ...
})
```

This was already the single most-repeated idiom (concentrated in
`tests/routes/*.test.ts`) and is now standard going forward, over the other
idioms in active use (`jest.resetAllMocks`, `jest.clearAllMocks`, no reset
at all). It matters functionally, not just stylistically: without a reset
hook, mock call counts and implementations accumulate across tests in the
same `describe`, which can make a later test's assertion pass or fail for
the wrong reason (e.g. asserting `toHaveBeenCalledTimes(1)` when an earlier
test's calls are still counted). Prefer `restoreAllMocks` specifically
(not `resetAllMocks`/`clearAllMocks`) since it also restores the original
implementation on anything `jest.spyOn` touched, so a spy from one test
can't leak into the next.

### Test data: fishery factories, not inline literals

`tests/factories/index.ts` re-exports ~24 factories. 31 of 42 test files use
them (532 call sites of `factory.x.build(...)`), and there are **zero**
instances of hand-written inline domain-object literals anywhere outside
`tests/factories/`. Always override specific fields via `.build({ field })`
rather than constructing the object by hand:

```ts
const mockRentalObject = factory.tenfastRentalObject.build({
  hyror: [rentRow],
})
```

If a factory doesn't exist yet for the type you need, add one under
`tests/factories/` rather than inlining — that's what everyone else did for
every type currently covered. The only test files that don't use factories
are pure-function tests operating on primitives or raw DB-row shapes with no
corresponding domain type.

### AdapterResult narrowing

- **Success case, need to inspect `.data`:** `assert(result.ok)` from
  `node:assert`, then access `.data` directly below it. Dominant pattern
  (130 occurrences, 9 files), e.g.:
  ```ts
  assert(result.ok)
  expect(result.data).toEqual(...)
  ```
- **Error case:** `expect(result).toEqual({ ok: false, err: '...' })` as a
  single assertion — don't narrow first, just compare the whole result.
- `if (!result.ok) return` / `if (!result.ok) { ... }` is a legitimate
  secondary pattern for narrowing mid-test before continuing with more
  assertions — not an anti-pattern, just less common than `assert`.

### File organization

Test files mirror source files 1:1 by path and name
(`adapters/xpand/cmlog-lease-adapter.ts` →
`tests/adapters/xpand/cmlog-lease-adapter.test.ts`). Known, accepted
exceptions: a single large source file split into several test files by
concern (`listing-adapter.ts` → `tests/adapters/listing-adapter/{index,
delete-listing,get-listings,get-listings-with-applicants}.test.ts`); a
couple of naming/casing mismatches between source and test file. Don't
treat 1:1 mirroring as an absolute rule, but default to it for a new file.

### Fake-timer cache busting

When testing something that reads from a module-level TTL cache (see
`tenfast-integration.md` for the tag/article caches in
`tenfast-adapter.ts`), use `jest.useFakeTimers()` +
`jest.setSystemTime(<date>)` per test, with cleanup in `afterEach`, **not**
a manual `jest.useRealTimers()` call at the end of the test body — a failed
assertion before that line would leak the fake clock into later tests.
Each test that needs a cold cache sets a different system time (far enough
apart to exceed the cache's TTL):

```ts
describe('VAT rent row article swap', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('...', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2101-01-01'))
    // ...
  })

  it('...', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2101-01-02')) // different cache window
    // ...
  })
})
```

Same pattern is used in `tenfast-rental-object-helpers.test.ts`,
`rental-object-availability-helpers.test.ts`, and
`create-or-update-application-profile.test.ts` for time-dependent (not
cache-dependent) logic — there it's a plain `beforeEach`/`afterEach` pair
with one fixed `TODAY` rather than a different time per test, since there's
no cache to bust. This is currently the **only** timer-mocking idiom in the
leasing test suite — don't introduce `jest.advanceTimersByTime` or a
different date-mocking approach without a reason.

## Mixed — pick deliberately, don't assume a single convention

### `describe()` naming

- **Route tests** (`tests/routes/*.test.ts`) consistently use a string
  literal mirroring the HTTP route: `describe('GET
/applicants/:contactCode/:listingId', ...)`. This one is consistent
  across all 9 route test files — follow it for new route tests.
- **Adapter tests** lean toward a function reference for the outer
  per-function describe (`describe(tenfastAdapter.getRentalObject, () =>
...)`), with string-literal nested describes for scenario sub-groups
  (`describe('tag propagation', ...)`). But several files
  (`offer-service.test.ts`, `priority-list-service.test.ts`) use a string
  literal matching the function name even though the function was
  importable as a reference — so this isn't a hard rule. Either is
  acceptable for a new adapter test file; prefer the function reference
  when the module is imported as a namespace (`import * as adapter from
...`) since it keeps the describe title in sync if the function is
  renamed.

### `it()` naming — "should X" vs. plain descriptive

No dominant style — roughly 36% "should ...", the rest plain descriptive
present tense (`'responds with 404 if no listing found'`). Individual files
are internally consistent but disagree with each other. When adding tests
to an existing file, match that file's existing style. When starting a new
file, plain descriptive sentences are marginally more common — prefer them,
but don't rewrite an existing file's style to match.

### `any` in test code

No lint rule bans it, and it's rare in practice (7 occurrences across the
whole test suite) — but where it appears, it's narrowly scoped to typing a
mock callback's loosely-shaped argument or a captured variable (e.g. `let
leaseRequestData: any` to capture whatever a mocked `request()` call was
given), never a domain type. Keep `any` usage that narrow if you reach for
it at all.
