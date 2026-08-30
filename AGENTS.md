# AGENTS.md

> Contrato de trabajo para agentes de IA. Mantenlo **lean (~200, máx 500 líneas)**: contexto
> corto = menos ruido = mejores decisiones. El README es para humanos; esto es para agentes.
> Lo específico del proyecto va en `project.yml`. **Proyecto grande -> dividí por feature**:
> un `AGENTS.md` por área, para no cargar todo de una.

## 1. Proyecto (completar)

- **Nombre**: {{PROJECT_NAME}} - {{ONE_LINER}}
- **Stack**: {{STACK}}
- **Comandos**: build `{{BUILD}}` - test `{{TEST}}` - run `{{RUN}}` - lint `{{LINT}}`
- **Detalle largo**: ver `project.yml` (no lo dupliques acá).

## 2. Reglas de oro

1. **El contexto es caro, los tokens también.** No leas archivos enteros si te alcanza un
   fragmento. **Output cavernícola** (ahorra 25-50%): ejecuta primero y explica mínimo, sin
   preámbulo ni cierre, sin narrar tools; conclusión primero, oraciones cortas.
2. **Escribe resultados en archivos, no en el contexto.** Planes, hallazgos y decisiones ->
   `work/<tarea>.md`. Lo que debe sobrevivir entre sesiones -> `memory/hechos/` (S6).
3. **Verifica antes de declarar "listo".** Corre build + test + lint. Si algo falla,
   dilo con la salida. No afirmes que funciona si no lo viste funcionar.
4. **Haz lo que se pidió, ni más ni menos.** Ante una decisión del dueño, pregunta; ante
   un default razonable, elegí y sigue.
5. **Busca antes de escribir.** Entiende el codigo antes de tocarlo: una query al grafo
   (`docs/herramientas.md`) reemplaza decenas de grep/read.
6. **Pocas herramientas, afiladas.** Un agente con 30 tools elige peor que uno con 8: la
   superficie de tools degrada el razonamiento. Cada rol carga solo lo suyo; las nicho van
   diferidas o en un subagente, no en el contexto de todos.
7. **Sin comentarios de relleno.** Nombres claros > comentarios. La excepcion es el *por que*
   no obvio -un workaround raro, el motivo de un orden-: eso SI se escribe, porque en seis meses
   nadie lo recuerda. Nunca comentes el *que*.
8. **Versiones: solo ultima estable, sin deprecados ni vulnerabilidades.** Antes de sumar un
   paquete, `node harness.js check-dep <eco> <pkg>`. Fija versiones (lockfile), no rangos
   abiertos. Al terminar una tarea, `node harness.js check`.
9. **Loop controlado, no "goal mode".** No "anda y haz todo" en una cadena larga: la IA es
   probabilística y deriva. Trabaja en fases con compuertas (SDD) y revisión humana entre
   ellas. Spec primero, TDD al implementar. Ver skills `sdd` y `tdd`.
10. **Desmonta andamiaje viejo.** Cada pieza del harness codifica algo que el modelo no podia
    solo, y esos supuestos caducan. Sacala, mira si el resultado empeora y conserva solo lo que
    carga peso. Al salir un modelo nuevo, revisa apuntando a MENOS scaffolding.

## 3. Roles de agente (dividir para conquistar)

Como un equipo real: especialistas por disciplina, porque un experto de BD normaliza e indexa
mejor que un front. Cada rol vive en `.claude/agents/`.

| Rol | Para qué | Herramientas |
|---|---|---|
| **lead** | Entiende, descompone, **elige al especialista** y sintetiza. No codea. | lectura + planificación |
| **ui-designer** | UI/UX con **Claude Design** (loop con feedback humano + playbook). | diseño + escribir |
| **database** | Esquema: normalización, tipos, claves, índices, relaciones, migraciones. | escribir + SQL |
| **backend** | API: trae datos de la BD al front y **valida** lo que llega del front. | escribir |
| **implementer** | Glue y tareas sin especialista claro. | todas |
| **verifier** | Revisa adversarialmente: corre tests **y opera la app en el navegador**. | lectura + tests + navegador |

Cada especialista trabaja desde su **playbook** (`memory/playbooks/`): lo lee antes de empezar y
lo actualiza con lo aprendido, para que el proximo proyecto no arranque de cero.

