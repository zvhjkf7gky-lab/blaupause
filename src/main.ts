import { readInput, B, Input } from './input/gamepad';
import { rumble, hasHaptics } from './input/haptics';
import { Game } from './game/game';
import { generateBlock } from './gen/block';
import { fit } from './render/view';
import { drawGame, fmtTime } from './render/draw';
import { drawConnect, drawPortrait, drawMenu, drawEnd, Item } from './ui/screens';
import { Tutorial } from './ui/tutorial';
import { store, todaySeed } from './storage';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const STEP = 1 / 120;

type Screen = 'connect' | 'menu' | 'settings' | 'game' | 'pause' | 'end';
let screen: Screen = 'connect';
let game: Game | null = null;
let sel = 0;
let acc = 0, last = performance.now();
let holdTri = 0;
let record = false;
let tut: Tutorial | null = null;

function start(daily: boolean) {
  game = new Game(daily ? todaySeed() : (Math.random() * 0x100000000) >>> 0, daily);
  tut = store.tutorial ? new Tutorial(game) : null;
  screen = 'game'; acc = 0; holdTri = 0;
}
const go = (s: Screen) => { screen = s; sel = 0; };
const bestBlocks = (daily: boolean) => (daily ? store.dailyBest() : store.best())?.blocks ?? 0;
const vibLabel = () => `${Math.round(store.vib * 100)} %`;

function menuNav(inp: Input, n: number) {
  if (inp.navY) sel = (sel + inp.navY + n) % n;
}

function update(dt: number, inp: Input, now: number) {
  const ok = inp.pressed[B.CROSS], back = inp.pressed[B.CIRCLE];
  switch (screen) {
    case 'connect':
      if (inp.connected) go('menu');
      break;
    case 'menu':
      if (!inp.connected) { go('connect'); break; }
      menuNav(inp, 3);
      if (ok) { if (sel === 0) start(false); else if (sel === 1) start(true); else go('settings'); }
      break;
    case 'settings':
      menuNav(inp, 3);
      if (sel === 0 && (ok || inp.navX)) {
        const steps = [0, 0.5, 1], i = steps.indexOf(store.vib);
        store.vib = steps[(i + (inp.navX || 1) + 3) % 3];
        rumble(inp.pad, store.vib, store.vib, now, true);
      } else if (sel === 1 && (ok || inp.navX)) store.tutorial = !store.tutorial;
      else if (back || (ok && sel === 2)) go('menu');
      break;
    case 'game': {
      const g = game!;
      if (!inp.connected || inp.pressed[B.OPTIONS]) { go('pause'); break; }
      holdTri = inp.down[B.TRIANGLE] ? holdTri + dt : 0;
      if (holdTri >= 0.5) { start(g.daily); break; }
      acc += dt;
      while (acc >= STEP && !g.over) { g.step(STEP, inp); acc -= STEP; }
      if (tut) { tut.update(dt, g); if (tut.done) { store.tutorial = false; tut = null; } }
      g.pregen();
      if (g.over) {
        record = store.submit(g.daily, g.seed, { blocks: g.blockN - 1, time: Math.round(g.runTime) });
        go('end');
      }
      break;
    }
    case 'pause':
      if (!inp.connected) break;
      menuNav(inp, 3);
      if (inp.pressed[B.OPTIONS] || back || (ok && sel === 0)) { screen = 'game'; acc = 0; holdTri = 0; }
      else if (ok && sel === 1) start(game!.daily);
      else if (ok && sel === 2) go('menu');
      break;
    case 'end':
      if (inp.pressed[B.TRIANGLE] || ok) start(game!.daily);
      else if (back) go('menu');
      break;
  }
}

