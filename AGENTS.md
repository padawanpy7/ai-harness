# AGENTS.md

> Contrato de trabajo para agentes de IA. Manténlo **lean (~200, máx 500 líneas)**: contexto
> corto = menos ruido = mejores decisiones. El README es para humanos; esto es para agentes.
> Lo específico del proyecto va en `project.yml`. **Proyecto grande → dividí por feature**:
> un `AGENTS.md` por área, para no cargar todo de una.

## 1. Proyecto (completar)

- **Nombre**: {{PROJECT_NAME}}
- **Qué es**: {{ONE_LINER}}
- **Stack**: {{STACK}}
- **Comandos**: build `{{BUILD}}` · test `{{TEST}}` · run `{{RUN}}` · lint `{{LINT}}`
- **Detalle largo**: ver `project.yml` (no lo dupliques acá).

## 2. Reglas de oro

1. **El contexto es caro, los tokens también.** No leas archivos enteros si te alcanza un
   fragmento. **Output cavernícola** (ahorra 25-50%): ejecutá primero y explicá mínimo, sin
   preámbulo ni cierre, sin narrar tools; conclusión primero, oraciones cortas.
2. **Escribí resultados en archivos, no en el contexto.** Planes, hallazgos, decisiones →
   `work/<tarea>.md`. Lo que debe sobrevivir entre sesiones → `memory/MEMORY.md`.
3. **Verificá antes de declarar "listo".** Corré build + test + lint. Si algo falla,
   decilo con la salida. No afirmes que funciona si no lo viste funcionar.
4. **Hacé lo que se pidió, ni más ni menos.** Ante una decisión del dueño, preguntá; ante
   un default razonable, elegí y seguí.
5. **Buscá antes de escribir.** Entendé el código antes de tocarlo con
   `codebase-memory-mcp` (§7): una query al grafo reemplaza decenas de grep/read.
6. **Pocas herramientas, afiladas.** Un agente con 30 tools elige peor que uno con 8
   (lección de Vercel con su agente: la superficie de tools degrada el razonamiento). Cada
   rol carga **solo lo que necesita** (mirá su frontmatter). Las herramientas nicho van
   **diferidas** o en un subagente dedicado, no en el contexto de todos.
7. **Sin comentarios.** El código vive en un repo con historia; los comentarios son ruido
   que se desactualiza y miente. Nombres claros > comentarios. Única excepción: una línea
   que explique un *por qué* no obvio (un workaround raro). Nunca comentes el *qué*.
8. **Versiones: solo última estable, sin deprecados ni vulnerabilidades.** Antes de agregar
   un paquete, corré `scripts/check-dep.sh <eco> <pkg>` (§7). Fijá versiones (lockfile), no
   rangos abiertos. Al terminar una tarea, corré `scripts/check.sh`.
9. **Loop controlado, no "goal mode".** No "andá y hacé todo" en una cadena larga: la IA es
   probabilística y deriva. Trabajá en fases con compuertas (SDD) y revisión humana entre
   ellas. Spec primero, TDD al implementar. Ver skills `sdd` y `tdd`.

## 3. Roles de agente (dividir para conquistar)

Como un equipo real: especialistas por disciplina. Fullstack-por-una-persona tiene más
riesgo de fallos — un experto de BD normaliza e indexa mejor que un front, un backend sabe
servir y validar datos. Cada rol vive en `.claude/agents/`. Inspirado en el patrón
orquestador-trabajador de Anthropic y el loop auto-verificante (Ralph Wiggum).

| Rol | Para qué | Herramientas |
|---|---|---|
| **lead** | Entiende, descompone, **elige al especialista** y sintetiza. No codea. | lectura + planificación |
| **ui-designer** | UI/UX con **Claude Design** (loop con feedback humano + playbook). | diseño + escribir |
| **database** | Esquema: normalización, tipos, claves, índices, relaciones, migraciones. | escribir + SQL |
| **backend** | API: trae datos de la BD al front y **valida** lo que llega del front. | escribir |
| **implementer** | Glue y tareas sin especialista claro. | todas |
| **verifier** | Revisa adversarialmente: corre tests **y opera la app en el navegador**. | lectura + tests + navegador |

Cada especialista trabaja desde su **playbook** (`memory/playbooks/{ui,backend,db}.md`):
lo lee antes de empezar y lo actualiza con lo aprobado. Así el próximo proyecto arranca con
las mejores prácticas ya acumuladas, no de cero.

