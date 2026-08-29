# MEMORY.md

**Indice de la memoria del harness.** Una linea por hecho durable; el hecho entero vive en
`memory/hechos/<nombre>.md` con su frontmatter (`name`, `description`, tipo, area).

Vive en el repo, no en la carpeta de una herramienta: se versiona, se respalda con git y la puede
leer cualquier agente.

Que NO va aca:
- lo que sirve a UNA tarea puntual -> `work/<tarea>.md`
- la practica de un area (ui, backend, base de datos) -> `memory/playbooks/<area>.md`
- lo que el codigo o `git log` ya responden

**La prueba para que un hecho quede aca:** si manana toco este proyecto de nuevo, en CUALQUIER
area, esto me ahorra un error o una hora buscando la causa.

## Hechos

(vacio: la plantilla no trae hechos, los acumula cada proyecto)

## Donde sigue

- **Practica por area** -> `memory/playbooks/`. Crece con el uso.
