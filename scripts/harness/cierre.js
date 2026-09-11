// cierre.js - la compuerta del cierre de sesion: mide si el trabajo quedo guardado de verdad.
//
// Por que existe: el ritual de cierre (AGENTS.md S4) vivia SOLO como prosa, asi que el dueño lo
// dictaba cada vez -"guardar el progreso, commitear, pushear"- y aun asi se escapaban pasos.
// Portado de bf-db-workspace (commits b61a37b y 704226f); ver work/mejoras-desde-bf.md.
//
// SOLO LEE. No commitea, no pushea. Dice QUE falta y con que comando se arregla, y sale 1 si el
// cierre esta incompleto (sirve de compuerta). Corre `node harness.js check --todos` como parte de su
// propia medicion, asi que tarda lo mismo que check (unos segundos), no menos de un segundo.
//
// Uso: node harness.js cierre

const fs = require('fs')
const path = require('path')
const { execFileSync, spawnSync } = require('child_process')

const core = require('../lib/check-core')
// Hora LOCAL, no UTC: git y las bitacoras se escriben en local (scripts/lib/fecha-local.js).
const fechaLocal = require('../lib/fecha-local')
const cierre = require('../lib/cierre-core')
const { descubrirTools } = require('../lib/tools-registro')

const RAIZ = process.cwd()
const p = (...partes) => path.join(RAIZ, ...partes)

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Uso: node harness.js cierre')
  console.log('Mide si la sesion quedo cerrada: sin cambios sueltos, pusheado, work/PROGRESO.md')
  console.log('al dia, check en verde y sin comandos muertos en los docs.')
  console.log('Solo lee. Sale 1 si falta algo.')
  process.exit(0)
}

function leer(ruta) { try { return fs.readFileSync(ruta, 'utf8') } catch { return null } }

const chequeos = []