**Regla:** ningún cambio se da por bueno sin pasar por **verifier**. Si el verifier
rechaza, vuelve al implementer. Loop hasta verde (máx. N rondas, después escala al humano).

**El verifier prueba en serio, no solo compila.** En apps con UI opera la app real en el navegador
-login, pulsar, llenar formularios, mirar la respuesta-, que es donde aparecen los bugs que el
build no ve: errores de red, datos que no llegan, flujos rotos. Si hay API, prueba el endpoint.

## 4. Flujo de trabajo

```
1. lead        -> SDD (skill sdd): proposal -> design -> tasks en openspec/changes/<id>/
2. >>> humano  -> revisa el plan ANTES de codear (compuerta) <<<
3. lead        -> manda cada sub-tarea al **especialista** que corresponde
                 (UI->ui-designer, esquema->database, API->backend, glue->implementer)
4. especialista-> lee su playbook, implementa con TDD (skill tdd), corre node harness.js check
4b. LIVE GATE  -> lo SERVIDO tiene que ser el working tree antes de verificar. Con hot reload el
                 cambio se sirve solo; deps, Dockerfile o schema piden rebuild. Probar una imagen
                 vieja es gastar tokens en un bug que ya no existe.
5. verifier    -> freshness gate + tests + app en navegador (+ judgment-day si es riesgoso)
6. lead        -> integra, archiva la spec, node harness.js cierre, y reporta
```

- Sub-tareas independientes: lanza especialistas **en paralelo**. Cada agente devuelve datos y
  conclusion, no relata el proceso. Lo que se decide y por que -> `memory/hechos/` (S6).

### Como cierra el lead cada tanda (formato obligatorio)

El cuerpo es prosa; al final, SIEMPRE estos bloques, legibles sin leer el resto. Sin ellos el
dueño tiene que releer todo para saber si le preguntaron algo o que decidiste solo.

```
## Decisiones            (defaults que tomé sin preguntar; si no decís nada, quedan)
- <qué decidí> - <el default y por qué, media línea>

## Preguntas            ("ninguna" si no hay; nunca omitas el bloque)
1. [bloquea | no bloquea] <la pregunta>. Default: <lo que hago salvo aviso>.

## Proximas tareas       (cabos DE ESTA TANDA, en dos subgrupos)
### Tareas tuyas
- <lo que depende del dueño>
### Tareas IA
- <lo que hago yo (agente)>
Build: `scripts/harness/features.sh` (N/M)   <- puntero al estado global, NO re-listar el ledger
```

Reglas: **Decisiones** son los defaults que tomaste solo, listados para que el dueño pueda
revertir -silencio = quedan-. **Preguntas** es solo lo que necesita una decision del dueño
(producto, riesgo, plata, autorizacion), cada una marcada [bloquea] o [no bloquea]; ante un default
razonable no preguntes, decidi y ponelo en Decisiones. **Proximas tareas** son los cabos de ESTA
tanda en dos subgrupos -tuyas / IA-, no el ledger: cerra con un puntero de una linea. Lo que deba
sobrevivir la sesion va a `work/PROGRESO.md`. Los bloques van al final, despues de la prosa.

### Modos: escala la ceremonia a la tarea
La disciplina cuesta; aplicala según el riesgo/tamaño. El **lead elige el modo** al empezar.
- **quick** (fix trivial, 1 archivo, sin riesgo): sin SDD ni compuerta. El especialista lo
  hace (TDD si hay lógica), corre `check.sh`, el verifier mira. Reporte corto.
- **standard** (feature): SDD (proposal->design->tasks) + compuerta humana rápida + TDD +
  verifier en navegador. **Default.**
- **critical** (plata, datos, seguridad, decisiones con opciones): standard + `judgment-day`
  + revisión humana firme.

Ante la duda, subí un escalón, no bajes. Así lo trivial no paga ceremonia y lo riesgoso no
queda corto: la sobre-ingeniería y el overhead dejan de ser un problema.

### Ramas y worktrees (trabajo aislado y en paralelo)

- **Una tarea = una rama**, siempre **desde `main`** (no derivar una tarea de otra). El merge a
  `main` declara la tarea terminada; commit + push inicial para respaldar antes de tocar nada.
