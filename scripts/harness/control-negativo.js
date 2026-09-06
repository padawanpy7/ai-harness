// control-negativo.js - rompe cada compuerta a proposito y exige que se ponga ROJA.
//
// Uso: node harness.js control-negativo
//
// Por que existe: un gate verde no prueba nada. Prueba que no encontro nada, que es distinto de
// que sepa mirar. El 29/08/2026 `cierre` daba 6 ok mientras `work/PROGRESO.md` decia tres cosas
// falsas, y el gate del presupuesto vivio semanas sin que nadie lo viera saltar. Los tests de
// unidad prueban la REGLA; esto prueba la MEDIDA contra el repo real, que es donde se rompen los
// gates: un `git diff` mal armado o un archivo que se lee del lugar equivocado pasan los tests
// igual y dejan la compuerta abierta.
//
// Portado de bf-db-workspace (ed76d37), que lo tiene por gate.
//
// MODIFICA archivos versionados mientras corre y los restaura en un `finally`. Si se interrumpe a
// la mitad, `git checkout -- <archivo>` deja todo como estaba: nunca toca nada sin commitear
// previo, por eso se niega a arrancar con esos archivos sucios.

const fs = require('fs')
const path = require('path')
const { execFileSync, spawnSync } = require('child_process')

const RAIZ = process.cwd()
const p = (rel) => path.join(RAIZ, rel)

if (process.argv.slice(2).some((a) => a === '--help' || a === '-h')) {
  console.log('Uso: node harness.js control-negativo')
  console.log('  rompe cada compuerta a proposito y exige rojo. Restaura los archivos al terminar.')
  console.log('  sale 1 si alguna compuerta NO supo ponerse roja.')
  process.exit(0)
}

const VICTIMAS = ['AGENTS.md', 'work/PROGRESO.md']

// Si ya estaban sucios no se puede distinguir "lo ensucie yo" de "ya estaba", y la restauracion
// pisaria trabajo del dueño.
let sucios = ''
try {
  sucios = execFileSync('git', ['status', '--porcelain', '--', ...VICTIMAS],
    { encoding: 'utf8', cwd: RAIZ }).trim()
} catch {
  console.error('sin git: este control necesita poder restaurar los archivos')
  process.exit(1)
}
if (sucios) {
  console.error('hay cambios sin commitear en los archivos que este control modifica:')
  console.error(sucios.split('\n').map((l) => `  ${l}`).join('\n'))
  console.error('commitealos o guardalos antes: el control los reescribe y despues los restaura.')
  process.exit(1)
}

const ENTRADA = 'harness.js'
const tool = (...args) => spawnSync(process.execPath, [p(ENTRADA), ...args],
  { cwd: RAIZ, encoding: 'utf8' }).status

const casos = []
const caso = (que, cumple) => {
  casos.push({ que, cumple })
  console.log(`  ${cumple ? 'OK ' : 'X  '} ${que}`)
}

const original = new Map(VICTIMAS.map((v) => [v, fs.readFileSync(p(v), 'utf8')]))

