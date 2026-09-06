const { test } = require('node:test')
const assert = require('node:assert')

const l = require('./loop-core')

const ok = (tool, args = '') => ({ tool, args, exit: 0, ms: 100 })
const mal = (tool, args = '', exit = 1) => ({ tool, args, exit, ms: 100 })

// --- firma ---------------------------------------------------------------------------------
test('una corrida exitosa no tiene firma de fallo', () => {
  assert.equal(l.firma(ok('check')), null)
})

test('la firma junta tool, argumentos y exit', () => {
  assert.match(l.firma(mal('check', '--todos', 2)), /check --todos -> 2/)
})

test('el mismo fallo con distinto exit NO es la misma firma', () => {
  assert.notEqual(l.firma(mal('check', '', 1)), l.firma(mal('check', '', 2)))
})

// --- vueltas -------------------------------------------------------------------------------
test('solo las tools de verificacion cuentan como vuelta', () => {
  assert.equal(l.vueltas([ok('check'), ok('buscar'), ok('metricas'), ok('test')]), 2)
})

// --- racha ---------------------------------------------------------------------------------
test('dos fallos iguales seguidos son una racha de 2', () => {
  assert.equal(l.rachaDelMismoFallo([mal('check'), mal('check')]).veces, 2)
})

// Reintentar lo mismo es el desperdicio; dos problemas distintos no lo son.
test('dos fallos DISTINTOS no hacen racha', () => {
  assert.equal(l.rachaDelMismoFallo([mal('check', '-a'), mal('check', '-b')]).veces, 1)
})

test('un exito corta la racha: son dos problemas, no falta de progreso', () => {
  assert.equal(l.rachaDelMismoFallo([mal('check'), ok('check'), mal('check')]).veces, 1)
})

test('si la ultima corrida paso, no hay racha', () => {
  assert.equal(l.rachaDelMismoFallo([mal('check'), ok('check')]).veces, 0)
})

// --- gastado -------------------------------------------------------------------------------
test('suma el tiempo de todas las corridas', () => {
  assert.equal(l.gastado([ok('check'), ok('buscar')]).ms, 200)
})

// --- evaluar: los estados terminales -------------------------------------------------------
test('con la regla de parada en verde, queda VERIFICADO', () => {
  const r = l.evaluar({ corridas: [ok('check')], aceptacionOk: true })
  assert.equal(r.estado, l.ESTADOS.VERIFICADO)
})

// El caso que justifica todo: "no encontre nada" no es "esta bien".
test('sin regla de parada NO se declara exito: pide revision', () => {
  const r = l.evaluar({ corridas: [ok('check')], aceptacionOk: null })
  assert.equal(r.estado, l.ESTADOS.REVISION)
  assert.match(r.razones[0].salida, /sin regla de parada/)
})

test('con la regla de parada en rojo, pide revision y lo dice', () => {
  const r = l.evaluar({ corridas: [ok('check')], aceptacionOk: false })
  assert.equal(r.estado, l.ESTADOS.REVISION)
  assert.match(r.razones[0].detalle, /rojo/)
})

test('dos fallos con la misma causa BLOQUEAN, aunque la aceptacion no se haya corrido', () => {
  const r = l.evaluar({ corridas: [mal('check'), mal('check')] })
  assert.equal(r.estado, l.ESTADOS.BLOQUEADO)
  assert.match(r.razones[0].salida, /fallo repetido/)
})

test('pasarse del tope de vueltas pide revision', () => {
  const corridas = Array.from({ length: 7 }, (_, i) => ok('check', `v${i}`))
  const r = l.evaluar({ corridas, aceptacionOk: true, topes: { vueltas: 5 } })
  assert.equal(r.estado, l.ESTADOS.REVISION)
  assert.match(r.razones[0].salida, /tope de iteraciones/)
})

test('pasarse del presupuesto de tiempo corta por presupuesto', () => {
  const r = l.evaluar({ corridas: [ok('check')], aceptacionOk: true, presupuesto: { ms: 50 } })
  assert.equal(r.estado, l.ESTADOS.PRESUPUESTO)
})

// El presupuesto gana sobre el exito a proposito: un exito declarado sobre un loop que ya se paso
// del presupuesto sigue siendo algo que alguien tiene que mirar.
test('el presupuesto gana sobre un exito declarado', () => {
  const r = l.evaluar({
    corridas: [mal('check'), mal('check')],
    aceptacionOk: true,
    presupuesto: { corridas: 1 },
  })
  assert.equal(r.estado, l.ESTADOS.PRESUPUESTO)
})

test('sin corridas y sin regla de parada, pide revision y no explota', () => {
  const r = l.evaluar({})
  assert.equal(r.estado, l.ESTADOS.REVISION)
  assert.equal(r.vueltas, 0)
})

test('los topes son parametros, no numeros sueltos', () => {
  const r = l.evaluar({ corridas: [mal('check'), mal('check')], topes: { mismoFallo: 3 } })
  assert.notEqual(r.estado, l.ESTADOS.BLOQUEADO)
})
