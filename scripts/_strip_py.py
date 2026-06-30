import tokenize, io, re, sys

DIRECTIVE = re.compile(r'#\s*(noqa|type:|pragma|fmt:|isort:|ruff:|mypy:|pylint:|pyright:|nosec|coding[:=]|!)')

def strip(src):
    try:
        toks = list(tokenize.generate_tokens(io.StringIO(src).readline))
    except Exception:
        return None
    removals = {}
    for tok in toks:
        if tok.type == tokenize.COMMENT:
            s = tok.string.strip()
            if s.startswith('#!') or DIRECTIVE.match(s):
                continue
            removals.setdefault(tok.start[0], tok.start[1])
    out = []
    for i, line in enumerate(src.splitlines(keepends=True), 1):
        if i in removals:
            kept = line[:removals[i]].rstrip()
            if kept == '':
                continue
            out.append(kept + '\n')
        else:
            out.append(line)
    return ''.join(out)

if __name__ == '__main__':
    mode = sys.argv[1]
    n = 0
    for f in sys.argv[2:]:
        src = open(f, encoding='utf-8').read()
        res = strip(src)
        if res is None:
            print(f"  SKIP (no parsea): {f}")
            continue
        if res != src:
            n += 1
            if mode == '--write':
                open(f, 'w', encoding='utf-8').write(res)
    print(f"py {'modificados' if mode == '--write' else 'a modificar'}: {n}")
