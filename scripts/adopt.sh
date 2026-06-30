#!/usr/bin/env bash
set -uo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:-$here}"
echo "==> adopt: detectando stack en $target"

TARGET="$target" PROJYML="$here/project.yml" python3 - <<'PY'
import os, json, re, glob
t = os.environ["TARGET"]; py = os.environ["PROJYML"]
def read(p):
    try: return open(os.path.join(t, p), encoding="utf-8", errors="ignore").read()
    except Exception: return ""
lang=fw=db=infra=build=test=run=lint=""
pj = read("package.json")
if pj:
    try: d = json.loads(pj)
    except Exception: d = {}
    lang = "TypeScript" if os.path.exists(os.path.join(t,"tsconfig.json")) else "JavaScript"
    deps = {**d.get("dependencies",{}), **d.get("devDependencies",{})}
    for k,name in [("next","Next.js"),("@nestjs/core","NestJS"),("react","React"),("vue","Vue"),("svelte","Svelte"),("express","Express")]:
        if k in deps: fw = name; break
    s = d.get("scripts",{})
    if "build" in s: build = "npm run build"
    if "test" in s: test = "npm test"
    if "lint" in s: lint = "npm run lint"
    run = "npm run dev" if "dev" in s else ("npm start" if "start" in s else run)
if read("pyproject.toml") or read("requirements.txt"):
    lang = lang or "Python"
    reqs = (read("pyproject.toml")+read("requirements.txt")).lower()
    for k,name in [("fastapi","FastAPI"),("django","Django"),("flask","Flask")]:
        if k in reqs: fw = fw or name; break
    test = test or "pytest"; lint = lint or "ruff check ."
if glob.glob(os.path.join(t,"**/*.csproj"), recursive=True):
    lang = lang or "C#"; fw = fw or ".NET"; build = build or "dotnet build"; test = test or "dotnet test"
if read("go.mod"):
    lang = lang or "Go"; build = build or "go build ./..."; test = test or "go test ./..."
comp = read("docker-compose.yml") or read("compose.yml") or read("deploy/docker-compose.yml")
if comp:
    infra = "Docker Compose"
    for k,name in [("postgres","PostgreSQL"),("mysql","MySQL"),("mariadb","MariaDB"),("mongo","MongoDB"),("redis","Redis")]:
        if k in comp.lower(): db = name; break
vals = {"language":lang,"framework":fw,"db":db,"infra":infra,"build":build,"test":test,"run":run,"lint":lint}
lines = open(py).read().splitlines(True)
for k,val in vals.items():
    if not val: continue
    for i,l in enumerate(lines):
        if re.match(r'^(\s*)'+re.escape(k)+r':\s*""\s*$', l):
            ind = re.match(r'^(\s*)', l).group(1); lines[i] = f'{ind}{k}: "{val}"\n'; break
open(py,"w").writelines(lines)
print("   detectado:", {k:v for k,v in vals.items() if v})
PY
echo "==> project.yml prellenado. Ahora el agente completa convenciones, playbooks y specs (skill adopt)."
