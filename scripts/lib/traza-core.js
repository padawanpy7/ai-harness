// traza-core.js - logica pura del arbol de delegacion: parsea transcripts YA LEIDOS (sin fs, sin
// red) y devuelve el arbol como DATO, no como texto. Las vistas (arbol/timeline/rebotes) consumen
// esa estructura; agregar una vista nunca toca este archivo.
//
// Tres fuentes, las tres texto plano que YA se escribe solo (jira/META/design-traza.md):
//   - el transcript de la sesion: eventos JSONL con `Agent` tool_use/tool_result (la delegacion) y
//     `queue-operation` con un <task-notification> (como termino: completed/failed).
//   - el transcript de CADA subagente: mismo formato, y ahi puede haber nuevas delegaciones (la
//     recursion). Si el subagente se corto por rate limit, su propia ultima linea trae
//     `isApiErrorMessage: true` - eso alcanza para saber que paso SIN necesitar la notificacion.
//   - metrics/tool-runs.log (ya parseado por quien llama: mismo formato que scripts/lib/fallos-core
//     `parsear`), cruzado por VENTANA DE TIEMPO: dice que corrio un nodo aunque su transcript no
//     este.
//
// Nada se inventa: un nodo sin transcript NI notificacion queda con estado 'sin transcript' y
// tokens/ms en null, nunca en 0 (jira/META/design-traza.md, riesgo 1).

function eventos(texto) {
  const salida = []
  for (const linea of String(texto || '').split('\n')) {
    if (!linea.trim()) continue
    let j
    try { j = JSON.parse(linea) } catch { continue }
    salida.push(j)
  }
  return salida
}

function textoDeContenido(c) {
  if (typeof c === 'string') return c
  if (Array.isArray(c)) return c.map((x) => (x && x.text) || '').join(' ')
  return ''
}

// Las delegaciones de UN transcript (sesion o subagente: el formato es el mismo en los dos). Une
// cada `Agent` tool_use con su tool_result por id, y de ahi saca el agentId con el que se puede
// leer el transcript del subagente.
function delegaciones(evts) {
  const pendientes = new Map()
  const salida = []
  for (const e of evts) {
    const contenido = e.message && e.message.content
    if (!Array.isArray(contenido)) continue
    for (const b of contenido) {
      if (b.type === 'tool_use' && b.name === 'Agent') {
        pendientes.set(b.id, { toolUseId: b.id, ts: e.timestamp, input: b.input || {} })
      }
      if (b.type === 'tool_result' && pendientes.has(b.tool_use_id)) {
        const pend = pendientes.get(b.tool_use_id)
        pendientes.delete(b.tool_use_id)
        const texto = textoDeContenido(b.content)
        const m = /agentId:\s*([a-z0-9]+)/i.exec(texto)
        salida.push({
          toolUseId: pend.toolUseId,
          agentId: m ? m[1] : null,
          tipo: pend.input.subagent_type || null,
          descripcion: pend.input.description || null,
          ts: pend.ts,
        })
      }
    }
  }
  return salida
}

function agentIdsReferenciados(texto) {
  return delegaciones(eventos(texto)).map((d) => d.agentId).filter(Boolean)
}

// `<task-notification>` llega por un evento `queue-operation` en el transcript de quien LANZO el
// agente (no en el propio). Es la unica fuente de estado cuando el transcript del subagente ya no
// esta: Temp se limpia, pero esta notificacion vive en el .jsonl de la sesion, que no se limpia.
function notificaciones(evts) {
  const salida = []
  for (const e of evts) {
    if (e.type !== 'queue-operation') continue
    const c = String(e.content || '')
    if (!c.includes('<task-notification>')) continue
    const id = /<task-id>([^<]+)<\/task-id>/.exec(c)
    const st = /<status>([^<]+)<\/status>/.exec(c)
    const sm = /<summary>([\s\S]*?)<\/summary>/.exec(c)
    if (!id || !st) continue
    const estado = st[1] === 'completed' ? 'ok' : st[1] === 'failed' ? 'cortado' : null
    if (!estado) continue
    salida.push({ agentId: id[1], estado, motivo: sm ? sm[1].trim() : null, ts: e.timestamp })
  }
  return salida
}

