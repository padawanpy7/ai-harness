// ablacion.js - que pieza del harness carga peso y cual es candidata a jubilarse.
//
// Uso: node harness.js ablacion [--json] [--minimo N]
//
// Por que existe: la Regla 10 -"desmonta andamiaje viejo: saca un componente, observa si el
// resultado empeora y conserva solo lo que carga peso"- esta escrita desde el dia uno y nunca se
// ejecuto, porque no habia con que medir. Cada pieza del harness codifica algo que el modelo no
// podia solo, y esos supuestos caducan: sin medicion, el harness solo crece.
//
// Contesta las dos preguntas que deciden una jubilacion, sobre el log real: **cuanto cuesta** cada
// pieza y **cuantas veces encontro algo**.
//
// INFORMA, NO DECIDE, y la distincion no es cortesia. Un gate que nunca dio rojo puede ser:
//   1. un gate cuyo problema ya no ocurre    -> candidato real
//   2. un gate que lo PREVIENE: nadie escribe lo que sabe que sera rechazado -> sacarlo lo trae
//      de vuelta, y es el caso mas comun en los gates de estilo
//   3. un gate roto que no mira nada          -> eso lo contesta `control-negativo`
// Los datos no separan los tres. Por eso el veredicto dice "mirar", nunca "borrar".

const fs = require('fs')
const path = require('path')
const core = require('../lib/ablacion-core')
const { descubrirTools } = require('../lib/tools-registro')

const RAIZ = process.cwd()
const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Uso: node harness.js ablacion [--json] [--minimo N]')
  console.log('  mide cuanto cuesta cada pieza y cuantas veces atajo algo, sobre metrics/.')
  console.log('  --minimo N  corridas minimas para juzgar una pieza (por defecto 10)')
  console.log('  INFORMA, no decide: un gate que nunca dio rojo puede estar previniendo el problema.')
  process.exit(0)
}

const valorDe = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null }
const minimoCorridas = Number(valorDe('--minimo')) || 10

function corridas() {
  let texto = ''
  try { texto = fs.readFileSync(path.join(RAIZ, 'metrics', 'tool-runs.log'), 'utf8') } catch { return [] }
  return texto.split('\n').filter(Boolean).map((l) => {
    const [sello, tool, exit, ms] = l.split('\t')
    return { sello, tool, exit: Number(exit), ms: Number(ms) }
  }).filter((c) => c.tool)
}

// Si es gate o informativa sale del PROPIO fuente, no de una lista: una lista se desincroniza el
// dia que una tool deja de bloquear y nadie la mueve de columna.
const tools = descubrirTools(RAIZ)
const meta = {}
for (const [nombre, ruta] of tools) {
  let fuente = ''
  try { fuente = fs.readFileSync(ruta, 'utf8') } catch { /* ilegible: se asume gate */ }
  meta[nombre] = { gate: core.esGate(fuente) }
}

const filas = core.medir(corridas())
const conVeredicto = filas.map((f) => ({ ...f, ...core.veredicto(f, meta[f.tool] || {}, { minimoCorridas }) }))

if (argv.includes('--json')) {
  console.log(JSON.stringify({ minimoCorridas, piezas: conVeredicto }, null, 2))
  process.exit(0)
}

const totalMs = filas.reduce((t, f) => t + f.ms, 0)
console.log(`==> ablacion: ${filas.length} pieza(s), ${(totalMs / 1000).toFixed(0)}s de tiempo medido`)
console.log('')
console.log(`  ${'pieza'.padEnd(18)}${'corre'.padStart(6)}${'rojo'.padStart(6)}${'seg'.padStart(8)}${'%'.padStart(6)}  veredicto`)
for (const f of conVeredicto) {
  console.log(`  ${f.tool.padEnd(18)}${String(f.corridas).padStart(6)}${String(f.rojos).padStart(6)}` +
    `${(f.ms / 1000).toFixed(1).padStart(8)}${f.porcentaje.toFixed(0).padStart(5)}%  ${f.estado}`)
}

const candidatas = conVeredicto.filter((f) => f.estado === 'MIRAR' || f.estado === 'mirar')
console.log('')
if (candidatas.length) {
  console.log('  Piezas que nunca encontraron nada (NO son "borrar", son "mirar"):')
  for (const f of candidatas) console.log(`    ${f.tool}: ${f.porque}`)
  console.log('')
  console.log('  Antes de sacar una, contesta cual de las tres es:')
  console.log('    1. su problema ya no ocurre        -> se jubila')
  console.log('    2. lo previene (nadie escribe lo que sabe que sera rechazado) -> se queda')
  console.log('    3. esta rota y no mira nada        -> `node harness.js control-negativo` lo dice')
} else {
  console.log('  todas las piezas con datos suficientes atajaron algo alguna vez')
}

const caras = core.masCaras(conVeredicto, 3)
console.log('')
console.log(`  El tiempo se va en: ${caras.map((c) => `${c.tool} (${c.porcentaje.toFixed(0)}%)`).join(', ')}`)
console.log('  Una pieza cara que carga peso no se jubila: se acota o se hace mas barata.')
