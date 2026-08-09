// metricas-core.js - logica pura de las metricas por ticket (sin filesystem ni red).
//
// Para que: saber en que se va el TIEMPO y los TOKENS de cada tarea. Dos preguntas concretas que
// el dueño quiere poder contestar mirando un archivo:
//   1. .que tarea tomo demasiado tiempo y por que? -> el ranking de herramientas por tiempo.
//   2. .hubo mucho razonamiento y pocas herramientas? -> tokens POR llamada de tool. Un numero alto
//      significa que se resolvio "a mano" algo que quiza merece convertirse en una herramienta para
//      todos, en vez de repetirlo cada vez.
//
// La entrada son eventos ya normalizados por scripts/metricas.js (uno por mensaje del transcript):
//   { tipo: 'uso',    ts, ticket, sesion, tokens: {entrada, salida, cacheLectura, cacheEscritura} }
//   { tipo: 'tool',   ts, ticket, sesion, tool, id }
//   { tipo: 'result', ts, ticket, sesion, id }

function vacio() {
  return {
    tokens: { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 },
    sesiones: new Set(),
    desde: null,
    hasta: null,
    llamadasTool: 0,
    tools: {},
  }
}

function ms(a, b) {
  return new Date(b).getTime() - new Date(a).getTime()
}

function agregar(eventos) {
  const porTicket = {}
  const abiertas = new Map() // id de tool_use -> { ts, tool, ticket }

  for (const e of eventos) {
    const clave = e.ticket || '(sin rama)'
    if (!porTicket[clave]) porTicket[clave] = vacio()
    const t = porTicket[clave]

    if (e.sesion) t.sesiones.add(e.sesion)
    if (e.ts) {
      if (!t.desde || e.ts < t.desde) t.desde = e.ts
      if (!t.hasta || e.ts > t.hasta) t.hasta = e.ts
    }

    if (e.tipo === 'uso' && e.tokens) {
      t.tokens.entrada += e.tokens.entrada || 0
      t.tokens.salida += e.tokens.salida || 0
      t.tokens.cacheLectura += e.tokens.cacheLectura || 0
      t.tokens.cacheEscritura += e.tokens.cacheEscritura || 0
    }

    if (e.tipo === 'tool') {
      t.llamadasTool++
      if (!t.tools[e.tool]) t.tools[e.tool] = { usos: 0, ms: 0, msMax: 0 }
      t.tools[e.tool].usos++
      abiertas.set(e.id, { ts: e.ts, tool: e.tool, ticket: clave })
    }

    if (e.tipo === 'result') {
      const uso = abiertas.get(e.id)
      if (!uso) continue
      abiertas.delete(e.id)
      const dur = ms(uso.ts, e.ts)
      // Una corrida negativa o absurda (reloj movido, transcript cortado) se descarta en vez de
      // ensuciar el promedio: es mejor un dato de menos que un total que miente.
      if (!(dur >= 0 && dur < 6 * 60 * 60 * 1000)) continue
      const dest = porTicket[uso.ticket].tools[uso.tool]
      dest.ms += dur
      if (dur > dest.msMax) dest.msMax = dur
    }
  }

  return Object.fromEntries(Object.entries(porTicket).map(([k, v]) => [k, resumir(v)]))
}

function resumir(t) {
  const tokensTotal = t.tokens.entrada + t.tokens.salida
  const tools = Object.entries(t.tools)
    .map(([nombre, x]) => ({ nombre, usos: x.usos, ms: x.ms, msMax: x.msMax }))
    .sort((a, b) => b.ms - a.ms)
  return {
    tokens: t.tokens,
    tokensTotal,
    // La señal que pidio el dueño: cuantos tokens costo cada llamada de herramienta. Alto = mucho
    // razonamiento por poca herramienta.
    tokensPorTool: t.llamadasTool ? Math.round(tokensTotal / t.llamadasTool) : null,
    llamadasTool: t.llamadasTool,
    sesiones: t.sesiones.size,
    desde: t.desde,
    hasta: t.hasta,
    msTools: tools.reduce((s, x) => s + x.ms, 0),
    tools,
  }
}