try {
  console.log('==> presupuesto: el gate de crecimiento')
  caso('de entrada esta en verde', tool('presupuesto') === 0)

  fs.writeFileSync(p('AGENTS.md'), original.get('AGENTS.md') + '\n- una\n- seccion\n- que\n- no\n- va\n- aca\n')
  caso('+6 lineas en AGENTS.md lo pone ROJO', tool('presupuesto') === 1)
  caso('el rojo del presupuesto llega hasta check', tool('check') === 1)
  caso('--reorg lo deja pasar (mover secciones no es crecer)', tool('presupuesto', '--reorg') === 0)

  fs.writeFileSync(p('AGENTS.md'), original.get('AGENTS.md').split('\n').slice(0, -40).join('\n'))
  caso('podar 40 lineas NUNCA falla', tool('presupuesto') === 0)

  fs.writeFileSync(p('AGENTS.md'), original.get('AGENTS.md'))
  caso('restaurado, vuelve a verde', tool('presupuesto') === 0)

  console.log('==> cierre: cada dia con commits necesita su entrada')
  const progreso = original.get('work/PROGRESO.md')
  const hoy = new Date().toISOString().slice(0, 10)
  if (!progreso.includes(`## ${hoy}`)) {
    caso(`(salteado: la bitacora no tiene entrada de hoy ${hoy}, nada que romper)`, true)
  } else {
    // Se le cambia la FECHA a la entrada de hoy: el dia sigue teniendo commits pero se queda sin
    // entrada, que es exactamente el agujero que el chequeo tiene que cazar.
    // TODAS las ocurrencias, no la primera: un dia puede tener dos entradas ("06 -" y "06 (b) -")
    // y dejar una con la fecha de hoy tapa el hueco que este control tiene que abrir. El control
    // daba verde por su propio bug, que es exactamente lo que viene a evitar.
    fs.writeFileSync(p('work/PROGRESO.md'), progreso.split(`## ${hoy}`).join('## 2026-01-01'))
    const salida = spawnSync(process.execPath, [p('harness.js'), 'cierre'], { cwd: RAIZ, encoding: 'utf8' })
    const texto = (salida.stdout || '') + (salida.stderr || '')
    caso('un dia con commits y sin entrada lo pone ROJO', /dia\/s con trabajo y sin entrada/.test(texto))
    caso('y nombra el dia que falta', texto.includes(hoy))
  }
  console.log('==> secretos: un literal bajo una clave sensible')
  // Archivo aparte, no una VICTIMA: no existe en el repo, asi que se borra en vez de restaurarse.
  const cebo = p('control-negativo-secreto.json')
  try {
    // El valor se ARMA en pedazos a proposito: si estuviera escrito entero, el gate de gitleaks
    // marcaria este mismo archivo y habria que agregarle un allowlist. Ensanchar allowlists para
    // acomodar a los propios controles es exactamente como se apagan los gates sin querer.
    const falsa = ['Xk92', 'mQr4', 'TzBv', '7Ld0'].join('')
    fs.writeFileSync(cebo, `{\n  "PASSWORD": "${falsa}",\n  "token": "{{plantilla}}"\n}\n`)
    const r = spawnSync(process.execPath, [p(ENTRADA), 'check', 'control-negativo-secreto.json'],
      { cwd: RAIZ, encoding: 'utf8' })
    const texto = (r.stdout || '') + (r.stderr || '')
    caso('una contrasena literal en un .json lo pone ROJO', r.status === 1)
    caso('y nombra la clave, no solo el archivo', /PASSWORD/.test(texto))
    caso('un valor de plantilla {{...}} NO se marca', !/"token"/.test(texto))
  } finally {
    fs.rmSync(cebo, { force: true })
  }
  console.log('==> loop: las salidas que NO son el exito')
  // Sobre el core puro: no hay forma de fabricar 2 fallos reales en el log sin ensuciarlo, y un
  // control que deja basura en metrics/ es peor que el hueco que cubre.
  const loop = require(p('scripts/lib/loop-core'))
  const malo = { tool: 'check', args: '--todos', exit: 1, ms: 100 }
  const bueno = { tool: 'check', args: '', exit: 0, ms: 100 }
  caso('dos fallos con la misma causa -> BLOQUEADO',
    loop.evaluar({ corridas: [malo, malo] }).estado === loop.ESTADOS.BLOQUEADO)
  caso('un exito entre medio NO cuenta como fallo repetido',
    loop.evaluar({ corridas: [malo, bueno, malo] }).estado !== loop.ESTADOS.BLOQUEADO)
  caso('pasarse del presupuesto -> CORTADO, aunque la aceptacion pase',
    loop.evaluar({ corridas: [bueno], aceptacionOk: true, presupuesto: { ms: 1 } }).estado
      === loop.ESTADOS.PRESUPUESTO)
  caso('sin regla de parada NO se declara verificado',
    loop.evaluar({ corridas: [bueno], aceptacionOk: null }).estado === loop.ESTADOS.REVISION)
  caso('con la regla de parada en verde SI se verifica',
    loop.evaluar({ corridas: [bueno], aceptacionOk: true }).estado === loop.ESTADOS.VERIFICADO)

} finally {
  for (const [rel, texto] of original) fs.writeFileSync(p(rel), texto)
  console.log('\n(archivos restaurados)')
}

const fallaron = casos.filter((c) => !c.cumple)
console.log(`\n${casos.length - fallaron.length}/${casos.length} compuertas supieron ponerse rojas`)
if (fallaron.length) {
  console.log('\nUna compuerta que no sabe dar rojo no es una compuerta: es decoracion.')
  process.exit(1)
}
