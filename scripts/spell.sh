#!/usr/bin/env bash
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"; cd "$here"
cfg="cspell.json"; [ -f "$cfg" ] || cfg="$here/scripts/cspell.json"
targets=("$@"); [ ${#targets[@]} -eq 0 ] && targets=(AGENTS.md CLAUDE.md README.md "memory/**/*.md" "openspec/**/*.md" "skills/**/*.md" "docs/**/*.md")
echo "==> spell (es,en): ${targets[*]}"
npx -y -p cspell@latest -p @cspell/dict-es-es cspell --no-progress --gitignore --config "$cfg" "${targets[@]}"
echo "Por cada palabra: 1) fixea el typo; 2) si el dict no la trae, usa un SINONIMO que si;"
echo "3) solo si no hay sinonimo (nombre propio/jerga) agregala a cspell.json (words)."
