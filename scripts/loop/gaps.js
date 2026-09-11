// gaps.js - de lo que falla repetido, que no esta anotado en ningun lado.
//
// Uso: node harness.js gaps [--minimo N] [--dias N] [--json]
//
// Por que existe: el pedido era "que un cierre encuentre huecos sin que yo le diga nada".
// Encontrar los modos de falla ya lo hace `fallos`; lo que se perdia es el paso del medio: el
// hallazgo aparece en una corrida, nadie lo anota, y vuelve a aparecer a la semana.
//
// Por que NO escribe fichas en un ledger, como la version de infra-platform: ese harness tiene un
// `FEATURES.json` por ticket y aca no hay ninguno. Crear uno seria un SEGUNDO esquema de
// planificacion al lado de `work/PROGRESO.md`, y eso es exactamente lo que el research marca como
// lo que no se adopta. Asi que en vez de escribir la ficha, se contesta la pregunta que la haria
// falta: de lo que se repite, QUE NO ESTA ESCRITO.
//
// LO QUE NO HACE, a proposito: aplicar el arreglo. Detectar el hueco es barato y mecanico; decidir
// que se hace con el no lo es. La deteccion la hace la maquina, el arreglo lo decide una persona.

const fs = require('fs')
const path = require('path')
const fallos = require('../lib/fallos-core')
// Hora LOCAL, no UTC: git y las bitacoras se escriben en local (scripts/lib/fecha-local.js).
const fechaLocal = require('../lib/fecha-local')
const core = require('../lib/gaps-core')

const RAIZ = process.cwd()
const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Uso: node harness.js gaps [--minimo N] [--dias N] [--json]')
  console.log('  cruza los modos de falla repetidos contra lo que la bitacora ya dice,')
  console.log('  y lista los que no estan anotados en ningun lado.')
  console.log('  --minimo N  veces que tiene que repetirse para contar (por defecto 4)')
  process.exit(0)
}

const valorDe = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null }
const minimo = Number(valorDe('--minimo')) || 4
const dias = Number(valorDe('--dias')) || 30

const leer = (r) => { try { return fs.readFileSync(path.join(RAIZ, r), 'utf8') } catch { return '' } }

const desde = fechaLocal.haceDias(dias)
const { filas, rotas } = fallos.parsear(leer('metrics/tool-runs.log'))
const agrupado = fallos.agrupar({ filas, rotas }, { minimo, desde })

// `fallos-core` ya separa lo que importa: su campo `gaps` son los modos de falla de tools que NO
// son gates. La distincion es la que decide todo el analisis -para un gate, exit 1 significa
// "encontre algo" y no "me rompi"-, y sin ella `spell` y `check` dominan la lista justamente
// porque funcionan. La primera version de esta tool no la usaba y proponia anotar como hueco que
// el corrector de ortografia encuentra palabras.
const modos = agrupado.gaps || []

// Donde podria estar anotado un hallazgo: la bitacora viva, la archivada de este mes, y los
// hechos durables. Si no esta en ninguno, nadie lo escribio.
const textos = [
  leer('work/PROGRESO.md'),
  ...fs.existsSync(path.join(RAIZ, 'work/progreso'))
    ? fs.readdirSync(path.join(RAIZ, 'work/progreso')).map((f) => leer(path.join('work/progreso', f)))
    : [],
  ...fs.existsSync(path.join(RAIZ, 'memory/hechos'))
    ? fs.readdirSync(path.join(RAIZ, 'memory/hechos')).map((f) => leer(path.join('memory/hechos', f)))
    : [],
]

const huecos = core.huecos(modos, textos, { minimo })
const r = core.resumir(huecos, modos.length)

if (argv.includes('--json')) {
  console.log(JSON.stringify({ ...r, desde, minimo, huecos }, null, 2))
  process.exit(0)
}

console.log(`==> gaps: modos de falla desde ${desde}, repetidos ${minimo}+ veces`)
console.log(`  ${agrupado.grupos.length} modo(s) repetido(s), ${modos.length} de tools que NO son gates`)
console.log(`  ${huecos.length} sin anotar en ningun lado`)

if (r.ok) {
  console.log('')
  console.log('  todo lo que se repite ya esta escrito')
} else {
  console.log('')
  for (const h of huecos) console.log(`  - ${h.propuesta}`)
  console.log('')
  console.log('  Esto NO se anota solo: anotarlo es decidir que se va a hacer con el hueco, y eso')
  console.log('  no lo decide la maquina. Va a "Pendiente / proximo" de la entrada de hoy, o a un')
  console.log('  hecho en memory/hechos/ si ya se sabe la causa.')
}
