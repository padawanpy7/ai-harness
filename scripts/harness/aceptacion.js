// aceptacion.js - corre la REGLA DE PARADA de un ticket: su `HECHO_CUANDO.md`.
//
// Uso: node harness.js aceptacion [--ticket <CLAVE>] [--json] [--listar] [--todos]
//
// Sale con 0 solo si TODOS los criterios automaticos dieron 0. Sale con 1 si alguno fallo, con el
// archivo mal escrito o si el ticket no declara criterios: "nadie dijo cuando esta hecho" no es
// un verde. Con `--listar` no corre nada y solo muestra que hay declarado.
//
// Por que existe: hasta hoy "terminado" salia de casillas en `tasks.md` que marca el mismo que
// trabaja. El research de loop engineering del 31/08 lo nombra como la pieza que nos faltaba -la
// stopping rule- y da la prueba: un criterio que no produce pasa/no-pasa no cierra ningun loop.
//
// COMO CORRE CADA COMANDO, y por que asi:
//   - desde la RAIZ del repo, no desde la carpeta del ticket: todas las tools de este workspace
//     toman `process.cwd()` como raiz, asi que `node harness.js <lo que sea>` solo funciona ahi.
//   - con `$TICKET` y `$TICKET_DIR` reemplazados EN EL TEXTO del comando antes de correrlo, y
//     tambien puestos en el entorno. El reemplazo textual no es adorno: en Windows el shell es
//     `cmd.exe`, que no expande `$VAR` -expande `%VAR%`-, asi que un criterio escrito con `$` se
//     habria roto en la mitad de las maquinas sin decir por que.
//   - por shell, porque un criterio real usa pipes y redirecciones.
//   - sin timeout propio: el que corre el cierre esta mirando. Un criterio que cuelga es un
//     criterio mal escrito, y se ve.
//
// La logica vive en `scripts/lib/aceptacion-core.js` y se prueba sola; aca se lee el disco y se
// ejecuta.

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const core = require('../lib/aceptacion-core')

const RAIZ = process.cwd()
const argv = process.argv.slice(2)
const ARCHIVO = 'HECHO_CUANDO.md'

// `--help` se contesta ANTES que nada y sale con 0: pedir ayuda no es un error. Sin esto la tool
// caia en "no se cual es el ticket" y salia con 2, que es lo que hoy hacen varias kove-* -aparecio
// al agrupar los fallos del log el 31/08: 40+ corridas contadas como fallo eran gente pidiendo
// ayuda-.
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Uso: node harness.js aceptacion [--ticket <CLAVE>] [--json] [--listar] [--todos]')
  console.log('')
  console.log('Corre el HECHO_CUANDO.md del ticket: la regla de parada. Sale 0 si todos los')
  console.log('criterios automaticos dan 0. Sin --ticket, la clave sale de la rama.')
  process.exit(0)
}

function tomar(bandera) {
  const i = argv.indexOf(bandera)
  return i >= 0 ? argv[i + 1] : null
}

// La clave sale de `--ticket`, y si no de la rama: `git rev-parse --abbrev-ref HEAD`. En un worktree
// de ticket la rama ES la clave, asi que no hace falta repetirla.
//
// NO se pasa a mayusculas a ciegas. Se probo primero tal cual y despues en mayusculas, por este
// orden, porque las dos formas existen: los tickets de Jira son `ICC-83` y un change puede llamarse
// `production-platform`. Pasar todo a mayusculas funcionaba SOLO en Windows -que ignora las
// mayusculas en las rutas- y rompia en Linux, que es donde corre la mitad de este harness. Salio el
// 31/08 al estrenar la tool en el repo de infra desde WSL.
function claveDelTicket() {
  const dado = tomar('--ticket')
  if (dado) return dado
  const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' })
  const rama = r.status === 0 ? r.stdout.trim() : ''
  if (!rama || rama === 'main' || rama === 'HEAD') return null
  return rama
}

