/* carus.one – Coming-Soon-Teaser (/index4/).
 *
 * Erzählt in einer durchgehenden Kamerafahrt: aus einem einzelnen
 * klinischen Datenpunkt wächst ein Netz, das Netz wird zu einem
 * longitudinalen Patientenkontext, daraus eine Population, daraus
 * carus.one.
 *
 * Aufbau
 * ------
 * Gerendert wird direkt in WebGL 2, ohne Framework. Der Trick, mit dem das
 * schlank bleibt: die Knoten haben *keine* Vertex-Attribute. Alle Daten
 * liegen in Float-Texturen und werden im Shader über gl_VertexID geholt.
 * Dadurch ist ein Knoten ein Index und eine Kante zwei Indizes – die
 * Puffer bleiben winzig, und Knoten wie Kanten teilen sich dieselben
 * Positionen.
 *
 * Jeder Knoten hat drei Positionen:
 *   A  Wachstumsnetz  (Szene 1–4, endet als Patienten-Sphäre)
 *   B  Population     (Szene 5, viele kleine Sphären)
 *   C  Orbit          (Szene 6–9, alles organisiert sich um ein Zentrum)
 * Zwei Uniforms blenden zwischen A→B→C. Die Kanten liegen in drei Sätzen,
 * die passend dazu ein- und ausgeblendet werden, sodass die Umbrüche wie
 * ein Neuverdrahten wirken.
 *
 * Danach: heller Durchgang in einen Float-Puffer, sparsames Bloom,
 * Tone-Mapping, Vignette, feines Korn.
 *
 * Die Schrift liegt als echtes DOM darüber (lesbar, auffindbar, wenige
 * Elemente) und wird pro Bild aus dem 3D-Raum projiziert.
 *
 * Alle gezeigten klinischen Werte sind synthetische Demodaten.
 */
