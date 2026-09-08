#!/usr/bin/env python3
"""Setzt das erzeugte Logo-SVG in brueckner/index.html ein.

    python3 tools/brueckner-logo.py   # schreibt tools/brueckner-logo.snippet.html
    python3 tools/embed-logo.py       # ersetzt den Bereich zwischen den Marken

So bleibt das SVG in der Seite eingebettet - nur eingebettetes SVG laesst
sich per CSS animieren - und trotzdem reproduzierbar.
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PAGE = os.path.join(ROOT, 'brueckner', 'index.html')
SNIP = os.path.join(HERE, 'brueckner-logo.snippet.html')

START = '<!-- logo:start'
END = '<!-- logo:end -->'


def main():
    page = open(PAGE, encoding='utf-8').read()
    snippet = open(SNIP, encoding='utf-8').read().strip()

    i = page.index(START)
    i = page.index('-->', i) + 3
    j = page.index(END)
    out = page[:i] + '\n' + snippet + '\n    ' + page[j:]
    open(PAGE, 'w', encoding='utf-8').write(out)
    print('%s: %d Bytes SVG eingesetzt' % (PAGE, len(snippet)))


if __name__ == '__main__':
    main()
