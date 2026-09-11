const { test } = require('node:test')
const assert = require('node:assert')

const c = require('./cierre-core')

// --- limpio ------------------------------------------------------------------------------------
test('sin archivos sucios, pasa', () => {
  assert.strictEqual(c.chequearLimpio([]).estado, 'ok')
})

test('un archivo sin commitear FALTA, y se nombra', () => {
  const r = c.chequearLimpio(['work/tarea.md'])
  assert.strictEqual(r.estado, 'falta')
  assert.ok(r.detalle.includes('work/tarea.md'))
})

// --- pusheado ----------------------------------------------------------------------------------
test('commits sin pushear FALTAN y traen el comando', () => {
  const r = c.chequearPusheado(5, true)
  assert.strictEqual(r.estado, 'falta')
  assert.ok(r.detalle.some((d) => d.includes('git push origin main')))
})

test('al dia con origin/main pasa', () => {
  assert.strictEqual(c.chequearPusheado(0, true).estado, 'ok')
})

test('sin upstream avisa, no frena', () => {
  assert.strictEqual(c.chequearPusheado(0, false).estado, 'aviso')
})

// --- PROGRESO ----------------------------------------------------------------------------------
test('un PROGRESO con entrada de hoy pasa', () => {
  const r = c.chequearProgreso(true, ['2026-08-22', '2026-08-16'], '2026-08-22')
  assert.strictEqual(r.estado, 'ok')
})

test('un PROGRESO sin la entrada de hoy FALTA: el puente mentiria', () => {
  const r = c.chequearProgreso(true, ['2026-08-16'], '2026-08-22')
  assert.strictEqual(r.estado, 'falta')
  assert.ok(r.titulo.includes('2026-08-16'))
})

test('una fecha vieja como unica entrada FALTA igual', () => {
  const r = c.chequearProgreso(true, ['2020-01-01'], '2026-08-22')
  assert.strictEqual(r.estado, 'falta')
})

test('sin work/PROGRESO.md, FALTA', () => {
  assert.strictEqual(c.chequearProgreso(false, [], '2026-08-22').estado, 'falta')
})

test('sin ninguna fecha, FALTA', () => {
  assert.strictEqual(c.chequearProgreso(true, [], '2026-08-22').estado, 'falta')
})

test('entradas fuera de orden avisan (mas nueva tiene que ir arriba)', () => {
  const r = c.chequearProgreso(true, ['2026-08-16', '2026-08-22'], '2026-08-22')
  assert.strictEqual(r.estado, 'aviso')
})

// --- check ---------------------------------------------------------------------------------------
test('check en verde pasa', () => {
  assert.strictEqual(c.chequearCheck(0, 'OK check: todo verde').estado, 'ok')
})

test('check roto FALTA y trae la cola de la salida', () => {
  const r = c.chequearCheck(1, 'linea 1\nlinea 2\nFALLO check: revisa lo de arriba')
  assert.strictEqual(r.estado, 'falta')
  assert.ok(r.detalle.some((d) => d.includes('FALLO check')))
  assert.ok(r.detalle.some((d) => d.includes('node harness.js check --todos')))
})

// --- extraccion de rutas ---------------------------------------------------------------------
test('extrae una ruta simple de scripts/', () => {
  assert.deepStrictEqual(c.extraerRutas('ver scripts/loop/cierre.js para el detalle'),
    ['scripts/loop/cierre.js'])
})

test('recorta puntuacion final de la oracion', () => {
  assert.deepStrictEqual(c.extraerRutas('Generado por scripts/loop/skill-sync.js. No lo edites'),
    ['scripts/loop/skill-sync.js'])
})

test('un glob se recorta a la carpeta', () => {
  assert.deepStrictEqual(c.extraerRutas('corre sobre scripts/lib/*.test.js'), ['scripts/lib'])
})

test('una carpeta con barra final se mantiene como carpeta', () => {
  assert.deepStrictEqual(c.extraerRutas('todo en scripts/sistema/ queda en bash'), ['scripts/sistema/'])
})

test('sin menciones de scripts/, lista vacia', () => {
  assert.deepStrictEqual(c.extraerRutas('nada que ver aca'), [])
})

// --- extraccion de tools ---------------------------------------------------------------------
test('extrae el nombre de la tool de node harness.js', () => {
  assert.deepStrictEqual(c.extraerTools('corre node harness.js check antes de cerrar'), ['check'])
})

test('no confunde una flag con el nombre de una tool', () => {
  assert.deepStrictEqual(c.extraerTools('node harness.js check --todos'), ['check'])
})

