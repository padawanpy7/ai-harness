// check.js - la compuerta que corre el implementer antes de dar una tarea por terminada: tests,
// ascii, ortografia, estructura del harness y secretos. Mientras nadie la corra a mano, es
// opcional de verdad; esto la convierte en un solo comando con un solo veredicto.
//
// Uso: node harness.js check [--todos] [--serie] [ruta...]
//   sin nada    gatea SOLO lo que esta SIN COMMITEAR (git status --porcelain). Este harness
//               commitea directo sobre main, sin ramas de ticket: un `git diff main` daria
//               siempre vacio y el gate no gatearia nada, que es el peor fallo posible.
//   --todos     el repo entero
//   ruta...     gatea esas rutas y nada mas
//   --serie     un gate por vez, para leer la salida sin mezclar cuando algo falla raro
//
// DOS PRINCIPIOS que no se negocian (copiados de bf-db-workspace/scripts/calidad/check.js, de
// donde se porto esta arquitectura):
//   1. Un gate que NO PUEDE CORRER no es un gate que pasa. Si falta la herramienta, esto falla
//      ruidoso; nunca se saltea en silencio.
//   2. Si no se pudo determinar QUE cambio, se gatea TODO. Ante la duda, de mas.

const fs = require('fs')
const path = require('path')
const { spawn, spawnSync, execFileSync } = require('child_process')
const core = require('../lib/check-core')
const secretosLiterales = require('../lib/secretos-literales')
const { registro } = require('../lib/skill-sync-core')
const { descubrir: descubrirSkills } = require('../lib/skills-descubrir')

const RAIZ = process.cwd()
const args = process.argv.slice(2)

function ayuda() {
  console.log('Uso: node harness.js check [--todos] [--serie] [ruta...]')
  console.log('  sin nada   gatea solo lo que esta SIN COMMITEAR')
  console.log('  --todos    el repo entero')
  console.log('  --serie    un gate por vez (para leer la salida sin mezclar)')
  console.log('  ruta...    gatea esas rutas y nada mas')
}

if (args.includes('--help') || args.includes('-h')) { ayuda(); process.exit(0) }

const TODOS = args.includes('--todos')
const SERIE = args.includes('--serie')
const RUTAS = args.filter((a) => !a.startsWith('--'))

const CAPACIDAD = 64 * 1024 * 1024

// Sin alcance (--todos) el gate mira todos los archivos de config VERSIONADOS. `git ls-files`
// y no un walk del disco: asi no entra node_modules ni nada gitignoreado, que es justo donde un
// .env local legitimo daria un falso positivo en cada corrida.
function listarVersionados() {
  try {
    return execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: RAIZ, maxBuffer: CAPACIDAD })
      .split('\n').filter(Boolean)
  } catch { return [] }
}

