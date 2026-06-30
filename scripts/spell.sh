#!/usr/bin/env bash
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"; cd "$here"
cfg="cspell.json"; [ -f "$cfg" ] || cfg="$here/scripts/cspell.json"
targets=("$@"); [ ${#targets[@]} -eq 0 ] && targets=("**/*.md")
echo "==> spell (es,en): ${targets[*]}"
npx -y -p cspell@latest -p @cspell/dict-es-es cspell --no-progress --gitignore --config "$cfg" "${targets[@]}"
echo "Palabras validas que marca como error -> agregalas a cspell.json \"words\"."
