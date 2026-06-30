const path = require("path");
const fs = require("fs");

let ts;
try {
  ts = require(require.resolve("typescript", { paths: [process.cwd(), path.join(process.cwd(), "node_modules"), path.join(process.cwd(), "frontend/node_modules")] }));
} catch (e) {
  console.error("  ! typescript no resuelto desde el proyecto; corré desde el dir con node_modules (o npm i -D typescript). Salteo ts/tsx.");
  process.exit(0);
}

const DIRECTIVE = /@ts-ignore|@ts-expect-error|@ts-nocheck|@ts-check|eslint-disable|eslint-enable|prettier-ignore|tslint:|@jsxImportSource|webpackChunkName|@license|@preserve|^\/\/\//;

function strip(src) {
  const sf = ts.createSourceFile("f.tsx", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const seen = new Set();
  const ranges = [];
  const add = (p, e, raw) => {
    const k = p + ":" + e;
    if (seen.has(k)) return;
    seen.add(k);
    if (raw && DIRECTIVE.test(src.slice(p, e))) return;
    ranges.push([p, e]);
  };
  (function visit(node) {
    if (node.kind === ts.SyntaxKind.JsxExpression && !node.expression) {
      const t = src.slice(node.getStart(), node.getEnd());
      if ((t.includes("/*") || t.includes("//")) && !DIRECTIVE.test(t)) add(node.getStart(), node.getEnd(), false);
    }
    (ts.getLeadingCommentRanges(src, node.getFullStart()) || []).forEach((c) => add(c.pos, c.end, true));
    (ts.getTrailingCommentRanges(src, node.getEnd()) || []).forEach((c) => add(c.pos, c.end, true));
    ts.forEachChild(node, visit);
  })(sf);
  ranges.sort((a, b) => a[0] - b[0]);
  let o = src;
  for (let i = ranges.length - 1; i >= 0; i--) o = o.slice(0, ranges[i][0]) + o.slice(ranges[i][1]);
  return o;
}

if (require.main === module) {
  const mode = process.argv[2];
  let n = 0;
  for (const f of process.argv.slice(3)) {
    const src = fs.readFileSync(f, "utf8");
    const res = strip(src);
    if (res !== src) {
      n++;
      if (mode === "--write") fs.writeFileSync(f, res);
    }
  }
  console.log(`ts ${mode === "--write" ? "modificados" : "a modificar"}: ${n}`);
}
