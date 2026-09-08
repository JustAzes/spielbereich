# Spielbereich – Entwurf

Eine statische Entwurfsseite, ohne Generator und ohne Framework. Alle
Pfade sind relativ, die Seite läuft im Unterverzeichnis einer
GitHub-Projektseite genauso wie unter einer eigenen Domain.

Hier liegt **carus.one** – die Ankündigungsseite für das geplante Daten-
und KI-Ökosystem des Universitätsklinikums Dresden:
[`https://justazes.github.io/spielbereich/`](https://justazes.github.io/spielbereich/)

Die Seite trägt `noindex, nofollow` und ist ein interner Entwurf. Die
Logo-Animation für Brückner Haustechnik & Ausbau lag früher unter
`/brueckner/` und steht jetzt im Repo
[Basteleien](https://github.com/JustAzes/Basteleien).

## Aufbau

```
index.html              alle Texte als echtes HTML
css/teaser.css          die Einstiegsanimation
css/page.css            das Gestaltungssystem des Inhalts
js/teaser.js            die WebGL-2-Szene
js/page.js              Einblenden, Navigationsleiste
img/                    Symbol, Linkvorschau, synthetische Thoraxaufnahme
tools/                  die Erzeuger der Bilder
.nojekyll               GitHub Pages liefert die Dateien unverändert aus
```

## Örtlich ansehen

```sh
python3 -m http.server 8000
# http://127.0.0.1:8000/
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

# synthetische Thoraxaufnahme, Symbol und Linkvorschau
python3 tools/carus-xray.py
python3 tools/carus-brand.py
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

axe-core ohne Verstöße bei 1280 und 390 Pixel, Kontraste über den
Anforderungen von WCAG 2.2 AA, keine waagerechten Überläufe bei
1440 / 768 / 390 / 320 Pixel, Textvergrößerung bis 200 Prozent,
vollständige Tastaturbedienung, lesbar ohne JavaScript und ohne WebGL 2.
Die sechs Datenpunkte der Einstiegsanimation wurden einzeln angesprungen
und ausgemessen: bei 280 / 320 / 360 / 390 / 768 / 1024 / 1440 / 1920
Pixel steht jede Zeile vollständig im Bild.
