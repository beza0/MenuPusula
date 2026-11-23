#!/usr/bin/env bash
# Tüm otomatik testleri çalıştırır. Önce: bash infra/local-supabase/scripts/up.sh --seed
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a; source "$ROOT/infra/local-supabase/.env"; set +a

echo "== Backend (RLS, yayın, fiyat, arama, saatler, hesap silme, AI aktarma)"
(cd "$ROOT/supabase/tests" && npm ci --silent && npx vitest run)

echo "== Web: tip denetimi, lint, birim testleri, derleme"
(cd "$ROOT/apps/business-web" && npm ci --silent && npx tsc -b && npm run lint && npx vitest run && npx vite build)

echo "== Web: uçtan uca (Playwright)"
(cd "$ROOT/apps/business-web" && npx playwright test)

echo "== Mobil: analiz, birim/widget testleri, backend entegrasyonu"
(cd "$ROOT/apps/mobile" && flutter analyze && flutter test test/format_test.dart test/models_test.dart test/widget_test.dart \
  && SUPABASE_URL="http://localhost:${API_PORT:-54321}" SUPABASE_ANON_KEY="$ANON_KEY" flutter test test/integration)
echo "Tüm testler geçti."
