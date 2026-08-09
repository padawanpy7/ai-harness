// metricas.js - cuanto TIEMPO y cuantos TOKENS costo cada ticket.
//
// De donde salen los datos: de los transcripts que Claude Code ya escribe en
// ~/.claude/projects/<proyecto>/<sesion>.jsonl. Ahi esta, por mensaje, el `usage` (tokens de
// entrada/salida/cache), el `timestamp` y la `gitBranch` -que en este repo ES el ticket, porque
// una tarea = una rama-. El tiempo de cada herramienta sale de emparejar el `tool_use` con su
// `tool_result` por id. No hace falta instrumentar nada: ya esta todo escrito.
//
// Para que sirve (lo que pidio el dueño):
//   - ver que tarea se llevo demasiado tiempo y POR QUE (ranking de herramientas por tiempo);
//   - ver cuantos tokens costo cada llamada de herramienta: si el numero es alto, se resolvio
//     mucho "a mano" y quiza eso merece convertirse en una herramienta para todos.
//
// Escribe el resultado en el repo PRINCIPAL (main), no en el worktree del ticket: es informacion
// de TODOS los tickets y tiene que vivir en un solo lugar.
//
// Uso: bash scripts/harness/metricas.sh [--dias N] [--ticket CLAVE] [--salida RUTA] [--json]

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { agregar, reporte, resumenUso } = require('../lib/metricas-core')

const RAIZ = path.join(__dirname, '..', '..')
const PROYECTOS = path.join(os.homedir(), '.claude', 'projects')

function ayuda() {
  console.log(`Uso: bash scripts/harness/metricas.sh [--dias N] [--ticket CLAVE] [--salida RUTA] [--json]

  --dias N      solo los ultimos N dias (default: todo)
  --ticket X    solo ese ticket
  --salida R    donde escribir el reporte (default: el repo principal, metrics/por-ticket.md)
  --json        ademas del .md, deja el agregado crudo en .json

Lee los transcripts de Claude Code (${PROYECTOS}). Solo lectura.`)
}

function args(argv) {
  const a = { dias: null, ticket: null, salida: null, json: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dias') a.dias = Number(argv[++i])
    else if (argv[i] === '--ticket') a.ticket = argv[++i]
    else if (argv[i] === '--salida') a.salida = argv[++i]
    else if (argv[i] === '--json') a.json = true
    else if (argv[i] === '--help' || argv[i] === '-h') { ayuda(); process.exit(0) }
  }
  return a
}

function* transcripts() {
  if (!fs.existsSync(PROYECTOS)) return
  for (const proyecto of fs.readdirSync(PROYECTOS)) {
    const dir = path.join(PROYECTOS, proyecto)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.jsonl')) yield path.join(dir, f)
    }
  }
}

// Normaliza un transcript a los eventos que entiende el core. Una linea rota no corta la corrida:
// un transcript se escribe mientras la sesion vive y la ultima linea puede estar a medio escribir.
function eventosDe(archivo, corte) {
  const salida = []
  let texto
  try { texto = fs.readFileSync(archivo, 'utf8') } catch (e) { return salida }
  const sesion = path.basename(archivo, '.jsonl')
  for (const linea of texto.split('\n')) {
    if (!linea.trim()) continue
    let j
    try { j = JSON.parse(linea) } catch (e) { continue }
    const ts = j.timestamp
    if (!ts || (corte && ts < corte)) continue
    const ticket = j.gitBranch || null

    const u = j.message && j.message.usage
    if (u) {
      salida.push({ tipo: 'uso', ts, ticket, sesion, tokens: {
        entrada: u.input_tokens || 0,
        salida: u.output_tokens || 0,
        cacheLectura: u.cache_read_input_tokens || 0,
        cacheEscritura: u.cache_creation_input_tokens || 0,
      } })
    }

    const contenido = j.message && j.message.content
    if (Array.isArray(contenido)) {
      for (const b of contenido) {
        if (b.type === 'tool_use') salida.push({ tipo: 'tool', ts, ticket, sesion, tool: b.name, id: b.id })
        if (b.type === 'tool_result') salida.push({ tipo: 'result', ts, ticket, sesion, id: b.tool_use_id })
      }
    }
  }
  return salida
}

// El reporte vive en el repo PRINCIPAL: es de todos los tickets, no de este worktree. Se resuelve
// con `git rev-parse --git-common-dir`, que en un worktree apunta al .git del principal y en un
// clon normal al propio: la carpeta que lo contiene es la raiz que buscamos. Sin git, cae aca.
function destinoPorDefecto() {
  try {
    const comun = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd: RAIZ, encoding: 'utf8' }).trim()
    if (comun) return path.join(path.dirname(comun), 'metrics', 'por-ticket.md')
  } catch (e) { /* sin git (o git viejo): el reporte queda en este repo */ }
  return path.join(RAIZ, 'metrics', 'por-ticket.md')
}

function main() {
  const a = args(process.argv.slice(2))
  const corte = a.dias ? new Date(Date.now() - a.dias * 86400000).toISOString() : null

  let eventos = []
  let n = 0
  for (const t of transcripts()) { eventos = eventos.concat(eventosDe(t, corte)); n++ }
  if (!eventos.length) {
    console.error('No hay nada que medir: no se encontraron transcripts con actividad.')
    process.exit(1)
  }

  let agregado = agregar(eventos)
  if (a.ticket) {
    agregado = Object.fromEntries(Object.entries(agregado)
      .filter(([k]) => k.toUpperCase() === a.ticket.toUpperCase()))
    if (!Object.keys(agregado).length) {
      console.error(`No hay actividad registrada para ${a.ticket}.`)
      process.exit(1)
    }
  }

  // El log del contador de uso vive al lado del reporte, en el repo principal.
  const logUso = path.join(path.dirname(a.salida ? path.resolve(a.salida) : destinoPorDefecto()), 'tool-usage.log')
  let usos = []
  try {
    usos = fs.readFileSync(logUso, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => {
      const [ts, tool] = l.split('\t')
      return { ts, tool }
    })
  } catch (e) { /* sin log todavia: el reporte igual sale, solo que sin esa seccion */ }

  const destino = a.salida ? path.resolve(a.salida) : destinoPorDefecto()
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.writeFileSync(destino, reporte(agregado) + resumenUso(usos, corte))
  console.log(`${n} transcript(s) leidos, ${Object.keys(agregado).length} ticket(s).`)
  console.log(`Reporte -> ${destino}`)

  if (a.json) {
    const j = destino.replace(/\.md$/, '.json')
    fs.writeFileSync(j, JSON.stringify(agregado, null, 2) + '\n')
    console.log(`Crudo   -> ${j}`)
  }
}

main()