**Regla:** ningún cambio se da por bueno sin pasar por **verifier**. Si el verifier
rechaza, vuelve al implementer. Loop hasta verde (máx. N rondas, después escalá al humano).

**El verifier prueba en serio, no solo compila.** Para apps con UI, el verifier **opera la
app real en el navegador** (chrome-devtools MCP + Playwright): hace login, clickea, llena
formularios, mira la respuesta. Así se encuentran los bugs que el build no ve (errores de
red, datos que no aparecen, flujos rotos). Si hay backend/API, además prueba el endpoint.

## 4. Flujo de trabajo

```
1. lead        → SDD (skill sdd): proposal -> design -> tasks en openspec/changes/<id>/
2. >>> humano  → revisa el plan ANTES de codear (compuerta) <<<
3. lead        → manda cada sub-tarea al **especialista** que corresponde
                 (UI→ui-designer, esquema→database, API→backend, glue→implementer)
4. especialista→ lee su playbook, implementa con TDD (skill tdd), corre check.sh
5. verifier    → tests + app en navegador (+ judgment-day si es riesgoso); veredicto (OK/volver)
6. lead        → integra, archiva la spec, actualiza MEMORY.md y el playbook, reporta
```

- Sub-tareas independientes: lanzá especialistas **en paralelo**.
- Cada agente devuelve **datos/conclusión**, no relata el proceso.
- Lo que se decide y por qué → `memory/MEMORY.md` (una línea por hecho, ver §6).

### Modos: escalá la ceremonia a la tarea
La disciplina cuesta; aplicala según el riesgo/tamaño. El **lead elige el modo** al empezar.
- **quick** (fix trivial, 1 archivo, sin riesgo): sin SDD ni compuerta. El especialista lo
  hace (TDD si hay lógica), corre `check.sh`, el verifier mira. Reporte corto.
- **standard** (feature): SDD (proposal→design→tasks) + compuerta humana rápida + TDD +
  verifier en navegador. **Default.**
- **critical** (plata, datos, seguridad, decisiones con opciones): standard + `judgment-day`
  + revisión humana firme.

Ante la duda, subí un escalón, no bajes. Así lo trivial no paga ceremonia y lo riesgoso no
queda corto: la sobre-ingeniería y el overhead dejan de ser un problema.

## 5. Dónde vive cada cosa

| Carpeta | Qué |
|---|---|
| `AGENTS.md` | este contrato (cómo trabajamos). |
| `project.yml` | datos del proyecto (qué es, stack, comandos, convenciones, links). |
| `.claude/agents/` | definición de los roles (lead/implementer/verifier). |
| `work/` | salida de cada tarea: plan, hallazgos, veredictos. Efímero pero versionado. |
| `memory/MEMORY.md` | memoria persistente entre sesiones. Índice de hechos durables. |
| `memory/playbooks/` | best practices por disciplina (ui/backend/db/lead). Crecen con el uso. |
| `skills/` | skills cargadas por necesidad + `REGISTRY.md` (sdd, tdd, judgment-day). |
| `openspec/` | specs vivientes (`specs/`) y cambios (`changes/<id>/`) del flujo SDD. |
| `docs/` | docs externas convertidas a markdown (markitdown). |

## 6. Memoria (`memory/MEMORY.md`)

Una línea por hecho durable: decisión de diseño, gotcha, dato no obvio del proyecto.
NO guardes lo que el código/git ya dice. Formato:

```
- [titulo] (archivo/area) — el hecho en una linea. Por que importa.
```

Antes de guardar, revisá si ya existe algo parecido y actualizalo en vez de duplicar.

## 7. Herramientas (según el rol, no todas para todos)

**Base (siempre):** leer, editar, correr comandos (build/test/lint). Con esto se hace el
90% del trabajo. No agregues más sin necesidad real.

**Verificación (el verifier, las 3 obligatorias):** opera la app real, ahí aparecen los
bugs que el build no ve.
- **chrome-devtools MCP** — recorrer flujos a mano (login, clickear, formularios).
- **Playwright** — specs e2e deterministas (la regresión que el equipo cura, fija lo conocido).
- **TestSprite** (MCP) — genera y corre tests con IA: cobertura amplia + exploratorio,
  descubre casos que no pensaste. Necesita API key (testsprite.com). Setup en `init.sh`.

