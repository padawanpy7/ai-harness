// spell-core.js - lo unico puro de spell.js: donde vive la config de cspell y que se revisa
// cuando no se pasan objetivos. El chequeo en si corre por npx/cspell (spell.js), no hay logica
// de ortografia que testear aca.

const OBJETIVOS_POR_DEFECTO = [
  'AGENTS.md', 'CLAUDE.md', 'README.md',
  'memory/**/*.md', 'openspec/**/*.md', 'skills/**/*.md', 'docs/**/*.md',
]

// El cspell.json de la raiz del repo gana si existe; si no, cae al de scripts/ (por si algun dia
// se versiona uno mas chico solo para el harness). `existeArchivo` es inyectable para poder
// testear la decision sin tocar el disco real.
function resolverConfig(existeArchivo) {
  return existeArchivo('cspell.json') ? 'cspell.json' : 'scripts/cspell.json'
}

module.exports = { OBJETIVOS_POR_DEFECTO, resolverConfig }
