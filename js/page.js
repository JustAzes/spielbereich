/* carus.one – der Informationsbereich unter dem Teaser (/index4/).
 *
 * Bewusst klein: die Seite ist ohne dieses Skript vollstaendig lesbar.
 * Es blendet Inhaltsbloecke beim ersten Erscheinen kurz ein und macht
 * die Navigationsleiste sichtbar, sobald gescrollt wurde.
 *
 * Keine Scrollsteuerung, kein Festhalten von Abschnitten, keine
 * Abhaengigkeit von der 3D-Szene.
 */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Navigationsleiste ------------------------------------------- */

  var nav = document.querySelector('.v-nav');
  if (nav) {
    var stuck = false;
    var onScroll = function () {
      var s = (window.pageYOffset || 0) > 40;
      if (s !== stuck) { nav.classList.toggle('is-stuck', s); stuck = s; }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- Kurzes Einblenden der Inhaltsbloecke ------------------------- */

  var blocks = document.querySelectorAll('[data-v-in]');
  if (!blocks.length) { return; }

  /* Die Startdeckkraft wird erst hier gesetzt: schlaegt das Skript fehl
     oder fehlt der Beobachter, bleibt der Inhalt sichtbar. */
  if (reduce || !window.IntersectionObserver) {
    for (var i = 0; i < blocks.length; i++) { blocks[i].classList.add('is-in'); }
    return;
  }

  docEl.classList.add('v-anim');

  var io = new window.IntersectionObserver(function (entries) {
    for (var k = 0; k < entries.length; k++) {
      if (!entries[k].isIntersecting) { continue; }
      entries[k].target.classList.add('is-in');
      io.unobserve(entries[k].target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  for (var j = 0; j < blocks.length; j++) { io.observe(blocks[j]); }

  /* Sicherheitsnetz gegen einen nicht ausgeloesten Beobachter: was nach
     kurzer Zeit im Bild steht und noch unsichtbar ist, wird eingeblendet.
     Niemand soll vor einer leeren Flaeche stehen. */
  window.setTimeout(function () {
    var vh = window.innerHeight || 800;
    for (var n = 0; n < blocks.length; n++) {
      if (blocks[n].classList.contains('is-in')) { continue; }
      if (blocks[n].getBoundingClientRect().top < vh) { blocks[n].classList.add('is-in'); }
    }
  }, 3000);
})();
