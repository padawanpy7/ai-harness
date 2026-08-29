const { test } = require('node:test')
const assert = require('node:assert')
const { agregar, reporte, duracion, familiaDeComando } = require('./metricas-core')

const EVENTOS = [
  { tipo: 'uso', ts: '2026-08-04T10:00:00.000Z', ticket: 'GMCC-261', sesion: 's1',
    tokens: { entrada: 100, salida: 900, cacheLectura: 5000, cacheEscritura: 50 } },
  { tipo: 'tool', ts: '2026-08-04T10:00:01.000Z', ticket: 'GMCC-261', sesion: 's1', tool: 'Bash', id: 'a' },
  { tipo: 'result', ts: '2026-08-04T10:00:04.000Z', ticket: 'GMCC-261', sesion: 's1', id: 'a' },
  { tipo: 'tool', ts: '2026-08-04T10:00:05.000Z', ticket: 'GMCC-261', sesion: 's1', tool: 'Bash', id: 'b' },
  { tipo: 'result', ts: '2026-08-04T10:00:15.000Z', ticket: 'GMCC-261', sesion: 's1', id: 'b' },
  { tipo: 'tool', ts: '2026-08-04T10:00:16.000Z', ticket: 'GMCC-261', sesion: 's2', tool: 'Read', id: 'c' },
  { tipo: 'result', ts: '2026-08-04T10:00:17.000Z', ticket: 'GMCC-261', sesion: 's2', id: 'c' },
  { tipo: 'uso', ts: '2026-08-04T11:00:00.000Z', ticket: 'ICC-91', sesion: 's3',
    tokens: { entrada: 10, salida: 90, cacheLectura: 0, cacheEscritura: 0 } },
]

test('agrupa por ticket y suma tokens', () => {
  const r = agregar(EVENTOS)
  assert.deepStrictEqual(Object.keys(r).sort(), ['GMCC-261', 'ICC-91'])
  assert.strictEqual(r['GMCC-261'].tokensTotal, 1000)
  assert.strictEqual(r['GMCC-261'].tokens.cacheLectura, 5000)
  assert.strictEqual(r['ICC-91'].tokensTotal, 100)
})

test('mide el tiempo de cada tool emparejando use con result', () => {
  const r = agregar(EVENTOS)['GMCC-261']
  const bash = r.tools.find((t) => t.nombre === 'Bash')
  assert.strictEqual(bash.usos, 2)
  assert.strictEqual(bash.ms, 13000) // 3s + 10s
  assert.strictEqual(bash.msMax, 10000) // la peor corrida
  assert.strictEqual(r.msTools, 14000) // + 1s del Read
})

test('el ranking de tools va del que mas tiempo come al que menos', () => {
  const r = agregar(EVENTOS)['GMCC-261']
  assert.deepStrictEqual(r.tools.map((t) => t.nombre), ['Bash', 'Read'])
})

test('tokens por tool: la señal de "mucho razonamiento, poca herramienta"', () => {
  const r = agregar(EVENTOS)['GMCC-261']
  assert.strictEqual(r.llamadasTool, 3)
  assert.strictEqual(r.tokensPorTool, 333) // 1000 / 3
})

test('sin ninguna llamada de tool no se divide por cero', () => {
  const r = agregar([EVENTOS[7]])['ICC-91']
  assert.strictEqual(r.llamadasTool, 0)
  assert.strictEqual(r.tokensPorTool, null)
})

test('cuenta sesiones distintas', () => {
  assert.strictEqual(agregar(EVENTOS)['GMCC-261'].sesiones, 2)
})

test('un result sin su use no rompe, y una duracion absurda se descarta', () => {
  const sueltos = [
    { tipo: 'result', ts: '2026-08-04T10:00:00.000Z', ticket: 'X', sesion: 's', id: 'huerfano' },
    { tipo: 'tool', ts: '2026-08-04T10:00:00.000Z', ticket: 'X', sesion: 's', tool: 'Bash', id: 'z' },
    { tipo: 'result', ts: '2026-08-05T23:00:00.000Z', ticket: 'X', sesion: 's', id: 'z' }, // +37 h
  ]
  const r = agregar(sueltos)['X']
  assert.strictEqual(r.tools.find((t) => t.nombre === 'Bash').ms, 0)
})

test('un mensaje sin rama cae en "(sin rama)" y no se pierde', () => {
  const r = agregar([{ tipo: 'tool', ts: '2026-08-04T10:00:00.000Z', sesion: 's', tool: 'Bash', id: 'q' }])
  assert.ok(r['(sin rama)'])
})

test('el reporte nombra los tickets y las herramientas', () => {
  const txt = reporte(agregar(EVENTOS))
  assert.match(txt, /GMCC-261/)
  assert.match(txt, /ICC-91/)
  assert.match(txt, /Bash/)
  assert.match(txt, /tokens\/tool/)
})

test('la duracion se lee en humano', () => {
  assert.strictEqual(duracion(5000), '5s')
  assert.strictEqual(duracion(65000), '1m 5s')
  assert.strictEqual(duracion(3720000), '1h 2m')
})

