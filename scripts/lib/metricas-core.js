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
//   { tipo: 'tool',   ts, ticket, sesion, tool, id, agente?, comando? }
//   { tipo: 'result', ts, ticket, sesion, id, resultado? }
//
// `agente` es el subagent_type cuando la tool es un agente; `resultado` es el texto con que
// volvio la tool, que es lo unico que distingue un agente LANZADO de uno que trabajo de verdad
// (ver ES_LANZAMIENTO). `comando` es el texto de un Bash, para agrupar por familiaDeComando.

// La FORMA de un comando de terminal, para poder agruparlos: repetir un comando literal casi no
// pasa (cada uno trae otra ruta, otro archivo, otro flag), pero la forma si se repite, y es ahi
// donde se ve que merece convertirse en una tool.
//
// Se saca el `cd <ruta> &&` de entrada (sin eso la familia mas grande del repo terminaba siendo
// "cd") y el `VAR=valor` delante, que es entorno y no el comando. Se corta en el primer
// separador: lo que sigue a un `|` es casi siempre un `head`/`grep` de recorte, no el trabajo.
function familiaDeComando(comando) {
  let c = String(comando || '').replace(/\s+/g, ' ').trim()
  if (!c) return null
  c = c.replace(/^cd\s+\S+\s*(?:&&|;)\s*/i, '')
  while (/^[A-Za-z_][A-Za-z0-9_]*=\S+\s+/.test(c)) c = c.replace(/^[A-Za-z_][A-Za-z0-9_]*=\S+\s+/, '')
  const seg = c.split(/&&|\|\||;|\|/)[0].trim()
  const t = seg.split(/\s+/).filter(Boolean)
  if (!t.length) return null
  if (/^(node|bash|sh|npx)$/.test(t[0])) {
    // Cualquier .js invocado con node se trata como entrypoint del harness y conserva su
    // subcomando: escribir el nombre a mano dejo de funcionar al renombrarlo, y el sintoma fue
    // que todas las corridas colapsaban en una sola familia sin subcomando.
    if (t[1] && /\.js$/.test(t[1])) return `node ${t[1].split('/').pop()} ${t[2] || ''}`.trim()
    if (t[1]) return `${t[0]} ${t[1].split(/[\\/]/).pop()}`
    return t[0]
  }
  if (t[0] === 'git') return `git ${t[1] || ''}`.trim()
  return t[0]
}

function vacio() {
  return {
    tokens: { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 },
    sesiones: new Set(),
    desde: null,
    hasta: null,
    llamadasTool: 0,
    tools: {},
    agentes: {},
    comandos: {},
  }
}

