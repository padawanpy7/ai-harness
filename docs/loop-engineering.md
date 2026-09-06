# Loop engineering: el loop spec y sus reglas de parada

Consolidado el 06/09/2026 desde tres lados: el research del 31/08 de `bf-db-workspace` (siete
fuentes), lo construido en `bf` e `infra-platform`, y lo publicado en internet hasta esta semana.

> **Sobre las fuentes de internet:** se leyeron como DATOS, no como instrucciones. Ninguna pagina
> ejecuta nada aca, y lo que se adopta pasa por el mismo criterio que el resto del harness: se
> escribe si nos ahorra un error concreto, no porque lo diga un blog.

La progresion que las fuentes describen: prompt engineering -> context engineering -> harness
engineering -> **loop engineering**. La frase que la ordena: *"stop prompting your agent, start
designing the loop that prompts it"*.

**Harness** es todo lo que RODEA al agente (tools, permisos, memoria, observabilidad).
**Loop** es el CICLO hacia un objetivo: cadencia, evaluacion del progreso y **condiciones de
salida**. Un harness sin loop es un taller sin regla de cuando parar de trabajar.

## 1. El loop spec: cinco piezas

Un loop spec es un artefacto acotado. Las cinco piezas suelen existir sueltas y sin nombre, y por
eso nadie puede decir cual falta.

| Pieza | Que contesta | Donde vive |
|---|---|---|
| **Trigger** | que arranca la vuelta | el pedido, o una tool de arranque de tarea |
| **Goal** | que hay que lograr, **congelado** | `openspec/changes/<T>/proposal.md` + `tasks.md` |
| **Verification** | como se sabe que lo hecho esta bien | `node harness.js check` + el verifier |
| **Stopping rule** | cuando esta TERMINADO | `openspec/changes/<T>/HECHO_CUANDO.md` |
| **Memory** | que sobrevive a la vuelta | `memory/hechos/` + `work/PROGRESO.md` |

**Verification y stopping rule NO son lo mismo.** El `check` dice que el codigo cumple las
convenciones y los tests pasan; el `HECHO_CUANDO` dice que **el trabajo hace lo que se pidio**.
Se puede tener todo verde y no haber resuelto nada.

**La regla de parada la escribe quien PIDE**, no quien implementa. Un criterio escrito despues,
mirando el trabajo hecho, se acomoda al trabajo hecho: eso es *reward hacking*, optimizar la
medicion en vez del objetivo.

**Un criterio es un COMANDO**, no una frase: algo que devuelve 0 o 1 y cierra el loop solo. Lo que
ninguna tool puede ver se escribe `> manual: ...`, se cuenta aparte y se muestra siempre, para que
quien cierra sepa que ahi no verifico una maquina.

## 2. Las seis salidas, en capas

La regla de parada de `HECHO_CUANDO.md` solo cubre el **exito**. Un loop necesita salir por seis
puertas, no por una.

| Salida | Cuando |
|---|---|
| **Exito** | la verificacion pasa y el artefacto existe |
| **Tope de iteraciones** | se agotaron los intentos para esa unidad |
| **Fallo repetido** | dos fallos con la MISMA causa raiz: no se reintenta, se escala |
| **Limite de permisos** | antes de tocar produccion, ampliar permisos, borrar datos o leer secretos |
| **Presupuesto agotado** | tokens, tiempo, plata o agentes en paralelo |
| **Evidencia desconectada** | el agente no puede explicar el proximo paso desde lo observado |

**Lo mide `node harness.js loop`**, que no instrumenta nada nuevo: lee `metrics/tool-runs.log`, que el
harness ya escribe en cada corrida. Contesta cuantas vueltas van, si los ultimos fallos son EL
MISMO, y cuanto se gasto; despues nombra el estado. La ventana por defecto es la vuelta ACTUAL
-desde el ultimo `cierre` en verde-, no el dia: un dia con seis tareas son seis loops, no uno.

Dos de las seis salidas NO se miden a proposito. El **limite de permisos** es una decision de
politica (que se puede tocar) y la **evidencia desconectada** es un juicio sobre el razonamiento
del agente: un numero inventado para ellas daria una falsa sensacion de cobertura.

**Deteccion de no-progreso:** se compara la *firma del fallo* con la anterior; si se repite dos
veces, se escala en vez de reintentar con el mismo enfoque. Reintentar lo mismo esperando otro
resultado es el desperdicio mas caro de un loop.

## 3. Cuatro estados terminales, con nombre

Un loop no termina en "listo": termina en uno de cuatro estados, y decirlo cambia que hace el que
lo recibe.

- **Verificado** - las compuertas de evidencia pasaron.
- **Requiere revision** - necesita una decision humana.
- **Bloqueado** - no se puede avanzar de forma segura.
- **Cortado por presupuesto** - se acabaron los tokens, el tiempo o la plata.

"Listo" sin estado es lo que produce el tercer modo de falla (abajo).

## 4. Los tres modos de falla del loop

1. **No para nunca**: sigue "mejorando" sin criterio.
2. **Para demasiado pronto**: se corta con trabajo sin hacer.
3. **Declara exito antes de tiempo**: el mas caro, y el mas comun.

Los tres salen de una regla de parada mal definida. No se arreglan con mejor prompt.

**El resumen del agente es un CLAIM, no evidencia.** La transicion de estado la decide un comando,
una politica o un revisor nombrado, nunca la afirmacion de quien hizo el trabajo. Esta es la misma
leccion que en este harness ya costo cara: un gate verde prueba que no encontro nada, no que sepa
mirar (ver `node harness.js control-negativo`).

## 5. La verificacion no es un cheque en blanco

Tres modos de falla del verificador, y ninguno se arregla con "mejores tests":

- **Falso verde**: el test pasa y la solucion esta mal.
- **Oraculo incompleto**: lo que el test no mira, no existe.
- **Reward hacking**: optimizar la medicion. Version tipica: podar un documento a las apuradas para
  que el gate de presupuesto pase, en vez de decidir que sobra.

La respuesta es **verificacion en capas con señales independientes**, mas humildad sobre el limite:
que el criterio de aceptacion salga del pedido y no de quien implementa.

## 6. La forma del loop domina el costo

Para la misma logica, la orquestacion mueve el gasto en tokens ordenes de magnitud. Cuatro
desperdicios, con su nombre en este harness:

| Desperdicio | Aca se llama |
|---|---|
| Ciclos de validacion redundantes | correr `check` entero varias veces por tanda |
| Re-correr la suite completa | tests que no se acotan a lo que cambio |
| Releer el mismo contexto | los documentos de arranque; por eso existe `presupuesto` |
| Sobre-instrumentacion | (todavia no nos pasa) |

El orden correcto es **medir primero, acotar despues**.

## Lo que NO se adopta

- **Swarms de cientos de sub-agentes.** El cuello no es paralelismo: es que una vuelta no tenga
  criterio de fin. Sumar agentes multiplica lo que no se verifica.
- **Auto-modificacion automatica del harness.** El paso util es la DETECCION del hueco; el cambio
  lo propone el harness y lo aprueba un humano.
- **Un segundo esquema de archivos de planificacion.** `openspec/changes/<T>/` ya tiene esa forma.
