// presupuesto.js - mide los documentos que se leen en CADA arranque contra su tope.
//
// Uso: node harness.js presupuesto [--json]
//
// Sale con 1 si alguno se paso. Rompe a proposito (porteado de bf-db-workspace): la regla
// "AGENTS lean" estaba escrita desde el dia uno y el archivo llego a 892 lineas en ese repo. No
// se incumple por descuido: agregar una linea tiene premio visible y sacarla no tiene ninguno.
// Un aviso no cambia ese incentivo; un gate si.
//
// Que hacer cuando salta, en orden:
//   1. .aplica a TODA tarea? Si no, va a una skill, a un playbook o a work/<tarea>.md.
//   2. .ya lo hace cumplir una tool? Entonces el texto es un duplicado que se va a pudrir.
//   3. .se puede GENERAR en vez de escribir? (un indice de tools no deberia escribirse a mano)
//   4. .sigue siendo cierto? Medirlo, no suponerlo.

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const core = require('../lib/presupuesto-docs')

const RAIZ = process.cwd()
const argv = process.argv.slice(2)

function ayuda() {
  console.log('Uso: node harness.js presupuesto [--json] [--reorg] [--sin-delta]')
  console.log('  mide AGENTS.md, CLAUDE.md, memory/MEMORY.md y work/PROGRESO.md contra su tope,')
  console.log('  y cuanto CRECIERON contra el ultimo commit (maximo +' + core.CRECIMIENTO_MAXIMO + ').')
  console.log('  --reorg      mover secciones dentro de un archivo: saltea el gate de crecimiento')
  console.log('  --sin-delta  solo el tope, como antes')
  console.log('  sale 1 si alguno se paso.')
}

if (argv.includes('--help') || argv.includes('-h')) { ayuda(); process.exit(0) }

const lineasDe = (rel) => {
  const abs = path.join(RAIZ, rel)
  if (!fs.existsSync(abs)) return null
  return fs.readFileSync(abs, 'utf8').split('\n').length
}

const medidos = core.PRESUPUESTO.map((p) => ({ archivo: p.archivo, lineas: lineasDe(p.archivo) }))
const r = core.evaluar(medidos)

// El delta se mide contra HEAD y llegando hasta el WORKTREE, no hasta el indice: asi da lo mismo
// antes y despues de commitear, o sea que no se evita commiteando primero.
// Sin git no se inventa un verde: se dice que no se pudo medir.
function crecimientos() {
  let salida
  try {
    salida = execFileSync('git', ['diff', '--numstat', 'HEAD', '--', ...core.PRESUPUESTO.map((p) => p.archivo)],
      { encoding: 'utf8', cwd: RAIZ })
  } catch { return null }
  const porArchivo = new Map()
  for (const linea of String(salida).split('\n').filter(Boolean)) {
    const [mas, menos, archivo] = linea.split('\t')
    if (!archivo) continue
    porArchivo.set(archivo, (Number(mas) || 0) - (Number(menos) || 0))
  }
  return core.PRESUPUESTO.map((p) => ({ archivo: p.archivo, crecio: porArchivo.get(p.archivo) || 0 }))
}

const saltearDelta = argv.includes('--sin-delta') || argv.includes('--reorg')
const medidosDelta = saltearDelta ? null : crecimientos()
const rd = medidosDelta ? core.evaluarDelta(medidosDelta) : null

if (argv.includes('--json')) {
  console.log(JSON.stringify({ tope: r, delta: rd }, null, 2))
} else {
  console.log('==> presupuesto de los documentos de arranque')
  console.log(core.informe(r))
  if (!r.ok) {
    console.log('')
    console.log('Se lee TODO esto en cada tarea. Que sacar, en orden:')
    console.log('  1. lo que no aplica a toda tarea -> skill / playbook / work/<tarea>.md')
    console.log('  2. lo que ya hace cumplir una tool -> el texto es un duplicado que se pudre')
    console.log('  3. lo que se puede generar -> generarlo (ej. el indice de tools)')
    console.log('  4. lo que ya no es cierto -> medirlo y corregirlo')
  }

  console.log('')
  if (saltearDelta) {
    console.log('==> crecimiento: no medido (--reorg / --sin-delta)')
  } else if (!rd) {
    console.log('==> crecimiento: NO SE PUDO MEDIR (sin git). No es un verde, es un no se sabe.')
  } else {
    console.log(`==> crecimiento contra el ultimo commit (maximo +${rd.tope} por documento)`)
    const txt = core.informeDelta(rd)
    console.log(txt || '  ninguno se movio')
  }
}

const okDelta = !rd || rd.ok
process.exit(r.ok && okDelta ? 0 : 1)
