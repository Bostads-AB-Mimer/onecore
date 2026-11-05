# sync-lease-documents

Copies lease documents from Xpand into Tenfast (AVTAL-112): the signed contract
becomes the lease's main file, the operative uppsägning becomes the lease's
termination document, everything else is attached as a related document. Reads
Xpand, writes only to Tenfast.

```sh
pnpm run dev:script:sync-lease-documents -- --dry-run           # plan only, writes nothing
pnpm run dev:script:sync-lease-documents -- --limit-leases 5    # a handful, for real
pnpm run dev:script:sync-lease-documents -- --leases 104-071-06-0403/12
pnpm run dev:script:sync-lease-documents                        # the full run
```

Needs `XPAND_DATABASE__*` and `TENFAST__*` in `.env`; the Xpand host is reached
through a tunnel on `localhost:11434`, which is the first thing to check when
the script dies with `Failed to connect`.

## Status, as of 2026-09-07

**The full run against the test environment is done**: 39,827 documents
uploaded across 20,411 leases (~5.5 h wall clock at `--concurrency 4`,
including reruns), 801 stale related-docs copies deleted. End state: **16,148
leases carry a main file** (8,340 contract-titled, ~7,100 bundles, 706
object-number scans), 1,110 a termination file. What remains:

- **39 oversized documents** (over Tenfast's 15 **decimal** MB cap) in
  `oversized.csv` — Mimer imports these manually.
- **2 leases Tenfast refuses to touch** (`211-140-03-0905/02`,
  `211-724-00-0050/02`): any file upload triggers avtal re-validation, which
  fails with "Hyresradernas summa får inte vara negativ" — their rent rows in
  Tenfast need fixing first, then a rerun picks them up.
- **3 documents with no decodable content** in xpand (`no-content` rows).
- Tenfast's gateway 502s intermittently under sustained load (~1–2/min at
  4-way concurrency). Retries absorb most; run with `--max-failures 500`, and
  know that a 502 sometimes arrives **after** the file was stored — the next
  rerun sees it attached and skips it.

- **Termination documents upload and are verified.** Tenfast added
  `POST /avtal/{id}/upload-termination-file`, and the script sends the
  operative uppsägning there (rules below). Verified 2026-09-07 with a
  20-lease stratified live run (49 uploads, 6 deletions, 0 failures) covering
  plain terminated leases, bekräftelse fallbacks, related-docs cleanup,
  aborted terminations (left alone), and a multi-uppsägning tie-break —
  followed by an idempotent same-directory rerun (0 uploads) and a
  clean-directory rerun (0 planned actions). The endpoint accepts
  `terminated`-stage leases and **replaces silently**, like `upload-file`.

- **Bilaga-titled contract bundles become the main file.** Found in review
  2026-09-07: `Hyreskontrakt … Bilaga X` documents are Scrive bundles whose
  page 1 is the full signed contract (see _Choosing the contract_), recovering
  main files for 7,143 of the 10,460 "no contract" leases. Verified live on
  the same 20-lease set: 7 bundles uploaded as main files, their related-docs
  copies deleted, clean-directory rerun plans 0.

- **33 documents exceed Tenfast's 15 MiB limit** and will not be imported.
  Tenfast will not raise the cap; Mimer handles these manually. They are listed
  in `oversized.csv` on every run. All 33 are scanned application paperwork
  (`Godkänd överlåtelseansökan` and similar), **none is a contract**, so no
  lease loses its main document to this.

## Choosing the termination document

An uppsägning is only sent to `upload-termination-file` when the lease's stage
says a termination is in progress or completed: `terminated`, `archived`,
`terminationScheduled` or `preTermination`. On any other stage every uppsägning
goes to `related-docs` — a terminated-then-aborted lease is `active` again, and
its uppsägning is history, not the operative termination.

Not every uppsägning-classified document is the termination itself, and the
pick runs in two tiers (see `isOperativeUppsagning` /
`isUppsagningsbekraftelse`):

1. **An actual uppsägning wins.** `Bekräftelse på uppsägning …` is sent after
   the uppsägning it confirms and would otherwise win newest-first almost
   every time — in the test data it is 686 of the 1,798 uppsägning-classified
   documents on terminating leases.
2. **With no actual uppsägning, the newest bekräftelse stands in.** The
   digital termination flow produces only this document, initiated by Mimer in
   Scrive and **signed by the tenant with BankID**, carrying the termination
   dates — for those leases (186 in test data) it is the termination document.

