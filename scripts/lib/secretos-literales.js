// Complementa a gitleaks (reglas por defecto): un archivo de config con "PASS": "<26 chars>"
// no matchea ninguna regla generica, y eso dejo pasar una credencial de PRODUCCION versionada
// (API-EXTRACTO-PROD.postman_environment.json, commit 9c404ca del 05/08). Esto busca ese patron
// puntual: un LITERAL no vacio, que no sea plantilla, bajo una clave que suena a credencial.
// Puro: recibe {ruta, contenido} ya leidos (fs lo hace quien llama, igual que deps-fijas.js con
// package.json). Escanea por LINEA, no parsea JSON/YAML de verdad: alcanza para "clave": "valor"
// / KEY=valor, que es como se guardan credenciales en estos formatos, y evita arrastrar un parser
// por formato solo para esto.

const EXTENSIONES = ['.json', '.env', '.yml', '.yaml', '.properties', '.cfg', '.ini', '.conf']

const CLAVES_SENSIBLES = [
  'pass', 'passwd', 'password', 'pwd', 'clave', 'contrasena', 'secreto', 'secret',
  'token', 'apikey', 'clientsecret',
]

const LARGO_MINIMO = 8

// Boundary antes de la clave (inicio de linea, `{`, `,`, `[` o un espacio) para no partir un
// token mas largo a la mitad; el valor es un string entre comillas (con escapes) o una palabra
// sin espacio/coma/llave (formato `KEY=valor` de un .env).
const PAR = /(?:^|[{,[\s])["']?([A-Za-z][\w.-]*)["']?\s*[:=]\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,}\]]+)/g

// El formato REAL de un environment de Postman -el que dejo pasar la clave PROD del 05/08- no es
// "PASS": "valor": es un objeto `{"key": "PASS", "value": "valor"}`, casi siempre en dos lineas.
// VALOR va con su propio matcher (agarra ETIQUETA de hasta 3 lineas antes) ademas del PAR de
// arriba, que solo cubre la clave y el valor en la MISMA posicion.
const ETIQUETA = /"(?:key|name)"\s*:\s*"([^"]*)"/
const VALOR = /"value"\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,}\]]+)/
const VENTANA_MAX = 3

function normalizar(clave) {
  return clave.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function esClaveSensible(clave) {
  const norm = normalizar(clave)
  return CLAVES_SENSIBLES.some((c) => norm.includes(c))
}

function esTemplate(valor) {
  return /^\{\{.*\}\}$/.test(valor) || /^\$\{.*\}$/.test(valor) || /^<.*>$/.test(valor)
}

function limpiarValor(bruto) {
  const conComillas = bruto.match(/^"([^"]*)"$/) || bruto.match(/^'([^']*)'$/)
  return conComillas ? conComillas[1] : bruto
}

function marcar(encontrados, ruta, i, clave, bruto) {
  const valor = limpiarValor(bruto)
  if (!valor || esTemplate(valor) || valor.length < LARGO_MINIMO) return
  encontrados.push({ archivo: ruta, linea: i + 1, clave })
}

function hallazgosEnArchivo(ruta, contenido) {
  const encontrados = []
  let pendiente = null
  contenido.split(/\r?\n/).forEach((linea, i) => {
    for (const m of linea.matchAll(PAR)) {
      const [, clave, bruto] = m
      if (esClaveSensible(clave)) marcar(encontrados, ruta, i, clave, bruto)
    }

    const et = linea.match(ETIQUETA)
    if (et) pendiente = { nombre: et[1], linea: i }

    const va = linea.match(VALOR)
    if (va && pendiente && i - pendiente.linea <= VENTANA_MAX) {
      if (esClaveSensible(pendiente.nombre)) marcar(encontrados, ruta, i, pendiente.nombre, va[1])
      pendiente = null
    }
  })
  return encontrados
}

function hallazgos(archivos) {
  const resultado = []
  for (const { ruta, contenido } of archivos) resultado.push(...hallazgosEnArchivo(ruta, contenido))
  return resultado
}

module.exports = { hallazgos, EXTENSIONES }
