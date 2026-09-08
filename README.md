# Spielbereich – Entwürfe

Statische Entwurfsseiten, ohne Generator und ohne Framework. Alle Pfade
sind relativ, die Seiten laufen im Unterverzeichnis einer
GitHub-Projektseite genauso wie unter einer eigenen Domain.

| Seite | Inhalt |
| --- | --- |
| [`/`](https://justazes.github.io/spielbereich/) | **carus.one** – Ankündigungsseite für das geplante Daten- und KI-Ökosystem des Universitätsklinikums Dresden |
| [`/brueckner/`](https://justazes.github.io/spielbereich/brueckner/) | **Brückner Haustechnik & Ausbau** – Aufbau-Animation des Logos |

Beide Seiten tragen `noindex, nofollow` und sind interne Entwürfe.

## Aufbau

```
index.html              carus.one, alle Texte als echtes HTML
brueckner/index.html    Logo-Animation, SVG eingebettet
css/teaser.css          carus.one: Einstiegsanimation
css/page.css            carus.one: Gestaltungssystem des Inhalts
css/brueckner.css       Brückner: der komplette Aufbau der Animation
js/teaser.js            carus.one: WebGL-2-Szene
js/page.js              carus.one: Einblenden, Navigationsleiste
js/brueckner.js         Brückner: Start und Neustart
img/                    Symbol, Linkvorschau, synthetische Thoraxaufnahme
tools/                  die Erzeuger von Bildern und Logo-SVG
.nojekyll               GitHub Pages liefert die Dateien unverändert aus
```

## Örtlich ansehen

```sh
python3 -m http.server 8000
# http://127.0.0.1:8000/            carus.one
# http://127.0.0.1:8000/brueckner/  Logo-Animation
```

## Als GitHub Page veröffentlichen

Einmalig in **Settings → Pages**:

* **Source:** „Deploy from a branch"
* **Branch:** `main`, Ordner `/ (root)` → **Save**

Danach liegt die Seite unter `https://justazes.github.io/spielbereich/`.
Jeder Push auf `main` veröffentlicht den neuen Stand; ein Workflow ist
nicht nötig.

## Erzeugte Dateien neu bauen

```sh
pip install numpy pillow

# carus.one: synthetische Thoraxaufnahme, Symbol und Linkvorschau
python3 tools/carus-xray.py
python3 tools/carus-brand.py

# Brückner: Logo-SVG erzeugen und in die Seite einsetzen
python3 tools/brueckner-logo.py   # schreibt tools/brueckner-logo.snippet.html
python3 tools/embed-logo.py       # ersetzt den Bereich zwischen den logo-Marken
```

Das Logo muss eingebettet bleiben – nur eingebettetes SVG lässt sich per
CSS animieren. `tools/brueckner-logo.json` enthält die vermessene
Geometrie; `tools/brueckner-logo.py` erzeugt daraus das SVG.

## Beim Umzug auf eine andere Adresse anpassen

* `og:url` und `og:image` in `index.html` (absolute Adressen, weil die
  meisten Dienste relative Vorschaubilder nicht auswerten)
* `<meta name="robots" content="noindex, nofollow">` entfernen, wenn eine
  Seite gefunden werden soll
* eine kanonische Adresse (`<link rel="canonical">`) setzen
* Impressum, Datenschutzerklärung und einen Verantwortlichen ergänzen –
  für eine öffentliche Seite in Deutschland Pflicht und derzeit bewusst
  nicht enthalten

## Geprüft

**carus.one:** axe-core ohne Verstöße bei 1280 und 390 Pixel, Kontraste
über den Anforderungen von WCAG 2.2 AA, keine waagerechten Überläufe bei
1440 / 768 / 390 / 320 Pixel, Textvergrößerung bis 200 Prozent,
vollständige Tastaturbedienung, lesbar ohne JavaScript und ohne WebGL 2.

**Brückner:** axe-core ohne Verstöße, Aufbau in sechs Zeitschnitten
kontrolliert, Neustart-Taste, kein Überlauf bei 390 und 320 Pixel,
ruhiges Endbild bei reduzierter Bewegung.
