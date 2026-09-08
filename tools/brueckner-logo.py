# -*- coding: utf-8 -*-
"""Erzeugt templates/brueckner-logo.html: das Brueckner-Logo als Inline-SVG.

Die Geometrie von Dach und Waenden ist aus der Logovorlage ausgemessen:
Dachfirst (432,87), Neigung 0.882, Strichbreite 20; die Waende sind 4,6
breit bei x=291 und x=565 und laufen von y=239 bis y=348. Auch die
Farbverlaeufe sind aus der Vorlage abgegriffen. Tropfen, Wasserringe und
Schriftzug liegen als vektorisierte Pfade in brueckner-logo.json daneben.

Alle Koordinaten sind Pixel der Vorlage, damit sich Messwerte direkt
uebertragen lassen. Neu erzeugen:

    python3 tools/brueckner-logo.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(os.path.join(HERE, 'brueckner-logo.json')))

# --- ausgemessene Geometrie --------------------------------------------
# Dachfirst (432,87), Neigung 0.882, Kamin auf dem rechten Schenkel.
ROOF = 'M222 272L432 87L521 165L521 118L570 118L570 209L642 272'
WALL = [('l', 288.7), ('r', 562.7)]          # x-Anfang der 4,6 breiten Striche
WALL_Y0, WALL_H = 239, 109

# --- ausgemessene Farbverlaeufe ----------------------------------------
GOLD = [(0.00, '#fdf7a8'), (0.11, '#ece090'), (0.20, '#e2cc82'), (0.23, '#ddc87c'),
        (0.29, '#d5bb74'), (0.34, '#d0b46e'), (0.39, '#caac67'), (0.51, '#bea05a'),
        (0.65, '#b7924b'), (0.80, '#a67c33'), (0.95, '#96651f'), (1.00, '#8c5c15')]
WALLG = [(0.00, '#7c5230'), (0.10, '#a07638'), (0.19, '#b58f50'), (0.28, '#c8a867'),
         (0.38, '#dbc982'), (0.47, '#e7e298'), (0.56, '#e3de94'), (0.65, '#d1c980'),
         (0.74, '#ccad6b'), (0.83, '#b79252'), (0.93, '#a17739'), (1.00, '#8f6530')]
TEXTG = [(0.00, '#b7a578'), (0.10, '#c9ba86'), (0.20, '#ddd08c'), (0.30, '#e9e096'),
         (0.40, '#f2eda6'), (0.53, '#fcf99d'), (0.65, '#f0e894'), (0.78, '#e2d488'),
         (0.88, '#d5c47a'), (1.00, '#c0b078')]

# Spritzer beim Aufprall: Richtung und Groesse
SPLASH = [(-58, -34, 3.2), (-40, -58, 2.4), (-19, -70, 1.9), (2, -76, 1.6),
          (21, -68, 2.1), (43, -55, 2.8), (61, -30, 3.0), (-74, -14, 2.2), (76, -12, 2.4)]


def stops(lst):
    return ''.join('<stop offset="%g" stop-color="%s"/>' % s for s in lst)


def paths(key):
    return ''.join('<path d="%s"/>' % p['d'] for p in T[key])


svg = '''<!-- Automatisch erzeugt von tools/brueckner-logo.py - nicht von Hand bearbeiten. -->
<svg class="bk-logo" data-bk-logo viewBox="205 66 454 414" role="img" aria-labelledby="bk-logo-title" focusable="false">
<title id="bk-logo-title">Br&#252;ckner Haustechnik &amp; Ausbau GmbH</title>
<defs>
<radialGradient id="bkGold" gradientUnits="userSpaceOnUse" cx="468" cy="118" r="210" gradientTransform="translate(468 118) rotate(-45) scale(1.9 1) translate(-468 -118)">%(gold)s</radialGradient>
<linearGradient id="bkWallG" gradientUnits="userSpaceOnUse" x1="0" y1="%(wy0)d" x2="0" y2="%(wy1)d">%(wallg)s</linearGradient>
<linearGradient id="bkTextG" gradientUnits="userSpaceOnUse" x1="248" y1="0" x2="616" y2="0">%(textg)s</linearGradient>
<linearGradient id="bkTrailG" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#2f8cca" stop-opacity="0"/>
<stop offset="0.62" stop-color="#2f8cca" stop-opacity="0.18"/>
<stop offset="1" stop-color="#7cc4f0" stop-opacity="0.75"/>
</linearGradient>
<radialGradient id="bkFlashG">
<stop offset="0" stop-color="#d8efff" stop-opacity="0.9"/>
<stop offset="0.45" stop-color="#4aa5e0" stop-opacity="0.35"/>
<stop offset="1" stop-color="#2f8cca" stop-opacity="0"/>
</radialGradient>
</defs>

<!-- Wasserringe des fertigen Logos -->
<g class="bk-rings">%(rings)s</g>

<!-- kurzlebige Aufprall-Effekte -->
<ellipse class="bk-flash" cx="436" cy="320" rx="118" ry="40" fill="url(#bkFlashG)" aria-hidden="true"/>
<g class="bk-impact" aria-hidden="true">%(impact)s</g>

<!-- Tropfen: aussen der Flug, innen die Stauchung beim Aufprall -->
<g class="bk-drop"><g class="bk-drop__body">
<ellipse class="bk-trail" cx="436" cy="58" rx="6.5" ry="120" fill="url(#bkTrailG)" aria-hidden="true"/>
%(drop)s%(inner)s
</g></g>

<g class="bk-splash" aria-hidden="true">%(splash)s</g>

<g class="bk-wall bk-wall--l"><rect x="%(wlx)g" y="%(wy0)d" width="4.6" height="%(wh)d"/></g>
<g class="bk-wall bk-wall--r"><rect x="%(wrx)g" y="%(wy0)d" width="4.6" height="%(wh)d"/></g>

<g class="bk-roof"><path class="bk-roof__line" d="%(roof)s"/></g>

<g class="bk-name">%(name)s</g>
<g class="bk-sub">%(sub)s</g>
</svg>
''' % {
    'gold': stops(GOLD), 'wallg': stops(WALLG), 'textg': stops(TEXTG),
    'rings': paths('rings'), 'drop': paths('drop'), 'inner': paths('inner'),
    'name': paths('name'), 'sub': paths('sub'), 'roof': ROOF,
    'wlx': WALL[0][1], 'wrx': WALL[1][1],
    'wy0': WALL_Y0, 'wy1': WALL_Y0 + WALL_H, 'wh': WALL_H,
    'impact': ''.join(
        '<ellipse class="bk-impact__ring" cx="436" cy="322" rx="34" ry="10" '
        'vector-effect="non-scaling-stroke" style="--i:%d"/>' % i for i in range(3)),
    'splash': ''.join(
        '<circle class="bk-splash__d" cx="436" cy="314" r="%g" style="--dx:%gpx;--dy:%gpx;--i:%d"/>'
        % (r, dx, dy, i) for i, (dx, dy, r) in enumerate(SPLASH)),
}

out = os.path.join(HERE, 'brueckner-logo.snippet.html')
open(out, 'w').write(svg)
print('%s: %d Bytes' % (out, len(svg)))