function gitPorcelanoRaw() {
  // SIN trim: ver el comentario largo en check-core.js. execFileSync no toca la salida.
  try { return execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', cwd: RAIZ, maxBuffer: CAPACIDAD }) }
  catch { return null }
}

const alcance = core.decidirAlcance({
  rutas: RUTAS,
  todos: TODOS,
  porcelanoRaw: (TODOS || RUTAS.length) ? null : gitPorcelanoRaw(),
  existeArchivo: (f) => fs.existsSync(path.join(RAIZ, f)),
})

const ASCII_EXTS = ['.md', '.yml', '.yaml']
const PROSA_EXTS = ['.md']
const archivosAscii = alcance.archivos ? core.conExtension(alcance.archivos, ASCII_EXTS) : null
const archivosProsa = alcance.archivos ? core.conExtension(alcance.archivos, PROSA_EXTS) : null

console.log(`==> check: ${alcance.modo === 'todo'
  ? 'el repo ENTERO' + (alcance.motivo ? ` (${alcance.motivo})` : '')
  : `${alcance.archivos.length} archivo(s) ${alcance.modo === 'rutas' ? 'pedidos' : 'sin commitear'}` +
    ` -> ${archivosAscii.length} .md/.yml, ${archivosProsa.length} .md`}`)

// --- los gates ----------------------------------------------------------------------------
// Cada uno declara como corre y como se juzga. `saltea` explica POR QUE no corre, cuando no corre:
// un gate ausente sin motivo escrito se lee como un gate que paso.

const pc = (...a) => ({ cmd: process.execPath, args: [path.join(RAIZ, 'harness.js'), ...a] })

function leer(ruta) { try { return fs.readFileSync(ruta, 'utf8') } catch { return null } }

// Los datos crudos que necesita el gate "estructura": doctor.js ya sabe leerlos (chequearHechos,
// chequearRegistry), esto repite esa lectura para no importar doctor.js entero (que imprime y
// decide su propio exit code, que es siempre 0 porque doctor es informativo).
function datosEstructura() {
  const dirHechos = path.join(RAIZ, 'memory/hechos')
  let archivosHechos = []
  try { archivosHechos = fs.readdirSync(dirHechos).filter((f) => f.endsWith('.md')) } catch { /* no hay carpeta */ }
  const hechos = archivosHechos.map((archivo) => ({
    archivo, slug: archivo.replace(/\.md$/, ''), texto: leer(path.join(dirHechos, archivo)) || '',
  }))
  const memoriaTexto = leer(path.join(RAIZ, 'memory/MEMORY.md')) || ''

  // El descubrimiento es compartido con `skill-sync` a proposito: cuando cada uno tenia el suyo,
  // el gate pedia regenerar un REGISTRY que ya estaba regenerado.
  const dirSkills = path.join(RAIZ, 'skills')
  const registryEsperado = registro(descubrirSkills(RAIZ))
  const registryActual = leer(path.join(dirSkills, 'REGISTRY.md'))

  return { hechos, memoriaTexto, registryActual, registryEsperado }
}

function juzgarEstructura() {
  const problemas = core.problemasEstructura(datosEstructura())
  return problemas.length ? { status: 1, salida: problemas.join('\n') } : { status: 0, salida: '' }
}

// ascii.js nunca sale con codigo != 0 en --check (solo cuenta): el veredicto sale de su resumen
// "a convertir: N" en vez del exit code.
function juzgarAscii(salida) {
  const m = salida.match(/^a convertir: (\d+)/m)
  if (!m) return { ok: false, nota: 'ascii no genero el resumen esperado' }
  const n = Number(m[1])
  return n === 0 ? { ok: true } : { ok: false, nota: `${n} archivo(s) con puntuacion no ascii. node harness.js ascii --fix` }
}

// spell.js si propaga el exit de cspell, pero un exit != 0 puede ser "hay palabras" o "npx no
// pudo correr" (sin red, primera vez): se distinguen por el texto, igual que en bf-db-workspace.
function juzgarSpell(salida) {
  if (!salida.includes('CSpell: Files checked')) {
    return { ok: false, nota: 'spell no pudo correr (no genero resultado; revisa npx/la red)' }
  }
  const n = salida.split('\n').filter((l) => l.includes('Unknown word')).length
  return n === 0 ? { ok: true } : { ok: false, nota: `${n} palabra(s). Verlas: node harness.js spell` }
}

function juzgarGitleaks(salida, status) {
  if (status === 0) return { ok: true }
  if (status === 1) return { ok: false, nota: 'POSIBLE SECRETO (ver la salida redactada arriba)' }
  return { ok: false, nota: `gitleaks no pudo correr (exit ${status})` }
}

function armarGates() {
  const gates = []

  // Nunca se saltea, corre SIEMPRE entero (nunca incremental): tarda unos 60ms, no hay nada que
  // optimizar y un test que no corre no protege nada. Este es el gate que no se negocia.
  gates.push({ nombre: 'tests', ...pc('test') })

  // Igual que tests: mide 4 archivos fijos, no lo que cambio. Correrlo siempre es lo que hace
  // que un PROGRESO.md que se paso de largo bloquee el commit en vez de esperar a que alguien
  // lo note (ver scripts/lib/presupuesto-docs.js).
  gates.push({ nombre: 'presupuesto', ...pc('presupuesto') })

  gates.push({
    nombre: 'ascii',
    ...(alcance.modo === 'todo' ? pc('ascii', '--check') : pc('ascii', '--check', ...archivosAscii)),
    saltea: alcance.modo !== 'todo' && !archivosAscii.length ? 'ningun .md/.yml/.yaml cambio' : null,
    juzgar: juzgarAscii,
  })

  gates.push({
    nombre: 'spell',
    ...(alcance.modo === 'todo' ? pc('spell') : pc('spell', ...archivosProsa)),
    saltea: alcance.modo !== 'todo' && !archivosProsa.length ? 'ninguna prosa (.md) cambio' : null,
    juzgar: juzgarSpell,
  })

  // La logica de que bloquea vive en check-core.js; instant porque es lectura de disco + JS
  // puro, sin spawnear proceso.
  gates.push({ nombre: 'estructura', instant: true, ...juzgarEstructura() })

  // gitleaks escanea el ARBOL DE TRABAJO (`dir`), no la historia (`git`, que es lo que hace
  // `.gitleaks.toml` cuando lo corres a mano): lo que importa ahi es lo que esta por commitearse
  // ahora, no repetir para siempre lo que ya paso el gate en un commit anterior. El repo es chico
  // (unos 800KB sin .git), asi que escanear TODO el arbol en cada corrida sale en ~0.1s: no hace
  // falta acotarlo al alcance incremental como los otros gates.
  const hayGitleaks = !spawnSync('gitleaks', ['version'], { encoding: 'utf8' }).error
  gates.push(hayGitleaks
    ? {
      nombre: 'secretos',
      cmd: 'gitleaks',
      args: ['dir', '--no-banner', '--redact', '--config', '.gitleaks.toml', '.'],
      juzgar: juzgarGitleaks,
    }
    : { nombre: 'secretos', roto: 'gitleaks no esta instalado. instalalo: https://github.com/gitleaks/gitleaks' })

  // Complementa a gitleaks, que con sus reglas por defecto NO ve un literal cualquiera bajo una
  // clave que suena a credencial: en bf-db-workspace eso dejo pasar una contrasena de produccion
  // versionada. Acotado a los archivos de config del alcance: si no cambio ninguno, no hay nada
  // nuevo que mirar.
  const litArchivos = alcance.archivos
    ? core.conExtension(alcance.archivos, secretosLiterales.EXTENSIONES)
    : listarVersionados().filter((f) =>
      secretosLiterales.EXTENSIONES.some((e) => f.toLowerCase().endsWith(e)))
  gates.push({
    nombre: 'secretos (config literal)',
    instant: true,
    saltea: alcance.archivos && !litArchivos.length ? 'ningun archivo de config cambio' : null,
    ...juzgarSecretosLiterales(litArchivos),
  })

  return gates
}

// Un literal no vacio, que no sea plantilla y de largo razonable, bajo una clave sensible.
function juzgarSecretosLiterales(archivos) {
  const conContenido = (archivos || []).filter((f) => fs.existsSync(f))
    .map((ruta) => ({ ruta, contenido: fs.readFileSync(ruta, 'utf8') }))
  const hallazgos = secretosLiterales.hallazgos(conContenido)
  if (!hallazgos.length) return { status: 0, salida: '' }
  const salida = hallazgos.map((h) =>
    `${h.archivo}:${h.linea} clave "${h.clave}": valor literal (no vacio, no plantilla) - posible secreto versionado`).join('\n')
  return { status: 1, salida }
}

// --- correrlos --------------------------------------------------------------------------------
// Tope por gate: un gate que no termina es un gate que falla, igual que uno que no puede correr.
const TOPE_MS = Number(process.env.CHECK_TIMEOUT_MS) || 10 * 60 * 1000

function correr(gate) {
  return new Promise((resolve) => {
    if (gate.roto) return resolve({ gate, status: 2, salida: '', roto: true })
    if (gate.saltea) return resolve({ gate, salteado: true })
    if (gate.instant) return resolve({ gate, status: gate.status, salida: gate.salida || '', ms: 0 })
    const t0 = Date.now()
    const p = spawn(gate.cmd, gate.args, { cwd: RAIZ })
    let salida = ''
    let cerrado = false
    const listo = (r) => { if (!cerrado) { cerrado = true; clearTimeout(reloj); resolve(r) } }
    const reloj = setTimeout(() => {
      p.kill()
      listo({ gate, status: 2, salida, ms: Date.now() - t0, colgado: true })
    }, TOPE_MS)
    p.stdout.on('data', (d) => { salida += d })
    p.stderr.on('data', (d) => { salida += d })
    p.on('error', (e) => listo({ gate, status: 2, salida: String(e.message), ms: Date.now() - t0 }))
    p.on('close', (status) => listo({ gate, status, salida, ms: Date.now() - t0 }))
  })
}

;(async () => {
  const gates = armarGates()
  console.log(`    ${SERIE ? 'en serie' : 'en paralelo'}: ${gates.map((g) => g.nombre).join(', ')}\n`)

  const arranque = Date.now()
  const resultados = []
  if (SERIE) { for (const g of gates) resultados.push(await correr(g)) }
  else resultados.push(...await Promise.all(gates.map(correr)))

  // Orden FIJO de impresion aunque terminen mezclados: una salida que cambia de orden entre
  // corridas no se puede diffear ni leer de memoria.
  let fallo = 0
  for (const r of resultados) {
    const n = r.gate.nombre
    if (r.salteado) { console.log(`.  ${n}: salteado (${r.gate.saltea})`); continue }
    if (r.roto) { console.log(`X  ${n}: FALLO - ${r.gate.roto}`); fallo = 1; continue }
    if (r.colgado) {
      console.log(`X  ${n}: FALLO - no termino en ${TOPE_MS / 1000}s, lo corte. ` +
        'Correlo solo para ver que pasa, o subi el tope con CHECK_TIMEOUT_MS.')
      fallo = 1
      continue
    }

    const v = r.gate.juzgar ? r.gate.juzgar(r.salida, r.status) : { ok: r.status === 0 }
    if (v.ok) { console.log(`OK ${n}  (${(r.ms / 1000).toFixed(1)}s)`); continue }

    fallo = 1
    console.log(`X  ${n}: FALLO${v.nota ? ' - ' + v.nota : ` (exit ${r.status})`}  (${(r.ms / 1000).toFixed(1)}s)`)
    const cuerpo = r.salida.trim().split('\n')
    for (const l of cuerpo.slice(-15)) console.log(`      ${l}`)
    if (cuerpo.length > 15) console.log(`      ... (${cuerpo.length - 15} linea(s) mas; corre el gate solo para verlas)`)
  }

  console.log(`\n${((Date.now() - arranque) / 1000).toFixed(1)}s en total`)
  if (fallo) { console.log('FALLO check: revisa lo de arriba'); process.exit(1) }
  console.log('OK check: todo verde')
})()
