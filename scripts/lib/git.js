// Helpers de git para las tools del loop. Existe para que dos trampas queden resueltas en UN
// lugar y no haya que volver a morderlas en cada tool que se porta:
//
//   1. maxBuffer. El default de execFileSync es UN MEGA. Al pasarse, node mata al hijo y entrega
//      la salida TRUNCADA, con `status === null` en vez de un codigo de error. `git merge-tree` de
//      una rama atrasada 189 commits devuelve 1,05 MB, y el corte caia justo antes de la seccion
//      "changed in both": rama-drift decia "el merge entra limpio" cuando habia conflicto.
//   2. Un exit != 0 puede ser el RESULTADO, no un fallo. `git merge-tree` sale 1 cuando encuentra
//      conflictos -que es justo lo que se le pregunta-, y execFileSync lo convierte en excepcion.

const { execFileSync } = require('child_process')

const CAPACIDAD = 64 * 1024 * 1024

// Salida limpia; '' si el comando fallo. Para preguntas cuya respuesta vacia ya significa "no".
function git(...args) {
  try { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: CAPACIDAD }).trim() } catch { return '' }
}

// La salida SIEMPRE, haya salido 0 o no. Para los comandos donde el exit != 0 es informacion.
function gitSalida(...args) {
  try { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: CAPACIDAD }) } catch (e) { return String(e.stdout || '') }
}

// true/false, sin salida. Para los `git x --quiet` que se usan como pregunta.
function gitOk(...args) {
  try { execFileSync('git', args, { stdio: 'ignore', maxBuffer: CAPACIDAD }); return true } catch { return false }
}

const ramaActual = () => git('branch', '--show-current')
const existeRama = (rama) => gitOk('show-ref', '--verify', '--quiet', `refs/heads/${rama}`)

// Parsea la salida de `git merge-tree` y devuelve los archivos que tocaron LOS DOS lados. Es el
// unico caso que puede necesitar una decision: si solo lo toco un lado, git lo resuelve solo.
//
// PURO a proposito: la version anterior vivia adentro de la funcion que llama a git, o sea sin test,
// y tenia un agujero. Reconocia solo:
//   changed in both
//     base   100644 <sha> <ruta>
// y se perdia el caso en que los DOS lados CREAN el mismo archivo, que git reporta distinto:
//   added in both
//     our    100644 <sha> <ruta>
//     their  100644 <sha> <ruta>
// Ahi `rama-drift` contestaba "el merge deberia entrar limpio" sobre un add/add que conflictua de
// verdad -comprobado el 13/09 contra `git merge`-. Un falso VERDE, que es la familia de fallo que
// la tool viene a evitar. Con un ticket nuevo, que los dos lados creen el mismo archivo es de lo
// mas facil que pase.
function parsearMergeTree(texto) {
  const lineas = String(texto).split('\n')
  const vistos = new Set()
  for (let i = 0; i < lineas.length; i++) {
    if (!/^(changed|added) in both/.test(lineas[i])) continue
    // Las lineas del bloque vienen indentadas; alcanza con la primera que nombre la ruta.
    for (let j = i + 1; j < lineas.length; j++) {
      const m = lineas[j].match(/^ {2}(?:base|our|their) +\d+ [0-9a-f]+ (.+)$/)
      if (!m) break
      vistos.add(m[1])
      break
    }
  }
  return [...vistos].sort()
}

function tocadosPorAmbos(base, a, b) {
  return parsearMergeTree(gitSalida('merge-tree', base, a, b))
}

// El worktree parado en esa rama, o '' si no tiene ninguno.
function worktreeDe(rama) {
  const lineas = git('worktree', 'list', '--porcelain').split('\n')
  let actual = ''
  for (const l of lineas) {
    if (l.startsWith('worktree ')) actual = l.slice(9).trim()
    else if (l.trim() === `branch refs/heads/${rama}`) return actual
  }
  return ''
}

module.exports = { git, gitSalida, gitOk, ramaActual, existeRama, parsearMergeTree, tocadosPorAmbos, worktreeDe, CAPACIDAD }
