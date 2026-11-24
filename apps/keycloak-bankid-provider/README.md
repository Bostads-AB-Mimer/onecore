# Mimer BankID identity provider for Keycloak

A Keycloak identity provider (the same SPI as "log in with Google") that logs tenants in with
BankID through **Mimer BankID**, Mimer's own transaction API in Azure (APIM in front, Entra
client credentials). Provider id `mimer-bankid`; the tenant realm uses it under the alias `bankid`.

## Flow

1. **Start** (`performLogin`): get an Entra token (cached per node and per identity provider
   instance until a minute before it expires, so realms never share one), `POST transactions` with `method: Auth`, the browser's IP as `endUserIp` and
   `…/broker/bankid/endpoint/return?state=…` as `redirectUrl`. The transaction id goes in an
   auth note, then the browser goes to the transaction's `accessUrl`.
2. **Back** (`GET …/endpoint/return`):
   1. Keycloak verifies `state`. Its own answers pass through unchanged, as in Keycloak's OAuth2
      brokers: a forged or expired `state` gets its error page, and a return URL reloaded after a
      finished login is redirected back to the app with `error=temporarily_unavailable`. A missing
      or unreadable `state` gets Keycloak's error page (502), never a raw 500.
   2. `transaction_id` must equal the auth note. The note is removed, so a transaction works once.
   3. The transaction is read again server side; the `success` query parameter is ignored. Only
      `method: Auth`, `status: Complete` and a 12-digit personnummer log in.
      `Cancelled`, or `Failed` with `UserCancel`, goes back to the login page as a cancel.
3. The personnummer becomes the brokered username. The realm's first-login flow links it to the
   existing user with that username.

Anything else (start fails, Mimer BankID down, 4xx/5xx, timeout, broken JSON, rejected
transaction, a missing setting or vault entry) ends in `callback.error(…, "bankidLoginFailed")`:
the login page with the message from `apps/keycloak-theme`. The plugin's own log lines carry
transaction ids, HTTP statuses, Entra error codes and exception types, never the personnummer.

### Keycloak's own logs do contain personnummer

The realm username is the personnummer, so Keycloak core logs it wherever it logs a username.
The case that happens in normal use: someone with BankID but no Keycloak user (not a tenant, or
not imported yet) logs in. Keycloak then logs
`ERROR IdpDetectExistingBrokerUserAuthenticator: The user <personnummer> should be already registered…`
and `WARN org.keycloak.events … IDENTITY_PROVIDER_FIRST_LOGIN_ERROR … identity_provider_identity="<personnummer>"`.
A logout logs it too, as
`WARN org.keycloak.services.managers.AuthenticationManager: Some clients have not been logged out for user <personnummer> in mimer-contacts realm: mina-sidor`.
That warning is not just noise: it means Keycloak could not log the `mina-sidor` client out, so
the tenant may still be signed in to Mina sidor after logging out of Keycloak. It has been seen on
auth.dev.mimer.nu; the cause (the client's logout URL, or the .NET API not answering it) is not
known yet. Fix that rather than hiding the warning.

The plugin cannot keep the personnummer out of these lines. For the two first-login lines it is
decided in the cluster's Keycloak config, for example by raising the level of those log
categories (`KC_LOG_LEVEL=INFO,<category>:<level>`; raising `org.keycloak.events` hides every
failed-login event, not just these) or by changing the realm's event listeners.

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

Every setting is required. `clientSecret` and `apimKey` must be `${vault.<key>}` references:
saving the provider (admin console, admin API or realm import) answers 400 otherwise, and a login
whose vault entry is missing fails with `vault key <key> not found` in the log instead of sending
the unresolved text to Entra or APIM. So Keycloak needs a vault (`KC_VAULT`) wherever this runs.

`endUserIp` is Keycloak's view of the browser's address. Behind Traefik that is only the browser
when Keycloak reads forwarded headers (`proxy-headers`), and then `proxy-trusted-addresses`
should list the proxy, so that a client-sent `X-Forwarded-For` is not taken as is.

## Build and test

Maven runs in Docker, so no local Java is needed. `pnpm run --filter @onecore/keycloak-bankid-provider`
with `build`, `test` or `test:e2e` (= `local/run.sh`); `lint`, `prettier` and `typecheck` are
no-ops for CI. By hand:

```sh
docker run --rm -v "$PWD":/src -v keycloak-bankid-provider-m2:/root/.m2 -w /src \
  maven:3.9-eclipse-temurin-21 mvn -B package
```

`mvn package` runs the unit tests and writes `target/mimer-bankid-provider.jar`. They cover the
transaction decision table, every branch of the return endpoint (with Keycloak mocked), the vault
lookup, the token cache and its 401 eviction, and the settings check.

`local/run.sh` is the end-to-end check: it builds the JAR, starts two clustered Keycloak nodes on
the same image and mode as auth.dev.mimer.nu, sets up a tenant realm against a stand-in for Entra
and Mimer BankID (`local/mock/server.mjs`), checks that a plaintext secret is refused on save, and
drives twelve login cases (`local/drive.py`): login, callback on the other node, cancel,
risk-blocked, unknown personnummer, replayed transaction, return URL reloaded after login, forged
state, Mimer BankID down at start, missing state, malformed state and missing vault entry. Each
case must end on one specific page or redirect. It exits non-zero otherwise and removes everything
afterwards (`--keep` leaves it running). It needs Docker, Node 22 and python3, and talks to no real
system.

`local/run.sh real <12-digit test personnummer>` does one real login against Mimer BankID TEST
with a test BankID from demo.bankid.com. It reads the MimerMinaSidor TEST settings read-only from
the epic environment's `webapi-secrets`, named by `BANKID_KUBE_NAMESPACE` (see the script header
for the other overrides, including a local
file for a new client secret), checks the client secret with Entra first, and prints a URL to
open. `local/run.sh down` stops it and deletes the local copies of the secrets.

`keycloak.version` in `pom.xml` must match the cluster's Keycloak. Rebuild and rerun
`local/run.sh` on every Keycloak upgrade: the broker SPI is not a stable public API.

## Image

CI builds `ghcr.io/bostads-ab-mimer/onecore/keycloak-bankid-provider` from `Dockerfile` (repo root
as context), like `apps/keycloak-theme`. The image holds only `/provider/mimer-bankid-provider.jar`
and runs as user 1001; used as an init container, its default command copies the JAR into
`/providers/`. The image build runs the unit tests.
