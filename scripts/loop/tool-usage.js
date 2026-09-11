// tool-usage.js - el CONTADOR de uso de las herramientas de scripts/, y donde se va el TIEMPO.
//
// Sirve para decidir que tool conviene mantener y cual quitar (mantener el harness ligero), y
// cual conviene optimizar (o llamar menos veces). Lo alimenta harness.js: metrics/tool-usage.log
// (una linea por corrida) y metrics/tool-runs.log (como termino y cuanto tardo cada una).
//
// Uso: node harness.js tool-usage
//   - tabla de tools ORDENADA por uso (mas usada arriba) con la fecha del ultimo uso
//   - las tools instrumentadas que NUNCA se usaron (candidatas a quitar)
//   - donde se va el TIEMPO: total y % sobre el total medido, mediana por corrida, y los
//     procesos colgados (zombis) y las corridas anidadas nombrados en vez de ocultos

const fs = require('fs')
const path = require('path')
const { ranking, sinUso, tiempoPorTool } = require('../lib/tool-usage-core')
const { descubrirTools } = require('../lib/tools-registro')

const RAIZ = process.cwd()
const LOG = path.join(RAIZ, 'metrics', 'tool-usage.log')
const CORRIDAS = path.join(RAIZ, 'metrics', 'tool-runs.log')

function leer(archivo) {
  try { return fs.readFileSync(archivo, 'utf8') } catch { return '' }
}

const comoTiempo = (ms) => (ms == null ? '' : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`)
const comoPct = (parte, total) => (total ? `${((parte / total) * 100).toFixed(1)}%` : '')

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Uso: node harness.js tool-usage')
    console.log('  tabla de tools por uso (mas usada arriba) + las que nunca se usaron +')
    console.log('  donde se va el tiempo (total, %, mediana; zombis y anidadas nombrados aparte).')
    process.exit(0)
  }

  const contenido = leer(LOG)

  console.log('== Contador de uso de tools ==')
  const filas = ranking(contenido)
  if (!filas.length) {
    console.log('  (sin registros todavia: corre alguna tool y volve a mirar)')
  } else {
    console.log('  usos  ultimo-uso           tool')
    for (const f of filas) {
      console.log(`${String(f.usos).padStart(6)}  ${f.ultimo.padEnd(19)}  ${f.tool}`)
    }
  }

  console.log('')
  console.log('== Tools instrumentadas SIN uso registrado (candidatas a quitar) ==')
  const todas = [...descubrirTools(RAIZ).keys()].filter((t) => t !== 'tool-usage')
  const faltantes = sinUso(contenido, todas)
  if (!faltantes.length) console.log('  (ninguna: todas las tools instrumentadas se usaron al menos una vez)')
  else for (const t of faltantes) console.log(`  - ${t}`)

  const corridas = leer(CORRIDAS)
  const t = tiempoPorTool(corridas)
  const totalFilas = t.filas.length + t.resto.length
  if (totalFilas) {
    console.log('')
    console.log(`== Donde se va el tiempo (medido, top ${t.filas.length} de ${totalFilas}) ==`)
    for (const f of t.filas) {
      const pct = comoPct(f.total, t.totalMedido).padStart(6)
      console.log(`  ${comoTiempo(f.total).padStart(8)}  ${pct}  en ${String(f.n).padStart(4)} corrida(s)  ${comoTiempo(f.mediana).padStart(7)} c/u  ${f.tool}`)
    }
    if (t.resto.length) {
      const msResto = t.resto.reduce((a, f) => a + f.total, 0)
      console.log(`  ${comoTiempo(msResto).padStart(8)}  ${comoPct(msResto, t.totalMedido).padStart(6)}  en las otras ${t.resto.length} tool(s)`)
    }
    console.log(`  total medido: ${comoTiempo(t.totalMedido)}`)
    // Una tool que corre adentro de otra suma su tiempo DOS veces en esta lista: una como ella
    // misma y otra dentro del total de quien la lanzo. Decirlo es la diferencia entre un ranking
    // y una trampa que manda a optimizar la tool equivocada (ej.: `check`, que es la suma de sus
    // propios gates).
    if (t.conPadre) {
      console.log(`  de ese total, ${comoTiempo(t.msAnidado)} (${comoPct(t.msAnidado, t.totalMedido)}) corrio ADENTRO de otra tool: esta contado dos veces`)
    }
    if (t.sinDato) {
      console.log(`  ${t.sinDato} corrida(s) son de antes de este cambio y no registran quien las lanzo: no se sabe si fueron anidadas`)
    }
    console.log('  (solo cuenta lo corrido por harness.js: las corridas de antes de harness.js no tienen tiempo)')
    // Se dicen, no se descartan en silencio: una lista que oculta lo que saco se lee como si
    // hubiera contado todo.
    for (const z of t.zombis) {
      console.log(`  fuera del total: ${z.tool} ${comoTiempo(z.ms)} en una sola corrida (proceso colgado, no trabajo)`)
    }
  }
}

main()
