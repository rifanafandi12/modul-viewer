#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3107}"
BASE_URL="http://127.0.0.1:${PORT}"
COOKIE_JAR="$(mktemp)"
SERVER_LOG="$(mktemp)"
SERVER_PID=''

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$COOKIE_JAR" "$SERVER_LOG"
}
trap cleanup EXIT

NODE_ENV=test PORT="$PORT" node app.js >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

ready=0
for _ in $(seq 1 40); do
  if curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.25
done
if [[ "$ready" != 1 ]]; then
  echo 'FAIL: server tidak siap; periksa konfigurasi test dan koneksi database.'
  exit 1
fi

me_unauth_status="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/auth/me")"
if [[ "$me_unauth_status" != 401 ]]; then
  echo "FAIL: /api/auth/me tanpa sesi menghasilkan HTTP $me_unauth_status, seharusnya 401."
  exit 1
fi
echo 'PASS: /api/auth/me menolak permintaan tanpa sesi dengan HTTP 401.'

wrong_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"wrong-password"}' \
  "$BASE_URL/api/auth/login")"
if [[ "$wrong_status" != 401 ]]; then
  echo "FAIL: login password salah menghasilkan HTTP $wrong_status, seharusnya 401."
  exit 1
fi
echo 'PASS: password salah ditolak dengan HTTP 401.'

login_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' \
  "$BASE_URL/api/auth/login")"
if [[ "$login_status" != 200 ]] || ! grep -q 'modul_viewer.sid' "$COOKIE_JAR"; then
  echo "FAIL: login valid tidak menghasilkan HTTP 200 dan cookie sesi (HTTP $login_status)."
  exit 1
fi
echo 'PASS: login valid menghasilkan HTTP 200 dan cookie sesi.'

me_auth_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -b "$COOKIE_JAR" "$BASE_URL/api/auth/me")"
if [[ "$me_auth_status" != 200 ]]; then
  echo "FAIL: /api/auth/me dengan sesi menghasilkan HTTP $me_auth_status, seharusnya 200."
  exit 1
fi
echo 'PASS: /api/auth/me menerima sesi valid dengan HTTP 200.'

protected_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -b "$COOKIE_JAR" "$BASE_URL/api/auth/_test/protected")"
if [[ "$protected_status" != 200 ]]; then
  echo "FAIL: akses route terlindungi menghasilkan HTTP $protected_status, seharusnya 200."
  exit 1
fi
echo 'PASS: cookie sesi mengakses route terlindungi dengan HTTP 200.'

echo 'Semua tes autentikasi lulus.'
