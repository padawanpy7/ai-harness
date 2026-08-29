// doctor-core.js - logica pura de las validaciones de `node harness.js doctor` (la salud del propio
// harness, no la de la maquina: para eso esta sistema/salud.sh).
//
// Cada funcion recibe los datos ya leidos (texto de un archivo, lista de mtimes, conteos) y
// devuelve un veredicto o una lista de problemas. Sin filesystem aca: eso lo hace doctor.js, que
// tambien imprime y decide el codigo de salida.

function tienePlaceholders(texto) {
  return (texto || '').includes('{{')
}

// Replica `grep -cvE '^[[:space:]]*(#|-[[:space:]]*$|$|`)'`: cuenta lineas que NO son titulo (#),
// bullet vacio (- solo), linea en blanco, o el marcador de un fence (`). Lo que queda es
// contenido real; un playbook con menos de 2 lineas de eso esta, en la practica, vacio.
const LINEA_ESQUELETO = /^[ \t]*(#|-[ \t]*$|$|`)/

function contarLineasCuerpo(texto) {
  return (texto || '').split('\n').filter((l) => !LINEA_ESQUELETO.test(l)).length
}

function esPlaybookCasiVacio(texto) {
  return contarLineasCuerpo(texto) < 2
}

function esArchivoViejo(mtimeMs, dias, ahora = Date.now()) {
  return ahora - mtimeMs > dias * 24 * 60 * 60 * 1000
}

// El frontmatter de un hecho necesita 'name:' y 'description:' en linea propia (no un YAML
// completo, solo lo que doctor valida). Devuelve las claves que faltan, vacio si esta completo.
function frontmatterFaltante(texto) {
  const faltan = []
  if (!/^name:/m.test(texto || '')) faltan.push('name')
  if (!/^description:/m.test(texto || '')) faltan.push('description')
  return faltan
}

// null si el hecho no declara 'name:' (frontmatterFaltante ya lo marca aparte); si lo declara,
// tiene que ser exactamente el nombre del archivo sin '.md' (el slug).
function nombreCoincideConArchivo(texto, slug) {
  const m = (texto || '').match(/^name:[ \t]*(.*)$/m)
  if (!m) return null
  const fmname = m[1].trim()
  if (!fmname) return null
  return fmname === slug
}

function hechoEnlazadoEnIndice(slug, indiceTexto) {
  return (indiceTexto || '').includes(`hechos/${slug}.md`)
}

// La otra direccion: cada `hechos/xxx.md` que MEMORY.md menciona tiene que existir de verdad.
function referenciasIndiceColgadas(indiceTexto, slugsExistentes) {
  const set = new Set(slugsExistentes)
  const refs = new Set((indiceTexto || '').match(/hechos\/[a-z0-9-]+\.md/g) || [])
  return [...refs].filter((ref) => !set.has(ref.replace(/^hechos\//, '').replace(/\.md$/, ''))).sort()
}

// Los [[wikilinks]] entre hechos, juntando todos los textos (como el grep original, que no
// distingue de que archivo vino cada [[link]]): el que no tiene hecho correspondiente, cuelga.
function wikilinksColgados(textos, slugsExistentes) {
  const set = new Set(slugsExistentes)
  const links = new Set()
  for (const texto of textos || []) {
    for (const m of (texto || '').matchAll(/\[\[([a-z0-9-]+)\]\]/g)) links.add(m[1])
  }
  return [...links].filter((l) => !set.has(l)).sort()
}

function toolsSistemaFaltantes(existentes, requeridas) {
  const set = new Set(existentes)
  return requeridas.filter((r) => !set.has(r))
}

function paquetesDesactualizados(actual, guardado) {
  return actual !== guardado
}

function registryDesincronizado(actual, esperado) {
  return (actual || '') !== esperado
}

module.exports = {
  tienePlaceholders,
  contarLineasCuerpo,
  esPlaybookCasiVacio,
  esArchivoViejo,
  frontmatterFaltante,
  nombreCoincideConArchivo,
  hechoEnlazadoEnIndice,
  referenciasIndiceColgadas,
  wikilinksColgados,
  toolsSistemaFaltantes,
  paquetesDesactualizados,
  registryDesincronizado,
}
