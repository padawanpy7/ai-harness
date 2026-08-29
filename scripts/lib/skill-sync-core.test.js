const { test } = require('node:test')
const assert = require('node:assert/strict')
const { campo, registro } = require('./skill-sync-core')

test('campo lee name y when del frontmatter', () => {
  const texto = '---\nname: sdd\nwhen: un cambio no trivial\n---\n\nprosa\n'
  assert.equal(campo(texto, 'name'), 'sdd')
  assert.equal(campo(texto, 'when'), 'un cambio no trivial')
})

test('campo no confunde la clave dentro de la prosa (linea completa, no substring)', () => {
  const texto = 'esto habla de when: algo en medio de una oracion\nname: real\n'
  assert.equal(campo(texto, 'name'), 'real')
})

test('campo ausente devuelve string vacio', () => {
  assert.equal(campo('sin frontmatter', 'name'), '')
  assert.equal(campo('', 'when'), '')
  assert.equal(campo(undefined, 'when'), '')
})

test('registro con lista vacia deja la tabla sin filas', () => {
  const md = registro([])
  assert.match(md, /\| skill \| cuando usarlo \|/)
  assert.ok(md.endsWith('\n'))
  assert.equal(md.split('\n').filter((l) => l.startsWith('| [')).length, 0)
})

test('registro ordena las filas por nombre de archivo', () => {
  const skills = [
    { base: 'sdd.md', texto: 'name: sdd\nwhen: planear\n' },
    { base: 'judgment-day.md', texto: 'name: judgment-day\nwhen: verificar riesgo\n' },
  ]
  const md = registro(skills)
  const iJudgment = md.indexOf('judgment-day')
  const iSdd = md.indexOf('| [sdd]')
  assert.ok(iJudgment < iSdd)
})

test('sin campo when la celda queda vacia, no "undefined"', () => {
  const md = registro([{ base: 'foo.md', texto: 'name: foo\n' }])
  assert.match(md, /\| \[foo\]\(foo\.md\) \|  \|/)
})

test('sin name en el frontmatter cae al nombre del archivo', () => {
  const md = registro([{ base: 'sin-nombre.md', texto: 'when: algo\n' }])
  assert.match(md, /\[sin-nombre\]\(sin-nombre\.md\)/)
})

test('el resultado es ASCII puro: nada de em-dash ni comillas tipograficas', () => {
  const md = registro([{ base: 'foo.md', texto: 'name: foo\nwhen: x\n' }])
  // Codepoints, no el glifo literal, para que este mismo archivo se mantenga ASCII (AGENTS S8).
  const noAscii = [0x2014, 0x2018, 0x2019, 0x201c, 0x201d].map((cp) => String.fromCodePoint(cp))
  assert.equal(noAscii.some((ch) => md.includes(ch)), false)
})
