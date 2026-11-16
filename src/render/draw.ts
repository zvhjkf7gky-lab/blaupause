import { W, H, clamp, solidAt, rayDist, idx } from '../game/geom';
import { Block, camAng, spotPos, GUARD_RANGE, GUARD_HALF, CAM_RANGE, CAM_HALF, DOG_SCENT, FLOOR_NAME } from '../gen/block';
import { Game, PLAYER_R } from '../game/game';
import { LW, LH, T, OY, BG, LINE, LIGHT, RED, text, gridBg } from './view';

const X = (v: number) => v * T, Y = (v: number) => OY + v * T;

interface Static { walls: Path2D; fill: Path2D; floors: Path2D; dots: Path2D }
const cache = new WeakMap<Block, Static>();

function buildStatic(b: Block): Static {
  const walls = new Path2D(), fill = new Path2D(), floors = new Path2D(), dots = new Path2D();
  const s = b.solid;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = X(x), py = Y(y);
    if (s[idx(x, y)]) {
      fill.rect(px, py, T, T);
      if (y > 0 && !solidAt(s, x, y - 1)) { walls.moveTo(px, py); walls.lineTo(px + T, py); }
      if (y < H - 1 && !solidAt(s, x, y + 1)) { walls.moveTo(px, py + T); walls.lineTo(px + T, py + T); }
      if (x > 0 && !solidAt(s, x - 1, y)) { walls.moveTo(px, py); walls.lineTo(px, py + T); }
      if (x < W - 1 && !solidAt(s, x + 1, y)) { walls.moveTo(px + T, py); walls.lineTo(px + T, py + T); }
      continue;
    }
    // Schraffuren der lauten Böden
    switch (b.floor[idx(x, y)]) {
      case 1: // Gitterrost: Kreuzraster
        for (let k = 8; k < T; k += 8) { floors.moveTo(px + k, py + 3); floors.lineTo(px + k, py + T - 3); floors.moveTo(px + 3, py + k); floors.lineTo(px + T - 3, py + k); }
        break;
      case 2: // Kies: Punkte
        for (let k = 0; k < 9; k++) { const dx = 5 + ((k * 17 + x * 7) % 30), dy = 5 + ((k * 11 + y * 13 + k * k) % 30); dots.moveTo(px + dx + 1.6, py + dy); dots.arc(px + dx, py + dy, 1.6, 0, 7); }
        break;
      case 3: // Pfütze: Wellen
        for (let k = 10; k < T; k += 10) { floors.moveTo(px + 5, py + k); floors.quadraticCurveTo(px + 12, py + k - 5, px + 20, py + k); floors.quadraticCurveTo(px + 28, py + k + 5, px + 35, py + k); }
        break;
      case 4: // Glasscherben: Splitter
        for (let k = 0; k < 5; k++) { const dx = 6 + ((k * 13 + x * 5) % 26), dy = 6 + ((k * 19 + y * 3) % 26); floors.moveTo(px + dx, py + dy); floors.lineTo(px + dx + 6, py + dy + 3); floors.lineTo(px + dx + 2, py + dy + 7); floors.closePath(); }
        break;
    }
  }
  return { walls, fill, floors, dots };
}

function cone(ctx: CanvasRenderingContext2D, s: Uint8Array, x: number, y: number, ang: number, half: number, range: number, alpha: number) {
  ctx.beginPath();
  ctx.moveTo(X(x), Y(y));
  const n = Math.max(8, Math.ceil(half * 40));
  for (let i = 0; i <= n; i++) {
    const a = ang - half + (2 * half * i) / n, d = rayDist(s, x, y, a, range);
    ctx.lineTo(X(x + Math.cos(a) * d), Y(y + Math.sin(a) * d));
  }
  ctx.closePath();
  ctx.fillStyle = LIGHT; ctx.globalAlpha = alpha; ctx.fill();
  ctx.globalAlpha = Math.min(1, alpha * 2.2); ctx.strokeStyle = LIGHT; ctx.lineWidth = 1; ctx.stroke();
  ctx.globalAlpha = 1;
}

