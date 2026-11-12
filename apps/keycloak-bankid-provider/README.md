# Mimer BankID identity provider for Keycloak

A Keycloak identity provider (the same SPI as "log in with Google") that logs tenants in with
BankID through **Mimer BankID**, Mimer's own transaction API in Azure (APIM in front, Entra
client credentials). Provider id `mimer-bankid`; the tenant realm uses it under the alias `bankid`.

## Flow

1. **Start** (`performLogin`): get an Entra token (cached per node until a minute before it
   expires), `POST transactions` with `method: Auth`, the browser's IP as `endUserIp` and
   `…/broker/bankid/endpoint/return?state=…` as `redirectUrl`. The transaction id goes in an
   auth note, then the browser goes to the transaction's `accessUrl`.
2. **Back** (`GET …/endpoint/return`):
   1. Keycloak verifies `state` and shows its own error page if it is wrong.
   2. `transaction_id` must equal the auth note. The note is removed, so a transaction works once.
   3. The transaction is read again server side; the `success` query parameter is ignored. Only
      `method: Auth`, `status: Complete` and a 12-digit personnummer log in.
      `Cancelled`, or `Failed` with `UserCancel`, goes back to the login page as a cancel.
3. The personnummer becomes the brokered username. The realm's first-login flow links it to the
   existing user with that username.

Anything else (start fails, Mimer BankID down, 4xx/5xx, timeout, broken JSON, rejected
transaction) ends in `callback.error(…, "bankidLoginFailed")`: the login page with the message
from `apps/keycloak-theme`. Logs carry transaction ids, HTTP statuses and Entra error codes,
never the personnummer.

The callback needs its own `@Path`: a bare `@GET` on `/endpoint` answers 405 in Keycloak 26.3.3.

## Configuration (identity provider settings)

| Setting        | Example                                                        |
| -------------- | -------------------------------------------------------------- |
| `gatewayUrl`   | Transaction API base URL, ending in `/api/`                    |
| `tokenUrl`     | `https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token` |
| `clientId`     | The Entra app registration of the calling identity             |
| `scope`        | The Mimer BankID API's `…/.default` scope                      |
| `clientSecret` | `${vault.bankid-client-secret}`                                |
| `apimKey`      | `${vault.bankid-apim-key}`                                     |

Secrets are read through Keycloak's vault, never stored in the realm.

## Build and test

Maven in Docker, so no local Java is needed:

```sh
docker run --rm -v "$PWD":/src -v keycloak-bankid-provider-m2:/root/.m2 -w /src \
  maven:3.9-eclipse-temurin-21 mvn -B package
```

`mvn package` runs the unit tests (`TransactionCheckTest`) and writes
`target/mimer-bankid-provider.jar`.

`local/run.sh` is the end-to-end check: it builds the JAR, starts two clustered Keycloak nodes on
the same image and mode as auth.dev.mimer.nu, sets up a tenant realm against a stand-in for Entra
and Mimer BankID (`local/mock/server.mjs`), and drives nine login cases (`local/drive.py`): login,
callback on the other node, cancel, risk-blocked, unknown personnummer, replayed transaction,
reused callback, forged state, and Mimer BankID down at start. It exits non-zero if any case ends
in the wrong place and removes everything afterwards (`--keep` leaves it running). It needs Docker,
Node 22 and python3, and talks to no real system.

`keycloak.version` in `pom.xml` must match the cluster's Keycloak. Rebuild and rerun
`local/run.sh` on every Keycloak upgrade: the broker SPI is not a stable public API.