(function () {
  'use strict';

  var root = document.querySelector('[data-c1]');
  if (!root) { return; }
  var canvas = root.querySelector('[data-c1-canvas]');
  if (!canvas) { return; }

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;

  var reduceMotion = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ================================================================== *
   * Zeitachse
   *
   * Die ganze Geschichte läuft über einen Fortschritt p von 0 bis 1.
   * Alle Szenen hängen nur an p – dadurch lässt sich die Sequenz
   * vorwärts wie rückwärts scrubben.
   * ================================================================== */

  var STORY_SECONDS = 40;

  var SC = {
    dark: [0.000, 0.025],   // Szene 1  Nichts (rund 1 s)
    seed: [0.025, 0.050],   // Szene 1  erster Punkt glimmt auf
    first: [0.050, 0.082],  // Szene 2  erste Verbindung
    grow: [0.079, 0.155],   // Szene 2  exponentielles Wachstum
    pull: [0.140, 0.160],   // Kamera fährt zurück
    data: [0.160, 0.415],   // Szene 3  klinische Datenpunkte (10 s)
    art: [0.415, 0.5425],   // Szene 3b klinische Artefakte (5 s)
    patient: [0.5425, 0.6275], // Szene 4  Patient View
    pop: [0.6275, 0.7175], // Szene 5  Population
    orbit: [0.7175, 0.7775], // Szene 6  carus.one entsteht (kurz gehalten)
    cap: [0.7725, 0.8425],  // Szene 7  Capabilities
    ai: [0.8375, 0.8800],   // Szene 8  Intelligence Layer
    end: [0.8800, 1.0000]   // Finale mit gestaffeltem Slogan
  };

  /* Finale: "Healthcare" – zwei Sekunden Pause – "beyond imagination."
     Danach kommt der Rest schnell hintereinander. */
  var SLOGAN_A = [0.872, 0.886];
  var SLOGAN_PAUSE = 2 / 40;              // zwei Sekunden auf dieser Achse
  var SLOGAN_B = [0.886 + SLOGAN_PAUSE, 0.900 + SLOGAN_PAUSE];
  var FIN_PAUSE = 0.8 / 40;               // danach noch eine kurze Pause
  var FIN_START = SLOGAN_B[1] + FIN_PAUSE;
  var FIN_FADE = 0.014;                   // der Rest kommt in einem Stueck

  /* Szene 3: neun klinische Datenpunkte. Jeder bekommt ein festes Fenster,
     in dem die Kamera zuerst hinfliegt und dann stehen bleibt – nur so
     bleibt Zeit, Bezeichnung, Code und Standard zu lesen.
     Die Beschriftungen im Markup übernehmen diese Werte (data-c1-dp). */
  var DP_COUNT = 6;
  var DP_START = 0.160;
  var DP_STEP = (0.415 - 0.160) / DP_COUNT;   // rund 1,7 s je Punkt
  var DP_TRAVEL = 0.013;                       // Anflug, danach Stillstand

  /* Szene 3b: vier Artefakte, in denen dieselben Daten dem Menschen
     begegnen – Arztbrief, Vitalwertmonitor, Bildgebung.
     Bewusst reduzierte Drahtgitter, keine Bildschirmfotos. */
  var AR_COUNT = 3;
  var AR_START = 0.415;
  var AR_STEP = (0.5425 - 0.415) / AR_COUNT;   // rund 1,7 s je Artefakt
  var AR_POS = [
    [-0.40, 0.12, 0.24],
    [0.42, -0.08, -0.20],
    [-0.26, 0.22, -0.34]
  ];

  function ramp(a, b, p) {
    if (b <= a) { return p >= b ? 1 : 0; }
    var t = (p - a) / (b - a);
    return t < 0 ? 0 : (t > 1 ? 1 : t);
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  function ease(a, b, p) { return smooth(ramp(a, b, p)); }

  /* Fenster mit weichen Kanten: 0 vor `a`, 1 zwischen, 0 nach `b`. */
  function window01(p, a, b, fade) {
    return Math.min(ramp(a - fade, a, p), 1 - ramp(b, b + fade, p));
  }

  /* ================================================================== *
   * Kleine Mathe-Werkzeuge
   * ================================================================== */

  function rngFrom(seed) {
    var s = seed | 0;
    return function () {
      s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function m4() { return new Float32Array(16); }

  function ident(o) {
    o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o;
  }

  function mul(a, b, o) {
    for (var i = 0; i < 4; i++) {
      var b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      for (var j = 0; j < 4; j++) {
        o[i * 4 + j] = a[j] * b0 + a[4 + j] * b1 + a[8 + j] * b2 + a[12 + j] * b3;
      }
    }
    return o;
  }

  function perspective(fovY, aspect, near, far, o) {
    ident(o);
    var f = 1 / Math.tan(fovY / 2);
    o[0] = f / aspect; o[5] = f;
    o[10] = (far + near) / (near - far);
    o[11] = -1;
    o[14] = 2 * far * near / (near - far);
    o[15] = 0;
    return o;
  }

  function lookAt(eye, at, up, o) {
    var zx = eye[0] - at[0], zy = eye[1] - at[1], zz = eye[2] - at[2];
    var zl = Math.hypot(zx, zy, zz) || 1;
    zx /= zl; zy /= zl; zz /= zl;
    var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    var xl = Math.hypot(xx, xy, xz) || 1;
    xx /= xl; xy /= xl; xz /= xl;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    o[15] = 1;
    return o;
  }

  /* ================================================================== *
   * Die Datenwelt
   *
   * Drei Layouts pro Knoten, dazu drei Kantensätze. Alles prozedural aus
   * einem festen Startwert, damit die Szene reproduzierbar ist.
   * ================================================================== */

  function buildWorld(N, quality) {
    var rnd = rngFrom(20260907);
    var g1 = function () { return (rnd() + rnd() + rnd() + rnd() - 2) * 1.05; }; // ~normalverteilt

    var nodes = [];      // {x,y,z,depth,size,tint,parent}
    var named = {};      // Ankerpunkte für die Beschriftung

    function add(x, y, z, depth, size, tint, parent) {
      nodes.push({ x: x, y: y, z: z, d: depth, s: size, t: tint, p: parent });
      return nodes.length - 1;
    }

    /* --- Keim ------------------------------------------------------- */
    add(0, 0, 0, 0, 2.6, 0.35, -1);

    /* --- Szene 3: der Pfad, dem die Kamera folgt -------------------- */
    var SPINE = 9;
    var prev = 0;
    for (var k = 0; k < SPINE; k++) {
      var ang = 0.5 + k * 0.66;
      var rad = 0.92 + k * 0.048;
      var id = add(Math.cos(ang) * rad,
        Math.sin(k * 0.85) * 0.30,
        Math.sin(ang) * rad,
        k + 1, 2.1, k % 3 === 0 ? 0.75 : 0.3, prev);
      named['spine' + k] = id;
      prev = id;
    }

    /* --- longitudinale Bahnen: zeitliche Ereignisketten ------------- */
    var TRACKS = Math.max(6, Math.round(14 * quality));
    for (var tr = 0; tr < TRACKS; tr++) {
      var ux = g1(), uy = g1() * 0.6, uz = g1();
      var ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      /* zu u senkrechte Richtung */
      var vx = -uz, vy = 0.35 * g1(), vz = ux;
      var vl = Math.hypot(vx, vy, vz) || 1;
      vx /= vl; vy /= vl; vz /= vl;
      var a0 = rnd() * TAU;
      var r0 = 0.42 + rnd() * 0.42;
      var len = 5 + Math.floor(rnd() * 5);
      var par = 0;
      for (var j = 0; j < len; j++) {
        var a = a0 + j * 0.115;
        var ca = Math.cos(a), sa = Math.sin(a);
        var r = r0 + j * 0.024;
        var nid = add((ux * ca + vx * sa) * r + g1() * 0.008,
          (uy * ca + vy * sa) * r + g1() * 0.008,
          (uz * ca + vz * sa) * r + g1() * 0.008,
          2 + j, 1.5 + rnd() * 0.7, rnd() < 0.18 ? 0.8 : 0.25, par);
        par = nid;
      }
    }

    /* --- Cluster auf der Sphäre: Radiologie, Labor, ... ------------- */
    var CLUSTERS = 6;
    var clusterN = Math.max(40, Math.round(230 * quality));
    for (var c = 0; c < CLUSTERS; c++) {
      var cd = [g1(), g1() * 0.8, g1()];
      var cl = Math.hypot(cd[0], cd[1], cd[2]) || 1;
      var cx = cd[0] / cl * 0.88, cy = cd[1] / cl * 0.88, cz = cd[2] / cl * 0.88;
      named['cluster' + c] = add(cx, cy, cz, 7, 2.3, 0.4, 0);
      for (var m = 0; m < clusterN; m++) {
        add(cx + g1() * 0.062, cy + g1() * 0.062, cz + g1() * 0.062,
          8 + (m % 2), 0.75 + Math.pow(rnd(), 3) * 1.6,
          rnd() < 0.12 ? 0.85 : rnd() * 0.3, named['cluster' + c]);
      }
    }

    /* --- Verzweigtes Wachstum füllt den Rest ------------------------ */
    var MAXD = 10;
    var frontier = [[0]];
    for (var d = 1; d <= MAXD; d++) { frontier[d] = []; }
    /* Startfront: was schon existiert, nach Tiefe einsortiert */
    for (var i = 0; i < nodes.length; i++) {
      var dd = Math.min(MAXD, nodes[i].d);
      if (!frontier[dd]) { frontier[dd] = []; }
      frontier[dd].push(i);
    }

    var remaining = N - nodes.length;
    /* Level wachsen exponentiell: jedes Level rund 2,9-fach so groß */
    var weights = [], wsum = 0;
    for (d = 1; d <= MAXD; d++) { weights[d] = Math.pow(2.9, d); wsum += weights[d]; }

    for (d = 1; d <= MAXD && remaining > 0; d++) {
      var want = d === MAXD ? remaining : Math.min(remaining, Math.round(N * weights[d] / wsum));
      var pool = frontier[d - 1].length ? frontier[d - 1] : frontier[0];
      /* Radius wächst nach außen, die letzten Level drängen an die Hülle */
      var rTarget = Math.pow(d / MAXD, 0.58);
      for (var q = 0; q < want; q++) {
        /* Richtung erst würfeln, dann den nächstgelegenen Elternknoten
           dazu nehmen: so bleiben die Kanten kurz und lokal. */
        var wx = g1(), wy = g1() * 0.85, wz = g1();
        var wl = Math.hypot(wx, wy, wz) || 1;
        var prevR = Math.pow((d - 1) / MAXD, 0.58);
        wx = wx / wl * prevR; wy = wy / wl * prevR * 0.92; wz = wz / wl * prevR;
        var pid = pool[0], bestD = Infinity;
        for (var cand = 0; cand < 5; cand++) {
          var ci = pool[(rnd() * pool.length) | 0];
          var cn = nodes[ci];
          var cdd = (cn.x - wx) * (cn.x - wx) + (cn.y - wy) * (cn.y - wy) + (cn.z - wz) * (cn.z - wz);
          if (cdd < bestD) { bestD = cdd; pid = ci; }
        }
        var pn = nodes[pid];
        var pl = Math.hypot(pn.x, pn.y, pn.z);
        var dx, dy, dz;
        if (pl < 1e-4) {
          dx = g1(); dy = g1() * 0.85; dz = g1();
        } else {
          /* nach außen, mit organischer Streuung */
          dx = pn.x / pl + g1() * 0.34;
          dy = pn.y / pl + g1() * 0.34;
          dz = pn.z / pl + g1() * 0.34;
        }
        var dl = Math.hypot(dx, dy, dz) || 1;
        var rr = rTarget * (0.86 + rnd() * 0.2);
        var big = rnd() < 0.006;
        frontier[d].push(add(dx / dl * rr, dy / dl * rr * 0.92, dz / dl * rr,
          d, big ? 2.8 : 0.55 + Math.pow(rnd(), 3.4) * 1.5,
          rnd() < 0.09 ? 0.8 : rnd() * 0.28, pid));
        remaining--;
        if (remaining <= 0) { break; }
      }
    }

    var count = nodes.length;

    /* --- Nach Tiefe sortieren: das Netz wächst nach außen ----------- */
    var order = new Int32Array(count);
    for (i = 0; i < count; i++) { order[i] = i; }
    var arr = Array.prototype.slice.call(order);
    arr.sort(function (a, b) { return nodes[a].d - nodes[b].d || a - b; });
    var rank = new Int32Array(count);
    for (i = 0; i < count; i++) { rank[arr[i]] = i; }
    for (var key in named) {
      if (Object.prototype.hasOwnProperty.call(named, key)) { named[key] = rank[named[key]]; }
    }

    /* --- Layouts in Texturdaten schreiben --------------------------- */
    var T0 = new Float32Array(count * 4);   // A: Wachstum xyz + birth
    var T1 = new Float32Array(count * 4);   // B: Population xyz + Größe
    var T2 = new Float32Array(count * 4);   // C: Orbit xyz + Farbton
    var ax = new Float32Array(count), ay = new Float32Array(count), az = new Float32Array(count);
    var cxs = new Float32Array(count), cys = new Float32Array(count), czs = new Float32Array(count);
    var clusterOf = new Int32Array(count);

    /* Population: eine große Sphäre (der gezeigte Patient) und viele
       weitere, in einer flachen Landschaft verteilt. */
    var POPC = Math.max(22, Math.round(70 * quality));
    var pcx = new Float32Array(POPC + 1), pcy = new Float32Array(POPC + 1), pcz = new Float32Array(POPC + 1);
    var pcs = new Float32Array(POPC + 1);
    pcx[0] = 0; pcy[0] = 0; pcz[0] = 0; pcs[0] = 0.34;
    for (c = 1; c <= POPC; c++) {
      var pa = rnd() * TAU;
      var prr = 0.92 + Math.pow(rnd(), 0.75) * 2.35;
      pcx[c] = Math.cos(pa) * prr;
      pcz[c] = Math.sin(pa) * prr;
      pcy[c] = g1() * 0.8;
      pcs[c] = 0.10 + rnd() * 0.075;
    }

    /* Orbit: Ring, Linsenschale, einfließende Ströme, ferner Staub. */
    var STREAMS = Math.max(8, Math.round(18 * quality));

    var lnN = Math.log(1 + count);
    for (i = 0; i < count; i++) {
      var n = nodes[arr[i]];
      var o4 = i * 4;

      /* Geburt exponentiell: aus 1 Punkt werden 2, 8, 30, 100, ... */
      var birth = Math.log(1 + i) / lnN;

      T0[o4] = ax[i] = n.x;
      T0[o4 + 1] = ay[i] = n.y;
      T0[o4 + 2] = az[i] = n.z;
      T0[o4 + 3] = birth;

      /* --- Population ---
         Cluster 0 ist der Patient, den die Kamera gerade verlassen hat: er
         behält seine Struktur. Die übrigen sind dicht gefüllte Kugeln,
         sonst würden sie aus der Entfernung hohl wirken. */
      var cl2 = i < count * 0.34 ? 0 : 1 + (i * 2654435761 % POPC);
      clusterOf[i] = cl2;
      var sc = pcs[cl2];
      if (cl2 === 0) {
        T1[o4] = n.x * sc; T1[o4 + 1] = n.y * sc; T1[o4 + 2] = n.z * sc;
      } else {
        var ba = rnd() * TAU, bb = Math.acos(2 * rnd() - 1);
        var br = Math.pow(rnd(), 0.3333);
        T1[o4] = pcx[cl2] + Math.sin(bb) * Math.cos(ba) * br * sc;
        T1[o4 + 1] = pcy[cl2] + Math.cos(bb) * br * sc * 0.85;
        T1[o4 + 2] = pcz[cl2] + Math.sin(bb) * Math.sin(ba) * br * sc;
      }
      T1[o4 + 3] = n.s;

      /* --- Orbit --- */
      var u = i / count, ox, oy, oz;
      if (u < 0.12) {
        /* die dünne Umlaufbahn */
        var ra = (i * 0.61803398875) % 1 * TAU;
        ox = Math.cos(ra) * (1.0 + g1() * 0.008);
        oz = Math.sin(ra) * (1.0 + g1() * 0.008);
        oy = g1() * 0.008;
      } else if (u < 0.56) {
        /* Linsenschale um das Zentrum */
        var sa2 = rnd() * TAU, sb = Math.acos(2 * rnd() - 1);
        var srr = 0.5 + Math.pow(rnd(), 0.72) * 1.45;
        ox = Math.sin(sb) * Math.cos(sa2) * srr;
        oy = Math.cos(sb) * srr * 0.42;
        oz = Math.sin(sb) * Math.sin(sa2) * srr;
      } else if (u < 0.80) {
        /* Ströme, die nach innen laufen */
        var st = ((i * 7919) % STREAMS) / STREAMS;
        var sang = st * TAU;
        var tt = rnd();
        var srad = 2.7 - tt * 2.45;
        var spiral = sang + tt * 1.25;
        ox = Math.cos(spiral) * srad + g1() * 0.03;
        oy = (0.55 - tt * 0.5) * (st < 0.5 ? 1 : -1) * 0.5 + g1() * 0.03;
        oz = Math.sin(spiral) * srad + g1() * 0.03;
      } else {
        /* ferner Staub */
        var da = rnd() * TAU, db = Math.acos(2 * rnd() - 1);
        var dr = 3.0 + Math.pow(rnd(), 0.6) * 5.5;
        ox = Math.sin(db) * Math.cos(da) * dr;
        oy = Math.cos(db) * dr * 0.7;
        oz = Math.sin(db) * Math.sin(da) * dr;
      }
      T2[o4] = cxs[i] = ox;
      T2[o4 + 1] = cys[i] = oy;
      T2[o4 + 2] = czs[i] = oz;
      T2[o4 + 3] = n.t;
    }

    /* --- Kantensätze ------------------------------------------------ */
    function edgeList(cap) {
      return { ia: [], ib: [], birth: [], bx: [], by: [], bz: [], a: [], cap: cap };
    }
    function pushEdge(E, a, b, alpha) {
      if (E.ia.length >= E.cap || a === b || a < 0 || b < 0) { return; }
      E.ia.push(a); E.ib.push(b);
      E.birth.push(Math.max(T0[a * 4 + 3], T0[b * 4 + 3]));
      /* leichte Krümmung, in einer zur Kante senkrechten Richtung */
      var ex = ax[b] - ax[a], ey = ay[b] - ay[a], ez = az[b] - az[a];
      var px2 = ey * 0.3 - ez * 0.7, py2 = ez * 0.5 - ex * 0.4, pz2 = ex * 0.7 - ey * 0.3;
      var pl2 = Math.hypot(px2, py2, pz2) || 1;
      var amt = 0.025 + rnd() * 0.045;
      E.bx.push(px2 / pl2 * amt); E.by.push(py2 / pl2 * amt); E.bz.push(pz2 / pl2 * amt);
      E.a.push(alpha);
    }

    /* A: der Wachstumsbaum */
    var EA = edgeList(Math.max(700, Math.round(3000 * quality)));
    /* Eltern-Kind-Kanten in Reihenfolge der Geburt */
    var parentOf = new Int32Array(count);
    for (i = 0; i < count; i++) {
      var pr = nodes[arr[i]].p;
      parentOf[i] = pr < 0 ? -1 : rank[pr];
    }
    for (i = 1; i < count && EA.ia.length < EA.cap; i++) {
      if (parentOf[i] < 0) { continue; }
      /* alle frühen Kanten, später nur noch eine Auswahl */
      var keep = i < 700 ? 1 : (i < 3500 ? 0.34 : 0.09);
      if (rnd() > keep) { continue; }
      /* zu lange Kanten weglassen – sie machen aus der Struktur ein Netz */
      var pi = parentOf[i];
      var elen = Math.hypot(ax[i] - ax[pi], ay[i] - ay[pi], az[i] - az[pi]);
      if (elen > 0.30 && i > 60) { continue; }
      pushEdge(EA, pi, i, i < 60 ? 1 : 0.42 + rnd() * 0.28);
    }

    /* B: innerhalb der Cluster und zwischen benachbarten Populationen */
    var EB = edgeList(Math.max(600, Math.round(2600 * quality)));
    for (i = 1; i < count && EB.ia.length < EB.cap * 0.62; i++) {
      if (parentOf[i] >= 0 && clusterOf[i] === clusterOf[parentOf[i]] && rnd() < 0.26) {
        pushEdge(EB, parentOf[i], i, 0.34 + rnd() * 0.3);
      }
    }
    /* semantische Brücken zwischen nahen Clustern */
    var repOf = new Int32Array(POPC + 1).fill(-1);
    for (i = 0; i < count; i++) { if (repOf[clusterOf[i]] < 0) { repOf[clusterOf[i]] = i; } }
    for (c = 0; c <= POPC && EB.ia.length < EB.cap; c++) {
      for (var c2 = c + 1; c2 <= POPC && EB.ia.length < EB.cap; c2++) {
        var ddx = pcx[c] - pcx[c2], ddy = pcy[c] - pcy[c2], ddz = pcz[c] - pcz[c2];
        if (Math.hypot(ddx, ddy, ddz) < 2.1 && rnd() < 0.5 && repOf[c] >= 0 && repOf[c2] >= 0) {
          pushEdge(EB, repOf[c], repOf[c2], 0.2 + rnd() * 0.22);
        }
      }
    }

    /* C: die einfließenden Ströme und Sehnen im Orbit */
    var EC = edgeList(Math.max(600, Math.round(2400 * quality)));
    var streamNodes = [];
    for (i = 0; i < count; i++) {
      var uu = i / count;
      if (uu >= 0.56 && uu < 0.80) { streamNodes.push(i); }
    }
    /* Ströme nach Winkel und Radius sortieren, dann verketten */
    streamNodes.sort(function (a, b) {
      var sa3 = ((a * 7919) % STREAMS), sb3 = ((b * 7919) % STREAMS);
      if (sa3 !== sb3) { return sa3 - sb3; }
      return Math.hypot(cxs[b], czs[b]) - Math.hypot(cxs[a], czs[a]);
    });
    for (i = 1; i < streamNodes.length && EC.ia.length < EC.cap * 0.8; i++) {
      var s1 = streamNodes[i - 1], s2 = streamNodes[i];
      if (((s1 * 7919) % STREAMS) !== ((s2 * 7919) % STREAMS)) { continue; }
      if (rnd() < 0.55) { pushEdge(EC, s1, s2, 0.3 + rnd() * 0.35); }
    }
    /* wenige lange Sehnen durch das Zentrum */
    for (i = 0; i < count && EC.ia.length < EC.cap; i += 137) {
      var j2 = (i * 13 + 7) % count;
      if (i / count < 0.56 && j2 / count < 0.56 && rnd() < 0.35) {
        pushEdge(EC, i, j2, 0.08 + rnd() * 0.1);
      }
    }

    return {
      count: count, named: named,
      T0: T0, T1: T1, T2: T2,
      ax: ax, ay: ay, az: az, cx: cxs, cy: cys, cz: czs,
      edges: [EA, EB, EC]
    };
  }

  /* ================================================================== *
   * Shader
   * ================================================================== */

  var COMMON = [
    'uniform sampler2D uT0;', 'uniform sampler2D uT1;', 'uniform sampler2D uT2;',
    'uniform int uTexW;',
    'uniform float uM01;', 'uniform float uM12;', 'uniform float uTime;',
    'vec4 fetchN(sampler2D t, int i) {',
    '  return texelFetch(t, ivec2(i % uTexW, i / uTexW), 0);',
    '}',
    'vec3 nodePos(int i, out float birth, out float size, out float tint) {',
    '  vec4 a = fetchN(uT0, i); vec4 b = fetchN(uT1, i); vec4 c = fetchN(uT2, i);',
    '  birth = a.w; size = b.w; tint = c.w;',
    '  vec3 p = mix(mix(a.xyz, b.xyz, uM01), c.xyz, uM12);',
    /* leises Eigenleben, damit die Struktur nie erstarrt */
    '  float s = birth * 97.3 + tint * 41.7 + float(i) * 0.013;',
    '  p += vec3(sin(uTime * 0.23 + s * 6.1),',
    '            cos(uTime * 0.19 + s * 9.7),',
    '            sin(uTime * 0.17 + s * 4.3)) * 0.0045;',
    '  return p;',
    '}'
  ].join('\n');

  var POINT_VS = ['#version 300 es', 'precision highp float;', COMMON,
    'uniform mat4 uVP;',
    'uniform vec3 uEye;',
    'uniform float uGrow;',
    'uniform float uPix;',
    'uniform float uDim;',
    'uniform float uFocus;',
    'uniform float uFall;',
    'uniform int uHot;',
    'uniform float uHotAmt;',
    'out vec3 vCol;',
    'out float vA;',
    'out float vSoft;',
    'void main() {',
    '  int i = gl_VertexID;',
    '  float birth, size, tint;',
    '  vec3 p = nodePos(i, birth, size, tint);',
    /* Noch nicht geborene Knoten ganz aus dem Bild schieben: sonst zahlt
       die Grafikkarte die Füllkosten für unsichtbare Sprites. */
    '  if (uGrow < birth) {',
    '    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);',
    '    gl_PointSize = 0.0;',
    '    vCol = vec3(0.0); vA = 0.0; vSoft = 0.0;',
    '    return;',
    '  }',
    /* Der Datenpunkt, den die Kamera gerade anfliegt, tritt hervor. */
    '  float hot = (i == uHot) ? uHotAmt : 0.0;',
    '  size *= 1.0 + 2.6 * hot;',
    '  gl_Position = uVP * vec4(p, 1.0);',
    '  float dist = max(0.03, length(p - uEye));',
    /* Unschärfe vor und hinter der Schärfeebene: größer, dafür flauer */
    '  float coc = clamp(abs(dist - uFocus) / max(0.4, uFocus) * 0.9, 0.0, 2.2);',
    '  gl_PointSize = clamp(size * (1.0 + coc * 1.1) * uPix / dist, 0.55, 26.0);',
    /* Erscheinen mit kurzem Aufglimmen */
    '  float born = smoothstep(0.0, 0.012, uGrow - birth);',
    '  float flare = exp(-max(0.0, uGrow - birth) * 90.0);',
    '  float a = born * (0.42 + 0.78 * clamp(size / 2.2, 0.0, 1.0)) * (1.0 + flare * 2.4);',
    '  a /= 1.0 + coc * coc * 7.0;',
    /* uFall wird in Szene 3 hochgezogen: dann leuchtet nur die nahe
       Umgebung, der Rest verliert sich in der Tiefe. */
    '  a *= 1.0 / (1.0 + dist * dist * uFall);',
    '  vCol = mix(vec3(0.66, 0.79, 1.0), vec3(1.0, 0.85, 0.63), step(0.55, tint));',
    '  vCol = mix(vec3(1.0, 0.99, 0.97), vCol, 0.42 + 0.4 * step(0.55, tint));',
    '  vA = a * uDim * (1.0 + 4.0 * hot);',
    '  vSoft = clamp(coc * 0.55, 0.0, 1.0);',
    '}'].join('\n');

  var POINT_FS = ['#version 300 es', 'precision highp float;',
    'in vec3 vCol; in float vA; in float vSoft;',
    'out vec4 oCol;',
    'void main() {',
    '  vec2 q = gl_PointCoord - 0.5;',
    '  float d = length(q) * 2.0;',
    '  if (d > 1.0) { discard; }',
    '  float core = exp(-d * d * mix(19.0, 4.0, vSoft));',
    '  float halo = pow(1.0 - d, mix(3.2, 1.7, vSoft));',
    '  float a = (core * mix(1.0, 0.35, vSoft) + halo * 0.4) * vA;',
    '  oCol = vec4(vCol * a, a);',
    '}'].join('\n');

  var LINE_VS = ['#version 300 es', 'precision highp float;', COMMON,
    'uniform sampler2D uE0;', 'uniform sampler2D uE1;',
    'uniform int uETexW;', 'uniform int uSeg;',
    'uniform mat4 uVP;',
    'uniform float uGrow;', 'uniform float uSet;', 'uniform float uDim;',
    'uniform vec3 uEye;',
    'out float vA;',
    'out vec3 vCol;',
    'vec4 fetchE(sampler2D t, int i) {',
    '  return texelFetch(t, ivec2(i % uETexW, i / uETexW), 0);',
    '}',
    'void main() {',
    '  int per = uSeg * 2;',
    '  int e = gl_VertexID / per;',
    '  int k = gl_VertexID % per;',
    '  float t = float(k / 2 + k % 2) / float(uSeg);',
    '  float t0 = float(k / 2) / float(uSeg);',
    '  vec4 e0 = fetchE(uE0, e);',
    '  vec4 e1 = fetchE(uE1, e);',
    '  float bi, si, ti;',
    '  vec3 A = nodePos(int(e0.x + 0.5), bi, si, ti);',
    '  vec3 B = nodePos(int(e0.y + 0.5), bi, si, ti);',
    /* Wachstum: die Linie zeichnet sich von A nach B */
    '  float g = clamp((uGrow - e0.z) / 0.022, 0.0, 1.0);',
    '  float tc = min(t, g);',
    '  vec3 C = 0.5 * (A + B) + e1.xyz * length(B - A);',
    '  float u = 1.0 - tc;',
    '  vec3 p = u * u * A + 2.0 * u * tc * C + tc * tc * B;',
    '  gl_Position = uVP * vec4(p, 1.0);',
    /* heller Kopf an der wachsenden Spitze, danach ruhige Linie */
    '  float head = exp(-abs(g - t) * 22.0) * (1.0 - step(0.999, g));',
    '  float live = 0.55 + 0.45 * sin(uTime * 1.7 + float(e) * 2.1);',
    '  float dist = max(0.05, length(p - uEye));',
    '  vA = uSet * uDim * e1.w * step(t0 - 0.001, g) * (0.45 + 0.35 * live + head * 2.6)',
    '       / (1.0 + dist * dist * 0.02);',
    '  vCol = vec3(0.72, 0.82, 1.0);',
    '}'].join('\n');

  var LINE_FS = ['#version 300 es', 'precision highp float;',
    'in float vA; in vec3 vCol;',
    'out vec4 oCol;',
    'void main() { oCol = vec4(vCol * vA, vA); }'].join('\n');

  var QUAD_VS = ['#version 300 es', 'precision highp float;',
    'out vec2 vUv;',
    'void main() {',
    '  vec2 p = vec2((gl_VertexID == 1) ? 3.0 : -1.0, (gl_VertexID == 2) ? 3.0 : -1.0);',
    '  vUv = p * 0.5 + 0.5;',
    '  gl_Position = vec4(p, 0.0, 1.0);',
    '}'].join('\n');

  var BRIGHT_FS = ['#version 300 es', 'precision highp float;',
    'uniform sampler2D uTex; uniform float uThresh;',
    'in vec2 vUv; out vec4 oCol;',
    'void main() {',
    '  vec3 c = texture(uTex, vUv).rgb;',
    '  float l = max(c.r, max(c.g, c.b));',
    '  oCol = vec4(c * smoothstep(uThresh, uThresh + 0.5, l), 1.0);',
    '}'].join('\n');

  var BLUR_FS = ['#version 300 es', 'precision highp float;',
    'uniform sampler2D uTex; uniform vec2 uStep;',
    'in vec2 vUv; out vec4 oCol;',
    'void main() {',
    '  vec3 s = texture(uTex, vUv).rgb * 0.2270270270;',
    '  s += (texture(uTex, vUv + uStep * 1.3846153846).rgb',
    '      + texture(uTex, vUv - uStep * 1.3846153846).rgb) * 0.3162162162;',
    '  s += (texture(uTex, vUv + uStep * 3.2307692308).rgb',
    '      + texture(uTex, vUv - uStep * 3.2307692308).rgb) * 0.0702702703;',
    '  oCol = vec4(s, 1.0);',
    '}'].join('\n');

  var COMP_FS = ['#version 300 es', 'precision highp float;',
    'uniform sampler2D uScene; uniform sampler2D uBloom;',
    'uniform float uExposure; uniform float uBloomAmt; uniform float uTime;',
    'uniform vec2 uRes; uniform float uFade;',
    'in vec2 vUv; out vec4 oCol;',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'void main() {',
    '  vec3 c = texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uBloomAmt;',
    '  c = vec3(1.0) - exp(-max(c, 0.0) * uExposure);',
    '  c = pow(c, vec3(0.92));',
    /* Grund: Schwarz mit einem Hauch Blau, minimal aufgehellt zur Mitte */
    '  float g = 1.0 - clamp(length((vUv - 0.5) * vec2(1.15, 1.0)) * 1.5, 0.0, 1.0);',
    '  vec3 bg = vec3(0.004, 0.006, 0.012) + vec3(0.006, 0.010, 0.020) * pow(g, 2.6);',
    '  vec3 o = bg + c;',
    '  o *= 1.0 - 0.45 * pow(clamp(length(vUv - 0.5) * 1.28, 0.0, 1.0), 2.4);',
    '  o += (hash(vUv * uRes + fract(uTime) * 71.3) - 0.5) * 0.010;',
    '  oCol = vec4(max(o, 0.0) * uFade, 1.0);',
    '}'].join('\n');

  /* ================================================================== *
   * WebGL-Hilfen
   * ================================================================== */

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (window.console && window.console.warn) {
        window.console.warn('carus.one Shader:', gl.getShaderInfoLog(s));
      }
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function link(gl, vs, fs) {
    var v = compile(gl, gl.VERTEX_SHADER, vs);
    var f = compile(gl, gl.FRAGMENT_SHADER, fs);
    if (!v || !f) { return null; }
    var p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { return null; }
    return p;
  }

  function uni(gl, p, names) {
    var o = {};
    for (var i = 0; i < names.length; i++) { o[names[i]] = gl.getUniformLocation(p, names[i]); }
    return o;
  }

  function dataTex(gl, data, w, h) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var padded = new Float32Array(w * h * 4);
    padded.set(data.subarray(0, Math.min(data.length, padded.length)));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, padded);
    return t;
  }

  /* ================================================================== *
   * Kamerafahrt
   *
   * Schlüsselbilder über den Fortschritt p. Ziel und Abstand werden
   * getrennt interpoliert, dazu eine ganz langsame Eigenrotation.
   * ================================================================== */

  var CAM = [
    /* p,    dist, azimut, hoehe, fov, ziel */
    [0.000, 0.42, 0.30, 0.10, 40, 'origin'],
    [0.042, 0.52, 0.42, 0.12, 40, 'origin'],
    [0.075, 0.72, 0.60, 0.16, 42, 'origin'],
    [0.120, 1.70, 0.95, 0.26, 46, 'origin'],
    [0.152, 2.90, 1.25, 0.34, 48, 'origin'],
    [0.556, 1.55, 3.15, 0.26, 44, 'origin'],
    [0.590, 2.60, 3.40, 0.32, 46, 'origin'],
    [0.628, 3.10, 3.70, 0.30, 46, 'origin'],
    [0.672, 4.40, 4.20, 0.40, 48, 'origin'],
    [0.718, 5.70, 4.80, 0.48, 50, 'origin'],
    [0.752, 4.00, 5.30, 0.30, 46, 'origin'],
    [0.800, 2.95, 5.70, 0.18, 44, 'origin'],
    [0.848, 2.65, 6.10, 0.12, 42, 'ai'],
    [0.892, 3.40, 6.50, 0.20, 44, 'origin'],
    [1.000, 5.20, 7.00, 0.30, 42, 'origin']
  ];

  /* Für jeden Datenpunkt und jedes Artefakt zwei Schlüsselbilder:
     angekommen und weiterhin dort. Zwischen zwei gleichen Zielen steht
     die Kamera still, es bleibt also Lesezeit. */
  (function () {
    var k, a;
    for (k = 0; k < DP_COUNT; k++) {
      a = DP_START + k * DP_STEP;
      var dist = 0.72 - Math.min(0.16, k * 0.02);
      var azi = 1.45 + k * 0.17;
      var hgt = 0.12 + (k % 3) * 0.03;
      CAM.push([a + DP_TRAVEL, dist, azi, hgt, 38, 'spine' + k, 1]);
      CAM.push([a + DP_STEP - 0.002, dist, azi + 0.05, hgt, 38, 'spine' + k, 1]);
    }
    CAM.push([DP_START - 0.001, 2.90, 1.25, 0.34, 48, 'origin']);
    for (k = 0; k < AR_COUNT; k++) {
      a = AR_START + k * AR_STEP;
      CAM.push([a + 0.009, 0.98, 3.05 + k * 0.06, 0.10, 40, AR_POS[k]]);
      CAM.push([a + AR_STEP - 0.002, 0.98, 3.05 + k * 0.06 + 0.03, 0.10, 40, AR_POS[k]]);
    }
    CAM.sort(function (x, y) { return x[0] - y[0]; });
  }());

  /* ================================================================== *
   * Start
   * ================================================================== */

  var gl = null;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
  } catch (e) { gl = null; }

  var floatBuf = gl && gl.getExtension('EXT_color_buffer_float');
  if (gl) { gl.getExtension('EXT_float_blend'); }

  if (!gl || !floatBuf) {
    /* Vereinfachter Rückfall: Sternenfeld in CSS, Text sofort lesbar. */
    root.classList.add('is-fallback', 'is-final');
    return;
  }

  var isMobile = Math.min(window.innerWidth, window.innerHeight) < 620 ||
    /Mobi|Android/i.test(navigator.userAgent);
  var cores = navigator.hardwareConcurrency || 4;
  var quality = isMobile ? 0.34 : (cores <= 4 ? 0.66 : 1);
  var NODES = isMobile ? 6500 : Math.round(24000 * (cores <= 4 ? 0.7 : 1));

  var W = buildWorld(NODES, quality);

  var TEXW = 1024;
  var TEXH = Math.ceil(W.count / TEXW);
  var tN = [dataTex(gl, W.T0, TEXW, TEXH), dataTex(gl, W.T1, TEXW, TEXH), dataTex(gl, W.T2, TEXW, TEXH)];

  var SEG = 6;
  var sets = W.edges.map(function (E) {
    var n = E.ia.length;
    var w = 512, h = Math.max(1, Math.ceil(n / w));
    var d0 = new Float32Array(w * h * 4), d1 = new Float32Array(w * h * 4);
    for (var i = 0; i < n; i++) {
      d0[i * 4] = E.ia[i]; d0[i * 4 + 1] = E.ib[i]; d0[i * 4 + 2] = E.birth[i]; d0[i * 4 + 3] = 0;
      d1[i * 4] = E.bx[i]; d1[i * 4 + 1] = E.by[i]; d1[i * 4 + 2] = E.bz[i]; d1[i * 4 + 3] = E.a[i];
    }
    return { n: n, w: w, t0: dataTex(gl, d0, w, h), t1: dataTex(gl, d1, w, h) };
  });

  var pPoint = link(gl, POINT_VS, POINT_FS);
  var pLine = link(gl, LINE_VS, LINE_FS);
  var pBright = link(gl, QUAD_VS, BRIGHT_FS);
  var pBlur = link(gl, QUAD_VS, BLUR_FS);
  var pComp = link(gl, QUAD_VS, COMP_FS);
  if (!pPoint || !pLine || !pBright || !pBlur || !pComp) {
    root.classList.add('is-fallback', 'is-final');
    return;
  }

  var uPoint = uni(gl, pPoint, ['uT0', 'uT1', 'uT2', 'uTexW', 'uM01', 'uM12', 'uTime',
    'uVP', 'uEye', 'uGrow', 'uPix', 'uDim', 'uFocus', 'uFall', 'uHot', 'uHotAmt']);
  var uLine = uni(gl, pLine, ['uT0', 'uT1', 'uT2', 'uTexW', 'uM01', 'uM12', 'uTime',
    'uE0', 'uE1', 'uETexW', 'uSeg', 'uVP', 'uGrow', 'uSet', 'uDim', 'uEye']);
  var uBright = uni(gl, pBright, ['uTex', 'uThresh']);
  var uBlur = uni(gl, pBlur, ['uTex', 'uStep']);
  var uComp = uni(gl, pComp, ['uScene', 'uBloom', 'uExposure', 'uBloomAmt', 'uTime', 'uRes', 'uFade']);

  var emptyVao = gl.createVertexArray();

  /* --- Zielpuffer -------------------------------------------------- */
  var view = { w: 1, h: 1, dpr: 1, cssW: 1, cssH: 1 };
  var fbScene = null, fbA = null, fbB = null;

  function makeFbo(w, h, internal) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA,
      internal === gl.RGBA16F ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok ? { fb: fb, tex: tex, w: w, h: h } : null;
  }

  function dropFbo(f) {
    if (!f) { return; }
    gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex);
  }

  var maxDpr = isMobile ? 1.6 : 1.5;

  function resize() {
    var cssW = Math.max(1, root.clientWidth);
    var cssH = Math.max(1, root.clientHeight);
    var dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    var w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    if (w === view.w && h === view.h) { return; }
    view.cssW = cssW; view.cssH = cssH; view.dpr = dpr; view.w = w; view.h = h;
    canvas.width = w; canvas.height = h;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    dropFbo(fbScene); dropFbo(fbA); dropFbo(fbB);
    fbScene = makeFbo(w, h, gl.RGBA16F);
    var bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
    fbA = makeFbo(bw, bh, gl.RGBA16F);
    fbB = makeFbo(bw, bh, gl.RGBA16F);
  }

  /* ================================================================== *
   * Beschriftung: DOM über der Szene, pro Bild aus 3D projiziert
   * ================================================================== */

  var labels = [];
  Array.prototype.forEach.call(root.querySelectorAll('[data-c1-from]'), function (el) {
    var anchor = el.getAttribute('data-c1-anchor') || 'center';
    var kind = 'center', ax = 0, ay = 0, az = 0, ar = 1, idx = -1;
    if (anchor.indexOf('node:') === 0) {
      kind = 'node';
      idx = W.named[anchor.slice(5)];
      if (typeof idx !== 'number') { idx = 0; }
    } else if (anchor.indexOf('world:') === 0) {
      kind = 'world';
      var parts = anchor.slice(6).split(',');
      ax = parseFloat(parts[0]) || 0; ay = parseFloat(parts[1]) || 0; az = parseFloat(parts[2]) || 0;
    } else if (anchor.indexOf('orbit:') === 0) {
      kind = 'orbit';
      ax = parseFloat(anchor.slice(6)) || 0;
    } else if (anchor.indexOf('ring:') === 0) {
      /* ring:Startwinkel,Radius,Hoehe,Umlaufgeschwindigkeit – die
         Beschriftung kreist um den Mittelpunkt der Szene. */
      kind = 'ring';
      var rp = anchor.slice(5).split(',');
      ax = parseFloat(rp[0]) || 0;
      ar = parseFloat(rp[1]);
      ay = parseFloat(rp[2]) || 0;
      az = parseFloat(rp[3]);
      if (!(ar > 0)) { ar = 1; }
      if (isNaN(az)) { az = 0.14; }
    }
    var from = parseFloat(el.getAttribute('data-c1-from')) || 0;
    var to = parseFloat(el.getAttribute('data-c1-to')) || 1;
    var fade = parseFloat(el.getAttribute('data-c1-fade')) || 0.02;
    /* Die neun Datenpunkte holen ihr Zeitfenster aus DP_START/DP_STEP –
       so bleiben Kamerahalt, hervorgehobener Knoten und Schrift synchron. */
    var dpi = el.getAttribute('data-c1-dp');
    if (dpi !== null) {
      var kk = parseInt(dpi, 10) || 0;
      from = DP_START + kk * DP_STEP + DP_TRAVEL * 0.4;
      to = DP_START + (kk + 1) * DP_STEP - 0.006;
      fade = 0.007;
    }
    var ari = el.getAttribute('data-c1-art');
    if (ari !== null) {
      var ak = parseInt(ari, 10) || 0;
      from = AR_START + ak * AR_STEP + 0.005;
      to = AR_START + (ak + 1) * AR_STEP - 0.005;
      fade = 0.006;
      kind = 'world';
      ax = AR_POS[ak][0]; ay = AR_POS[ak][1]; az = AR_POS[ak][2];
    }
    labels.push({
      el: el, kind: kind, idx: idx, x: ax, y: ay, z: az, r: ar,
      align: el.getAttribute('data-c1-align') || 'center',
      panel: ari !== null,
      flip: false, from: from, to: to, fade: fade, shown: false
    });
  });

  var wordEl = root.querySelector('[data-c1-word]');
  var wordA = root.querySelector('[data-c1-part="a"]');
  var wordB = root.querySelector('[data-c1-part="b"]');
  var sloA = root.querySelector('[data-c1-slogan="a"]');
  var sloB = root.querySelector('[data-c1-slogan="b"]');
  var finParts = Array.prototype.slice.call(root.querySelectorAll('[data-c1-fin]'));

  /* Einblenden: Deckkraft und ein kurzer Weg von unten, jedes Bild neu
     gesetzt – deshalb keine CSS-Übergänge, die dagegen arbeiten würden. */
  function reveal(el, t) {
    el.style.opacity = t.toFixed(3);
    el.style.visibility = t > 0.002 ? 'visible' : 'hidden';
    el.style.transform = t >= 1 ? 'none' : 'translateY(' + ((1 - t) * 9).toFixed(2) + 'px)';
  }
  var progressEl = root.querySelector('[data-c1-progress]');

  /* ================================================================== *
   * Zustand und Bedienung
   * ================================================================== */

  var st = {
    p: 0,               // Fortschritt der Geschichte
    autoplay: !reduceMotion,
    time: 0,
    mx: 0, my: 0,       // Zeigerposition, normiert
    tx: 0, ty: 0,       // geglättete Parallaxe
    wasFinal: false,
    paused: false
  };

  if (reduceMotion) { st.p = 1; }

  /* Der Teaser faengt keine Geste ab: Rad, Wischen und Tasten gehoeren
     immer der Seite. Die Sequenz laeuft von selbst und ist ueber die
     Bedientasten steuerbar. Der Zeiger verschiebt nur die Parallaxe. */
  if (!reduceMotion) {
    root.addEventListener('pointermove', function (e) {
      var r = root.getBoundingClientRect();
      st.mx = (e.clientX - r.left) / r.width - 0.5;
      st.my = (e.clientY - r.top) / r.height - 0.5;
    });
    root.addEventListener('pointerleave', function () {
      st.mx = 0; st.my = 0;
    });
  }

  /* Entwicklungshilfe: mit ?c1seek=1 lässt sich ein Zeitpunkt der Sequenz
     direkt anspringen. Nur dann vorhanden, damit die Seite selbst keine
     globale Schnittstelle mitbringt. */
  if (/[?&]c1seek=1/.test(window.location.search)) {
    window.__c1seek = function (v) {
      if (v !== undefined) {
        st.autoplay = false;
        st.p = Math.max(0, Math.min(1, Number(v) || 0));
      }
      return st.p;
    };
  }

  /* Bewegung muss anhaltbar sein. Die Taste haelt die Szene an und
     setzt sie fort; der Zustand steht im aria-pressed-Attribut. */
  var pauseBtn = root.querySelector('[data-c1-pause]');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function () {
      st.paused = !st.paused;
      pauseBtn.setAttribute('aria-pressed', st.paused ? 'true' : 'false');
      if (st.paused) { stop(); } else { start(); }
    });
  }

  var replay = root.querySelector('[data-c1-replay]');
  if (replay) {
    replay.addEventListener('click', function () {
      st.p = 0;
      st.autoplay = !reduceMotion;
      st.wasFinal = false;
      root.classList.remove('is-final');
      if ((window.pageYOffset || 0) > 1) { window.scrollTo(0, 0); }
      if (!st.paused) { start(); }
    });
  }

  /* ================================================================== *
   * Kamera auswerten
   * ================================================================== */

  var eye = [0, 0, 1], at = [0, 0, 0], up = [0, 1, 0];
  var mProj = m4(), mView = m4(), mVP = m4();

  function anchorPos(name, out) {
    if (name === 'origin') { out[0] = out[1] = out[2] = 0; return out; }
    if (name && name.length === 3 && typeof name[0] === 'number') {
      out[0] = name[0]; out[1] = name[1]; out[2] = name[2]; return out;
    }
    if (name === 'ai') {
      out[0] = 0.30; out[1] = 0.06; out[2] = 0.18; return out;
    }
    var i = W.named[name];
    if (typeof i !== 'number') { out[0] = out[1] = out[2] = 0; return out; }
    out[0] = W.ax[i]; out[1] = W.ay[i]; out[2] = W.az[i];
    return out;
  }

  var tmpA = [0, 0, 0], tmpB = [0, 0, 0];

  function updateCamera(p, m01, m12) {
    var i = 0;
    while (i < CAM.length - 2 && CAM[i + 1][0] <= p) { i++; }
    var k0 = CAM[i], k1 = CAM[Math.min(CAM.length - 1, i + 1)];
    var t = smooth(ramp(k0[0], k1[0], p));

    var dist = k0[1] + (k1[1] - k0[1]) * t;
    var azi = k0[2] + (k1[2] - k0[2]) * t;
    var hgt = k0[3] + (k1[3] - k0[3]) * t;
    var fov = k0[4] + (k1[4] - k0[4]) * t;

    anchorPos(k0[5], tmpA);
    anchorPos(k1[5], tmpB);
    /* Ziele liegen im Wachstumslayout; nach dem Umbruch zählt nur noch
       das Zentrum, sonst würde die Kamera einem wandernden Punkt folgen. */
    var pull = Math.max(m01, m12);
    at[0] = (tmpA[0] + (tmpB[0] - tmpA[0]) * t) * (1 - pull);
    at[1] = (tmpA[1] + (tmpB[1] - tmpA[1]) * t) * (1 - pull);
    at[2] = (tmpA[2] + (tmpB[2] - tmpA[2]) * t) * (1 - pull);

    /* sehr langsame Eigenbewegung, damit die Szene nie stillsteht */
    azi += st.time * 0.016;
    var par = 0.30;
    var a = azi + st.tx * par;
    var e = hgt + st.ty * par * 0.55;

    var outward = Math.max(k0[6] || 0, k1[6] || 0) * (1 - pull);
    var rl = Math.hypot(at[0], at[1], at[2]);
    if (outward > 0.01 && rl > 0.2) {
      /* An einen Datenpunkt von außen heranfliegen: der Punkt steht vorn,
         die übrige Struktur liegt dahinter. Sonst steckt die Kamera in der
         Wolke und alles verschwimmt zu Grau. */
      var nx = at[0] / rl, ny = at[1] / rl, nz = at[2] / rl;
      var tx2 = -nz, ty2 = 0, tz2 = nx;
      var tl = Math.hypot(tx2, tz2) || 1;
      tx2 /= tl; tz2 /= tl;
      var side = Math.sin(a) * 0.42, lift = Math.sin(e * 2.2) * 0.34;
      var ox2 = (nx * 0.88 + tx2 * side) * dist;
      var oy2 = (ny * 0.88 + lift) * dist;
      var oz2 = (nz * 0.88 + tz2 * side) * dist;
      var fx = at[0] + Math.cos(a) * Math.cos(e) * dist;
      var fy = at[1] + Math.sin(e) * dist;
      var fz = at[2] + Math.sin(a) * Math.cos(e) * dist;
      eye[0] = fx + (at[0] + ox2 - fx) * outward;
      eye[1] = fy + (at[1] + oy2 - fy) * outward;
      eye[2] = fz + (at[2] + oz2 - fz) * outward;
    } else {
      eye[0] = at[0] + Math.cos(a) * Math.cos(e) * dist;
      eye[1] = at[1] + Math.sin(e) * dist;
      eye[2] = at[2] + Math.sin(a) * Math.cos(e) * dist;
    }

    perspective(fov * DEG, view.w / view.h, 0.01, 60, mProj);
    lookAt(eye, at, up, mView);
    mul(mProj, mView, mVP);
    camOut.dist = dist;
    camOut.fov = fov;
    return camOut;
  }

  var camOut = { dist: 1, fov: 42 };

  function project(x, y, z, out) {
    var cw = mVP[3] * x + mVP[7] * y + mVP[11] * z + mVP[15];
    if (cw <= 0.0001) { return false; }
    var cx = mVP[0] * x + mVP[4] * y + mVP[8] * z + mVP[12];
    var cy = mVP[1] * x + mVP[5] * y + mVP[9] * z + mVP[13];
    out[0] = (cx / cw * 0.5 + 0.5) * view.cssW;
    out[1] = (0.5 - cy / cw * 0.5) * view.cssH;
    out[2] = cw;
    return true;
  }

  /* ================================================================== *
   * Bild zeichnen
   * ================================================================== */

  var scr = [0, 0, 0];
  var nodePosBuf = [0, 0, 0];

  function morphedNode(i, m01, m12, out) {
    var o = i * 4;
    var ax2 = W.T0[o], ay2 = W.T0[o + 1], az2 = W.T0[o + 2];
    var bx2 = W.T1[o], by2 = W.T1[o + 1], bz2 = W.T1[o + 2];
    var cx2 = W.T2[o], cy2 = W.T2[o + 1], cz2 = W.T2[o + 2];
    out[0] = (ax2 + (bx2 - ax2) * m01) * (1 - m12) + cx2 * m12;
    out[1] = (ay2 + (by2 - ay2) * m01) * (1 - m12) + cy2 * m12;
    out[2] = (az2 + (bz2 - az2) * m01) * (1 - m12) + cz2 * m12;
    return out;
  }

  function drawLabels(p, m01, m12) {
    for (var i = 0; i < labels.length; i++) {
      var L = labels[i];
      var vis = window01(p, L.from, L.to, L.fade);
      if (vis <= 0.002) {
        if (L.shown) {
          L.el.style.opacity = '0';
          L.el.style.visibility = 'hidden';
          L.el.style.willChange = '';
          L.el.classList.remove('is-on');
          L.shown = false;
        }
        continue;
      }
      var ok = true, depth = 1;
      if (L.kind === 'center') {
        scr[0] = view.cssW * 0.5; scr[1] = view.cssH * 0.5;
      } else if (L.kind === 'node') {
        morphedNode(L.idx, m01, m12, nodePosBuf);
        ok = project(nodePosBuf[0], nodePosBuf[1], nodePosBuf[2], scr);
        depth = scr[2];
      } else if (L.kind === 'orbit') {
        ok = project(Math.cos(L.x), 0, Math.sin(L.x), scr);
        depth = scr[2];
      } else if (L.kind === 'ring') {
        var rang = L.x + st.time * L.z;
        ok = project(Math.cos(rang) * L.r, L.y, Math.sin(rang) * L.r, scr);
        depth = scr[2];
      } else {
        ok = project(L.x, L.y, L.z, scr);
        depth = scr[2];
      }
      if (!ok) {
        if (L.shown) {
          L.el.style.opacity = '0';
          L.el.style.visibility = 'hidden';
          L.el.style.willChange = '';
          L.el.classList.remove('is-on');
          L.shown = false;
        }
        continue;
      }
      /* Weiter entfernte Begriffe sind kleiner und schwächer – dadurch
         entsteht die räumliche Tiefe im Textraum. */
      var sc = L.kind === 'center' ? 1 : Math.max(0.42, Math.min(1.25, 1.6 / Math.max(0.35, depth)));
      if (L.panel) { sc = Math.max(0.78, Math.min(1.12, 1.05 / Math.max(0.4, depth))); }
      /* Die kreisenden Standards sollen auch auf der Rueckseite lesbar
         bleiben, deshalb ein engerer Bereich fuer Groesse und Deckkraft. */
      if (L.kind === 'ring') { sc = Math.max(0.66, Math.min(1.1, 1.35 / Math.max(0.4, depth))); }
      var op = vis * (L.kind === 'center' ? 1 : Math.max(0.32, Math.min(1, 2.9 / Math.max(0.4, depth))));
      if (L.kind === 'ring') { op = vis * Math.max(0.5, Math.min(1, 2.4 / Math.max(0.4, depth))); }
      if (!L.shown) {
        L.el.style.visibility = 'visible';
        L.el.style.willChange = 'transform, opacity';
        L.el.classList.add('is-on');
        L.shown = true;
      }
      L.el.style.opacity = op.toFixed(3);
      /* "right" setzt den Text neben den Punkt, damit die dünne Linie
         davor vom Punkt weg läuft und die Schrift ihn nicht verdeckt. */
      var off = 'translate(-50%,-50%)';
      if (L.align === 'right') {
        /* Am rechten Rand nach links klappen, damit nichts abgeschnitten
           wird; die dünne Linie wechselt dazu die Seite (siehe is-flip). */
        var flip = scr[0] > view.cssW * 0.58;
        if (flip !== L.flip) { L.el.classList.toggle('is-flip', flip); L.flip = flip; }
        off = flip ? 'translate(-100%,-50%) translateX(-18px)' : 'translate(18px,-50%)';
      }
      L.el.style.transform = 'translate3d(' + Math.round(scr[0]) + 'px,' +
        Math.round(scr[1]) + 'px,0) ' + off + ' scale(' + sc.toFixed(3) + ')';
    }
  }

  var wordHome = null;

  function measureWord() {
    if (!wordA || !wordB) { return; }
    var ta = wordA.style.transform, tb = wordB.style.transform;
    wordA.style.transform = 'none'; wordB.style.transform = 'none';
    var rr = root.getBoundingClientRect();
    var ra = wordA.getBoundingClientRect(), rb = wordB.getBoundingClientRect();
    wordHome = {
      ax: ra.left - rr.left + ra.width / 2, ay: ra.top - rr.top + ra.height / 2,
      bx: rb.left - rr.left + rb.width / 2, by: rb.top - rr.top + rb.height / 2
    };
    wordA.style.transform = ta; wordB.style.transform = tb;
  }

  function drawWord(p) {
    if (!wordEl || !wordA || !wordB) { return; }
    if (!wordHome) { measureWord(); }
    if (!wordHome) { return; }
    /* "carus" und ".one" erscheinen gegenüberliegend auf der Umlaufbahn
       und werden von der Kamerabewegung zusammengeführt. Am Ende sitzen
       beide auf ihrer normalen Textposition und lesen sich als carus.one. */
    var appear = ease(SC.orbit[0] + 0.004, SC.orbit[0] + 0.030, p);
    var appearB = ease(SC.orbit[0] + 0.020, SC.orbit[0] + 0.046, p);
    var merge = ease(SC.orbit[0] + 0.036, SC.orbit[1] + 0.006, p);
    wordEl.style.opacity = Math.max(appear, appearB).toFixed(3);
    if (appear <= 0.002 && appearB <= 0.002) {
      wordEl.style.visibility = 'hidden';
      return;
    }
    wordEl.style.visibility = 'visible';

    var spread = 1 - merge;
    var ang = 1.15 + st.time * 0.10;

    function place(el, hx, hy, angle, base) {
      if (project(Math.cos(angle), 0.02, Math.sin(angle), scr)) {
        el.style.transform = 'translate3d(' + ((scr[0] - hx) * spread).toFixed(1) + 'px,' +
          ((scr[1] - hy) * spread).toFixed(1) + 'px,0)';
      } else {
        el.style.transform = 'none';
      }
      el.style.opacity = base.toFixed(3);
    }
    place(wordA, wordHome.ax, wordHome.ay, ang, appear);
    place(wordB, wordHome.bx, wordHome.by, ang + Math.PI, appearB);
  }

  function frame(now) {
    pending = false;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    st.time += dt;

    if (st.autoplay) {
      st.p = Math.min(1, st.p + dt / STORY_SECONDS);
      if (st.p >= 1) { st.autoplay = false; }
    }
    var isFinal = st.p > 0.955;
    if (isFinal !== st.wasFinal) {
      root.classList.toggle('is-final', isFinal);
      st.wasFinal = isFinal;
    }
    /* Idle: nach dem Ende bleibt die Szene in Bewegung, aber ruhig. */
    st.tx += (st.mx * 1.5 - st.tx) * Math.min(1, dt * 2.6);
    st.ty += (st.my * 1.1 - st.ty) * Math.min(1, dt * 2.6);

    resize();
    if (!fbScene || !fbA || !fbB) { if (running) { req(); } return; }

    var p = st.p;
    var m01 = ease(SC.pop[0] - 0.01, SC.pop[0] + 0.085, p);
    var m12 = ease(SC.orbit[0] - 0.030, SC.orbit[0] + 0.060, p);
    var grow = ease(SC.first[0] - 0.005, SC.grow[1], p);
    /* Vor dem ersten Punkt ist die Szene wirklich leer. */
    var seedIn = ease(SC.seed[0], SC.seed[1], p);
    var globalDim = 0.22 + 0.78 * seedIn;
    /* In der weiten Populationsansicht etwas anheben, sonst verliert sich
       die Landschaft in der Entfernung. */
    globalDim *= 1 + 0.34 * window01(p, SC.pop[0] + 0.03, SC.pop[1] - 0.01, 0.04);
    globalDim *= 1 - 0.45 * window01(p, SC.art[0] + 0.01, SC.art[1] - 0.01, 0.02);
    /* Im Finale wird die Datenwelt dunkler, der Text tritt hervor. */
    globalDim *= 1 - 0.28 * ease(SC.end[0], 1.0, p);

    var cam = updateCamera(p, m01, m12);
    var pix = (view.h * 0.5) / Math.tan(0.5 * cam.fov * DEG) * 0.0115;
    /* In Szene 3 zieht sich die Aufmerksamkeit auf den nahen Datenpunkt
       zusammen, sonst bleibt die ganze Struktur lesbar. */
    var fall = 0.010 + 0.42 * window01(p, SC.data[0] + 0.01, SC.data[1] - 0.005, 0.03);
    /* Welcher Datenpunkt ist gerade im Fokus? Ergibt sich aus derselben
       Zeitrechnung wie die Beschriftung. */
    var hotIdx = -1, hotAmt = 0;
    for (var hk = 0; hk < DP_COUNT; hk++) {
      var ha = DP_START + hk * DP_STEP;
      var hv = window01(p, ha + DP_TRAVEL * 0.5, ha + DP_STEP - 0.004, 0.008);
      if (hv > hotAmt) { hotAmt = hv; hotIdx = W.named['spine' + hk]; }
    }
    if (typeof hotIdx !== 'number') { hotIdx = -1; }

    /* --- Szene in den Float-Puffer ------------------------------- */
    gl.bindVertexArray(emptyVao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbScene.fb);
    gl.viewport(0, 0, view.w, view.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    /* Kanten zuerst, sie liegen hinter den Punkten. */
    gl.useProgram(pLine);
    gl.uniform1i(uLine.uT0, 0); gl.uniform1i(uLine.uT1, 1); gl.uniform1i(uLine.uT2, 2);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tN[0]);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tN[1]);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tN[2]);
    gl.uniform1i(uLine.uTexW, TEXW);
    gl.uniform1f(uLine.uM01, m01); gl.uniform1f(uLine.uM12, m12);
    gl.uniform1f(uLine.uTime, st.time);
    gl.uniformMatrix4fv(uLine.uVP, false, mVP);
    gl.uniform1f(uLine.uGrow, grow);
    gl.uniform1f(uLine.uDim, globalDim);
    gl.uniform3f(uLine.uEye, eye[0], eye[1], eye[2]);
    gl.uniform1i(uLine.uSeg, SEG);
    gl.uniform1i(uLine.uE0, 3); gl.uniform1i(uLine.uE1, 4);

    /* Kantensätze passend zum Layout ein- und ausblenden. */
    /* Beim ersten Aufbau sind die Linien kurz kräftiger – dort erzählen
       sie die Geschichte. Danach begleiten sie nur noch. */
    var lineLead = 1 + 2.6 * window01(p, SC.first[0] - 0.005, SC.grow[0] + 0.05, 0.025);
    var setAlpha = [
      0.105 * lineLead * (1 - ease(SC.pop[0] - 0.02, SC.pop[0] + 0.06, p)),
      0.16 * ease(SC.pop[0] - 0.01, SC.pop[0] + 0.07, p) * (1 - ease(SC.orbit[0] - 0.03, SC.orbit[0] + 0.05, p)),
      0.125 * ease(SC.orbit[0] - 0.02, SC.orbit[0] + 0.07, p)
    ];
    for (var s = 0; s < sets.length; s++) {
      if (setAlpha[s] <= 0.002 || !sets[s].n) { continue; }
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, sets[s].t0);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, sets[s].t1);
      gl.uniform1i(uLine.uETexW, sets[s].w);
      gl.uniform1f(uLine.uSet, setAlpha[s]);
      gl.drawArrays(gl.LINES, 0, sets[s].n * SEG * 2);
    }

    /* Punkte */
    gl.useProgram(pPoint);
    gl.uniform1i(uPoint.uT0, 0); gl.uniform1i(uPoint.uT1, 1); gl.uniform1i(uPoint.uT2, 2);
    gl.uniform1i(uPoint.uTexW, TEXW);
    gl.uniform1f(uPoint.uM01, m01); gl.uniform1f(uPoint.uM12, m12);
    gl.uniform1f(uPoint.uTime, st.time);
    gl.uniformMatrix4fv(uPoint.uVP, false, mVP);
    gl.uniform3f(uPoint.uEye, eye[0], eye[1], eye[2]);
    gl.uniform1f(uPoint.uGrow, grow);
    gl.uniform1f(uPoint.uPix, pix);
    gl.uniform1f(uPoint.uDim, globalDim);
    gl.uniform1f(uPoint.uFocus, cam.dist);
    gl.uniform1f(uPoint.uFall, fall);
    gl.uniform1i(uPoint.uHot, hotIdx);
    gl.uniform1f(uPoint.uHotAmt, hotAmt);
    gl.drawArrays(gl.POINTS, 0, W.count);

    gl.disable(gl.BLEND);

    /* --- Bloom ---------------------------------------------------- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbA.fb);
    gl.viewport(0, 0, fbA.w, fbA.h);
    gl.useProgram(pBright);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbScene.tex);
    gl.uniform1i(uBright.uTex, 0);
    gl.uniform1f(uBright.uThresh, 0.55);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(pBlur);
    gl.uniform1i(uBlur.uTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB.fb);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbA.tex);
    gl.uniform2f(uBlur.uStep, 1 / fbA.w, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbA.fb);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbB.tex);
    gl.uniform2f(uBlur.uStep, 0, 1 / fbA.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* --- Auf den Bildschirm -------------------------------------- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, view.w, view.h);
    gl.useProgram(pComp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbScene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbA.tex);
    gl.uniform1i(uComp.uScene, 0); gl.uniform1i(uComp.uBloom, 1);
    gl.uniform1f(uComp.uExposure, 1.05);
    gl.uniform1f(uComp.uBloomAmt, 0.85);
    gl.uniform1f(uComp.uTime, st.time);
    gl.uniform2f(uComp.uRes, view.w, view.h);
    gl.uniform1f(uComp.uFade, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* --- Text ---------------------------------------------------- */
    drawLabels(p, m01, m12);
    drawWord(p);
    /* "Healthcare" – Pause – "beyond imagination." – dann der Rest. */
    if (sloA) { reveal(sloA, ease(SLOGAN_A[0], SLOGAN_A[1], p)); }
    if (sloB) { reveal(sloB, ease(SLOGAN_B[0], SLOGAN_B[1], p)); }
    /* Der Rest erscheint ohne Staffelung: ein Block, eine Blende. */
    var finT = ease(FIN_START, FIN_START + FIN_FADE, p);
    for (var fi = 0; fi < finParts.length; fi++) {
      reveal(finParts[fi], finT);
    }
    if (progressEl) { progressEl.style.transform = 'scaleX(' + p.toFixed(4) + ')'; }

    /* --- Bildrate beobachten und Auflösung anpassen -------------- */
    fpsFrames++;
    if (now - fpsSince > 1600) {
      var fps = fpsFrames * 1000 / (now - fpsSince);
      fpsFrames = 0; fpsSince = now;
      if (fps < 42 && maxDpr > 0.85) {
        maxDpr = Math.max(0.85, maxDpr - 0.25);
        view.w = 0; resize();
      }
    }

    if (running) { req(); }
  }

  var running = false, pending = false, last = 0;
  var fpsFrames = 0, fpsSince = 0;

  function req() {
    if (pending) { return; }
    pending = true;
    window.requestAnimationFrame(frame);
  }

  function start() {
    if (running) { return; }
    running = true; last = 0; fpsSince = performance.now(); fpsFrames = 0;
    req();
  }

  function stop() { running = false; }

  window.addEventListener('resize', function () {
    view.w = 0; resize(); wordHome = null;
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); } else if (!st.paused && onScreen) { start(); }
  });

  /* Liegt der Teaser ausserhalb des Bildes, wird nicht gerechnet. Der
     Wiedereinstieg ist unkritisch: der Zustand liegt vollstaendig in st. */
  var onScreen = true;
  if (window.IntersectionObserver) {
    var vis = new window.IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (!onScreen) { stop(); } else if (!st.paused && !document.hidden) { start(); }
    }, { threshold: 0 });
    vis.observe(root);
  }

  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    stop();
    root.classList.add('is-fallback', 'is-final');
  });

  root.classList.add('is-live');
  /* Wird die Seite mit einem Anker oder bereits gescrollt geoeffnet, ist
     die Sequenz nicht der Einstieg: sie steht dann fertig da und gibt
     das Scrollen sofort frei. */
  if ((window.pageYOffset || 0) > 1 || window.location.hash) {
    st.p = 1;
    st.autoplay = false;
    root.classList.add('is-final');
    st.wasFinal = true;
  }
  if (reduceMotion) {
    root.classList.add('is-final');
    st.p = 1;
    /* Ein Bild genügt; auf Wunsch nach ruhiger Darstellung bleibt es stehen. */
    resize();
    running = false;
    window.requestAnimationFrame(function (t) { frame(t); });
  } else {
    resize();
    start();
  }
})();
