// loop.js - en que estado esta la vuelta actual, y por que puerta deberia salir.
//
// Uso: node harness.js loop [--ticket <CLAVE>] [--desde <N>] [--json]
//   --desde <N>   mira las ultimas N corridas (por defecto, desde el ultimo cierre en verde)
//
// Por que existe: `aceptacion` cubre la salida por EXITO, que es una de seis. Las otras estaban
// documentadas en docs/loop-engineering.md y no las medía nadie: existian como intencion.
// Esto no instrumenta nada nuevo -lee el log que el harness ya escribe en cada corrida- y contesta
// tres cosas que hoy nadie contesta: cuantas vueltas van, si los ultimos fallos son EL MISMO, y
// cuanto se lleva gastado.
//
// Termina nombrando un estado -verificado / requiere revision / bloqueado / cortado por
// presupuesto- en vez de "listo", porque "listo" sin estado es lo que produce el modo de falla mas
// caro de un loop: declarar exito antes de tiempo.

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const core = require('../lib/loop-core')

const RAIZ = process.cwd()
const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Uso: node harness.js loop [--ticket <CLAVE>] [--desde <N>] [--json]')
  console.log('  dice en que estado esta la vuelta: cuantas van, si se repite el mismo fallo,')
  console.log('  cuanto se gasto, y por que puerta deberia salir.')
  console.log('  --desde <N>  las ultimas N corridas (por defecto, desde el ultimo cierre)')
  process.exit(0)
}

const valorDe = (flag) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : null
}

// El log: sello<TAB>tool<TAB>exit<TAB>ms<TAB>args<TAB>detalle<TAB>padre
function corridas() {
  let texto = ''
  try { texto = fs.readFileSync(path.join(RAIZ, 'metrics', 'tool-runs.log'), 'utf8') } catch { return [] }
  return texto.split('\n').filter(Boolean).map((l) => {
    const [sello, tool, exit, ms, args] = l.split('\t')
    return { sello, tool, exit: Number(exit), ms: Number(ms), args: args || '' }
  }).filter((c) => c.tool)
}

// La ventana por defecto es LA VUELTA ACTUAL: desde el ultimo `cierre` que paso. Un cierre en
// verde es el fin de una vuelta, asi que lo posterior es la siguiente.
//
// No se usa "hoy" a proposito: un dia puede tener seis tareas y eso son seis loops, no uno. Medido
// el 06/09: con ventana de un dia daba 35 vueltas contra un tope de 5, que no dice nada util
// porque cuenta el trabajo de toda la jornada.
const desde = Number(valorDe('--desde')) || null
const todas = corridas()

function desdeElUltimoCierre(lista) {
  for (let i = lista.length - 1; i >= 0; i--) {
    if (lista[i].tool === 'cierre' && lista[i].exit === 0) return lista.slice(i + 1)
  }
  return lista
}

const ventana = desde ? todas.slice(-desde) : desdeElUltimoCierre(todas)

// La regla de parada: se corre de verdad, no se supone. Sin ticket no se puede saber cual es, y
// eso NO es un verde: es un "no se sabe", que el core traduce a "requiere revision".
const ticket = valorDe('--ticket')
let aceptacionOk = null
if (ticket) {
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'harness.js'), 'aceptacion', '--ticket', ticket],
    { cwd: RAIZ, encoding: 'utf8' })
  if (r.status === 0) aceptacionOk = true
  else if (r.status === 1) aceptacionOk = false
  // status 2 = no hay HECHO_CUANDO.md -> queda en null, que es "no se sabe"
}

const r = core.evaluar({ corridas: ventana, aceptacionOk })

if (argv.includes('--json')) {
  console.log(JSON.stringify({
    estado: r.estado,
    vueltas: r.vueltas,
    corridas: r.gastado.corridas,
    ms: r.gastado.ms,
    repetido: r.repetido.veces >= 2 ? r.repetido : null,
    razones: r.razones,
  }, null, 2))
  process.exit(r.estado === core.ESTADOS.VERIFICADO ? 0 : 1)
}

console.log(`==> loop: ${ventana.length} corrida(s) ${desde ? `(ultimas ${desde})` : 'desde el ultimo cierre en verde'}`)
console.log(`  vueltas de verificacion : ${r.vueltas}`)
console.log(`  tiempo en tools         : ${(r.gastado.ms / 1000).toFixed(1)}s`)
if (ticket) {
  console.log(`  regla de parada         : ${
    aceptacionOk === true ? 'pasa' : aceptacionOk === false ? 'NO pasa' : 'no hay HECHO_CUANDO.md'}`)
}
if (r.repetido.veces >= 2) {
  console.log(`  MISMO fallo repetido    : ${r.repetido.veces} veces -> ${r.repetido.firma}`)
}

console.log('')
console.log(`  estado: ${r.estado.toUpperCase()}`)
for (const razon of r.razones) console.log(`    - ${razon.salida}: ${razon.detalle}`)

if (r.estado !== core.ESTADOS.VERIFICADO) {
  console.log('')
  console.log('  Un loop no termina en "listo": termina en un estado con nombre. Este no es')
  console.log('  "verificado", asi que no se declara terminado sin que alguien lo mire.')
}
process.exit(r.estado === core.ESTADOS.VERIFICADO ? 0 : 1)
