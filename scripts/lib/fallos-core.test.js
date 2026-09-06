const { test } = require('node:test')
const assert = require('node:assert/strict')
const core = require('./fallos-core')

const fila = (tool, exit, args = '', fecha = '2026-08-30T10:00:00') =>
  [fecha, tool, exit, 100, args, '', ''].join('\t')

test('una linea rota se CUENTA, no se descarta en silencio', () => {
  const p = core.parsear([fila('db-sql', 0), 'from dual', fila('lint', 1)].join('\n'))
  assert.equal(p.filas.length, 2)
  assert.equal(p.rotas.length, 1)
  assert.ok(core.informe(core.agrupar(p)).includes('telemetria misma esta sucia'))
})

// La distincion sin la cual el 28,7 % de fallos del log no significa nada.
test('un gate que sale 1 hizo su trabajo; una tool de accion que sale 1 es un gap', () => {
  const texto = Array.from({ length: 5 }, () => fila('spell', 1, 'AGENTS.md'))
    .concat(Array.from({ length: 5 }, () => fila('kove-cargar-horas', 1, 'ICC-13')))
    .join('\n')
  const r = core.agrupar(core.parsear(texto))
  assert.equal(r.repetidos.length, 2)
  assert.deepEqual(r.gaps.map((g) => g.tool), ['kove-cargar-horas'])
})

test('un modo con pocas repeticiones no es un modo: una vez puede ser cualquier cosa', () => {
  const r = core.agrupar(core.parsear([fila('kove-tarea', 1, 'crear'), fila('kove-tarea', 1, 'crear')].join('\n')))
  assert.equal(r.gaps.length, 0)
  assert.equal(r.grupos.length, 1)
  assert.equal(r.grupos[0].veces, 2)
})

test('el archivo concreto se colapsa: el modo es la tool sobre ese TIPO de cosa', () => {
  const texto = [
    fila('apex-e2e', 1, 'openspec/changes/ICC-110/tests/a.test.js'),
    fila('apex-e2e', 1, 'openspec/changes/ICC-110/tests/b.test.js'),
  ].join('\n')
  const r = core.agrupar(core.parsear(texto), { minimo: 2 })
  assert.equal(r.repetidos.length, 1)
  assert.ok(r.repetidos[0].modo.includes('<archivo>'))
})

test('el subcomando NO se colapsa: cerrar y iniciar son fallas distintas', () => {
  const texto = [
    fila('kove-actividad', 1, 'cerrar'), fila('kove-actividad', 1, 'cerrar'),
    fila('kove-actividad', 1, 'iniciar'), fila('kove-actividad', 1, 'iniciar'),
  ].join('\n')
  const r = core.agrupar(core.parsear(texto), { minimo: 2 })
  assert.equal(r.repetidos.length, 2)
})

test('distinto exit es distinto modo: 1 y 2 no son la misma falla', () => {
  const texto = [fila('db-sql', 1, '--base'), fila('db-sql', 2, '--base')].join('\n')
  const r = core.agrupar(core.parsear(texto), { minimo: 1 })
  assert.equal(r.repetidos.length, 2)
})

// El hallazgo que aparecio solo la primera vez que se miro el log.
test('pedir ayuda y salir con != 0 es su propio hallazgo', () => {
  const texto = Array.from({ length: 4 }, () => fila('kove-tarea', 2, '--help')).join('\n')
  const r = core.agrupar(core.parsear(texto))
  assert.equal(r.ayudaRota.length, 1)
  assert.ok(core.informe(r).includes('Pedir ayuda no es un error'))
})

test('una tool de accion que falla la mitad de las veces sale aparte de los modos', () => {
  const texto = Array.from({ length: 12 }, (_, i) => fila('kove-cargar-horas', i < 9 ? 1 : 0, 'ICC-' + i)).join('\n')
  const r = core.agrupar(core.parsear(texto))
  assert.equal(r.casiSiempreFalla.length, 1)
  assert.equal(r.casiSiempreFalla[0].fallos, 9)
})

test('una tool usada tres veces no se acusa de nada', () => {
  const texto = [fila('kove-jornada', 1), fila('kove-jornada', 1), fila('kove-jornada', 1)].join('\n')
  assert.equal(core.agrupar(core.parsear(texto)).casiSiempreFalla.length, 0)
})

test('--desde acota la ventana', () => {
  const texto = [
    fila('kove-tarea', 1, 'crear', '2026-08-01T10:00:00'),
    fila('kove-tarea', 1, 'crear', '2026-08-31T10:00:00'),
  ].join('\n')
  const r = core.agrupar(core.parsear(texto), { minimo: 1, desde: '2026-08-30' })
  assert.equal(r.corridas, 1)
})

// Control negativo del informe entero: un log sano no inventa hallazgos.
test('un log sin fallos repetidos no reporta nada', () => {
  const texto = [fila('db-sql', 0), fila('lint', 1, 'x.sql'), fila('check', 1)].join('\n')
  const r = core.agrupar(core.parsear(texto))
  assert.equal(r.gaps.length, 0)
  assert.ok(core.informe(r).includes('ningun modo de falla repetido'))
})
