// spell.js - ortografia es+en sobre la prosa del harness.
//
// Wrapper fino de cspell via npx: no hay logica propia que valga un core grande, salvo donde
// resolver la config y que revisar por defecto (scripts/lib/spell-core.js).
//
// Uso: node harness.js spell [archivo|glob ...]
//   sin objetivos, revisa AGENTS.md, CLAUDE.md, README.md y memory/openspec/skills/docs en **/*.md

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { OBJETIVOS_POR_DEFECTO, resolverConfig } = require('../lib/spell-core')

const RAIZ = process.cwd()

function ayuda() {
  console.log('Uso: node harness.js spell [archivo|glob ...]')
  console.log('  ortografia es+en (cspell) sobre la prosa del harness.')
  console.log('  sin objetivos: ' + OBJETIVOS_POR_DEFECTO.join(' '))
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) { ayuda(); process.exit(0) }

  const objetivos = args.length ? args : OBJETIVOS_POR_DEFECTO
  const cfg = resolverConfig((f) => fs.existsSync(path.join(RAIZ, f)))

  console.log(`==> spell (es,en): ${objetivos.join(' ')}`)
  const r = spawnSync('npx', [
    '-y', '-p', 'cspell@latest', '-p', '@cspell/dict-es-es', 'cspell',
    '--no-progress', '--gitignore', '--config', cfg, ...objetivos,
  ], { cwd: RAIZ, stdio: 'inherit' })

  console.log('Por cada palabra: 1) fixea el typo; 2) si el dict no la trae, usa un SINONIMO que si;')
  console.log('3) solo si no hay sinonimo (nombre propio/jerga) agregala a cspell.json (words).')

  if (r.error) { console.error(`FALLO al correr npx: ${r.error.message}`); process.exit(1) }
  process.exit(r.status === null ? 1 : r.status)
}

main()
