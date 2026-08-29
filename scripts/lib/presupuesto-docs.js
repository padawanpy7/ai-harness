// El PRESUPUESTO de los documentos que se leen en cada arranque. Puro: recibe tamanos, no lee disco.
//
// Por que existe: `AGENTS.md` dice desde el dia uno "mantenlo lean (~200, max 500 lineas)" y un
// techo que nadie mide no es un techo, es una intencion. No se incumple por descuido: agregar una
// linea tiene premio visible (no repetir un error) y sacarla no tiene ninguno. Un aviso mas no
// cambia ese incentivo; un gate si (porteado de bf-db-workspace, commit con `presupuesto.js`).
//
// Los topes viven ACA y no en cada tool: son una decision del proyecto, no un detalle de `check`.
// Medidos el 22/08: AGENTS.md 207, CLAUDE.md 13, memory/MEMORY.md 45, work/PROGRESO.md 177 (recien
// archivado). Los topes dejan margen sobre lo medido, no lo que se querria llegar a escribir.
const PRESUPUESTO = [
  { archivo: 'AGENTS.md', tope: 250, porque: 'se lee en CADA tarea; lo que no aplica a todas va a una skill o playbook' },
  { archivo: 'CLAUDE.md', tope: 30, porque: 'es solo el puntero a AGENTS.md; si crece esta duplicando el contrato' },
  { archivo: 'memory/MEMORY.md', tope: 80, porque: 'es un INDICE de punteros; el hecho en si va a memory/hechos/' },
  // `delta: false` -> el gate de CRECIMIENTO no aplica. Es una BITACORA, no un indice ni un
  // contrato: crece por diseño, una entrada por sesion, y su primera entrada ya son 25 lineas.
  // Lo que la acota es el tope absoluto mas el archivado por mes, no un limite por tanda.
  { archivo: 'work/PROGRESO.md', tope: 150, delta: false, porque: 'es el puente entre sesiones: las entradas viejas se archivan por mes en work/progreso/' },
]

// `medidos` es [{ archivo, lineas }]. Devuelve el veredicto y, por archivo, cuanto sobra.
// Un archivo que NO existe no es una violacion: puede no haberse creado todavia.
function evaluar(medidos, presupuesto = PRESUPUESTO) {
  const filas = presupuesto.map((p) => {
    const m = (medidos || []).find((x) => x.archivo === p.archivo)
    if (!m || m.lineas === null || m.lineas === undefined) {
      return { ...p, lineas: null, sobra: 0, ok: true, ausente: true }
    }
    const sobra = m.lineas - p.tope
    return { ...p, lineas: m.lineas, sobra: sobra > 0 ? sobra : 0, ok: sobra <= 0, ausente: false }
  })
  return { ok: filas.every((f) => f.ok), filas, excedidos: filas.filter((f) => !f.ok) }
}

// El mensaje dice CUANTO sobra y QUE hacer, no solo que se paso: un gate que dice "estas en 892"
// deja al que lo lee decidiendo a ciegas que sacar.
function informe(resultado) {
  return resultado.filas.map((f) => {
    if (f.ausente) return `  .  ${f.archivo}: no existe`
    const estado = f.ok ? 'OK ' : 'X  '
    const detalle = f.ok
      ? `${f.lineas}/${f.tope} lineas`
      : `${f.lineas}/${f.tope} lineas - SOBRAN ${f.sobra}. ${f.porque}`
    return `  ${estado} ${f.archivo}: ${detalle}`
  }).join('\n')
}

// --- el gate de CRECIMIENTO: cuanto crecio, no cuanto mide -------------------------------------
// Portado de bf-db-workspace (ed76d37). El tope solo salta cuando YA rompiste, y siempre en mitad
// de otra tarea: la poda sale grande, apurada y a desgano. Lo que hay que medir es el INCREMENTO,
// porque ahi esta la decision que importa: "esto entra como UNA linea de indice, o como veinte
// lineas de seccion". Si no entra en tres lineas, no era una linea de indice.
//
// SACAR nunca falla: un archivo que encogio o quedo igual pasa siempre.
const CRECIMIENTO_MAXIMO = 3

// `medidos` es [{ archivo, crecio }] con el neto (agregadas - borradas) contra la base.
function evaluarDelta(medidos, { tope = CRECIMIENTO_MAXIMO, presupuesto = PRESUPUESTO } = {}) {
  const filas = presupuesto.filter((p) => p.delta !== false).map((p) => {
    const m = (medidos || []).find((x) => x.archivo === p.archivo)
    const crecio = m && Number.isFinite(m.crecio) ? m.crecio : 0
    return { archivo: p.archivo, crecio, ok: crecio <= tope }
  })
  return { ok: filas.every((f) => f.ok), filas, tope, excedidos: filas.filter((f) => !f.ok) }
}

function informeDelta(resultado) {
  return resultado.filas
    .filter((f) => f.crecio !== 0)
    .map((f) => {
      const signo = f.crecio > 0 ? `+${f.crecio}` : `${f.crecio}`
      if (f.ok) return `  OK  ${f.archivo}: ${signo} linea(s)`
      return `  X   ${f.archivo}: ${signo} linea(s), el maximo es +${resultado.tope}\n` +
        `      lo que no entra en ${resultado.tope} lineas no es una linea de indice: es una seccion,\n` +
        `      y las secciones van a un hecho, un playbook o una skill`
    }).join('\n')
}

module.exports = { PRESUPUESTO, CRECIMIENTO_MAXIMO, evaluar, informe, evaluarDelta, informeDelta }
