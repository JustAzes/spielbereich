#!/usr/bin/env python3
"""Erzeugt Symbol und Linkvorschau fuer carus.one (/index4/).

    python3 tools/carus-brand.py

schreibt img/carus-icon.svg, carus-icon-180.png und carus-share.png
Rein rechnerisch, keine externen Vorlagen.
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BG = (5, 7, 11)
ICON_SVG = 'img/carus-icon.svg'
ICON_PNG = 'img/carus-icon-180.png'
SHARE = 'img/carus-share.png'


def svg_icon():
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
        '  <rect width="64" height="64" rx="14" fill="#05070b"/>\n'
        '  <g stroke="#8ab4e8" stroke-width="1.4" stroke-opacity="0.55" fill="none">\n'
        '    <path d="M20 42 L32 26 L46 34"/>\n'
        '    <path d="M20 42 L46 34"/>\n'
        '  </g>\n'
        '  <g fill="#eef4fd">\n'
        '    <circle cx="32" cy="26" r="5"/>\n'
        '    <circle cx="20" cy="42" r="2.6"/>\n'
        '    <circle cx="46" cy="34" r="2.6"/>\n'
        '  </g>\n'
        '</svg>\n'
    )


def stars(w, h, n, seed):
    rng = np.random.default_rng(seed)
    img = np.zeros((h, w), np.float32)
    xs = rng.integers(0, w, n)
    ys = rng.integers(0, h, n)
    br = rng.random(n) ** 2.4
    for x, y, b in zip(xs, ys, br):
        img[y, x] = max(img[y, x], b)
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'L')
    from PIL import ImageFilter
    return im.filter(ImageFilter.GaussianBlur(0.7))


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
              '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def share():
    w, h = 1200, 630
    base = Image.new('RGB', (w, h), BG)
    # weiches Leuchten in der Mitte
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w * 0.5) / (w * 0.42)) ** 2 + ((yy - h * 0.52) / (h * 0.5)) ** 2)
    glow = np.clip(1 - r, 0, 1) ** 2.2
    arr = np.asarray(base).astype(np.float32)
    for i, c in enumerate((44, 60, 92)):
        arr[:, :, i] += glow * c
    sky = np.asarray(stars(w, h, 1400, 5)).astype(np.float32) / 255
    for i in range(3):
        arr[:, :, i] += sky * (210 if i == 2 else 195)
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')

    d = ImageDraw.Draw(im)
    f1, f2 = font(96), font(30)
    t = 'carus.one'
    tw = d.textlength(t, font=f1)
    d.text(((w - tw) / 2, h * 0.36), t, font=f1, fill=(245, 248, 252))
    s = 'Daten und KI für die Universitätsmedizin'
    sw = d.textlength(s, font=f2)
    d.text(((w - sw) / 2, h * 0.56), s, font=f2, fill=(160, 180, 208))
    s2 = 'Universitätsklinikum Dresden · im Aufbau'
    sw2 = d.textlength(s2, font=f2)
    d.text(((w - sw2) / 2, h * 0.66), s2, font=f2, fill=(120, 138, 164))
    return im


if __name__ == '__main__':
    open(ICON_SVG, 'w', encoding='utf-8').write(svg_icon())
    ic = Image.new('RGBA', (180, 180), (5, 7, 11, 255))
    d = ImageDraw.Draw(ic)
    d.rounded_rectangle([0, 0, 179, 179], 40, fill=(5, 7, 11, 255))
    d.line([56, 118, 90, 73], fill=(138, 180, 232, 140), width=4)
    d.line([90, 73, 129, 96], fill=(138, 180, 232, 140), width=4)
    d.line([56, 118, 129, 96], fill=(138, 180, 232, 140), width=4)
    d.ellipse([76, 59, 104, 87], fill=(238, 244, 253, 255))
    d.ellipse([49, 111, 63, 125], fill=(238, 244, 253, 255))
    d.ellipse([122, 89, 136, 103], fill=(238, 244, 253, 255))
    ic.save(ICON_PNG, optimize=True)
    share().save(SHARE, optimize=True)
    print('geschrieben:', ICON_SVG, ICON_PNG, SHARE)