**Docs de librerías al día:** **Context7** — docs y APIs actualizadas de cada paquete (no
las que el modelo recuerda, que están viejas). Setup: `npx ctx7 setup --claude`. Usalo al
trabajar con una librería para no escribir contra una API deprecada.

**Docs externas:** **markitdown** (liviano) — convierte PDF/Word/Excel/PPT/imágenes a
markdown: `markitdown entrada.pdf > docs/entrada.md`. El agente lee el `.md`, no el binario.

**Scripts del harness** (`scripts/`):
- `check-dep.sh <npm|pypi|nuget> <pkg>` — última estable + deprecación + vulns (OSV). Antes
  de agregar cualquier paquete.
- `check.sh` — el implementer lo corre **al terminar** cada tarea: format, lint, build,
  secretos (gitleaks), audit de deps. No atado a ningún commit.
- `doctor.sh` — audita la salud del harness (placeholders sin llenar, registry desincronizado,
  playbooks vacíos/viejos). Corrélo cada tanto para que los docs no se pudran.
- `adopt.sh` — autodetecta stack/comandos de un proyecto existente (skill `adopt`).
- `strip-comments.sh [--check|--write] <dir>` — quita comentarios con AST (.py tokenize,
  .ts/.tsx compilador TS), preservando docstrings/strings/regex/directivas (skill `migrate`).
- `skill-sync.sh` — regenera `skills/REGISTRY.md`.

**Entender el código (obligatorio):** **codebase-memory-mcp** — grafo del código (símbolos,
llamadas, impacto, rutas HTTP), 120x menos tokens que grep/read masivo. Es la forma
**por defecto** de explorar antes de tocar. Trae 14 tools, pero **no satura**: Claude Code
las deja **diferidas** (no entran en el contexto de cada turno; el agente busca la que
necesita y recién ahí carga su schema). Mandatory + deferred = código entendido sin
inflar la superficie de tools (Regla 6). Lo instala `init.sh`.

**Skills** (`skills/`): conocimiento que se carga **por necesidad**, no siempre. Índice en
`skills/REGISTRY.md` (lo regenera `scripts/skill-sync.sh`). Base: `sdd` (loop controlado),
`tdd` (test primero), `judgment-day` (dos jueces + orquestador para lo riesgoso). Agregá las
tuyas como `skills/<nombre>.md` con frontmatter `name:` y `when:`.

**Multi-model** (ahorra 50-70%): el modelo justo por fase. Barato (Sonnet/Codex/Gemini) para
implementar/boilerplate; fuerte (Opus) para diseño, juicio y el lead. Está en el `model:` de
cada rol.

**Memoria entre sesiones/agentes:** `memory/MEMORY.md` + playbooks. Para memoria compartida
más rica entre sesiones y compañeros, **Engram** (MCP) es una buena opción.

## 8. Convenciones del proyecto

- {{CONVENTION_1}}  (ej: ASCII en código; sin comentarios; estilo de commits…)
- {{CONVENTION_2}}
- Mirá `project.yml` → `conventions` para la lista completa.

## 9. Seguridad (guardrails, no opcional)

- **Secretos:** nunca en código ni en git. Van en `.env` (fuera de git). `check.sh` escanea
  con gitleaks; si salta, parás.
- **Infra mínima:** least privilege. Nada publica puertos al host salvo el proxy/gateway;
  los servicios hablan por red interna. Sin credenciales por defecto. Rotá si se filtró.
- **Dependencias:** solo las que necesitás, en su última estable, sin deprecados ni vulns
  (Regla 8 + `check-dep.sh`). Auditá el árbol cada tanto (`check.sh` lo hace).
- **Entradas no confiables:** validá/sanitizá. No ejecutes ni interpoles input crudo.

## 10. Antes de cerrar una tarea (checklist del verifier)

- [ ] build OK · [ ] test OK · [ ] lint OK
- [ ] **probado en el navegador** (chrome/Playwright) el flujo real, si hay UI
- [ ] endpoint/API probado con datos reales, si hay backend
- [ ] hace exactamente lo pedido (ni de más ni de menos)
- [ ] `work/<tarea>.md` actualizado con lo hecho y cómo se verificó
- [ ] `memory/MEMORY.md` actualizado si surgió algo durable
- [ ] reporte al humano: qué cambió, cómo se probó, qué quedó pendiente