- **Dos tareas a la vez** -> `git worktree` persistente hermano (comparte el `.git`; no dupliques el
  repo con un `clone`). Al crearlo, llevá lo gitignoreado que las tools necesitan: `.env` y
  `node_modules` (symlink al del worktree principal). `../tools` y repos hermanos resuelven solos si
  el worktree es hermano.
- **Promover tooling a `main` o crear una rama sin tocar el árbol activo** (que puede tener trabajo
  sin commitear) -> worktree **temporal**: `git worktree add ../wt <rama>`, editás/commiteás/pusheás
  ahí, `git worktree remove ../wt`. La rama y sus commits persisten; el árbol activo no se toca.
- Cerrá el worktree cuando termines (`git worktree remove`); se auto-limpia si no cambió nada.

### Protocolo de sesion y progreso (builds largos multi-sesion)

El estado durable vive en ARCHIVOS, no en la sesion: un agente nuevo retoma leyendolos, sin
necesitar el chat vivo. Trabaja **una feature a la vez**, nunca "todo de una".

**Al arrancar** (el lead): `git log -5`, leer `work/PROGRESO.md` y `memory/MEMORY.md`, correr
`node harness.js features` para elegir la de mayor prioridad INCOMPLETA, y `scripts/smoke.sh` para
confirmar que la app vive. Si el smoke falla, se arregla el entorno antes de empezar.

**Al cerrar cada feature:** el verifier la prueba E2E y recien ahi marca `passes: true`. Commit a
`main` por feature (politica de builds largos; el default del harness -commitear solo cuando el
dueño lo pide- queda para proyectos chicos). Se actualiza `work/PROGRESO.md` y, si algo durable
aparecio, `memory/hechos/`. El repo queda main-ready. La compuerta es `node harness.js cierre`.

**`FEATURES.json` = ledger del build**: evita declarar victoria antes de tiempo y permite retomar
sin el chat. Cada feature con `id`, categoria, descripcion, `pasos` de verificacion y `passes`,
todo arrancando en `false`. El implementer y el verifier SOLO cambian `passes`: nunca borran ni
editan descripcion o pasos, porque el ledger es el contrato de "que falta". El SDD
(`openspec/changes/<id>/`) es el diseño de cada cambio; el ledger es el estado global.

## 5. Dónde vive cada cosa

| Carpeta | Qué |
|---|---|
| `AGENTS.md` | este contrato (cómo trabajamos). |
| `project.yml` | datos del proyecto (qué es, stack, comandos, convenciones, links). |
| `.claude/agents/` | definición de los roles (lead/implementer/verifier). |
| `work/` | salida de cada tarea: plan, hallazgos, veredictos. Efimero y NO versionado (`.gitignore`); solo `work/PROGRESO.md` se versiona. |
| `memory/hechos/` | un hecho durable por archivo; `memory/MEMORY.md` es solo el indice. |
| `memory/playbooks/` | best practices por disciplina (ui/backend/db/lead). Crecen con el uso. |
| `skills/` | skills cargadas por necesidad + `REGISTRY.md` (sdd, tdd, judgment-day). |
| `openspec/` | specs vivientes (`specs/`) y cambios (`changes/<id>/`) del flujo SDD. |
| `docs/` | docs externas convertidas a markdown (markitdown). |
| `scripts/` | las herramientas, agrupadas por uso (`calidad/`, `harness/`, `docs/`, `lib/`). Ver `scripts/README.md`. |
| `metrics/` | costo por tarea (`node harness.js metricas`) y contador de uso. Salida, no fuente. |

## 6. Memoria (`memory/hechos/`, indexada en `memory/MEMORY.md`)

Un hecho durable (decision de diseño, gotcha, dato no obvio del proyecto) por archivo en
`memory/hechos/<slug>.md`, con frontmatter `name`, `description`, `type` (decision/gotcha/
referencia) y `area`. `memory/MEMORY.md` es solo el INDICE: una linea con link + gancho por
hecho, sin contenido. NO guardes lo que el codigo o `git log` ya responden.

Enlaza hechos relacionados con `[[nombre-del-hecho]]` (sin `.md`). Lo que mas vale son los
**gotchas**: lo que hace perder horas persiguiendo la causa equivocada.

Antes de guardar, revisa si ya existe un hecho parecido y actualizalo en vez de duplicar.
`node harness.js check` bloquea si el frontmatter, los links del indice o los `[[wikilinks]]`
quedan inconsistentes; `doctor` da el mismo diagnostico sin bloquear.

