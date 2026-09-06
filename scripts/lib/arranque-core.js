// arranque-core.js - las contradicciones que puede cazar una maquina en los documentos de
// arranque. Puro: recibe textos y listas ya leidas, no toca disco.
//
// Por que existe: el playbook del lead pide "simular un arranque SIN CONTEXTO" y `cierre` lo
// imprime como recordatorio, o sea que dependia de que alguien se acordara y tuviera ganas.
// El 29/08/2026 el cierre dio 7 ok mientras `work/PROGRESO.md` decia tres cosas falsas: una
// pregunta abierta que ya estaba respondida, un pendiente ya hecho, y una frase mutilada.
//
// Lo que se puede medir sin criterio son las CONTRADICCIONES: el documento afirma algo que el
// repo desmiente. Lo que necesita criterio -si lo escrito alcanza para retomar- lo juzga un
// agente sin contexto, y para eso esta el paquete que arma `arranque-frio.js`.

// Un pendiente que dice "falta crear X" cuando X ya existe. Es el caso que mas paso: el pendiente
// se escribe, se resuelve en la misma tanda, y nadie vuelve a borrarlo.
const VERBOS_DE_PENDIENTE = /\b(falta|faltan|sin (empezar|hacer|crear|traer|portar)|pendiente|queda por|hay que (crear|hacer|traer|portar))\b/i

// Rutas y tools citadas en un texto: `algo/asi.js`, `node harness.js <tool>`.
const RUTA = /`([\w./-]+\/[\w./-]+)`/g
const TOOL = /`node [\w.-]+\.js ([a-z][\w-]*)`/g

function pendientesDe(texto) {
  const lineas = String(texto || '').split(/\r?\n/)
  const salida = []
  let dentro = false
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]
    if (/^-\s*\*?\*?Pendiente/i.test(l.trim())) { dentro = true; salida.push({ linea: i + 1, texto: l }); continue }
    if (dentro) {
      // La lista de pendientes termina cuando arranca otro bloque de primer nivel o otra entrada.
      if (/^-\s*\*?\*?(Gotchas|Hecho|Verificado|Como volver)/i.test(l.trim()) || /^##\s/.test(l)) { dentro = false; continue }
      if (/^\s+\d+\.\s+\S/.test(l) || /^\s+-\s+\S/.test(l)) salida.push({ linea: i + 1, texto: l })
    }
  }
  return salida
}

function citasDe(texto) {
  const t = String(texto || '')
  const rutas = [...t.matchAll(RUTA)].map((m) => m[1])
  const tools = [...t.matchAll(TOOL)].map((m) => m[1])
  return { rutas: [...new Set(rutas)], tools: [...new Set(tools)] }
}

// `existeRuta` y `esToolConocida` se inyectan para poder testear sin disco.
function contradicciones(pendientes, { existeRuta, esToolConocida }) {
  const hallazgos = []
  for (const p of pendientes) {
    if (!VERBOS_DE_PENDIENTE.test(p.texto)) continue
    const { rutas, tools } = citasDe(p.texto)

    for (const r of rutas) {
      if (existeRuta(r)) {
        hallazgos.push({
          linea: p.linea,
          tipo: 'pendiente-ya-hecho',
          detalle: `dice que falta \`${r}\`, pero ${r} existe`,
        })
      }
    }
    for (const t of tools) {
      if (esToolConocida(t)) {
        hallazgos.push({
          linea: p.linea,
          tipo: 'pendiente-ya-hecho',
          detalle: `dice que falta la tool \`${t}\`, pero esta registrada`,
        })
      }
    }
  }
  return hallazgos
}

// Lo que el documento cita y NO existe: la otra mitad del mismo problema. Un pendiente que apunta
// a un archivo borrado manda al proximo agente a buscar algo que no esta.
function referenciasColgadas(texto, { existeRuta }) {
  const { rutas } = citasDe(texto)
  return rutas
    .filter((r) => !existeRuta(r))
    // Las rutas con comodin o placeholder no son referencias reales.
    .filter((r) => !/[<>*{}]/.test(r))
    .map((r) => ({ tipo: 'referencia-colgada', detalle: `cita \`${r}\`, que no existe` }))
}

function resumir(hallazgos) {
  return {
    ok: hallazgos.length === 0,
    total: hallazgos.length,
    porTipo: hallazgos.reduce((acc, h) => ({ ...acc, [h.tipo]: (acc[h.tipo] || 0) + 1 }), {}),
  }
}

module.exports = { pendientesDe, citasDe, contradicciones, referenciasColgadas, resumir }
