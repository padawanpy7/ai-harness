#!/usr/bin/env bash
bash "$(dirname "$0")/../_count.sh" "$(basename "$0" .sh)" 2>/dev/null || true
# md-a-pdf.sh - pasa un .md del repo a PDF, para mandarselo a alguien de afuera (ver scripts/docs/md-a-pdf.js).
#
# Uso: bash scripts/docs/md-a-pdf.sh <archivo.md> [otro.md ...] [--out <archivo.pdf>] [--horizontal]
#      bash scripts/docs/md-a-pdf.sh openspec/changes/<ID>/docs/manual-de-prueba.md
set -uo pipefail
cd "$(cd "$(dirname "$0")/../.." && pwd)"
. scripts/_node.sh

# Playwright usa su cache por defecto (~/.cache/ms-playwright). Si tu equipo lo tiene en otro
# lado, exporta PLAYWRIGHT_BROWSERS_PATH antes de llamar a este script y se respeta.
if ! "$NODE" -e "require.resolve('playwright')" 2>/dev/null; then
  echo "FALLO: falta playwright. Corre: npm i -D playwright && npx playwright install chromium" >&2
  exit 2
fi

exec "$NODE" scripts/docs/md-a-pdf.js "$@"
