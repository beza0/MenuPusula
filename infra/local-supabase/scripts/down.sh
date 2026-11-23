#!/usr/bin/env bash
# Yığını durdurur. --wipe verilirse veritabanı ve dosya hacimlerini siler.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${1:-}" == "--wipe" ]]; then docker compose --env-file .env down -v; else docker compose --env-file .env down; fi