function rings(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number, alpha: number, size = 26) {
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  for (let k = 0; k < 2; k++) {
    const p = phase - k * 0.35;
    if (p < 0 || p > 1) continue;
    ctx.globalAlpha = alpha * (1 - p);
    ctx.beginPath(); ctx.arc(X(x), Y(y), 5 + p * size, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export interface Hud { best: number; edgePulse: boolean }

export function drawGame(ctx: CanvasRenderingContext2D, g: Game, hud: Hud) {
  const b = g.block, s = b.solid;
  let st = cache.get(b);
  if (!st) cache.set(b, (st = buildStatic(b)));
  const hot = clamp((g.alarm - 0.5) / 0.5);

  ctx.save();
  ctx.beginPath(); ctx.rect(0, OY, LW, LH - OY); ctx.clip();
  gridBg(ctx, OY);
  if (hot > 0) { ctx.fillStyle = RED; ctx.globalAlpha = 0.05 + hot * 0.16; ctx.fillRect(0, OY, LW, LH - OY); ctx.globalAlpha = 1; }

  // Plan: Wände, Böden, Beschriftung
  ctx.fillStyle = LINE; ctx.globalAlpha = 0.07; ctx.fill(st.fill);
  ctx.globalAlpha = 0.55; ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke(st.floors); ctx.fill(st.dots);
  ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
  b.rooms.forEach((r, i) => {
    text(ctx, `${b.n === 1 && i === 0 ? 'ZELLE' : 'R'}-${b.n}${String(i + 1).padStart(2, '0')}`, X(r.x) + 5, Y(r.y) + 10, 9, 'left', LINE, false);
    const y = Y(r.y) - 9, x0 = X(r.x), x1 = X(r.x + r.w);
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.moveTo(x0, y - 4); ctx.lineTo(x0, y + 4); ctx.moveTo(x1, y - 4); ctx.lineTo(x1, y + 4); ctx.stroke();
    ctx.fillStyle = BG; ctx.globalAlpha = 1; ctx.fillRect((x0 + x1) / 2 - 17, y - 6, 34, 12); ctx.globalAlpha = 0.5;
    text(ctx, `${(r.w * 1.5).toFixed(1)} M`, (x0 + x1) / 2, y, 9, 'center', LINE, false);
  });
  ctx.globalAlpha = 0.9;
  text(ctx, 'AUS ▶', X(W) - 6, Y(b.exitY) + 10, 10, 'right');
  if (b.n > 1) text(ctx, '▶ EIN', 6, Y(b.entryY) + 10, 10, 'left');
  ctx.globalAlpha = 1;

  // Sichtfeld der Figur: Gegner und Licht sieht man nur, wo man hinsehen kann.
  const vis = new Path2D();
  const N = 240;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, d = rayDist(s, g.px, g.py, a, 40) + 0.02;
    const vx = X(g.px + Math.cos(a) * d), vy = Y(g.py + Math.sin(a) * d);
    if (i) vis.lineTo(vx, vy); else vis.moveTo(vx, vy);
  }
  vis.closePath();
  const dark = new Path2D(); dark.rect(0, OY, LW, LH - OY); dark.addPath(vis);
  ctx.fillStyle = '#04182f'; ctx.globalAlpha = 0.38; ctx.fill(dark, 'evenodd'); ctx.globalAlpha = 1;
  ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.lineCap = 'square'; ctx.stroke(st.walls);

  ctx.save();
  ctx.clip(vis);
  for (const sp of b.spots) {
    const p = spotPos(sp, g.t);
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), sp.r * T, 0, 7);
    ctx.fillStyle = LIGHT; ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 0.7; ctx.strokeStyle = LIGHT; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (const c of b.cams) cone(ctx, s, c.x, c.y, camAng(c, g.t), CAM_HALF, CAM_RANGE, 0.25);
  for (const gd of g.guards) cone(ctx, s, gd.x, gd.y, gd.ang, GUARD_HALF, GUARD_RANGE, gd.sees ? 0.45 : 0.25);
  ctx.strokeStyle = LINE; ctx.lineWidth = 2;
  for (const c of b.cams) { // Kamera: Dreieck
    const a = camAng(c, g.t), x = X(c.x), y = Y(c.y);
    ctx.beginPath();
    for (let k = 0; k < 3; k++) { const aa = a + (k * Math.PI * 2) / 3; ctx.lineTo(x + Math.cos(aa) * 9, y + Math.sin(aa) * 9); }
    ctx.closePath(); ctx.fillStyle = BG; ctx.fill(); ctx.stroke();
  }
  for (const sl of g.sleepers) { // Schlafender: Kreis mit Z
    ctx.beginPath(); ctx.arc(X(sl.x), Y(sl.y), 10, 0, 7); ctx.fillStyle = BG; ctx.fill();
    ctx.strokeStyle = sl.awake > 0 ? RED : LINE; ctx.stroke(); ctx.strokeStyle = LINE;
    text(ctx, sl.awake > 0 ? '!' : 'Z', X(sl.x), Y(sl.y) + 1, 12, 'center', sl.awake > 0 ? RED : LINE);
  }
  for (const d of g.dogs) { // Hund: Raute, gestrichelter Witterungskreis
    const x = X(d.x), y = Y(d.y), col = d.bark > 0 ? RED : LINE;
    ctx.setLineDash([3, 5]); ctx.lineWidth = 1; ctx.globalAlpha = 0.5; ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(x, y, DOG_SCENT * T, 0, 7); ctx.stroke();
    if (d.scent > 0) { ctx.setLineDash([]); ctx.globalAlpha = 0.9; ctx.lineWidth = 2; ctx.strokeStyle = RED; ctx.beginPath(); ctx.arc(x, y, DOG_SCENT * T, -Math.PI / 2, -Math.PI / 2 + (d.scent / 4) * Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = col;
    ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 11, y); ctx.lineTo(x, y + 11); ctx.lineTo(x - 11, y); ctx.closePath();
    ctx.fillStyle = BG; ctx.fill(); ctx.stroke(); ctx.strokeStyle = LINE;
  }
  for (const gd of g.guards) { // Wache: Kreis mit Kreuz
    const x = X(gd.x), y = Y(gd.y), col = gd.sees || gd.mode === 'go' ? RED : LINE;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fillStyle = BG; ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7); ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7); ctx.stroke();
    if (gd.mode !== 'patrol' && !gd.sees) text(ctx, gd.mode === 'back' ? '…' : '?', x, y - 20, 13, 'center', RED);
    ctx.strokeStyle = LINE;
  }
  ctx.restore();

  // Figur mit Lärm-Ring
  const px = X(g.px), py = Y(g.py);
  if (g.noiseR > 0) {
    ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = g.heard ? RED : '#fff'; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(px, py, g.noiseR * T, 0, 7); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, PLAYER_R * T, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(g.pang) * 20, py + Math.sin(g.pang) * 20); ctx.stroke();

  // Lauschen: Bild dunkelt ab, Geräuschquellen erscheinen als Wellen (auch hinter Wänden)
  if (g.listen > 0) {
    ctx.fillStyle = '#020d1c'; ctx.globalAlpha = 0.25 + 0.4 * g.listen; ctx.fillRect(0, OY, LW, LH - OY); ctx.globalAlpha = 1;
    const R = g.listenRange;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.35; ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.arc(px, py, R * T, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const near = (x: number, y: number) => clamp(1.15 - Math.hypot(x - g.px, y - g.py) / R);
    for (const gd of g.guards) { const a = near(gd.x, gd.y); if (a > 0.15) rings(ctx, gd.x, gd.y, (g.runTime - gd.lastStep) / 0.6, a, 30); }
    for (const d of g.dogs) { const a = near(d.x, d.y); if (a > 0.15) rings(ctx, d.x, d.y, (g.runTime % 0.9) / 0.9, a * 0.9, 18); }
    for (const sl of g.sleepers) { const a = near(sl.x, sl.y); if (a > 0.15) rings(ctx, sl.x, sl.y, (g.runTime % 2.6) / 2.6, a * 0.8, 22); }
    for (const c of b.cams) { const a = near(c.x, c.y); if (a > 0.15) rings(ctx, c.x, c.y, (g.runTime % 0.5) / 0.5, a * 0.5, 9); }
  }

  if (g.bannerT > 0) {
    ctx.globalAlpha = clamp(g.bannerT);
    text(ctx, `TRAKT ${g.blockN}`, LW / 2, OY + 70, 44, 'center');
    ctx.globalAlpha = 1;
  }
  // Ersatz für fehlende Vibration: pulsierender Rand
  if (hud.edgePulse && g.danger > 0.2) {
    const a = ((g.danger - 0.2) / 0.8) * (g.inLight ? 0.55 + 0.45 * Math.sin(g.runTime * (12 + 36 * g.alarm)) : 0.8);
    ctx.strokeStyle = RED; ctx.lineWidth = 14; ctx.globalAlpha = clamp(a);
    ctx.strokeRect(7, OY + 7, LW - 14, LH - OY - 14); ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Anzeigenleiste
  ctx.fillStyle = '#062848'; ctx.fillRect(0, 0, LW, OY);
  ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, OY); ctx.lineTo(LW, OY); ctx.stroke();
  const my = OY / 2 + 1, F = 13;
  const bar = (x: number, w: number, v: number, col: string) => {
    ctx.lineWidth = 1; ctx.strokeStyle = LINE; ctx.strokeRect(x + 0.5, my - 7.5, w, 14);
    ctx.fillStyle = col; ctx.fillRect(x + 2.5, my - 5.5, (w - 4) * clamp(v), 10);
  };
  const acol = g.alarm >= 0.5 || g.inLight || g.heard ? RED : LINE;
  text(ctx, 'ALARM', 12, my, F, 'left', acol);
  bar(66, 150, g.alarm, acol);
  if (g.alarm < 0.5) { ctx.strokeStyle = LINE; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(66 + 75.5, my - 7); ctx.lineTo(66 + 75.5, my + 7); ctx.stroke(); ctx.globalAlpha = 1; }
  text(ctx, `${Math.floor(g.alarm * 100)}%`, 224, my, F, 'left', acol);
  text(ctx, 'LÄRM', 290, my, F);
  bar(334, 110, g.noiseR / 10, g.heard ? RED : LINE);
  text(ctx, FLOOR_NAME[g.floorType], 452, my, F, 'left', g.floorType ? LIGHT : LINE);
  text(ctx, `TRAKT ${g.blockN}`, 560, my, F);
  text(ctx, `BEST ${hud.best}`, 660, my, F);
  text(ctx, fmtTime(g.runTime), 750, my, F);
  text(ctx, `${g.daily ? 'TAG' : 'FREI'} ${g.daily ? g.seed : g.seed.toString(16).toUpperCase().padStart(8, '0')}`, LW - 12, my, F, 'right');
}

export function fmtTime(t: number): string {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
