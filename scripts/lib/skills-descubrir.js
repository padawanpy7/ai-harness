// Donde viven las skills, en un solo lugar.
//
// Por que existe: `skill-sync` las listaba de una forma y el gate `estructura` de `check` las
// listaba de otra, cada uno con su propio readdir. Mientras las dos coincidieron nadie lo noto;
// el dia que una aprendio el formato anidado y la otra no, el gate quedo pidiendo regenerar un
// archivo que ya estaba regenerado -y no habia forma de ponerlo en verde-.
//
// Dos formatos, porque la familia de harness difiere:
//   skills/<nombre>.md                 (plano)
//   .claude/skills/<nombre>/SKILL.md   (el de Claude Code)

const fs = require('fs')
const path = require('path')

const leer = (p) => { try { return fs.readFileSync(p, 'utf8') } catch { return '' } }

// Devuelve [{ base, texto, enlace }] con `base` = el nombre de la skill y `enlace` = su ruta
// relativa a skills/, que es donde vive el REGISTRY que las lista.
function descubrir(raiz) {
  const dirSkills = path.join(raiz, 'skills')

  const planos = (() => {
    try {
      return fs.readdirSync(dirSkills)
        .filter((f) => f.endsWith('.md') && f !== 'REGISTRY.md')
        .map((f) => path.join(dirSkills, f))
    } catch { return [] }
  })()

  const anidados = (() => {
    const base = path.join(raiz, '.claude', 'skills')
    try {
      return fs.readdirSync(base, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(base, e.name, 'SKILL.md'))
        .filter((p) => fs.existsSync(p))
    } catch { return [] }
  })()

  return [...planos, ...anidados].map((ruta) => {
    // En el formato anidado todos los archivos se llaman SKILL.md: lo que identifica a la skill
    // es la CARPETA. En el plano, el nombre del archivo.
    const archivo = path.basename(ruta)
    const base = archivo === 'SKILL.md'
      ? path.basename(path.dirname(ruta))
      : archivo.replace(/\.md$/, '')
    return {
      base,
      texto: leer(ruta),
      enlace: path.relative(dirSkills, ruta).split(path.sep).join('/'),
    }
  })
}

module.exports = { descubrir }
