---
name: judgment-day
when: verificar cambios riesgosos (seguridad, dinero, datos, decisiones de peso)
---

# Skill: Dia del juicio (verificación por jueces)

Para lo riesgoso, un solo revisor tiene sesgo. Dos jueces en paralelo + un orquestador.

1. Lanza **dos jueces independientes en paralelo**, cada uno con una **lente distinta**
   (ej. uno mira correctitud, otro seguridad/edge cases). Cada juez emite **veredicto +
   evidencia** (que probo, como).
2. Un **orquestador** lee ambos y decide: aprueba, rechaza, o pide otra ronda. Si discrepan,
   gana el mas conservador (rechazar) salvo evidencia clara de lo contrario.
3. Escribe la decisión y el por que en `work/<tarea>.md`.

Cuando: cambios de seguridad, plata, datos, o decisiones de diseño con varias opciones. Para
lo trivial, un verifier alcanza (no gastes de mas).
