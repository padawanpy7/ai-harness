# Herramientas externas

Lo que NO es del harness: MCPs y utilidades de terceros. Vive aca y no en `AGENTS.md` porque no
aplica a toda tarea, y `AGENTS.md` se lee entero en cada arranque.

El criterio para sumar una: necesidad real, no por si acaso. Un agente con 30 tools elige peor que
uno con 8.

**Verificacion (el verifier):** operar la app real, que es donde aparecen los bugs que el build no
ve. **chrome-devtools MCP** para recorrer flujos a mano, **Playwright** para specs e2e
deterministas y **TestSprite** (MCP) para cobertura exploratoria generada con IA (pide API key;
la configura `init.sh`).

**Docs de librerías al día:** **Context7** - docs y APIs actualizadas de cada paquete (no
las que el modelo recuerda, que están viejas). Setup: `npx ctx7 setup --claude`. Usalo al
trabajar con una librería para no escribir contra una API deprecada.

**Docs externas:** **markitdown** (liviano) - convierte PDF/Word/Excel/PPT/imágenes a
markdown: `markitdown entrada.pdf > docs/entrada.md`. El agente lee el `.md`, no el binario.

**Entender el codigo:** **codebase-memory-mcp** - grafo del codigo (simbolos, llamadas, impacto,
rutas HTTP), mucho mas barato que grep/read masivo, y sus tools quedan DIFERIDAS (no ocupan
contexto hasta que se usan). Es la forma por defecto de explorar backend/logica antes de tocar.
En frontend/CSS puro `grep` suele ser mas directo: no fuerces el grafo ahi. Lo instala `init.sh`.

**Memoria entre sesiones/agentes:** `memory/MEMORY.md` + playbooks. Para memoria compartida
más rica entre sesiones y compañeros, **Engram** (MCP) es una buena opción.
