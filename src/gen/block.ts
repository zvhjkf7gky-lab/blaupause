import { Rng, hashSeed } from './rng';
import { W, H, P, idx, solidAt, bfs, los, angDiff } from '../game/geom';

export const GUARD_RANGE = 5, GUARD_HALF = 0.56;
export const CAM_RANGE = 7, CAM_HALF = 0.23;
export const DOG_SCENT = 2.2;

export const FLOOR_FACTOR = [1.0, 1.8, 2.2, 1.5, 3.0];
export const FLOOR_NAME = ['BETON', 'GITTER', 'KIES', 'PFÜTZE', 'GLAS'];

export interface Room { x: number; y: number; w: number; h: number; cx: number; cy: number }
export interface Seg { t0: number; t1: number; ax: number; ay: number; bx: number; by: number; ang: number; pause: boolean }
export interface GuardDef { segs: Seg[]; T: number; phase: number }
export interface CamDef { x: number; y: number; base: number; sweep: number; period: number; phase: number }
export interface SpotDef { ax: number; ay: number; bx: number; by: number; r: number; period: number; phase: number }
export interface Block {
  n: number; attempt: number;
  solid: Uint8Array; floor: Uint8Array; rooms: Room[];
  start: P; exitY: number; entryY: number;
  guards: GuardDef[]; cams: CamDef[]; spots: SpotDef[]; sleepers: P[]; dogs: P[];
  speedMul: number;
}

// Wachen, Kameras und Scheinwerfer sind reine Funktionen der Zeit,
// damit der Generator die Lösbarkeit vorab prüfen kann.
export function guardPose(g: GuardDef, tp: number): { x: number; y: number; ang: number } {
  const t = (((tp + g.phase) % g.T) + g.T) % g.T;
  let lo = 0, hi = g.segs.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (g.segs[m].t1 <= t) lo = m + 1; else hi = m; }
  const s = g.segs[lo];
  const k = (t - s.t0) / (s.t1 - s.t0);
  if (s.pause) return { x: s.ax, y: s.ay, ang: s.ang + Math.sin(k * Math.PI * 2) * 1.0 };
  return { x: s.ax + (s.bx - s.ax) * k, y: s.ay + (s.by - s.ay) * k, ang: s.ang };
}

export function camAng(c: CamDef, t: number): number {
  const u = (((t / c.period + c.phase) % 1) + 1) % 1;
  const p = u < 0.5 ? u * 2 : 2 - u * 2;
  const q = Math.min(1, Math.max(0, (p - 0.08) / 0.84));
  return c.base + (q * 2 - 1) * c.sweep;
}

export function spotPos(s: SpotDef, t: number): P {
  const u = 0.5 - 0.5 * Math.cos(Math.PI * 2 * (t / s.period + s.phase));
  return { x: s.ax + (s.bx - s.ax) * u, y: s.ay + (s.by - s.ay) * u };
}

