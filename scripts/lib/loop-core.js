// loop-core.js - las salidas de un loop que NO son el exito, decididas sobre datos ya recolectados.
// Puro: recibe corridas ya parseadas, no lee disco ni imprime.
//
// Por que existe: `aceptacion` cubre la salida por EXITO -la regla de parada del ticket-, que es
// una de seis. Las otras cinco estaban documentadas en docs/loop-engineering.md y no las medía
// nadie, o sea que existian como intencion. Las tres que se pueden medir sin inventar
// instrumentacion nueva salen del log que el harness ya escribe en cada corrida
// (metrics/tool-runs.log): cuantas vueltas van, si dos fallos son el mismo, y cuanto se gasto.
//
// Las otras dos -limite de permisos y evidencia desconectada- NO se miden aca a proposito: una es
// una decision de politica (que se puede tocar) y la otra es un juicio sobre el razonamiento del
// agente. Un numero inventado para ellas daria una falsa sensacion de cobertura.

// Un loop no termina en "listo": termina en uno de estos, y decirlo cambia que hace el que recibe.
const ESTADOS = {
  VERIFICADO: 'verificado',
  REVISION: 'requiere revision',
  BLOQUEADO: 'bloqueado',
  PRESUPUESTO: 'cortado por presupuesto',
}

const TOPE_VUELTAS = 5
const TOPE_MISMO_FALLO = 2

// La FIRMA de un fallo: que tool, con que argumentos y con que codigo de salida. Dos corridas con
// la misma firma son el mismo fallo, y reintentar lo mismo esperando otro resultado es el
// desperdicio mas caro de un loop.
function firma(corrida) {
  if (!corrida || corrida.exit === 0) return null
  return `${corrida.tool} ${String(corrida.args || '').trim()} -> ${corrida.exit}`
}

// Cuantas vueltas lleva el loop: cada corrida de una tool de VERIFICACION es un intento de cerrar.
// Las tools de lectura (buscar, metricas) no son vueltas: no intentan cerrar nada.
const TOOLS_DE_VUELTA = new Set(['check', 'aceptacion', 'test', 'cierre'])

function vueltas(corridas) {
  return (corridas || []).filter((c) => TOOLS_DE_VUELTA.has(c.tool)).length
}

// Fallos consecutivos con la misma firma. Se mira la racha FINAL, no el total: dos fallos iguales
// separados por un exito no son falta de progreso, son dos problemas distintos.
function rachaDelMismoFallo(corridas) {
  const lista = (corridas || []).filter((c) => TOOLS_DE_VUELTA.has(c.tool))
  let racha = 0
  let cual = null
  for (let i = lista.length - 1; i >= 0; i--) {
    const f = firma(lista[i])
    if (!f) break
    if (cual === null) { cual = f; racha = 1; continue }
    if (f !== cual) break
    racha++
  }
  return { firma: cual, veces: racha }
}

// `presupuesto` es { ms, corridas } con los topes; cualquiera puede faltar.
function gastado(corridas) {
  const lista = corridas || []
  return {
    corridas: lista.length,
    ms: lista.reduce((t, c) => t + (Number(c.ms) || 0), 0),
  }
}

// Decide en QUE estado esta el loop. El orden importa: primero lo que obliga a parar por seguridad
// o plata, despues lo que pide criterio humano, y el exito ultimo -porque un exito declarado sobre
// un loop que ya se paso del presupuesto sigue siendo un problema que alguien tiene que ver-.
function evaluar({ corridas = [], aceptacionOk = null, presupuesto = {}, topes = {} } = {}) {
  const topeVueltas = topes.vueltas || TOPE_VUELTAS
  const topeMismoFallo = topes.mismoFallo || TOPE_MISMO_FALLO
  const g = gastado(corridas)
  const v = vueltas(corridas)
  const r = rachaDelMismoFallo(corridas)
  const razones = []

  if (presupuesto.ms && g.ms > presupuesto.ms) {
    razones.push({ salida: 'presupuesto', estado: ESTADOS.PRESUPUESTO,
      detalle: `${Math.round(g.ms / 1000)}s gastados, el tope es ${Math.round(presupuesto.ms / 1000)}s` })
  }
  if (presupuesto.corridas && g.corridas > presupuesto.corridas) {
    razones.push({ salida: 'presupuesto', estado: ESTADOS.PRESUPUESTO,
      detalle: `${g.corridas} corridas, el tope es ${presupuesto.corridas}` })
  }
  if (r.veces >= topeMismoFallo) {
    razones.push({ salida: 'fallo repetido', estado: ESTADOS.BLOQUEADO,
      detalle: `${r.veces} fallos seguidos con la misma causa: ${r.firma}` })
  }
  if (v > topeVueltas) {
    razones.push({ salida: 'tope de iteraciones', estado: ESTADOS.REVISION,
      detalle: `${v} vueltas, el tope es ${topeVueltas}` })
  }

  if (razones.length) {
    // Gana la primera: el orden de arriba ya es el de gravedad.
    return { estado: razones[0].estado, razones, vueltas: v, gastado: g, repetido: r }
  }
  if (aceptacionOk === true) {
    return { estado: ESTADOS.VERIFICADO, razones: [], vueltas: v, gastado: g, repetido: r }
  }
  // Sin regla de parada no se puede declarar exito: "no encontre nada" no es "esta bien".
  return {
    estado: ESTADOS.REVISION,
    razones: [{
      salida: aceptacionOk === false ? 'la regla de parada no pasa' : 'sin regla de parada',
      estado: ESTADOS.REVISION,
      detalle: aceptacionOk === false
        ? 'algun criterio de HECHO_CUANDO.md da rojo'
        : 'no hay HECHO_CUANDO.md: nadie escribio cuando esto termina',
    }],
    vueltas: v,
    gastado: g,
    repetido: r,
  }
}

module.exports = { ESTADOS, TOPE_VUELTAS, TOPE_MISMO_FALLO, firma, vueltas, rachaDelMismoFallo, gastado, evaluar }