function sumarUso(acc, u) {
  if (!u) return acc
  acc.entrada += u.input_tokens || 0
  acc.salida += u.output_tokens || 0
  acc.cacheLectura += u.cache_read_input_tokens || 0
  acc.cacheEscritura += u.cache_creation_input_tokens || 0
  return acc
}

// Lo que se puede sacar del transcript PROPIO de un nodo: cuanto costo, cuanto tardo, que
// herramientas uso (sin contar `Agent`: esas son los hijos, no una herramienta de este nodo) y si
// se corto -su propia ultima linea puede traer `isApiErrorMessage`, que es la señal directa de un
// rate limit sin depender de la notificacion del padre-.
function usoDeTranscript(evts) {
  if (!evts.length) return null
  const tokens = { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 }
  const herramientas = new Map()
  let inicio = null
  let fin = null
  let cortado = false
  let motivo = null
  for (const e of evts) {
    if (e.timestamp) {
      if (!inicio || e.timestamp < inicio) inicio = e.timestamp
      if (!fin || e.timestamp > fin) fin = e.timestamp
    }
    if (e.message && e.message.usage) sumarUso(tokens, e.message.usage)
    const contenido = e.message && e.message.content
    if (Array.isArray(contenido)) {
      for (const b of contenido) {
        if (b.type === 'tool_use' && b.name !== 'Agent') {
          herramientas.set(b.name, (herramientas.get(b.name) || 0) + 1)
        }
      }
    }
    if (e.isApiErrorMessage) {
      cortado = true
      const texto = textoDeContenido(contenido)
      motivo = texto || e.error || null
    }
  }
  tokens.total = tokens.entrada + tokens.salida
  return {
    ts: { inicio, fin },
    ms: inicio && fin ? new Date(fin).getTime() - new Date(inicio).getTime() : null,
    tokens,
    herramientas: [...herramientas.entries()].map(([tool, veces]) => ({ tool, veces })).sort((a, b) => b.veces - a.veces),
    cortado,
    motivo,
  }
}

// Cruce con tool-runs.log (ya parseado: [{fecha, tool, exit, ms, padre}, ...]) por VENTANA DE
// TIEMPO. Sin ventana (desde/hasta nulos) o sin filas adentro, se devuelve [] - un nodo sin
// corridas no inventa ninguna.
function filtrarComandos(filas, desde, hasta) {
  if (!desde || !hasta || !Array.isArray(filas)) return []
  const conteo = new Map()
  for (const f of filas) {
    if (!f || !f.fecha || !f.tool) continue
    if (f.fecha < desde || f.fecha > hasta) continue
    conteo.set(f.tool, (conteo.get(f.tool) || 0) + 1)
  }
  return [...conteo.entries()].map(([tool, veces]) => ({ tool, veces })).sort((a, b) => b.veces - a.veces)
}

function ticketDe(evts) {
  for (const e of evts) if (e.gitBranch) return e.gitBranch
  return null
}

function nodosDeNivel(evtsPadre, subagentes, comandos, finVentana) {
  const dels = delegaciones(evtsPadre)
  const notifs = new Map(notificaciones(evtsPadre).map((n) => [n.agentId, n]))
  return dels.map((d, i) => {
    const siguiente = dels[i + 1]
    return construirNodo(d, siguiente, notifs.get(d.agentId), subagentes, comandos, finVentana)
  })
}

