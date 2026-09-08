# Spielbereich – carus.one

Statische Entwurfsseiten, ohne Generator und ohne Framework. Alle Pfade
sind relativ, die Seiten laufen im Unterverzeichnis einer
GitHub-Projektseite genauso wie unter einer eigenen Domain.

| Seite | Wofür |
| --- | --- |
| [`/`](https://justazes.github.io/spielbereich/) | **Ankündigungsseite** – die Einstiegssequenz und darunter vier Abschnitte zum Lesen |
| [`/teaser/`](https://justazes.github.io/spielbereich/teaser/) | **Sequenz im Vollbild** – nur die Animation, über die Tastatur geführt |
| [`/praesentation/`](https://justazes.github.io/spielbereich/praesentation/) | **Vortragsseite** – die Sequenz als Auftakt, danach sechs Folien |
| [`/backup/`](https://justazes.github.io/spielbereich/backup/) | **Rückfall** – dieselbe Sequenz als MP4 zum Ansehen und Herunterladen |

Alle Seiten tragen `noindex, nofollow` und sind interne Entwürfe. Die
Logo-Animation für Brückner Haustechnik & Ausbau lag früher unter
`/brueckner/` und steht jetzt im Repo
[Basteleien](https://github.com/JustAzes/Basteleien).

## Tasten

Auf `/teaser/`: **Leertaste** hält an und setzt fort, **← →** springen ein
Kapitel zurück oder vor, **Pos1 / Ende** an Anfang oder Finale, **R**
startet neu, **F** schaltet das Vollbild.

Auf `/praesentation/`: **← →**, **Bild auf/ab** und **Leertaste** wechseln
die Folie, **1** bis **7** springen direkt, **Pos1 / Ende** an Anfang oder
Ende, **P** hält die Animation der Titelfolie an, **R** startet sie neu,
**F** schaltet das Vollbild. **Strg+P** ergibt ein PDF mit einer Folie je
Seite. Auf dem Tablett wird gewischt, mit der Maus an den linken oder
rechten Rand geklickt.

## Aufbau

```
index.html                  die Ankündigungsseite, alle Texte als echtes HTML
teaser/index.html           die Sequenz allein, für den Beamer
praesentation/index.html    Folien, die Sequenz als Auftakt
backup/index.html           Seite um den Film
backup/*.mp4                der Film selbst
css/teaser.css              die Sequenz
css/page.css                Gestaltungssystem der Ankündigungsseite
css/deck.css                Gestaltungssystem der Folien
css/present.css             Abweichungen für das Vollbild
css/backup.css              die Rückfallseite
js/teaser.js                die WebGL-2-Szene
js/page.js                  Einblenden, Navigationsleiste
js/present.js               Tasten für das Vollbild
js/deck.js                  Folienschaltung
img/                        Symbol, Linkvorschau, Thoraxaufnahme, Standbild
tools/                      die Erzeuger von Bildern, Film und abgeleiteten Seiten
.nojekyll                   GitHub Pages liefert die Dateien unverändert aus
```

Die Animation steht **genau einmal** im Haus: in `index.html` zwischen
`<!-- teaser:start -->` und `<!-- teaser:end -->`. Die Seiten `/teaser/`
und `/praesentation/` tragen dieselben Marken und bekommen den Abschnitt
eingesetzt. Nach jeder Änderung an der Animation also:

```sh
python3 tools/embed-teaser.py
```

## Örtlich ansehen

```sh
python3 -m http.server 8000
# http://127.0.0.1:8000/
```

`/teaser/` und `/backup/` laufen auch ohne Server, direkt aus dem Ordner.

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

### Film neu abnehmen

Der Film ist keine Bildschirmaufnahme: die Schleife der Animation wird
angehalten und jedes Bild einzeln angefordert, damit der Lauf
gleichmässig ist. Gebraucht werden Playwright und ffmpeg.

```sh
python3 -m http.server 8000 &
node tools/record-teaser.js          # 800 Bilder, 20 je Sekunde, 40 s
```

Das Standbild der Rückfallseite ist ein Bild aus dem Film:

```sh
ffmpeg -y -sseof -0.15 -i backup/carus-one-teaser-1080p.mp4 \
  -frames:v 1 -q:v 3 img/carus-teaser-poster.jpg
```

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

**Ankündigungsseite:** axe-core ohne Verstöße bei 1280 und 390 Pixel,
Kontraste über den Anforderungen von WCAG 2.2 AA, keine waagerechten
Überläufe bei 1440 / 768 / 390 / 320 Pixel, Textvergrößerung bis 200
Prozent, vollständige Tastaturbedienung, lesbar ohne JavaScript und ohne
WebGL 2. Die sechs Datenpunkte der Sequenz wurden einzeln angesprungen
und ausgemessen: bei 280 / 320 / 360 / 390 / 768 / 1024 / 1440 / 1920
Pixel steht jede Zeile vollständig im Bild.

**Vollbild-Sequenz:** kein Scrollweg in beiden Richtungen, Leertaste hält
an und setzt fort (nachgemessen am Fortschritt), alle neun Kapitel
vorwärts und rückwärts angesprungen, axe-core ohne Verstöße bei 1920 und
390 Pixel, ruhiges Endbild bei reduzierter Bewegung, lesbar ohne
JavaScript.

**Vortragsseite:** alle sieben Folien bei 1920 / 1440 / 768 / 390 Pixel
ohne Überlauf durchgeblättert, Tasten und Klickflächen geprüft, die
Animation hält an, sobald ihre Folie ruht, und läuft beim Zurückblättern
weiter, axe-core ohne Verstöße bei 1920 / 1440 / 390 Pixel, bei 200
Prozent Textgröße bleibt alles erreichbar (die Folie rollt, Pfeil
auf/ab), ohne JavaScript stehen alle sieben Folien lesbar untereinander.

**Rückfallseite:** Film und Standbild werden ausgeliefert, das
Herunterladen angestossen, axe-core ohne Verstöße, kein Überlauf bei 1440
und 390 Pixel, kommt ohne JavaScript aus.

**Der Film:** 1920 × 1080, H.264 (High), 20 Bilder je Sekunde, genau 800
Bilder, 40,00 Sekunden, ohne Ton, etwa 33 MB. Vollständig dekodiert ohne
Fehler; das letzte Bild zeigt den Abschluss samt Fusszeile. Das Abspielen
im Browser liess sich hier nicht prüfen – das Chromium dieser Umgebung
bringt keinen H.264-Dekoder mit. In Chrome, Edge, Safari, Firefox,
PowerPoint und Keynote ist H.264 der übliche Weg.
