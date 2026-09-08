#!/usr/bin/env python3
"""Erzeugt das synthetische Thorax-Roentgenbild fuer den carus.one-Teaser (/index4/).

Kein echtes Patientenbild: das Bild wird rein rechnerisch aus einem
Schwaechungsmodell aufgebaut (helle Werte = hohe Dichte) und anschliessend
weichgezeichnet, verrauscht und vignettiert. Ergebnis ist ein RGBA-PNG mit
konstanter kuehl-weisser Farbe; die Dichte steckt im Alphakanal, damit sich das
Bild ohne harten schwarzen Rahmen in die dunkle Seite einfuegt.

    python3 tools/carus-xray.py

schreibt img/carus-xray-thorax.png
"""

import numpy as np
from PIL import Image, ImageFilter

N = 512                     # Kantenlaenge des Bildes
TINT = (223, 232, 245)      # Filmfarbe, passt zur Palette der Seite
OUT = 'img/carus-xray-thorax.png'


def smooth(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def band(d, w):
    """Weiche Linie um d = 0 mit Halbwertsbreite w."""
    return np.exp(-(d / w) ** 2)


def build():
    ax = np.linspace(-1.0, 1.0, N)
    X, Y = np.meshgrid(ax, ax)
    A = np.abs(X)

    # --- Zwerchfell zuerst: es begrenzt Lunge, Herz und Wirbelsaeule -------
    dome_r = 0.52 - 0.17 * np.exp(-((X + 0.34) / 0.32) ** 2)   # rechte Kuppel steht hoeher
    dome_l = 0.60 - 0.15 * np.exp(-((X - 0.36) / 0.32) ** 2)
    mix = smooth(-0.10, 0.10, X)                               # stetiger Uebergang am Herzen
    dome = dome_r * (1.0 - mix) + dome_l * mix

    # --- Rumpf als Vereinigung anatomischer Teile -------------------------
    thorax = smooth(1.03, 0.92, (np.abs(X / 0.66) ** 2.6 + np.abs((Y - 0.06) / 0.86) ** 3.0) ** 0.5)
    neck = smooth(0.24, 0.18, A) * smooth(-0.58, -0.72, Y)
    belly = smooth(0.64, 0.48, A + 0.07 * smooth(0.3, 1.0, Y)) \
        * smooth(0.16, 0.34, Y)                                # Oberbauch bis zum Bildrand
    shoulder = np.zeros_like(X)
    for side in (-1.0, 1.0):
        shoulder = np.maximum(shoulder, smooth(1.25, 0.72, np.sqrt(
            ((X - side * 0.66) / 0.34) ** 2 + ((Y + 0.56) / 0.34) ** 2)))
    body = np.clip(thorax + neck + belly + 0.85 * shoulder, 0.0, 1.0)

    att = 0.17 * body
    att += 0.10 * band(A - 0.62, 0.055) * thorax          # Thoraxwand als helle Kante

    # --- Belueftete Lunge -------------------------------------------------
    lung = np.zeros_like(X)
    for side in (-1.0, 1.0):
        u = (X - side * 0.31) / 0.235
        v = (Y - 0.00) / 0.58
        lung = np.maximum(lung, smooth(1.04, 0.68, np.sqrt(u * u + v * v)))
    lung *= smooth(-0.66, -0.46, Y)                      # Spitzen unter den Schluesselbeinen
    lung *= smooth(0.02, -0.05, Y - dome)                # unten vom Zwerchfell begrenzt
    att -= 0.185 * lung

    # --- Trachea und Hauptbronchien ---------------------------------------
    att -= 0.09 * band(A - 0.025, 0.032) * smooth(-0.80, -0.72, Y) * smooth(-0.10, -0.20, Y)
    for side in (-1.0, 1.0):
        att -= 0.045 * band(Y - 0.14 - 0.5 * (side * X - 0.02), 0.03) \
            * smooth(0.05, 0.11, side * X) * smooth(0.30, 0.22, side * X)

    # --- Rippen -----------------------------------------------------------
    # Hintere Rippen: am Wirbelkoerper fast waagerecht, lateral steil abfallend.
    for k in range(9):
        y0 = -0.58 + 0.145 * k
        d = Y - (y0 + 0.62 * A ** 1.75)
        att += 0.07 * band(d, 0.020) * body * (0.55 + 0.9 * lung)
    # Vordere Rippen laufen gegenlaeufig und bleiben deutlich schwaecher.
    for k in range(5):
        y1 = -0.16 + 0.185 * k
        d = Y - (y1 - 0.40 * A ** 1.5)
        att += 0.026 * band(d, 0.026) * body * (0.35 + 0.9 * lung)

    # --- Schluesselbeine, Schultergelenke, Schulterblaetter ----------------
    t = np.clip((A - 0.05) / 0.55, 0.0, 1.0)
    dcl = Y - (-0.58 - 0.20 * np.sin(np.pi * t))
    att += 0.16 * band(dcl, 0.026) * smooth(0.02, 0.10, A) * smooth(0.64, 0.54, A)
    for side in (-1.0, 1.0):
        r = np.sqrt(((X - side * 0.70) / 0.105) ** 2 + ((Y + 0.48) / 0.115) ** 2)
        att += 0.045 * smooth(1.2, 0.45, r) * body
        dsc = (side * X - 0.40) * 0.85 - (Y + 0.40)
        att += 0.028 * band(dsc, 0.055) * body * smooth(0.34, 0.44, side * X) * smooth(0.06, -0.06, Y)

    # --- Wirbelsaeule mit Bandscheiben ------------------------------------
    spine = band(A - 0.015, 0.062) * smooth(-0.86, -0.76, Y) * smooth(0.06, -0.04, Y - dome - 0.18)
    spine *= 1.0 - 0.45 * smooth(-0.02, 0.16, Y)               # hinter dem Herzen schwaecher
    att += 0.135 * spine
    att -= 0.04 * spine * band(np.sin(Y * np.pi / 0.095), 0.3)

    # --- Mediastinum, Herz, Aortenbogen ------------------------------------
    med = band(A - 0.045, 0.05) * smooth(-0.74, -0.62, Y) * smooth(0.10, 0.00, Y - dome)
    att += 0.09 * med
    # Herzschatten: asymmetrisch, Spitze nach links des Patienten (rechts im Bild),
    # oben ohne eigene Kante, damit er in das Mediastinum uebergeht.
    hx = (X - 0.10 - 0.16 * (Y - 0.20)) / 0.245
    hy = (Y - 0.20) / 0.30
    heart = smooth(1.02, 0.84, (np.abs(hx) ** 2.1 + np.abs(hy) ** 2.5) ** 0.5)
    heart *= smooth(-0.16, 0.06, Y)
    heart *= smooth(0.05, -0.03, Y - dome)
    att += 0.215 * heart
    knob = smooth(1.1, 0.5, np.sqrt(((X - 0.11) / 0.07) ** 2 + ((Y + 0.10) / 0.065) ** 2))
    att += 0.095 * knob

    # --- Oberbauch --------------------------------------------------------
    below = smooth(0.0, 0.05, Y - dome)
    att += 0.30 * below * body
    att += 0.09 * band(Y - dome - 0.015, 0.022) * body     # helle Zwerchfellkuppe
    # Magenblase links des Patienten, also rechts im Bild
    att -= 0.10 * smooth(1.1, 0.5, np.sqrt(((X - 0.30) / 0.13) ** 2 + ((Y - 0.72) / 0.09) ** 2))

    att = np.clip(att, 0.0, 1.0)

    # --- Filmcharakter ----------------------------------------------------
    img = Image.fromarray((att * 255.0).astype(np.uint8), 'L')
    img = img.filter(ImageFilter.GaussianBlur(radius=N / 240.0))
    a = np.asarray(img).astype(np.float32) / 255.0

    rng = np.random.default_rng(11)
    a += rng.normal(0.0, 0.011, a.shape) * (0.35 + a)        # Quantenrauschen
    r = np.sqrt(X * X + Y * Y) / 1.414
    a *= 1.0 - 0.40 * r ** 2.4                               # Vignette
    a = np.clip(a, 0.0, 1.0) ** 1.05
    a = np.clip(a * 0.94, 0.0, 1.0)

    rgba = np.empty((N, N, 4), np.uint8)
    for i, c in enumerate(TINT):
        rgba[:, :, i] = c
    rgba[:, :, 3] = (a * 255.0).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


if __name__ == '__main__':
    build().save(OUT, optimize=True)
    print('geschrieben:', OUT)
