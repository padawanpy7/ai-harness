// El registro de herramientas del harness: que tools hay y donde vive cada una.
//
// Se descubre del filesystem, no se mantiene a mano: un registro escrito se desincroniza el dia
// que alguien agrega una tool y se olvida de anotarla. `lib/` queda afuera porque son librerias
// que se importan, no cosas que se corren.
//
// Lo comparten harness.js (para despachar) y tool-usage.js (para saber cuales NUNCA se usaron).
//
// Descubre tanto .js como .sh: este harness no migro todo a Node (scripts/sistema/ se queda en
// bash a proposito, ver work/mejoras-desde-bf.md). Cuando una tool tiene las dos piezas -el .sh
// que resuelve el toolchain y el .js que hace el trabajo (scripts/README.md)-, el .sh es la
// entrada real y gana.

const fs = require('fs')
const path = require('path')

function descubrirTools(raiz) {
  const tools = new Map()
  const base = path.join(raiz, 'scripts')
  let areas
  try { areas = fs.readdirSync(base, { withFileTypes: true }) } catch { return tools }
  for (const area of areas) {
    if (!area.isDirectory() || area.name === 'lib') continue
    const dir = path.join(base, area.name)
    for (const archivo of fs.readdirSync(dir)) {
      if (archivo.startsWith('_')) continue
      const esJs = archivo.endsWith('.js') && !archivo.endsWith('.test.js')
      const esSh = archivo.endsWith('.sh')
      if (!esJs && !esSh) continue
      const nombre = archivo.slice(0, archivo.lastIndexOf('.'))
      const ruta = path.join(dir, archivo)
      if (esJs && tools.has(nombre) && tools.get(nombre).endsWith('.sh')) continue
      tools.set(nombre, ruta)
    }
  }
  return tools
}

const areaDe = (ruta) => path.basename(path.dirname(ruta))

// Si harness.js tiene que anotar la corrida en metrics/tool-usage.log. Una tool .sh ya se cuenta sola
// (llama a scripts/_count.sh en su primera linea, el camino de emergencia que sigue andando aunque
// se la invoque directo con bash); si harness.js tambien la anotara, cada corrida dejaria DOS lineas
// para la misma invocacion. Una tool .js no tiene ese auto-conteo: harness.js es su unico punto de
// registro.
const debeContarUso = (ruta) => ruta.endsWith('.js')

module.exports = { descubrirTools, areaDe, debeContarUso }
