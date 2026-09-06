// fallos.js - agrupa las corridas fallidas de `metrics/tool-runs.log` en modos de falla.
//
// Uso: node harness.js fallos [--desde AAAA-MM-DD] [--dias N] [--minimo N] [--json] [--todos] [--gate]
//
// SOLO LEE. Sin `--gate` es un informe y sale 0 siempre; con `--gate` sale 1 si el LOG MISMO esta
// sucio -lineas que no se pueden leer-, que es lo unico de aca que se puede exigir en verde: los
// modos de falla son historia y no se arreglan de una. Lo corre el cierre para decir que huecos
// del harness aparecieron en la tanda, que es lo que hasta hoy solo salia si alguien se acordaba.
//
// Por que existe: escribimos este log desde el 10/08 y nunca lo leimos. La primera vez que se
// agrupo -31/08- salieron tres cosas en cinco minutos: 194 lineas rotas por un SQL multilinea,
// `--help` saliendo con 2 en varias tools (pedir ayuda contado como fallo), y kove-cargar-horas
// fallando en 59 de sus 62 corridas. Ninguna de las tres necesitaba una herramienta nueva: solo
// que alguien mirara.
//
// La logica vive en `scripts/lib/fallos-core.js` y se prueba sola.

const fs = require('fs')
const path = require('path')
const core = require('../lib/fallos-core')

const RAIZ = process.cwd()
const LOG = path.join(RAIZ, 'metrics', 'tool-runs.log')
const argv = process.argv.slice(2)

// Una bandera que la tool no conoce FRENA con 2. Sin esto, un criterio de aceptacion escrito con un
// flag que no existe -`fallos --gate` el 01/09, cuando --gate todavia no estaba- pasa por verde sin
// medir nada: exactamente el mismo agujero que tenia `features` el dia anterior. Es un defecto de
// familia, no de una tool.
const CONOCIDAS = new Set(['--desde', '--dias', '--minimo', '--json', '--todos', '--gate', '--help', '-h'])
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (!a.startsWith('-')) continue
  if (!CONOCIDAS.has(a)) {
    console.error(`no conozco la bandera "${a}". Uso: node harness.js fallos [--desde F] [--dias N] [--minimo N] [--json] [--todos] [--gate]`)
    process.exit(2)
  }
  if (a === '--desde' || a === '--dias' || a === '--minimo') i++
}

if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Uso: node harness.js fallos [--desde AAAA-MM-DD] [--dias N] [--minimo N] [--json] [--todos] [--gate]')
  console.log('')
  console.log('Agrupa las corridas fallidas del log en modos de falla. Separa los GATES -que salen')
  console.log('1 porque encontraron algo- de las tools de accion, que es donde hay un hueco real.')
  process.exit(0)
}

const tomar = (b, def) => {
  const i = argv.indexOf(b)
  if (i < 0) return def
  const v = argv[i + 1]
  return v === undefined ? def : v
}

if (!fs.existsSync(LOG)) {
  // Sin log no se puede medir, y eso NO es "no hay fallos".
  console.log('no hay metrics/tool-runs.log todavia: nada que agrupar (no es un OK)')
  process.exit(0)
}

// La ventana por defecto son 30 dias: los modos de falla de hace tres meses ya no describen al
// harness de hoy, y mezclarlos hace que un hueco ya tapado siga apareciendo arriba de todo.
function desdeCuando() {
  const explicito = tomar('--desde', null)
  if (explicito) return explicito
  if (argv.includes('--todos')) return null
  const dias = Number(tomar('--dias', 30))
  const d = new Date(Date.now() - (Number.isFinite(dias) ? dias : 30) * 86400000)
  return d.toISOString().slice(0, 10)
}

const desde = desdeCuando()
const minimo = Number(tomar('--minimo', 4)) || 4
const r = core.agrupar(core.parsear(fs.readFileSync(LOG, 'utf8')), { minimo, desde })

// Con --gate el codigo de salida ES el veredicto, y lo que se exige es UNA cosa: que el log se
// pueda leer entero. Los modos de falla no se exigen en verde -son historia, y ponerse rojo por
// ellos seria un gate que nace imposible-; lo que si tiene arreglo es que la telemetria este sucia,
// porque envenena cualquier medicion que salga de ella.
if (argv.includes('--gate')) {
  if (r.rotas) {
    console.error(`${r.rotas} linea(s) de metrics/tool-runs.log no se pueden leer: la telemetria esta sucia.`)
    console.error('Antes de limpiarlas, encontra QUE las rompe: una linea rota de hoy dice que la causa sigue viva.')
    process.exit(1)
  }
  console.log('OK  el log de telemetria se lee entero')
  process.exit(0)
}

if (argv.includes('--json')) {
  console.log(JSON.stringify(r, null, 2))
} else {
  console.log(`==> modos de falla${desde ? ` desde ${desde}` : ' (todo el historico)'}, repetidos ${minimo}+ veces`)
  console.log(core.informe(r))
  if (r.gaps.length || r.casiSiempreFalla.length || r.ayudaRota.length) {
    console.log('')
    console.log('Cada uno de estos es una ficha candidata: la falla que se repite no es mala suerte,')
    console.log('es una tool que pide algo que no se sabe, o que no dice lo que necesita.')
  }
}
