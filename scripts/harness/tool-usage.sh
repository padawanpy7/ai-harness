#!/usr/bin/env bash
# tool-usage.sh - el CONTADOR de uso de las herramientas de scripts/. Sirve para decidir que
# tool conviene mantener y cual quitar (mantener el harness ligero). Lo alimenta scripts/_count.sh,
# que cada tool llama al arrancar (una linea por corrida en metrics/tool-usage.log).
#
# Uso: bash scripts/harness/tool-usage.sh
#   - tabla de tools ORDENADA por uso (mas usada arriba) con la fecha del ultimo uso
#   - al final, las tools instrumentadas que NUNCA se usaron (candidatas a quitar)
set -uo pipefail
cd "$(cd "$(dirname "$0")/../.." && pwd)"

log="metrics/tool-usage.log"

echo "== Contador de uso de tools =="
if [ ! -s "$log" ]; then
  echo "  (sin registros todavia: corre alguna tool y volve a mirar)"
else
  echo "  usos  ultimo-uso           tool"
  # cuenta por tool (col 2), con la fecha max (col 1)
  awk -F'\t' 'NF>=2 { c[$2]++; if ($1>u[$2]) u[$2]=$1 }
    END { for (t in c) printf "%6d  %-19s  %s\n", c[t], u[t], t }' "$log" | sort -rn
fi

echo ""
echo "== Tools instrumentadas SIN uso registrado (candidatas a quitar) =="
# tools instrumentadas = *.sh que llaman a _count.sh (excluye helpers _*.sh y este reporte)
usadas="$(awk -F'\t' 'NF>=2{print $2}' "$log" 2>/dev/null | sort -u)"
sin_uso=0
# Las tools viven en subcarpetas (calidad/, harness/, docs/) y algunas sueltas en scripts/.
for f in scripts/*.sh scripts/*/*.sh; do
  [ -e "$f" ] || continue
  b="$(basename "$f" .sh)"
  case "$b" in _*|tool-usage) continue;; esac
  grep -q "_count.sh" "$f" || continue
  if ! printf '%s\n' "$usadas" | grep -qx "$b"; then
    echo "  - $b"; sin_uso=$((sin_uso+1))
  fi
done
[ "$sin_uso" = 0 ] && echo "  (ninguna: todas las tools instrumentadas se usaron al menos una vez)"
