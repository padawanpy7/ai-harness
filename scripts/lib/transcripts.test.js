const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { transcripts } = require('./transcripts')

// Arbol de prueba, no el ~/.claude/projects real: dos proyectos, uno con un subagente.
function arbolDePrueba() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'transcripts-test-'))
  fs.mkdirSync(path.join(raiz, '-home-ianmrc-harness'))
  fs.writeFileSync(path.join(raiz, '-home-ianmrc-harness', 'sesion1.jsonl'), '{}\n')
  fs.mkdirSync(path.join(raiz, '-home-ianmrc-harness', 'sesion1', 'subagents'), { recursive: true })
  fs.writeFileSync(path.join(raiz, '-home-ianmrc-harness', 'sesion1', 'subagents', 'agent-a.jsonl'), '{}\n')
  // Una carpeta sin subagents/ (sesion sin agentes lanzados): no debe romper el recorrido.
  fs.mkdirSync(path.join(raiz, '-home-ianmrc-harness', 'sesion2'), { recursive: true })
  fs.mkdirSync(path.join(raiz, '-home-ianmrc'))
  fs.writeFileSync(path.join(raiz, '-home-ianmrc', 'sesion-home.jsonl'), '{}\n')
  return raiz
}

test('sin conSubagentes: solo los .jsonl de primer nivel', () => {
  const raiz = arbolDePrueba()
  const r = [...transcripts({ raiz })]
  assert.deepStrictEqual(r.map((t) => path.basename(t.archivo)).sort(), ['sesion-home.jsonl', 'sesion1.jsonl'])
  assert.ok(r.every((t) => !t.subagente))
})

test('conSubagentes: suma <sesion>/subagents/*.jsonl y los marca', () => {
  const raiz = arbolDePrueba()
  const r = [...transcripts({ raiz, conSubagentes: true })]
  const nombres = r.map((t) => path.basename(t.archivo)).sort()
  assert.deepStrictEqual(nombres, ['agent-a.jsonl', 'sesion-home.jsonl', 'sesion1.jsonl'])
  const agente = r.find((t) => path.basename(t.archivo) === 'agent-a.jsonl')
  assert.strictEqual(agente.subagente, true)
})

test('soloProyectos limita a esas carpetas exactas', () => {
  const raiz = arbolDePrueba()
  const r = [...transcripts({ raiz, soloProyectos: ['-home-ianmrc-harness'] })]
  assert.deepStrictEqual(r.map((t) => t.proyecto), ['-home-ianmrc-harness'])
})

test('un directorio de proyectos inexistente no rompe: da vacio', () => {
  const r = [...transcripts({ raiz: '/no/existe/nunca' })]
  assert.deepStrictEqual(r, [])
})
