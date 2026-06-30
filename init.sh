#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"; cd "$here"
echo "==> Harness en: $here"

mkdir -p memory work docs .claude/agents
[ -f memory/MEMORY.md ] || printf '# MEMORY.md\n\nMemoria persistente entre sesiones. Una linea por hecho durable.\n' > memory/MEMORY.md

PIP="$(command -v pip3 || command -v pip || true)"
if [ -n "$PIP" ]; then
  echo "==> Instalando markitdown ..."
  "$PIP" install -q --user "markitdown[all]" markitdown-mcp 2>/dev/null \
    || "$PIP" install -q --break-system-packages "markitdown[all]" markitdown-mcp 2>/dev/null \
    || echo "   ! Instala manual: pip install 'markitdown[all]' markitdown-mcp"
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

echo ""
echo "==> Verificacion: chrome-devtools MCP ya viene con Claude Code."
echo "    Para specs e2e: npm i -D @playwright/test && npx playwright install chromium"
echo ""
echo "==> PENDIENTE: completar project.yml y los {{PLACEHOLDERS}} de AGENTS.md (1 y 8)."
echo "==> Listo. Empeza por el rol 'lead'."
