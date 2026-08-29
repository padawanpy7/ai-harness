const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parsear, ranking, sinUso, mediana, ZOMBI_MS, tiempoPorTool } = require('./tool-usage-core')

test('log vacio: sin entradas, ranking vacio y todas cuentan como sin uso', () => {
  assert.equal(parsear('').size, 0)
  assert.deepEqual(ranking(''), [])
  assert.deepEqual(sinUso('', ['salud', 'doctor']), ['doctor', 'salud'])
})

test('log inexistente (contenido undefined/null) no explota', () => {
  assert.deepEqual(ranking(undefined), [])
  assert.deepEqual(ranking(null), [])
})

test('lineas malformadas se descartan sin romper el conteo', () => {
  const log = [
    'linea sin tab',
    '2026-08-16T10:00:00\t',
    '\tsalud',
    '',
    '2026-08-16T10:00:00\tsalud',
  ].join('\n')
  const r = ranking(log)
  assert.equal(r.length, 1)
  assert.equal(r[0].tool, 'salud')
  assert.equal(r[0].usos, 1)
})

test('ordena por usos, de mas a menos', () => {
  const log = [
    '2026-08-16T10:00:00\tdoctor',
    '2026-08-16T10:00:01\tsalud',
    '2026-08-16T10:00:02\tsalud',
    '2026-08-16T10:00:03\tsalud',
    '2026-08-16T10:00:04\tinventario',
    '2026-08-16T10:00:05\tinventario',
  ].join('\n')
  assert.deepEqual(ranking(log).map((r) => r.tool), ['salud', 'inventario', 'doctor'])
})

test('la fecha de ultimo uso es la mas reciente, no la primera ni la ultima linea', () => {
  const log = [
    '2026-08-16T10:00:00\tsalud',
    '2026-08-14T09:00:00\tsalud',
    '2026-08-16T12:00:00\tsalud',
  ].join('\n')
  assert.equal(ranking(log)[0].ultimo, '2026-08-16T12:00:00')
})

test('tools instrumentadas que nunca se usaron quedan en sinUso, ordenadas', () => {
  const log = '2026-08-16T10:00:00\tsalud\n2026-08-16T10:00:01\tdoctor\n'
  assert.deepEqual(sinUso(log, ['salud', 'doctor', 'skill-sync', 'ascii']), ['ascii', 'skill-sync'])
})

test('sinUso con todas usadas devuelve vacio', () => {
  const log = '2026-08-16T10:00:00\tsalud\n'
  assert.deepEqual(sinUso(log, ['salud']), [])
})

// --- mediana -------------------------------------------------------------------------------
test('mediana: vacio da null, un solo dato es el mismo, e impar/par sale bien', () => {
  assert.equal(mediana([]), null)
  assert.equal(mediana([5]), 5)
  assert.equal(mediana([1, 3, 2]), 2)
  assert.equal(mediana([1, 2, 3, 4]), 2.5)
})

// --- tiempoPorTool: nace sin el bug de sumar procesos colgados ------------------------------
// Formato de metrics/tool-runs.log: sello, tool, exit, ms, argumentos, detalle, padre (7a
// columna, opcional: las corridas de antes de esta ronda no la tienen).
const fila = (tool, ms, { exit = 0, padre } = {}) =>
  ['2026-08-22T10:00:00', tool, exit, ms, '', '', padre].join('\t')

test('una corrida zombi (>10 min) no entra en el total ni en el conteo, pero se nombra abajo', () => {
  const log = [
    fila('check', 5800, { padre: '' }),
    fila('check', 6000, { padre: '' }),
    fila('check', 14 * 60 * 60 * 1000, { padre: '', exit: 1 }), // el zombi de 14 h
  ].join('\n')
  const r = tiempoPorTool(log)
  const check = r.filas.find((f) => f.tool === 'check')
  assert.equal(check.n, 2)
  assert.equal(check.total, 11800)
  assert.equal(r.totalMedido, 11800)
  assert.equal(r.zombis.length, 1)
  assert.equal(r.zombis[0].tool, 'check')
  assert.equal(r.zombis[0].ms, 14 * 60 * 60 * 1000)
})

test('el umbral de zombi es un limite, no una corrida legitima larga', () => {
  const log = fila('kove-cargar-horas', 399000, { padre: '' })
  const r = tiempoPorTool(log)
  assert.equal(r.filas[0].total, 399000)
  assert.equal(r.zombis.length, 0)
  assert.ok(399000 < ZOMBI_MS)
})

test('el ranking va ordenado por total, con el resto declarado aparte del tope', () => {
  const log = [fila('a', 100), fila('b', 300), fila('c', 200)].join('\n')
  const r = tiempoPorTool(log, { tope: 2 })
  assert.deepEqual(r.filas.map((f) => f.tool), ['b', 'c'])
  assert.deepEqual(r.resto.map((f) => f.tool), ['a'])
})

test('las corridas anidadas (con padre) se declaran aparte, no se ocultan', () => {
  const log = [
    fila('test', 100, { padre: 'check' }),
    fila('test', 200, { padre: 'check' }),
    fila('salud', 500, { padre: '' }),
  ].join('\n')
  const r = tiempoPorTool(log)
  assert.equal(r.conPadre, 3)
  assert.equal(r.sinDato, 0)
  assert.equal(r.msAnidado, 300) // las dos de "test", lanzadas por check
})

test('las corridas de antes de este cambio (sin 7a columna) se cuentan aparte, no se suponen sueltas', () => {
  const viejas = ['2026-08-16T10:00:00', 'salud', 0, 500, '', ''].join('\t') // sin padre
  const r = tiempoPorTool(viejas)
  assert.equal(r.sinDato, 1)
  assert.equal(r.conPadre, 0)
  assert.equal(r.msAnidado, 0)
})
