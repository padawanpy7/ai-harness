// test.js - corre la suite de unidad del harness (scripts/lib/*.test.js).
//
// Es la forma de correr los tests (AGENTS.md: "los tests dejan de ser opcionales"): logica pura,
// sin tocar el sistema.
//
// Uso: node harness.js test
//
// --test-isolation=none: sin esto node --test arranca un proceso por archivo. Con pocos
// archivos no se nota, pero ya viene del patron probado en bf-db-workspace y evita reintroducir
// el costo cuando la suite crezca. Ninguno de los .test.js de hoy toca process.env/cwd/mocks
// globales, que es lo unico que este modo podria filtrar entre archivos.

const fs = require('fs')
const { spawnSync } = require('child_process')

const RAIZ = process.cwd()

function ayuda() {
  console.log('Uso: node harness.js test')
  console.log('  corre `node --test` sobre scripts/lib/*.test.js: logica pura, sin sistema.')
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) { ayuda(); process.exit(0) }

  const archivos = fs.globSync('scripts/lib/*.test.js', { cwd: RAIZ })
  if (!archivos.length) {
    console.error('FALLO: no encontre ningun scripts/lib/*.test.js')
    process.exit(2)
  }

  console.log(`==> test: ${archivos.length} archivo(s) en scripts/lib/\n`)
  const r = spawnSync(process.execPath, ['--test-isolation=none', '--test', ...archivos], { cwd: RAIZ, stdio: 'inherit' })
  process.exit(r.status === null ? 2 : r.status)
}

main()
