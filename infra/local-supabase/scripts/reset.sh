#!/usr/bin/env bash
# Veritabanını ve dosyaları sıfırlar, migration'ları baştan uygular. Kullanım: scripts/reset.sh [--seed]
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/down.sh --wipe
bash scripts/up.sh "${1:-}"
