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

echo "==> Semua verifikasi lulus."