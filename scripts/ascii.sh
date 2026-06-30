#!/usr/bin/env bash
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
mode="--check"
targets=()
for a in "$@"; do
  case "$a" in
    --fix|--check) mode="$a" ;;
    *) targets+=("$a") ;;
  esac
done
[ ${#targets[@]} -eq 0 ] && targets=(".")

files=()
for t in "${targets[@]}"; do
  if [ -d "$t" ]; then
    while IFS= read -r f; do files+=("$f"); done < <(find "$t" -path "*/node_modules" -prune -o -path "*/.git" -prune -o \( -name "*.md" -o -name "*.yml" -o -name "*.yaml" \) -print 2>/dev/null)
  else
    files+=("$t")
  fi
done

[ ${#files[@]} -gt 0 ] && python3 "$here/_ascii.py" "$mode" "${files[@]}"
echo "Convierte em/en dash, comillas tipograficas, flechas, ellipsis -> ASCII. Mantiene acentos y enie del espaniol."
