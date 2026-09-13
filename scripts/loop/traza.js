// traza.js - CLI de `node bf.js traza`: reconstruye el arbol de delegacion de una sesion (o un
// ticket) con el costo de cada nodo. NO instrumenta nada nuevo: lee lo que Claude Code y bf.js ya
// escriben solos (jira/META/design-traza.md). Toda la logica de parseo vive en
// scripts/lib/traza-core.js (puro); esto SOLO lee archivos, llama al core y formatea.
//
// Uso: node bf.js traza [--ticket X] [--sesion UUID] [--json] [--vista arbol|timeline|rebotes]
//      node bf.js traza --archivar [--sesion UUID]   copia los transcripts de subagente a
//        metrics/transcripts/<sesion>/ antes de que Temp los limpie. El REPORTE no se guarda
//        (decision del dueño, 09/09): solo el insumo, porque con el insumo la traza se
//        reconstruye identica y guardar los dos es tener dos fuentes que pueden divergir.

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const core = require('../lib/traza-core')
const transcripts = require('../lib/transcripts')
const { parsear } = require('../lib/fallos-core')

// En los repos de bf/infra esto sale de `lib/dispatcher` y `lib/git`, que aca no existen: son la
// plomeria de la OTRA familia y traerlas seria empezar a converger entrypoints, que es otra tarea.
// Son dos llamadas, y se hacen a mano.
const ramaActual = () => {
  try { return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() }
  catch { return '' }
}

const RAIZ = path.join(__dirname, '..', '..')
const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }

if (args.includes('-h') || args.includes('--help')) {
  console.log(`Uso: node harness.js traza [--ticket X] [--sesion UUID] [--json] [--vista arbol|timeline|rebotes]`)
  console.log(`     node harness.js traza --archivar [--sesion UUID]`)
  console.log('')
  console.log('Reconstruye el arbol de delegacion (lead -> implementer -> ...) con costo por nodo,')
  console.log('leyendo los transcripts que Claude Code ya escribe solo. No instrumenta nada nuevo,')
  console.log('no guarda estado propio: se reconstruye en cada corrida.')
  console.log('')
  console.log('  --ticket X    la/s sesion/es de ese ticket (default: la rama actual)')
  console.log('  --sesion UUID una sesion puntual, por su uuid')
  console.log('  --vista       arbol (default) | timeline | rebotes')
  console.log('  --json        el arbol crudo, como dato')
  console.log('  --archivar    copia los transcripts de subagente a metrics/transcripts/ (el')
  console.log('                insumo se pierde cuando el sistema limpia Temp; el reporte no se')
  console.log('                guarda nunca, se regenera)')
  process.exit(0)
}

function raizDelTicket(ticket) {
  const rama = ramaActual() || 'main'
  if (!ticket || ticket.toUpperCase() === rama.toUpperCase()) return RAIZ
  if (ticket.toUpperCase() === 'META' && rama === 'main') return RAIZ
  const candidata = path.join(path.dirname(RAIZ), `${path.basename(RAIZ)}-${ticket}`)
  if (fs.existsSync(path.join(candidata, '.git'))) return candidata
  return null
}

function sesionMasReciente(dir) {
  let archivos
  try { archivos = fs.readdirSync(dir) } catch { return null }
  const jsonl = archivos.filter((f) => f.endsWith('.jsonl'))
  if (!jsonl.length) return null
  jsonl.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs)
  return jsonl[0].replace(/\.jsonl$/, '')
}

const ticketArg = flag('--ticket')
const raizObjetivo = ticketArg ? raizDelTicket(ticketArg) : RAIZ

if (ticketArg && !raizObjetivo) {
  console.error(`no encontre el worktree del ticket "${ticketArg}".`)
  console.error(`  buscaba: ${path.join(path.dirname(RAIZ), `${path.basename(RAIZ)}-${ticketArg}`)}`)
  process.exit(2)
}

const dirSesiones = transcripts.dirDeSesiones(raizObjetivo)
if (!fs.existsSync(dirSesiones)) {
  console.error(`no encontre transcripts de Claude Code para este proyecto en ${dirSesiones}.`)
  console.error('sin transcripts no hay nada que trazar.')
  process.exit(2)
}

