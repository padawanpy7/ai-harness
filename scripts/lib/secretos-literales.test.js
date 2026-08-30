const { test } = require('node:test')
const assert = require('node:assert')
const { hallazgos, EXTENSIONES } = require('./secretos-literales')

test('un valor literal de largo real bajo una clave PASS se marca', () => {
  const contenido = '{\n  "PASS": "AB12cd34EF56gh78IJ90kl12"\n}\n'
  const r = hallazgos([{ ruta: 'API-EXTRACTO-PROD.postman_environment.json', contenido }])
  assert.deepEqual(r, [{ archivo: 'API-EXTRACTO-PROD.postman_environment.json', linea: 2, clave: 'PASS' }])
})

test('una plantilla {{token}} no se marca', () => {
  const contenido = '{\n  "token": "{{token}}"\n}\n'
  const r = hallazgos([{ ruta: 'coleccion.postman_collection.json', contenido }])
  assert.deepEqual(r, [])
})

test('un valor vacio no se marca', () => {
  const contenido = '{\n  "password": ""\n}\n'
  assert.deepEqual(hallazgos([{ ruta: 'x.json', contenido }]), [])
})

test('un valor corto (tipo codigo de ticket) no se marca', () => {
  const contenido = '{\n  "clave": "ICC-18"\n}\n'
  assert.deepEqual(hallazgos([{ ruta: 'x.json', contenido }]), [])
})

test('formato KEY=valor (.env) tambien se marca', () => {
  const contenido = 'LDAP_USUARIO=imdx\nAPEX_PASSWORD=Sup3rSecreta123\n'
  const r = hallazgos([{ ruta: '.env', contenido }])
  assert.deepEqual(r, [{ archivo: '.env', linea: 2, clave: 'APEX_PASSWORD' }])
})

test('KEY= vacio (.env.example) no se marca', () => {
  const contenido = 'LDAP_CONTRASENA=\nAPEX_PASSWORD=\n'
  assert.deepEqual(hallazgos([{ ruta: '.env.example', contenido }]), [])
})

test('un objeto client_secret largo se marca', () => {
  const contenido = '{"client_secret": "n8Fk29xLp0Qz71Rm4Tv6"}'
  const r = hallazgos([{ ruta: 'oauth.json', contenido }])
  assert.deepEqual(r, [{ archivo: 'oauth.json', linea: 1, clave: 'client_secret' }])
})

test('camelCase apiKey largo se marca', () => {
  const contenido = '{"apiKey": "n8Fk29xLp0Qz71Rm4Tv6"}'
  const r = hallazgos([{ ruta: 'config.json', contenido }])
  assert.deepEqual(r, [{ archivo: 'config.json', linea: 1, clave: 'apiKey' }])
})

test('una clave que no es sensible no se marca aunque el valor sea largo', () => {
  const contenido = '{"nombre": "Un texto cualquiera bastante largo"}'
  assert.deepEqual(hallazgos([{ ruta: 'x.json', contenido }]), [])
})

test('EXTENSIONES incluye json, env, yml/yaml, properties, ini, cfg, conf', () => {
  for (const e of ['.json', '.env', '.yml', '.yaml', '.properties', '.ini', '.cfg', '.conf']) {
    assert.ok(EXTENSIONES.includes(e), `falta ${e}`)
  }
})

test('formato Postman ("key": "PASS", "value": "...") tambien se marca (el incidente real)', () => {
  const contenido = [
    '{',
    '  "values": [',
    '    { "key": "USER", "value": "svc_extracto" },',
    '    {',
    '      "key": "PASS",',
    '      "value": "Zx9qLm2Vt7Rp4Ns8Wj1Kd3Yf",',
    '      "type": "default"',
    '    }',
    '  ]',
    '}',
  ].join('\n')
  const r = hallazgos([{ ruta: 'API-EXTRACTO-PROD.postman_environment.json', contenido }])
  assert.deepEqual(r, [{ archivo: 'API-EXTRACTO-PROD.postman_environment.json', linea: 6, clave: 'PASS' }])
})

test('formato Postman con "value" en plantilla {{token}} no se marca', () => {
  const contenido = [
    '{ "key": "token", "value": "{{token}}" }',
  ].join('\n')
  assert.deepEqual(hallazgos([{ ruta: 'coleccion.postman_collection.json', contenido }]), [])
})

test('formato Postman con "key" no sensible (USER) no se marca aunque el valor sea largo', () => {
  const contenido = '{ "key": "USER", "value": "un_usuario_bastante_largo" }'
  assert.deepEqual(hallazgos([{ ruta: 'x.json', contenido }]), [])
})

test('el "key"/"value" de un header no relacionado (name distinto) no cruza entradas', () => {
  const contenido = [
    '{ "key": "USER", "value": "corta" },',
    '{ "key": "extracto_CC", "value": "colocar_cuenta_bastante_larga" },',
    '{ "key": "PASS" },',
  ].join('\n')
  assert.deepEqual(hallazgos([{ ruta: 'x.json', contenido }]), [])
})

test('junta hallazgos de varios archivos', () => {
  const archivos = [
    { ruta: 'a.json', contenido: '{"PASS": "AB12cd34EF56gh78IJ90kl12"}' },
    { ruta: 'b.json', contenido: '{"token": "{{token}}"}' },
  ]
  assert.strictEqual(hallazgos(archivos).length, 1)
})
