// check-core.js - logica pura de `node harness.js check`: que alcance gatear y que archivos le tocan
// a cada gate. Sin filesystem ni git aca (eso lo hace check.js); todo entra ya leido, para poder
// testear la decision sin tocar el disco ni el repo real.

// Convierte `git status --porcelain` en la lista de archivos que tocaron. Recibe el texto CRUDO,
// SIN trim: las dos primeras columnas codifican el estado y la de working tree es la segunda, asi
// que una linea modificada empieza con un espacio (" M archivo"). Un .trim() del texto completo se
// come ese espacio SOLO en la primera linea (es el borde del string entero, no de cada linea), el
// slice(3) queda corrido un caracter y el primer archivo modificado sale mordido y se descarta en
// silencio. Por eso el corte es `linea.slice(3)`, nunca sobre el texto entero.
function parsePorcelano(raw) {
  const archivos = new Set()
  for (const linea of (raw || '').split('\n')) {
    if (!linea) continue
    const resto = linea.slice(3).trim()
    if (!resto) continue
    archivos.add(resto.includes(' -> ') ? resto.split(' -> ')[1] : resto)
  }
  return [...archivos]
}

// Decide QUE gatear. Este harness commitea directo sobre main (sin ramas de ticket), asi que a
// diferencia de bf-db-workspace un `git diff main` daria siempre vacio: el alcance por defecto es
// lo que esta SIN COMMITEAR. Si no hay nada sin commitear, o si no se pudo preguntarle a git, se
// gatea TODO (principio 2 de check.js: ante la duda, de mas).
function decidirAlcance({ rutas, todos, porcelanoRaw, existeArchivo }) {
  if (rutas && rutas.length) return { modo: 'rutas', archivos: rutas }
  if (todos) return { modo: 'todo', archivos: null }
  if (porcelanoRaw === null) {
    return { modo: 'todo', archivos: null, motivo: 'no pude preguntarle a git si hay cambios sin commitear' }
  }
  const cambiados = parsePorcelano(porcelanoRaw).filter((f) => !existeArchivo || existeArchivo(f))
  if (!cambiados.length) return { modo: 'todo', archivos: null, motivo: 'no hay nada sin commitear' }
  return { modo: 'cambios', archivos: cambiados }
}

function conExtension(archivos, exts) {
  return (archivos || []).filter((f) => exts.some((e) => f.toLowerCase().endsWith(e)))
}

// El subconjunto de doctor-core que es ROTURA REAL (bloquea) y no aviso: frontmatter de los
// hechos, que `name:` coincida con el archivo, sincronia en los dos sentidos entre MEMORY.md y
// memory/hechos/, wikilinks colgados, y el registry de skills desincronizado. Lo informativo
// (inventario.md/playbooks viejos, paquetes/ desactualizado) se queda SOLO en `doctor`: son avisos
// para leer, no motivo para frenar un commit.
const doctorCore = require('./doctor-core')

function problemasEstructura({ hechos, memoriaTexto, registryActual, registryEsperado }) {
  const problemas = []
  const lista = hechos || []
  const slugs = lista.map((h) => h.slug)

  for (const h of lista) {
    for (const campo of doctorCore.frontmatterFaltante(h.texto)) {
      problemas.push(`memory/hechos/${h.archivo} sin '${campo}:' en el frontmatter`)
    }
    if (doctorCore.nombreCoincideConArchivo(h.texto, h.slug) === false) {
      problemas.push(`memory/hechos/${h.archivo}: 'name:' no coincide con el archivo`)
    }
    if (!doctorCore.hechoEnlazadoEnIndice(h.slug, memoriaTexto)) {
      problemas.push(`memory/hechos/${h.archivo} no esta enlazado desde memory/MEMORY.md`)
    }
  }

  for (const ref of doctorCore.referenciasIndiceColgadas(memoriaTexto, slugs)) {
    problemas.push(`memory/MEMORY.md apunta a ${ref}, que no existe`)
  }
  for (const wl of doctorCore.wikilinksColgados(lista.map((h) => h.texto), slugs)) {
    problemas.push(`wikilink [[${wl}]] no tiene hecho correspondiente (memory/hechos/${wl}.md)`)
  }
  if (registryActual !== undefined && doctorCore.registryDesincronizado(registryActual, registryEsperado)) {
    problemas.push('skills/REGISTRY.md desincronizado (node harness.js doctor lo regenera)')
  }

  return problemas
}

module.exports = { parsePorcelano, decidirAlcance, conExtension, problemasEstructura }