// --- 1. nada sin commitear -----------------------------------------------------------------
let porcelanoRaw = null
try { porcelanoRaw = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', cwd: RAIZ }) } catch { /* sin git, se ve abajo */ }
chequeos.push(cierre.chequearLimpio(porcelanoRaw === null ? [] : core.parsePorcelano(porcelanoRaw)))

// --- 2. nada sin pushear --------------------------------------------------------------------
let tieneUpstream = true
try { execFileSync('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { encoding: 'utf8', cwd: RAIZ }) }
catch { tieneUpstream = false }
let sinPushear = 0
if (tieneUpstream) {
  try { sinPushear = Number(execFileSync('git', ['rev-list', '--count', '@{u}..HEAD'], { encoding: 'utf8', cwd: RAIZ }).trim() || 0) }
  catch { /* deja sinPushear en 0, no se puede medir mejor sin upstream */ }
}
chequeos.push(cierre.chequearPusheado(sinPushear, tieneUpstream))

// --- 3. work/PROGRESO.md cuenta esta sesion --------------------------------------------------
const rutaProgreso = p('work/PROGRESO.md')
const existeProgreso = fs.existsSync(rutaProgreso)
const textoProgreso = existeProgreso ? (leer(rutaProgreso) || '') : ''
const fechasProgreso = [...textoProgreso.matchAll(/^##\s+(\d{4}-\d{2}-\d{2})/gm)].map((m) => m[1])
const HOY = fechaLocal.hoy()
chequeos.push(cierre.chequearProgreso(existeProgreso, fechasProgreso, HOY))

// --- 3b. ningun dia trabajado se quedo sin entrada ---------------------------------------------
// Las entradas viejas se mudan a work/progreso/<mes>.md, asi que las fechas se juntan de los DOS
// lados: mirar solo PROGRESO.md haria que cada archivado inventara un dia faltante.
const fechasArchivadas = (() => {
  try {
    return fs.readdirSync(p('work/progreso'))
      .filter((f) => f.endsWith('.md'))
      .flatMap((f) => [...(leer(p(path.join('work/progreso', f))) || '')
        .matchAll(/^##\s+(\d{4}-\d{2}-\d{2})/gm)].map((m) => m[1]))
  } catch { return [] }
})()

const VENTANA_DIAS = 7
let logDias = ''
try {
  logDias = execFileSync('git',
    ['log', `--since=${VENTANA_DIAS} days ago`, '--format=%cd\t%s', '--date=format:%Y-%m-%d'],
    { encoding: 'utf8', cwd: RAIZ })
} catch { /* sin git no se mide: el chequeo 1 ya lo dijo */ }
const porDia = new Map()
for (const linea of String(logDias || '').split('\n').filter(Boolean)) {
  const [fecha, asunto] = linea.split('\t')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) continue
  const e = porDia.get(fecha) || { fecha, commits: 0, muestra: asunto }
  e.commits++
  porDia.set(fecha, e)
}
chequeos.push(cierre.chequearDiasSinEntrada(
  [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
  [...fechasProgreso, ...fechasArchivadas],
  VENTANA_DIAS))

// --- 4. check en verde -------------------------------------------------------------------------
const rCheck = spawnSync(process.execPath, [p('harness.js'), 'check', '--todos'], { cwd: RAIZ, encoding: 'utf8' })
chequeos.push(cierre.chequearCheck(rCheck.status, (rCheck.stdout || '') + (rCheck.stderr || '')))

// --- 5. comandos/rutas muertos en los docs ------------------------------------------------------
function archivosDoc() {
  const fijos = ['AGENTS.md', 'README.md', 'scripts/README.md', 'CLAUDE.md']
  const glob = (dir) => {
    try { return fs.readdirSync(p(dir)).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f)) }
    catch { return [] }
  }
  return [...fijos.filter((f) => fs.existsSync(p(f))), ...glob('skills'), ...glob('memory/playbooks')]
}

const tools = descubrirTools(RAIZ)
const esToolConocida = (nombre) => tools.has(nombre)
const existeRuta = (ruta) => fs.existsSync(p(ruta))

const hallazgos = {}
for (const archivo of archivosDoc()) {
  const h = cierre.referenciasMuertas(leer(p(archivo)) || '', existeRuta, esToolConocida)
  if (h.length) hallazgos[archivo] = h
}
chequeos.push(cierre.chequearDocsMuertos(hallazgos))

// --- 7. lo escrito no contradice al repo -------------------------------------------------------
// El playbook pedia "simular un arranque sin contexto" y esto lo imprimia como recordatorio, o sea
// que dependia de acordarse. La mitad mecanica -un pendiente que dice "falta X" cuando X ya esta-
// se mide; la otra mitad sigue necesitando un agente sin contexto (`arranque-frio --paquete`).
const rArranque = spawnSync(process.execPath, [p('harness.js'), 'arranque-frio'], { cwd: RAIZ, encoding: 'utf8' })
chequeos.push(rArranque.status === 0
  ? cierre.chequearLimpio([], 'lo escrito')
  : {
    id: 'arranque',
    estado: 'falta',
    titulo: 'los documentos de arranque se contradicen con el repo',
    detalle: [
      ...(rArranque.stdout || '').split('\n').filter((l) => /  \S+\.md:/.test(l)).map((l) => l.trim()),
      'node harness.js arranque-frio',
    ],
  })

// --- salida --------------------------------------------------------------------------------------
const MARCA = { ok: 'OK   ', falta: 'FALTA', aviso: 'AVISO' }

console.log('== cierre de sesion ==\n')
for (const c of chequeos) {
  console.log(`  ${MARCA[c.estado]}  ${c.titulo}`)
  for (const d of c.detalle) console.log(`           ${d}`)
}

const r = cierre.resumir(chequeos)
console.log(`\n  ${r.ok} ok, ${r.faltan} falta/n, ${r.avisos} aviso/s`)

// Lo que esta tool NO puede ver, y por eso no simula ver.
console.log('\n  Esto no lo mide (necesita criterio, no un grep):')
console.log('    - lo aprendido a memory/hechos/ y al playbook que corresponda')
console.log('    - que el punto de retorno de lo que se toco siga anotado y siga siendo valido')
// Este es el unico que caza un archivo que MIENTE. Los chequeos de arriba miden que los
// documentos existan y esten versionados, no que lo que dicen siga siendo cierto.
console.log('    - simular un arranque SIN CONTEXTO: releer PROGRESO.md, work/*.md y los hechos')
console.log('      como si el chat no existiera, y ver si lo escrito TODAVIA es cierto (playbook lead)')

if (!r.completo) {
  console.log('\nEl cierre esta INCOMPLETO: arregla lo que dice FALTA y volve a correr.')
  process.exit(1)
}
console.log('\nCierre completo.')