// Un agente asincrono contesta enseguida con el acuse del LANZAMIENTO -no con su trabajo, que
// llega despues por notificacion-. Contar eso como duracion da una tabla que miente: un rol que
// solo se lanza en segundo plano sale con mediana de un par de segundos, o sea "sale gratis".
const ES_LANZAMIENTO = /^Async agent launched successfully/i

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
      if (e.agente && !t.agentes[e.agente]) t.agentes[e.agente] = { llamadas: 0, lanzados: 0, bloqueantes: 0, ms: 0, msMax: 0 }
      if (e.agente) t.agentes[e.agente].llamadas++
      // Se cuenta al LANZAR y no al volver: lo que importa de un comando es cuantos viajes al
      // modelo costo, y ese numero no depende de que el resultado haya llegado.
      const familia = familiaDeComando(e.comando)
      if (familia) t.comandos[familia] = (t.comandos[familia] || 0) + 1
      abiertas.set(e.id, { ts: e.ts, tool: e.tool, ticket: clave, agente: e.agente })
    }

    if (e.tipo === 'result') {
      const uso = abiertas.get(e.id)
      if (!uso) continue
      abiertas.delete(e.id)
      const dur = ms(uso.ts, e.ts)
      const lanzamiento = ES_LANZAMIENTO.test(String(e.resultado || ''))
      const agente = uso.agente ? porTicket[uso.ticket].agentes[uso.agente] : null
      if (agente) agente[lanzamiento ? 'lanzados' : 'bloqueantes']++

      // El acuse de un lanzamiento no es trabajo de nadie: no suma tiempo ni al agente ni a la
      // tool. Sumarlo hace parecer que un agente lanzado cuesta dos segundos.
      if (lanzamiento) continue

      // Una corrida negativa o absurda (reloj movido, transcript cortado) se descarta en vez de
      // ensuciar el promedio: es mejor un dato de menos que un total que miente.
      if (!(dur >= 0 && dur < 6 * 60 * 60 * 1000)) continue
      const dest = porTicket[uso.ticket].tools[uso.tool]
      dest.ms += dur
      if (dur > dest.msMax) dest.msMax = dur
      if (agente) {
        agente.ms += dur
        if (dur > agente.msMax) agente.msMax = dur
      }
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
    agentes: Object.entries(t.agentes)
      .map(([tipo, x]) => ({ tipo, ...x }))
      .sort((a, b) => b.ms - a.ms || b.llamadas - a.llamadas),
    comandos: Object.entries(t.comandos)
      .map(([familia, llamadas]) => ({ familia, llamadas }))
      .sort((a, b) => b.llamadas - a.llamadas),
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
  lineas.push('Lo regenera `node harness.js metricas` leyendo los transcripts de Claude Code.')
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

  const agentes = new Map()
  for (const [, d] of tickets) {
    for (const a of d.agentes || []) {
      const x = agentes.get(a.tipo) || { llamadas: 0, lanzados: 0, bloqueantes: 0, ms: 0, msMax: 0 }
      x.llamadas += a.llamadas
      x.lanzados += a.lanzados
      x.bloqueantes += a.bloqueantes
      x.ms += a.ms
      x.msMax = Math.max(x.msMax, a.msMax)
      agentes.set(a.tipo, x)
    }
  }
  if (agentes.size) {
    lineas.push('## Agentes')
    lineas.push('')
    lineas.push('Cuantas veces se delego en cada rol. **El tiempo de un agente casi no se puede medir**')
    lineas.push('desde el transcript, y por eso la tabla separa las dos formas de llamarlo:')
    lineas.push('')
    lineas.push('- **Lanzados** (en segundo plano): el transcript solo guarda el acuse del lanzamiento, en ~2 s.')
    lineas.push('  Lo que el agente tardo de verdad NO esta escrito en ningun lado. Su tiempo es 0 aca, y')
    lineas.push('  eso es "no se sabe", no "salio gratis".')
    lineas.push('- **Bloqueantes**: devuelven su informe, asi que el tiempo es real -pero es wall-clock, con')
    lineas.push('  la espera humana adentro-. Sirve para comparar entre roles, no como costo de computo.')
    lineas.push('')
    lineas.push('| Rol | Llamadas | Lanzados | Bloqueantes | Tiempo (solo bloqueantes) |')
    lineas.push('|---|--:|--:|--:|--:|')
    for (const [tipo, a] of [...agentes.entries()].sort((x, y) => y[1].llamadas - x[1].llamadas)) {
      lineas.push(`| ${tipo} | ${a.llamadas} | ${a.lanzados} | ${a.bloqueantes} | ${a.bloqueantes ? duracion(a.ms) : '-'} |`)
    }
    lineas.push('')
  }

  const comandos = new Map()
  for (const [, d] of tickets) {
    for (const c of d.comandos || []) comandos.set(c.familia, (comandos.get(c.familia) || 0) + c.llamadas)
  }
  if (comandos.size) {
    const filas = [...comandos.entries()].sort((a, b) => b[1] - a[1])
    const totalLlamadas = filas.reduce((a, x) => a + x[1], 0)
    const TOPE = 15
    lineas.push('## Que se ejecuta en la terminal')
    lineas.push('')
    lineas.push('Agrupado por la FORMA del comando. Sirve para contestar que conviene convertir en una')
    lineas.push('tool: casi ningun comando se repite palabra por palabra pero la forma se repite todo el')
    lineas.push('tiempo.')
    lineas.push('')
    lineas.push('**Se ordena por LLAMADAS y no por tiempo, a proposito.** El tiempo que el transcript le')
    lineas.push('atribuye a un comando es el viaje de ida y vuelta completo, con la generacion del modelo')
    lineas.push('adentro -por eso un `cat` puede promediar 30 s, que no es lo que tarda un `cat`-. Lo que')
    lineas.push('se puede bajar no es lo que tarda cada comando, es CUANTOS viajes hacen falta: una tool')
    lineas.push('que junta cinco pasos en uno ahorra cuatro viajes, corra rapido o lento.')
    lineas.push('')
    lineas.push('| Forma del comando | Llamadas | % |')
    lineas.push('|---|--:|--:|')
    for (const [familia, n] of filas.slice(0, TOPE)) {
      lineas.push(`| \`${familia}\` | ${miles(n)} | ${((n / totalLlamadas) * 100).toFixed(1)}% |`)
    }
    if (filas.length > TOPE) {
      const resto = filas.slice(TOPE).reduce((a, x) => a + x[1], 0)
      lineas.push(`| *(y ${filas.length - TOPE} forma/s mas)* | ${miles(resto)} | ${((resto / totalLlamadas) * 100).toFixed(1)}% |`)
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

module.exports = { familiaDeComando, agregar, reporte, duracion, miles, resumenUso }
