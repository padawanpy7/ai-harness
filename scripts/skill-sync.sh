#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"; cd "$here"
out="skills/REGISTRY.md"
{
  echo "# Skill Registry"
  echo ""
  echo "Indice de skills, cargados por necesidad (no todos en el contexto). Generado por"
  echo "scripts/skill-sync.sh — no lo edites a mano."
  echo ""
  echo "| skill | cuando usarlo |"
  echo "|---|---|"
  for f in skills/*.md; do
    base="$(basename "$f")"; [ "$base" = "REGISTRY.md" ] && continue
    name="$(grep -m1 '^name:' "$f" 2>/dev/null | sed 's/name:[[:space:]]*//' || true)"
    when="$(grep -m1 '^when:' "$f" 2>/dev/null | sed 's/when:[[:space:]]*//' || true)"
    [ -z "$name" ] && name="${base%.md}"
    echo "| [$name]($base) | $when |"
  done
} > "$out"
echo "skill-sync: $out actualizado ($(ls skills/*.md 2>/dev/null | grep -vc REGISTRY) skills)"
