const { test } = require('node:test')
const assert = require('node:assert')

const { parsearMergeTree } = require('./git')

// Salidas reales de `git merge-tree`, copiadas de una corrida del 13/09/2026.
const CAMBIADO = `changed in both
  base   100644 6178079822 AGENTS.md
  our    100644 7898192261 AGENTS.md
  their  100644 8a1b2c3d4e AGENTS.md
@@ -1 +1,5 @@
`

const AGREGADO = `added in both
  our    100644 6178079822 openspec/changes/T1/notas.md
  their  100644 7898192261 openspec/changes/T1/notas.md
@@ -1 +1,5 @@
`

test('un archivo que los dos lados MODIFICARON se reporta', () => {
  assert.deepStrictEqual(parsearMergeTree(CAMBIADO), ['AGENTS.md'])
})

// El caso que faltaba: `rama-drift` decia "el merge deberia entrar limpio" sobre un add/add que
// `git merge` resuelve con CONFLICT. Con un ticket nuevo es de lo mas facil que pase.
test('un archivo que los dos lados CREARON tambien se reporta', () => {
  assert.deepStrictEqual(parsearMergeTree(AGREGADO), ['openspec/changes/T1/notas.md'])
})

test('los dos casos juntos, sin duplicar', () => {
  const r = parsearMergeTree(CAMBIADO + AGREGADO + CAMBIADO)
  assert.deepStrictEqual(r, ['AGENTS.md', 'openspec/changes/T1/notas.md'])
})

test('sin choques no devuelve nada', () => {
  assert.deepStrictEqual(parsearMergeTree('merged\n  result 100644 abc AGENTS.md\n'), [])
})

test('una salida vacia no explota', () => {
  assert.deepStrictEqual(parsearMergeTree(''), [])
})

// Si el bloque no trae linea de ruta no se inventa una: mejor no reportar que reportar cualquier cosa.
test('un encabezado sin su linea de ruta se saltea', () => {
  assert.deepStrictEqual(parsearMergeTree('changed in both\nchanged in both\n'), [])
})
