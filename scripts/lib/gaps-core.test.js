const { test } = require('node:test')
const assert = require('node:assert')

const g = require('./gaps-core')

const modo = (tool, veces = 5, exit = 1) => ({ tool, exit, veces, ultima: '2026-09-06' })

// --- estaAnotado ---------------------------------------------------------------------------
test('una tool nombrada junto a un problema cuenta como anotada', () => {
  assert.equal(g.estaAnotado(modo('spell'), ['- spell falla cada tanto y hay que arreglarlo']), true)
})

// Mencionarla no alcanza: si bastara, cualquier linea que la nombre taparia el hueco.
test('mencionar la tool sin hablar de un problema NO la da por anotada', () => {
  assert.equal(g.estaAnotado(modo('spell'), ['- se corrio spell y quedo en verde']), false)
})

test('si la tool no aparece en ningun texto, no esta anotada', () => {
  assert.equal(g.estaAnotado(modo('spell'), ['- nada que ver']), false)
})

test('sin textos donde buscar, nada esta anotado', () => {
  assert.equal(g.estaAnotado(modo('spell'), []), false)
})

test('un modo sin tool no se da por anotado', () => {
  assert.equal(g.estaAnotado({ veces: 9 }, ['cualquier cosa']), false)
})

// --- huecos --------------------------------------------------------------------------------
test('un modo repetido y no anotado es un hueco', () => {
  const h = g.huecos([modo('check', 6)], ['- todo bien'])
  assert.equal(h.length, 1)
  assert.equal(h[0].tool, 'check')
})

test('un modo repetido pero ya anotado NO es un hueco', () => {
  const h = g.huecos([modo('check', 6)], ['- check falla repetido, pendiente de arreglar'])
  assert.equal(h.length, 0)
})

// El minimo existe para no convertir una falla suelta en trabajo.
test('un modo que se repitio poco no llega a hueco', () => {
  assert.equal(g.huecos([modo('check', 2)], []).length, 0)
})

test('el minimo es un parametro', () => {
  assert.equal(g.huecos([modo('check', 2)], [], { minimo: 2 }).length, 1)
})

test('la propuesta nombra la tool, el exit y cuantas veces', () => {
  const h = g.huecos([modo('test', 7, 2)], [])
  assert.match(h[0].propuesta, /`test`/)
  assert.match(h[0].propuesta, /exit 2/)
  assert.match(h[0].propuesta, /7 veces/)
})

test('sin modos no hay huecos y no explota', () => {
  assert.deepStrictEqual(g.huecos([], []), [])
})

// --- resumir -------------------------------------------------------------------------------
test('sin huecos el resumen esta ok', () => {
  assert.equal(g.resumir([], 3).ok, true)
})

test('con huecos el resumen los cuenta', () => {
  const r = g.resumir([{ tool: 'x' }], 3)
  assert.equal(r.ok, false)
  assert.equal(r.huecos, 1)
  assert.equal(r.modos, 3)
})
