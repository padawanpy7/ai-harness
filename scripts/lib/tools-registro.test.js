const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { descubrirTools, areaDe, debeContarUso } = require('./tools-registro')

function raizDeMentira(archivos) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-registro-'))
  for (const rel of archivos) {
    const destino = path.join(raiz, rel)
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    fs.writeFileSync(destino, '')
  }
  return raiz
}

test('descubre tools .js y .sh en distintas areas', () => {
  const raiz = raizDeMentira([
    'scripts/sistema/salud.sh',
    'scripts/calidad/doctor.sh',
    'scripts/loop/skill-sync.js',
  ])
  const tools = descubrirTools(raiz)
  assert.deepEqual([...tools.keys()].sort(), ['doctor', 'salud', 'skill-sync'])
  fs.rmSync(raiz, { recursive: true })
})

test('ignora archivos que empiezan con guion bajo', () => {
  const raiz = raizDeMentira(['scripts/sistema/_ayuda.sh', 'scripts/sistema/salud.sh'])
  const tools = descubrirTools(raiz)
  assert.deepEqual([...tools.keys()], ['salud'])
  fs.rmSync(raiz, { recursive: true })
})

test('ignora los .test.js', () => {
  const raiz = raizDeMentira(['scripts/lib_falso/foo.js', 'scripts/lib_falso/foo.test.js'])
  const tools = descubrirTools(raiz)
  assert.deepEqual([...tools.keys()], ['foo'])
  fs.rmSync(raiz, { recursive: true })
})

test('ignora la carpeta lib entera', () => {
  const raiz = raizDeMentira(['scripts/lib/metricas-core.js', 'scripts/sistema/salud.sh'])
  const tools = descubrirTools(raiz)
  assert.deepEqual([...tools.keys()], ['salud'])
  fs.rmSync(raiz, { recursive: true })
})

test('cuando una tool tiene .sh y .js, gana el .sh (es la entrada real)', () => {
  const raiz = raizDeMentira(['scripts/docs/md-a-pdf.js', 'scripts/docs/md-a-pdf.sh'])
  const tools = descubrirTools(raiz)
  assert.equal(tools.get('md-a-pdf'), path.join(raiz, 'scripts/docs/md-a-pdf.sh'))
  fs.rmSync(raiz, { recursive: true })
})

test('el orden de lectura no cambia cual gana: .sh siempre pisa al .js', () => {
  const raiz = raizDeMentira(['scripts/docs/zz-a-pdf.sh', 'scripts/docs/zz-a-pdf.js'])
  const tools = descubrirTools(raiz)
  assert.equal(tools.get('zz-a-pdf'), path.join(raiz, 'scripts/docs/zz-a-pdf.sh'))
  fs.rmSync(raiz, { recursive: true })
})

test('sin scripts/ no explota: devuelve un mapa vacio', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-registro-vacio-'))
  const tools = descubrirTools(raiz)
  assert.equal(tools.size, 0)
  fs.rmSync(raiz, { recursive: true })
})

test('areaDe devuelve la carpeta padre de la ruta', () => {
  assert.equal(areaDe('/repo/scripts/sistema/salud.sh'), 'sistema')
  assert.equal(areaDe('/repo/scripts/loop/skill-sync.js'), 'loop')
})

test('debeContarUso: .sh no cuenta en harness.js (ya se cuenta sola via _count.sh)', () => {
  assert.equal(debeContarUso('/repo/scripts/sistema/salud.sh'), false)
})

test('debeContarUso: .js si cuenta en harness.js (es su unico punto de registro)', () => {
  assert.equal(debeContarUso('/repo/scripts/loop/skill-sync.js'), true)
})
