#!/usr/bin/env bash
set -uo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"; cd "$here"
fail=0

val() { sed -n '/^commands:/,/^[^[:space:] ]/p' project.yml 2>/dev/null | grep -E "^[[:space:]]+$1:" | head -1 | sed -E "s/^[[:space:]]+$1:[[:space:]]*//; s/^['\"]//; s/['\"]$//"; }
run() { local n="$1" c; c="$(val "$2")"; [ -z "$c" ] && { echo "· $n: (sin comando en project.yml)"; return; }; echo "==> $n: $c"; if bash -c "$c"; then echo "   OK"; else echo "   FALLO"; fail=1; fi; }

run "format" format
run "lint"   lint
run "build"  build

if command -v gitleaks >/dev/null 2>&1; then
  echo "==> secretos (gitleaks)"; if gitleaks detect --no-banner -q 2>/dev/null; then echo "   OK"; else echo "   POSIBLE SECRETO"; fail=1; fi
else echo "· secretos: gitleaks no instalado (init.sh lo instala)"; fi

if [ -f package-lock.json ] && command -v npm >/dev/null 2>&1; then echo "==> npm audit"; npm audit --omit=dev || fail=1; fi
if [ -f requirements.txt ] && command -v pip-audit >/dev/null 2>&1; then echo "==> pip-audit"; pip-audit -r requirements.txt || fail=1; fi

if [ -f scripts/spell.sh ] && [ -f cspell.json ]; then
  echo "==> ortografia es,en"
  issues="$(bash scripts/spell.sh 2>/dev/null | grep -c 'Unknown word' || true)"
  if [ "${issues:-0}" -gt 0 ]; then
    echo "   $issues palabra(s). Cada una: fixea el typo; si el dict no la trae usa un sinonimo; solo si no hay, a cspell.json (words)."
    echo "   Verlas: scripts/spell.sh"
    fail=1
  else echo "   OK"; fi
fi

echo ""
if [ $fail -eq 0 ]; then echo "OK check.sh: todo verde"; else echo "FALLO check.sh: revisa lo de arriba"; exit 1; fi