// La carpeta del change: tal cual, o en mayusculas si asi esta en el disco.
function carpetaDe(clave) {
  const base = path.join(RAIZ, 'openspec', 'changes')
  for (const c of [clave, clave.toUpperCase()]) {
    if (fs.existsSync(path.join(base, c))) return { clave: c, carpeta: path.join(base, c) }
  }
  return { clave, carpeta: path.join(base, clave) }
}

// --todos: el BARRIDO. Cuantos tickets tienen regla de parada y cuantos no. Sin esto la migracion
// a loop engineering es una intencion: se sabe que el ticket que estas mirando no la tiene, y nunca
// cuantos faltan. No corre ningun criterio -eso costaria minutos-: solo mira que haya, y que este
// bien escrito.
if (argv.includes('--todos')) {
  const dir = path.join(RAIZ, 'openspec', 'changes')
  if (!fs.existsSync(dir)) {
    console.error('no existe openspec/changes: nada que barrer (no es un OK)')
    process.exit(2)
  }
  const tickets = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
  const con = []
  const sin = []
  const malEscritos = []
  for (const t of tickets) {
    const r = path.join(dir, t, ARCHIVO)
    if (!fs.existsSync(r)) { sin.push(t); continue }
    const pp = core.parsear(fs.readFileSync(r, 'utf8'))
    if (pp.problemas.length || !pp.criterios.length) malEscritos.push({ ticket: t, pp })
    else con.push({ ticket: t, n: pp.criterios.length, manuales: pp.criterios.filter((c) => c.manual).length })
  }
  console.log(`==> regla de parada: ${con.length} de ${tickets.length} tickets la tienen`)
  for (const c of con) console.log(`  OK  ${c.ticket}: ${c.n} criterio(s)${c.manuales ? `, ${c.manuales} a mano` : ''}`)
  for (const m of malEscritos) {
    const que = m.pp.problemas.length ? m.pp.problemas.map((x) => x.regla).join(', ') : 'ningun criterio adentro'
    console.log(`  X   ${m.ticket}: ${que}`)
  }
  if (sin.length) {
    console.log('')
    console.log(`  ·  ${sin.length} sin HECHO_CUANDO: ${sin.join(' ')}`)
    console.log('     Los viejos avisan y no rompen; uno nuevo nace con el archivo (task-start).')
  }
  process.exit(malEscritos.length ? 1 : 0)
}

const PEDIDA = claveDelTicket()
if (!PEDIDA) {
  console.error('no se cual es el ticket: pasalo con --ticket <CLAVE> (parado en main la rama no lo dice)')
  process.exit(2)
}
const { clave: CLAVE, carpeta: CARPETA } = carpetaDe(PEDIDA)
const RUTA = path.join(CARPETA, ARCHIVO)

if (!fs.existsSync(CARPETA)) {
  console.error(`no existe openspec/changes/${CLAVE}: .la clave esta bien escrita?`)
  process.exit(2)
}

if (!argv.includes('--json')) console.log(`==> HECHO_CUANDO de ${CLAVE}`)

if (!fs.existsSync(RUTA)) {
  // Un ticket sin regla de parada NO pasa en silencio: es el hallazgo, no una excepcion.
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ticket: CLAVE, sinCriterios: true, ok: false, total: 0 }, null, 2))
    process.exit(1)
  }
  console.log(core.informe({ sinCriterios: true }))
  console.log('')
  console.log(`Creá openspec/changes/${CLAVE}/${ARCHIVO} con un "## titulo" por criterio y, adentro,`)
  console.log('el comando que lo verifica (o "> manual: como se verifica" si ninguna tool lo ve).')
  process.exit(1)
}

const parseado = core.parsear(fs.readFileSync(RUTA, 'utf8'))

if (argv.includes('--listar')) {
  const v = core.veredicto(parseado, [])
  console.log(core.informe({ ...v, sinCorrer: [] , pasaron: [], fallaron: [] }))
  for (const c of parseado.criterios.filter((x) => x.comando)) console.log(`  ·   ${c.titulo}\n        ${c.comando}`)
  process.exit(parseado.problemas.length ? 1 : 0)
}

