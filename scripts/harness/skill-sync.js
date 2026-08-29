// skill-sync.js - regenera skills/REGISTRY.md.
//
// El indice de skills, que se cargan por necesidad y no todas en el contexto.
//
// Uso: node harness.js skill-sync

const fs = require('fs')
const path = require('path')
const { registro } = require('../lib/skill-sync-core')

const RAIZ = process.cwd()
const DIR = path.join(RAIZ, 'skills')
const SALIDA = path.join(DIR, 'REGISTRY.md')

function leerSkills() {
  if (!fs.existsSync(DIR)) return []
  return fs.readdirSync(DIR)
    .filter((f) => f.endsWith('.md') && f !== 'REGISTRY.md')
    .map((base) => {
      let texto = ''
      try { texto = fs.readFileSync(path.join(DIR, base), 'utf8') } catch { /* ilegible: queda sin name/when, cae al nombre del archivo */ }
      return { base, texto }
    })
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Uso: node harness.js skill-sync')
    console.log('  regenera skills/REGISTRY.md a partir del frontmatter de cada skills/*.md')
    process.exit(0)
  }

  const skills = leerSkills()
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(SALIDA, registro(skills))
  console.log(`skill-sync: ${path.relative(RAIZ, SALIDA)} actualizado (${skills.length} skills)`)
}

main()