// --- Agentes: el lanzamiento no es el trabajo ---------------------------------------------------
// Un agente ASINCRONO devuelve su tool_result en un par de segundos con el texto "Async agent
// launched successfully" -es el acuse del lanzamiento- y el trabajo real llega despues, por
// notificacion. Contar eso como duracion da una tabla que miente. Un agente BLOQUEANTE en cambio
// devuelve su informe y esa duracion es real (wall-clock, con la espera humana adentro).
const AGENTES = [
  { tipo: 'tool', ts: '2026-08-18T10:00:00.000Z', ticket: 'HARNESS', sesion: 's1', tool: 'Agent', id: 'g1', agente: 'implementer' },
  { tipo: 'result', ts: '2026-08-18T10:00:02.000Z', ticket: 'HARNESS', sesion: 's1', id: 'g1',
    resultado: 'Async agent launched successfully. (This tool result is internal metadata ...)' },
  { tipo: 'tool', ts: '2026-08-18T10:01:00.000Z', ticket: 'HARNESS', sesion: 's1', tool: 'Agent', id: 'g2', agente: 'verifier' },
  { tipo: 'result', ts: '2026-08-18T10:06:00.000Z', ticket: 'HARNESS', sesion: 's1', id: 'g2',
    resultado: 'VEREDICTO: OK.' },
]

test('el acuse de un agente asincrono no cuenta como tiempo de trabajo', () => {
  const d = agregar(AGENTES).HARNESS
  const agent = d.tools.find((t) => t.nombre === 'Agent')
  assert.strictEqual(agent.usos, 2)
  // Solo los 5 minutos del bloqueante: los 2 s del acuse no son trabajo de nadie.
  assert.strictEqual(agent.ms, 5 * 60 * 1000)
})

test('los agentes se cuentan por tipo, separando lanzados de bloqueantes', () => {
  const d = agregar(AGENTES).HARNESS
  assert.deepStrictEqual(d.agentes.map((a) => a.tipo).sort(), ['implementer', 'verifier'])
  const impl = d.agentes.find((a) => a.tipo === 'implementer')
  const ver = d.agentes.find((a) => a.tipo === 'verifier')
  assert.strictEqual(impl.lanzados, 1)
  assert.strictEqual(impl.bloqueantes, 0)
  assert.strictEqual(impl.ms, 0)
  assert.strictEqual(ver.bloqueantes, 1)
  assert.strictEqual(ver.lanzados, 0)
  assert.strictEqual(ver.ms, 5 * 60 * 1000)
})

test('el reporte tiene una seccion de agentes que dice que NO se puede medir un lanzado', () => {
  const md = reporte(agregar(AGENTES))
  assert.match(md, /## Agentes/)
  assert.match(md, /implementer/)
  assert.match(md, /lanzad/i)
})

// --- Que se ejecuta en la terminal --------------------------------------------------------------
test('familiaDeComando agrupa por la FORMA del comando, no por su texto', () => {
  assert.strictEqual(familiaDeComando('cd /home/ianmrc/harness && node harness.js check --todos'), 'node harness.js check')
  assert.strictEqual(familiaDeComando('node harness.js check 2>&1 | tail -3'), 'node harness.js check')
  assert.strictEqual(familiaDeComando('bash scripts/sistema/salud.sh'), 'bash salud.sh')
  assert.strictEqual(familiaDeComando('git add -A scripts/'), 'git add')
  assert.strictEqual(familiaDeComando('grep -n "foo" archivo.js | head -5'), 'grep')
  // Un VAR=valor adelante es entorno, no el comando.
  assert.strictEqual(familiaDeComando('HARNESS_DEBUG=1 node harness.js check'), 'node harness.js check')
  assert.strictEqual(familiaDeComando(''), null)
})

test('las familias se cuentan por LLAMADAS: cada una es un viaje al modelo', () => {
  const eventos = [
    { tipo: 'tool', ts: '2026-08-18T10:00:00.000Z', ticket: 'HARNESS', sesion: 's', tool: 'Bash', id: 'c1', comando: 'node harness.js check' },
    { tipo: 'result', ts: '2026-08-18T10:00:10.000Z', ticket: 'HARNESS', sesion: 's', id: 'c1' },
    { tipo: 'tool', ts: '2026-08-18T10:01:00.000Z', ticket: 'HARNESS', sesion: 's', tool: 'Bash', id: 'c2', comando: 'node harness.js check --todos' },
    { tipo: 'result', ts: '2026-08-18T10:01:20.000Z', ticket: 'HARNESS', sesion: 's', id: 'c2' },
    { tipo: 'tool', ts: '2026-08-18T10:02:00.000Z', ticket: 'HARNESS', sesion: 's', tool: 'Bash', id: 'c3', comando: 'git status --short' },
    { tipo: 'result', ts: '2026-08-18T10:02:05.000Z', ticket: 'HARNESS', sesion: 's', id: 'c3' },
  ]
  const d = agregar(eventos).HARNESS
  assert.strictEqual(d.comandos[0].familia, 'node harness.js check')
  assert.strictEqual(d.comandos[0].llamadas, 2)
  assert.strictEqual(d.comandos[1].llamadas, 1)
})
