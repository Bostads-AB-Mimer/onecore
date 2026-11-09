#!/usr/bin/env bash
# Creates a local "mimer-contacts" realm that uses the theme, on the Keycloak from docker-compose.yml.
# Recreates it from scratch on every run. Local only: never point KC at a shared Keycloak.
#   Login page: http://localhost:18080/realms/mimer-contacts/account  (198501011236 / Test1234!)
#   Mail (password reset, set password): http://localhost:18025
#   Clients as core uses them (config auth.keycloak.contacts): mina-sidor / mina-sidor-secret and
#   mimer-contacts-provisioning / provisioning-secret, with Mina sidor (and the set-password
#   link's redirect URI) at http://localhost:3000/
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
# Duplicate e-mails allowed: people in one household register with a shared address, and
# Keycloak's default refuses the second user. Safe because login by e-mail is off.
api POST "" '{
  "realm": "mimer-contacts", "enabled": true,
  "registrationAllowed": false, "resetPasswordAllowed": true, "rememberMe": false, "loginWithEmailAllowed": false,
  "duplicateEmailsAllowed": true,
  "loginTheme": "mimer", "emailTheme": "mimer",
  "internationalizationEnabled": true, "supportedLocales": ["sv"], "defaultLocale": "sv",
  "smtpServer": {"host": "mailpit", "port": "1025", "from": "noreply@mimer.example.test", "fromDisplayName": "Mimer"}
}'

echo "== user profile (attributes missing from it are dropped when a user is saved)"
api GET "/$R/users/profile"
# As in the dev realm: users are created with only a username (and, at registration, an
# e-mail), so names and e-mail are optional. Required, Keycloak would stop a new user at an
# "update profile" page after they choose their password.
api PUT "/$R/users/profile" "$(jq '(.attributes[] | select(.name == "email" or .name == "firstName" or .name == "lastName")) |= del(.required)
  | .attributes += [
  {"name": "contact_code", "displayName": "Kontaktkod", "multivalued": false,
   "permissions": {"view": [], "edit": ["admin"]}},
  {"name": "account_type", "displayName": "Kontotyp", "multivalued": false,
   "permissions": {"view": [], "edit": ["admin"]},
   "validations": {"options": {"options": ["person", "company"]}}}]' "$OUT")"

echo "== clients"
# The OIDC client of Mina sidor. Core's set-password e-mail ends on one of its redirect URIs.
# Its tokens carry the contact_code claim, single-valued, which core reads at login. Without
# the mapper core would "repair" contact_code on every login and the claim would still be missing.
api POST "/$R/clients" '{"clientId": "mina-sidor", "publicClient": false, "secret": "mina-sidor-secret",
  "standardFlowEnabled": true, "directAccessGrantsEnabled": false,
  "redirectUris": ["http://localhost:3000/*"], "webOrigins": ["http://localhost:3000"],
  "attributes": {"pkce.code.challenge.method": "S256"},
  "protocolMappers": [{"name": "contact_code", "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-attribute-mapper",
    "config": {"user.attribute": "contact_code", "claim.name": "contact_code", "jsonType.label": "String",
      "multivalued": "false", "access.token.claim": "true", "id.token.claim": "true",
      "userinfo.token.claim": "true"}}]}'
# Core's admin client: reads users and sets contact_code at login, creates users and sends the
# set-password e-mail at registration.
api POST "/$R/clients" '{"clientId": "mimer-contacts-provisioning", "publicClient": false,
  "secret": "provisioning-secret", "serviceAccountsEnabled": true, "standardFlowEnabled": false,
  "directAccessGrantsEnabled": false}'
api GET "/$R/clients?clientId=mimer-contacts-provisioning"
provisioning=$(jq -r '.[0].id' "$OUT")
api GET "/$R/clients/$provisioning/service-account-user"
service_user=$(jq -r .id "$OUT")
api GET "/$R/clients?clientId=realm-management"
realm_management=$(jq -r '.[0].id' "$OUT")
roles='[]'
for role in view-users manage-users; do
  api GET "/$R/clients/$realm_management/roles/$role"
  roles=$(jq --slurpfile r "$OUT" '. + $r' <<<"$roles")
done
api POST "/$R/users/$service_user/role-mappings/clients/$realm_management" "$roles"

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
