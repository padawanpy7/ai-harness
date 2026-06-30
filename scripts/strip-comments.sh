#!/usr/bin/env bash
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
mode="--check"
targets=()
for a in "$@"; do
  case "$a" in
    --write|--check) mode="$a" ;;
    *) targets+=("$a") ;;
  esac
done
if [ ${#targets[@]} -eq 0 ]; then
  echo "uso: strip-comments.sh [--check|--write] <archivos-o-directorios>"
  echo "  AST por lenguaje (.py tokenize, .ts/.tsx compilador TS). Preserva docstrings,"
  echo "  strings, regex, JSX y directivas (noqa/type:/@ts-ignore/eslint-disable/prettier-ignore)."
  exit 1
fi

py=(); tsf=()
for t in "${targets[@]}"; do
  if [ -d "$t" ]; then
    while IFS= read -r f; do py+=("$f"); done < <(find "$t" -name "*.py" -not -path "*/.venv/*" -not -path "*/__pycache__/*" -not -path "*/alembic/versions/*" -not -path "*/migrations/*" 2>/dev/null)
    while IFS= read -r f; do tsf+=("$f"); done < <(find "$t" -path "*/node_modules" -prune -o \( -name "*.ts" -o -name "*.tsx" \) -not -name "*.d.ts" -print 2>/dev/null)
  else
    case "$t" in
      *.py) py+=("$t") ;;
      *.ts|*.tsx) tsf+=("$t") ;;
    esac
  fi
done

[ ${#py[@]} -gt 0 ] && python3 "$here/_strip_py.py" "$mode" "${py[@]}"
[ ${#tsf[@]} -gt 0 ] && node "$here/_strip_ts.js" "$mode" "${tsf[@]}"

echo ""
echo "Despues de --write: corré format+lint+tests del proyecto y verificá igual comportamiento"
echo "(ruff/prettier/eslint + tsc --noEmit + suite). Es AST-safe pero el verify no es opcional."
