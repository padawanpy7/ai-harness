const { test } = require('node:test')
const assert = require('node:assert')
const r = require('./roles-registro')

const FRONTMATTER = `---
name: backend
description: Especialista de backend/API. Toma los datos de la BD y los expone al front. Disena endpoints y contratos.
tools: Read, Grep, Glob, Edit, Write, Bash
model: opus
---

Cuerpo del rol, no se usa aca.
`

test('parsearRol saca name/description/tools del frontmatter', () => {
  const rol = r.parsearRol('backend.md', FRONTMATTER)
  assert.strictEqual(rol.nombre, 'backend')
  assert.strictEqual(rol.descripcion, 'Especialista de backend/API. Toma los datos de la BD y los expone al front. Disena endpoints y contratos.')
  assert.strictEqual(rol.tools, 'Read, Grep, Glob, Edit, Write, Bash')
})

test('parsearRol cae al nombre del archivo si falta el campo name', () => {
  const sinName = '---\ndescription: algo\ntools: Read\n---\n'
  const rol = r.parsearRol('implementer.md', sinName)
  assert.strictEqual(rol.nombre, 'implementer')
})

test('roles ordena alfabeticamente por nombre', () => {
  const archivos = [
    { nombre: 'verifier.md', texto: '---\nname: verifier\ndescription: revisa\ntools: Read\n---\n' },
    { nombre: 'backend.md', texto: FRONTMATTER },
  ]
  const lista = r.roles(archivos)
  assert.deepEqual(lista.map((x) => x.nombre), ['backend', 'verifier'])
})

test('playbooks saca el .md y ordena', () => {
  assert.deepEqual(r.playbooks(['kove.md', 'db.md', 'apex.md']), ['apex', 'db', 'kove'])
})

test('resumir corta en la primera oracion cuando alcanza', () => {
  assert.strictEqual(r.resumir('Especialista de backend/API.'), 'Especialista de backend/API.')
})

test('resumir suma la segunda oracion si entra en el limite', () => {
  const d = 'Especialista de base de datos. Disena el esquema completo.'
  assert.strictEqual(r.resumir(d, 200), d)
})

test('resumir trunca con puntos suspensivos si se pasa del limite', () => {
  const largo = 'Especialista de backend/API. ' + 'x'.repeat(200)
  const res = r.resumir(largo, 50)
  assert.ok(res.length <= 50)
  assert.ok(res.endsWith('...'))
})
