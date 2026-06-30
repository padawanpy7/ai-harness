import sys

REPL = {
    "—": "-",    # em dash
    "–": "-",    # en dash
    "‒": "-",    # figure dash
    "―": "-",    # horizontal bar
    "→": "->",   # right arrow
    "←": "<-",   # left arrow
    "“": '"', "”": '"', "„": '"',   # double quotes
    "‘": "'", "’": "'", "‚": "'",    # single quotes
    "…": "...",  # ellipsis
    " ": " ",    # non-breaking space
    "•": "-",    # bullet
    "·": "-",    # middle dot
    "✓": "OK", "✅": "OK", "❌": "X",  # check / cross marks
}

def convert(s):
    for k, v in REPL.items():
        s = s.replace(k, v)
    return s

if __name__ == "__main__":
    mode = sys.argv[1]
    n = 0
    for f in sys.argv[2:]:
        try:
            src = open(f, encoding="utf-8").read()
        except Exception:
            continue
        res = convert(src)
        if res != src:
            n += 1
            if mode == "--fix":
                open(f, "w", encoding="utf-8").write(res)
    print(f"{'convertidos' if mode == '--fix' else 'a convertir'}: {n}")