## 7. Herramientas (según el rol, no todas para todos)

**Base (siempre):** leer, editar, correr comandos (build/test/lint): con eso se hace el 90%.

**Herramientas externas** (verificacion en navegador, docs de librerias al dia, grafo de codigo,
conversion de PDF/Word a markdown): el catalogo con el cuando y el por que de cada una vive en
`docs/herramientas.md`. Aca solo el criterio: se suma una cuando hay necesidad real, no por si
acaso; un agente con 30 tools elige peor que uno con 8.

**Puerta de entrada:** `node harness.js <tool> [argumentos]`, desde la raiz. Sin argumentos lista
las tools por area; `node harness.js <tool> --help` da la ayuda de cada una. Despacha a `.js` y a
`.sh`, y registra uso y duracion en `metrics/`.

**La compuerta es `node harness.js check`**: tests, presupuesto, ascii, ortografia, estructura del
harness y secretos, en paralelo. Sale != 0 si alguno falla, que es lo que la vuelve compuerta y no
un chequeo opcional. Sueltas: `test`, `spell`, `ascii`, `presupuesto` (tope Y crecimiento de los
documentos de arranque), `doctor` (informativo), `check-dep` (antes de sumar una dependencia).

**Del harness:** `cierre` (la compuerta del cierre de sesion), `control-negativo` (rompe cada
compuerta a proposito y exige rojo: un gate verde no prueba que mire, prueba que no encontro nada),
`metricas`, `tool-usage`, `buscar` (que dijimos sobre esto, sin abrir un archivo), `features` (el
ledger) y `skill-sync`. Sueltos, en bash: `adopt.sh`, `strip-comments.sh`, `smoke.sh`.

**El por que de todo esto** -que el harness es un LOOP, no una lista de pasos- vive en
`docs/el-loop-del-harness.md`: no hace falta para ejecutar, si para diseñar uno nuevo.

**Skills** (`skills/`): conocimiento que se carga **por necesidad**, no siempre. Índice en
`skills/REGISTRY.md` (lo regenera `node harness.js skill-sync`). Base: `sdd` (loop controlado),
`tdd` (test primero), `judgment-day` (dos jueces + orquestador para lo riesgoso). Agregá las
tuyas como `skills/<nombre>.md` con frontmatter `name:` y `when:`.

**Multi-model** (ahorra 50-70%): el modelo justo por fase -barato para implementar, fuerte para
diseño y juicio-. Esta en el `model:` de cada rol.

## 8. Convenciones del proyecto

- **Si el round-trip de una herramienta borra "quien lo toco", deja la autoria adentro del
  artefacto.** Pasa con low-code y con config generada: exportar y reimportar pisa el metadato.
  Usa el campo de comentario propio del componente cuando exista; el comentario inline es el
  ultimo recurso.
- {{CONVENTION_1}}  (ej: ASCII en código; sin comentarios; estilo de commits...)
- {{CONVENTION_2}}
- Mira `project.yml` -> `conventions` para la lista completa.

## 9. Seguridad (guardrails, no opcional)

- **Secretos:** nunca en codigo ni en git. Van en `.env`, fuera de git. `node harness.js check`
  escanea con gitleaks y no es opcional: si salta, paras.
- **Infra mínima:** least privilege. Nada publica puertos al host salvo el proxy/gateway;
  los servicios hablan por red interna. Sin credenciales por defecto. Rotá si se filtró.
- **Dependencias:** solo las necesarias, en su ultima estable, sin deprecados ni vulns
  (Regla 8 + `node harness.js check-dep`).
- **Entradas no confiables:** valida/sanitizá. No ejecutes ni interpoles input crudo.

## 10. Antes de cerrar una tarea (checklist del verifier)

- [ ] build, test y lint OK; el flujo real probado en el navegador si hay UI
- [ ] endpoint/API probado con datos reales, si hay backend
- [ ] hace exactamente lo pedido (ni de más ni de menos)
- [ ] `work/<tarea>.md` actualizado con lo hecho y cómo se verificó
- [ ] `memory/hechos/` actualizado si surgio algo durable
- [ ] reporte al humano: qué cambió, cómo se probó, qué quedó pendiente
