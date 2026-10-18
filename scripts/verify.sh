#!/usr/bin/env bash
set -e

echo "==> Cek startup server..."
node app.js &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true" EXIT

for i in $(seq 1 20); do
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "==> Cek /health..."
HEALTH=$(curl -sf http://localhost:3000/health)
echo "$HEALTH" | grep -q '"ok":true' || { echo "FAIL: /health"; exit 1; }

echo "==> Cek /api/modul..."
MODUL=$(curl -sf http://localhost:3000/api/modul)
echo "$MODUL" | grep -q '\[' || { echo "FAIL: /api/modul bukan array"; exit 1; }

echo "==> Cek meta + stream..."
META=$(curl -sf http://localhost:3000/api/modul/1/meta) || { echo "FAIL: /meta"; exit 1; }
TOKEN=$(echo "$META" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$TOKEN" ] || { echo "FAIL: token kosong"; exit 1; }

HEADERS=$(curl -sI "http://localhost:3000/api/modul/1/stream?token=$TOKEN")
echo "$HEADERS" | grep -qi 'content-disposition: inline' || { echo "FAIL: Content-Disposition"; exit 1; }
echo "$HEADERS" | grep -qi 'cache-control: no-store' || { echo "FAIL: Cache-Control"; exit 1; }

echo "==> Cek path traversal ditolak..."
TRAVERSAL_TOKEN=$(node scripts/gen-token.mjs '{"id":1,"file":"../../.env"}')
TRAVERSAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3000/api/modul/1/stream?token=$TRAVERSAL_TOKEN")
if [ "$TRAVERSAL_STATUS" = "200" ]; then
  echo "FAIL: path traversal diterima (status $TRAVERSAL_STATUS)"
  exit 1
fi
echo "    path traversal ditolak (status $TRAVERSAL_STATUS)."

echo "==> Cek APP_SECRET bukan placeholder..."
if node -e "import('./services/token.js').then(() => process.exit(0)).catch(() => process.exit(1))" 2>/dev/null; then
  : # OK
else
  echo "FAIL: services/token.js gagal import — cek APP_SECRET di .env"
  exit 1
fi

# Tes: set APP_SECRET ke placeholder, pastikan import gagal
PLACEHOLDER_TEST=$(APP_SECRET=CHANGEME_GENERATE_WITH_NODE_CRYPTO node -e "
  import('./services/token.js')
    .then(() => { console.log('ACCEPTED'); process.exit(0); })
    .catch((e) => { console.log('REJECTED: ' + e.message.slice(0, 50)); process.exit(0); })
" 2>/dev/null)

if echo "$PLACEHOLDER_TEST" | grep -q 'ACCEPTED'; then
  echo "FAIL: APP_SECRET placeholder diterima, seharusnya ditolak"
  exit 1
fi
echo "    placeholder ditolak."

echo "==> Semua verifikasi lulus."