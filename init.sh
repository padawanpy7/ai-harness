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
