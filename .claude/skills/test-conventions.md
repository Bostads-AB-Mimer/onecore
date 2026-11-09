---
name: test-conventions
description: >
  Use when writing or reviewing Jest tests anywhere in the onecore monorepo
  (core, services, libs) — covers test-data construction (fishery
  factories), AdapterResult assertions, how to mock at each layer (nock for
  core adapters, jest.spyOn above that), resetting mocks, fake timers and
  TTL-cache busting, and which stylistic choices are real conventions vs.
  mixed per-file preference. Use before writing a new test file or deciding
  how to structure mocks and assertions, so new tests match real patterns
  instead of inventing a style or copying a one-off.
---

# Test Conventions

The always-on rules (Arrange/Act/Assert, behaviour names, failure branches,
a new test must fail without its change, factories, date matchers, frozen
clock) are in `AGENTS.md` under `## Testing`. This skill is the longer
reference with examples.

Based on surveys of the tests in leasing (42 files under
`services/leasing/src/services/lease-service/tests/`, 2026-10) and core
(98 files, 2026-11). Conventions are split into **solid** (repeated across
most files, or adopted as practice going forward — follow these) and
**mixed** (several idioms coexist — pick one deliberately).

Don't rewrite an existing file just to retrofit a convention; apply it when
you touch a file anyway or write a new one.

## Solid conventions — follow these

### Arrange/Act/Assert comments

Label the three phases of every test with `// Arrange`, `// Act`,
`// Assert` comments, even when a phase is one line:

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

Adopted as practice in 2026-10 during the Tenfast work. Most existing files
predate it (in core only 2 files have it), so you won't see it everywhere
yet.

### Test names

Plain, present-tense descriptions of the behaviour:
`'responds with 404 if no listing found'`, not `'should work'`. This is
already the majority in core (about 1 500 tests vs. 200 starting with
"should"); leasing is more mixed (about 36 % "should"). When adding to an
existing file that uses "should …", matching the file is fine.

### Test data: fishery factories, not inline literals

Each package keeps its factories in one folder:

| Package    | Factories                                          |
| ---------- | -------------------------------------------------- |
| core       | `core/test/factories/`                             |
| leasing    | `src/services/lease-service/tests/factories/`      |
| keys       | `src/services/key-service/tests/factories/`        |
| economy    | `test/factories/`                                  |
| contacts   | `test/factories/`                                  |
| property   | `src/tests/factories/`                             |
| work-order | `src/services/work-order-service/tests/factories/` |
| inspection | `src/services/inspection-service/tests/factories/` |

Override only the fields the test is about via `.build({ field })`:

```ts
const mockRentalObject = factory.tenfastRentalObject.build({
  hyror: [rentRow],
})
```

If a factory doesn't exist yet for the type you need, add one in that
folder rather than inlining the object. Pure-function tests on primitives
or raw DB rows with no domain type are the accepted exception.

### AdapterResult assertions

- **Success case, need to inspect `.data`:** `assert(result.ok)` from
  `node:assert`, then use `.data` directly (dominant in both leasing and
  core):
  ```ts
  assert(result.ok)
  expect(result.data).toEqual(...)
  ```
- **Error case:** compare the whole result in one assertion — don't narrow
  first: `expect(result).toEqual({ ok: false, err: 'not-found' })`.
- `if (!result.ok) return` to narrow mid-test is a legitimate secondary
  pattern, just less common.

### Mock the layer below, per layer

| Test of                               | Mock                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| core adapter (`core/src/adapters/`)   | HTTP with **nock** against the service's base URL           |
| core route or process                 | the adapter functions with `jest.spyOn(adapter, 'fn')`      |
| service route                         | the service's adapters with `jest.spyOn` (or `jest.mock`)   |
| service adapter to an external system | the HTTP client (`request`/axios) or the DB via the test DB |

