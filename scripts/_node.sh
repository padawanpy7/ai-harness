# Resuelve el binario de node y el NODE_PATH del repo. NO se ejecuta: se sourcea.
#
# Por que existe: no en todos los equipos node vive en el PATH de la shell (instalaciones por
# WinGet en Windows, o un nvm que no se cargo en una shell no interactiva). Sin esto, `node x.js`
# falla con "command not found" y cada sesion termina exportando el PATH a mano. Los scripts .sh
# lo sourcean y usan "$NODE": dejan de depender del PATH del que llama.
#
# Uso:   . "$(dirname "$0")/_node.sh"      -> deja $NODE, $NPM, $NPX y $NODE_PATH listos
_raiz_repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

_buscar_node() {
  # 1) si esta en el PATH, ese manda
  if command -v node >/dev/null 2>&1; then command -v node; return; fi
  # 2) rutas conocidas: nvm (linux/mac) y las instalaciones tipicas de Windows
  for patron in \
    "$HOME/.nvm/versions/node/v"*"/bin/node" \
    "$HOME/.local/share/fnm/node-versions/v"*"/installation/bin/node" \
    "${LOCALAPPDATA:-}/Microsoft/WinGet/Packages/OpenJS.NodeJS"*"/node-v"*"/node.exe" \
    "/c/Program Files/nodejs/node.exe"
  do
    for p in $patron; do [ -x "$p" ] && { echo "$p"; return; }; done
  done
}

NODE="$(_buscar_node | sort -V | tail -1)"
if [ -z "${NODE:-}" ]; then
  echo "FALLO: no encuentro node (ni en el PATH ni en las rutas conocidas)." >&2
  echo "       Instalalo, o agregalo al PATH, o edita scripts/_node.sh con tu ruta." >&2
  exit 2
fi

# Las dependencias viven en el node_modules del repo, no en el del script que llama.
export NODE
export NODE_PATH="$_raiz_repo/node_modules"

# npm/npx viven al lado de node (o en el PATH si ahi vive node). Mismo problema que arriba: sin
# esto, "npm"/"npx" sueltos fallan en cualquier shell que no exporto el PATH a mano, y un script
# que ignora ese fallo queda creyendo que no hay nada que reportar. Cualquier gate que dependa de
# npm/npx tiene que usar "$NPM"/"$NPX", nunca el desnudo.
_buscar_hermano() {
  local nombre="$1" dir="$(dirname "$NODE")"
  for candidato in "$dir/$nombre" "$dir/$nombre.cmd"; do
    [ -x "$candidato" ] && { echo "$candidato"; return; }
  done
  command -v "$nombre" 2>/dev/null
}
NPM="$(_buscar_hermano npm)"
NPX="$(_buscar_hermano npx)"
export NPM NPX
