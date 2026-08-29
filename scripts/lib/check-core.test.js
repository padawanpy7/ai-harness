const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  parsePorcelano,
  decidirAlcance,
  conExtension,
  problemasEstructura,
} = require('./check-core')

test('parsePorcelano: linea normal (modificado)', () => {
  assert.deepEqual(parsePorcelano(' M archivo.md\n'), ['archivo.md'])
})

test('parsePorcelano: no come el primer caracter cuando la primera linea empieza con espacio', () => {
  // El caso que rompia con un .trim() global: el primer archivo modificado empezaba
  // con espacio (" M ...") y quedaba mordido a "rchivo.md".
  const raw = ' M memory/playbooks/db.md\n M otro.md\n'
  assert.deepEqual(parsePorcelano(raw), ['memory/playbooks/db.md', 'otro.md'])
})

test('parsePorcelano: nuevo sin trackear', () => {
  assert.deepEqual(parsePorcelano('?? nuevo.md\n'), ['nuevo.md'])
})

test('parsePorcelano: rename toma el destino', () => {
  assert.deepEqual(parsePorcelano('R  viejo.md -> nuevo.md\n'), ['nuevo.md'])
})

test('parsePorcelano: dedupe y vacio', () => {
  assert.deepEqual(parsePorcelano(''), [])
  assert.deepEqual(parsePorcelano(' M a.md\n M a.md\n'), ['a.md'])
})

test('decidirAlcance: rutas explicitas ganan siempre', () => {
  const r = decidirAlcance({ rutas: ['x.md'], todos: true, porcelanoRaw: null })
  assert.equal(r.modo, 'rutas')
  assert.deepEqual(r.archivos, ['x.md'])
})

test('decidirAlcance: --todos fuerza modo todo', () => {
  const r = decidirAlcance({ rutas: [], todos: true, porcelanoRaw: ' M x.md\n' })
  assert.equal(r.modo, 'todo')
  assert.equal(r.archivos, null)
})

test('decidirAlcance: git no contesta -> gatea todo con motivo', () => {
  const r = decidirAlcance({ rutas: [], todos: false, porcelanoRaw: null })
  assert.equal(r.modo, 'todo')
  assert.match(r.motivo, /no pude preguntarle a git/)
})

test('decidirAlcance: nada sin commitear -> gatea todo con motivo', () => {
  const r = decidirAlcance({ rutas: [], todos: false, porcelanoRaw: '' })
  assert.equal(r.modo, 'todo')
  assert.match(r.motivo, /no hay nada sin commitear/)
})

test('decidirAlcance: cambios sin commitear -> modo cambios', () => {
  const r = decidirAlcance({ rutas: [], todos: false, porcelanoRaw: ' M a.md\n?? b.md\n' })
  assert.equal(r.modo, 'cambios')
  assert.deepEqual(r.archivos, ['a.md', 'b.md'])
})

test('decidirAlcance: filtra archivos que ya no existen (borrados)', () => {
  const existe = (f) => f !== 'borrado.md'
  const r = decidirAlcance({ rutas: [], todos: false, porcelanoRaw: ' D borrado.md\n M vivo.md\n', existeArchivo: existe })
  assert.deepEqual(r.archivos, ['vivo.md'])
})

test('decidirAlcance: si tras filtrar borrados no queda nada, gatea todo', () => {
  const existe = () => false
  const r = decidirAlcance({ rutas: [], todos: false, porcelanoRaw: ' D borrado.md\n', existeArchivo: existe })
  assert.equal(r.modo, 'todo')
  assert.match(r.motivo, /no hay nada sin commitear/)
})

test('conExtension: filtra case-insensitive', () => {
  assert.deepEqual(
    conExtension(['a.MD', 'b.yml', 'c.sh'], ['.md', '.yml']),
    ['a.MD', 'b.yml'],
  )
})

test('conExtension: sin archivos devuelve vacio', () => {
  assert.deepEqual(conExtension(null, ['.md']), [])
})

test('problemasEstructura: todo en orden no reporta nada', () => {
  const hechos = [{ archivo: 'x.md', slug: 'x', texto: 'name: x\ndescription: algo\n' }]
  const problemas = problemasEstructura({
    hechos,
    memoriaTexto: '[hechos/x.md]',
    registryActual: 'r',
    registryEsperado: 'r',
  })
  assert.deepEqual(problemas, [])
})

test('problemasEstructura: frontmatter incompleto bloquea', () => {
  const hechos = [{ archivo: 'x.md', slug: 'x', texto: 'name: x\n' }]
  const problemas = problemasEstructura({ hechos, memoriaTexto: '[hechos/x.md]' })
  assert.ok(problemas.some((p) => p.includes("sin 'description:'")))
})

test('problemasEstructura: name no coincide con el archivo', () => {
  const hechos = [{ archivo: 'x.md', slug: 'x', texto: 'name: otro\ndescription: algo\n' }]
  const problemas = problemasEstructura({ hechos, memoriaTexto: '[hechos/x.md]' })
  assert.ok(problemas.some((p) => p.includes("'name:' no coincide")))
})

test('problemasEstructura: hecho no enlazado desde MEMORY.md', () => {
  const hechos = [{ archivo: 'x.md', slug: 'x', texto: 'name: x\ndescription: algo\n' }]
  const problemas = problemasEstructura({ hechos, memoriaTexto: 'sin nada' })
  assert.ok(problemas.some((p) => p.includes('no esta enlazado')))
})

test('problemasEstructura: MEMORY.md apunta a un hecho que no existe', () => {
  const problemas = problemasEstructura({ hechos: [], memoriaTexto: '[hechos/fantasma.md]' })
  assert.ok(problemas.some((p) => p.includes('fantasma')))
})

test('problemasEstructura: wikilink colgado', () => {
  const hechos = [{ archivo: 'x.md', slug: 'x', texto: 'name: x\ndescription: algo\nver [[fantasma]]\n' }]
  const problemas = problemasEstructura({ hechos, memoriaTexto: '[hechos/x.md]' })
  assert.ok(problemas.some((p) => p.includes('[[fantasma]]')))
})

test('problemasEstructura: registry desincronizado', () => {
  const problemas = problemasEstructura({
    hechos: [], memoriaTexto: '', registryActual: 'viejo', registryEsperado: 'nuevo',
  })
  assert.ok(problemas.some((p) => p.includes('REGISTRY.md desincronizado')))
})