function build(rng: Rng, n: number, scale: number, attempt: number): Block | null {
  const solid = new Uint8Array(W * H).fill(1);
  const floor = new Uint8Array(W * H);
  const rooms: Room[] = [];
  const target = rng.int(5, 7);
  for (let tries = 0; tries < 300 && rooms.length < target; tries++) {
    const w = rng.int(3, 6), h = rng.int(3, 5);
    const x = rng.int(2, W - 2 - w), y = rng.int(1, H - 1 - h);
    if (rooms.some((r) => !(x + w + 1 <= r.x || r.x + r.w + 1 <= x || y + h + 1 <= r.y || r.y + r.h + 1 <= y))) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  if (rooms.length < 3) return null;
  rooms.sort((a, b) => a.cx - b.cx);
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) solid[idx(x, y)] = 0;

  const wide = n <= 3;
  const open = (x: number, y: number) => { if (x >= 0 && y >= 1 && x < W && y < H - 1) solid[idx(x, y)] = 0; };
  const carveH = (x0: number, x1: number, y: number, w2: boolean) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { open(x, y); if (w2 && x > 0 && x < W - 1) open(x, y + 1); }
  };
  const carveV = (y0: number, y1: number, x: number, w2: boolean) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { open(x, y); if (w2 && x + 1 < W - 1) open(x + 1, y); }
  };
  const connect = (a: Room, b: Room) => {
    if (rng.chance(0.5)) { carveH(a.cx, b.cx, a.cy, wide); carveV(a.cy, b.cy, b.cx, wide); }
    else { carveV(a.cy, b.cy, a.cx, wide); carveH(a.cx, b.cx, b.cy, wide); }
  };
  for (let i = 0; i + 1 < rooms.length; i++) connect(rooms[i], rooms[i + 1]);
  for (let i = 0; i + 2 < rooms.length; i++) if (rng.chance(0.65)) connect(rooms[i], rooms[i + 2]);

  const first = rooms[0], last = rooms[rooms.length - 1];
  const entryY = first.cy, exitY = last.cy;
  if (n > 1) carveH(0, first.cx, entryY, false);
  carveH(last.cx, W - 1, exitY, false);
  const start: P = n === 1 ? { x: first.cx + 0.5, y: first.cy + 0.5 } : { x: 0.6, y: entryY + 0.5 };

  const speedMul = 1 + Math.min(n, 30) * 0.02;
  const cnt = (v: number) => Math.max(0, Math.round(v * scale));
  const others = rooms.slice(1);
  const used = new Set<number>();
  const b: Block = { n, attempt, solid, floor, rooms, start, exitY, entryY, guards: [], cams: [], spots: [], sleepers: [], dogs: [], speedMul };

  // Wachen
  for (let i = cnt(Math.min(1 + Math.floor(n / 3), 3)); i > 0; i--) {
    const pool = others.slice();
    const wps: Room[] = [];
    for (let k = Math.min(rng.int(2, 3), pool.length); k > 0; k--) wps.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    if (wps.length < 2) continue;
    const v = 1.5 * speedMul;
    const segs: Seg[] = [];
    let t = 0;
    const legs = wps.length === 2 ? 2 : wps.length;
    for (let l = 0; l < legs; l++) {
      const a = wps[l % wps.length], c = wps[(l + 1) % wps.length];
      const path = bfs(solid, a.cx, a.cy, c.cx, c.cy);
      if (!path || path.length < 2) continue;
      let ang = 0;
      for (let j = 1; j < path.length; j++) {
        const p0 = path[j - 1], p1 = path[j];
        ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        segs.push({ t0: t, t1: t + 1 / v, ax: p0.x + 0.5, ay: p0.y + 0.5, bx: p1.x + 0.5, by: p1.y + 0.5, ang, pause: false });
        t += 1 / v;
      }
      segs.push({ t0: t, t1: t + 1.6, ax: c.cx + 0.5, ay: c.cy + 0.5, bx: c.cx + 0.5, by: c.cy + 0.5, ang, pause: true });
      t += 1.6;
    }
    if (segs.length) b.guards.push({ segs, T: t, phase: rng.next() * t });
  }
  // Kameras: in einer Raumecke, schwenken um die Blickrichtung zur Raummitte
  for (let i = cnt(n >= 4 ? Math.min(1 + Math.floor((n - 4) / 3), 3) : 0); i > 0; i--) {
    const r = rng.pick(others);
    const tx = rng.chance(0.5) ? r.x : r.x + r.w - 1, ty = rng.chance(0.5) ? r.y : r.y + r.h - 1;
    if (used.has(idx(tx, ty))) continue;
    used.add(idx(tx, ty));
    const x = tx + 0.5, y = ty + 0.5;
    b.cams.push({ x, y, base: Math.atan2(r.y + r.h / 2 - y, r.x + r.w / 2 - x), sweep: 0.7, period: 6 / speedMul, phase: rng.next() });
  }
  // Scheinwerfer: Lichtkreis, der einen Raum der Länge nach abfährt
  for (let i = cnt(n >= 5 ? Math.min(1 + Math.floor((n - 5) / 4), 2) : 0); i > 0; i--) {
    const r = rng.pick(others);
    const hor = r.w >= r.h;
    b.spots.push(hor
      ? { ax: r.x + 0.7, ay: r.y + r.h / 2, bx: r.x + r.w - 0.7, by: r.y + r.h / 2, r: 1.0, period: 9 / speedMul, phase: rng.next() }
      : { ax: r.x + r.w / 2, ay: r.y + 0.7, bx: r.x + r.w / 2, by: r.y + r.h - 0.7, r: 1.0, period: 9 / speedMul, phase: rng.next() });
  }
  // Laute Böden
  for (let i = cnt(n >= 7 ? Math.min(2 + Math.floor((n - 7) / 2), 6) : 0); i > 0; i--) {
    let x = 0, y = 0, ok = false;
    for (let k = 0; k < 60 && !ok; k++) { x = rng.int(1, W - 2); y = rng.int(1, H - 2); ok = !solidAt(solid, x, y); }
    if (!ok) continue;
    const type = rng.int(1, 4);
    for (let k = rng.int(4, 9) * 2; k > 0; k--) {
      floor[idx(x, y)] = type;
      const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      if (!solidAt(solid, x + dx, y + dy) && x + dx > 0 && x + dx < W - 1) { x += dx; y += dy; }
    }
  }
  // Schlafende und Hunde
  const place = (list: P[]) => {
    for (let k = 0; k < 20; k++) {
      const r = rng.pick(others);
      const tx = rng.int(r.x, r.x + r.w - 1), ty = rng.int(r.y, r.y + r.h - 1);
      if ((tx === r.cx && ty === r.cy) || used.has(idx(tx, ty))) continue;
      used.add(idx(tx, ty));
      list.push({ x: tx + 0.5, y: ty + 0.5 });
      return;
    }
  };
  for (let i = cnt(n >= 10 ? Math.min(1 + Math.floor((n - 10) / 3), 3) : 0); i > 0; i--) place(b.sleepers);
  for (let i = cnt(n >= 10 ? Math.min(1 + Math.floor((n - 10) / 4), 2) : 0); i > 0; i--) place(b.dogs);
  return b;
}

