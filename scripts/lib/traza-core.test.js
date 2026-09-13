const { test } = require('node:test')
const assert = require('node:assert/strict')
const core = require('./traza-core')

let seq = 0
const ts = (n) => `2026-09-09T10:${String(10 + n).padStart(2, '0')}:00.000Z`

function linea(obj) { return JSON.stringify(obj) }

function usoLinea(t, { entrada = 0, salida = 0, cacheLectura = 0, cacheEscritura = 0 } = {}) {
  return linea({
    type: 'assistant', timestamp: t, gitBranch: 'main',
    message: {
      role: 'assistant',
      usage: { input_tokens: entrada, output_tokens: salida, cache_read_input_tokens: cacheLectura, cache_creation_input_tokens: cacheEscritura },
      content: [{ type: 'text', text: 'hola' }],
    },
  })
}

function toolUseLinea(t, id, name, input = {}) {
  return linea({
    type: 'assistant', timestamp: t,
    message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
  })
}

function agentToolUse(t, id, { subagentType, descripcion, prompt = 'trabaja' }) {
  return toolUseLinea(t, id, 'Agent', { subagent_type: subagentType, description: descripcion, prompt })
}

function agentToolResult(t, toolUseId, agentId) {
  return linea({
    type: 'user', timestamp: t,
    message: {
      role: 'user',
      content: [{
        type: 'tool_result', tool_use_id: toolUseId,
        content: [{ type: 'text', text: `Async agent launched successfully. (internal)\nagentId: ${agentId} (internal ID)` }],
      }],
    },
  })
}

function notifLinea(t, agentId, estado, resumen) {
  return linea({
    type: 'queue-operation', operation: 'enqueue', timestamp: t,
    content: `<task-notification>\n<task-id>${agentId}</task-id>\n<tool-use-id>x</tool-use-id>\n<status>${estado}</status>\n<summary>${resumen}</summary>\n</task-notification>`,
  })
}

function errorLinea(t, texto) {
  return linea({
    type: 'assistant', timestamp: t, isApiErrorMessage: true, apiErrorStatus: 429, error: 'rate_limit',
    message: { role: 'assistant', content: [{ type: 'text', text: texto }] },
  })
}

test('sesion sin delegaciones: nodos vacio, no "0 tokens"', () => {
  const sesionTexto = [usoLinea(ts(1), { entrada: 100 }), usoLinea(ts(2), { salida: 50 })].join('\n')
  const arbol = core.construirArbol({ sesionId: 's1', ticket: 'main', sesionTexto, subagentes: new Map(), comandos: [] })
  assert.deepEqual(arbol.nodos, [])
})

test('un nivel: una delegacion con su transcript propio', () => {
  const sesionTexto = [
    agentToolUse(ts(1), 'tu_1', { subagentType: 'implementer', descripcion: 'Arreglar X' }),
    agentToolResult(ts(1), 'tu_1', 'ag1'),
  ].join('\n')
  const subTexto = [
    usoLinea(ts(2), { entrada: 1000, salida: 200 }),
    toolUseLinea(ts(3), 'b1', 'Bash', { command: 'node bf.js lint' }),
    toolUseLinea(ts(4), 'b2', 'Read', {}),
    usoLinea(ts(5), { entrada: 300 }),
  ].join('\n')
  const arbol = core.construirArbol({
    sesionId: 's1', ticket: 'main', sesionTexto,
    subagentes: new Map([['ag1', subTexto]]), comandos: [],
  })
  assert.equal(arbol.nodos.length, 1)
  const n = arbol.nodos[0]
  assert.equal(n.agentId, 'ag1')
  assert.equal(n.tipo, 'implementer')
  assert.equal(n.descripcion, 'Arreglar X')
  assert.equal(n.estado, 'ok')
  assert.equal(n.tokens.entrada, 1300)
  assert.equal(n.tokens.salida, 200)
  assert.deepEqual(n.herramientas, [{ tool: 'Bash', veces: 1 }, { tool: 'Read', veces: 1 }])
  assert.equal(n.hijos.length, 0)
})

test('dos niveles: la recursion entra al subagente que a su vez delego', () => {
  const sesionTexto = [
    agentToolUse(ts(1), 'tu_1', { subagentType: 'lead', descripcion: 'Coordinar tanda' }),
    agentToolResult(ts(1), 'tu_1', 'padre'),
  ].join('\n')
  const textoPadre = [
    usoLinea(ts(2), { entrada: 500 }),
    agentToolUse(ts(3), 'tu_2', { subagentType: 'implementer', descripcion: 'Hacer el fix' }),
    agentToolResult(ts(3), 'tu_2', 'hijo'),
  ].join('\n')
  const textoHijo = [usoLinea(ts(4), { entrada: 900 })].join('\n')

  const arbol = core.construirArbol({
    sesionId: 's1', ticket: 'main', sesionTexto,
    subagentes: new Map([['padre', textoPadre], ['hijo', textoHijo]]), comandos: [],
  })
  assert.equal(arbol.nodos.length, 1)
  const padre = arbol.nodos[0]
  assert.equal(padre.agentId, 'padre')
  assert.equal(padre.hijos.length, 1)
  assert.equal(padre.hijos[0].agentId, 'hijo')
  assert.equal(padre.hijos[0].tipo, 'implementer')
  assert.equal(padre.hijos[0].tokens.entrada, 900)
})

