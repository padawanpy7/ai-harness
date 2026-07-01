#!/usr/bin/env bash
# served-fresh.sh <marcador> <url> [recurso...]
# Freshness gate deterministico: sale 0 si <marcador> aparece en lo SERVIDO por <url>
# (el HTML y los .css/.js que linkea) o en cualquier <recurso> extra. Sale 1 si no.
# Uso tipico (el verifier lo corre ANTES de abrir el navegador):
#   scripts/served-fresh.sh "#df6a44" https://mi-app.dev
#   scripts/served-fresh.sh "Ali & Lauri" https://mi-app.dev/login
set -euo pipefail

marker="${1:?uso: served-fresh.sh <marcador> <url> [recurso...]}"
url="${2:?falta la url}"
shift 2 || true

html="$(curl -fsSk "$url" 2>/dev/null || true)"
if grep -qF -- "$marker" <<<"$html"; then
  echo "OK served-fresh: '$marker' presente en $url"
  exit 0
fi

base="$(sed -E 's#(https?://[^/]+).*#\1#' <<<"$url")"
mapfile -t assets < <(grep -oE "/[^\"' ]+\.(css|js)" <<<"$html" | sort -u)
for a in "${assets[@]:-}" "$@"; do
  [ -z "$a" ] && continue
  case "$a" in
    http*) u="$a" ;;
    /*) u="$base$a" ;;
    *) u="$a" ;;
  esac
  body="$(curl -fsSk "$u" 2>/dev/null || true)"
  if grep -qF -- "$marker" <<<"$body"; then
    echo "OK served-fresh: '$marker' presente en $u"
    exit 0
  fi
done

echo "FALLO served-fresh: '$marker' NO esta servido por $url (imagen vieja / cambio no desplegado)"
echo "  -> en dev con hot reload: recarga y reintenta; si persiste, rebuild/deploy del servicio."
exit 1
