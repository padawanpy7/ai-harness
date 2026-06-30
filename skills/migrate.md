---
name: migrate
when: llevar un proyecto YA en marcha al harness (con limpieza), sin romperlo ni romper a los vecinos
---

# Skill: Migrate (adoptar + limpiar un proyecto vivo)

Para un `/opt/` con varios proyectos que comparten infra (proxy, redes). Adoptar el harness
es una **migración**: limpiar y documentar **sin cambiar el comportamiento**.

## Reglas de oro (no romper)
- **Un proyecto por vez.** Nunca migres dos a la vez.
- **No toques la infra compartida** durante la migración de un proyecto: nginx, redes Docker,
  compose de OTROS proyectos. Solo el directorio del proyecto.
- **Baseline + verify**: el proyecto debe andar **igual** antes y después. La limpieza es
  neutral al comportamiento; si el e2e cambia, **rollback**.
- **No actualices dependencias en la migración** (es otro cambio, con su riesgo). Solo
  marcalas con `check-dep.sh`.

## Estructura multi-proyecto (cómo no se rompen entre sí)
- **Un harness por proyecto** (`/opt/<proj>/`: su AGENTS.md, project.yml, playbooks, openspec).
  Aislado: el agente que trabaja en `<proj>` lee SU harness y gobierna SOLO ese dir.
- **Un AGENTS.md raíz** en `/opt/` que es un **índice**: reglas de la infra compartida (redes,
  "nada publica puertos salvo nginx", cómo se deploya cada uno) + links a cada harness. (El
  `/opt/CLAUDE.md` actual ya es eso: migralo a ese índice.)
- codebase-memory indexa por proyecto, no todo `/opt/` junto.

## Pasos por proyecto (modo critical)
1. **Baseline**: build OK + el verifier **opera la app en el navegador** y confirma que anda.
   Commit del estado actual = punto de **rollback**.
2. **Setup de tools + indexar**: copiá `init.sh` al proyecto y corrélo (`./init.sh`) - instala
   y configura codebase-memory, markitdown y los MCP, y crea `.mcp.json`. **Sin esto,
   codebase-memory NO queda cargado.** Después codebase-memory indexa el proyecto.
3. **Adopt** (skill `adopt`): llená AGENTS.md/project.yml/playbooks/specs desde el código real.
4. **Migrar docs**: el contenido útil del viejo `CLAUDE.md` -> AGENTS.md/project.yml/playbooks.
   `CLAUDE.md` queda como puntero a AGENTS.md. El README se **refresca** (es para humanos), no
   se tira su contenido útil.
5. **Limpiar comentarios**: `scripts/strip-comments.sh --write <dir>` (AST, no regex):
   `.py` con tokenize, `.ts/.tsx` con el compilador TS. Preserva docstrings, strings, regex,
   JSX y directivas (noqa/type:/@ts-ignore/eslint-disable/prettier-ignore). Para `.cs`, stripper
   Roslyn AST aparte. **Lección: el scanner lineal de TS se desincroniza en JSX/templates -> hay
   que usar el AST** (createSourceFile + comment ranges + JsxExpression vacios `{/* */}`). En
   lotes; **después de cada lote**: format+lint del proyecto + `tsc --noEmit` (mismo nº de
   errores que antes = sin daño) + tests. NO toques JSON de contracts, configs ni licencias.
6. **Checks**: `check.sh` (lint/format/secretos/audit). `check-dep.sh` por paquete deprecado o
   vulnerable -> anotalo, no lo cambies ahora.
7. **Verify**: build + e2e en navegador. Debe comportarse **igual** que el baseline. Si difiere,
   rollback.
8. **Commit del proyecto, aislado.** Recién ahí pasás al siguiente.

## Orden
El proyecto menos acoplado primero (para calibrar el flujo). La **infra compartida al final**,
como su propio "proyecto" (el AGENTS.md raíz). Entre proyecto y proyecto, `doctor.sh`.
