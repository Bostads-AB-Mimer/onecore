# Tenfast API — endpoints we use

Authoritative spec: **https://tenfast-test-api.mimer.nu/docs/** (OpenAPI 3, OpenAPI spec is inlined in `/docs/swagger-ui-init.js`).

This file is a curated index of the endpoints that matter for **lease sync from xpand**. For anything else, read the Swagger UI — the full API has 300+ endpoints across landlord/tenant/contractor/public scopes.

## Connection

- **Base URL**: `config.tenfast.baseUrl` (test: `https://tenfast-test-api.mimer.nu`)
- **Auth**: `api-token: <jwt>` header (long-lived API key)
- **Scoping**: most landlord endpoints take `?hyresvard=<companyId>` (`config.tenfast.companyId`)
- All dates are `YYYY-MM-DD` strings
- Error shape: `{ "error": "<swedish message>", "status": <code> }`

## Lookup by xpand identifier — `Hyresvard - Extra`

Use these to resolve an xpand id to a Tenfast object before mutating.

| Method | Path | What |
|---|---|---|
| GET | `/v1/hyresvard/extras/avtal/{externalId}?hyresvard=<co>&populate=hyresgaster,hyresobjekt` | Lease by xpand leaseId (URL-encode the `/`) |
| GET | `/v1/hyresvard/extras/hyresobjekt/{externalId}?hyresvard=<co>` | Rental object by xpand code |
| GET | `/v1/hyresvard/extras/hyresgaster/{externalId}?hyresvard=<co>` | Tenant by xpand contactCode |
| POST | `/v1/hyresvard/extras/hyresobjekt/batch-get?hyresvard=<co>&includeAvtal=signed` | Batch rental object lookup |
| PATCH | `/v1/hyresvard/extras/avtal/{externalId}/rows?hyresvard=<co>` | **Add/delete rent rows on a lease — works on signed leases.** |

## Leases — `Hyresvard - Avtal`

### Read

| Method | Path |
|---|---|
| GET | `/v1/hyresvard/avtal/{id}` |
| GET | `/v1/hyresvard/avtal?hyresvard=<co>&populate=hyresobjekt,hyresgaster&limit=<n>` |
| GET | `/v1/hyresvard/avtal/search?hyresvard=<co>&<filters>` |
| GET | `/v1/hyresvard/avtal/{id}/hyror` — rent rows for a contract |
| GET | `/v1/hyresvard/avtal/{id}/transactions` |
| GET | `/v1/hyresvard/avtal/{id}/logs` |
| GET | `/v1/hyresvard/avtal/{id}/file-url` — signed URL for the main contract pdf |
| GET | `/v1/hyresvard/avtal/{id}/termination-file-url` — signed URL for the termination document |
| POST | `/v1/hyresvard/avtal/exists` — check existence |

