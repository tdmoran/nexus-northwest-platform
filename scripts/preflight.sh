#!/usr/bin/env bash
# Pre-launch verification.
#
# Usage:
#   ./scripts/preflight.sh https://your-domain.example
#
# Exits 0 if every check passes; non-zero otherwise. Designed for CI gates and
# pre-cutover smoke tests. Does not exercise sign-up (that would write data),
# only the public read paths and the health endpoint.

set -euo pipefail

BASE="${1:-${BASE_URL:-}}"
if [[ -z "$BASE" ]]; then
  echo "usage: $0 <base-url>"
  exit 64
fi

# Strip trailing slash for consistent concatenation.
BASE="${BASE%/}"

pass=0
fail=0
warn=0

ok()   { printf "  \033[32mOK\033[0m   %s\n" "$1"; pass=$((pass+1)); }
bad()  { printf "  \033[31mFAIL\033[0m %s — %s\n" "$1" "$2"; fail=$((fail+1)); }
warn() { printf "  \033[33mWARN\033[0m %s — %s\n" "$1" "$2"; warn=$((warn+1)); }
hdr()  { printf "\n\033[1m%s\033[0m\n" "$1"; }

http_status() { curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$@"; }
http_body()   { curl -sS --max-time 10 "$@"; }

# ---------- Network reachability ----------

hdr "Reachability"

code=$(http_status "$BASE/")
if [[ "$code" == "200" ]]; then ok "/ returns 200"; else bad "/ returns $code" "expected 200"; fi

# ---------- TLS / HTTPS ----------

hdr "Transport"

if [[ "$BASE" == https://* ]]; then ok "HTTPS scheme in use"
else warn "HTTPS not in use" "use HTTPS in production"; fi

# ---------- Health ----------

hdr "Health"

health=$(http_body "$BASE/api/health" || true)
if [[ -n "$health" ]] && echo "$health" | grep -q '"ok":true'; then
  ok "/api/health: ok=true"
else
  bad "/api/health" "did not return ok=true. Body: $health"
fi

if echo "$health" | grep -qE '"latencyMs":[0-9]+'; then
  latency=$(echo "$health" | sed -nE 's/.*"latencyMs":([0-9]+).*/\1/p')
  if [[ -n "$latency" && "$latency" -lt 200 ]]; then
    ok "DB latency ${latency}ms (< 200ms)"
  else
    warn "DB latency ${latency}ms" "high — investigate Postgres region/pool"
  fi
fi

# ---------- SEO ----------

hdr "SEO"

robots=$(http_body "$BASE/robots.txt" || true)
if echo "$robots" | grep -q 'Disallow: /dashboard'; then
  ok "robots.txt blocks /dashboard"
else
  bad "robots.txt" "missing or doesn't block /dashboard"
fi

sitemap=$(http_body "$BASE/sitemap.xml" || true)
if echo "$sitemap" | grep -q '<urlset'; then
  ok "sitemap.xml present"
else
  bad "sitemap.xml" "missing or invalid"
fi

# ---------- Auth surface ----------

hdr "Auth surface"

code=$(http_status "$BASE/login")
if [[ "$code" == "200" ]]; then ok "/login renders"; else bad "/login" "status $code"; fi

# Dashboard should redirect or 200 to its login. Both are acceptable; 5xx is not.
code=$(http_status -L "$BASE/dashboard")
if [[ "$code" == "200" ]]; then ok "/dashboard reachable (redirected to login)"
else bad "/dashboard" "status $code"; fi

# ---------- Tokenised links return 404 (not 500) for invalid tokens ----------

hdr "Tokenised paths"

for p in "/rsvp/garbage" "/preferences/garbage" "/unsubscribe/garbage"; do
  code=$(http_status "$BASE$p")
  if [[ "$code" == "404" ]]; then ok "$p returns 404 for invalid tokens"
  else bad "$p" "status $code (expected 404)"; fi
done

# ---------- Privacy ----------

hdr "Privacy"

code=$(http_status "$BASE/privacy")
if [[ "$code" == "200" ]]; then ok "/privacy renders"
else bad "/privacy" "status $code"; fi

# ---------- Summary ----------

hdr "Summary"
echo "  Passed: $pass"
echo "  Warnings: $warn"
echo "  Failed: $fail"

if [[ $fail -gt 0 ]]; then
  echo
  echo "Pre-flight check FAILED. Address the items above before going live."
  exit 1
fi

if [[ $warn -gt 0 ]]; then
  echo
  echo "Pre-flight check passed with warnings. Review and ship if acceptable."
  exit 0
fi

echo
echo "Pre-flight check PASSED. Cleared for launch."
