#!/usr/bin/env bash
# _count.sh - registra el uso de una herramienta: UNA linea por invocacion (append, atomico
# para escrituras chicas -> seguro aunque varios tools corran en paralelo). Best-effort: NUNCA
# hace fallar al tool que lo llama. La agregacion (el "contador") la arma scripts/harness/tool-usage.sh.
# El log es estado de runtime (gitignoreado, ver metrics/), no codigo.
tool="${1:-desconocido}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)" || exit 0
{ mkdir -p "$root/metrics" && printf '%s\t%s\n' "$(date +%Y-%m-%dT%H:%M:%S)" "$tool" >> "$root/metrics/tool-usage.log"; } 2>/dev/null || true
exit 0
