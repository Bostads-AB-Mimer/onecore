#!/usr/bin/env bash
# Local checks of the plugin on the same Keycloak image and mode as auth.dev.mimer.nu.
#
#   ./run.sh                 mock: nine login cases against a stand-in for Entra + Mimer BankID
#                            (mock/server.mjs) on two clustered nodes, then remove everything
#   ./run.sh --keep          same, but leave Keycloak (http://localhost:18081, admin/admin) and the mock running
#   ./run.sh real <pnr>      one real BankID login against Mimer BankID TEST; prints a URL to open
#   ./run.sh down            stop everything and delete the vault files (always run this after `real`)
#
# Starting refuses while an earlier run (`--keep` or `real`) is still up; run `down` first.
#
# Mock mode needs Docker, Node 22 and python3 and talks to no real system.
#
# Real mode needs a test BankID (demo.bankid.com) for <pnr> in the BankID app's test mode, and
# reads the Mimer BankID TEST settings (read-only) from the webapi secret in the epic environment.
# Those are Mina sidor's client; Keycloak's own client is used by overriding the three below:
#   BANKID_KUBE_CONTEXT    default onecore-dev
#   BANKID_KUBE_NAMESPACE  default epic-mim-2086
#   BANKID_CLIENT_ID       Entra client id; default: the cluster's BankIdConfiguration__ClientId
#   BANKID_SECRET_FILE     default ~/.config/mimer/bankid-test-client-secret; when it exists, the client
#                          secret comes from this file instead of the cluster
#   BANKID_APIM_KEY_FILE   default ~/.config/mimer/bankid-test-apim-key; when it exists, the APIM
#                          subscription key comes from this file instead of the cluster
# Secrets only ever land in local/vault/ (git-ignored), which `down` deletes. Nothing is written to the cluster.
set -euo pipefail
cd "$(dirname "$0")"

MOCK_PID_FILE=vault/.mock.pid
K=http://localhost:18081

down() {
  docker compose down -v >/dev/null 2>&1 || true
  [[ -f $MOCK_PID_FILE ]] && kill "$(cat $MOCK_PID_FILE)" 2>/dev/null || true
  rm -rf vault
}

MODE=mock KEEP=0
case "${1:-}" in
  down) down; echo "Stopped, vault files deleted."; exit 0 ;;
  --keep) KEEP=1 ;;
  real)
    MODE=real KEEP=1
    PNR="${2:?usage: ./run.sh real <12-digit test personnummer>}"
    [[ "$PNR" =~ ^[0-9]{12}$ ]] || { echo "personnummer must be 12 digits"; exit 1; }
    ;;
  "") ;;
  *) echo "usage: ./run.sh [--keep | real <pnr> | down]"; exit 1 ;;
esac

# Checked before the trap below is set: a start that fails half-way would otherwise run `down`
# and take the earlier run, which someone may still be testing in, down with it.
if [[ -n "$(docker compose ps -q 2>/dev/null)" || -f $MOCK_PID_FILE ]]; then
  echo "A previous run is still up. Stop it first with: ./run.sh down"
  exit 1
fi
for port in 18081 18082 4010; do
  if (: </dev/tcp/127.0.0.1/$port) 2>/dev/null; then
    echo "Port $port is already in use by something else; free it and try again."
    exit 1
  fi
done

# On failure the real secrets must not stay behind either, so only a successful `real` keeps running
trap 'status=$?; [[ $KEEP == 1 && $status == 0 ]] || down' EXIT

mkdir -p vault && chmod 700 vault
# Keycloak's file vault reads ${vault.<key>} from <realm>_<key>.
SECRET_VAULT=vault/mimer-contacts_bankid-client-secret
APIM_VAULT=vault/mimer-contacts_bankid-apim-key

