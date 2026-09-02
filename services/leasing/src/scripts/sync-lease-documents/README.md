# sync-lease-documents

Copies lease documents from Xpand into Tenfast (AVTAL-112): the signed contract
becomes the lease's main file, everything else is attached as a related
document. Reads Xpand, writes only to Tenfast.

```sh
pnpm run dev:script:sync-lease-documents -- --dry-run           # plan only, writes nothing
pnpm run dev:script:sync-lease-documents -- --limit-leases 5    # a handful, for real
pnpm run dev:script:sync-lease-documents -- --leases 104-071-06-0403/12
pnpm run dev:script:sync-lease-documents                        # the full run
```

Needs `XPAND_DATABASE__*` and `TENFAST__*` in `.env`; the Xpand host is reached
through a tunnel on `localhost:11434`, which is the first thing to check when
the script dies with `Failed to connect`.

## Status, as of 2026-09-02

The script is finished and verified against the test environment. **The full
run has not been done.** Two things are outstanding:

- **Waiting on Tenfast to add a POST for the termination document.** They have
  `GET /avtal/{id}/termination-file-url` but no way to set the file — only
  `related-docs`, `upload-file` and an unrelated rent-article import accept a
  file at all. Until then the Xpand `Uppsägning av …` PDFs (3,116 of them) land
  in `related-docs` and `termination-file-url` keeps returning
  `404 Uppsägningsdokumentet hittades inte`. When the endpoint lands, terminations
  should be routed there instead of to `related-docs`.
- **33 documents exceed Tenfast's 15 MiB limit** and will not be imported.
  Tenfast will not raise the cap; Mimer handles these manually. They are listed
  in `oversized.csv` on every run. All 33 are scanned application paperwork
  (`Godkänd överlåtelseansökan` and similar), **none is a contract**, so no
  lease loses its main document to this.

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

Both halves matter. Appendices are named `Hyreskontrakt … Bilaga A`, so without
the `bilaga` exclusion they'd be uploaded as contracts; without the rest,
`Anställningsavtal` and `Köpeavtal` would be. Contract names are template-driven
and concentrated — the top 5 cover 89% — but there is a tail of ~500 one-offs
like `Hyreskontrakt bil plats`.

When a lease has several candidates the PDFs break the tie, and only those
leases get opened (577 of 20,402):

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
| `actions.csv`            | What was uploaded; doubles as the resume log                                        |
| `oversized.csv`          | Documents over 15 MiB, with `keydorev`/`dok` so they can be found for manual import |

## Reruns are safe

A rerun skips anything recorded as `uploaded` in `actions.csv`, and skips
documents already in Tenfast — matched on filename against both the related
documents _and_ the main file.

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

|                     |                                          |
| ------------------- | ---------------------------------------- |
| Documents to upload | 39,965 (8,340 contracts, 31,625 related) |
| Transfer            | ~35 GB                                   |
| Throughput          | ~1.5 documents/sec at `--concurrency 4`  |
| Full run            | **7–8 hours** at that rate               |

Nothing suggests Tenfast rate-limits — 694 uploads at 4-way concurrency drew no
429s — but that isn't proof at 40k. Raising concurrency to 8–12 should roughly
halve the wall clock; watch the first minutes, and `--max-failures` plus resume
make backing off cheap.

## Measured against the test environment

|                                  |                                                          |
| -------------------------------- | -------------------------------------------------------- |
| Tenfast leases                   | 20,402, every stage                                      |
| Leases with documents            | 18,799                                                   |
| Leases with no documents at all  | 1,603                                                    |
| Leases with no contract document | 10,459 (53%)                                             |
| Contested leases                 | 577 — 433 resolved by signature, 111 by scan, 28 by date |

**Over half the leases have no contract document in Xpand.** For those the main
file is left empty rather than filled with an appendix or a key receipt. Many
hold `Bilaga A`/`Bilaga B` but not the contract they belong to — the signed PDF
simply isn't there.

Of 151 main contracts uploaded during testing: 124 digitally signed, 15 scanned
paper, 8 **neither** — unsigned intermediate renderings, often ~0.1 MB against a
typical 0.8 MB. Those are the weakest picks. Roughly 5% of main contracts will
be in that category; `contract-decisions.csv` is where to audit them.

## Tests

`classification.test.ts` (naming rules, PDF traits, tie-break), `plan.test.ts`
(what goes where, rerun skipping, filename collisions), `tenfast-documents.test.ts`
(RFC 5987 headers, delete path, retry policy, size limit), `index.test.ts`
(argument parsing, resume-log parsing, oversized report). 82 tests; none touch
the network or a database.

```sh
pnpm --filter @onecore/leasing test src/scripts/sync-lease-documents
```

`download-lease-documents.ts` pulls every document for one lease to disk with
its category and traits — the fastest way to see what a lease actually holds:

```sh
ts-node src/scripts/sync-lease-documents/download-lease-documents.ts \
  --lease 705-727-00-0015/07 --out ./lease-docs
```
