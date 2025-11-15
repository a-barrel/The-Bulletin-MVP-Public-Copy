#!/usr/bin/env bash
set -euo pipefail
curl -s "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/bulletin-app-6548a/accounts:query?key=dev" \
  -H "Authorization: Bearer owner" \
  -H "Content-Type: application/json" \
  -d '{}' | jq . > TODO-AND-IDEAS/firebase_account_payload_11_14_2025.json