Never mock the code under test. nock is used almost only in core adapter
tests (also economy's Xledger adapter test and one leasing test).

With nock, clean up after each test so an unused interceptor can't answer
the next test's request. When the call itself is the behaviour, also check
that it was made with `scope.isDone()`. Adapted from
`core/src/adapters/tests/property-management-adapter.test.ts`:

```ts
describe(propertyManagementAdapter.getApartmentRentalPropertyInfo, () => {
  afterEach(() => nock.cleanAll())

  it('returns err if not found', async () => {
    // Arrange
    nock(config.propertyInfoService.url)
      .get('/rentalPropertyInfo/apartment/1234')
      .reply(404)

    // Act
    const result =
      await propertyManagementAdapter.getApartmentRentalPropertyInfo('1234')

    // Assert
    expect(result).toEqual({ ok: false, err: 'not-found' })
  })
})
```

Cleanup is inconsistent in existing core files (13 of 21 nock files call
`cleanAll`); add it when you touch a file.

### Route tests: supertest against the Koa app

Route tests in core and the services call the Koa app with supertest,
`request(app.callback())`, and name the `describe` after the HTTP route:
`describe('GET /v1/contacts/by-codes', ...)`. Follow both for new route
tests.

### File organization

Test files mirror source files by path and name, in a `tests/` folder next
to the code (`adapters/xpand/cmlog-lease-adapter.ts` →
`tests/adapters/xpand/cmlog-lease-adapter.test.ts`). A large source file
split into several test files by concern is an accepted exception. Default
to mirroring for a new file.

### Fake timers and TTL-cache busting

Freeze the clock per test with `jest.useFakeTimers()` +
`jest.setSystemTime(<date>)`, and restore it in `afterEach`, **not** with a
`jest.useRealTimers()` call at the end of the test body — a failing
assertion before that line would leak the fake clock into later tests.

For time-dependent logic, use one fixed `TODAY` in a `beforeEach`/
`afterEach` pair. For code that reads a module-level TTL cache, give each
test that needs a cold cache a different system time, far enough apart to
exceed the TTL:

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

`setSystemTime` is the idiom for "what day is it". Where the code itself
waits on timers (intervals, retries), `jest.advanceTimersByTime` is used
instead (`lease-cache.test.ts` in leasing, the scheduled-sends worker in
communication). Don't add a date-mocking library.

## Mixed — pick deliberately

### Resetting mocks between tests

Not settled yet. A planned change sets `clearMocks` and `restoreMocks` in
the jest config so nobody has to do it by hand; until then:

- Every `describe` that mocks must reset in some way — no reset at all lets
  call counts and implementations leak between tests.
- leasing adopted `beforeEach(jest.restoreAllMocks)` in 2026-10; core most
  often uses `beforeEach(jest.resetAllMocks)`. Match the file you are in.
- In Jest 29.7, `restoreAllMocks` only restores `jest.spyOn` mocks; it does
  not clear call data on plain `jest.fn()`. If the file asserts on calls to
  a `jest.fn()`, also clear it (`jest.clearAllMocks()`).

### `describe()` naming in adapter tests

Route tests always use the route string (above). Adapter tests lean towards
a function reference for the outer describe
(`describe(tenfastAdapter.getRentalObject, () => ...)`) with string
describes for scenario groups (`describe('tag propagation', ...)`), but
string names matching the function also occur. Either is fine; prefer the
function reference when the module is imported as a namespace, since the
title then follows a rename.

## Package-specific notes

### leasing

- Needs the Docker test DB (`pnpm test` runs `test:create-db` first); so do
  contacts, keys and communication.
- The Tenfast adapter's tag and article caches are module-level with a TTL;
  see `tenfast-integration.md` and bust them with the fake-timer pattern
  above (`describe('tag propagation')` in `tenfast-adapter.test.ts`).

### core

- Generated API types for the .NET services come from `pnpm generate-types`;
  don't hand-edit them to make a test compile.
