const { test } = require('node:test')
const assert = require('node:assert')

const a = require('./ablacion-core')

const corrida = (tool, exit = 0, ms = 100, sello = '2026-09-06T10:00:00') => ({ tool, exit, ms, sello })

// --- esGate --------------------------------------------------------------------------------
test('una pieza que sale con codigo distinto de 0 es un gate', () => {
  assert.equal(a.esGate('if (mal) process.exit(1)'), true)
})

test('la forma ternaria tambien se reconoce como gate', () => {
  assert.equal(a.esGate('process.exit(ok ? 0 : 1)'), true)
})

// Contarle rojos a una tool informativa da un numero que no significa nada.
test('una pieza que declara que no bloquea y nunca sale con rojo es informativa', () => {
  assert.equal(a.esGate('// informativo, no bloquea\nprocess.exit(0)'), false)
})

// Lo que la pieza HACE manda sobre lo que DICE: un comentario desactualizado no cambia el
// comportamiento, y creerle al comentario dejaria un gate real fuera del analisis.
test('si dice que no bloquea pero sale con 1, es un gate igual', () => {
  assert.equal(a.esGate('// informativo, no bloquea\nprocess.exit(1)'), true)
})

test('un script de bash que sale con 1 tambien es un gate', () => {
  assert.equal(a.esGate('#!/usr/bin/env bash\nif [ -z "$x" ]; then exit 1; fi'), true)
})

// La mencion de otra tool informativa no convierte a esta en informativa: paso con `check`, que
// comenta que `doctor` lo es, y quedo clasificada como no-gate siendo LA compuerta.
test('mencionar que OTRA tool es informativa no cambia la propia clasificacion', () => {
  const fuente = '// check.js - la compuerta\n' + '//\n'.repeat(25) +
    '// (doctor es informativo)\nprocess.exit(1)'
  assert.equal(a.esGate(fuente), true)
})

test('una pieza que solo sale con 0 no es un gate', () => {
  assert.equal(a.esGate('process.exit(0)'), false)
})

// --- medir ---------------------------------------------------------------------------------
test('agrupa por tool y suma el tiempo', () => {
  const f = a.medir([corrida('check', 0, 100), corrida('check', 1, 300)])
  assert.equal(f.length, 1)
  assert.equal(f[0].corridas, 2)
  assert.equal(f[0].ms, 400)
})

test('cuenta como rojo cualquier exit distinto de 0', () => {
  const f = a.medir([corrida('check', 0), corrida('check', 1), corrida('check', 2)])
  assert.equal(f[0].rojos, 2)
})

test('ordena de mas cara a mas barata', () => {
  const f = a.medir([corrida('barata', 0, 10), corrida('cara', 0, 900)])
  assert.equal(f[0].tool, 'cara')
})

test('el porcentaje se calcula sobre el tiempo total', () => {
  const f = a.medir([corrida('a', 0, 750), corrida('b', 0, 250)])
  assert.equal(Math.round(f[0].porcentaje), 75)
})

test('guarda cuando fue el ultimo rojo', () => {
  const f = a.medir([corrida('x', 1, 10, '2026-01-01T00:00:00'), corrida('x', 1, 10, '2026-09-06T00:00:00')])
  assert.equal(f[0].ultimoRojo, '2026-09-06T00:00:00')
})

test('sin corridas no explota', () => {
  assert.deepStrictEqual(a.medir([]), [])
})

// --- veredicto -----------------------------------------------------------------------------
test('un gate que atajo algo carga peso', () => {
  const f = a.medir(Array.from({ length: 20 }, (_, i) => corrida('check', i < 3 ? 1 : 0)))
  assert.equal(a.veredicto(f[0]).estado, 'carga peso')
})

test('pocas corridas no alcanzan para juzgar', () => {
  const f = a.medir([corrida('nueva', 0)])
  assert.equal(a.veredicto(f[0]).estado, 'sin datos')
})

test('un gate que nunca encontro nada y es caro se marca en mayusculas', () => {
  const f = a.medir([...Array.from({ length: 20 }, () => corrida('caro', 0, 1000)),
    corrida('otra', 0, 10)])
  const v = a.veredicto(f[0])
  assert.equal(v.estado, 'MIRAR')
  assert.match(v.porque, /nunca encontro nada/)
})

test('un gate barato que nunca encontro nada se marca, pero sin gritar', () => {
  const f = a.medir([...Array.from({ length: 20 }, () => corrida('barato', 0, 1)),
    corrida('caro', 0, 10000)])
  assert.equal(a.veredicto(f.find((x) => x.tool === 'barato')).estado, 'mirar')
})

// Una tool informativa nunca es candidata: su exit no significa hallazgo.
test('una informativa no se juzga por sus rojos', () => {
  const f = a.medir(Array.from({ length: 30 }, () => corrida('doctor', 0, 100)))
  assert.equal(a.veredicto(f[0], { gate: false }).estado, 'informativa')
})

// Conservador a proposito: si no se sabe, se asume gate y se juzga.
test('sin metadatos se asume que es un gate', () => {
  const f = a.medir(Array.from({ length: 20 }, () => corrida('x', 1)))
  assert.equal(a.veredicto(f[0]).estado, 'carga peso')
})

test('los umbrales son parametros', () => {
  const f = a.medir([corrida('x', 0)])
  // Con minimoCorridas por defecto seria "sin datos"; bajandolo, ya se juzga. Es la unica tool,
  // asi que se lleva el 100% del tiempo y por eso el veredicto grita.
  assert.equal(a.veredicto(f[0], {}, { minimoCorridas: 1 }).estado, 'MIRAR')
  assert.equal(a.veredicto(f[0], {}, { minimoCorridas: 1, caroPorciento: 101 }).estado, 'mirar')
})

// --- masCaras ------------------------------------------------------------------------------
test('lista las mas caras en orden', () => {
  const f = a.medir([corrida('a', 0, 100), corrida('b', 0, 900)])
  assert.equal(a.masCaras(f, 1)[0].tool, 'b')
})
