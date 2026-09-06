// aceptacion-core.js - la REGLA DE PARADA de un ticket, pura: recibe texto y resultados, no corre
// nada ni toca disco.
//
// POR QUE EXISTE (research del 31/08 sobre loop engineering, docs/research-2026-08-31-loop-engineering.md):
// un loop spec son cinco piezas -trigger, goal, verification, stopping rule, memory- y nosotros
// teniamos cuatro. La que faltaba es esta.
//
// Lo que habia era `tasks.md`: casillas que **marca el mismo que trabaja**. Eso es una DECLARACION,
// no una verificacion, y este proyecto ya tiene dos hechos escritos sobre lo que cuesta confundirlas
// ([[decir-que-se-ficho-no-es-ficharlo]], [[un-e2e-verde-puede-no-haber-ejecutado-nada]]).
// Anthropic lo dice en una linea: "give Claude something that produces a pass or fail, and the loop
// closes on its own". Un criterio de aceptacion que no es un comando no cierra ningun loop.
//
// EL FORMATO es markdown normal, para que lo pueda escribir quien pide sin aprender nada nuevo:
//
//   ## El SP compila contra la base
//   ```sh
//   node harness.js db-compilar sql/PKG_X.sql --verificar
//   ```
//
//   ## La pantalla muestra el saldo en guaranies
//   > manual: entrar a la 265, pagina 12, con un cliente con dos cuentas
//
// Un `##` es un criterio. Adentro va UN comando (bloque cercado) o UNA linea `> manual: ...`.
//
// Por que se permite `manual:` y por que NO alcanza: hay cosas que ninguna tool nuestra ve hoy. Lo
// que NO se hace es dejar que eso pase por verde -seria justo el "reward hacking" que nombra The
// Verification Horizon: optimizar la medicion en vez del objetivo-. Un criterio manual se cuenta
// aparte y se muestra siempre, para que el que cierra sepa exactamente que NO verifico una maquina.

const RE_TITULO = /^##\s+(.+?)\s*$/
const RE_CERCA = /^\s*```/
// El `(\S.*?)` pide contenido de VERDAD: un `> manual:` vacio -el que deja la plantilla- matcheaba
// con el espacio que le sigue y se contaba como criterio cumplido de tramite. Un criterio que no
// dice COMO se verifica no es un criterio, y menos el que viene de fabrica.
const RE_MANUAL = /^>\s*manual:\s*(\S.*?)\s*$/i

// Devuelve { criterios, problemas }. Un criterio es
// { titulo, comando } o { titulo, manual: 'como se verifica a mano' }.
function parsear(texto) {
  const lineas = String(texto || '').split(/\r?\n/)
  const criterios = []
  const problemas = []
  let actual = null
  let dentroDeCerca = false
  let comando = []

  const cerrar = () => {
    if (!actual) return
    const cmd = comando.join('\n').trim()
    if (cmd) criterios.push({ titulo: actual.titulo, comando: cmd })
    else if (actual.manual) criterios.push({ titulo: actual.titulo, manual: actual.manual })
    else problemas.push({ titulo: actual.titulo, regla: 'criterio-sin-comando' })
    actual = null
    comando = []
  }

  for (const linea of lineas) {
    if (RE_CERCA.test(linea)) {
      // Una cerca fuera de un criterio no es un comando de nadie: se ignora el bloque entero.
      if (actual) dentroDeCerca = !dentroDeCerca
      continue
    }
    if (dentroDeCerca) { comando.push(linea); continue }

    const t = linea.match(RE_TITULO)
    if (t) { cerrar(); actual = { titulo: t[1] }; continue }

    const m = linea.match(RE_MANUAL)
    if (m && actual) { actual.manual = m[1]; continue }
    // Un "> manual:" se puede seguir en las lineas de cita de abajo: se juntan, porque cortar en la
    // primera deja el criterio a medias justo donde dice COMO verificarlo.
    const sigue = linea.match(/^>\s*(.+?)\s*$/)
    if (sigue && actual && actual.manual) actual.manual += ' ' + sigue[1]
  }
  // Una cerca sin cerrar se lleva el resto del archivo en silencio: eso se dice.
  if (dentroDeCerca) problemas.push({ titulo: actual ? actual.titulo : '(sin titulo)', regla: 'cerca-sin-cerrar' })
  cerrar()
  return { criterios, problemas }
}

// `resultados` es [{ titulo, exit }] con lo que devolvio cada comando. El veredicto NO inventa:
// un criterio del que no hay resultado queda como `sin correr`, que no es ni verde ni rojo.
//
// EL 2 ES "NO PUDE MEDIR", NO "FALLO". Es la convencion de todo este harness -`presupuesto` con un
// --max basura, `hechos` sin la carpeta, `features --gate` sin ledger, `db-sql` contra una base que
// no existe- y el 31/08 aparecio en un criterio real: `plsql-test` de ICC-83 salio 2 porque la base
// no respondia. Mezclarlo con el rojo hace leer "el ticket esta mal" cuando lo que pasa es que no se
// pudo verificar; separarlo y darlo por bueno seria peor -bastaria desenchufar la red para que el
// criterio pase-. Asi que se muestra aparte Y NO deja cerrar.
const NO_SE_PUDO_MEDIR = 2
function veredicto({ criterios = [], problemas = [] } = {}, resultados = []) {
  const porTitulo = new Map((resultados || []).map((r) => [r.titulo, r]))
  const pasaron = []
  const fallaron = []
  const sinMedir = []
  const sinCorrer = []
  const manuales = []

  for (const c of criterios) {
    if (c.manual) { manuales.push(c); continue }
    const r = porTitulo.get(c.titulo)
    if (!r) { sinCorrer.push(c); continue }
    if (r.exit === 0) pasaron.push({ ...c, ...r })
    else if (r.exit === NO_SE_PUDO_MEDIR) sinMedir.push({ ...c, ...r })
    else fallaron.push({ ...c, ...r })
  }

  return {
    // Sin criterios NO es "cumplio todo": es que nadie dijo cuando esta hecho.
    ok: criterios.length > 0 && !problemas.length && !fallaron.length && !sinCorrer.length && !sinMedir.length,
    sinCriterios: criterios.length === 0,
    pasaron, fallaron, sinMedir, sinCorrer, manuales, problemas,
    total: criterios.length,
  }
}

function informe(v) {
  if (v.sinCriterios) {
    return [
      '  ·  este ticket no declara HECHO_CUANDO: no hay regla de parada',
      '     "terminado" queda siendo una opinion. Escribi los criterios como comandos que dan 0 o 1.',
    ].join('\n')
  }
  const filas = []
  for (const c of v.pasaron) filas.push(`  OK  ${c.titulo}`)
  for (const c of v.fallaron) filas.push(`  X   ${c.titulo}  (exit ${c.exit})\n        ${c.comando}`)
  for (const c of v.sinMedir || []) {
    filas.push(`  ?   ${c.titulo}: NO SE PUDO MEDIR (exit 2), no es que fallo
        ${c.comando}`)
  }
  for (const c of v.sinCorrer) filas.push(`  ?   ${c.titulo}: no se corrio`)
  for (const c of v.manuales) filas.push(`  ·   ${c.titulo}  [A MANO, ninguna maquina lo verifico]\n        ${c.manual}`)
  for (const p of v.problemas) {
    filas.push(p.regla === 'cerca-sin-cerrar'
      ? `  X   "${p.titulo}": tiene un bloque \`\`\` sin cerrar`
      : `  X   "${p.titulo}": no dice COMO se verifica (ni comando ni "> manual:")`)
  }
  return filas.join('\n')
}


