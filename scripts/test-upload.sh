#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

PORT="${PORT:-3108}"
BASE_URL="http://127.0.0.1:${PORT}"
COOKIE_JAR="$(mktemp)"
RESPONSE_FILE="$(mktemp)"
SERVER_LOG="$(mktemp)"
SERVER_PID=''
TEST_MODULE_ID=''
TEST_FILENAME=''

cleanup() {
  result=$?
  trap - EXIT
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ -n "$TEST_MODULE_ID" && -n "$TEST_FILENAME" ]]; then
    node --input-type=module - "$TEST_MODULE_ID" "$TEST_FILENAME" >/dev/null <<'NODE' || result=1
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

dotenv.config();
const [moduleId, filename] = process.argv.slice(2);
if (path.basename(filename) !== filename) process.exit(1);

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
try {
  await connection.beginTransaction();
  await connection.execute('DELETE FROM jobs WHERE module_id = ?', [moduleId]);
  await connection.execute('DELETE FROM modules WHERE id = ?', [moduleId]);
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}

const originalDir = path.resolve('storage/original');
const filePath = path.resolve(originalDir, filename);
if (!filePath.startsWith(`${originalDir}${path.sep}`)) process.exit(1);
await fs.unlink(filePath);
NODE
  fi
  rm -f "$COOKIE_JAR" "$RESPONSE_FILE" "$SERVER_LOG"
  exit "$result"
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
  echo 'FAIL: server tidak siap; periksa konfigurasi dan koneksi database.'
  exit 1
fi

unauth_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -F 'title=upload-tanpa-login' \
  -F 'file=@storage/optimized/contoh.pdf;type=application/pdf' \
  "$BASE_URL/api/modul")"
if [[ "$unauth_status" != 401 ]]; then
  echo "FAIL: upload tanpa sesi menghasilkan HTTP $unauth_status, seharusnya 401."
  exit 1
fi
echo 'PASS: upload tanpa sesi ditolak dengan HTTP 401.'

login_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' \
  "$BASE_URL/api/auth/login")"
if [[ "$login_status" != 200 ]]; then
  echo "FAIL: login admin menghasilkan HTTP $login_status, seharusnya 200."
  exit 1
fi

upload_status="$(curl -sS -o "$RESPONSE_FILE" -w '%{http_code}' \
  -b "$COOKIE_JAR" \
  -F 'title=upload-test-'"$$" \
  -F 'file=@storage/optimized/contoh.pdf;type=application/pdf' \
  "$BASE_URL/api/modul")"
if [[ "$upload_status" != 201 ]]; then
  echo "FAIL: upload admin menghasilkan HTTP $upload_status, seharusnya 201."
  exit 1
fi

TEST_MODULE_ID="$(node -e "const data=JSON.parse(process.argv[1]); process.stdout.write(String(data.module.id))" "$(cat "$RESPONSE_FILE")")"
TEST_FILENAME="$(node -e "const data=JSON.parse(process.argv[1]); process.stdout.write(data.module.original_file)" "$(cat "$RESPONSE_FILE")")"
if [[ -z "$TEST_MODULE_ID" || -z "$TEST_FILENAME" ]]; then
  echo 'FAIL: respons upload tidak memuat identitas modul.'
  exit 1
fi

unauth_delete_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X DELETE "$BASE_URL/api/modul/$TEST_MODULE_ID")"
if [[ "$unauth_delete_status" != 401 ]]; then
  echo "FAIL: hapus tanpa sesi menghasilkan HTTP $unauth_delete_status, seharusnya 401."
  exit 1
fi
if [[ ! -e "storage/original/$TEST_FILENAME" ]]; then
  echo 'FAIL: file asli terhapus oleh permintaan tanpa sesi.'
  exit 1
fi
echo 'PASS: hapus tanpa sesi ditolak dengan HTTP 401.'

delete_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -b "$COOKIE_JAR" -X DELETE "$BASE_URL/api/modul/$TEST_MODULE_ID")"
if [[ "$delete_status" != 200 ]]; then
  echo "FAIL: hapus modul menghasilkan HTTP $delete_status, seharusnya 200."
  exit 1
fi

if [[ -e "storage/original/$TEST_FILENAME" ]]; then
  echo 'FAIL: file asli masih ada setelah modul dihapus.'
  exit 1
fi
if curl -fsS "$BASE_URL/api/modul" | node -e \
  "let input='';process.stdin.on('data',chunk=>input+=chunk).on('end',()=>{const modules=JSON.parse(input);process.exit(modules.some(module=>String(module.id)===process.argv[1])?1:0)})" \
  "$TEST_MODULE_ID"; then
  :
else
  echo 'FAIL: baris modul masih muncul setelah dihapus.'
  exit 1
fi

TEST_MODULE_ID=''
TEST_FILENAME=''
echo 'PASS: admin dapat mengunggah lalu menghapus modul dan file aslinya.'
