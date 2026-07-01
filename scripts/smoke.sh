#!/usr/bin/env bash
# smoke.sh - verificacion minima de que la app esta viva antes de trabajar.
# Correlo al arrancar una sesion (protocolo de sesion, AGENTS.md).
set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

fail() {
  echo "FALLO smoke: $1"
  exit 1
}

# 1) containers arriba (si el proyecto usa docker compose)
if [ -f docker-compose.yml ] || [ -f compose.yml ]; then
  up="$(docker compose ps --status running -q 2>/dev/null | wc -l)"
  [ "$up" -gt 0 ] || fail "no hay containers corriendo (docker compose up -d)"
  echo "  ok containers ($up arriba)"
fi

# 2) la app responde (URL de project.yml -> links.docs)
url="$(grep -oE 'https?://[a-zA-Z0-9./_-]+' project.yml 2>/dev/null | head -1)"
if [ -n "${url:-}" ] && ! grep -q '{{' <<<"$url"; then
  code="$(curl -sk -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo 000)"
  case "$code" in
    2* | 3*) echo "  ok app responde: $url -> $code" ;;
    *) fail "app no responde: $url -> $code" ;;
  esac
else
  echo "  (sin URL en project.yml->links.docs; completa links.docs para el smoke de app)"
fi

echo "OK smoke: entorno listo"
