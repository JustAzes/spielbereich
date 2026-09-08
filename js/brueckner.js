/* Steuert die Aufbau-Animation des Brückner-Logos auf /index3/.
 *
 * Die Animation selbst steckt komplett in css/index3.css. Hier wird nur
 * gestartet, das Ende gemerkt (danach bleibt das Wasser in leichter
 * Bewegung) und der Neustart über die Schaltfläche erledigt.
 */
(function () {
  'use strict';

  var stage = document.querySelector('[data-bk-stage]');
  if (!stage) { return; }
  var replay = stage.querySelector('[data-bk-replay]');

  var reduceMotion = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* Dauer des ganzen Aufbaus: letzte Zeitmarke plus Laufzeit. Wird aus dem
     Stylesheet gelesen, damit die Zeiten nur an einer Stelle stehen. */
  function totalMs() {
    var css = window.getComputedStyle(stage);
    var sub = parseFloat(css.getPropertyValue('--bk-sub-at')) || 3.56;
    return (sub + 0.72) * 1000;
  }

  var doneTimer = null;

  function play() {
    if (reduceMotion) { return; }
    window.clearTimeout(doneTimer);
    stage.classList.remove('is-playing', 'is-done');
    /* Erzwingt einen Umbruch, damit die Animationen neu anlaufen. */
    void stage.offsetWidth;
    stage.classList.add('is-playing');
    doneTimer = window.setTimeout(function () {
      stage.classList.add('is-done');
    }, totalMs());
  }

  if (replay) {
    replay.addEventListener('click', play);
  }

  /* Erst starten, wenn die Seite wirklich sichtbar ist – sonst läuft die
     Animation im Hintergrundtab ins Leere. */
  if (document.hidden) {
    document.addEventListener('visibilitychange', function onShow() {
      if (!document.hidden) {
        document.removeEventListener('visibilitychange', onShow);
        play();
      }
    });
  } else {
    play();
  }
})();
