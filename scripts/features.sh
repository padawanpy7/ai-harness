#!/usr/bin/env bash
# features.sh - estado del ledger FEATURES.json (avance + proximas incompletas).
# El lead lo corre al arrancar una sesion (protocolo de sesion, AGENTS.md).
set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

f="${1:-FEATURES.json}"
[ -f "$f" ] || {
  echo "no hay $f (crea el ledger del build, ver AGENTS.md)"
  exit 0
}

python3 - "$f" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception as e:
    print("FEATURES.json invalido:", e); sys.exit(1)
fs = d.get("features", [])
ok = [x for x in fs if x.get("passes")]
pend = [x for x in fs if not x.get("passes")]
print(f"FEATURES: {len(ok)}/{len(fs)} passing")
for x in pend[:8]:
    print(f"  [ ] {x.get('id','?')} ({x.get('categoria','')}): {x.get('descripcion','')}")
if len(pend) > 8:
    print(f"  ... y {len(pend)-8} mas incompletas")
PY
