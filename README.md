# carus.one – Ankündigungsseite (Entwurf)

Eigenständige statische Seite für das geplante Daten- und KI-Ökosystem
**carus.one** des Universitätsklinikums Dresden. Der Einstieg ist eine
WebGL-Animation, darunter folgen vier Inhaltsabschnitte: Vision,
Fundament, Lebenszyklus, lernendes Ökosystem.

**Status: Entwurf, intern.** Die Seite beschreibt ein Zielbild; die
dargestellten Fähigkeiten entstehen in unterschiedlichen Ausbaustufen.
Alle klinischen Werte in der Animation sind synthetische Beispieldaten.

## Aufbau

```
index.html          die ganze Seite, alle Texte als echtes HTML
css/teaser.css      Einstiegsanimation
css/page.css        Gestaltungssystem des Informationsbereichs
js/teaser.js        WebGL-2-Szene, Kameraführung, projizierte Schrift
js/page.js          Einblenden beim Scrollen, Navigationsleiste
img/                Symbol, Linkvorschau, synthetische Thoraxaufnahme
tools/              die Erzeuger der Bilder (Python, numpy + Pillow)
```

Kein Generator, kein Framework, keine externen Abhängigkeiten. Alle
Pfade sind relativ – die Seite läuft im Unterverzeichnis einer
GitHub-Projektseite genauso wie unter einer eigenen Domain.

## Örtlich ansehen

```sh
python3 -m http.server 8000
# http://127.0.0.1:8000/
```

## Als GitHub Page veröffentlichen

Einmalig in **Settings → Pages**:

* **Source:** „Deploy from a branch"
* **Branch:** `main`, Ordner `/ (root)`

Danach liegt die Seite unter
`https://justazes.github.io/spielbereich/`. Jeder Push auf `main`
veröffentlicht den neuen Stand; ein Workflow ist nicht nötig.

Die Datei `.nojekyll` schaltet die Jekyll-Verarbeitung ab, damit
GitHub Pages die Dateien unverändert ausliefert.

## Bilder neu erzeugen

```sh
pip install numpy pillow
python3 tools/carus-xray.py    # img/carus-xray-thorax.png
python3 tools/carus-brand.py   # img/carus-icon.svg, -180.png, carus-share.png
```

## Beim Umzug auf eine andere Adresse anpassen

* `og:url` und `og:image` in `index.html` (absolute Adressen, weil die
  meisten Dienste relative Vorschaubilder nicht auswerten)
* `<meta name="robots" content="noindex, nofollow">` entfernen, wenn die
  Seite gefunden werden soll
* eine kanonische Adresse (`<link rel="canonical">`) setzen
* Impressum, Datenschutzerklärung und einen Verantwortlichen ergänzen –
  für eine öffentliche Seite in Deutschland Pflicht und derzeit bewusst
  nicht enthalten

## Geprüft

axe-core ohne Verstöße bei 1280 und 390 Pixel Breite, Kontraste über den
Anforderungen von WCAG 2.2 AA, keine waagerechten Überläufe bei 1440 /
768 / 390 / 320 Pixel, Textvergrößerung bis 200 Prozent, vollständige
Tastaturbedienung, lesbar ohne JavaScript und ohne WebGL 2.
