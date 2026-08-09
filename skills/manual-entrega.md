---
name: manual-entrega
when: el dueño pide "el manual" o la entrega al terminar una tarea; hay que entregarle el trabajo a otro
---

# Skill: entrega de una tarea

Lo que se le da a **quien recibe la tarea y no estuvo en el desarrollo**: el **manual** (que se hizo
y como probarlo) y la **evidencia** (una captura por caso de uso), cada uno en `.md` y en `.pdf`.

Todo vive en **`openspec/changes/<ID>/entrega/`**, una sola carpeta y **aparte de `docs/`**: lo que
hay ahi adentro es el paquete que se manda, sin las specs de trabajo mezcladas.

**La carpeta no existe hasta que hace falta**: la crea `md-a-pdf.sh` con `mkdir -p`. No hay que
scaffoldearla ni pedirsela a nadie.

| Archivo (dentro de `entrega/`) | Que es | Se versiona |
|---|---|---|
| `manual-entrega.md` | que se hizo, que instalar y en que orden, como probarlo | **si** |
| `evidencia-pruebas.md` | el indice de la evidencia: un caso de uso por seccion | **si** |
| `*.pdf` | lo que se manda | no (se regeneran) |
| `capturas/*.png` | una captura por caso de uso, de la corrida real | no (se regeneran) |

Los `.pdf` y las `capturas/` van **gitignoreados a proposito**: se regeneran con un comando, y un
binario versionado se pudre contra su fuente.

Esto **no es** el PROGRESO (bitacora del que trabaja) ni `PREGUNTAS.md` (lo que falta decidir): esos
son para adentro.

## Los comandos

```bash
# los PDF, uno por documento
bash scripts/docs/md-a-pdf.sh openspec/changes/<ID>/entrega/manual-entrega.md
bash scripts/docs/md-a-pdf.sh openspec/changes/<ID>/entrega/evidencia-pruebas.md
```

## La evidencia sale de los tests, no de un paseo aparte

Las capturas las deja la corrida real de los tests de navegador (el verifier ya los opera), con un
**prefijo por bloque** para que no se pisen entre si cuando hay varios `test()` de nivel superior en
el mismo archivo.

Por que asi y no capturando aparte: repetir los pasos en un script de "sacar fotos" crea **dos
fuentes de verdad** que se desincronizan, y la foto termina mostrando algo que ya no es lo que el
test verifica. Si a un caso le falta la captura, el documento **lo dice** ("SIN CAPTURA") en vez de
omitirlo: eso se arregla corriendo el spec, no borrando la linea.

## De donde sale cada cosa (NO se escribe de memoria)

| Seccion | Fuente | Como se saca |
|---|---|---|
| Que entra / que no | `openspec/changes/<ID>/FEATURES.json` | cada feature con `passes:true` entra; las `false` van a "que NO entra" **con el motivo** |
| Que se hizo por item | la spec + la descripcion de cada feature | una fila por item: **que pedia** -> **que quedo** |
| Objetos y su orden | los artefactos del cambio | el orden real de instalacion (la dependencia antes de lo que la usa) |
| Datos de prueba | **el ambiente, medido hoy** | nunca copiar los numeros del PROGRESO: los tests borran y crean, y un dato viejo hace fallar la prueba del que recibe |
| Cabos abiertos | `PREGUNTAS.md` + `aprendizajes.md` | lo que no bloquea pero el otro tiene que saber |
| Estado de los gates | la ultima corrida real | con los numeros (`15/15`), no "todo verde" |

## Estructura

1. **Cabecera**: id, ambiente donde esta instalado, fecha de la ultima verificacion, que entra y que
   NO (con el por que y a quien le toca).
2. **Que se hizo**: una tabla `que pedia la spec` -> `que quedo`, un renglon por item del ledger.
3. **Que se instala, EN ORDEN**: con quien corre cada cosa y **marcando lo que NO va al pase**
   (migraciones de una vez, scripts de prueba, objetos de experimento).
4. **Como probarlo en pantalla**: el guion, paso a paso, con **datos que existen hoy** y como
   encontrar equivalentes si el ambiente se rehace. Cada caso dice **que se tiene que ver**,
   incluido el texto exacto de los mensajes.
5. **Pruebas automaticas**: los comandos tal cual, aclarando cual **escribe** en el ambiente.
   `skipped 0` es parte del resultado.
6. **Lo que hay que saber antes de probar**: permisos, roles, datos que dependen de otro sistema. Lo
   que hizo perder una tarde durante el desarrollo va aca, no en la cabeza de nadie.
7. **Cabos conocidos**: lo que no bloquea la entrega pero muerde despues.

## Reglas

- **Medir antes de escribir.** Cada id, numero o estado que aparezca se consulta contra el ambiente
  en el momento de escribir el manual. Un dato que no existe convierte el manual en una trampa.
- **Nada de jerga de la sesion.** El que lo lee no vio el chat: sin "como veniamos hablando", sin
  nombres de variables internas, sin referencias a tandas.
- **El texto de los mensajes, literal.** Si la pantalla dice *"Debe elegir una sola opcion para
  continuar."*, va entre comillas y con el punto final: es lo que el otro va a comparar.
- **El manual es UN documento**: no se parte en "manual" + "guia de pruebas", porque apenas se
  separan uno de los dos queda viejo. La evidencia si va aparte, pero **nadie la escribe**: sale de
  la corrida.
- **Antes de cerrar**: `bash scripts/calidad/spell.sh <archivo>` y `bash scripts/calidad/ascii.sh
  --check openspec/changes/<ID>/entrega/`. El spell es informativo (los nombres propios y la jerga
  van a saltar); el ascii **si** se corrige.
- **Al final**: generar los PDF y commitear **solo los `.md`**.
