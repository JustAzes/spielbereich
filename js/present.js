/* ==================================================================== *
 * carus.one - Tastatur fuer den Vortragsmodus (teaser/index.html)
 *
 * Auf der Ankuendigungsseite darf die Sequenz keine Taste abfangen, dort
 * gehoeren Rad und Pfeile dem Scrollen. Hier gibt es nichts zu scrollen,
 * also fuehren die Tasten durch die Geschichte:
 *
 *   Leertaste / K   anhalten und fortsetzen
 *   Pfeil rechts    naechstes Kapitel     Pfeil links   voriges
 *   Bild ab / N     dasselbe              Bild auf / P  dasselbe
 *   Pos1            von vorn              Ende          Finale
 *   R               neu starten           F             Vollbild
 *
 * Ohne die Steuerung aus teaser.js (data-c1-present, WebGL 2 vorhanden)
 * tut diese Datei nichts.
 * ==================================================================== */

(function () {
  'use strict';

  var root = document.querySelector('[data-c1-present]');
  if (!root) { return; }

  var pauseBtn = root.querySelector('[data-c1-pause]');
  var replayBtn = root.querySelector('[data-c1-replay]');
  var hint = document.querySelector('[data-pv-hint]');

  /* Der Hinweis auf die Tasten verschwindet, sobald er gelesen sein kann,
     und kommt bei Bewegung oder Tastendruck kurz zurueck. */
  var hideAt = 0, timer = 0;
  function showHint() {
    if (!hint) { return; }
    hint.classList.remove('is-off');
    hideAt = Date.now() + 5000;
    /* Nur ein Wecker, egal wie oft der Zeiger sich bewegt: sonst legt
       jede Bewegung einen neuen an. */
    if (timer) { return; }
    timer = window.setInterval(function () {
      if (Date.now() < hideAt) { return; }
      hint.classList.add('is-off');
      window.clearInterval(timer);
      timer = 0;
    }, 1000);
  }
  showHint();
  window.addEventListener('pointermove', showHint, { passive: true });

  /* Das naechste oder vorige Kapitel, gemessen am aktuellen Fortschritt.
     Eine kleine Schwelle verhindert, dass "zurueck" mitten in einem
     Kapitel nur an seinen eigenen Anfang springt und dort haengt. */
  function step(dir) {
    var api = root.c1;
    if (!api) { return; }
    var ch = api.chapters;
    var p = api.progress();
    var i;
    if (dir > 0) {
      for (i = 0; i < ch.length; i++) {
        if (ch[i].p > p + 0.002) { api.seek(ch[i].p); return; }
      }
      api.seek(1);
      return;
    }
    for (i = ch.length - 1; i >= 0; i--) {
      if (ch[i].p < p - 0.012) { api.seek(ch[i].p); return; }
    }
    api.seek(0);
  }

  function toggleFullscreen() {
    var el = document.documentElement;
    if (document.fullscreenElement) {
      if (document.exitFullscreen) { document.exitFullscreen(); }
    } else if (el.requestFullscreen) {
      /* Schlaegt fehl, wenn der Browser es verweigert - dann bleibt es
         beim Fenster, ein Fehler waere hier nicht hilfreich. */
      el.requestFullscreen().catch(function () {});
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) { return; }
    /* Liegt der Fokus auf einer Schaltflaeche, gehoert die Leertaste ihr.
       Sonst wuerde ein Tastendruck zweimal wirken. */
    var t = e.target;
    var onControl = t && t !== document.body &&
      typeof t.closest === 'function' && t.closest('button, a');

    var k = e.key;
    var api = root.c1;
    if (k === ' ' || k === 'Spacebar' || k === 'k' || k === 'K') {
      if (onControl) { return; }
      if (pauseBtn) { pauseBtn.click(); }
    } else if (k === 'ArrowRight' || k === 'PageDown' || k === 'n' || k === 'N') {
      step(1);
    } else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'p' || k === 'P') {
      step(-1);
    } else if (k === 'Home') {
      if (api) { api.seek(0); }
    } else if (k === 'End') {
      if (api) { api.seek(1); }
    } else if (k === 'r' || k === 'R') {
      if (onControl) { return; }
      if (replayBtn) { replayBtn.click(); }
    } else if (k === 'f' || k === 'F') {
      toggleFullscreen();
    } else {
      return;
    }
    e.preventDefault();
    showHint();
  });
})();
