#!/usr/bin/env bash
set -uo pipefail

eco="${1:-}"; pkg="${2:-}"
[ -z "$pkg" ] && { echo "uso: check-dep.sh <npm|pypi|nuget> <paquete>"; exit 1; }

latest=""; deprecated=""; osv_eco=""
case "$eco" in
  npm)
    latest="$(npm view "$pkg" version 2>/dev/null || true)"
    deprecated="$(npm view "$pkg" deprecated 2>/dev/null || true)"
    osv_eco="npm" ;;
  pypi|pip)
    latest="$(curl -fsSL "https://pypi.org/pypi/$pkg/json" 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)["info"]["version"])' 2>/dev/null || true)"
    osv_eco="PyPI" ;;
  nuget)
    latest="$(curl -fsSL "https://api.nuget.org/v3-flatcontainer/$(echo "$pkg" | tr '[:upper:]' '[:lower:]')/index.json" 2>/dev/null | python3 -c 'import sys,json;v=[x for x in json.load(sys.stdin)["versions"] if "-" not in x];print(v[-1] if v else "")' 2>/dev/null || true)"
    osv_eco="NuGet" ;;
  *) echo "ecosystem invalido: '$eco' (npm|pypi|nuget)"; exit 1 ;;
esac

[ -z "$latest" ] && { echo "no encontre '$pkg' en $eco"; exit 1; }
echo "paquete:        $pkg ($eco)"
echo "ultima estable: $latest"
[ -n "$deprecated" ] && echo "DEPRECADO: $deprecated  <- NO usar"

vulns="$(curl -fsSL -X POST "https://api.osv.dev/v1/query" -d "{\"package\":{\"name\":\"$pkg\",\"ecosystem\":\"$osv_eco\"},\"version\":\"$latest\"}" 2>/dev/null | python3 -c 'import sys,json;print(len(json.load(sys.stdin).get("vulns",[])))' 2>/dev/null || echo "?")"
case "$vulns" in
  0) echo "vulns (OSV) en $latest: ninguna" ;;
  "?") echo "vulns: no pude consultar OSV" ;;
  *) echo "VULNERABILIDADES en $latest: $vulns (OSV) <- revisar antes de usar" ;;
esac

[ -n "$deprecated" ] && exit 2
[ "$vulns" != "0" ] && [ "$vulns" != "?" ] && exit 2
exit 0
