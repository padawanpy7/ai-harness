# scripts/

Las herramientas del harness, agrupadas por para que sirven. Cada una responde a `--help`.

| Carpeta | Que hay |
|---|---|
| `calidad/` | lo que se corre al terminar: `check` (el paraguas), `check-dep`, `spell`, `ascii`, `doctor`. |
| `harness/` | el harness mirandose a si mismo: `features` (el ledger), `metricas` (tiempo y tokens por tarea), `tool-usage` (que tools se usan), `skill-sync` (regenera el registry). |
| `docs/` | `md-a-pdf`: pasa un `.md` a PDF para mandarselo a alguien de afuera. |
| `lib/` | **librerias**: logica pura que se importa, sin `argv` ni prints. Se testea con `node --test` al lado (`*.test.js`). Nadie las ejecuta. |
| raiz | `adopt` (onboarding brownfield), `smoke` (app viva), `served-fresh` (lo servido es lo ultimo), `strip-comments`. |
| `_*.sh` / `_*.py` | internos: resuelven node, python y el contador de uso. No se llaman a mano. |

Las tres piezas de una tool: el **`.sh`** es la entrada (resuelve el toolchain y delega), el **`.js`**
es el comando (argumentos, red/navegador, exit code) y **`lib/`** es la logica pura y testeable.

## El contador de uso

Cada tool llama a `_count.sh` al arrancar y deja una linea en `metrics/tool-usage.log`
(gitignoreado: es estado de runtime, no codigo). `harness/tool-usage.sh` lo agrega en una tabla y
lista las tools que **nunca** se usaron. Sirve para decidir que conviene mantener y que quitar:
un harness liviano se lee mas rapido y cuesta menos contexto.

Para instrumentar una tool nueva, su primera linea util es:

```bash
bash "$(dirname "$0")/../_count.sh" "$(basename "$0" .sh)" 2>/dev/null || true
```

Es best-effort: nunca hace fallar a la tool que lo llama.
