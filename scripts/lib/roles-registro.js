// Parsea el frontmatter de un rol (.claude/agents/*.md) y arma el listado de roles y playbooks
// que existen. Puro: recibe texto ya leido, nunca toca el filesystem (eso lo hace
// scripts/loop/roles.js).
//
// Por que existe: AGENTS.md tenia una tabla de roles escrita a mano y una frase sobre los
// playbooks que quedo vieja el dia que aparecio el segundo (13/08). Una lista a mano se pudre;
// esta sale del disco, asi que no puede mentir sobre que existe.

function campo(bloque, clave) {
  const m = bloque.match(new RegExp(`^${clave}:[ \\t]*(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}

function parsearRol(nombreArchivo, texto) {
  const bloque = texto.split(/^---\s*$/m)[1] || ''
  return {
    nombre: campo(bloque, 'name') || nombreArchivo.replace(/\.md$/, ''),
    descripcion: campo(bloque, 'description'),
    tools: campo(bloque, 'tools'),
  }
}

function roles(archivos) {
  return archivos
    .map(({ nombre, texto }) => parsearRol(nombre, texto))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

function playbooks(nombresArchivo) {
  return nombresArchivo.map((f) => f.replace(/\.md$/, '')).sort()
}

// La description del frontmatter es un parrafo entero (piensa en que agente delegar, no en
// mostrarse corto). Para el listado alcanza con "para que sirve": la/s primera/s oracion/es,
// cortadas si igual se pasan del limite.
function resumir(descripcion, max = 160) {
  const partes = descripcion.split('. ').filter(Boolean)
  let resumen = partes[0] || ''
  if (partes[1] && resumen.length < max) resumen += '. ' + partes[1]
  if (!resumen.endsWith('.')) resumen += '.'
  return resumen.length > max ? resumen.slice(0, max - 3) + '...' : resumen
}

module.exports = { parsearRol, roles, playbooks, resumir }