const sesionId = flag('--sesion') || sesionMasReciente(dirSesiones)
if (!sesionId) {
  console.error(`no encontre ninguna sesion (.jsonl) en ${dirSesiones}.`)
  process.exit(2)
}

const rutaSesion = transcripts.rutaSesion(raizObjetivo, sesionId)
if (!fs.existsSync(rutaSesion)) {
  console.error(`no existe el transcript de la sesion "${sesionId}": ${rutaSesion}`)
  process.exit(2)
}

const sesionTexto = fs.readFileSync(rutaSesion, 'utf8')

// BFS sobre los agentId que va encontrando, leyendo cada transcript de subagente si existe (primero
// la ubicacion que sobrevive -subagents/-, despues Temp -que se limpia y por eso hay que
// archivarla-). Un archivo de 0 bytes cuenta como "no esta": Temp lo deja ahi vacio despues de
// limpiar, y contarlo como transcript real inventaria tokens/tools que no se pueden leer.
function leerSubagentes(sesionTextoRaiz) {
  const mapa = new Map()
  const vistos = new Set()
  let cola = core.agentIdsReferenciados(sesionTextoRaiz)
  while (cola.length) {
    const id = cola.shift()
    if (vistos.has(id)) continue
    vistos.add(id)
    let texto = null
    const rutaPrincipal = transcripts.rutaSubagente(raizObjetivo, sesionId, id)
    if (fs.existsSync(rutaPrincipal)) {
      const t = fs.readFileSync(rutaPrincipal, 'utf8')
      if (t.trim()) texto = t
    }
    if (!texto) {
      const rutaTemp = transcripts.rutaSubagenteTemp(raizObjetivo, sesionId, id)
      if (fs.existsSync(rutaTemp)) {
        const t = fs.readFileSync(rutaTemp, 'utf8')
        if (t.trim()) texto = t
      }
    }
    if (texto) {
      mapa.set(id, texto)
      cola = cola.concat(core.agentIdsReferenciados(texto))
    }
  }
  return mapa
}

// --- --archivar: copia el insumo, no genera reporte -------------------------------------------
if (args.includes('--archivar')) {
  const subagentes = leerSubagentes(sesionTexto)
  const destino = path.join(RAIZ, 'metrics', 'transcripts', sesionId)
  fs.mkdirSync(destino, { recursive: true })
  let copiados = 0
  for (const [id, texto] of subagentes) {
    fs.writeFileSync(path.join(destino, `agent-${id}.jsonl`), texto)
    copiados++
    const meta = path.join(transcripts.dirDeSesiones(raizObjetivo), sesionId, 'subagents', `agent-${id}.meta.json`)
    if (fs.existsSync(meta)) fs.copyFileSync(meta, path.join(destino, `agent-${id}.meta.json`))
  }
  if (!copiados) {
    console.log(`sesion ${sesionId}: no hay transcripts de subagente para archivar (¿sin delegaciones, o ya se limpiaron?).`)
    process.exit(0)
  }
  console.log(`sesion ${sesionId}: ${copiados} transcript(s) de subagente archivado(s) en ${path.relative(RAIZ, destino)}/`)
  process.exit(0)
}

// --- construir el arbol --------------------------------------------------------------------
const subagentes = leerSubagentes(sesionTexto)
let comandos = []
try {
  const logRuta = path.join(raizObjetivo, 'metrics', 'tool-runs.log')
  if (fs.existsSync(logRuta)) comandos = parsear(fs.readFileSync(logRuta, 'utf8')).filas
} catch { /* sin log, comandosBf sale vacio: no se inventa */ }

const arbol = core.construirArbol({ sesionId, ticket: ticketArg, sesionTexto, subagentes, comandos })

if (args.includes('--json')) {
  console.log(JSON.stringify(arbol, null, 2))
  process.exit(0)
}

if (!arbol.nodos.length) {
  console.log(`sesion ${sesionId}${arbol.ticket ? `  ${arbol.ticket}` : ''}`)
  console.log('no hay delegaciones en esta sesion.')
  process.exit(0)
}