`Ändring av uppsägningstid` and `Återtagen uppsägning` never qualify and stay
related documents.

When several candidates exist in a tier the **newest wins**, with no PDF
inspection: a re-termination supersedes the one it replaces, signed or not.
The losers go to `related-docs`.

Two guards protect what is already in Tenfast:

- A lease that already has a termination file is skipped. The listing's
  `cancellation.file` (undocumented, but present on every record) says whether
  one is set and under what name — no per-lease requests needed.
- Copies that earlier runs left in `related-docs` are deleted — but **only when
  `actions.csv` proves we uploaded the termination file ourselves**. A lease
  terminated via SimpleSign carries a Tenfast-generated termination document,
  and its Xpand uppsägning copy is left alone as a related document.

## Running it in production

The script is environment-agnostic — it reads Xpand and Tenfast from `.env` —
so the production import is the same command with production configuration.
The checklist, in order:

1. **Fresh output directory — this is the one hard rule.** `actions.csv` is
   the resume log and lease ids are identical across environments: pointing a
   production run at the test run's `--out` marks almost everything as already
   done. Use e.g. `--out ~/avtal112-prod-run`, and never mix environments in
   one directory.
2. **Point `.env` at production**: `TENFAST__BASE_URL`, `TENFAST__API_KEY`,
   `TENFAST__COMPANY_ID` for production Tenfast, and `XPAND_DATABASE__*` (host,
   port, user, password, database) at the production Xpand — mind that the
   tunnel on `localhost:11434` must go to the **prod** host.
3. **`--dry-run` first, and read the plan before uploading.** Sanity-check the
   counts against the test run (20,411 leases; ~15.5k planned main files, ~1k
   termination files) and especially `alreadyHadMainFile` /
   `terminationAlreadySet`: production Tenfast has its own signed contracts
   and SimpleSign termination documents, and those numbers are the skips
   protecting them. If they look implausibly low, stop.
4. **Run with `--max-failures 500`** (the test env threw intermittent gateway
   502s under sustained load, ~1–2/min; default 25 aborts within the hour) and
   keep the machine awake:

   ```sh
   caffeinate -i nohup pnpm run dev:script:sync-lease-documents -- \
     --out ~/avtal112-prod-run --max-failures 500 \
     > ~/avtal112-prod-run.log 2>&1 &
   ```

   Expect ~5.5 h at `--concurrency 4` (planning inspects a few thousand PDFs
   for ~10 min first, so early silence is normal).

5. **When it finishes, rerun the same command once** as a mop-up: failed rows
   are retried, interrupted deletions finish. A 502 sometimes lands after the
   file was stored — the mop-up sees it attached and skips it. Rerun until the
   remaining failures are explainable (in test: only leases whose rent rows
   Tenfast itself refuses to validate).
6. **Hand `oversized.csv` to Mimer** for manual import (39 documents >15 MB in
   test data), and keep the output directory — `actions.csv` and
   `contract-decisions.csv` are the audit trail of what was placed where and
   why.

## Flags

| Flag                 | Meaning                                                 |
| -------------------- | ------------------------------------------------------- |
| `--dry-run`          | Plan and report; send nothing to Tenfast                |
| `--out <dir>`        | Where the reports go (default `./sync-lease-documents`) |
| `--limit-leases <n>` | Only the first n leases                                 |
| `--leases <a,b>`     | Only these lease ids — testing, or re-running one lease |
| `--stages <a,b>`     | Only these Tenfast stages (default: every stage)        |
| `--concurrency <n>`  | Leases processed in parallel (default 4)                |
| `--max-failures <n>` | Abort after n failures (default 25; 0 disables)         |

## Where the documents come from

`DOKOP` with `CONTYPE = 4`, joined to `HYOBJ`. That is the real lease-to-document
coupling in Xpand.

`dorev.dok` looks like it holds a lease id and for some documents it does, but
the rest carry a timestamp like `20260810-09482447`, with the lease id buried in
the filename. Matching on `dok` misses about a third of the documents — an
earlier version of this work did exactly that. Don't go back to it.

## Choosing the contract

Nothing in Xpand marks a document as the signed contract. The document type is
the same for contracts, appendices and terminations; `DOKOP.LABELING` is empty
on all 39,965 rows; `SORTORDER` is 0 almost everywhere and identifies the
contract only ~39% of the time. So the name decides the category:

