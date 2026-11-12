#!/usr/bin/env bash
# End-to-end check of the plugin against a stand-in for Entra + Mimer BankID (mock/server.mjs):
# builds the JAR, starts two clustered Keycloak nodes (docker-compose.yml), sets up a tenant realm
# with the BankID identity provider, runs the login cases in drive.py and tears everything down.
#
#   ./run.sh          run the cases, then stop and remove everything
#   ./run.sh --keep   leave Keycloak (http://localhost:18081, admin/admin) and the mock running
#   ./run.sh down     stop and remove what --keep left behind
#
# Needs Docker, Node 22 and python3. Nothing here talks to a real Mimer BankID or any cluster.
set -euo pipefail
cd "$(dirname "$0")"

MOCK_PID_FILE=vault/.mock.pid

down() {
  docker compose down -v >/dev/null 2>&1 || true
  [[ -f $MOCK_PID_FILE ]] && kill "$(cat $MOCK_PID_FILE)" 2>/dev/null || true
  rm -rf vault
}

if [[ "${1:-}" == "down" ]]; then
  down
  echo "Stopped."
  exit 0
fi
KEEP=$([[ "${1:-}" == "--keep" ]] && echo 1 || echo 0)
[[ $KEEP == 1 ]] || trap down EXIT

echo "Building the plugin (also runs the unit tests)"
docker run --rm -v "$PWD/..":/src -v keycloak-bankid-provider-m2:/root/.m2 -w /src \
  maven:3.9-eclipse-temurin-21 mvn -q -B package

# Keycloak's file vault reads ${vault.<key>} from <realm>_<key>. Values are what the mock expects.
mkdir -p vault && chmod 700 vault
printf 'secret-from-vault' > vault/mimer-contacts_bankid-client-secret
printf 'apim-from-vault' > vault/mimer-contacts_bankid-apim-key
chmod 644 vault/mimer-contacts_*

node mock/server.mjs > vault/mock.log 2>&1 &
echo $! > $MOCK_PID_FILE
disown

wait_up() { # service port
  for _ in $(seq 1 100); do
    [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$2/realms/master")" == 200 ]] && return 0
    sleep 3
  done
  echo "$1 did not come up:"; docker compose logs --tail 20 "$1"; exit 1
}

# One node at a time: two nodes bootstrapping an empty database at once fail with
# "Session not bound to a realm".
echo "Starting Keycloak node 1"
docker compose up -d keycloak 2>/dev/null
wait_up keycloak 18081
echo "Starting Keycloak node 2"
docker compose up -d keycloak2 2>/dev/null
wait_up keycloak2 18082

K=http://localhost:18081
T=$(curl -s $K/realms/master/protocol/openid-connect/token -d grant_type=password -d client_id=admin-cli \
  -d username=admin -d password=admin | jq -r .access_token)
auth=(-H "Authorization: Bearer $T" -H 'Content-Type: application/json')
api() { # method path [json]
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "${auth[@]}" -X "$1" "$K/admin/realms$2" ${3:+-d "$3"})
  [[ $code == 2* ]] || { echo "admin API $1 $2 answered $code"; exit 1; }
}

# Tenant realm as on auth.dev.mimer.nu: usernames are personnummer, no names required.
api POST "" '{"realm":"mimer-contacts","enabled":true,"sslRequired":"none"}'
curl -s "${auth[@]}" $K/admin/realms/mimer-contacts/users/profile \
  | jq '.unmanagedAttributePolicy = null
        | .attributes |= map(select(.name != "firstName" and .name != "lastName"))
        | .attributes |= map(if .name == "email" then del(.required) else . end)' \
  | curl -s -o /dev/null "${auth[@]}" -X PUT $K/admin/realms/mimer-contacts/users/profile -d @-
api POST /mimer-contacts/clients \
  '{"clientId":"mina-sidor","publicClient":true,"standardFlowEnabled":true,"redirectUris":["http://localhost:3000/*"]}'

# First broker login: only link to an existing user with the same username, never create one.
api POST /mimer-contacts/authentication/flows '{"alias":"bankid-first-login","providerId":"basic-flow","topLevel":true,"builtIn":false}'
for p in idp-detect-existing-broker-user idp-auto-link; do
  api POST /mimer-contacts/authentication/flows/bankid-first-login/executions/execution "{\"provider\":\"$p\"}"
done
curl -s "${auth[@]}" $K/admin/realms/mimer-contacts/authentication/flows/bankid-first-login/executions \
  | jq -c '.[] | .requirement = "REQUIRED"' \
  | while read -r e; do api PUT /mimer-contacts/authentication/flows/bankid-first-login/executions "$e"; done

# host.docker.internal: Keycloak runs in Docker and calls the mock on the host.
api POST /mimer-contacts/identity-provider/instances '{
  "alias":"bankid","displayName":"BankID","providerId":"mimer-bankid","enabled":true,
  "trustEmail":false,"storeToken":false,"firstBrokerLoginFlowAlias":"bankid-first-login",
  "config":{"syncMode":"IMPORT",
    "gatewayUrl":"http://host.docker.internal:4010/api/",
    "tokenUrl":"http://host.docker.internal:4010/oauth2/v2.0/token",
    "clientId":"mimer-minasidor-test","scope":"api://mimer-bankid/.default",
    "clientSecret":"${vault.bankid-client-secret}","apimKey":"${vault.bankid-apim-key}"}}'
api POST /mimer-contacts/users '{"username":"199001011234","enabled":true}'

echo
python3 -I drive.py

if [[ $KEEP == 1 ]]; then
  echo
  echo "Still running. Keycloak: $K (admin/admin), mock log: local/vault/mock.log. Stop with ./run.sh down"
fi
