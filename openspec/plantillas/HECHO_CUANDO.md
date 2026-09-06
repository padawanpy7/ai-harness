# HECHO_CUANDO - <TICKET>

**Cuando esta terminado este cambio.** Un `##` es un criterio; adentro va el COMANDO que lo
verifica -devuelve 0 si se cumple- o una linea `> manual: ...` si ninguna tool lo ve.
Lo corre `node harness.js aceptacion`.

Sale del **pedido**, no del trabajo hecho. Quien implementa no escribe su propio criterio de
aprobacion: un criterio escrito despues, mirando lo que quedo, se acomoda a lo que quedo.
Se copia del ticket, del criterio de aceptacion o del objetivo del `proposal.md`, y se congela
antes de empezar.

Tres reglas que se pagan solas:

1. **Un criterio es un comando**, no una frase. "El login funciona" no cierra un loop;
   `curl -sf localhost:3000/health` si.
2. **El comando lleva su entorno adentro.** `aceptacion` lo lanza con el suyo: si depende de una
   variable exportada en tu shell, el criterio dice "anda en mi maquina" y da rojo con todo sano.
3. **Dos comandos que se comparan tienen que ser el MISMO**, cambiando solo lo que se compara. Si
   difieren en otra cosa, la comparacion no prueba nada.

## <Un criterio, en una linea>

```
<el comando que devuelve 0 cuando el criterio se cumple>
```

## <Otro criterio que ninguna tool puede ver>

> manual: <que hay que mirar, y como se sabe que esta bien>

---

## Las otras salidas (no todo termina en exito)

Este archivo define la salida por **exito**. Un loop tiene cinco puertas mas, y conviene declarar
aca las que apliquen a este cambio:

- **Tope de iteraciones**: cuantos intentos antes de escalar.
- **Fallo repetido**: dos fallos con la misma causa raiz no se reintentan, se escalan.
- **Limite de permisos**: que NO se toca sin aprobacion (produccion, datos, secretos, permisos).
- **Presupuesto**: tokens, tiempo o plata.
- **Evidencia desconectada**: si no se puede explicar el proximo paso desde lo observado, se para.

Y el resultado se reporta con **nombre**, no como "listo": `verificado`, `requiere revision`,
`bloqueado` o `cortado por presupuesto`. El detalle esta en `docs/loop-engineering.md`.