if [[ $MODE == real ]]; then
  CTX=${BANKID_KUBE_CONTEXT:-onecore-dev}
  NS=${BANKID_KUBE_NAMESPACE:-epic-mim-2086}
  SECRET_FILE=${BANKID_SECRET_FILE:-$HOME/.config/mimer/bankid-test-client-secret}
  APIM_KEY_FILE=${BANKID_APIM_KEY_FILE:-$HOME/.config/mimer/bankid-test-apim-key}
  val() { kubectl --context "$CTX" -n "$NS" get secret webapi-secrets -o "jsonpath={.data.BankIdConfiguration__$1}" | base64 -d; }

  echo "Reading Mimer BankID TEST settings from $CTX/$NS webapi-secrets"
  GATEWAY_URL=$(val ApiUrl)
  AUTHORITY=$(val Authority)
  CLIENT_ID=${BANKID_CLIENT_ID:-$(val ClientId)}
  echo "Client id: $CLIENT_ID"
  SCOPE=$(val Scopes | cut -d, -f1)
  A=${AUTHORITY%/}
  TOKEN_URL=$([[ $A == */oauth2/v2.0/token ]] && echo "$A" || echo "$A/oauth2/v2.0/token")
  if [[ -s $APIM_KEY_FILE ]]; then
    echo "APIM key: $APIM_KEY_FILE"
    ( umask 077; tr -d '\r\n' < "$APIM_KEY_FILE" > $APIM_VAULT )
  else
    echo "APIM key: cluster (no $APIM_KEY_FILE)"
    ( umask 077; val OcpApimSubscriptionKey > $APIM_VAULT )
  fi
  if [[ -s $SECRET_FILE ]]; then
    echo "Client secret: $SECRET_FILE"
    ( umask 077; tr -d '\r\n' < "$SECRET_FILE" > $SECRET_VAULT )
  else
    echo "Client secret: cluster (no $SECRET_FILE)"
    ( umask 077; val Secret > $SECRET_VAULT )
  fi

  # Fail fast before waiting for Keycloak. Secrets are read from files by curl, so they never appear
  # on a command line; only HTTP statuses and the AADSTS code are shown.
  echo "Checking the client secret with Entra"
  resp=$(curl -s -w '\n%{http_code}' "$TOKEN_URL" -d grant_type=client_credentials \
    --data-urlencode "client_id=$CLIENT_ID" --data-urlencode "scope=$SCOPE" \
    --data-urlencode "client_secret@$SECRET_VAULT")
  code=$(tail -n1 <<<"$resp")
  if [[ $code != 200 ]]; then
    aad=$(sed '$d' <<<"$resp" | jq -r '.error_description // ""' 2>/dev/null | grep -o 'AADSTS[0-9]*' | head -1 || true)
    echo "Entra rejected the client credentials: HTTP $code ${aad:-}"
    exit 1
  fi
  echo "Entra accepted the client secret"

  # Reading a transaction that does not exist proves the rest without creating anything:
  # 404 = token, role Transaction.Read, ValidClients entry and APIM key all accepted.
  echo "Checking access to Mimer BankID"
  token=$(sed '$d' <<<"$resp" | jq -r .access_token)
  code=$(curl -s -o /dev/null -w '%{http_code}' -H @- \
    "${GATEWAY_URL%/}/transactions/00000000-0000-0000-0000-000000000000" <<EOH
Authorization: Bearer $token
Ocp-Apim-Subscription-Key: $(cat $APIM_VAULT)
EOH
  )
  unset token
  case $code in
    404) echo "Mimer BankID accepted the client" ;;
    401) echo "Mimer BankID answered 401: APIM subscription key or token not accepted"; exit 1 ;;
    403) echo "Mimer BankID answered 403: client lacks Transaction.Read or is not in ValidClients (bankid-api release)"; exit 1 ;;
    *) echo "Mimer BankID answered HTTP $code"; exit 1 ;;
  esac
else
  GATEWAY_URL=http://host.docker.internal:4010/api/
  TOKEN_URL=http://host.docker.internal:4010/oauth2/v2.0/token
  CLIENT_ID=mimer-minasidor-test
  SCOPE=api://mimer-bankid/.default
  # What the mock expects
  printf 'secret-from-vault' > $SECRET_VAULT
  printf 'apim-from-vault' > $APIM_VAULT
fi
# Keycloak in the container runs as another user and must be able to read the vault
chmod 644 vault/mimer-contacts_*

