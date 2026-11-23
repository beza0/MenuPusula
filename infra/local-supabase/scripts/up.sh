#!/usr/bin/env bash
# Yerel yığını başlatır, servislerin hazır olmasını bekler ve migration'ları uygular.
# Kullanım: scripts/up.sh [--seed]
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
node scripts/gen-env.mjs
docker compose --env-file .env up -d
echo "Servisler bekleniyor..."
for svc in db auth storage; do
  for i in $(seq 1 120); do
    st="$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q $svc)" 2>/dev/null || true)"
    [[ "$st" == "healthy" ]] && break
    sleep 2
  done
  echo "  $svc: ${st:-bilinmiyor}"
done
bash scripts/migrate.sh "${1:-}"
set -a; source .env; set +a
echo
echo "API:      http://localhost:${API_PORT}"
echo "Mailpit:  http://localhost:${MAILPIT_PORT}"
echo "ANON_KEY: ${ANON_KEY}"
