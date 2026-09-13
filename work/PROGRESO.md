# PROGRESO

Puente entre sesiones (protocolo de sesion, AGENTS.md S4). El lead lo LEE al arrancar y lo
ACTUALIZA al cerrar. Entrada mas reciente arriba. Se actualiza SIEMPRE, aun sin commit.

**Aca viven solo las TRES entradas mas nuevas.** El resto se archiva por mes en
`work/progreso/` (`2026-08.md`, ...) y se lee solo si hace falta. Motivo: este archivo se
lee ENTERO en cada arranque y `node harness.js presupuesto` lo topea en 150 lineas.

Formato de cada entrada:

## AAAA-MM-DD - <tarea/feature>

- Hecho: que se completo.
- Verificado: como se probo (build/test/lint + navegador si hay UI).
- Pendiente / proximo: lo que sigue.
- Gotchas / decisiones: lo no obvio, para no repetir errores.

## 2026-09-13 - `vuelta`, `roles` y el ultimo script de bash

- Hecho: el tool `loop` pasa a **`vuelta`** (+ `loop-core` -> `vuelta-core` y su test), que es el
  nombre que ya usan `bf` e `infra` desde el 09/09: "loop" para la disciplina y la carpeta,
  "vuelta" para una iteracion. Entra **`roles`** (traido de `bf`/`infra`): la lista de roles y
  playbooks sale del disco, no de una tabla a mano. Y **`features.sh` pasa a `features.js`**: era
  bash llamando a python3 para parsear un JSON, tres lenguajes para contar.
- Verificado: 283 tests, `check --todos` verde, `cierre` sin referencias muertas, y **21/21 en
  `control-negativo`**, que venia CRASHEANDO desde el 11/09 sin que nadie lo viera. `features`
  comparado contra el `.sh` viejo: misma salida, mas los bordes (JSON roto -> exit 1, ledger
  ausente -> exit 0, ruta absoluta).
- Pendiente / proximo:
  1. `features` sigue leyendo un `FEATURES.json` unico en la raiz. Los otros cuatro repos usan un
     ledger POR TICKET y tienen `--gate`, que es lo que `aceptacion` pide como criterio. Mover la
     plantilla a ledger por ticket es una decision de diseño, no una migracion: queda planteada.
  2. `AGENTS.md` esta en 250/250 lineas. No entra nada mas sin sacar algo.
- Gotchas / decisiones:
  - **Dos tools con el mismo nombre y distinta extension conviven, y gana la vieja.** Con
    `features.sh` y `features.js` los dos presentes, `node harness.js features` corria el `.sh`;
    se noto porque el error de JSON roto venia en formato de python. El `.sh` se borra en el mismo
    commit que entra el `.js`, no despues.
  - **`control-negativo` puede estar muerto con `check` en verde.** El caso del bash leia
    `scripts/sistema/impresora.sh`, que solo existe en el repo de sistema: la promocion del 11/09
    se lo trajo con la ruta puesta. Los casos de la plantilla van con insumo sintetico.
  - Borrar el `.sh` esta bien ESTA vez porque hay reemplazo probado. La bitacora ya registra la
    vez que se borro a ciegas y hubo que restaurarlo.

## 2026-09-11 - scripts/harness pasa a scripts/loop

- Hecho: el renombre de la carpeta, alineando con `bf` e `infra`. `git mv` para conservar historia.
- Verificado: 276 tests y `check --todos` verde; las tools se siguen descubriendo solas porque el
  registry sale del filesystem.
- Pendiente / proximo: quedo por hacer la otra mitad del renombre (el tool `loop` -> `vuelta`),
  cerrada el 13/09.
- Gotchas / decisiones: el test de `areaDe` compara la carpeta padre, asi que un `sed` cambia el
  caso pero no el valor esperado y queda pidiendo `harness` sobre una ruta que ya dice `loop`.

## 2026-09-10 - los gates comparaban la fecha contra UTC

- Hecho: `scripts/lib/fecha-local.js`. `toISOString()` devuelve la fecha en UTC y el reloj del
  dueño esta en -03:00, asi que pasadas las 21:00 locales el gate reclamaba una entrada de
  bitacora del dia siguiente.
- Verificado: la suite, con los casos de las 21:56 y de la madrugada.
- Pendiente / proximo: nada abierto.
- Gotchas / decisiones: todo lo que se compare con `git log`, con la bitacora o con
  `metrics/tool-runs.log` tiene que usar esto: esas tres cosas se escriben en hora LOCAL.
