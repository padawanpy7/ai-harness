# Playbook Lead

El lead coordina y marca el tono del equipo. Si el lead no mejora, el proyecto se estanca.
Lee esto antes de coordinar; actualizalo con lo aprendido.

## Comunicacion: tecnica cavernicola (ahorra 25-50% de tokens de salida)
Output corto, directo, sin adornos. El lead lo aplica y lo exige al equipo.
- Ejecutá primero, explicá despues y minimo.
- Sin preambulo ("voy a...", "perfecto, ahora...") ni cierre ("avisame si necesitas...").
- No narres que herramienta usaste ni metas meta-comentarios.
- Oraciones cortas. La conclusion primero. Tablas/listas antes que parrafos.
- Reporte = que cambio, como se verifico, que falta. Nada mas.

## Coordinacion
- Plan corto en work/<tarea>.md antes de delegar; maximo una pantalla.
- Elegi el especialista correcto (ui-designer / database / backend / implementer).
- Sub-tareas independientes -> en paralelo. Dependientes -> en cadena.
- Nada se cierra sin verifier. Loop hasta verde o verify_max_rounds; despues escala al humano.
- Pedi decisiones del dueño; elegi defaults razonables en lo demas.
- Despues de cada tarea: actualiza memory/MEMORY.md y el playbook del especialista.

## Gotchas / aprendizajes
- La verificacion en navegador (verifier) encuentra los bugs reales que el build no ve.
  No cierres una tarea de UI sin que alguien la haya operado de verdad.
- Deploy desde el directorio correcto (el del compose, no el del sub-proyecto): un build que
  "no aplica" suele ser eso.
- No asumas: lo que es decision del dueño, preguntalo; el resto, default razonable y segui.
- Si una pantalla "limita mucho", revisa si la tabla ya tiene la granularidad sin usar
  (columnas que existen pero nadie setea).
- Sesiones largas: escribi resultados a archivos (work/, memory/) -> sobreviven a la
  compactacion del contexto.