> contains `kontrakt` or `hyresavtal`, and none of `bilaga`, `uppsägning`,
> `beställning`, `förslag`, `anställning`, `köpe`, `samverkan`, `transport`,
> `nekad`/`nekat`

Both halves matter — without the rest of the exclusions, `Anställningsavtal`
and `Köpeavtal` would be uploaded as contracts. Contract names are
template-driven and concentrated — the top 5 cover 89% — but there is a tail
of ~500 one-offs like `Hyreskontrakt bil plats`.

**The `bilaga` exclusion has a second tier** (`isKontraktBilaga`). A document
titled `Hyreskontrakt för digital signering, Bilaga K` is usually not an
appendix: Mimer's Scrive flow signs the contract and its bilaga as **one PDF**
— page 1 is the full HYRESKONTRAKT — and Xpand titles it after the bilaga.
Every sampled bundle confirmed this. So when a lease has no contract-titled
document, its hyreskontrakt-titled bilagor become the candidates instead;
7,143 of the 10,460 "no contract" leases get their main file this way. A
contract-titled document always beats a bundle, and plain `Bilaga A` titles
without a contract word never qualify.

**A third tier catches scanned paper contracts** (`isObjektnummerTitle`): a
document titled with nothing but the lease's own object number is how manually
signed contracts get filed (municipal tenants, god man cases — 711 such leases
in test data, every sampled one an ink-signed contract scan). The name proves
nothing, so these always go through PDF inspection and qualify only as a scan
or with a signature — a plain unsigned rendering never becomes the main file.

When a lease has several candidates the PDFs break the tie, and only those
leases get opened:

1. **digitally signed** — carries a signature (`/ByteRange`, `adbe.pkcs7`)
2. **scanned** — no embedded fonts and at least one image, i.e. a photo of a
   signed paper contract. These have human-typed names, because a person
   uploaded them
3. otherwise the **newest**, on the reasoning that a later filing was deliberate

Signature presence separates a _final contract from its own drafts_. It does
**not** separate contracts from appendices — appendices are signed too — so it
is only ever used within one lease's candidates.

## Tenfast API behaviour worth knowing

Established by probing the test environment; none of it is in their Swagger.

- **`upload-file` replaces silently.** Called on a lease that already has a main
  file it returns 200 and stores a new object; the previous one is unreachable.
  There is no delete and no conflict check. **The `hasMainFile` skip is the only
  thing preventing overwrites** — including of Tenfast's own generated contracts.
- **`upload-file` with no file** returns `500 Cannot read properties of
undefined (reading 'key')` and changes nothing. An empty multipart body
  produced a 502. Always send a real file.
- **`upload-termination-file` behaves like `upload-file`**: accepts
  `terminated`-stage leases and replaces silently — re-uploading stored a new
  object under a new key, 200, no conflict check. The `hasTerminationFile`
  skip is the only overwrite protection, including for the termination
  documents Tenfast's own SimpleSign flow generates (`uppsagning.pdf`).
- **The termination file shows up in the listing as `cancellation.file`**
  (key + `originalName`), on every record even though no Swagger schema
  mentions it. `GET /avtal/{id}/termination-file-url` answers 200 with a
  signed url once set, `404 Uppsägningsdokumentet hittades inte` before.
- **`related-docs` appends**, never replaces. Uploading the same file twice
  gives two entries.
- **Deleting a related doc** needs the key's _second-to-last segment_ and the
  _stored hashed filename_, not the file's `_id` and display name:
  `DELETE /avtal/{id}/related-docs/6a96928e…cb500/xaujYd23….pdf`. Sending the
  `_id` returns `200 {}` and deletes nothing. See `relatedDocDeletePath`.
- **Filenames must go out as RFC 5987** (`filename*=UTF-8''…`). Tenfast decodes
  a plain `filename="…"` as latin-1, storing `Uppsägning` as `UppsÃ¤gning`,
  which also breaks the rerun matching below. Node's `FormData` does the wrong
  thing, which is why the multipart body is built by hand.
- **A page is capped at 100 records** whatever `limit` says, and `select=externalId`
  returns 500. Listing 20k leases is ~200 requests and ~40 seconds; it happens
  once per run, before anything is written.
- **15 MiB per file.** Rejected with `500 {"error":"Filen är för stor…"}`, so a
  size failure looks retryable by status alone — `isRetryableResponse` reads the
  body to avoid resending a 25 MB file three times.

## Output

