#!/usr/bin/env bash
# End-to-end check of a deployed stack, run by the CI deploy job after every
# deploy (and runnable by hand against any environment):
#   - readiness: PostgreSQL and RabbitMQ reachable from the API
#   - auth: /api/v1 rejects a request without X-API-Key
#   - products: create, read, delete
#   - async picks: POST /picks is accepted (202), a repeated Idempotency-Key
#     returns the same pickId (Redis), and the inventory worker decrements the
#     stock through RabbitMQ
#
# Usage: API_URL=https://xxxx.cloudfront.net API_KEY=... scripts/smoke-test.sh
set -euo pipefail

: "${API_URL:?set API_URL, e.g. https://xxxx.cloudfront.net}"
: "${API_KEY:?set API_KEY (the X-API-Key value)}"

fail() {
  echo "::error title=Smoke test::$*"
  echo "FAIL: $*" >&2
  exit 1
}

api() {
  curl -sS -H "X-API-Key: $API_KEY" -H 'Content-Type: application/json' "$@"
}

echo "== readiness"
ready=""
for _ in $(seq 1 30); do
  ready=$(curl -sS "$API_URL/health/ready" || true)
  if [ "$(jq -r '.checks.storage + "/" + .checks.rabbitmq' <<<"$ready" 2>/dev/null)" = "ok/ok" ]; then
    break
  fi
  sleep 5
done
echo "$ready"
[ "$(jq -r '.checks.storage + "/" + .checks.rabbitmq' <<<"$ready")" = "ok/ok" ] ||
  fail "/health/ready did not report PostgreSQL and RabbitMQ ok"

echo "== auth"
status=$(curl -sS -o /dev/null -w '%{http_code}' "$API_URL/api/v1/products")
[ "$status" = "401" ] || fail "GET /api/v1/products without X-API-Key returned $status, expected 401"

code="smoke-$(date +%s)-$RANDOM"
cleanup() { api -X DELETE "$API_URL/api/v1/products/$code" -o /dev/null || true; }
trap cleanup EXIT

echo "== create product $code (quantity 10)"
status=$(api -o /dev/null -w '%{http_code}' -X POST "$API_URL/api/v1/products" \
  -d "{\"product_code\":\"$code\",\"quantity\":10,\"pick_location\":\"AA 1\"}")
[ "$status" = "201" ] || fail "POST /api/v1/products returned $status, expected 201"

echo "== pick 3 units (Idempotency-Key sent twice)"
idem="smoke-$code"
first=$(api -X POST "$API_URL/api/v1/picks" -H "Idempotency-Key: $idem" \
  -d "{\"product_code\":\"$code\",\"quantity\":3,\"pick_location\":\"AA 1\"}")
second=$(api -X POST "$API_URL/api/v1/picks" -H "Idempotency-Key: $idem" \
  -d "{\"product_code\":\"$code\",\"quantity\":3,\"pick_location\":\"AA 1\"}")
echo "$first"
echo "$second"
pick_id=$(jq -r '.pickId // empty' <<<"$first")
[ -n "$pick_id" ] || fail "POST /api/v1/picks did not return a pickId"
[ "$(jq -r '.pickId' <<<"$second")" = "$pick_id" ] ||
  fail "a repeated Idempotency-Key returned a different pickId"

echo "== wait for the inventory worker (expect quantity 7)"
quantity=""
for _ in $(seq 1 30); do
  quantity=$(api "$API_URL/api/v1/products/$code" | jq -r '.quantity')
  [ "$quantity" = "7" ] && break
  sleep 2
done
[ "$quantity" = "7" ] || fail "quantity is $quantity after the pick, expected 7 (picked once, not twice)"

echo "== delete product"
status=$(api -o /dev/null -w '%{http_code}' -X DELETE "$API_URL/api/v1/products/$code")
[ "$status" = "200" ] || fail "DELETE /api/v1/products/$code returned $status, expected 200"
trap - EXIT

echo "All smoke tests passed."
