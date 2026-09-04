#!/usr/bin/env bash
# Pull real Teams data from the OPTIMA gateway using a client_credentials grant.
#
#   cp .env.example .env    # then fill in OPTIMA_CLIENT_SECRET
#   bash scripts/pull-teams.sh
#
# Mints a fresh token on every run, so the 5-minute token lifetime never matters.
# The secret is read from .env and is never echoed, logged, or written anywhere.

set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "ERROR: no .env — copy .env.example to .env and fill in the secret." >&2; exit 1; }

set -a; . ./.env; set +a

: "${OPTIMA_TOKEN_URL:?missing in .env}"
: "${OPTIMA_GRAPHQL_URL:?missing in .env}"
: "${OPTIMA_CLIENT_ID:?missing in .env}"
: "${OPTIMA_CLIENT_SECRET:?missing in .env}"
: "${OPTIMA_VENDOR_ID:=3}"
: "${OPTIMA_BRANCH_IDS:=14,13,12,11,10,9,8,7,6,5,4,3}"

mkdir -p docs

echo "==> requesting token as '$OPTIMA_CLIENT_ID'"
# --data-urlencode keeps the secret off the process list (no full arg exposure).
tok_body=$(curl -s -X POST "$OPTIMA_TOKEN_URL" \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=${OPTIMA_CLIENT_ID}" \
  --data-urlencode "client_secret=${OPTIMA_CLIENT_SECRET}" \
  --data-urlencode "scope=${OPTIMA_SCOPE:-profile}" \
  -w $'\n%{http_code}')

tok_code=$(printf '%s' "$tok_body" | tail -n1)
tok_json=$(printf '%s' "$tok_body" | sed '$d')

if [ "$tok_code" != "200" ]; then
  # Print the error but never the request we sent.
  echo "ERROR: token request failed (HTTP $tok_code)" >&2
  printf '%s\n' "$tok_json" | head -c 400 >&2
  exit 1
fi

TK=$(printf '%s' "$tok_json" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
[ -n "$TK" ] || { echo "ERROR: no access_token in response" >&2; exit 1; }
echo "    got token (${#TK} chars)"

# Build the query with the tenant scoping from .env.
branch_json=$(printf '%s' "$OPTIMA_BRANCH_IDS" | awk -F, '{for(i=1;i<=NF;i++){printf "%s\"%s\"", (i>1?",":""), $i}}')

python - "$branch_json" "$OPTIMA_VENDOR_ID" <<'PY' > docs/teams-query.json
import json, sys
branches = json.loads("[" + sys.argv[1] + "]")
query = """query GetOptimaTeams($filter: OptimaTeamFilterInput) {
  optimaTeams(filter: $filter) {
    id name nameAr description active tag
    tags { id tag isGroup tagOperation
      tags { id tag isGroup tagOperation
        tags { id tag isGroup tagOperation
          tags { id tag isGroup tagOperation
            tags { id tag isGroup tagOperation } } } } }
    createdDate rotationEnabled rotationFrequency nextRotationDate rotationPointer
    branchIds
    branches { id name nameAr }
    usersDetails { id firstName firstNameAr lastName lastNameAr email appRole isActive }
    members { userId unavailableToday
      user { id firstName lastName email }
      unavailabilities { id startDate endDate reason cancelled activeToday createdBy createdDate } }
  }
}"""
json.dump({"operationName": "GetOptimaTeams",
           "variables": {"filter": {"branchIds": branches, "vendorId": sys.argv[2]}},
           "query": query}, sys.stdout)
PY

echo "==> querying optimaTeams"
code=$(curl -s "$OPTIMA_GRAPHQL_URL" \
  -H 'accept: application/json' \
  -H "authorization: Bearer $TK" \
  -H 'content-type: application/json' \
  -H 'origin: https://provider.sgh.iohealth.com' \
  -H 'referer: https://provider.sgh.iohealth.com/' \
  --data-binary @docs/teams-query.json \
  -o docs/teams-raw.json -w '%{http_code}')

echo "    HTTP $code -> docs/teams-raw.json ($(wc -c < docs/teams-raw.json) bytes)"

if grep -q '"errors"' docs/teams-raw.json 2>/dev/null; then
  echo "WARNING: response contains errors:" >&2
  head -c 500 docs/teams-raw.json >&2; echo >&2
fi

python -c "
import json
d=json.load(open('docs/teams-raw.json'))
t=(d.get('data') or {}).get('optimaTeams')
print('    teams returned:', len(t) if t is not None else 'none')
" 2>/dev/null || true

echo "==> done. docs/teams-raw.json is gitignored (contains real staff data)."
