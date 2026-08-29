const { test } = require('node:test')
const assert = require('node:assert/strict')
const { OBJETIVOS_POR_DEFECTO, resolverConfig } = require('./spell-core')

test('resolverConfig: usa cspell.json de la raiz si existe', () => {
  assert.equal(resolverConfig((f) => f === 'cspell.json'), 'cspell.json')
})

test('resolverConfig: cae a scripts/cspell.json si no hay uno en la raiz', () => {
  assert.equal(resolverConfig(() => false), 'scripts/cspell.json')
})

test('objetivos por defecto cubren la prosa del harness', () => {
  assert.ok(OBJETIVOS_POR_DEFECTO.includes('AGENTS.md'))
  assert.ok(OBJETIVOS_POR_DEFECTO.includes('memory/**/*.md'))
})
