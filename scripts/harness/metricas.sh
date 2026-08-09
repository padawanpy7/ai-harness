#!/usr/bin/env bash
bash "$(dirname "$0")/../_count.sh" "$(basename "$0" .sh)" 2>/dev/null || true
# metricas.sh - cuanto tiempo y cuantos tokens costo cada ticket (ver scripts/harness/metricas.js).
#
# Uso: bash scripts/harness/metricas.sh [--dias N] [--ticket CLAVE] [--salida RUTA] [--json]
set -uo pipefail
cd "$(cd "$(dirname "$0")/../.." && pwd)"
. scripts/_node.sh
exec "$NODE" scripts/harness/metricas.js "$@"