/**
 * Prüft per Suche über (Kachel, Zeit), ob man in Gehtempo (2 Kacheln/s, Warten erlaubt)
 * vom Start zum Ausgang kommt, ohne je in ein Licht zu geraten oder einem Gegner zu nahe zu kommen.
 */
function solvable(b: Block): boolean {
  const DT = 0.5, K = 320, N = W * H, s = b.solid;
  const stat = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cx = x + 0.5, cy = y + 0.5;
    if (b.dogs.some((d) => Math.hypot(d.x - cx, d.y - cy) < 1.6) || b.sleepers.some((d) => Math.hypot(d.x - cx, d.y - cy) < 1.1)) stat[idx(x, y)] = 1;
  }
  const mark = (g: Uint8Array, ox: number, oy: number, ang: number, range: number, half: number, near: number) => {
    const R = Math.max(range, near);
    for (let y = Math.max(0, Math.floor(oy - R)); y <= Math.min(H - 1, Math.floor(oy + R)); y++)
      for (let x = Math.max(0, Math.floor(ox - R)); x <= Math.min(W - 1, Math.floor(ox + R)); x++) {
        const i = idx(x, y);
        if (s[i] || g[i]) continue;
        const dx = x + 0.5 - ox, dy = y + 0.5 - oy, d = Math.hypot(dx, dy);
        if (d < near || (d < range && Math.abs(angDiff(Math.atan2(dy, dx), ang)) < half && los(s, ox, oy, x + 0.5, y + 0.5))) g[i] = 1;
      }
  };
  const cache: Uint8Array[] = [];
  const danger = (k: number): Uint8Array => {
    let g = cache[k];
    if (g) return g;
    g = new Uint8Array(stat);
    const t = k * DT;
    for (const gd of b.guards) { const p = guardPose(gd, t); mark(g, p.x, p.y, p.ang, GUARD_RANGE + 0.3, GUARD_HALF + 0.12, 1.5); }
    for (const c of b.cams) mark(g, c.x, c.y, camAng(c, t), CAM_RANGE + 0.3, CAM_HALF + 0.08, 0);
    for (const sp of b.spots) { const p = spotPos(sp, t); mark(g, p.x, p.y, 0, 0, 0, sp.r + 0.45); }
    return (cache[k] = g);
  };
  const st = idx(Math.floor(b.start.x), Math.floor(b.start.y)), goal = idx(W - 1, b.exitY);
  if (danger(0)[st]) return false;
  const seen = new Uint8Array((K + 1) * N);
  const q = new Int32Array((K + 1) * N);
  let qh = 0, qt = 0;
  q[qt++] = st; seen[st] = 1;
  while (qh < qt) {
    const c = q[qh++], tile = c % N, k = (c / N) | 0;
    if (tile === goal) return true;
    if (k >= K) continue;
    const g0 = danger(k), g1 = danger(k + 1);
    const x = tile % W, y = (tile / W) | 0;
    for (const [nx, ny] of [[x, y], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (solidAt(s, nx, ny)) continue;
      const nt = idx(nx, ny);
      if (g0[nt] || g1[nt]) continue;
      const ns = (k + 1) * N + nt;
      if (seen[ns]) continue;
      seen[ns] = 1; q[qt++] = ns;
    }
  }
  return false;
}

/** Ein einzelner Erzeugungsversuch; null, wenn der Trakt nicht lösbar ist. */
export function tryBlock(seed: number, n: number, a: number): Block | null {
  // Nach einigen Fehlversuchen wird die Zahl der Gefahren schrittweise gesenkt.
  const scale = a < 16 ? 1 : Math.max(0, 1 - Math.ceil((a - 15) / 6) * 0.25);
  const b = build(new Rng(hashSeed(seed, n, a)), n, scale, a);
  return b && (scale === 0 || solvable(b)) ? b : null;
}

export function generateBlock(seed: number, n: number): Block {
  for (let a = 0; ; a++) { const b = tryBlock(seed, n, a); if (b) return b; }
}