const DIR_REL = path.posix.join('openspec', 'changes', CLAVE)
const expandir = (cmd) => cmd.split('$TICKET_DIR').join(DIR_REL).split('$TICKET').join(CLAVE)

const resultados = []
for (const c of parseado.criterios) {
  if (c.manual) continue
  // El avance es progreso, no salida: va a stderr, y se rellena para pisar el titulo anterior.
  process.stderr.write(`  ... ${c.titulo}`.padEnd(78).slice(0, 78) + '\r')
  const r = spawnSync(expandir(c.comando), {
    cwd: RAIZ,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, TICKET: CLAVE, TICKET_DIR: DIR_REL },
  })
  // Un comando que ni siquiera arranco (`r.error`) no es "fallo el criterio": es otra cosa, y se
  // distingue con un exit propio para que no se confunda con un criterio en rojo.
  const exit = r.error ? 127 : r.status
  resultados.push({ titulo: c.titulo, exit, salida: (r.stdout || '') + (r.stderr || '') })
}

// Las vueltas que ESTE ticket lleva hoy sin llegar al verde. Sale de la telemetria que el
// dispatcher ya escribe: una linea por corrida con su exit y sus argumentos. No hace falta que
// nadie las anote -que es justo por lo que `verify_max_rounds` era prosa desde que se escribio-.
function rondasRojasDeHoy(clave) {
  try {
    const log = path.join(RAIZ, 'metrics', 'tool-runs.log')
    if (!fs.existsSync(log)) return 0
    const hoy = new Date().toISOString().slice(0, 10)
    const nombrado = new RegExp(`(^|\\s)${clave}(\\s|$)`, 'i')
    let n = 0
    for (const linea of fs.readFileSync(log, 'utf8').split('\n')) {
      const c = linea.split('\t')
      if (c[1] !== 'aceptacion' || !String(c[0]).startsWith(hoy)) continue
      // El 2 es "no pude medir": no gasta una vuelta. Solo el 1 -criterios en rojo- la gasta.
      if (Number(c[2]) !== 1) continue
      if (!nombrado.test(c[4] || '')) continue
      n++
    }
    return n
  } catch { return 0 }
}

function maximoDeVueltas() {
  try {
    const yml = path.join(RAIZ, 'project.yml')
    if (!fs.existsSync(yml)) return 0
    const doc = require('yaml').parse(fs.readFileSync(yml, 'utf8'))
    return Number(doc && doc.verify_max_rounds) || 0
  } catch { return 0 }
}

const v = core.veredicto(parseado, resultados)

// Con --json sale SOLO el json: si hubiera que buscar el primer "{" adentro de texto libre, el que
// lo consume tendria un parser fragil esperando a romperse.
if (argv.includes('--json')) {
  console.log(JSON.stringify({ ticket: CLAVE, ...v }, null, 2))
  process.exit(v.ok ? 0 : 1)
}
console.log(core.informe(v))

// La salida de lo que fallo, que es lo unico que hace falta leer para arreglarlo.
for (const f of v.fallaron) {
  const r = resultados.find((x) => x.titulo === f.titulo)
  const cola = String(r && r.salida || '').trim().split('\n').slice(-12)
  if (cola.length) {
    console.log('')
    console.log(`--- ${f.titulo}:`)
    for (const l of cola) console.log(`    ${l}`)
  }
}

// La cadencia: si el ticket ya dio N vueltas en rojo hoy, seguir intentando dejo de ser gratis.
// Se cuenta ANTES de esta corrida, asi que en la vuelta numero N el aviso ya aparece.
if (!v.ok) {
  const c = core.cadencia(rondasRojasDeHoy(CLAVE), maximoDeVueltas())
  const texto = core.informeCadencia(c)
  if (texto) console.log(texto)
}

if (v.manuales.length && !v.fallaron.length) {
  console.log('')
  console.log(`Ojo: ${v.manuales.length} criterio(s) los verifica una persona, no una maquina.`)
}

process.exit(v.ok ? 0 : 1)
