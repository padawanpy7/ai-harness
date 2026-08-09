#!/usr/bin/env node
// md-a-pdf.js - convierte un .md a PDF, para mandar un documento del repo a alguien de afuera
// (el analista, el banco) sin pedirle que lea markdown.
//
// No agrega infraestructura: el markdown lo parsea `marked` y el PDF lo imprime el **Chromium de
// Playwright** que ya usan las tools de APEX. Sin servicios online: el documento nunca sale de la
// maquina.
//
// Uso:  node scripts/docs/md-a-pdf.js <archivo.md> [otro.md ...] [--out <archivo.pdf>] [--horizontal]
//       --out solo vale con UN archivo; por default el PDF queda al lado del .md.
//
// El HTML intermedio se escribe en la carpeta del .md (asi las imagenes relativas resuelven) y se
// borra al terminar.

const fs = require('fs')
const path = require('path')
const { marked } = require('marked')
const { chromium } = require('playwright')

const RAIZ = path.resolve(__dirname, '../..')

function ayuda() {
  console.log(`Uso: node scripts/docs/md-a-pdf.js <archivo.md> [otro.md ...] [--out <archivo.pdf>] [--horizontal]

  --out <f.pdf>   nombre del PDF (solo con UN archivo de entrada)
  --horizontal    hoja apaisada, para documentos con tablas anchas

Ejemplo:
  node scripts/docs/md-a-pdf.js openspec/changes/<ID>/docs/manual-de-prueba.md`)
}

// Estilos de impresion: sobrios, legibles en papel, sin depender de fuentes externas.
const CSS = `
  @page { size: A4 SIZE_EXTRA; margin: 18mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Calibri, Arial, sans-serif; font-size: 10.5pt; line-height: 1.5;
         color: #1a1a1a; margin: 0; }
  h1 { font-size: 19pt; margin: 0 0 4pt; padding-bottom: 6pt; border-bottom: 2px solid #333; }
  h2 { font-size: 14pt; margin: 20pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #bbb;
       break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 14pt 0 4pt; break-after: avoid; }
  p, ul, ol { margin: 0 0 8pt; }
  li { margin-bottom: 3pt; }
  strong { color: #000; }
  code { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt;
         background: #f2f2f2; padding: 1px 4px; border-radius: 3px; }
  pre { background: #f7f7f7; border: 1px solid #ddd; border-radius: 4px; padding: 8pt;
        overflow-x: auto; break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 9pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; font-size: 9.5pt;
          break-inside: auto; }
  thead { display: table-header-group; }   /* la cabecera se repite en cada hoja */
  tr { break-inside: avoid; }
  th, td { border: 1px solid #c8c8c8; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #ececec; font-weight: 600; }
  tbody tr:nth-child(even) { background: #fafafa; }
  blockquote { margin: 8pt 0; padding: 4pt 10pt; border-left: 3px solid #bbb; background: #f7f7f7;
               color: #333; }
  hr { border: 0; border-top: 1px solid #ccc; margin: 14pt 0; }
  a { color: #16447a; text-decoration: none; }
  img { max-width: 100%; }
`

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function convertir(navegador, md, salida, horizontal) {
  const texto = fs.readFileSync(md, 'utf8')
  const primerH1 = (texto.match(/^#\s+(.+)$/m) || [])[1]
  const titulo = primerH1 || path.basename(md, '.md')

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${escapar(titulo)}</title>
<style>${CSS.replace('SIZE_EXTRA', horizontal ? 'landscape' : 'portrait')}</style>
</head><body>${marked.parse(texto)}</body></html>`

  // Se escribe al lado del .md para que las imagenes relativas resuelvan igual que en el repo.
  const tmp = path.join(path.dirname(md), `.md-a-pdf-${process.pid}.html`)
  fs.writeFileSync(tmp, html, 'utf8')
  const pagina = await navegador.newPage()
  try {
    await pagina.goto('file://' + tmp.replace(/\\/g, '/'), { waitUntil: 'load' })
    await pagina.pdf({
      path: salida,
      format: 'A4',
      landscape: horizontal,
      printBackground: true,
      margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        `<div style="width:100%;font-size:8pt;color:#666;padding:0 16mm;
           display:flex;justify-content:space-between;font-family:Calibri,Arial,sans-serif">
           <span>${escapar(titulo)}</span>
           <span>pag. <span class="pageNumber"></span> de <span class="totalPages"></span></span>
         </div>`,
    })
  } finally {
    await pagina.close()
    fs.rmSync(tmp, { force: true })
  }
}

async function main() {
  const argv = process.argv.slice(2)
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) { ayuda(); process.exit(argv.length ? 0 : 2) }

  const horizontal = argv.includes('--horizontal')
  const iOut = argv.indexOf('--out')
  const out = iOut >= 0 ? argv[iOut + 1] : null
  if (iOut >= 0 && !out) { console.error('FALLO: --out sin archivo.'); process.exit(2) }

  const entradas = argv.filter((a, i) => !a.startsWith('--') && !(iOut >= 0 && i === iOut + 1))
  if (!entradas.length) { console.error('FALLO: no pasaste ningun .md.'); process.exit(2) }
  if (out && entradas.length > 1) { console.error('FALLO: --out solo vale con UN archivo.'); process.exit(2) }

  const mds = entradas.map((e) => (path.isAbsolute(e) ? e : path.join(RAIZ, e)))
  for (const md of mds) {
    if (!fs.existsSync(md)) { console.error('FALLO: no existe ' + md); process.exit(2) }
    if (!md.toLowerCase().endsWith('.md')) { console.error('FALLO: no es un .md: ' + md); process.exit(2) }
  }

  const navegador = await chromium.launch()
  try {
    for (const md of mds) {
      const salida = out
        ? (path.isAbsolute(out) ? out : path.join(RAIZ, out))
        : md.replace(/\.md$/i, '.pdf')
      await convertir(navegador, md, salida, horizontal)
      const kb = Math.round(fs.statSync(salida).size / 1024)
      console.log(`OK  ${path.relative(RAIZ, md)}  ->  ${path.relative(RAIZ, salida)}  (${kb} KB)`)
    }
  } finally {
    await navegador.close()
  }
}

main().catch((e) => { console.error('FALLO: ' + (e && e.message ? e.message : e)); process.exit(1) })
