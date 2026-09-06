// ablacion-core.js - cuanto cuesta cada pieza del harness y cuantas veces atajo algo de verdad.
// Puro: recibe corridas y metadatos ya leidos.
//
// Por que existe: la Regla 10 -"desmonta andamiaje viejo: saca un componente, observa si el
// resultado empeora y conserva solo lo que carga peso"- esta escrita desde el dia uno y nunca se
// ejecuto, porque no habia con que medir. Es la ficha HN-ABLACION-DEL-ANDAMIAJE de bf.
//
// Lo que NO hace: correr el harness con y sin cada pieza. Eso necesita un conjunto de tareas de
// prueba y varias corridas, y seria inventar un experimento caro sobre datos que ya existen.
// Lo que si hace es contestar, sobre el log real, las dos preguntas que deciden una jubilacion:
// **cuanto cuesta** y **cuantas veces encontro algo**.
//
// LA TRAMPA, y por eso esto informa y no decide: un gate que nunca dio rojo puede significar tres
// cosas distintas, y los datos no las separan.
//   1. El problema que ataja ya no ocurre  -> candidato real a jubilarse.
//   2. El gate lo PREVIENE: nadie escribe lo que sabe que va a ser rechazado -> sacarlo lo trae
//      de vuelta. Es el caso mas comun en los gates de estilo.
//   3. El gate esta roto y no mira nada     -> eso lo contesta `control-negativo`, no esto.
// Por eso el veredicto es "mirar", nunca "borrar".

// Una pieza que puede salir con codigo != 0 es un GATE: su rojo significa "encontre algo".
// Una que siempre sale 0 es INFORMATIVA, y contarle rojos no dice nada.
function esGate(fuente) {
  const t = String(fuente || '')

  // La evidencia FUERTE es que la pieza pueda salir con codigo != 0. Vale para Node y para bash,
  // porque no todo el harness es Node.
  const salePorRojo = /process\.exit\(\s*[1-9]/.test(t) ||
    /process\.exit\([^)]*\?[^)]*:\s*[1-9]/.test(t) ||
    /process\.exit\([^)]*\?\s*0\s*:/.test(t) ||
    // En bash `exit 1` casi nunca esta al inicio de linea: viene tras `then`, `else`, `;` o `||`.
    /(?:^|[;&|)]|\bthen\b|\belse\b|\bdo\b)\s*exit\s+[1-9]/m.test(t)

  // "no bloquea" / "informativo" solo cuenta si la pieza lo dice de SI MISMA, o sea en la cabecera.
  // Mirar el archivo entero clasifico a `check` -la compuerta principal- como informativa, porque
  // en una linea suelta comenta que `doctor` lo es. Un falso negativo aca saca del analisis
  // justamente a la pieza que mas importa medir.
  const cabecera = t.split('\n').slice(0, 20).join('\n')
  if (/\bno bloquea\b|\binformativo\b|\bno es un gate\b/i.test(cabecera) && !salePorRojo) return false

  return salePorRojo
}

// `corridas` es [{tool, exit, ms}]. Devuelve una fila por tool con su costo y sus hallazgos.
function medir(corridas) {
  const porTool = new Map()
  for (const c of corridas || []) {
    if (!c || !c.tool) continue
    const f = porTool.get(c.tool) || { tool: c.tool, corridas: 0, rojos: 0, ms: 0, ultimoRojo: null }
    f.corridas++
    f.ms += Number(c.ms) || 0
    if (Number(c.exit) !== 0) {
      f.rojos++
      if (!f.ultimoRojo || String(c.sello || '') > f.ultimoRojo) f.ultimoRojo = c.sello || null
    }
    porTool.set(c.tool, f)
  }
  const total = [...porTool.values()].reduce((t, f) => t + f.ms, 0)
  return [...porTool.values()]
    .map((f) => ({
      ...f,
      msMedio: f.corridas ? Math.round(f.ms / f.corridas) : 0,
      porcentaje: total ? (f.ms / total) * 100 : 0,
    }))
    .sort((a, b) => b.ms - a.ms)
}

// `meta` por tool: { gate: bool }. Sin meta se asume gate, que es el caso conservador: una pieza
// mal clasificada como informativa desaparece del analisis sin que nadie lo note.
function veredicto(fila, meta = {}, { minimoCorridas = 10, caroPorciento = 15 } = {}) {
  const gate = meta.gate !== false
  if (!gate) {
    return { estado: 'informativa', porque: 'no bloquea: su exit no significa "encontre algo"' }
  }
  if (fila.corridas < minimoCorridas) {
    return { estado: 'sin datos', porque: `solo ${fila.corridas} corrida(s): no alcanza para juzgar` }
  }
  if (fila.rojos > 0) {
    return { estado: 'carga peso', porque: `atajo algo ${fila.rojos} vez/veces` }
  }
  if (fila.porcentaje >= caroPorciento) {
    return { estado: 'MIRAR', porque: `nunca encontro nada y se lleva ${fila.porcentaje.toFixed(0)}% del tiempo` }
  }
  return { estado: 'mirar', porque: `${fila.corridas} corridas sin encontrar nada` }
}

// El tiempo se concentra: sirve saber en que se va, aunque la pieza cargue peso.
function masCaras(filas, n = 3) {
  return filas.slice(0, n).map((f) => ({ tool: f.tool, porcentaje: f.porcentaje, ms: f.ms }))
}

module.exports = { esGate, medir, veredicto, masCaras }
