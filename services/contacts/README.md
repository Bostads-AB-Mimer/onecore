
# ONECore - Contacts Microservice

Microservice providing the canonical source of contact and customer data in the ONECore platform.

# Overview

## Service

The service provides:
 
- **/contacts** - The contacts API. Search for or retrieve contact data by wildcard, canonical ID, phone number, etc
- **/health** - Health and diagnostics endpoints
- **/swagger** - Swagger UI

## Application Architecture

### Inversion of Control

This module employs a simplistic variant of Inversion-of-Control to wire itself up, meaning that all collaborators
and dependencies are created up front and each module/layer is provided their required collaborators up front.

This enables:

- Any slice of the application can be used and tested in isolation without mock-gymnastics.
- No runaway import-with-side-effects, except for the application entry point.
- Firing up full application instances with granular control of configuration doesn't have to rely on global state

### Route schemas as code

Unlike the rest of the platform, at the time of writing, this application does not rely on **swagger-jsdoc** and
instead uses **koa-okapi-router** that allows defining Koa routes as schema objects that provide type-safety to the
Koa Context and servce as the source for generating the openapi.json/swagger.json.

### Data Source

This module defines a **ContactRepository** interface, of which one implementation exists - **xpand**.

Scripts are provided for creating replicas of the relevant xpand database tables for use with docker compose.

The data quality of the production source is, for lack of better words, all over the place. 
The bulk of the application deals with making the unstructured information searchable and presentable.
For any meaningful testing, manual or automated, you will need a data set that is production-like. 

See [Scripts for curating test data sets](#scripts-for-curating-test-data-sets).

### Build

This module builds as both **cjs** and **esm**, serving as a pilot within the platform for moving away
from the legacy of **cjs**. The green-ness of the **esm** grass may have been over-advertised.

## Test setup

There are two types of automated tests:
- **Plain unit tests** that focus mainly on data transformation and inference.
- **End-to-End tests** that apply their own data sets to the database, start an application on a random port and perform HTTP requests.

### Test Data Sets

The test data sets are based on real-world data that may be imported and sanitized/anonymized by the provided scripts.

The final test data used by End-to-end tests lives in a single file: [seed.sql](./.jest/sql/seed.sql).

This file contains **bare *INSERT* statements only** and is intentionally kept free of logic.
All structure, curation and modification of its contents is done via scripts.

To make this possible, seed.sql is annotated with comment delimiters that mark stable regions:

```sql

INSERT INTO cmtel (
-- BEGIN cmtel COLUMNS
  ...
-- END cmtel COLUMNS
)
VALUES
  -- BEGIN cmtel ROWS
    ...
  -- END cmtel ROWS
;

```

Scripts rely on these markers to safely clear, insert or replace specific sections without rewriting the file wholesale.
There should never be any need to manually edit this file.

### Scripts for curating test data sets

All scripts prefixed with `script:` will output usage syntax if invoked without arguments.

#### dev:apply-seed

This script will clean out the local database and apply the full data set from `seed.sql`.

This is useful for quickly adding data while testing in development mode, but running the test suite will 
clean out, repopulate and trim the database.

A number of end-to-end tests rely on a **known data set** so test failures are to be expected if you
modify the set in `seed.sql` for manual testing. Reverting back to the canonical curated set is easy and just a script away.

#### script:import-seed-contact - Importing contacts into seed.sql

Contacts are added to seed.sql via this script.

*Adding one or more contacts by script argument*:

```sh
$ pnpm script:import-seed-contact P081818 P222333
```

*Add a curated set of contact codes from file*:

```sh
$ pnpm script:import-seed-contact -f ./.jest/sql/source-cc.txt
```

*Removing all data from seed.sql*:

`script:import-seed-contact` does not check for duplicates, so applying a set from file
usually means that all rows must first be discarded.

This can be done in isolation with `-c`, or in combination with adding contacts:

```sh
$ pnpm script:import-seed-contact -c
$ pnpm script:import-seed-contact -c -f ./.jest/sql/source-cc.txt
$ pnpm script:import-seed-contact -c P081818 P222333
```


#### script:seed-source - Add a contact to a "seed source" file

Seed source files simply newline-separated plain text files containing a contact code on each row,
but for maintaining any semblance of overview and control over the data set, this script analyzes
the contacts before adding them and stores with a trailing comment:

```txt
P000040    ###  P | N FN LN ID | T(#:1) E      A(#:3  U:2  X:1)
P104662    ###  P | N FN LN ID | T(#:3) E(#:1) A(#:4  U:1  X:3)
P007378    ###  P | N FN LN ID | T(#:1) E(#:1) A(#:8  U:2  X:6)
```

*Adding one or more contacts by script argument*:

```
$ pnpm script:seed-contact add <file-name> <contact-code> [<contact-code> ...]

$ pnpm script:seed-contact add ./.jest/sql/source-cc.txt P081818 F414888
```

*Regenerating the seed source file*:

In case the formatting of "comment table" is adjusted, the entire file can be regenerated
to use the new format:

```
$ pnpm script:seed-contact update ./.jest/sql/source-cc.txt
```


#### script:sanitize - Manually test sanitization of contact details

Data sanitization happens automatically when contacts are imported to `seed.sql`, but individual
contact details can be processed with this script for quick verification and inspection.

```
$ pnpm script:sanitize p '070-78787878 (Sonen Nils)'

=> 070-12440092 (Pappa Knasen)
```

## License

© 2026 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
