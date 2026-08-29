#!/usr/bin/env node
// harness.js - el punto de entrada UNICO del harness. `node harness.js <tool> [argumentos]`
//
// Por que existe: antes cada tool se invocaba con su propio `bash scripts/<area>/<tool>.sh` (o
// `node scripts/<area>/<tool>.js` a mano), sin un lugar comun donde registrar el uso, medir
// cuanto tarda cada corrida y convertir un stack pelado en un mensaje legible.
//
// Este harness NO migra todo a Node: scripts/sistema/ se queda en bash a proposito, porque es el
// camino de emergencia (bash es dependencia de pacman, sobrevive a cualquier cosa que rompa Node;
// ver work/mejoras-desde-bf.md). harness.js despacha a los dos: si la tool es .js la requiere, si es
// .sh la corre con bash heredando stdio. Los scripts de bash siguen siendo invocables directo
// (`bash scripts/sistema/salud.sh`) para cuando Node no ande.

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const RAIZ = __dirname
process.chdir(RAIZ)

const { descubrirTools: descubrir, areaDe, debeContarUso } = require('./scripts/lib/tools-registro')
const descubrirTools = () => descubrir(RAIZ)

const METRICAS = path.join(RAIZ, 'metrics')

function registrar(archivo, linea) {
  try {
    fs.mkdirSync(METRICAS, { recursive: true })
    fs.appendFileSync(path.join(METRICAS, archivo), linea + '\n')
  } catch { /* la telemetria NUNCA hace fallar a la tool */ }
}

// Hora LOCAL, no UTC: scripts/_count.sh (que siguen llamando los .sh no migrados) escribe con
// `date +%Y-%m-%dT%H:%M:%S`, que es local. Si harness.js escribiera en UTC, el mismo log terminaria
// con dos husos horarios mezclados y "ultimo-uso" compararia mal (ver work/pc-js-ronda1.md).
function sello() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// La linea de "que hace" para la ayuda: la primera de las primeras 20 lineas del archivo que
// tenga forma "# nombre.sh - descripcion" o "// nombre.js - descripcion" (la convencion que ya
// usan salud.sh, doctor.js, metricas.js, etc.). Si una tool no la tiene, se lista sin descripcion
// en vez de inventar una.
function descripcionDe(ruta) {
  let texto
  try { texto = fs.readFileSync(ruta, 'utf8') } catch { return '' }
  const cabeza = texto.split('\n').slice(0, 20)
  for (const linea of cabeza) {
    const m = linea.match(/^(?:#|\/\/)\s*\S+\.(?:sh|js)\s*-\s*(.+)$/)
    if (m) return m[1].trim()
  }
  return ''
}

function ayuda(tools) {
  console.log('Uso: node harness.js <tool> [argumentos]\n')
  const porArea = new Map()
  for (const [nombre, ruta] of tools) {
    const area = areaDe(ruta)
    if (!porArea.has(area)) porArea.set(area, [])
    porArea.get(area).push([nombre, ruta])
  }
  // El ancho sale del nombre mas largo: fijarlo en 14 hacia que una tool con nombre largo se
  // pegara a su descripcion (paso con `control-negativo`, de 16).
  const anchoNombre = Math.max(14, ...[...tools.keys()].map((n) => n.length)) + 2
  for (const area of [...porArea.keys()].sort()) {
    console.log(`  ${area}`)
    for (const [nombre, ruta] of porArea.get(area).sort((a, b) => a[0].localeCompare(b[0]))) {
      const desc = descripcionDe(ruta)
      console.log(`    ${nombre.padEnd(anchoNombre)}${desc}`)
    }
  }
  console.log('\n  node harness.js <tool> --help    la ayuda de esa tool')
  console.log('  HARNESS_DEBUG=1                  stack completo cuando algo revienta')
}

// Un nombre que no existe casi siempre es un dedazo: se ofrece el candidato mas parecido en vez
// de un "no existe" pelado que obliga a ir a buscar la lista.
function parecido(nombre, tools) {
  const cand = [...tools.keys()]
  const exacto = cand.filter((t) => t.includes(nombre) || nombre.includes(t))
  return exacto.length ? exacto : cand.filter((t) => t[0] === nombre[0])
}

function main() {
  const tools = descubrirTools()
  const [nombre, ...args] = process.argv.slice(2)

  if (!nombre || nombre === '--help' || nombre === '-h') { ayuda(tools); process.exit(nombre ? 0 : 2) }

  const ruta = tools.get(nombre)
  if (!ruta) {
    console.error(`no conozco la tool "${nombre}".`)
    const cerca = parecido(nombre, tools)
    if (cerca.length) console.error('¿quisiste decir? ' + cerca.slice(0, 5).join(', '))
    console.error('la lista completa: node harness.js')
    process.exit(2)
  }

  // Solo .js: una .sh ya se cuenta sola via _count.sh (debeContarUso, tools-registro.js). Contarla
  // aca tambien dejaria dos lineas por una misma corrida.
  if (debeContarUso(ruta)) registrar('tool-usage.log', `${sello()}\t${nombre}`)

  // Quien lanzo esta corrida (7a columna de tool-runs.log). Se hereda por el entorno: `check`
  // spawnea `node harness.js test`/`ascii`/`spell` y `cierre` spawnea `node harness.js check --todos`
  // (spawn/spawnSync heredan process.env por default), asi que el hijo ve aca el nombre del
  // padre. Sin esto, tool-usage no puede distinguir una corrida suelta de una anidada, y el
  // ranking de tiempo cuenta el mismo trabajo dos veces (ver work/mejoras-desde-bf.md).
  const padre = process.env.PC_TOOL_PADRE || ''
  process.env.PC_TOOL_PADRE = nombre

  const arranque = Date.now()
  let cerrado = false
  const cerrar = (codigo, detalle) => {
    if (cerrado) return
    cerrado = true
    registrar('tool-runs.log',
      [sello(), nombre, codigo, Date.now() - arranque, args.join(' '), detalle || '', padre].join('\t'))
  }

  const fallar = (e) => {
    const msg = (e && e.message) || String(e)
    console.error(`\nFALLO en ${nombre}: ${msg}`)
    if (process.env.HARNESS_DEBUG === '1' && e && e.stack) console.error(e.stack)
    else if (e && e.stack) console.error('   (HARNESS_DEBUG=1 para ver el stack)')
    cerrar(1, msg.split('\n')[0].slice(0, 200))
    process.exit(1)
  }

  // Las tools .js pueden ser async y no atrapar nada: sin esto un `await` que revienta sale como
  // "UnhandledPromiseRejection" con un stack de node adentro y sin decir que tool fue.
  process.on('uncaughtException', fallar)
  process.on('unhandledRejection', fallar)
  process.on('exit', (codigo) => cerrar(codigo))

  if (ruta.endsWith('.sh')) {
    const r = spawnSync('bash', [ruta, ...args], { stdio: 'inherit' })
    if (r.error) fallar(r.error)
    process.exit(r.status === null ? 1 : r.status)
  }

  // La tool tiene que ver el argv que veria si se la llamara directo: `process.argv[1]` su propia
  // ruta y de ahi en adelante SUS argumentos. Sin esto, `slice(2)` le devuelve su propio nombre
  // como primer argumento.
  process.argv = [process.argv[0], ruta, ...args]

  try { require(ruta) } catch (e) { fallar(e) }
}

main()
