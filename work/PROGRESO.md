# PROGRESO

Puente entre sesiones (protocolo de sesion, AGENTS.md S4). El lead lo LEE al arrancar y lo
ACTUALIZA al cerrar. Entrada mas reciente arriba. Se actualiza SIEMPRE, aun sin commit.

Formato de cada entrada:

## AAAA-MM-DD - <tarea/feature>

- Hecho: que se completo.
- Verificado: como se probo (build/test/lint + navegador si hay UI).
- Pendiente / proximo: lo que sigue.
- Gotchas / decisiones: lo no obvio, para no repetir errores.

## 2026-08-30 - gate de secretos literales y el doc del loop

- Hecho: `secretos-literales` (detector propio: literal no vacio, no plantilla, 8+ chars bajo
  clave sensible en .json/.env/.yml) entra como septimo gate de `check`. Portado
  `docs/el-loop-del-harness.md`. `control-negativo` cubre ahora el gate nuevo.
- Verificado: 175 tests, check --todos verde 7/7, control-negativo 10/10 en rojo.
- Pendiente / proximo: `gitleaks-rango` NO se porto (optimiza el escaneo de HISTORIA; este gate
  mira el arbol de trabajo). `docs/auditoria-harness.md` tampoco: es una auditoria fechada del
  repo de origen, con evidencia en ruta:linea de ese proyecto.
- Gotchas / decisiones:
  - **`docs/` estaba gitignoreado y `AGENTS.md` ya apuntaba ahi.** El catalogo de herramientas
    que saque de AGENTS.md ayer nunca se commiteo: el puntero apuntaba al vacio para cualquiera
    que clonara. Ahora los docs del harness tienen su excepcion en `.gitignore`.
  - **El test del detector dispara a gitleaks**: sus fixtures son secretos falsos por diseño.
    Allowlist acotado a ESE archivo, no a `*.test.js`, para no apagar el gate en lo que crezca
    despues. Y el cebo del control negativo se ARMA en pedazos, para no necesitar otro allowlist.

<!-- La primera entrada real del proyecto va arriba de esta linea. -->

## 2026-08-29 - la plantilla se pone al dia con los harness derivados

- Hecho: la infraestructura que habia evolucionado en los derivados (`bf-db-workspace` y el
  harness de sistema) baja a la plantilla. Punto de entrada unico `node harness.js <tool>`, que
  reemplaza los wrappers `.sh`; 11 libs con 159 tests; `check` como compuerta de 6 gates en
  paralelo; `cierre`; `presupuesto` (tope Y crecimiento); `control-negativo`; y `memory/hechos/`.
  El nombre del entrypoint es neutro a proposito: cada derivado lo renombra.
- Verificado: `node harness.js check --todos` verde (6/6), 159 tests, `doctor` sano y `cierre`
  sin referencias muertas. El propio `presupuesto` obligo a podar `AGENTS.md` de 303 a 250.
- Pendiente / proximo: falta portar el gate de secretos afinado y `gitleaks-rango`, y los docs de
  harness que existen en el workspace (`el-loop-del-harness.md`, `auditoria-harness.md`).
- Gotchas / decisiones:
  - **El nombre del entrypoint estaba escrito a mano en dos lugares** (la regex de tools muertas
    en `cierre-core` y la familia de comandos en `metricas-core`). Al renombrar, los dos dejaron
    de encontrar nada, que se ve identico a "todo bien". Ahora es un parametro; el arreglo volvio
    tambien a los derivados.
  - **`AGENTS.md` tenia dominio filtrado**: nueve lineas sobre autoria en APEX, que es de un
    proyecto concreto y no de una plantilla. El catalogo de MCP externos se fue a
    `docs/herramientas.md` por la misma razon: no aplica a toda tarea.
  - **Decia que `work/` era "efimero pero versionado" y el `.gitignore` lo excluye.** El mismo
    documento que mentia aparecio en el harness derivado el 22/08.
  - Borrar wrappers `.sh` a ciegas se llevo puestos `features.sh` y `check-dep.sh`, que NO tenian
    reemplazo en `.js`. Los devolvio `git restore`; el gate de referencias muertas del `cierre`
    caza justo eso.