// --- referencias muertas -----------------------------------------------------------------------
test('una ruta que no existe se marca muerta', () => {
  const r = c.referenciasMuertas('ver scripts/loop/no-existe.sh', () => false, () => true)
  assert.strictEqual(r.length, 1)
  assert.strictEqual(r[0].fragmento, 'scripts/loop/no-existe.sh')
})

test('una tool que no existe se marca muerta', () => {
  const r = c.referenciasMuertas('corre node harness.js tool-fantasma', () => true, () => false)
  assert.strictEqual(r.length, 1)
  assert.strictEqual(r[0].fragmento, 'node harness.js tool-fantasma')
})

test('si todo existe, no hay muertas', () => {
  const r = c.referenciasMuertas('ver scripts/loop/cierre.js y node harness.js check', () => true, () => true)
  assert.deepStrictEqual(r, [])
})

// --- chequearDocsMuertos -------------------------------------------------------------------------
test('sin hallazgos, los docs pasan', () => {
  assert.strictEqual(c.chequearDocsMuertos({ 'AGENTS.md': [], 'README.md': [] }).estado, 'ok')
})

test('un archivo con hallazgos FALTA, y nombra archivo y motivo', () => {
  const r = c.chequearDocsMuertos({
    'AGENTS.md': [{ fragmento: 'scripts/x.sh', porque: 'no existe ese archivo/carpeta' }],
  })
  assert.strictEqual(r.estado, 'falta')
  assert.ok(r.detalle[0].includes('AGENTS.md') && r.detalle[0].includes('scripts/x.sh'))
})

// --- paquetes ------------------------------------------------------------------------------------
test('paquetes al dia pasa', () => {
  assert.strictEqual(c.chequearPaquetes(221, 221).estado, 'ok')
})

// La regla queda en el core y la CONECTA cada derivado: la plantilla no sabe que lista genera
// cada proyecto (paquetes del sistema, un cliente de API, un lockfile).
test('una lista generada desactualizada FALTA, y dice como regenerarla', () => {
  const r = c.chequearPaquetes(222, 221)
  assert.strictEqual(r.estado, 'falta')
  assert.ok(r.detalle.some((d) => d.includes('regenera')))
})

// --- resumen -------------------------------------------------------------------------------------
test('el cierre esta completo solo si no falta nada; un aviso no lo frena', () => {
  const r = c.resumir([{ estado: 'ok' }, { estado: 'aviso' }, { estado: 'ok' }])
  assert.strictEqual(r.completo, true)
  assert.strictEqual(r.avisos, 1)
})

test('una sola falta deja el cierre incompleto', () => {
  assert.strictEqual(c.resumir([{ estado: 'ok' }, { estado: 'falta' }]).completo, false)
})

test('dias: sin dias con commits, no hay nada que reclamar', () => {
  assert.equal(c.chequearDiasSinEntrada([], []).estado, 'ok')
})

test('dias: cada dia con commits tiene su entrada -> ok', () => {
  const r = c.chequearDiasSinEntrada(
    [{ fecha: '2026-08-28', commits: 3 }, { fecha: '2026-08-29', commits: 5 }],
    ['2026-08-29', '2026-08-28'])
  assert.equal(r.estado, 'ok')
})

// El bug que justifica el chequeo: escribir la entrada de HOY no puede tapar el dia de ayer.
test('dias: un dia con commits y sin entrada FALLA aunque hoy si tenga la suya', () => {
  const r = c.chequearDiasSinEntrada(
    [{ fecha: '2026-08-28', commits: 17, muestra: 'harness: tres gates' }, { fecha: '2026-08-29', commits: 2 }],
    ['2026-08-29'])
  assert.equal(r.estado, 'falta')
  assert.match(r.titulo, /1 dia\/s con trabajo/)
  assert.ok(r.detalle.some((d) => d.includes('2026-08-28') && d.includes('17 commit')))
})

test('dias: la muestra del commit es opcional y no rompe el detalle', () => {
  const r = c.chequearDiasSinEntrada([{ fecha: '2026-08-27', commits: 1 }], [])
  assert.equal(r.estado, 'falta')
  assert.ok(!r.detalle[0].includes('undefined'))
})

// Las entradas viejas se mudan a work/progreso/<mes>.md: si no se las cuenta, cada mudanza
// inventaria un dia faltante.
test('dias: una entrada archivada cuenta igual que una de PROGRESO.md', () => {
  const r = c.chequearDiasSinEntrada(
    [{ fecha: '2026-08-16', commits: 4 }],
    ['2026-08-29', '2026-08-16'])
  assert.equal(r.estado, 'ok')
})
