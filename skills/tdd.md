---
name: tdd
when: implementar logica; aplicar una tarea de la fase apply
---

# Skill: TDD strict

El test **primero**, no despues. Loop rojo-verde-refactor:

1. **ROJO**: escribi el test del comportamiento. Corrélo: **debe fallar**. Si pasa, el test
   esta mal o ya existe.
2. **VERDE**: el minimo codigo para que pase. Nada de mas.
3. **REFACTOR**: limpia con el test en verde de red.
4. **TRIANGULA**: agrega casos (edge cases, limites, error) hasta forzar la implementacion
   real (que no sea un `return` hardcodeado que pasa un solo caso).

## Reglas
- Un test por comportamiento; el nombre dice que verifica.
- Edge cases **explicitos**: vacio, limite, negativo, concurrencia, permiso denegado, input
  malicioso.
- **Evidencia**: pega la salida del test (primero rojo, luego verde). No digas "pasa".
- No escribas codigo de produccion sin un test que lo pida.
- El verifier ademas prueba en el navegador (chrome/Playwright/TestSprite): TDD no reemplaza
  el e2e, lo complementa.
