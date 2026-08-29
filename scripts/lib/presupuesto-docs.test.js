const { test } = require('node:test')
const assert = require('node:assert')
const p = require('./presupuesto-docs')

const topes = [
  { archivo: 'A.md', tope: 100, porque: 'porque si' },
  { archivo: 'B.md', tope: 50, porque: 'porque tambien' },
]

test('dentro del tope, pasa', () => {
  const r = p.evaluar([{ archivo: 'A.md', lineas: 100 }, { archivo: 'B.md', lineas: 1 }], topes)
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.excedidos.length, 0)
})

// El tope es el maximo aceptable, no el primer valor que falla: 100/100 pasa, 101 no.
test('el tope es inclusivo', () => {
  assert.strictEqual(p.evaluar([{ archivo: 'A.md', lineas: 101 }], topes).ok, false)
})

test('excedido dice CUANTO sobra', () => {
  const r = p.evaluar([{ archivo: 'A.md', lineas: 892 }], topes)
  assert.strictEqual(r.ok, false)
  assert.strictEqual(r.excedidos[0].sobra, 792)
})

// Un archivo que todavia no existe no puede reprobar: work/PROGRESO.md podria no existir en un
// repo recien clonado, y un gate que falla por eso se desactiva el primer dia.
test('un archivo ausente no es violacion', () => {
  const r = p.evaluar([], topes)
  assert.strictEqual(r.ok, true)
  assert.ok(r.filas.every((f) => f.ausente))
})

test('varios excedidos se listan todos, no solo el primero', () => {
  const r = p.evaluar([{ archivo: 'A.md', lineas: 200 }, { archivo: 'B.md', lineas: 60 }], topes)
  assert.deepEqual(r.excedidos.map((f) => f.archivo), ['A.md', 'B.md'])
})

// El informe tiene que decir QUE hacer: "estas en 892" sin el porque deja al que lo lee
// decidiendo a ciegas que sacar.
test('el informe del excedido trae el cuanto y el que hacer', () => {
  const texto = p.informe(p.evaluar([{ archivo: 'A.md', lineas: 200 }], topes))
  assert.match(texto, /SOBRAN 100/)
  assert.match(texto, /porque si/)
})

test('el presupuesto real cubre los cuatro documentos de arranque', () => {
  assert.deepEqual(p.PRESUPUESTO.map((x) => x.archivo),
    ['AGENTS.md', 'CLAUDE.md', 'memory/MEMORY.md', 'work/PROGRESO.md'])
})

test('el resultado es ASCII puro: nada de em-dash ni comillas tipograficas', () => {
  const texto = p.informe(p.evaluar([{ archivo: 'A.md', lineas: 200 }], topes))
  const noAscii = [0x2014, 0x2018, 0x2019, 0x201c, 0x201d].map((cp) => String.fromCodePoint(cp))
  assert.equal(noAscii.some((ch) => texto.includes(ch)), false)
})

// --- delta: el gate de crecimiento -------------------------------------------------------------
test('delta: crecer dentro del tope pasa', () => {
  const r = p.evaluarDelta([{ archivo: 'AGENTS.md', crecio: 3 }])
  assert.equal(r.ok, true)
})

test('delta: pasarse del tope falla y nombra el archivo', () => {
  const r = p.evaluarDelta([{ archivo: 'AGENTS.md', crecio: 4 }])
  assert.equal(r.ok, false)
  assert.equal(r.excedidos[0].archivo, 'AGENTS.md')
})

// Sacar nunca puede fallar: si podar fuera sospechoso, el gate empujaria a no podar.
test('delta: encoger siempre pasa, por grande que sea la poda', () => {
  assert.equal(p.evaluarDelta([{ archivo: 'AGENTS.md', crecio: -120 }]).ok, true)
})

test('delta: un archivo sin medicion cuenta como que no crecio', () => {
  assert.equal(p.evaluarDelta([]).ok, true)
})

test('delta: el tope es un parametro, no un numero suelto', () => {
  assert.equal(p.evaluarDelta([{ archivo: 'AGENTS.md', crecio: 8 }], { tope: 10 }).ok, true)
})

test('delta: el informe solo menciona los archivos que se movieron', () => {
  const r = p.evaluarDelta([{ archivo: 'AGENTS.md', crecio: 2 }])
  const txt = p.informeDelta(r)
  assert.match(txt, /AGENTS\.md/)
  assert.ok(!txt.includes('CLAUDE.md'))
})

// Una bitacora crece por diseño: su primera entrada ya son 25 lineas. El delta no le aplica.
test('delta: un documento marcado delta:false queda fuera del gate de crecimiento', () => {
  const r = p.evaluarDelta([{ archivo: 'work/PROGRESO.md', crecio: 40 }])
  assert.equal(r.ok, true)
  assert.ok(!r.filas.some((f) => f.archivo === 'work/PROGRESO.md'))
})
