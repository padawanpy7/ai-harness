// gaps-core.js - que modo de falla repetido NO esta anotado en ningun lado. Puro.
//
// Por que existe: `fallos` encuentra los modos de falla que se repiten, y ahi se termina. El
// hallazgo aparece en una corrida, nadie lo anota, y vuelve a aparecer a la semana. Este es el
// paso del medio.
//
// Por que NO escribe fichas en un ledger, como la version de infra: ese harness tiene
// `FEATURES.json` por ticket y aca no hay ninguno. Crear uno seria un SEGUNDO esquema de
// planificacion al lado de `work/PROGRESO.md`, que es justo lo que el research del 31/08 marca
// como lo que no se adopta. Asi que en vez de escribir la ficha, se contesta la pregunta que la
// haria falta: **de lo que se repite, que no esta escrito todavia**.
//
// LO QUE NO HACE, a proposito: aplicar el arreglo. Encontrar el hueco es barato y mecanico;
// decidir que se hace con el no lo es. La deteccion la hace la maquina, el arreglo lo decide una
// persona.

// Un modo de falla esta "anotado" si la bitacora lo menciona de alguna forma reconocible: por el
// nombre de la tool, o por el texto del modo. Se busca flojo a proposito -basta con que el nombre
// aparezca cerca de la palabra que lo describe- porque el objetivo es detectar el SILENCIO
// TOTAL, no auditar como esta redactado.
function estaAnotado(modo, textos) {
  const tool = String(modo.tool || '').toLowerCase()
  if (!tool) return false
  return (textos || []).some((t) => {
    const bajo = String(t || '').toLowerCase()
    if (!bajo.includes(tool)) return false
    // Mencionar la tool no alcanza: tiene que estar dicha en un contexto de problema, o cualquier
    // linea que la nombre taparia el hueco.
    const cerca = bajo.split('\n').filter((l) => l.includes(tool)).join(' ')
    return /\bfall|\berror|\brojo|\bfalla|\bbug|\bse repite|\bno anda|\bproblema|\barreglar|\bpendiente/.test(cerca)
  })
}

// `modos` es lo que devuelve `fallos-core.agrupar()`: [{tool, exit, veces, ultima, ...}].
// `textos` son los documentos donde un hallazgo podria estar anotado.
function huecos(modos, textos, { minimo = 4 } = {}) {
  return (modos || [])
    .filter((m) => (m.veces || 0) >= minimo)
    .filter((m) => !estaAnotado(m, textos))
    .map((m) => ({
      tool: m.tool,
      exit: m.exit,
      veces: m.veces,
      ultima: m.ultima || null,
      // El texto que iria en la bitacora si alguien lo anotara. No se escribe solo: se propone.
      propuesta: `\`${m.tool}\` falla repetido (exit ${m.exit}, ${m.veces} veces` +
        `${m.ultima ? `, ultima ${m.ultima}` : ''}). Una falla que vuelve no es mala suerte: es una ` +
        'tool que pide algo que no se sabe, o que no dice lo que necesita.',
    }))
}

function resumir(huecosEncontrados, totalModos) {
  return {
    ok: huecosEncontrados.length === 0,
    huecos: huecosEncontrados.length,
    modos: totalModos,
  }
}

module.exports = { estaAnotado, huecos, resumir }
