// ascii-core.js - convierte prosa con puntuacion tipografica a ASCII puro. Texto -> texto, sin
// filesystem: eso lo hace ascii.js. Portado de scripts/_ascii.py (que se borro con esta migracion,
// se iba con el la dependencia de python).
//
// Deliberadamente NO toca acentos ni la enie (AGENTS.md S8: "ASCII en la prosa, acentos y enie
// incluidos"): la tabla solo cubre puntuacion que rompe en consolas y logs, no el espaniol.

const REEMPLAZOS = [
  ['—', '-'],   // em dash
  ['–', '-'],   // en dash
  ['‒', '-'],   // figure dash
  ['―', '-'],   // horizontal bar
  ['→', '->'],  // right arrow
  ['←', '<-'],  // left arrow
  ['“', '"'], ['”', '"'], ['„', '"'],  // double quotes
  ['‘', "'"], ['’', "'"], ['‚', "'"],  // single quotes
  ['…', '...'], // ellipsis
  [' ', ' '],   // non-breaking space
  ['•', '-'],   // bullet
  ['·', '-'],   // middle dot
  ['✓', 'OK'], ['✅', 'OK'], ['❌', 'X'],  // check / cross marks
]

function convertir(texto) {
  let resultado = texto
  for (const [de, a] of REEMPLAZOS) resultado = resultado.split(de).join(a)
  return resultado
}

// Separa modo de objetivos. Vive aca y no en ascii.js porque decide si la corrida ESCRIBE, y esa
// decision no puede depender del orden de los flags: con "el ultimo gana", un `--check --fix`
// escribia, y eso convierte cualquier permiso sobre `ascii --check*` en permiso de escritura.
function parsearArgs(args) {
  let modo = null
  const objetivos = []
  for (const a of args) {
    if (a === '--fix' || a === '--check') {
      if (modo && modo !== a) return { error: '--check y --fix son excluyentes.' }
      modo = a
    } else objetivos.push(a)
  }
  return { modo: modo || '--check', objetivos: objetivos.length ? objetivos : ['.'] }
}

module.exports = { REEMPLAZOS, convertir, parsearArgs }
