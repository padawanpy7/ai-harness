// doctor.js - audita la salud del HARNESS: lo que el harness dice de si mismo y ya no es cierto.
// Busca lo que se pudre sin avisar: docs con placeholders, el registry desincronizado, playbooks
// vacios o viejos, memory/hechos/ inconsistente.
//
// Uso: node harness.js doctor
//
// La logica de cada chequeo vive en scripts/lib/doctor-core.js (pura, testeada); esto solo lee el
// disco, arma el texto y decide que imprimir.

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const core = require('../lib/doctor-core')
const { registro } = require('../lib/skill-sync-core')

const RAIZ = process.cwd()
const p = (...partes) => path.join(RAIZ, ...partes)

function leer(archivo) {
  try { return fs.readFileSync(archivo, 'utf8') } catch { return null }
}

function ayuda() {
  console.log('Uso: node harness.js doctor')
  console.log('  audita la salud del harness: placeholders, registry, playbooks, memory/hechos/.')
}

// En la PLANTILLA los placeholders son correctos: estan esperando a que alguien la adopte. Solo
// son un pendiente en un repo ya adoptado. Se distingue por `scripts/adopt.sh`, que es lo que
// `adopt` borra al terminar: mientras exista, esto es la plantilla y no un proyecto a medio llenar.
function chequearPlaceholders() {
  const texto = leer(p('AGENTS.md'))
  if (texto === null || !core.tienePlaceholders(texto)) {
    console.log('  ok placeholders')
    return false
  }
  if (fs.existsSync(p('scripts/adopt.sh'))) {
    console.log('  i AGENTS.md tiene {{PLACEHOLDERS}}: es la plantilla sin adoptar, esta bien asi')
    return false
  }
  console.log('  ! AGENTS.md tiene {{PLACEHOLDERS}} sin completar')
  return true
}

// Compara contra skill-sync-core.js directo (requerido, no un subproceso) y, si esta
// desincronizado, regenera el archivo: mismo efecto que doctor.sh, que lo arreglaba al pasar.
function chequearRegistry() {
  if (!fs.existsSync(p('scripts/loop/skill-sync.js'))) return false
  const dir = p('skills')
  const salida = path.join(dir, 'REGISTRY.md')
  let skills = []
  if (fs.existsSync(dir)) {
    skills = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f !== 'REGISTRY.md')
      .map((base) => ({ base, texto: leer(path.join(dir, base)) || '' }))
  }
  const esperado = registro(skills)
  const actual = leer(salida)
  if (core.registryDesincronizado(actual, esperado)) {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(salida, esperado)
    console.log('  ! skills/REGISTRY.md estaba desactualizado (lo regenere)')
    return true
  }
  console.log('  ok skill registry')
  return false
}

function chequearPlaybooks() {
  const dir = p('memory/playbooks')
  let archivos = []
  try { archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.md')) } catch { return false }
  let warn = false
  const viejos = []
  for (const f of archivos) {
    const ruta = path.join(dir, f)
    const texto = leer(ruta) || ''
    if (core.esPlaybookCasiVacio(texto)) {
      console.log(`  ! playbook casi vacio (seedealo): memory/playbooks/${f}`)
      warn = true
    }
    const { mtimeMs } = fs.statSync(ruta)
    if (core.esArchivoViejo(mtimeMs, 45)) viejos.push(`memory/playbooks/${f}`)
  }
  if (viejos.length) {
    console.log(`  ! sin actualizar hace >45d (revisar que no mientan): ${viejos.join(' ')}`)
    warn = true
  }
  return warn
}

function chequearHechos() {
  const dir = p('memory/hechos')
  let archivos = []
  try { archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.md')) } catch { archivos = [] }
  const memoria = leer(p('memory/MEMORY.md')) || ''
  const hechos = archivos.map((archivo) => ({
    archivo,
    slug: archivo.replace(/\.md$/, ''),
    texto: leer(path.join(dir, archivo)) || '',
  }))

  let err = false
  for (const h of hechos) {
    for (const campo of core.frontmatterFaltante(h.texto)) {
      console.log(`  ! memory/hechos/${h.archivo} sin '${campo}:' en el frontmatter`)
      err = true
    }
    if (core.nombreCoincideConArchivo(h.texto, h.slug) === false) {
      const fmname = (h.texto.match(/^name:[ \t]*(.*)$/m) || [, ''])[1].trim()
      console.log(`  ! memory/hechos/${h.archivo}: name: '${fmname}' no coincide con el archivo`)
      err = true
    }
    if (!core.hechoEnlazadoEnIndice(h.slug, memoria)) {
      console.log(`  ! memory/hechos/${h.archivo} no esta enlazado desde memory/MEMORY.md`)
      err = true
    }
  }

  const slugs = hechos.map((h) => h.slug)
  for (const ref of core.referenciasIndiceColgadas(memoria, slugs)) {
    console.log(`  ! memory/MEMORY.md apunta a ${ref}, que no existe`)
    err = true
  }
  for (const wl of core.wikilinksColgados(hechos.map((h) => h.texto), slugs)) {
    console.log(`  ! wikilink [[${wl}]] no tiene hecho correspondiente (memory/hechos/${wl}.md)`)
    err = true
  }

  if (fs.existsSync(dir) && !err) console.log('  ok memory/hechos/')
  return err
}




function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) { ayuda(); process.exit(0) }

  console.log('==> doctor: salud del harness')
  let warn = false
  warn = chequearPlaceholders() || warn
  warn = chequearRegistry() || warn
  warn = chequearPlaybooks() || warn
  warn = chequearHechos() || warn

  if (fs.existsSync(p('work/PROGRESO.md'))) console.log('  ok work/PROGRESO.md')
  else console.log('  i sin work/PROGRESO.md (el puente entre sesiones; empezalo al cerrar)')
  console.log('  i Regla 10: al salir un modelo nuevo, re-examina el harness y desmonta andamiaje viejo')

  console.log('')
  console.log(warn ? 'doctor: hay cosas para completar/actualizar (ver arriba)' : 'OK doctor: harness sano')
  // doctor.sh nunca devolvia distinto de 0 (era un chequeo informativo, no un gate): se mantiene
  // el mismo comportamiento aca para no convertir un aviso en un fallo de CI/hook que nadie pidio.
}

main()