test('nodo sin transcript ni notificacion: aparece, no desaparece', () => {
  const sesionTexto = [
    agentToolUse(ts(1), 'tu_1', { subagentType: 'implementer', descripcion: 'Se perdio en Temp' }),
    agentToolResult(ts(1), 'tu_1', 'fantasma'),
  ].join('\n')
  const arbol = core.construirArbol({
    sesionId: 's1', ticket: 'main', sesionTexto, subagentes: new Map(), comandos: [],
  })
  assert.equal(arbol.nodos.length, 1)
  assert.equal(arbol.nodos[0].agentId, 'fantasma')
  assert.equal(arbol.nodos[0].estado, 'sin transcript')
  assert.equal(arbol.nodos[0].tokens, null)
})

test('sin transcript propio pero con notificacion de fallo: cortado con motivo, no "sin transcript"', () => {
  const sesionTexto = [
    agentToolUse(ts(1), 'tu_1', { subagentType: 'implementer', descripcion: 'Sacar openspec' }),
    agentToolResult(ts(1), 'tu_1', 'cortado1'),
    notifLinea(ts(6), 'cortado1', 'failed', 'Agent terminated early due to an API error: rate limit'),
  ].join('\n')
  const arbol = core.construirArbol({
    sesionId: 's1', ticket: 'main', sesionTexto, subagentes: new Map(), comandos: [],
  })
  const n = arbol.nodos[0]
  assert.equal(n.estado, 'cortado')
  assert.match(n.motivo, /rate limit/)
  assert.equal(n.tokens, null)
  assert.ok(n.ms > 0)
})

test('transcript propio con corte de rate limit: se detecta sin necesitar la notificacion', () => {
  const sesionTexto = [
    agentToolUse(ts(1), 'tu_1', { subagentType: 'implementer', descripcion: 'Sacar openspec' }),
    agentToolResult(ts(1), 'tu_1', 'ag1'),
  ].join('\n')
  const subTexto = [
    usoLinea(ts(2), { entrada: 400 }),
    errorLinea(ts(3), "You've hit your session limit"),
  ].join('\n')
  const arbol = core.construirArbol({
    sesionId: 's1', ticket: 'main', sesionTexto,
    subagentes: new Map([['ag1', subTexto]]), comandos: [],
  })
  const n = arbol.nodos[0]
  assert.equal(n.estado, 'cortado')
  assert.match(n.motivo, /session limit/)
})

test('comandos de tool-runs.log: solo los de la ventana del nodo, ninguno inventado', () => {
  const sesionTexto = [
    agentToolUse(ts(1), 'tu_1', { subagentType: 'implementer', descripcion: 'X' }),
    agentToolResult(ts(1), 'tu_1', 'ag1'),
  ].join('\n')
  const subTexto = [usoLinea(ts(1)), usoLinea(ts(3))].join('\n')
  const comandos = [
    { fecha: ts(2), tool: 'db-sql', exit: 0, ms: 10, padre: '' },
    { fecha: ts(2), tool: 'db-sql', exit: 0, ms: 10, padre: '' },
    { fecha: ts(9), tool: 'lint', exit: 0, ms: 10, padre: '' },
  ]
  const arbol = core.construirArbol({
    sesionId: 's1', ticket: 'main', sesionTexto,
    subagentes: new Map([['ag1', subTexto]]), comandos,
  })
  assert.deepEqual(arbol.nodos[0].comandosBf, [{ tool: 'db-sql', veces: 2 }])
})

test('sin transcripts en absoluto: agentIdsReferenciados no revienta con texto vacio', () => {
  assert.deepEqual(core.agentIdsReferenciados(''), [])
  assert.deepEqual(core.agentIdsReferenciados('esto no es json\n{"roto"'), [])
})

test('rebotes: detecta implementer->verifier->implementer consecutivo', () => {
  const nodos = [
    { tipo: 'implementer', descripcion: 'a', ts: ts(1), hijos: [] },
    { tipo: 'verifier', descripcion: 'b', ts: ts(2), hijos: [] },
    { tipo: 'implementer', descripcion: 'c', ts: ts(3), hijos: [] },
  ]
  const r = core.detectarRebotes(nodos)
  assert.equal(r.length, 1)
  assert.equal(r[0].length, 3)
})

test('rebotes: sin el patron, no inventa ninguno', () => {
  const nodos = [
    { tipo: 'implementer', descripcion: 'a', ts: ts(1), hijos: [] },
    { tipo: 'implementer', descripcion: 'b', ts: ts(2), hijos: [] },
  ]
  assert.deepEqual(core.detectarRebotes(nodos), [])
})
