#!/usr/bin/env python3
"""Setzt die Einstiegsanimation der Ankuendigungsseite in die anderen ein.

    python3 tools/embed-teaser.py

Die Animation steht genau einmal im Haus: in ankuendigung/index.html
zwischen <!-- teaser:start --> und <!-- teaser:end -->. Die Seiten
teaser/ und praesentation/ tragen dieselben Marken und bekommen den
Abschnitt von hier eingesetzt - so laufen sie nicht auseinander.
(backup/ nicht: dort liegt der Film, gerade weil die Animation nicht
laufen kann.)

Alle Seiten liegen eine Ebene unter der Wurzel, die relativen Pfade
passen deshalb unveraendert. Angepasst wird nur, was sich zwischen
Einstieg und Vortrag unterscheidet:

  * data-c1-present statt id="top" - nur damit legt teaser.js seine
    Steuerung an (Kapitel, Springen), siehe js/present.js
  * der Knopf "Die Vision entdecken" faellt weg, es liegt kein Inhalt
    darunter
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SOURCE = os.path.join(ROOT, 'ankuendigung', 'index.html')
TARGETS = ['teaser/index.html', 'praesentation/index.html']

START = '<!-- teaser:start'
END = '<!-- teaser:end -->'


def read(path):
    with open(path, encoding='utf-8') as fh:
        return fh.read()


def slot(text, path):
    """Anfang und Ende des Bereichs zwischen den Marken, dazu die
    Einrueckung der Startmarke."""
    i = text.find(START)
    j = text.find(END, i + 1)
    if i < 0 or j < 0:
        sys.exit('%s: keine Marken teaser:start / teaser:end gefunden' % path)
    line = text[:i].split('\n')[-1]
    return text.index('-->', i) + 3, j, len(line) - len(line.lstrip())


def dedent(sec):
    """Die Einrueckung, die der Abschnitt in index.html hat, abziehen -
    die Zielseite setzt ihre eigene."""
    first = sec.split('\n')[0]
    n = len(first) - len(first.lstrip())
    return '\n'.join(l[n:] if l[:n].strip() == '' else l for l in sec.split('\n'))


def for_presentation(sec):
    sec = sec.replace(
        '<section class="c1" data-c1 id="top" aria-label="Einstiegsanimation von carus.one">',
        '<section class="c1" data-c1 data-c1-present aria-label="carus.one – Sequenz">')
    sec = re.sub(r'\n *<a class="c1-enter"[^\n]*\n', '\n', sec)
    if 'data-c1-present' not in sec or 'c1-enter' in sec:
        sys.exit('ankuendigung/index.html: der Teaser sieht anders aus als '
                 'erwartet, bitte tools/embed-teaser.py nachziehen')
    return sec


def main():
    src = read(SOURCE)
    i, j, _ = slot(src, SOURCE)
    sec = for_presentation(dedent(src[i:j].strip('\n')))
    for rel in TARGETS:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            print('%s: gibt es nicht, uebersprungen' % rel)
            continue
        page = read(path)
        i, j, indent = slot(page, rel)
        pad = ' ' * indent
        body = '\n'.join((pad + l if l.strip() else l) for l in sec.split('\n'))
        out = page[:i] + '\n' + body + '\n' + pad + page[j:]
        if out == page:
            print('%s: unveraendert' % rel)
            continue
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(out)
        print('%s: %d Bytes Animation eingesetzt' % (rel, len(body)))


if __name__ == '__main__':
    main()
