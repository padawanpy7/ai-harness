---
name: adopt
when: incorporar el harness a un proyecto YA existente (brownfield)
---

# Skill: Adopt (brownfield onboarding)

"Revisa el proyecto y completa el harness para seguir el desarrollo." El harness se llena
desde el código que YA existe, no desde cero. Lo hace el rol **lead**.

## Pasos
1. **Stack y comandos**: corre `scripts/adopt.sh` - autodetecta lenguaje/framework/db e
   build/test/lint/run desde package.json / pyproject / *.csproj / go.mod / compose y los
   escribe en `project.yml`. Completa lo que falte leyendo el README.
2. **Convenciones**: leé `.eslintrc`/`.prettierrc`/`.editorconfig`, el estilo del código y los
   commits. Anótalas en `project.yml` -> `conventions` (ej: ASCII, sin comentarios, naming).
3. **Carga los playbooks desde lo que VES** (usá codebase-memory para mapear):
   - `ui.md`: sistema de diseño real (tokens CSS, librería de componentes, reglas eslint) y
     los patrones de pantalla que se repiten.
   - `backend.md`: forma de los endpoints, formato de error, auth, validación, gotchas.
   - `db.md`: esquema (de migraciones/models), tenancy, índices, constraints.
   - `lead.md`: cómo se despliega, cómo se prueba, gotchas del proyecto.
4. **Specs vivientes**: reverse-reconstruye las capabilities actuales a
   `openspec/specs/<cap>/spec.md` (Purpose + Requirements SHALL + Scenarios) describiendo lo
   que el sistema YA hace. Empieza por las 3-5 capabilities centrales, no todo de una.
5. **AGENTS.md**: completa secciones 1 y 8 (proyecto + convenciones). Mantenlo lean.
6. **Tools**: corre `./init.sh` - instala/configura codebase-memory, markitdown y los MCP, y
   crea `.mcp.json`. Sin esto el harness queda documentado pero **sin codebase-memory cargado**.
7. **Entrega**: corre `scripts/doctor.sh` (debe quedar sano) y pásale al humano un resumen de
   lo que detectaste para que valide antes de seguir el desarrollo.

Reglas: documenta lo que el código dice HOY, no lo ideal. Si algo está mal en el proyecto,
anótalo como gotcha en el playbook (no lo maquilles). No reescribas el proyecto: lo adoptas.