| File                     | Contents                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `report.json`            | Counts for the run                                                                  |
| `dry-run.csv`            | Every planned upload (dry run only)                                                 |
| `contract-decisions.csv` | Every candidate on every contested lease, its traits, and which was chosen          |
| `actions.csv`            | What was uploaded or deleted; doubles as the resume log                             |
| `oversized.csv`          | Documents over 15 MiB, with `keydorev`/`dok` so they can be found for manual import |

## Reruns are safe

A rerun skips anything recorded as `uploaded` or `deleted` in `actions.csv`,
and skips documents already in Tenfast — matched on filename against the
related documents, the main file _and_ the termination file
(`cancellation.file.originalName`), so even a rerun with no resume log cannot
re-attach a document it already placed. The resume log still matters for one
thing: it proves the main or termination file is _ours_, which is what
authorises deleting the old `related-docs` copy of it — and if the run died
between an upload and that deletion, the rerun finishes it.

Verified two ways: reruns from a clean output directory upload 0, and
regenerating names for all 260 leases that carry documents matches every stored
name (0 unmatched). The only thing a rerun re-attempts is the oversized set,
which is refused by the size pre-check before any transfer.

Three details hold this together, each of which has been a bug at some point:

- **Matching the main file**, not just related docs. On a rerun the contract is
  no longer chosen for `upload-file` (the lease has one), so without this it
  falls through into `related-docs` and every rerun adds a duplicate.
- **Never `split(',')` over `actions.csv`.** Filenames contain commas
  (`Överlåtelseansökan för komplettering, P082667.pdf`), so a quoted field
  shifts every later column and a completed upload reads as unfinished — which
  for `upload-file` means silently replacing a contract. Use
  `completedKeyFromRow`.
- **Colliding filenames.** 711 leases hold several documents sharing one
  filename; each gets a `-{keydorev}` suffix so a resumed run cannot mistake one
  for another.

## Scale

|                     |                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------- |
| Documents to upload | 39,965 (~15,500 main files — 8,340 contract-titled + ~7,100 bundles — rest related) |
| Transfer            | ~35 GB                                                                              |
| Throughput          | ~1.5 documents/sec at `--concurrency 4`                                             |
| Full run            | **7–8 hours** at that rate                                                          |

Nothing suggests Tenfast rate-limits — 694 uploads at 4-way concurrency drew no
429s — but that isn't proof at 40k. Raising concurrency to 8–12 should roughly
halve the wall clock; watch the first minutes, and `--max-failures` plus resume
make backing off cheap.

## Measured against the test environment, 2026-09-07

These figures drift: the test environment is in use, and the lease count moved
from 20,392 to 20,411 over the days this was built. Run `--dry-run` for
current numbers before trusting any of them.

|                                        |                                                                       |
| -------------------------------------- | --------------------------------------------------------------------- |
| Tenfast leases                         | 20,411, every stage                                                   |
| Leases with documents                  | 18,807                                                                |
| Leases with a contract-titled document | 8,340                                                                 |
| Leases whose main file is a bundle     | 7,143                                                                 |
| Leases with no contract at all         | 3,309 (~16%)                                                          |
| Contested contract-titled leases       | 577 — 433 resolved by signature, 111 by scan, 28 by date (2026-09-02) |

For the 3,309 leases with nothing contract-shaped the main file is left empty
rather than filled with a key receipt. Note that the bundle tier makes many
more leases contested (a lease often holds both a Bilaga A and a Bilaga B
bundle), so the planning pass reads considerably more PDFs than the 577 above.

Of 151 main contracts uploaded during testing: 124 digitally signed, 15 scanned
paper, 8 **neither** — unsigned intermediate renderings, often ~0.1 MB against a
typical 0.8 MB. Those are the weakest picks. Roughly 5% of main contracts will
be in that category; `contract-decisions.csv` is where to audit them.

## Tests

`classification.test.ts` (naming rules, PDF traits, tie-break), `plan.test.ts`
(what goes where, termination routing, rerun skipping, filename collisions),
`tenfast-documents.test.ts` (RFC 5987 headers, delete path, retry policy, size
limit, termination endpoints), `index.test.ts` (argument parsing, resume-log
parsing, oversized report). 102 tests; none touch the network or a database.

```sh
pnpm --filter @onecore/leasing test src/scripts/sync-lease-documents
```

`download-lease-documents.ts` pulls every document for one lease to disk with
its category and traits — the fastest way to see what a lease actually holds:

```sh
ts-node src/scripts/sync-lease-documents/download-lease-documents.ts \
  --lease 705-727-00-0015/07 --out ./lease-docs
```
