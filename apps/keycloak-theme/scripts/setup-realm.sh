#!/usr/bin/env bash
# Creates a local "mimer-contacts" realm that uses the theme, on the Keycloak from docker-compose.yml.
# Recreates it from scratch on every run. Local only: never point KC at a shared Keycloak.
#   Login page: http://localhost:18080/realms/mimer-contacts/account  (198501011236 / Test1234!)
#   Mail (password reset): http://localhost:18025
set -euo pipefail
KC=http://localhost:18080
R=mimer-contacts
OUT=$(mktemp)
trap 'rm -f "$OUT"' EXIT

echo "== waiting for Keycloak"
up=
for _ in $(seq 1 60); do curl -sf -o /dev/null "$KC/realms/master" && up=1 && break; sleep 2; done
if [[ -z $up ]]; then echo "Keycloak did not come up on $KC (docker compose logs keycloak)" >&2; exit 1; fi

tok() { curl -sf -d client_id=admin-cli -d username=admin -d password=admin -d grant_type=password \
  "$KC/realms/master/protocol/openid-connect/token" | jq -r .access_token; }
api() { # method path [json]
  local m=$1 p=$2 code; shift 2
  code=$(curl -sS -o "$OUT" -w '%{http_code}' -X "$m" -H "Authorization: Bearer $(tok)" \
    -H 'content-type: application/json' "$KC/admin/realms$p" ${1:+-d "$1"})
  if [[ $code -ge 300 ]]; then echo "FAILED $m $p -> $code: $(cat "$OUT")" >&2; exit 1; fi
}

echo "== realm"
for r in $R fake-bankid; do curl -s -o /dev/null -X DELETE -H "Authorization: Bearer $(tok)" "$KC/admin/realms/$r" || true; done
# Swedish only: one supported locale hides the language picker. Internationalization must stay
# enabled, otherwise Keycloak falls back to English instead of the default locale.
api POST "" '{
  "realm": "mimer-contacts", "enabled": true,
  "registrationAllowed": false, "resetPasswordAllowed": true, "rememberMe": false, "loginWithEmailAllowed": false,
  "loginTheme": "mimer", "internationalizationEnabled": true, "supportedLocales": ["sv"], "defaultLocale": "sv",
  "smtpServer": {"host": "mailpit", "port": "1025", "from": "noreply@mimer.example.test", "fromDisplayName": "Mimer"}
}'

echo "== test user"
api POST "/$R/users" '{"username": "198501011236", "enabled": true, "email": "test@mimer.example.test",
  "emailVerified": true, "firstName": "Test", "lastName": "Hyresgäst",
  "credentials": [{"type": "password", "value": "Test1234!", "temporary": false}]}'

echo "== fake BankID (an identity provider whose alias contains \"bankid\" gets the BankID button)"
api POST "" '{"realm": "fake-bankid", "enabled": true}'
api POST "/fake-bankid/clients" "{\"clientId\": \"mimer-broker\", \"publicClient\": false, \"secret\": \"broker-secret\",
  \"standardFlowEnabled\": true, \"redirectUris\": [\"$KC/realms/$R/broker/bankid/endpoint\"]}"
api POST "/$R/identity-provider/instances" "{
  \"alias\": \"bankid\", \"displayName\": \"Mobilt BankID / BankID\", \"providerId\": \"oidc\", \"enabled\": true,
  \"config\": {\"authorizationUrl\": \"$KC/realms/fake-bankid/protocol/openid-connect/auth\",
    \"tokenUrl\": \"$KC/realms/fake-bankid/protocol/openid-connect/token\",
    \"clientId\": \"mimer-broker\", \"clientSecret\": \"broker-secret\", \"clientAuthMethod\": \"client_secret_post\",
    \"defaultScope\": \"openid\"}}"

echo "done: $KC/realms/$R/account"
