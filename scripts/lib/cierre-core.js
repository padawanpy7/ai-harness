// cierre-core.js - logica pura de `node harness.js cierre`: dada la info ya recolectada (git, archivos,
// el resultado de check), decide si el cierre de sesion esta completo. Sin fs ni child_process
// aca (eso lo hace cierre.js); asi se testea con `node --test` sin tocar el disco ni el repo real.
//
// Por que existe: el ritual de cierre (AGENTS.md S4) vivia solo como prosa, asi que el dueño lo
// tenia que dictar cada vez y aun asi se escapaban pasos (portado de bf-db-workspace, commit
// b61a37b + 704226f). Lo que no se mide, no se cierra.

const doctorCore = require('./doctor-core')

// Un chequeo es {id, estado: 'ok'|'falta'|'aviso', titulo, detalle[]}.
const ok = (id, titulo, detalle = []) => ({ id, estado: 'ok', titulo, detalle })
const falta = (id, titulo, detalle = []) => ({ id, estado: 'falta', titulo, detalle })
const aviso = (id, titulo, detalle = []) => ({ id, estado: 'aviso', titulo, detalle })

// --- 1. nada sin commitear -------------------------------------------------------------------
function chequearLimpio(archivosSucios) {
  if (!archivosSucios.length) return ok('limpio', 'git status: sin cambios sueltos')
  return falta('limpio', `${archivosSucios.length} archivo/s sin commitear`, archivosSucios)
}

// --- 2. nada sin pushear ---------------------------------------------------------------------
function chequearPusheado(commitsSinPushear, tieneUpstream) {
  if (!tieneUpstream) {
    return aviso('pusheado', 'main no tiene upstream configurado', ['git push -u origin main'])
  }
  if (commitsSinPushear > 0) {
    return falta('pusheado', `${commitsSinPushear} commit/s sin pushear`, ['git push origin main'])
  }
  return ok('pusheado', 'al dia con origin/main')
}

// --- 3. work/PROGRESO.md cuenta ESTA sesion ---------------------------------------------------
// Un PROGRESO que no menciona el dia en que se trabajo es un puente que miente: el proximo agente
// lee la entrada anterior y cree que eso es el estado actual.
function chequearProgreso(existeArchivo, fechas, hoy) {
  if (!existeArchivo) {
    return falta('progreso', 'no existe work/PROGRESO.md', ['crealo: es el puente entre sesiones'])
  }
  if (!fechas.length) {
    return falta('progreso', 'work/PROGRESO.md: sin ninguna entrada con fecha',
      ['formato: "## AAAA-MM-DD - <que>"'])
  }
  const masReciente = fechas.slice().sort().pop()
  if (masReciente < hoy) {
    return falta('progreso', `work/PROGRESO.md: su ultima entrada es del ${masReciente}, no de hoy (${hoy})`,
      ['anota que paso hoy: que se hizo, que se verifico, que queda'])
  }
  // Entrada mas reciente arriba: lo dice el encabezado del propio archivo.
  const ordenadas = fechas.slice().sort().reverse()
  if (fechas.join('|') !== ordenadas.join('|')) {
    return aviso('progreso', 'work/PROGRESO.md: las entradas no estan de mas nueva a mas vieja',
      [`orden actual: ${fechas.join(' -> ')}`])
  }
  return ok('progreso', `work/PROGRESO.md: al dia (${masReciente})`)
}

// --- 4. check en verde ------------------------------------------------------------------------
// `cierre` no repite lo que `check` ya mide (tests, ascii, spell, estructura, secretos): lo corre
// y toma su veredicto como un chequeo mas, asi `cierre` es la unica puerta y no hay que acordarse
// de dos comandos.
function chequearCheck(exitCode, salida) {
  if (exitCode === 0) return ok('check', 'node harness.js check --todos: verde')
  const cola = String(salida || '').trim().split('\n').filter(Boolean).slice(-8)
  return falta('check', 'node harness.js check --todos: FALLA', [...cola, 'corre: node harness.js check --todos'])
}

// --- 5. comandos/rutas muertos en los docs -----------------------------------------------------
// Los docs de prosa citan rutas de scripts/ y tools de `node harness.js`; el harness se refactoriza
// (esta semana se borraron 6 wrappers .sh y scripts/_ascii.py) y esas menciones quedan mintiendo:
// copiar y pegar lo documentado falla, y parece culpa de quien lo corre.

