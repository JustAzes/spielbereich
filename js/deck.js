/* ==================================================================== *
 * carus.one - Folienschaltung der Vortragsseite
 *
 * Ohne diese Datei stehen alle Folien untereinander: eine lange, lesbare
 * Seite. Erst hier wird daraus ein Vortrag - eine Folie zur Zeit, dazu
 * Tasten, Klickflaechen und ein Fortschrittsbalken.
 *
 *   Pfeil rechts / links, Bild ab / auf, Leertaste   Folie wechseln
 *   Pos1 / Ende                                      erste / letzte Folie
 *   1 bis 9                                          direkt zur Folie
 *   P / R    Animation der Titelfolie anhalten / neu starten
 *   F        Vollbild
 *
 * Die Animation selbst haelt sich an ihren eigenen Beobachter: liegt ihre
 * Folie nicht im Bild, rechnet sie nicht (siehe js/teaser.js).
 * ==================================================================== */

(function () {
  'use strict';

  var deck = document.querySelector('[data-deck]');
  if (!deck) { return; }

  var slides = Array.prototype.slice.call(deck.querySelectorAll('[data-slide]'));
  if (slides.length < 2) { return; }

  var bar = document.querySelector('[data-deck-bar]');
  var no = document.querySelector('[data-deck-no]');
  var rail = document.querySelector('[data-deck-rail]');
  var teaser = document.querySelector('[data-c1-present]');
  var i = 0;

  document.documentElement.classList.add('deck--js');

  /* Die Leiste unten nennt die Tasten und verschwindet, sobald sie
     gelesen sein kann. Bewegung oder Tastendruck holt sie zurueck. */
  var hideAt = 0, timer = 0;
  function wake() {
    if (!bar) { return; }
    bar.classList.remove('is-off');
    hideAt = Date.now() + 5000;
    /* Nur ein Wecker, egal wie oft der Zeiger sich bewegt: sonst legt
       jede Bewegung einen neuen an. */
    if (timer) { return; }
    timer = window.setInterval(function () {
      if (Date.now() < hideAt) { return; }
      bar.classList.add('is-off');
      window.clearInterval(timer);
      timer = 0;
    }, 1000);
  }

  function show(n, focus) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    for (var k = 0; k < slides.length; k++) {
      slides[k].classList.toggle('is-on', k === i);
    }
    if (no) { no.textContent = (i + 1) + ' / ' + slides.length; }
    if (rail) { rail.style.width = ((i + 1) / slides.length * 100).toFixed(1) + '%'; }
    if (focus) {
      /* Fuer die Tastatur: der Titel der neuen Folie wird angesprungen,
         damit Screenreader mitkommen. */
      var h = slides[i].querySelector('h1, h2, [data-slide-title]');
      if (h) {
        h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    }
    wake();
  }

  function go(d) { show(i + d, true); }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) { return; }
    var t = e.target;
    var onControl = t && typeof t.closest === 'function' && t.closest('button, a, input');
    var k = e.key;

    if (k === 'ArrowRight' || k === 'PageDown' || k === 'n' || k === 'N') {
      go(1);
    } else if (k === 'ArrowLeft' || k === 'PageUp') {
      go(-1);
    } else if (k === ' ' || k === 'Spacebar') {
      if (onControl) { return; }
      go(1);
    } else if (k === 'Home') {
      show(0, true);
    } else if (k === 'End') {
      show(slides.length - 1, true);
    } else if (k >= '1' && k <= '9') {
      show(Number(k) - 1, true);
    } else if (k === 'p' || k === 'P') {
      var pause = teaser && teaser.querySelector('[data-c1-pause]');
      if (pause && !onControl) { pause.click(); }
    } else if (k === 'r' || k === 'R') {
      var rep = teaser && teaser.querySelector('[data-c1-replay]');
      if (rep && !onControl) { rep.click(); }
    } else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) { document.exitFullscreen(); }
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
    } else {
      return;
    }
    e.preventDefault();
  });

  var prev = document.querySelector('[data-deck-prev]');
  var next = document.querySelector('[data-deck-next]');
  if (prev) { prev.addEventListener('click', function () { go(-1); }); }
  if (next) { next.addEventListener('click', function () { go(1); }); }

  window.addEventListener('pointermove', wake, { passive: true });

  /* Wischen auf dem Tablett. Nur waagerecht und nur deutliche Wege. */
  var x0 = null, y0 = null;
  deck.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  deck.addEventListener('touchend', function (e) {
    if (x0 === null || !e.changedTouches.length) { return; }
    var dx = e.changedTouches[0].clientX - x0;
    var dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) { go(dx < 0 ? 1 : -1); }
    x0 = null;
  }, { passive: true });

  /* Eine Folie laesst sich verlinken: praesentation/#3 */
  function fromHash() {
    var n = parseInt((window.location.hash || '').replace('#', ''), 10);
    return isFinite(n) && n >= 1 && n <= slides.length ? n - 1 : 0;
  }
  window.addEventListener('hashchange', function () { show(fromHash(), true); });

  show(fromHash(), false);
})();
