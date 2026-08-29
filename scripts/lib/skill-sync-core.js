// skill-sync-core.js - arma el markdown de skills/REGISTRY.md a partir del contenido de cada
// skill. Sin filesystem aca: eso lo hace skill-sync.js.

// El frontmatter se lee de las primeras lineas que empiezan con "clave:", no de un parser YAML
// completo: alcanza para name/when y una skill puede mencionar "when:" en su prosa sin que eso
// confunda al regex de linea completa (^...$ con flag m).
function campo(texto, clave) {
  const m = (texto || '').match(new RegExp(`^${clave}:[ \\t]*(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}

function fila(skill) {
  const nombre = campo(skill.texto, 'name') || skill.base.replace(/\.md$/, '')
  const cuando = campo(skill.texto, 'when')
  return `| [${nombre}](${skill.base}) | ${cuando} |`
}

function registro(skills) {
  const filas = [...(skills || [])].sort((a, b) => a.base.localeCompare(b.base)).map(fila)
  const lineas = [
    '# Skill Registry',
    '',
    'Indice de skills, cargados por necesidad (no todos en el contexto). Generado por',
    'scripts/harness/skill-sync.js. No lo edites a mano.',
    '',
    '| skill | cuando usarlo |',
    '|---|---|',
    ...filas,
  ]
  return lineas.join('\n') + '\n'
}

module.exports = { campo, registro }
