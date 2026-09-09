
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

The data quality of the production source is, for lack of better words, all over the place. 
The bulk of the application deals with making the unstructured information searchable and presentable.
For any meaningful testing, manual or automated, you will need a data set that is production-like. 

### Build

This module builds as both **cjs** and **esm**, serving as a pilot within the platform for moving away
from the legacy of **cjs**. The green-ness of the **esm** grass may have been over-advertised.

## Test setup

There are two types of automated tests:
- **Plain unit tests** that focus mainly on data transformation and inference.
- **End-to-End tests** that apply their own data sets to the database, start an application on a random port and perform HTTP requests.

#### de:apply-seed

This script will clean out the local database and apply the full data set from `seed.sql`.

This is useful for quickly adding data while testing in development mode, but running the test suite will 
clean out, repopulate and trim the database.

A number of end-to-end tests rely on a **known data set** so test failures are to be expected if you
modify the set in `seed.sql` for manual testing.

## Scripts

#### import-contact-relations

Imports the god man, förvaltare and annan fakturamottagare relations that live
in Xpand into the `contact_relation` table in the contacts database. Xpand is
only read. The script is idempotent and rerunnable: it converges the rows it
owns (`created_by = 'xpand-import'`) on what Xpand currently says, so it can be
run repeatedly to pick up the delta.

Rows created by anyone else are never modified, and one active row survives per
`(subject, related, role_type)` — an edge that already exists is not inserted
again.

Always dry-run first. It prints both connection targets before it writes
anything, which is the cheapest way to catch a half-edited environment:

```bash
pnpm dev:script:import-contact-relations --dry-run   # report only, writes nothing
pnpm dev:script:import-contact-relations             # write
```

A holder whose leases disagree about the recipient cannot be represented at
contact level. Those are left alone and written to
`contact-relations-conflicts-<timestamp>.csv` in the working directory (also on
a dry run, with a `dry-run-` marker) for manual handling. Previously imported
recipients for such a holder are kept, not deleted, and reported as "Skyddade".

If a run would soft-delete more than 20% of the rows it owns (and it owns at
least 10), it aborts before opening the transaction and asks for `--force`.
That case is far more often a wrong database than a real change in Xpand.

##### Running against a cluster namespace

The script runs locally against whatever the environment points at; it is not
part of the service image and is not scheduled. Two connections are needed, and
both are reached over tunnels you bring up yourself:

```bash
# contacts (write side) — the namespace database
kubectl port-forward -n <namespace> svc/mssql 15433:1433

# xpand (read side) — however you normally reach the Xpand database,
# by convention on localhost:11434
```

Pick a local port that is free (`lsof -nP -iTCP:15433 | grep LISTEN`); a port
already in use by something non-SQL produces a confusing "unexpected pre-login
response" rather than a connection error.

Credentials for the namespace database come from its own secret:

```bash
export CONTACTS_DATABASE__HOST=127.0.0.1
export CONTACTS_DATABASE__PORT=15433
export CONTACTS_DATABASE__DATABASE=contacts
export CONTACTS_DATABASE__USER="$(kubectl get secret contacts-secrets -n <namespace> \
  -o jsonpath='{.data.CONTACTS_DATABASE__USER}' | base64 -d)"
export CONTACTS_DATABASE__PASSWORD="$(kubectl get secret contacts-secrets -n <namespace> \
  -o jsonpath='{.data.CONTACTS_DATABASE__PASSWORD}' | base64 -d)"

pnpm dev:script:import-contact-relations --dry-run
```

Exported variables are the reliable way to override: `dotenv` never overwrites
an already-set `process.env` key, and this script loads dotenv twice (the
`-r dotenv/config` preload and `dotenv.config()` in `src/common/config.ts`), so
neither load can clobber what you set. In fish, use `set -x NAME value`.

Use a throwaway shell. If those variables linger, a later `pnpm dev` in the
same shell points the running service at that namespace.

`DOTENV_CONFIG_PATH=.env.epic pnpm dev:script:...` works too, but `.env` is
still loaded as a fallback, so the override file must define **all five**
`CONTACTS_DATABASE__*` keys — miss one and it silently reverts to the local
database.

##### Verifying a run

A second run immediately after the first should report `Nya rader: 0` and
`Oförändrade` equal to the row count — that is the idempotency check.

```sql
SELECT role_type, COUNT(*) AS n
FROM contact_relation
WHERE deleted_at IS NULL
GROUP BY role_type;
```

Avoid hand-editing rows the import owns: the next run reconciles against what
Xpand says and will "correct" them back.

## License

© 2026 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
