// transcripts.js - enumera los transcripts que Claude Code escribe en
// ~/.claude/projects/<proyecto>/<sesion>.jsonl.
//
// Comun a metricas.js (los lee para medir tiempo y tokens) y buscar.js (los lee para buscar
// texto): las dos recorrian el mismo directorio por separado antes de esto.

const fs = require('fs')
const os = require('os')
const path = require('path')

const RAIZ_PROYECTOS = path.join(os.homedir(), '.claude', 'projects')

function carpetas(raiz) {
  let nombres
  try { nombres = fs.readdirSync(raiz) } catch { return [] }
  return nombres.filter((c) => { try { return fs.statSync(path.join(raiz, c)).isDirectory() } catch { return false } })
}

// Un generador de { archivo, proyecto, subagente } por cada transcript encontrado.
//   raiz          - directorio de proyectos (default el real; un test le pasa uno de prueba).
//   soloProyectos - si se da, limita a esas carpetas exactas (buscar.js: por defecto solo esta
//                   maquina). Sin esto, todas (metricas.js: mide todo lo que hay).
//   conSubagentes - ademas de <sesion>.jsonl, suma <sesion>/subagents/*.jsonl, donde vive el
//                   transcript de cada agente lanzado. metricas.js no los pide (mide el arbol
//                   entero de tools, sin distinguir quien las llamo); buscar.js si, porque "que
//                   dijimos sobre esto" incluye lo que encontro un agente.
function* transcripts({ raiz = RAIZ_PROYECTOS, soloProyectos = null, conSubagentes = false } = {}) {
  for (const proyecto of carpetas(raiz)) {
    if (soloProyectos && !soloProyectos.includes(proyecto)) continue
    const dir = path.join(raiz, proyecto)
    let entradas = []
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const e of entradas) {
      if (e.isFile() && e.name.endsWith('.jsonl')) { yield { archivo: path.join(dir, e.name), proyecto }; continue }
      if (!conSubagentes || !e.isDirectory()) continue
      const sub = path.join(dir, e.name, 'subagents')
      let hijos = []
      try { hijos = fs.readdirSync(sub) } catch { continue }
      for (const f of hijos) if (f.endsWith('.jsonl')) yield { archivo: path.join(sub, f), proyecto, subagente: true }
    }
  }
}

module.exports = { RAIZ_PROYECTOS, transcripts }