// --- la CADENCIA: cuantas vueltas se dieron sin llegar al verde --------------------------------
//
// `verify_max_rounds` estaba escrito en `.claude/agents/lead.md`, en `memory/playbooks/lead.md` y
// en `docs/el-loop-del-harness.md` -"loop hasta verde o N rondas, despues escala al humano"- y
// NINGUN codigo lo leia: dependia de que alguien se acordara. Es la misma familia que la regla de
// las tools ("un agente con 30 tools elige peor"): una declaracion sin mecanismo.
//
// LA RONDA SE MIDE COMO LA VEO YO, y no como la penso quien la escribio: alla era una vuelta
// implementer -> verifier; aca es **cuantas veces la regla de parada de ESTE ticket dio rojo hoy**.
// Es lo unico que el harness ya registra por su cuenta -`metrics/tool-runs.log`-, y ademas es mas
// honesto: cuenta los intentos que de verdad no cerraron, no los que alguien recordo anotar.
//
// No frena nada: DICE que se agotaron las vueltas. Frenar por su cuenta seria decidir por el que
// trabaja; el punto es que "seguir intentando" deje de ser gratis y silencioso.
function cadencia(rondasRojas, maximo) {
  const max = Number.isFinite(maximo) && maximo > 0 ? maximo : 0
  if (!max) return { escalar: false, rondas: rondasRojas, maximo: max }
  return { escalar: rondasRojas >= max, rondas: rondasRojas, maximo: max }
}

function informeCadencia(c) {
  if (!c.escalar) return ''
  return [
    '',
    `  !!  ${c.rondas} vuelta(s) sin llegar al verde, y el maximo declarado es ${c.maximo}.`,
    '      ESCALA: lo que falta no se resuelve intentando de nuevo. Deci que probaste, que',
    '      descartaste y que decision hace falta -a PREGUNTAS.md si bloquea-.',
  ].join('\n')
}

module.exports = { parsear, veredicto, informe, cadencia, informeCadencia }