// --- formato ---------------------------------------------------------------------------------
function fmtMs(ms) {
  if (ms === null || ms === undefined) return '???'
  const s = Math.round(Math.abs(ms) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function fmtTokens(tokens) {
  if (!tokens) return '???'
  const n = tokens.total
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M tok`
  if (n >= 1000) return `${Math.round(n / 1000)}k tok`
  return `${n} tok`
}

function fmtHerramientas(n) {
  if (n.herramientas) return `${n.herramientas.reduce((a, h) => a + h.veces, 0)} tools`
  if (n.comandosBf && n.comandosBf.length) return `${n.comandosBf.reduce((a, c) => a + c.veces, 0)} bf.js`
  return '???'
}

function fmtEstado(n) {
  if (n.estado === 'ok') return 'OK'
  if (n.estado === 'cortado') return `CORTADO${n.motivo ? ` (${n.motivo.slice(0, 60)})` : ''}`
  return 'sin transcript'
}

function vistaArbol(a) {
  const lineas = []
  lineas.push(`sesion ${a.sesion}${a.ticket ? `  ${a.ticket}` : ''}  ~${fmtTokens(a.tokensTotales)}`)
  const pintar = (nodos, prefijo) => {
    nodos.forEach((n, i) => {
      const ultimo = i === nodos.length - 1
      const rama = ultimo ? '└─ ' : '├─ '
      lineas.push(`${prefijo}${rama}${n.tipo || '?'}  "${n.descripcion || ''}"  ${fmtTokens(n.tokens)}  ${fmtHerramientas(n)}  ${fmtMs(n.ms)}  ${fmtEstado(n)}`)
      if (n.comandosBf && n.comandosBf.length && !n.herramientas) {
        lineas.push(`${prefijo}${ultimo ? '   ' : '│  '}   tools que mas corrio: ${n.comandosBf.map((c) => `${c.tool} (${c.veces})`).join(', ')}`)
      }
      if (!n.hijos.length && n.estado === 'ok') {
        lineas.push(`${prefijo}${ultimo ? '   ' : '│  '}   (sin delegaciones propias)`)
      }
      pintar(n.hijos, `${prefijo}${ultimo ? '   ' : '│  '}`)
    })
  }
  pintar(a.nodos, '')
  return lineas.join('\n')
}

function vistaTimeline(a) {
  const plana = core.aplanar(a.nodos)
  const lineas = ['timeline (orden cronologico):']
  let finPrevio = null
  for (const n of plana) {
    const paralelo = finPrevio && n.ts && n.ts < finPrevio ? '  (paralelo)' : ''
    lineas.push(`  ${'  '.repeat(n.profundidad)}${n.ts || '?'}  ${n.tipo || '?'}  "${n.descripcion || ''}"  ${fmtMs(n.ms)}  ${fmtEstado(n)}${paralelo}`)
    if (n.ms && n.ts) {
      const fin = new Date(n.ts).getTime() + n.ms
      if (!finPrevio || fin > finPrevio) finPrevio = fin
    }
  }
  return lineas.join('\n')
}

function vistaRebotes(a) {
  const rebotes = core.detectarRebotes(a.nodos)
  if (!rebotes.length) return 'no se detectaron rebotes implementer -> verifier -> implementer en este arbol.'
  const lineas = [`${rebotes.length} rebote(s) detectado(s):`]
  rebotes.forEach((r, i) => {
    lineas.push(`  ${i + 1}. ${r.map((n) => `${n.tipo} "${n.descripcion || ''}" (${n.ts || '?'})`).join('  ->  ')}`)
  })
  return lineas.join('\n')
}

const vista = flag('--vista') || 'arbol'
const vistas = { arbol: vistaArbol, timeline: vistaTimeline, rebotes: vistaRebotes }
if (!vistas[vista]) {
  console.error(`vista desconocida "${vista}". Usa arbol, timeline o rebotes.`)
  process.exit(2)
}
console.log(vistas[vista](arbol))
