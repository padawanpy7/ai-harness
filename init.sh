#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"; cd "$here"
echo "==> Harness en: $here"

mkdir -p memory work docs .claude/agents
[ -f memory/MEMORY.md ] || printf '# MEMORY.md\n\nMemoria persistente entre sesiones. Una linea por hecho durable.\n' > memory/MEMORY.md

PIP="$(command -v pip3 || command -v pip || true)"
if [ -n "$PIP" ]; then
  echo "==> Instalando markitdown + pip-audit ..."
  "$PIP" install -q --user "markitdown[all]" markitdown-mcp pip-audit 2>/dev/null \
    || "$PIP" install -q --break-system-packages "markitdown[all]" markitdown-mcp pip-audit 2>/dev/null \
    || echo "   ! Instala manual: pip install 'markitdown[all]' markitdown-mcp pip-audit"
else
  echo "==> pip no encontrado; instala markitdown cuando puedas."
fi
[ -f .mcp.json ] || cat > .mcp.json <<'JSON'
{
  "mcpServers": {
    "markitdown": { "command": "markitdown-mcp" }
  }
}
JSON

if [ -t 0 ] && grep -q '^name: ""' project.yml 2>/dev/null; then
  echo ""
  echo "==> Configuracion del proyecto (Enter para saltar cada campo):"
  read -rp "  Nombre: " V_NAME
  read -rp "  Una frase (que es): " V_ONE
  read -rp "  Lenguaje: " V_LANG
  read -rp "  Framework: " V_FW
  read -rp "  Base de datos: " V_DB
  read -rp "  Infra: " V_INFRA
  read -rp "  Comando build: " V_BUILD
  read -rp "  Comando test: " V_TEST
  read -rp "  Comando run: " V_RUN
  read -rp "  Comando lint: " V_LINT
  V_NAME="$V_NAME" V_ONE="$V_ONE" V_LANG="$V_LANG" V_FW="$V_FW" V_DB="$V_DB" V_INFRA="$V_INFRA" \
  V_BUILD="$V_BUILD" V_TEST="$V_TEST" V_RUN="$V_RUN" V_LINT="$V_LINT" python3 - <<'PY'
import os, re
v = {k: os.environ.get(k, "") for k in ["V_NAME","V_ONE","V_LANG","V_FW","V_DB","V_INFRA","V_BUILD","V_TEST","V_RUN","V_LINT"]}
ymap = {"name":v["V_NAME"],"one_liner":v["V_ONE"],"language":v["V_LANG"],"framework":v["V_FW"],"db":v["V_DB"],"infra":v["V_INFRA"],"build":v["V_BUILD"],"test":v["V_TEST"],"run":v["V_RUN"],"lint":v["V_LINT"]}
lines = open("project.yml").read().splitlines(True)
for k, val in ymap.items():
    if not val: continue
    for i, l in enumerate(lines):
        m = re.match(r'^(\s*)'+re.escape(k)+r':\s*""\s*$', l)
        if m: lines[i] = f'{m.group(1)}{k}: "{val}"\n'; break
open("project.yml","w").writelines(lines)
a = open("AGENTS.md").read()
stack = " / ".join(x for x in [v["V_LANG"],v["V_FW"],v["V_DB"],v["V_INFRA"]] if x)
rep = {"{{PROJECT_NAME}}":v["V_NAME"],"{{ONE_LINER}}":v["V_ONE"],"{{STACK}}":stack,"{{BUILD}}":v["V_BUILD"],"{{TEST}}":v["V_TEST"],"{{RUN}}":v["V_RUN"],"{{LINT}}":v["V_LINT"]}
for k, val in rep.items():
    if val: a = a.replace(k, val)
open("AGENTS.md","w").write(a)
print("==> project.yml y AGENTS.md actualizados.")
PY
fi

if command -v cbm >/dev/null 2>&1 || [ -x "$HOME/.local/bin/cbm" ]; then
  echo "==> codebase-memory-mcp: ya instalado."
else
  echo "==> Instalando codebase-memory-mcp ..."
  curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | sh \
    || echo "   ! Comando exacto en: https://github.com/DeusData/codebase-memory-mcp"
fi

if command -v gitleaks >/dev/null 2>&1; then echo "==> gitleaks: ya instalado."
else echo "==> gitleaks (escaneo de secretos): instalalo -> https://github.com/gitleaks/gitleaks/releases"; fi

echo ""
echo "==> Context7 (docs de librerias al dia): npx ctx7 setup --claude"
echo "==> Verificacion del verifier (las 3):"
echo "    - chrome-devtools MCP: ya viene con Claude Code."
echo "    - Playwright: npm i -D @playwright/test && npx playwright install chromium"
echo "    - TestSprite (obligatorio): export TESTSPRITE_API_KEY=... ; claude mcp add testsprite -- npx @testsprite/testsprite-mcp@latest"
echo ""
echo "==> PENDIENTE: completar project.yml y los {{PLACEHOLDERS}} de AGENTS.md (1 y 8)."
echo "==> Listo. Empeza por el rol 'lead'. Probas las tools con: scripts/check-dep.sh y scripts/check.sh"
