# El patron de fondo: esto es un AI loop

Vive fuera de `AGENTS.md` a proposito: es el POR QUE del protocolo de sesion, no algo que haga
falta releer para ejecutar una tarea puntual. Leelo si queres entender el fundamento del harness,
o al diseñar un loop nuevo.

Lo de arriba no es burocracia: es un **loop**. La diferencia entre promptear y esto es que el
prompt busca *una buena respuesta* y el loop **hace que el trabajo siga avanzando**: ejecuta,
verifica, reitera y **recuerda**. El ciclo es siempre el mismo:

```
Objetivo -> Contexto -> Acción -> Verificación -> ¿suficiente? --No--> reiterar
                                                        |Sí
                                                        v
                                                     Memoria
```

Cada pieza del harness ES un componente del loop:

| Componente | Dónde vive acá |
|---|---|
| Objetivo | el pedido + `openspec/changes/<id>/proposal.md` |
| Contexto | `AGENTS.md`, el playbook del area, `memory/hechos/` |
| Accion | el rol que corresponde (implementer / especialista) |
| Verificacion | el **verifier**: los gates de `check` mas la prueba contra lo real |
| Decision (reiterar/avanzar) | veredicto OK/VOLVER, con un maximo de rondas |
| Memoria | `memory/hechos/` + playbooks + `work/PROGRESO.md` |
| Criterio de "hecho" | los pasos de verificacion escritos ANTES de empezar |

Lo que hay que hacer **explícito** en cada tarea (es donde los loops se caen):

1. **Criterio de éxito por paso**, no al final. Si no sabés qué hace pasar un paso, el verifier
   no puede juzgarlo: se escribe antes de empezar, no al final.
2. **Terminación explícita**: cuándo para (criterio cumplido), cuándo **escala al humano**
   (riesgo, decisión de producto, N rondas sin verde). Nunca "seguí hasta que salga".
3. **Que se guarda**: la leccion durable va a `memory/hechos/` o al playbook *al cerrar*, no "cuando me
   acuerde". Antes de una tarea parecida, se lee primero (por eso el checklist de arranque).
4. **Routing por modelo**: el modelo justo por fase (`model:` de cada rol). Lo mecánico barato,
   el juicio caro.
5. **El humano en rol crítico**: fija el objetivo, define el gusto, aprueba lo riesgoso y mejora
   el sistema entre corridas. No está pegado a cada paso.

Regla práctica: lo que hacés **todos los días no debería vivir dentro de un solo chat**. Si una
tarea se repite, conviene convertirla en loop (o en skill) en vez de re-promptearla cada vez.
