/* ==================================================================== *
 * Nimmt die Einstiegssequenz Bild fuer Bild ab und schreibt ein MP4.
 *
 *   npm install playwright        # oder ein vorhandenes Playwright
 *   python3 -m http.server 8000   # im Wurzelverzeichnis dieses Repos
 *   node tools/record-teaser.js
 *
 * Das Ergebnis landet in backup/carus-one-teaser-1080p.mp4.
 *
 * Warum Bild fuer Bild und nicht mitschneiden: die Sequenz laeuft im
 * Browser so schnell, wie der Rechner sie rechnet. Ein Mitschnitt waere
 * ungleichmaessig. Hier wird die Schleife des Teasers angehalten und
 * jedes Bild einzeln angefordert - dann schreitet die Zeit im Skript pro
 * Bild um genau 50 ms voran (dt ist in js/teaser.js auf 0,05 s begrenzt).
 * Deshalb 20 Bilder je Sekunde: 800 Bilder sind genau die 40 Sekunden,
 * die die Geschichte dauert (STORY_SECONDS in js/teaser.js).
 *
 * Umgebungsvariablen: URL, OUT, FFMPEG, W, H, N, CRF, PLAYWRIGHT
 * ==================================================================== */

'use strict';

const { spawn } = require('child_process');
const path = require('path');

const PW = process.env.PLAYWRIGHT || 'playwright';
const { chromium } = require(PW);

const URL = process.env.URL || 'http://127.0.0.1:8000/teaser/';
const OUT = process.env.OUT ||
  path.join(__dirname, '..', 'backup', 'carus-one-teaser-1080p.mp4');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const W = Number(process.env.W || 1920);
const H = Number(process.env.H || 1080);
const FPS = 20;
const N = Number(process.env.N || 800);
const CRF = process.env.CRF || '24';

(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  /* Bedienelemente und Tastenhinweis gehoeren nicht in den Film. */
  await page.addStyleTag({ content: '.c1-tools,.pv-hint,.c1-progress{display:none!important}' });

  const ready = await page.evaluate(() => !!(document.querySelector('[data-c1-present]') || {}).c1);
  if (!ready) {
    throw new Error('Keine Steuerung gefunden. Laeuft WebGL 2? Ist es die Seite teaser/?');
  }

  /* Schleife anhalten: ab jetzt rechnet nur, wer einzeln gefragt wird. */
  await page.evaluate(() => document.querySelector('[data-c1-pause]').click());
  await page.waitForTimeout(300);

  const ff = spawn(FFMPEG, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', OUT], { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffLog = '';
  ff.stderr.on('data', d => { ffLog += d.toString(); });

  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    await page.evaluate(v => {
      document.querySelector('[data-c1-present]').c1.seek(v);
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, i / (N - 1));
    const shot = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(shot)) { await new Promise(r => ff.stdin.once('drain', r)); }
    if (i % 50 === 0 || i === N - 1) {
      const s = (Date.now() - t0) / 1000;
      process.stdout.write('Bild ' + (i + 1) + '/' + N +
        ' | ' + s.toFixed(0) + ' s | noch etwa ' +
        ((s / (i + 1)) * (N - i - 1) / 60).toFixed(1) + ' min\n');
    }
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c === 0
    ? res()
    : rej(new Error('ffmpeg endete mit ' + c + '\n' + ffLog.slice(-2000)))));
  await browser.close();

  if (errors.length) { process.stdout.write('Seitenfehler: ' + errors.join(' | ') + '\n'); }
  process.stdout.write('fertig: ' + OUT + '\n');
})();