function construirNodo(d, siguiente, notif, subagentes, comandos, finVentana) {
  const subTexto = d.agentId ? subagentes.get(d.agentId) : undefined
  const subEvts = subTexto !== undefined ? eventos(subTexto) : null
  const uso = subEvts ? usoDeTranscript(subEvts) : null

  const finEstimado = (siguiente && siguiente.ts) || finVentana || null

  let estado
  let motivo = null
  let ms = null
  let tokens = null
  let herramientas = null
  let ventanaFin = finEstimado

  if (uso) {
    estado = uso.cortado ? 'cortado' : 'ok'
    motivo = uso.cortado ? uso.motivo : null
    ms = uso.ms
    tokens = uso.tokens
    herramientas = uso.herramientas
    if (uso.ts.fin) ventanaFin = uso.ts.fin
  } else if (notif) {
    estado = notif.estado
    motivo = notif.estado === 'cortado' ? notif.motivo : null
    ms = d.ts && notif.ts ? new Date(notif.ts).getTime() - new Date(d.ts).getTime() : null
    ventanaFin = notif.ts || finEstimado
  } else {
    estado = 'sin transcript'
  }

  const comandosBf = filtrarComandos(comandos, d.ts, ventanaFin)
  const hijos = subEvts ? nodosDeNivel(subEvts, subagentes, comandos, finEstimado) : []

  return {
    agentId: d.agentId,
    tipo: d.tipo,
    descripcion: d.descripcion,
    ts: d.ts,
    ms,
    tokens,
    herramientas,
    comandosBf,
    estado,
    motivo,
    hijos,
  }
}

function sumarTokens(a, b) {
  if (!b) return a
  return {
    entrada: a.entrada + b.entrada,
    salida: a.salida + b.salida,
    cacheLectura: a.cacheLectura + b.cacheLectura,
    cacheEscritura: a.cacheEscritura + b.cacheEscritura,
    total: a.total + b.total,
  }
}

function acumularTokens(nodos) {
  let t = { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0, total: 0 }
  for (const n of nodos) {
    t = sumarTokens(t, n.tokens)
    t = sumarTokens(t, acumularTokens(n.hijos))
  }
  return t
}

function construirArbol({ sesionId, ticket, sesionTexto, subagentes, comandos }) {
  const sesionEvts = eventos(sesionTexto)
  const nodos = nodosDeNivel(sesionEvts, subagentes || new Map(), comandos || [], null)
  const usoSesion = usoDeTranscript(sesionEvts)
  return {
    sesion: sesionId,
    ticket: ticket || ticketDe(sesionEvts),
    tokensPropios: usoSesion ? usoSesion.tokens : null,
    tokensTotales: sumarTokens(usoSesion ? usoSesion.tokens : { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0, total: 0 }, acumularTokens(nodos)),
    nodos,
  }
}

// Aplana el arbol en orden cronologico (para la vista timeline). Cada fila trae su profundidad.
function aplanar(nodos, profundidad = 0) {
  const salida = []
  for (const n of nodos) {
    salida.push({ ...n, profundidad })
    salida.push(...aplanar(n.hijos, profundidad + 1))
  }
  return salida.sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')))
}

// El loop que no cierra: implementer -> verifier -> implementer, CONSECUTIVO en el tiempo (sin
// importar la profundidad: un rebote es un rebote aunque el verifier lo haya lanzado el lead y no
// el implementer directamente).
function detectarRebotes(nodos) {
  const plana = aplanar(nodos)
  const rebotes = []
  for (let i = 0; i + 2 < plana.length; i++) {
    if (plana[i].tipo === 'implementer' && plana[i + 1].tipo === 'verifier' && plana[i + 2].tipo === 'implementer') {
      rebotes.push([plana[i], plana[i + 1], plana[i + 2]])
    }
  }
  return rebotes
}

module.exports = {
  eventos,
  delegaciones,
  agentIdsReferenciados,
  notificaciones,
  usoDeTranscript,
  filtrarComandos,
  construirArbol,
  aplanar,
  detectarRebotes,
}
