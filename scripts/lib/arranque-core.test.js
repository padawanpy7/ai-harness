const { test } = require('node:test')
const assert = require('node:assert')

const a = require('./arranque-core')

const existeSiEmpiezaCon = (prefijo) => (r) => r.startsWith(prefijo)
const nada = () => false

const ENTRADA = `## 2026-09-06 - una tanda

- Hecho: cosas.
- Pendiente / proximo:
  1. Falta traer \`scripts/loop/loop.js\` desde el otro repo.
  2. Sin empezar: subir lo generico a la plantilla.
- Gotchas / decisiones:
  - algo que no es pendiente y cita \`scripts/loop/otro.js\`
`

// --- extraer pendientes ------------------------------------------------------------------------
test('encuentra los items del bloque de pendientes', () => {
  const p = a.pendientesDe(ENTRADA)
  assert.ok(p.some((x) => /loop\.js/.test(x.texto)))
  assert.ok(p.some((x) => /Sin empezar/.test(x.texto)))
})

// El bloque de gotchas no son pendientes: incluirlo daria hallazgos sobre cosas ya resueltas.
test('el bloque de gotchas NO entra como pendiente', () => {
  const p = a.pendientesDe(ENTRADA)
  assert.ok(!p.some((x) => /otro\.js/.test(x.texto)))
})

test('sin bloque de pendientes, no hay nada que extraer', () => {
  assert.equal(a.pendientesDe('## algo\n- Hecho: nada mas').length, 0)
})

// --- citas -------------------------------------------------------------------------------------
test('saca las rutas citadas entre backticks', () => {
  assert.deepStrictEqual(a.citasDe('ver `scripts/lib/x.js` aca').rutas, ['scripts/lib/x.js'])
})

test('saca el nombre de la tool de un `node pc.js <tool>`', () => {
  assert.deepStrictEqual(a.citasDe('corre `node pc.js loop` ya').tools, ['loop'])
})

test('una palabra suelta entre backticks no es una ruta', () => {
  assert.deepStrictEqual(a.citasDe('la variable `total` vale 3').rutas, [])
})

// --- contradicciones: el caso que justifica la tool ---------------------------------------------
test('un pendiente que dice "falta X" cuando X existe es una contradiccion', () => {
  const p = a.pendientesDe(ENTRADA)
  const h = a.contradicciones(p, { existeRuta: existeSiEmpiezaCon('scripts/'), esToolConocida: nada })
  assert.equal(h.length, 1)
  assert.equal(h[0].tipo, 'pendiente-ya-hecho')
  assert.match(h[0].detalle, /loop\.js/)
})

test('si lo que falta de verdad no existe, no hay contradiccion', () => {
  const p = a.pendientesDe(ENTRADA)
  assert.deepStrictEqual(a.contradicciones(p, { existeRuta: nada, esToolConocida: nada }), [])
})

test('una tool ya registrada citada como pendiente tambien se caza', () => {
  const p = a.pendientesDe('- Pendiente / proximo:\n  1. Falta la tool `node pc.js loop`.')
  const h = a.contradicciones(p, { existeRuta: nada, esToolConocida: (t) => t === 'loop' })
  assert.equal(h.length, 1)
  assert.match(h[0].detalle, /esta registrada/)
})

// Sin verbo de pendiente no se afirma que falte nada: mencionar un archivo no es reclamarlo.
test('mencionar un archivo sin decir que falta NO es contradiccion', () => {
  const p = [{ linea: 1, texto: '  1. Revisar `scripts/lib/x.js` cuando haya tiempo.' }]
  assert.deepStrictEqual(a.contradicciones(p, { existeRuta: () => true, esToolConocida: nada }), [])
})

// --- referencias colgadas ----------------------------------------------------------------------
test('citar un archivo que no existe manda al proximo agente a buscar humo', () => {
  const h = a.referenciasColgadas('ver `scripts/lib/fantasma.js`', { existeRuta: nada })
  assert.equal(h.length, 1)
  assert.equal(h[0].tipo, 'referencia-colgada')
})

test('un placeholder con <> no cuenta como referencia rota', () => {
  const h = a.referenciasColgadas('en `openspec/changes/<T>/algo.md`', { existeRuta: nada })
  assert.equal(h.length, 0)
})

// --- resumen -----------------------------------------------------------------------------------
test('sin hallazgos, el resumen esta ok', () => {
  assert.equal(a.resumir([]).ok, true)
})

test('el resumen agrupa por tipo', () => {
  const r = a.resumir([{ tipo: 'x' }, { tipo: 'x' }, { tipo: 'y' }])
  assert.equal(r.ok, false)
  assert.deepStrictEqual(r.porTipo, { x: 2, y: 1 })
})
