// arranque-frio.js - simula el arranque de un agente SIN CONTEXTO y caza lo que el repo desmiente.
//
// Uso: node harness.js arranque-frio [--paquete] [--json]
//   --paquete   imprime lo que leeria un agente nuevo, para pasarselo a uno de verdad
//
// Por que existe: el playbook del lead pide "simular un arranque sin contexto" y `cierre` lo
// imprimia como recordatorio, o sea que dependia de que alguien se acordara. El 29/08/2026 el
// cierre dio 7 ok mientras `work/PROGRESO.md` decia tres cosas falsas: una pregunta ya respondida,
// un pendiente ya hecho y una frase mutilada por un reemplazo. Ninguna la ve un gate de formato:
// los documentos EXISTIAN y estaban versionados. Lo que fallaba es que MENTIAN.
//
// Dos capas, porque son dos problemas distintos:
//
//   1. Las CONTRADICCIONES las mide esta tool: el documento afirma algo que el repo desmiente
//      -"falta traer X" cuando X ya esta-. Eso no necesita criterio, necesita comparar.
//   2. Si lo escrito ALCANZA para retomar necesita criterio, y no lo puede juzgar quien escribio
//      el documento: lo juzga un agente sin contexto leyendo `--paquete`. El sesgo del que ya
//      sabe la respuesta es justamente lo que hace que un documento incompleto parezca completo.

const fs = require('fs')
const path = require('path')
const core = require('../lib/arranque-core')
const { descubrirTools } = require('../lib/tools-registro')

const RAIZ = process.cwd()
const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Uso: node harness.js arranque-frio [--paquete] [--json]')
  console.log('  compara lo que dicen los documentos de arranque contra lo que el repo tiene.')
  console.log('  --paquete  imprime lo que leeria un agente nuevo (para dárselo a uno de verdad)')
  console.log('  sale 1 si encuentra una contradiccion.')
  process.exit(0)
}

const leer = (r) => { try { return fs.readFileSync(path.join(RAIZ, r), 'utf8') } catch { return null } }

// Lo que un agente nuevo lee, y nada mas. El orden es el del arranque real.
const DOCUMENTOS = ['CLAUDE.md', 'AGENTS.md', 'memory/MEMORY.md', 'work/PROGRESO.md']

if (argv.includes('--paquete')) {
  console.log('# Paquete de arranque en frio')
  console.log('')
  console.log('Esto es TODO lo que ve un agente que abre el repo sin haber estado en la sesion.')
  console.log('Si con esto no puede decir que se hizo y que sigue, lo escrito no alcanza.')
  for (const d of DOCUMENTOS) {
    const t = leer(d)
    console.log(`\n---\n\n## ${d}${t === null ? '  (NO EXISTE)' : ''}\n`)
    if (t !== null) console.log(t.trimEnd())
  }
  process.exit(0)
}

const tools = descubrirTools(RAIZ)
const existeRuta = (r) => fs.existsSync(path.join(RAIZ, r))
const esToolConocida = (t) => tools.has(t)

const hallazgos = []
for (const d of DOCUMENTOS) {
  const texto = leer(d)
  if (texto === null) continue
  const pendientes = core.pendientesDe(texto)
  for (const h of core.contradicciones(pendientes, { existeRuta, esToolConocida })) {
    hallazgos.push({ ...h, archivo: d })
  }
  // Las referencias colgadas NO se miran sobre estos documentos: `work/PROGRESO.md` narra tambien
  // el trabajo hecho en repos HERMANOS, y sus rutas no existen aca por diseño. Medido el 06/09:
  // 4 hallazgos, los 4 falsos -`docs/conversaciones/` y `tesis/esqueleto/` son del repo de tesis-.
  // Ninguna heuristica de rutas distingue "ruta rota" de "ruta de otro repo", y el chequeo de
  // referencias muertas de `cierre` ya cubre los documentos donde una ruta rota si importa.
}

const r = core.resumir(hallazgos)

if (argv.includes('--json')) {
  console.log(JSON.stringify({ ok: r.ok, total: r.total, porTipo: r.porTipo, hallazgos }, null, 2))
  process.exit(r.ok ? 0 : 1)
}

console.log('==> arranque en frio: lo escrito contra lo que el repo tiene')
console.log(`  documentos mirados: ${DOCUMENTOS.filter((d) => leer(d) !== null).length}/${DOCUMENTOS.length}`)

if (r.ok) {
  console.log('  sin contradicciones mecanicas')
} else {
  console.log('')
  for (const h of hallazgos) {
    console.log(`  ${h.archivo}${h.linea ? `:${h.linea}` : ''}  ${h.detalle}`)
  }
}

console.log('')
console.log('  Esto NO mide si lo escrito alcanza para retomar: eso necesita criterio, y no lo')
console.log('  puede juzgar quien escribio el documento. Para eso:')
console.log('    node harness.js arranque-frio --paquete')
console.log('  y pasaselo a un agente SIN contexto, pidiendole que conteste, solo con eso:')
console.log('    1. que se hizo en la ultima sesion   2. que sigue   3. que se contradice')

process.exit(r.ok ? 0 : 1)
