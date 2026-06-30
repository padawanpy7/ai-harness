# ai-harness

Un **harness** mínimo y reutilizable para trabajar con agentes de IA en cualquier proyecto.
La idea: clonás esto, completás 2 archivos, y arrancás con un **equipo de agentes
especialistas** (lead, ui-designer, database, backend, implementer, verifier) en vez de un
solo agente haciendo todo y yéndose de las manos. Cada especialista acumula best practices
en su playbook, así el próximo proyecto arranca mejor.

## ¿Qué es un harness?

El "código" alrededor del modelo: las reglas, la memoria, los roles, las herramientas y el
loop de verificación que hacen que un agente trabaje bien y de forma repetible. El modelo
es el motor; el harness es el chasis, la dirección y los frenos.

## Qué trae

```
AGENTS.md            Contrato de trabajo (<200 lineas). Como trabajamos. Portable.
CLAUDE.md            Puntero a AGENTS.md (para que Claude Code lo lea).
project.yml          Datos del proyecto: stack, comandos, convenciones. LO COMPLETAS VOS.
init.sh              Instala las herramientas y prepara las carpetas.
.claude/agents/      Roles especialistas: lead, ui-designer, database, backend, implementer, verifier.
memory/MEMORY.md     Memoria persistente entre sesiones (una linea por hecho durable).
memory/playbooks/    Best practices por disciplina (ui/backend/db) que se acumulan con el uso.
work/                Salida de cada tarea: plan, hallazgos, veredictos.
docs/                Docs externas convertidas a markdown (markitdown).
scripts/check-dep.sh Verifica ultima version estable + deprecacion + vulns antes de agregar un paquete.
scripts/check.sh     El implementer lo corre al terminar: format, lint, build, secretos, audit.
.mcp.json            Servidores MCP (markitdown).
```

## Cómo usarlo en un proyecto nuevo

```bash
# 1. Traé el harness a tu repo
git clone https://github.com/TU_USUARIO/ai-harness.git   # o copialo dentro del repo

# 2. Instalá las herramientas + prepará carpetas
./init.sh

# 3. Completá project.yml (nombre, stack, comandos, convenciones)
#    y reemplazá los {{PLACEHOLDERS}} de AGENTS.md (secciones 1 y 8).

# 4. Abrí el repo con tu agente (Claude Code) y pedile que arranque por el rol 'lead'.
```

## El flujo en una imagen

```
            ┌─────────┐   plan + sub-tareas    ┌──────────────┐
  pedido →  │  LEAD   │ ─────────────────────→ │ IMPLEMENTER  │  codea, build+lint OK
            │ planea  │ ←───── integra ─────── │  (x N en ∥)  │
            └─────────┘        veredicto OK     └──────┬───────┘
                 ↑                                     │ entrega
                 │            VOLVER (con feedback)    ▼
                 │                              ┌──────────────┐
                 └───────────────────────────  │  VERIFIER    │  corre tests + opera la
                                                │  desconfia   │  app en el navegador
                                                └──────────────┘
```

## Herramientas

- **codebase-memory-mcp** (obligatorio) — grafo del código para entender antes de tocar.
- **Context7** — docs de librerías al día (no las viejas que recuerda el modelo).
- **markitdown** — convierte PDF/Office/imágenes a markdown para que los agentes los lean.
- **chrome-devtools MCP / Playwright** — el verifier opera la app real para encontrar bugs.
- **scripts/check-dep.sh** y **scripts/check.sh** — versiones/vulns y verificación post-tarea.

Ver `AGENTS.md` para el detalle de cómo se usan y por qué (incluye Seguridad y las reglas
de no-comentarios y versiones).
