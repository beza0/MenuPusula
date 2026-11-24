#!/usr/bin/env bash
# supabase/migrations altındaki SQL dosyalarını sırayla uygular (Supabase CLI ile
# aynı izleme tablosunu kullanır). Kullanım: scripts/migrate.sh [--seed]
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
set -a; source "$HERE/.env"; set +a
# psql, bilgisayarda kurulu olması gerekmeden veritabanı konteynerinin içinden çalıştırılır.
cd "$HERE"
PSQL=(docker compose --env-file .env exec -T db psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres)

"${PSQL[@]}" -c "create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, statements text[]);"

for f in "$REPO"/supabase/migrations/*.sql; do
  base="$(basename "$f" .sql)"; version="${base%%_*}"; name="${base#*_}"
  applied="$("${PSQL[@]}" -tAc "select 1 from supabase_migrations.schema_migrations where version = '$version'")"
  if [[ "$applied" == "1" ]]; then continue; fi
  echo "→ migration $base"
  "${PSQL[@]}" --single-transaction < "$f"
  "${PSQL[@]}" -c "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name')"
done

# PostgREST şema önbelleğini yenile
"${PSQL[@]}" -c "notify pgrst, 'reload schema'"

if [[ "${1:-}" == "--seed" ]]; then
  echo "→ seed (YALNIZCA YEREL ÖRNEK VERİ)"
  "${PSQL[@]}" < "$REPO/supabase/seed.sql"
fi
echo "Migration tamam."
