// ascii.js - convierte prosa a ASCII: em/en dash, comillas tipograficas, flechas y ellipsis.
// Mantiene acentos y la enie del espaniol (AGENTS.md S8).
//
// Uso: node harness.js ascii [--check|--fix] [archivo|carpeta ...]
//   --check (default)  cuenta cuantos archivos cambiarian, no toca nada
//   --fix               reescribe los archivos que cambian
//   sin objetivos, recorre el repo entero (.md, .yml, .yaml; sin node_modules ni .git)
//
// La tabla de conversion es scripts/lib/ascii-core.js: texto -> texto, sin filesystem.

const fs = require('fs')
const path = require('path')
const { convertir, parsearArgs } = require('../lib/ascii-core')

const RAIZ = process.cwd()
const EXTENSIONES = new Set(['.md', '.yml', '.yaml'])
const IGNORADOS = new Set(['node_modules', '.git'])

function listarArchivos(objetivo) {
  const st = fs.statSync(objetivo)
  if (!st.isDirectory()) return [objetivo]
  const archivos = []
  for (const nombre of fs.readdirSync(objetivo)) {
    if (IGNORADOS.has(nombre)) continue
    const ruta = path.join(objetivo, nombre)
    const info = fs.statSync(ruta)
    if (info.isDirectory()) archivos.push(...listarArchivos(ruta))
    else if (EXTENSIONES.has(path.extname(nombre))) archivos.push(ruta)
  }
  return archivos
}

function ayuda() {
  console.log('Uso: node harness.js ascii [--check|--fix] [archivo|carpeta ...]')
  console.log('  --check (default)  cuenta cuantos archivos cambiarian')
  console.log('  --fix               reescribe los que cambian')
  console.log('  sin objetivos, recorre el repo entero (.md/.yml/.yaml)')
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) { ayuda(); process.exit(0) }

  const parseado = parsearArgs(args)
  if (parseado.error) { console.error(`FALLO: ${parseado.error}`); process.exit(2) }
  const { modo, objetivos } = parseado

  const archivos = objetivos.flatMap((o) => listarArchivos(path.resolve(RAIZ, o)))

  let n = 0
  for (const archivo of archivos) {
    let original
    try { original = fs.readFileSync(archivo, 'utf8') } catch { continue }
    const resultado = convertir(original)
    if (resultado === original) continue
    n++
    if (modo === '--fix') fs.writeFileSync(archivo, resultado)
  }

  console.log(`${modo === '--fix' ? 'convertidos' : 'a convertir'}: ${n}`)
  console.log('Convierte em/en dash, comillas tipograficas, flechas, ellipsis -> ASCII. Mantiene acentos y enie del espaniol.')
}

main()