### Create

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/hyresvard/avtal?hyresvard=<co>` | See `buildLeaseRequestData` (`tenfast-adapter.ts`). Required fields include `hyresgaster`, `hyresobjekt`, `hyror`, `startDate`, `aviseringsTyp`, `uppsagningstid`, `template`, `method`. |

### Update — **the signed-state matters**

The general PATCH refuses *any* edit (even an empty body `{}`) once `signed: true` is on the lease. Use the dedicated endpoints below for signed leases.

| Method | Path | Body | Works on signed? |
|---|---|---|---|
| PATCH | `/v1/hyresvard/avtal/{id}?hyresvard=<co>` | Anything: `hyror`, `stage`, `endDate`, `cancellation`, tags, comments… | **No.** 400 `Avtalet är signerat och kan inte redigeras` for any payload, including `{}`. |
| PATCH | `/v1/hyresvard/avtal/{id}/void?hyresvard=<co>` | `{}` | **No.** Voids unsigned leases. 400 `Avtalet kan bara makuleras innan det är signerat.` when signed. |
| POST | `/v1/hyresvard/avtal/{id}/terminate?hyresvard=<co>` | `{ "endDate": "YYYY-MM-DD" }` | **Yes.** Sets `stage: terminated`, `endDate`, and `cancellation: { cancelled: true, doneAutomatically: true, requested: true }`. Body **must** use `endDate` exactly — `terminationDate` / `lastDebitDate` / `date` are rejected. Returns 400 `Avtalet kan inte sägas upp` if already terminated. |
| POST | `/v1/hyresvard/avtal/{id}/new-version?hyresvard=<co>` | (see Swagger) | **Yes.** Creates a new (unsigned) version of a signed lease — the normal path for changes to a signed contract that need to be re-signed. |
| POST | `/v1/hyresvard/avtal/{id}/archive?hyresvard=<co>` | (see Swagger) | Archive a lease. |
| PATCH | `/v1/hyresvard/avtal/{id}/handle-termination?hyresvard=<co>` | (see Swagger) | Mark a termination as handled. |
| PATCH | `/v1/hyresvard/avtal/{id}/manually-sign?hyresvard=<co>` | (see Swagger) | Mark a lease as manually signed (used when signing happened outside Tenfast — e.g. when importing already-signed contracts). |
| PATCH | `/v1/hyresvard/avtal/{id}/manually-rescind?hyresvard=<co>` | (see Swagger) | Manually rescind. |
| PATCH | `/v1/hyresvard/avtal/{id}/send-simplesign?hyresvard=<co>` | (see Swagger) | Send the lease to SimpleSign for the tenant to sign. |
| PATCH | `/v1/hyresvard/avtal/{id}/send-simplesign-termination?hyresvard=<co>` | `{ endDate, cancelledByType, reason, preferredMoveOutDate? }` | Initiate a SimpleSign termination request to the tenant. 400 `En eller flera hyresgäster saknar en giltig e-postadress` if tenant lacks an email. |
| DELETE | `/v1/hyresvard/avtal/{id}?hyresvard=<co>` | — | Delete a contract. |

## Tenants — `Hyresvard - Hyresgaster` (+ Hyresvard scope)

| Method | Path |
|---|---|
| GET | `/v1/hyresvard/hyresgaster` |
| GET | `/v1/hyresvard/hyresgaster/search?filter[externalId]=<contactCode>` |
| GET | `/v1/hyresvard/hyresgaster/{id}` |
| POST | `/v1/hyresvard/hyresgaster/?hyresvard=<co>` |
| PATCH | `/v1/hyresvard/hyresgaster/{id}?hyresvard=<co>` |
| DELETE | `/v1/hyresvard/hyresgaster/{id}?hyresvard=<co>` |
| GET | `/v1/hyresvard/hyresgaster/{id}/avtal?populate=hyresobjekt,hyresgaster` |
| GET | `/v1/hyresvard/hyresgaster/with-email/{email}` |

## Rental objects — `Hyresvard - Hyresobjekt`

| Method | Path |
|---|---|
| GET | `/v1/hyresvard/hyresobjekt` |
| GET | `/v1/hyresvard/hyresobjekt/search?filter[externalId]=<code>` |
| GET | `/v1/hyresvard/hyresobjekt/{id}` |
| GET | `/v1/hyresvard/hyresobjekt/{id}/avtal?populate=hyresobjekt,hyresgaster` |
| PATCH | `/v1/hyresvard/hyresobjekt/{id}?hyresvard=<co>` |

## Templates — `Hyresvard - Avtalsmallar`

| Method | Path |
|---|---|
| GET | `/v1/hyresvard/avtalsmallar/` |
| GET | `/v1/hyresvard/avtalsmallar/{id}` |

## Gotchas

- The `extras/avtal/{externalId}` family takes the xpand `leaseId` (e.g. `211-021-09-0101/08`) URL-encoded. The non-`extras` variants take the Tenfast Mongo `_id`.
- v1 of the API mixes English and Swedish field names. v2 will be all English; v1 won't be renamed. (Per Tenfast docs.)
- Specific Swedish error strings we map to typed errors in `tenfast-adapter.ts` — keep that mapping in sync if Tenfast rewords them.

## Open questions / not yet explored

- **Modifying rent rows on a signed lease**: `PATCH /v1/hyresvard/extras/avtal/{externalId}/rows` is the documented path — request shape not yet probed here. Worth confirming before we extend the sync to push hyror updates.
- **`POST /avtal/{id}/new-version`** request shape for our use case (updating tenant info / rent on a signed lease without termination) hasn't been exercised.
