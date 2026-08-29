// tool-usage-core.js - logica pura del contador de uso: parsea metrics/tool-usage.log (dos
// columnas, fecha<TAB>tool, sin encabezado) y metrics/tool-runs.log (como termino y cuanto tardo
// cada corrida) y arma el ranking de uso, el de tiempo, y las tools que nunca se usaron.
//
// Sin filesystem aca: eso lo hace tool-usage.js. Los logs los escribe harness.js en cada corrida.

function parsear(contenido) {
  const usos = new Map() // tool -> { usos, ultimo }
  for (const linea of (contenido || '').split(/\r?\n/)) {
    if (!linea.trim()) continue
    const [fecha, tool] = linea.split('\t')
    if (!fecha || !tool) continue
    const actual = usos.get(tool) || { usos: 0, ultimo: '' }
    actual.usos++
    if (fecha > actual.ultimo) actual.ultimo = fecha
    usos.set(tool, actual)
  }
  return usos
}

// Ordenada de la mas usada a la menos usada.
function ranking(contenido) {
  return [...parsear(contenido).entries()]
    .map(([tool, d]) => ({ tool, usos: d.usos, ultimo: d.ultimo }))
    .sort((a, b) => b.usos - a.usos)
}

// De la lista de tools conocidas, las que no tienen ni un solo registro en el log.
function sinUso(contenido, todas) {
  const usadas = parsear(contenido)
  return [...todas].filter((t) => !usadas.has(t)).sort()
}

// Una corrida de mas de 10 minutos es un proceso que quedo colgado (la maquina se suspendio, el
// gate se quedo esperando algo que nunca volvio), no trabajo de la tool. No entra en el TOTAL del
// ranking de tiempo -que es una suma, y un solo zombi la decide-, pero si en la mediana de esa
// misma tool, donde un outlier no molesta.
const ZOMBI_MS = 10 * 60 * 1000

function mediana(xs) {
  if (!xs.length) return null
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

// metrics/tool-runs.log: sello, tool, exit, ms, argumentos, detalle, padre (7a columna, la
// escribe harness.js desde esta ronda). Una corrida anterior a este cambio no tiene padre: se marca
// `undefined` para no confundirla con "se sabe que corrio suelta" (padre === '').
function parsearCorridas(contenido) {
  const porTool = new Map() // tool -> [{ ms, padre }]
  for (const linea of (contenido || '').split(/\r?\n/)) {
    if (!linea.trim()) continue
    const partes = linea.split('\t')
    const tool = partes[1]
    const ms = Number(partes[3])
    if (!tool || partes[3] === undefined || Number.isNaN(ms)) continue
    const padre = partes.length >= 7 ? partes[6] : undefined
    if (!porTool.has(tool)) porTool.set(tool, [])
    porTool.get(tool).push({ ms, padre })
  }
  return porTool
}

// El ranking de "donde se va el tiempo": nace SIN el bug de sumar procesos colgados al total, con
// el % de cada tool sobre el total medido, el resto declarado en vez de cortado en silencio, y la
// anidacion (una tool que corrio ADENTRO de otra) contada aparte para no leerla dos veces.
function tiempoPorTool(contenido, { tope = 10 } = {}) {
  const porTool = parsearCorridas(contenido)
  const zombis = []
  let conPadre = 0
  let sinDato = 0
  let msAnidado = 0
  const filas = []
  for (const [tool, corridas] of porTool) {
    for (const c of corridas) {
      if (c.ms > ZOMBI_MS) zombis.push({ tool, ms: c.ms })
      if (c.padre === undefined) sinDato++
      else {
        conPadre++
        if (c.padre && c.ms <= ZOMBI_MS) msAnidado += c.ms
      }
    }
    // El total y la mediana de ESTA fila se calculan sobre las corridas sanas: es la misma tool,
    // sin sus zombis (que ya quedaron nombrados arriba y no se pierden, solo no entran a la suma).
    const sanas = corridas.filter((c) => c.ms <= ZOMBI_MS).map((c) => c.ms)
    if (!sanas.length) continue
    filas.push({ tool, total: sanas.reduce((a, b) => a + b, 0), n: sanas.length, mediana: mediana(sanas) })
  }
  filas.sort((a, b) => b.total - a.total)
  const totalMedido = filas.reduce((a, f) => a + f.total, 0)
  return {
    filas: filas.slice(0, tope),
    resto: filas.slice(tope),
    totalMedido,
    zombis: zombis.sort((a, b) => b.ms - a.ms),
    conPadre,
    sinDato,
    msAnidado,
  }
}

module.exports = { parsear, ranking, sinUso, mediana, ZOMBI_MS, tiempoPorTool }
