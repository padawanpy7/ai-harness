// buscar.js - que dijimos sobre esto, SIN abrir un archivo.
//
// Por que existe: "que decidimos sobre X" hoy se contesta abriendo PROGRESO, playbooks y hechos y
// leyendolos, que es justo lo que hace lenta a una sesion: cada respuesta que no esta indexada se
// paga metiendo archivos al contexto. El material ya esta en disco -Claude Code escribe cada
// sesion en ~/.claude/projects/<proyecto>/<sesion>.jsonl- pero nadie lo lee para BUSCAR:
// metricas.js los recorre solo para medir tiempos (y ahora comparte con esta tool la caminata del
// directorio, en scripts/lib/transcripts.js).
//
// Adaptaciones a este harness (no hay worktrees ni tickets, asi que la idea original de filtrar
// por --ticket no aplica):
//   - Por defecto mira SOLO el transcript de este proyecto (-home-ianmrc-harness). `--home` suma
//     ademas -home-ianmrc, donde puede haber conversaciones sobre esta maquina fuera del repo.
//   - Aca hay un transcript de unos pocos MB, no 230: se barre entero cada vez, sin indice ni
//     cache.
//
// Que devuelve: una linea por coincidencia con la fecha, quien hablo, el origen (harness/home,
// solo si --home esta activo) y el FRAGMENTO alrededor del match. Nunca el mensaje entero: el
// punto es no volcar tokens al contexto.
//
// SOLO LEE. Ni escribe ni toca nada.
// Uso: node harness.js buscar <texto> [--home] [--desde AAAA-MM-DD] [--yo] [--claude] [--ancho N] [--max N]

const path = require('path')
const fs = require('fs')
const { transcripts, RAIZ_PROYECTOS } = require('../lib/transcripts')

const PROYECTO_HARNESS = '-home-ianmrc-harness'
const PROYECTO_HOME = '-home-ianmrc'

const args = process.argv.slice(2)
const tiene = (n) => args.includes(n)
const flag = (n, def) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : def }

if (!args.length || tiene('-h') || tiene('--help')) {
  console.log('Uso: node harness.js buscar <texto> [--home] [--desde AAAA-MM-DD] [--yo] [--claude] [--ancho N] [--max N]')
  console.log('  Busca en las sesiones pasadas y muestra el fragmento, no el archivo entero.')
  console.log(`  (default)  solo el transcript de este proyecto (${PROYECTO_HARNESS})`)
  console.log(`  --home     suma tambien ${PROYECTO_HOME}: conversaciones sobre esta maquina fuera del repo`)
  console.log('  --desde    solo mensajes desde esa fecha')
  console.log('  --yo       solo lo que escribio el dueño;  --claude  solo lo que contesto el agente')
  console.log('  --ancho    caracteres de contexto alrededor del match (default 140)')
  console.log('  --max      tope de coincidencias (default 30)')
  console.log(`  Lee ${RAIZ_PROYECTOS}. Solo lectura.`)
  process.exit(0)
}

const texto = args.filter((a, i) => !a.startsWith('--') && !String(args[i - 1] || '').startsWith('--')).join(' ').trim()
if (!texto) {
  console.error('falta el texto a buscar. Ver --help.')
  process.exit(2)
}

const conHome = tiene('--home')
const desde = flag('--desde', null)
const ancho = Number(flag('--ancho', 140))
const max = Number(flag('--max', 30))
const soloYo = tiene('--yo')
const soloClaude = tiene('--claude')

const soloProyectos = conHome ? [PROYECTO_HARNESS, PROYECTO_HOME] : [PROYECTO_HARNESS]
const origenDe = (proyecto) => (proyecto === PROYECTO_HARNESS ? 'harness' : proyecto === PROYECTO_HOME ? 'home' : proyecto)

// Sin tildes y en minuscula de los dos lados: en un repo que escribe en español, buscar "digito"
// y no encontrar "dígito" es el caso normal, no el raro. La comparacion se hace siempre sobre la
// forma normalizada; lo que se IMPRIME es el texto original.
const normalizar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const aguja = normalizar(texto)

// De un mensaje sacamos SOLO el texto humano: el `text` del asistente y el content del usuario
// cuando es string. Los tool_result quedan afuera a proposito -son volcados de comandos, ruido
// para esta busqueda-.
function textoDe(j) {
  const c = j.message && j.message.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) return c.filter((x) => x && x.type === 'text').map((x) => x.text).join('\n')
  return ''
}

const limpio = (s) => String(s).replace(/\s+/g, ' ').trim()

const hallazgos = []
let leidos = 0

for (const { archivo, proyecto, subagente } of transcripts({ soloProyectos, conSubagentes: true })) {
  let contenido
  try { contenido = fs.readFileSync(archivo, 'utf8') } catch { continue }
  leidos++
  // El barrido cuesta menos que parsear: si la aguja no esta en el archivo, no hay JSON que leer.
  if (!normalizar(contenido).includes(aguja)) continue

  for (const linea of contenido.split('\n')) {
    if (!linea.trim()) continue
    // Un transcript se escribe mientras la sesion vive: la ultima linea puede estar a medias.
    let j
    try { j = JSON.parse(linea) } catch { continue }
    if (j.type !== 'user' && j.type !== 'assistant') continue
    if (soloYo && j.type !== 'user') continue
    if (soloClaude && j.type !== 'assistant') continue
    // Un `user` con tool_result no lo escribio una persona: es la salida de un comando.
    if (j.type === 'user' && typeof (j.message && j.message.content) !== 'string') continue
    if (desde && String(j.timestamp || '') < desde) continue

    const t = textoDe(j)
    if (!t) continue
    const donde = normalizar(t).indexOf(aguja)
    if (donde < 0) continue

    const ini = Math.max(0, donde - Math.floor(ancho / 2))
    hallazgos.push({
      fecha: String(j.timestamp || '').slice(0, 16).replace('T', ' '),
      quien: j.type === 'user' ? 'IMDX  ' : (subagente ? 'agente' : 'claude'),
      origen: origenDe(proyecto),
      sesion: path.basename(archivo, '.jsonl').slice(0, 8),
      frag: (ini > 0 ? '...' : '') + limpio(t.slice(ini, ini + ancho)) + (ini + ancho < t.length ? '...' : ''),
    })
  }
}

hallazgos.sort((a, b) => (a.fecha < b.fecha ? 1 : -1))

if (!hallazgos.length) {
  console.log(`sin coincidencias de "${texto}" en ${leidos} transcript(s)`)
  process.exit(0)
}

for (const h of hallazgos.slice(0, max)) {
  const prefijo = conHome ? `${h.fecha}  ${h.quien}  ${h.origen.padEnd(7)}  ` : `${h.fecha}  ${h.quien}  `
  console.log(`${prefijo}${h.frag}`)
}

console.log('')
console.log(`${hallazgos.length} coincidencia(s) en ${leidos} transcript(s)` + (hallazgos.length > max ? ` - se muestran ${max}, subilo con --max` : ''))
