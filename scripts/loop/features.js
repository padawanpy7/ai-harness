// features.js - estado del ledger FEATURES.json: cuantas pasan y cuales faltan.
//
// Uso: node harness.js features [archivo] [--json]
//
// El lead lo corre al arrancar una sesion (protocolo de sesion, AGENTS.md) para elegir la
// siguiente feature incompleta sin releer el ledger entero.
//
// Era `features.sh`: bash que llamaba a python3 para parsear un JSON, tres lenguajes para
// contar. El conteo de uso tambien se fue: lo escribe el entrypoint en cada corrida, y hacerlo
// dos veces daba dos lineas por invocacion.

const fs = require('fs')
const path = require('path')

const RAIZ = process.cwd()
const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Uso: node harness.js features [archivo] [--json]')
  console.log('  cuantas features pasan y cuales faltan. Por defecto lee FEATURES.json.')
  console.log('  sale 1 si el ledger esta roto; que haya features incompletas NO es un error.')
  process.exit(0)
}

const TOPE = 8
const archivo = argv.find((a) => !a.startsWith('--')) || 'FEATURES.json'
// `resolve` y no `join`: con join, una ruta absoluta se pega detras de la raiz y el archivo
// "no existe" aunque este ahi. El .sh que esto reemplaza si aceptaba rutas absolutas.
const ruta = path.resolve(RAIZ, archivo)

// Que el ledger no exista no es un fallo: un proyecto recien clonado todavia no lo tiene.
if (!fs.existsSync(ruta)) {
  console.log(`no hay ${archivo} (crea el ledger del build, ver AGENTS.md)`)
  process.exit(0)
}

let doc
try {
  doc = JSON.parse(fs.readFileSync(ruta, 'utf8'))
} catch (e) {
  console.error(`${archivo} invalido: ${e.message}`)
  process.exit(1)
}

const features = Array.isArray(doc.features) ? doc.features : []
const pasan = features.filter((f) => f.passes)
const faltan = features.filter((f) => !f.passes)

if (argv.includes('--json')) {
  console.log(JSON.stringify({ total: features.length, pasan: pasan.length, faltan }, null, 2))
  process.exit(0)
}

console.log(`FEATURES: ${pasan.length}/${features.length} passing`)
for (const f of faltan.slice(0, TOPE)) {
  console.log(`  [ ] ${f.id || '?'} (${f.categoria || ''}): ${f.descripcion || ''}`)
}
if (faltan.length > TOPE) console.log(`  ... y ${faltan.length - TOPE} mas incompletas`)