function haptics(inp: Input, now: number) {
  const g = game;
  if (screen !== 'game' || !g || store.vib <= 0) { rumble(inp.pad, 0, 0, now); return; }
  let weak = 0, strong = 0;
  if (g.listen > 0) {
    // Lauschen: Schritte der nächsten Wache als kurze Impulse
    if (g.runTime - g.stepPulseT < 0.09) { weak = g.stepPulse; strong = g.stepPulse * 0.4; }
  } else {
    const d = g.danger;
    weak = d > 0.2 ? (d - 0.2) / 0.8 : 0;
    strong = d > 0.7 ? (d - 0.7) / 0.3 : 0;
    if (g.inLight && Math.sin(g.runTime * Math.PI * 2 * (2 + 6 * g.alarm)) < 0) { weak *= 0.15; strong = 0; }
  }
  rumble(inp.pad, weak * store.vib, strong * store.vib, now);
}

function render(inp: Input, now: number) {
  fit(canvas, ctx);
  if (window.innerHeight > window.innerWidth) { drawPortrait(ctx); return; }
  const ctl = 'STICK = RICHTUNG   R2 = TEMPO   L2 = LAUSCHEN   OPTIONS = PAUSE';
  const g = game;
  if (g && (screen === 'game' || screen === 'pause' || screen === 'end'))
{
    drawGame(ctx, g, { best: bestBlocks(g.daily), edgePulse: !hasHaptics(inp.pad) || store.vib <= 0 });
    if (tut && screen === 'game') tut.draw(ctx);
  }
  switch (screen) {
    case 'connect': drawConnect(ctx, now / 1000); break;
    case 'menu': {
      const b = store.best(), d = store.dailyBest();
      const items: Item[] = [
        { label: 'FREIER LAUF', value: b ? `BEST ${b.blocks}` : '' },
        { label: 'TAGES-GEFÄNGNIS', value: d ? `HEUTE ${d.blocks}` : String(todaySeed()) },
        { label: 'EINSTELLUNGEN' },
      ];
      drawMenu(ctx, 'BLAUPAUSE', 'AUSBRUCH NACH PLAN', items, sel, [ctl, 'KREUZ = WÄHLEN']);
      break;
    }
    case 'settings':
      drawMenu(ctx, 'EINSTELLUNGEN', undefined, [{ label: 'VIBRATION', value: `◀ ${vibLabel()} ▶` }, { label: 'EINFÜHRUNG', value: store.tutorial ? '◀ AN ▶' : '◀ AUS ▶' }, { label: 'ZURÜCK' }], sel,
        [hasHaptics(inp.pad) ? 'DIE VIBRATION MELDET DIE NÄHE ZUR GEFAHR' : 'DIESER BROWSER MELDET KEINE VIBRATION: DER BILDSCHIRMRAND PULSIERT STATTDESSEN', 'KREIS = ZURÜCK']);
      break;
    case 'pause':
      drawMenu(ctx, 'PAUSE', inp.connected ? undefined : 'CONTROLLER GETRENNT', [{ label: 'FORTSETZEN' }, { label: 'NEU STARTEN' }, { label: 'HAUPTMENÜ' }], sel,
        [ctl, 'DREIECK HALTEN = SOFORT NEU STARTEN'], true);
      break;
    case 'end': {
      const b = g!.daily ? store.dailyBest() : store.best();
      drawEnd(ctx, [['TRAKTE GESCHAFFT', String(g!.blockN - 1)], ['ZEIT', fmtTime(g!.runTime)], [g!.daily ? 'BESTWERT HEUTE' : 'BESTWERT', b ? `${b.blocks}  (${fmtTime(b.time)})` : '–']], record);
      break;
    }
  }
}

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const inp = readInput();
  update(dt, inp, now);
  haptics(inp, now);
  render(inp, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'game') go('pause'); });

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__bp = { generateBlock, game: () => game, screen: () => screen, tut: () => tut };

// PWA: offline spielbar. Beim ersten Besuch werden die schon geladenen Dateien nachträglich in den Cache gelegt.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(async () => {
    const urls = [location.href, 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-512.png', ...performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin))];
    const c = await caches.open('blaupause-v1');
    await Promise.all(urls.map((u) => c.add(u).catch(() => {})));
  }).catch(() => {});
}
