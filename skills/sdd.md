---
name: sdd
when: empezar un cambio no trivial; planear antes de codear
---

# Skill: SDD (Spec-Driven Development)

No es prompt engineering: la **spec es la fuente de verdad** y vive en el repo. Loop
**controlado** (no "goal mode / anda y haz todo"): cada fase es una compuerta. La IA es
probabilística; cadena larga sin compuertas -> deriva. Fases + revisión humana = conciso.

## Estructura (estilo OpenSpec)
```
openspec/specs/<capability>/spec.md     specs vivientes: Purpose, Requirements (SHALL),
                                        Scenarios (Given-When-Then)
openspec/changes/<id>/
  proposal.md   que cambia y por que
  design.md     decisiones tecnicas, alternativas, riesgos
  tasks.md      tareas concretas y chequeables
  specs/        deltas de las specs afectadas
```

## Flujo (proposal -> design -> tasks -> apply -> verify -> archive)
1. **proposal** (lead): busca specs y código relevante; escribe que cambia y por que.
2. **design** (especialista): decisiones tecnicas, opciones, riesgos.
3. **tasks**: lista concreta y chequeable de sub-tareas.
4. **>>> revision humana <<<** antes de codear: se cazan los desalineos temprano.
5. **apply**: implementar tarea por tarea, con **TDD strict** (ver skill `tdd`).
6. **verify**: el verifier; nada cierra sin pasar.
7. **archive**: la spec queda revisada en el repo como documentación viviente.

Calibra antes de codear (SDD init): que existe, que specs hay, que convenciones. Recién
ahi propón.
