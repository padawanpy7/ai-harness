// fallos-core.js - agrupa las corridas fallidas del log en MODOS DE FALLA. Puro: recibe lineas de
// texto y devuelve grupos.
//
// POR QUE EXISTE (research de loop engineering, 31/08): el paper 2604.25850 evoluciona un harness
// solo, y su paso clave no es la auto-modificacion sino el *failure clustering*: agrupar las
// corridas fallidas por modo de falla y rastrear la causa hasta la instruccion, la tool o el
// contexto que faltaba. Nosotros escribimos `metrics/tool-runs.log` desde el 10/08 y **nunca lo
// leimos**. La primera vez que se agrupo -31/08- salieron tres cosas en cinco minutos: 194 lineas
// del log estaban rotas (un SQL multilinea partia el registro), `--help` salia con 2 en varias
// tools (o sea que pedir ayuda se contaba como fallo), y `kove-cargar-horas` fallaba en el 95 % de
// sus corridas.
//
// LA DISTINCION QUE HACE QUE ESTO SIRVA: un GATE que sale 1 esta haciendo su trabajo -encontro algo-,
// una TOOL DE ACCION que sale 1 es un gap. Sin separarlos, el 28,7 % de fallos que tiene el log es
// un numero sin significado: `spell` y `check` lo dominan justamente porque funcionan.

// Las tools cuyo exit 1 significa "encontre algo", no "me rompi".
const GATES = new Set([
  'check', 'spell', 'lint', 'plsql-lint', 'presupuesto', 'hechos', 'features', 'ascii',
  'plsql-compila', 'plsql-test', 'cierre', 'aceptacion', 'test-js', 'rama-drift', 'db-drift',
  'apex-drift', 'apex-estandar', 'apex-js-check', 'apex-static-check', 'check-dep', 'carpetas',
])

// Una linea es: fecha \t tool \t exit \t ms \t args \t detalle \t padre
function parsear(texto) {
  const filas = []
  const rotas = []
  for (const linea of String(texto || '').split('\n')) {
    if (!linea.trim()) continue
    const c = linea.split('\t')
    const exit = Number(c[2])
    // Una linea rota NO se descarta en silencio: se cuenta. El log es la unica evidencia de como
    // corrio el harness; si esta sucio, eso es un hallazgo, no ruido a filtrar.
    if (c.length < 4 || !c[1] || !/^\d{4}-\d{2}-\d{2}T/.test(c[0]) || !Number.isFinite(exit)) {
      rotas.push(linea)
      continue
    }
    filas.push({ fecha: c[0], tool: c[1], exit, ms: Number(c[3]) || 0, args: c[4] || '', padre: c[6] || '' })
  }
  return { filas, rotas }
}

// El modo de falla: la tool, su codigo de salida y el PRIMER argumento -que en este harness es el
// subcomando (`kove-actividad cerrar`) o el archivo-. Dos corridas con el mismo modo son la misma
// falla repetida, que es lo que hay que mirar; una sola vez puede ser cualquier cosa.
function modoDe(f) {
  const primero = String(f.args || '').trim().split(/\s+/)[0] || ''
  // Un archivo concreto no es un modo: lo que se repite es la tool sobre ESE tipo de cosa. Se
  // conserva el subcomando y las banderas, y se colapsa la ruta.
  const clave = /[/\\]/.test(primero) ? '<archivo>' : primero
  return `${f.tool} ${clave}`.trim() + ` (exit ${f.exit})`
}

function agrupar({ filas = [], rotas = [] } = {}, { minimo = 4, desde = null } = {}) {
  const enRango = desde ? filas.filter((f) => f.fecha >= desde) : filas
  const fallos = enRango.filter((f) => f.exit !== 0)

  const grupos = new Map()
  for (const f of fallos) {
    const modo = modoDe(f)
    if (!grupos.has(modo)) {
      grupos.set(modo, { modo, tool: f.tool, exit: f.exit, veces: 0, ultima: f.fecha, esGate: GATES.has(f.tool), ejemplo: f.args })
    }
    const g = grupos.get(modo)
    g.veces++
    if (f.fecha > g.ultima) g.ultima = f.fecha
  }

  const todos = [...grupos.values()].sort((a, b) => b.veces - a.veces)
  const repetidos = todos.filter((g) => g.veces >= minimo)

  // El hallazgo es lo que NO es un gate: una tool de accion que falla y vuelve a fallar es un hueco
  // del harness. Y `--help` con exit != 0 es su propio hallazgo: pedir ayuda no es un error.
  const gaps = repetidos.filter((g) => !g.esGate)
  const ayudaRota = repetidos.filter((g) => /(^|\s)(--help|-h)\b/.test(g.ejemplo || '') && g.exit !== 0)

  const porTool = new Map()
  for (const f of enRango) {
    if (!porTool.has(f.tool)) porTool.set(f.tool, { tool: f.tool, corridas: 0, fallos: 0, esGate: GATES.has(f.tool) })
    const t = porTool.get(f.tool)
    t.corridas++
    if (f.exit !== 0) t.fallos++
  }
  // Una tool de accion que falla la mayoria de las veces que se usa esta rota o mal documentada, y
  // eso no se ve mirando modos: se ve mirando la proporcion. El piso de corridas evita acusar a una
  // tool que se uso tres veces.
  const casiSiempreFalla = [...porTool.values()]
    .filter((t) => !t.esGate && t.corridas >= 10 && t.fallos / t.corridas >= 0.5)
    .sort((a, b) => b.fallos / b.corridas - a.fallos / a.corridas)

  return {
    corridas: enRango.length,
    fallos: fallos.length,
    rotas: rotas.length,
    grupos: todos,
    repetidos,
    gaps,
    ayudaRota,
    casiSiempreFalla,
  }
}

function informe(r) {
  const l = []
  const pct = r.corridas ? (100 * r.fallos / r.corridas).toFixed(1) : '0.0'
  l.push(`  ${r.corridas} corridas, ${r.fallos} con salida distinta de 0 (${pct} %)`)
  if (r.rotas) l.push(`  X  ${r.rotas} linea(s) del log rotas: la telemetria misma esta sucia`)

  if (r.gaps.length) {
    l.push('')
    l.push('  Modos de falla REPETIDOS que no son un gate (esto es un hueco del harness):')
    for (const g of r.gaps.slice(0, 10)) l.push(`    ${String(g.veces).padStart(4)}x  ${g.modo}   ultima: ${g.ultima.slice(0, 10)}`)
  }
  if (r.casiSiempreFalla.length) {
    l.push('')
    l.push('  Tools que fallan la MITAD o mas de las veces que se usan:')
    for (const t of r.casiSiempreFalla.slice(0, 6)) {
      l.push(`    ${t.fallos}/${t.corridas} (${(100 * t.fallos / t.corridas).toFixed(0)} %)  ${t.tool}`)
    }
  }
  if (r.ayudaRota.length) {
    l.push('')
    l.push('  Pedir ayuda no es un error, y estas salen con != 0 al hacerlo:')
    for (const g of r.ayudaRota.slice(0, 8)) l.push(`    ${String(g.veces).padStart(4)}x  ${g.modo}`)
  }
  if (!r.gaps.length && !r.casiSiempreFalla.length && !r.ayudaRota.length && !r.rotas) {
    l.push('  OK  ningun modo de falla repetido fuera de los gates')
  }
  return l.join('\n')
}

module.exports = { GATES, parsear, modoDe, agrupar, informe }
