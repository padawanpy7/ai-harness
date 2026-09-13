// Avisa si tu rama y main tocaron los MISMOS archivos del loop.
//
// Existe por la regla del dueño (10/08): una mejora de tooling se mergea el dia que funciona, no
// al cerrar el ticket. Guardarla dos semanas termina en un merge donde hay que elegir entre dos
// versiones que evolucionaron por separado, y eso ya no es mecanico: es una decision de diseño.
//
// Distingue dos clases de choque, porque no valen lo mismo:
//   LOOP  scripts/, memory/, skills/, AGENTS.md, CLAUDE.md, harness.js -> compartido por TODAS las
//            ramas. Es el que rompe main. Si aparece, se mergea YA.
//   TICKET   openspec/changes/<CLAVE>/ -> de una sola tarea. Chocan poco y no urgen.
//
// SOLO LEE. Sale 1 si hay choque de LOOP (sirve de compuerta), 0 si no.
// Uso: node harness.js rama-drift [RAMA]     (default: la rama actual)

// Las dos trampas de correr git desde node -el maxBuffer de 1 MB y que un exit != 0 puede ser el
// resultado y no un fallo- estan resueltas en el helper. Ver scripts/lib/git.js.
const g = require('../lib/git')

const args = process.argv.slice(2)
const git = g.git

if (args[0] === '-h' || args[0] === '--help') {
  console.log('Uso: node harness.js rama-drift [RAMA]   (default: la rama actual)')
  console.log('Avisa si tu rama y main tocaron los mismos archivos. Sale 1 si el choque es del loop.')
  process.exit(0)
}

const RAMA = args[0] || git('branch', '--show-current')

if (!RAMA || RAMA === 'main') {
  console.log('Estas en main (o en detached): no hay divergencia que medir.')
  process.exit(0)
}

if (!g.existeRama(RAMA)) {
  console.error(`no existe la rama ${RAMA}`)
  process.exit(1)
}

const base = git('merge-base', 'main', RAMA)
console.log(`== ${RAMA} ==`)
console.log(`  commits propios sin mergear: ${git('rev-list', '--count', `main..${RAMA}`)}`)
console.log(`  atrasada respecto de main:   ${git('rev-list', '--count', `${RAMA}..main`)} commits`)

const ambos = g.tocadosPorAmbos(base, 'main', RAMA)

if (!ambos.length) {
  console.log('  sin archivos tocados por los dos lados: el merge deberia entrar limpio.')
  process.exit(0)
}

// La lista sale del arbol REAL de este repo, no copiada de otro: `project.yml` y `.yamllint` no
// existen aca, y `FEATURES.json` y `cspell.json` si. Un patron que nombra archivos que no
// existen no falla: simplemente nunca matchea, y el gate queda mas flojo sin avisar.
const ES_LOOP = /^(scripts\/|memory\/|skills\/|docs\/|AGENTS\.md|CLAUDE\.md|README\.md|harness\.js|FEATURES\.json|cspell\.json|\.gitignore)/
const lista = ambos
const loop = lista.filter((f) => ES_LOOP.test(f))
const ticket = lista.filter((f) => !ES_LOOP.test(f))

if (ticket.length) {
  console.log('')
  console.log('  Tocados por los dos lados, del TICKET (no urgen):')
  for (const f of ticket) console.log(`    ${f}`)
}

if (loop.length) {
  console.log('')
  console.log('  *** LOOP tocado por los dos lados. Esto es lo que rompe main: ***')
  for (const f of loop) console.log(`    ${f}`)
  console.log('')
  console.log('  Que hacer (AGENTS S7): traer main a la rama, resolverlo ahora que son pocos cambios,')
  console.log('  y mergear esa mejora a main YA -no al cerrar el ticket-.')
  console.log('    git pull                # estando en la rama, con main al dia')
  console.log('    # resolver, probar, y mergear el cambio de tooling a main')
  process.exit(1)
}

console.log('')
console.log('  Nada del loop en conflicto: el choque es solo del ticket.')
process.exit(0)