echo "Building the plugin (also runs the unit tests)"
docker run --rm -v "$PWD/..":/src -v keycloak-bankid-provider-m2:/root/.m2 -w /src \
  maven:3.9-eclipse-temurin-21 mvn -q -B package

if [[ $MODE == mock ]]; then
  node mock/server.mjs > vault/mock.log 2>&1 &
  echo $! > $MOCK_PID_FILE
  disown
fi

wait_up() { # service port
  for _ in $(seq 1 100); do
    [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$2/realms/master")" == 200 ]] && return 0
    sleep 3
  done
  echo "$1 did not come up:"; docker compose logs --tail 20 "$1"; exit 1
}

# One node at a time: two nodes bootstrapping an empty database at once fail with
# "Session not bound to a realm". Real mode needs only one.
echo "Starting Keycloak node 1"
docker compose up -d keycloak 2>/dev/null
wait_up keycloak 18081
if [[ $MODE == mock ]]; then
  echo "Starting Keycloak node 2"
  docker compose up -d keycloak2 2>/dev/null
  wait_up keycloak2 18082
fi

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
# example.com: where a real login lands, so the code is visible in the address bar
api POST /mimer-contacts/clients \
  '{"clientId":"mina-sidor","publicClient":true,"standardFlowEnabled":true,"redirectUris":["http://localhost:3000/*","https://example.com/*"]}'

# First broker login: only link to an existing user with the same username, never create one.
api POST /mimer-contacts/authentication/flows '{"alias":"bankid-first-login","providerId":"basic-flow","topLevel":true,"builtIn":false}'
for p in idp-detect-existing-broker-user idp-auto-link; do
  api POST /mimer-contacts/authentication/flows/bankid-first-login/executions/execution "{\"provider\":\"$p\"}"
done
curl -s "${auth[@]}" $K/admin/realms/mimer-contacts/authentication/flows/bankid-first-login/executions \
  | jq -c '.[] | .requirement = "REQUIRED"' \
  | while read -r e; do api PUT /mimer-contacts/authentication/flows/bankid-first-login/executions "$e"; done

# Mock mode: host.docker.internal, since Keycloak runs in Docker and calls the mock on the host.
api POST /mimer-contacts/identity-provider/instances "$(jq -nc \
  --arg g "$GATEWAY_URL" --arg t "$TOKEN_URL" --arg c "$CLIENT_ID" --arg s "$SCOPE" \
  '{alias:"bankid",displayName:"BankID",providerId:"mimer-bankid",enabled:true,
    trustEmail:false,storeToken:false,firstBrokerLoginFlowAlias:"bankid-first-login",
    config:{syncMode:"IMPORT",gatewayUrl:$g,tokenUrl:$t,clientId:$c,scope:$s,
      clientSecret:"${vault.bankid-client-secret}",apimKey:"${vault.bankid-apim-key}"}}')"

if [[ $MODE == real ]]; then
  api POST /mimer-contacts/users "{\"username\":\"$PNR\",\"enabled\":true}"
  echo
  echo "Open this in your browser and scan the QR code with the test BankID app:"
  echo "  $K/realms/mimer-contacts/protocol/openid-connect/auth?client_id=mina-sidor&redirect_uri=https%3A%2F%2Fexample.com%2Fcb&response_type=code&scope=openid&kc_idp_hint=bankid"
  echo
  echo "Success: you land on https://example.com/cb?...&code=..."
  echo "Cancel in the BankID app: you are back on the Keycloak login page."
  echo "Plugin logs: (cd $(pwd) && docker compose logs -f keycloak | grep -i bankid)"
  echo "When done: ./run.sh down   (stops Keycloak and deletes the secrets in local/vault/)"
  exit 0
fi

api POST /mimer-contacts/users '{"username":"199001011234","enabled":true}'
echo
python3 -I drive.py

if [[ $KEEP == 1 ]]; then
  echo
  echo "Still running. Keycloak: $K (admin/admin), mock log: local/vault/mock.log. Stop with ./run.sh down"
fi
