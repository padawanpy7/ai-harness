const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  tienePlaceholders,
  contarLineasCuerpo,
  esPlaybookCasiVacio,
  esArchivoViejo,
  frontmatterFaltante,
  nombreCoincideConArchivo,
  hechoEnlazadoEnIndice,
  referenciasIndiceColgadas,
  wikilinksColgados,
  toolsSistemaFaltantes,
  paquetesDesactualizados,
  registryDesincronizado,
} = require('./doctor-core')

test('tienePlaceholders: detecta {{ sin completar', () => {
  assert.equal(tienePlaceholders('hola {{NOMBRE}} chau'), true)
})

test('tienePlaceholders: prosa sin placeholders', () => {
  assert.equal(tienePlaceholders('hola chau, todo completo'), false)
})

test('contarLineasCuerpo: ignora titulos, bullets vacios, blancos y fences', () => {
  const texto = ['# Titulo', '', '- ', '```', 'esto si cuenta', '  ', 'esto tambien'].join('\n')
  assert.equal(contarLineasCuerpo(texto), 2)
})

test('esPlaybookCasiVacio: solo titulo y un bullet sin contenido -> vacio', () => {
  const texto = ['# Playbook', '', '- '].join('\n')
  assert.equal(esPlaybookCasiVacio(texto), true)
})

test('esPlaybookCasiVacio: con dos lineas de contenido real -> no vacio', () => {
  const texto = ['# Playbook', '', 'primera cosa aprendida', 'segunda cosa aprendida'].join('\n')
  assert.equal(esPlaybookCasiVacio(texto), false)
})

test('esArchivoViejo: mas de N dias -> viejo', () => {
  const ahora = Date.parse('2026-08-16T00:00:00')
  const mtime = Date.parse('2026-06-01T00:00:00')
  assert.equal(esArchivoViejo(mtime, 45, ahora), true)
})

test('esArchivoViejo: dentro del limite -> no viejo', () => {
  const ahora = Date.parse('2026-08-16T00:00:00')
  const mtime = Date.parse('2026-08-10T00:00:00')
  assert.equal(esArchivoViejo(mtime, 45, ahora), false)
})

test('frontmatterFaltante: sin name ni description', () => {
  assert.deepEqual(frontmatterFaltante('type: gotcha\narea: sistema\n'), ['name', 'description'])
})

test('frontmatterFaltante: completo -> nada falta', () => {
  const texto = 'name: algo\ndescription: un gotcha cualquiera\ntype: gotcha\narea: sistema\n'
  assert.deepEqual(frontmatterFaltante(texto), [])
})

test('nombreCoincideConArchivo: name igual al slug', () => {
  assert.equal(nombreCoincideConArchivo('name: mi-hecho\n', 'mi-hecho'), true)
})

test('nombreCoincideConArchivo: name distinto del slug', () => {
  assert.equal(nombreCoincideConArchivo('name: otro-nombre\n', 'mi-hecho'), false)
})

test('nombreCoincideConArchivo: sin name declarado -> null (lo marca frontmatterFaltante)', () => {
  assert.equal(nombreCoincideConArchivo('description: algo\n', 'mi-hecho'), null)
})

test('hechoEnlazadoEnIndice: el slug aparece en MEMORY.md', () => {
  assert.equal(hechoEnlazadoEnIndice('mi-hecho', '- [X](hechos/mi-hecho.md) - gancho'), true)
})

test('hechoEnlazadoEnIndice: no aparece -> huerfano', () => {
  assert.equal(hechoEnlazadoEnIndice('mi-hecho', '- [X](hechos/otro.md) - gancho'), false)
})

test('referenciasIndiceColgadas: MEMORY.md apunta a un hecho que no existe', () => {
  const indice = '- [X](hechos/existe.md)\n- [Y](hechos/no-existe.md)\n'
  assert.deepEqual(referenciasIndiceColgadas(indice, ['existe']), ['hechos/no-existe.md'])
})

test('referenciasIndiceColgadas: todas las referencias existen', () => {
  const indice = '- [X](hechos/existe.md)\n'
  assert.deepEqual(referenciasIndiceColgadas(indice, ['existe']), [])
})

test('wikilinksColgados: un [[wikilink]] sin hecho correspondiente', () => {
  const textos = ['ver [[existe]] y [[fantasma]]']
  assert.deepEqual(wikilinksColgados(textos, ['existe']), ['fantasma'])
})

test('wikilinksColgados: todos los wikilinks resuelven', () => {
  const textos = ['ver [[uno]]', 'y tambien [[dos]]']
  assert.deepEqual(wikilinksColgados(textos, ['uno', 'dos']), [])
})

test('toolsSistemaFaltantes: falta una tool del sistema', () => {
  const req = ['scripts/sistema/salud.sh', 'scripts/sistema/inventario.sh']
  assert.deepEqual(toolsSistemaFaltantes(['scripts/sistema/salud.sh'], req), ['scripts/sistema/inventario.sh'])
})

test('toolsSistemaFaltantes: estan todas -> nada falta', () => {
  const req = ['scripts/sistema/salud.sh']
  assert.deepEqual(toolsSistemaFaltantes(['scripts/sistema/salud.sh'], req), [])
})

test('paquetesDesactualizados: conteos distintos', () => {
  assert.equal(paquetesDesactualizados(120, 118), true)
})

test('paquetesDesactualizados: mismo conteo -> al dia', () => {
  assert.equal(paquetesDesactualizados(120, 120), false)
})

test('registryDesincronizado: el archivo en disco no coincide con lo esperado', () => {
  assert.equal(registryDesincronizado('# Skill Registry\nviejo\n', '# Skill Registry\nnuevo\n'), true)
})

test('registryDesincronizado: coincide -> sincronizado', () => {
  const contenido = '# Skill Registry\nigual\n'
  assert.equal(registryDesincronizado(contenido, contenido), false)
})
