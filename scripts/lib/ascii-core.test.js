const { test } = require('node:test')
const assert = require('node:assert/strict')
const { convertir, parsearArgs } = require('./ascii-core')

test('em-dash y en-dash a guion simple', () => {
  assert.equal(convertir('un texto—con em dash'), 'un texto-con em dash')
  assert.equal(convertir('un rango 2020–2026'), 'un rango 2020-2026')
})

test('comillas tipograficas dobles y simples a rectas', () => {
  assert.equal(convertir('dijo “hola” y ‘chau’'), 'dijo "hola" y \'chau\'')
})

test('flechas a ASCII', () => {
  assert.equal(convertir('A → B ← C'), 'A -> B <- C')
})

test('ellipsis a tres puntos', () => {
  assert.equal(convertir('esperando…'), 'esperando...')
})

test('bullets y punto medio a guion', () => {
  assert.equal(convertir('• uno · dos'), '- uno - dos')
})

test('marcas de check y cruz', () => {
  assert.equal(convertir('✓ listo ✅ ok ❌ mal'), 'OK listo OK ok X mal')
})

test('NO toca acentos ni la enie (AGENTS.md S8)', () => {
  const conAcentos = 'La configuracion del nino se guardo en un archivo con enie: mañana, año, ñu, canción'
  assert.equal(convertir(conAcentos), conAcentos)
})

test('texto ya en ASCII queda identico', () => {
  const texto = 'nada raro aca, solo texto plano con -guiones- y comillas "rectas"'
  assert.equal(convertir(texto), texto)
})

test('mezcla de varios casos en un mismo texto', () => {
  const entrada = 'El plan —dijo ella— es simple: “hacelo” y listo… ¿o no?'
  const esperado = 'El plan -dijo ella- es simple: "hacelo" y listo... ¿o no?'
  assert.equal(convertir(entrada), esperado)
})

test('parsearArgs: sin flags, modo check y objetivo por defecto', () => {
  assert.deepEqual(parsearArgs([]), { modo: '--check', objetivos: ['.'] })
})

test('parsearArgs: --fix se respeta', () => {
  assert.deepEqual(parsearArgs(['--fix', 'memory']), { modo: '--fix', objetivos: ['memory'] })
})

test('parsearArgs: --check y --fix juntos es error, no "gana el ultimo"', () => {
  assert.ok(parsearArgs(['--check', '--fix']).error)
  assert.ok(parsearArgs(['--fix', '--check']).error)
})

test('parsearArgs: repetir el mismo flag no es conflicto', () => {
  assert.deepEqual(parsearArgs(['--check', '--check']), { modo: '--check', objetivos: ['.'] })
})