function duracion(msTotal) {
  if (msTotal === null || msTotal === undefined) return '-'
  const s = Math.round(msTotal / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function miles(n) {
  if (n === null || n === undefined) return '-'
  return n.toLocaleString('es-PY')
}

function reporte(agregado, { topTools = 8 } = {}) {
  const tickets = Object.entries(agregado).sort((a, b) => b[1].msTools - a[1].msTools)
  const lineas = []
  lineas.push('# Metricas por ticket')
  lineas.push('')
  lineas.push('Lo regenera `bash scripts/metricas.sh` leyendo los transcripts de Claude Code.')
  lineas.push('**Tiempo** = suma de lo que tardaron las herramientas (lo que se puede medir y')
  lineas.push('optimizar). **tokens/tool** = cuantos tokens costo cada llamada de herramienta: un')
  lineas.push('numero alto avisa que se resolvio mucho "a mano" y que quiza convenga convertir eso')
  lineas.push('en una herramienta para todos.')
  lineas.push('')
  lineas.push('| Ticket | Tiempo en tools | Tokens | tokens/tool | Llamadas | Sesiones | Ultima actividad |')
  lineas.push('|---|--:|--:|--:|--:|--:|---|')
  for (const [ticket, d] of tickets) {
    lineas.push(`| ${ticket} | ${duracion(d.msTools)} | ${miles(d.tokensTotal)} | ` +
      `${miles(d.tokensPorTool)} | ${miles(d.llamadasTool)} | ${d.sesiones} | ` +
      `${(d.hasta || '').slice(0, 16).replace('T', ' ')} |`)
  }
  lineas.push('')
  for (const [ticket, d] of tickets) {
    lineas.push(`## ${ticket}`)
    lineas.push('')
    lineas.push('| Herramienta | Usos | Tiempo | La peor corrida |')
    lineas.push('|---|--:|--:|--:|')
    for (const t of d.tools.slice(0, topTools)) {
      lineas.push(`| ${t.nombre} | ${t.usos} | ${duracion(t.ms)} | ${duracion(t.msMax)} |`)
    }
    if (d.tools.length > topTools) {
      lineas.push(`| *(y ${d.tools.length - topTools} herramienta/s mas)* | | | |`)
    }
    lineas.push('')
  }
  return lineas.join('\n') + '\n'
}

// El log del contador (metrics/tool-usage.log, una linea por corrida) resumido: que herramienta del
// harness se usa y cual no. Va en el MISMO reporte que el tiempo y los tokens, para no tener que
// correr dos tools y cruzar a ojo.
function resumenUso(usos, desde) {
  const vivos = (usos || []).filter((u) => u && u.tool && (!desde || u.ts >= desde))
  if (!vivos.length) return ''
  const porTool = {}
  for (const u of vivos) {
    if (!porTool[u.tool]) porTool[u.tool] = { usos: 0, ultimo: '' }
    porTool[u.tool].usos++
    if (u.ts > porTool[u.tool].ultimo) porTool[u.tool].ultimo = u.ts
  }
  const filas = Object.entries(porTool).sort((a, b) => b[1].usos - a[1].usos)
  const l = []
  l.push('## Uso de las herramientas del harness')
  l.push('')
  l.push('Del contador (`metrics/tool-usage.log`): cuantas veces se corrio cada tool. Sirve para lo')
  l.push('contrario que el resto del reporte: ver que NO se usa, y sacarlo.')
  l.push('')
  l.push('| Herramienta | Corridas | Ultima vez |')
  l.push('|---|--:|---|')
  for (const [tool, d] of filas) l.push(`| ${tool} | ${d.usos} | ${d.ultimo.replace('T', ' ').slice(0, 16)} |`)
  l.push('')
  return l.join('\n')
}

module.exports = { agregar, reporte, duracion, miles, resumenUso }
