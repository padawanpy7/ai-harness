// roles.js - imprime los roles de agente y los playbooks que existen, sacado del disco.
//
// Uso: node harness.js roles
//
// Por que existe: AGENTS.md §3 tenia una tabla de roles escrita a mano y una frase "hoy solo
// existe db.md" que se volvio falsa el dia que aparecio el segundo playbook (se pudre como
// cualquier lista a mano). Roles sale de `.claude/agents/*.md` (nombre + description + tools de
// su frontmatter) y playbooks de `memory/playbooks/*.md`: no puede mentir sobre que existe.

const fs = require('fs')
const path = require('path')
const { roles, playbooks, resumir } = require('../lib/roles-registro')

const argv = process.argv.slice(2)
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Uso: node harness.js roles')
  console.log('  lista los roles de .claude/agents/ (nombre, para que sirve, herramientas)')
  console.log('  y los playbooks que existen en memory/playbooks/')
  process.exit(0)
}

const RAIZ = process.cwd()
const DIR_AGENTES = path.join(RAIZ, '.claude', 'agents')
const DIR_PLAYBOOKS = path.join(RAIZ, 'memory', 'playbooks')

const nombresMd = (dir) => {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.md')) } catch { return [] }
}

const archivosAgentes = nombresMd(DIR_AGENTES).map((nombre) => ({
  nombre,
  texto: fs.readFileSync(path.join(DIR_AGENTES, nombre), 'utf8'),
}))

const listaRoles = roles(archivosAgentes)
const listaPlaybooks = playbooks(nombresMd(DIR_PLAYBOOKS))

console.log('== Roles de agente (.claude/agents/) ==')
if (!listaRoles.length) {
  console.log('  (ninguno: falta .claude/agents/)')
} else {
  for (const r of listaRoles) {
    console.log(`  ${r.nombre.padEnd(16)} ${resumir(r.descripcion)}`)
    console.log(`  ${''.padEnd(16)} tools: ${r.tools}`)
  }
}

console.log('')
console.log('== Playbooks (memory/playbooks/) ==')
console.log('  ' + (listaPlaybooks.length ? listaPlaybooks.join(', ') : '(ninguno todavia)'))
