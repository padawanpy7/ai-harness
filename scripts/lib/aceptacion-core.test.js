const { test } = require('node:test')
const assert = require('node:assert/strict')
const core = require('./aceptacion-core')

const DOC = [
  '# HECHO_CUANDO - ICC-99',
  '',
  '## El package compila contra la base',
  '```sh',
  'node bf.js db-compilar sql/PKG_X.sql --verificar',
  '```',
  '',
  '## La cuota en USD sale con la tasa del dia',
  '```sh',
  'node bf.js db-sql --archivo tests/t5.sql',
  '```',
  '',
  '## La pantalla muestra el saldo en guaranies',
  '> manual: entrar a la 265 pagina 12 con un cliente de dos cuentas',
].join('\n')

test('parsea titulo + comando, y el manual como manual', () => {
  const p = core.parsear(DOC)
  assert.equal(p.criterios.length, 3)
  assert.equal(p.criterios[0].comando, 'node bf.js db-compilar sql/PKG_X.sql --verificar')
  assert.equal(p.criterios[2].manual, 'entrar a la 265 pagina 12 con un cliente de dos cuentas')
  assert.deepEqual(p.problemas, [])
})

test('un criterio que no dice COMO se verifica es un problema, no un criterio', () => {
  const p = core.parsear('## Anda bien\n\nDeberia funcionar.\n')
  assert.equal(p.criterios.length, 0)
  assert.equal(p.problemas[0].regla, 'criterio-sin-comando')
})

test('todo en verde cierra', () => {
  const p = core.parsear(DOC)
  const v = core.veredicto(p, [
    { titulo: 'El package compila contra la base', exit: 0 },
    { titulo: 'La cuota en USD sale con la tasa del dia', exit: 0 },
  ])
  assert.equal(v.ok, true)
  assert.equal(v.pasaron.length, 2)
  assert.equal(v.manuales.length, 1)
})

test('un criterio en rojo NO deja cerrar', () => {
  const p = core.parsear(DOC)
  const v = core.veredicto(p, [
    { titulo: 'El package compila contra la base', exit: 0 },
    { titulo: 'La cuota en USD sale con la tasa del dia', exit: 1 },
  ])
  assert.equal(v.ok, false)
  assert.equal(v.fallaron.length, 1)
  assert.ok(core.informe(v).includes('exit 1'))
})

// El agujero por el que se cuela un cierre falso: un criterio que nadie corrio no es un criterio
// que paso.
test('un criterio sin correr no cuenta como verde', () => {
  const p = core.parsear(DOC)
  const v = core.veredicto(p, [{ titulo: 'El package compila contra la base', exit: 0 }])
  assert.equal(v.ok, false)
  assert.equal(v.sinCorrer.length, 1)
})

// La regla que evita el "reward hacking" del paper: si todo se declara manual, no hay verificacion.
test('lo manual se cuenta aparte y se muestra SIEMPRE', () => {
  const p = core.parsear('## Anda\n> manual: lo miro yo\n')
  const v = core.veredicto(p, [])
  assert.equal(v.manuales.length, 1)
  assert.ok(core.informe(v).includes('A MANO'))
})

test('sin criterios NO es "cumplio todo": es que nadie dijo cuando esta hecho', () => {
  const v = core.veredicto(core.parsear('# HECHO_CUANDO\n\nTodavia nada.\n'), [])
  assert.equal(v.ok, false)
  assert.equal(v.sinCriterios, true)
  assert.ok(core.informe(v).includes('no hay regla de parada'))
})

test('una cerca sin cerrar se dice, no se traga el resto del archivo en silencio', () => {
  const p = core.parsear('## Uno\n```sh\ncomando\n\n## Dos\n```sh\notro\n```\n')
  assert.ok(p.problemas.some((x) => x.regla === 'cerca-sin-cerrar'))
})

test('un bloque de codigo suelto, fuera de todo criterio, no le pertenece a nadie', () => {
  const p = core.parsear('```sh\nesto es un ejemplo del encabezado\n```\n\n## Uno\n```sh\nreal\n```\n')
  assert.equal(p.criterios.length, 1)
  assert.equal(p.criterios[0].comando, 'real')
})

test('un comando de varias lineas se conserva entero', () => {
  const p = core.parsear('## Uno\n```sh\nnode bf.js db-sql \\\n  --archivo t.sql\n```\n')
  assert.equal(p.criterios[0].comando, 'node bf.js db-sql \\\n  --archivo t.sql')
})

test('un "> manual:" que sigue en las lineas de abajo se junta entero', () => {
  const p = core.parsear('## Uno\n> manual: entrar a la 265 y mirar\n> que el saldo salga en guaranies\n')
  assert.equal(p.criterios[0].manual, 'entrar a la 265 y mirar que el saldo salga en guaranies')
})

// El 2 es la convencion de "no pude medir" en todo este harness. Aparecio en un criterio real el
// 31/08: plsql-test de ICC-83 salio 2 porque la base no respondia.
test('exit 2 es "no se pudo medir": no es rojo, y tampoco deja cerrar', () => {
  const p = core.parsear('## Uno\n```sh\ncmd\n```\n')
  const v = core.veredicto(p, [{ titulo: 'Uno', exit: 2 }])
  assert.equal(v.ok, false)
  assert.equal(v.fallaron.length, 0)
  assert.equal(v.sinMedir.length, 1)
  assert.ok(core.informe(v).includes('NO SE PUDO MEDIR'))
})

test('desenchufar la red no puede volver verde un criterio', () => {
  const p = core.parsear('## Uno\n```sh\ncmd\n```\n\n## Dos\n```sh\notro\n```\n')
  const v = core.veredicto(p, [{ titulo: 'Uno', exit: 0 }, { titulo: 'Dos', exit: 2 }])
  assert.equal(v.ok, false)
})

test('un "> manual:" vacio -el de la plantilla- no es un criterio', () => {
  const p = core.parsear('## (borrar esto y escribir el criterio)\n\n> manual: \n')
  assert.equal(p.criterios.length, 0)
  assert.equal(p.problemas[0].regla, 'criterio-sin-comando')
})

// --- la cadencia ---------------------------------------------------------------------------------
test('debajo del maximo no escala; al llegar, si', () => {
  assert.equal(core.cadencia(1, 2).escalar, false)
  assert.equal(core.cadencia(2, 2).escalar, true)
  assert.equal(core.cadencia(5, 2).escalar, true)
})

test('sin maximo declarado no se inventa uno', () => {
  assert.equal(core.cadencia(99, 0).escalar, false)
  assert.equal(core.cadencia(99, undefined).escalar, false)
})

test('el aviso dice cuantas vueltas y que hacer, no solo que se paso', () => {
  const txt = core.informeCadencia(core.cadencia(3, 2))
  assert.ok(txt.includes('3 vuelta(s)'))
  assert.ok(txt.includes('ESCALA'))
  assert.equal(core.informeCadencia(core.cadencia(1, 2)), '')
})
