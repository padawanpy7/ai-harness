const { test } = require('node:test')
const assert = require('node:assert')

const f = require('./fecha-local')

test('devuelve la fecha con el formato AAAA-MM-DD', () => {
  assert.match(f.hoy(), /^\d{4}-\d{2}-\d{2}$/)
})

// El caso que justifica el archivo: 21:56 local en -03:00 es 00:56 UTC del dia SIGUIENTE.
// Con toISOString() el gate pedia una entrada de un dia que todavia no habia empezado.
test('a la noche NO se adelanta al dia siguiente, como si hace UTC', () => {
  const local = new Date(2026, 8, 10, 21, 56) // 10/09/2026 21:56 hora local
  assert.equal(f.hoy(local), '2026-09-10')
})

test('a la madrugada tampoco se atrasa al dia anterior', () => {
  const local = new Date(2026, 8, 11, 0, 30)
  assert.equal(f.hoy(local), '2026-09-11')
})

test('el mes y el dia van con cero adelante', () => {
  assert.equal(f.hoy(new Date(2026, 0, 5, 12, 0)), '2026-01-05')
})

test('cruzar el fin de mes hacia atras da el mes anterior', () => {
  assert.equal(f.haceDias(1, new Date(2026, 8, 1, 10, 0)), '2026-08-31')
})

test('haceDias(0) es hoy', () => {
  const d = new Date(2026, 8, 10, 21, 56)
  assert.equal(f.haceDias(0, d), f.hoy(d))
})

test('una ventana de 7 dias retrocede 7 dias', () => {
  assert.equal(f.haceDias(7, new Date(2026, 8, 10, 12, 0)), '2026-09-03')
})
