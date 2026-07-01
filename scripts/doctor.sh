#!/usr/bin/env bash
set -uo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"; cd "$here"
warn=0
echo "==> doctor: salud del harness"

if grep -q '{{' AGENTS.md 2>/dev/null; then echo "  ! AGENTS.md tiene {{PLACEHOLDERS}} sin completar"; warn=1; else echo "  ok placeholders"; fi
grep -q '^name: ""' project.yml 2>/dev/null && { echo "  ! project.yml: name vacio"; warn=1; }
grep -qE '^[[:space:]]+build: ""' project.yml 2>/dev/null && { echo "  ! project.yml: commands.build vacio"; warn=1; }

if [ -f scripts/skill-sync.sh ]; then
  before="$(cat skills/REGISTRY.md 2>/dev/null || true)"
  bash scripts/skill-sync.sh >/dev/null 2>&1 || true
  if [ "$before" != "$(cat skills/REGISTRY.md 2>/dev/null || true)" ]; then echo "  ! skills/REGISTRY.md estaba desactualizado (lo regenere)"; warn=1; else echo "  ok skill registry"; fi
fi

for p in memory/playbooks/*.md; do
  [ -f "$p" ] || continue
  body="$(grep -cvE '^[[:space:]]*(#|-[[:space:]]*$|$|`)' "$p" 2>/dev/null || echo 0)"
  [ "$body" -lt 2 ] && { echo "  ! playbook casi vacio (seedealo): $p"; warn=1; }
done

old="$(find memory/playbooks openspec/specs -name '*.md' -mtime +45 2>/dev/null || true)"
[ -n "$old" ] && echo "  ! sin actualizar hace >45d (revisar que no mientan): $(echo "$old" | tr '\n' ' ')"

[ -f scripts/smoke.sh ] || { echo "  ! falta scripts/smoke.sh (protocolo de sesion: app viva al arrancar)"; warn=1; }
[ -f scripts/features.sh ] || { echo "  ! falta scripts/features.sh (ledger del build)"; warn=1; }
[ -f work/PROGRESO.md ] && echo "  ok work/PROGRESO.md" || echo "  i sin work/PROGRESO.md (el puente entre sesiones; empezalo al cerrar)"
[ -f FEATURES.json ] && echo "  ok FEATURES.json" || echo "  i sin FEATURES.json (ledger del build; crealo en builds largos)"
echo "  i Regla 10: al salir un modelo nuevo, re-examina el harness y desmonta andamiaje viejo"

echo ""
if [ $warn -eq 0 ]; then echo "OK doctor: harness sano"; else echo "doctor: hay cosas para completar/actualizar (ver arriba)"; fi