// scripts/**: hasta el primer caracter que no sea de ruta. Un glob (`scripts/lib/*.test.js`) se
// recorta a la carpeta antes del `*`, que es lo que de verdad hay que verificar que exista.
function extraerRutas(texto) {
  const encontradas = new Set()
  for (const m of (texto || '').matchAll(/\bscripts\/[\w./*-]+/g)) {
    let ruta = m[0].replace(/[.,;:)\]}]+$/, '')
    if (ruta.includes('*')) ruta = ruta.slice(0, ruta.lastIndexOf('/'))
    if (ruta && ruta !== 'scripts') encontradas.add(ruta)
  }
  return [...encontradas]
}

// `node <entrada> <tool>`: el nombre de la tool, sin sus argumentos ni flags.
//
// El nombre del entrypoint es un PARAMETRO y no una constante: cada derivado de esta plantilla lo
// renombra (bf.js, pc.js, ...). Cuando estaba escrito a mano, renombrarlo dejo la regex buscando
// el nombre viejo -y un chequeo que no encuentra nada se ve identico a uno que pasa-.
const escaparRegex = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function extraerTools(texto, entrada = 'harness.js') {
  const encontradas = new Set()
  const re = new RegExp(`\\bnode ${escaparRegex(entrada)} ([a-zA-Z][\\w-]*)`, 'g')
  for (const m of (texto || '').matchAll(re)) encontradas.add(m[1])
  return [...encontradas]
}

// Recibe el texto y dos funciones de existencia (inyectadas para poder testear sin fs real):
// existeRuta(ruta) y esToolConocida(nombre). Devuelve lo que NO existe.
function referenciasMuertas(texto, existeRuta, esToolConocida, entrada = 'harness.js') {
  const muertas = []
  for (const ruta of extraerRutas(texto)) {
    if (!existeRuta(ruta)) muertas.push({ fragmento: ruta, porque: 'no existe ese archivo/carpeta' })
  }
  for (const tool of extraerTools(texto, entrada)) {
    if (!esToolConocida(tool)) {
      muertas.push({ fragmento: `node ${entrada} ${tool}`, porque: `no es una tool conocida (node ${entrada} sin argumentos lista las que hay)` })
    }
  }
  return muertas
}

function chequearDocsMuertos(hallazgosPorArchivo) {
  const conProblemas = Object.entries(hallazgosPorArchivo).filter(([, h]) => h.length)
  if (!conProblemas.length) return ok('docs', 'los docs no citan scripts ni tools muertas')

  const detalle = conProblemas.flatMap(([archivo, hallazgos]) =>
    hallazgos.map((h) => `${archivo}: "${h.fragmento}" -> ${h.porque}`))
  return falta('docs', `${conProblemas.length} archivo/s citan un script o una tool que ya no existe`, detalle)
}

// --- 6. lo generado, al dia si el sistema se movio ----------------------------------------------
// Este chequeo lo CONECTA cada derivado (la plantilla no lo llama): que lista se genera depende
// del proyecto -paquetes del sistema, un cliente de API, un lockfile-. La regla es la misma.
function chequearPaquetes(actual, guardado) {
  if (doctorCore.paquetesDesactualizados(actual, guardado)) {
    return falta('paquetes', `paquetes/explicitos.txt desactualizado (${guardado} guardados vs ${actual} instalados)`,
      ['regenera la lista y volve a correr el cierre'])
  }
  return ok('paquetes', `paquetes/explicitos.txt al dia (${actual})`)
}

// --- resumen ------------------------------------------------------------------------------------
function resumir(chequeos) {
  const faltan = chequeos.filter((c) => c.estado === 'falta')
  const avisos = chequeos.filter((c) => c.estado === 'aviso')
  return {
    completo: faltan.length === 0,
    faltan: faltan.length,
    avisos: avisos.length,
    ok: chequeos.filter((c) => c.estado === 'ok').length,
  }
}

// --- 7. cada dia trabajado tiene su entrada en la bitacora ------------------------------------
// El chequeo 3 solo pregunta "la ultima entrada es de hoy?", y con eso DOS dias sin escribir pasan
// como UNA sola falta: al anotar la de hoy el gate se calla y el dia anterior queda sin registrar
// para siempre. Portado de bf-db-workspace (98919bc), donde lo midieron en vivo: dos dias, 17
// commits, cero entradas, una sola falta.
//
// La ventana es fija (7 dias) y NO se ancla a la entrada mas nueva a proposito: anclarla
// reproduce el bug, porque escribir la de hoy correria el borde y taparia el dia de ayer.
//
// `fechasEnLaBitacora` tiene que incluir las entradas ARCHIVADAS (work/progreso/<mes>.md), no
// solo las de PROGRESO.md: ese archivo guarda las dos mas nuevas y el resto se muda. Sin el
// archivo historico, cada mudanza inventaria un dia faltante.
function chequearDiasSinEntrada(diasConCommits, fechasEnLaBitacora, ventanaDias = 7) {
  const escritas = new Set(fechasEnLaBitacora)
  const sinEntrada = (diasConCommits || []).filter((d) => !escritas.has(d.fecha))
  if (!sinEntrada.length) {
    const n = (diasConCommits || []).length
    return ok('dias', `los ${n} dia/s con commits de los ultimos ${ventanaDias} tienen su entrada`)
  }
  const detalle = sinEntrada.map(
    (d) => `${d.fecha}: ${d.commits} commit/s sin entrada${d.muestra ? ` (ej. "${d.muestra}")` : ''}`)
  return falta('dias', `${sinEntrada.length} dia/s con trabajo y sin entrada en la bitacora`, [
    ...detalle,
    'escribi la entrada de ese dia: la bitacora es el puente, y un dia que falta no vuelve',
  ])
}

module.exports = {
  chequearLimpio,
  chequearPusheado,
  chequearProgreso,
  chequearCheck,
  extraerRutas,
  extraerTools,
  referenciasMuertas,
  chequearDocsMuertos,
  chequearPaquetes,
  chequearDiasSinEntrada,
  resumir,
}
