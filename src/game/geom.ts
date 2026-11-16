export const W = 24, H = 15;
export interface P { x: number; y: number }

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const idx = (x: number, y: number) => y * W + x;

export function solidAt(s: Uint8Array, x: number, y: number): boolean {
  return x < 0 || y < 0 || x >= W || y >= H || s[y * W + x] === 1;
}

export function angDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Strecke bis zur ersten Wand in Richtung ang, höchstens maxD (DDA über das Kachelraster). */
export function rayDist(s: Uint8Array, ox: number, oy: number, ang: number, maxD: number): number {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let mx = Math.floor(ox), my = Math.floor(oy);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx === 0 ? Infinity : Math.abs(1 / dx), tdy = dy === 0 ? Infinity : Math.abs(1 / dy);
  let tx = dx === 0 ? Infinity : (dx > 0 ? mx + 1 - ox : ox - mx) * tdx;
  let ty = dy === 0 ? Infinity : (dy > 0 ? my + 1 - oy : oy - my) * tdy;
  for (;;) {
    let d: number;
    if (tx < ty) { d = tx; tx += tdx; mx += sx; } else { d = ty; ty += tdy; my += sy; }
    if (d >= maxD) return maxD;
    if (solidAt(s, mx, my)) return d;
  }
}

export function los(s: Uint8Array, ax: number, ay: number, bx: number, by: number): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  if (d < 1e-6) return true;
  return rayDist(s, ax, ay, Math.atan2(by - ay, bx - ax), d) >= d - 1e-6;
}

/** Kürzester Kachelweg (4 Nachbarn), inklusive Start und Ziel. */
export function bfs(s: Uint8Array, ax: number, ay: number, bx: number, by: number): P[] | null {
  if (solidAt(s, ax, ay) || solidAt(s, bx, by)) return null;
  const prev = new Int32Array(W * H).fill(-2);
  const q = new Int32Array(W * H);
  let qh = 0, qt = 0;
  const a = idx(ax, ay), b = idx(bx, by);
  prev[a] = -1; q[qt++] = a;
  while (qh < qt) {
    const c = q[qh++];
    if (c === b) break;
    const cx = c % W, cy = (c / W) | 0;
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (solidAt(s, nx, ny)) continue;
      const n = idx(nx, ny);
      if (prev[n] !== -2) continue;
      prev[n] = c; q[qt++] = n;
    }
  }
  if (prev[b] === -2) return null;
  const out: P[] = [];
  for (let c = b; c !== -1; c = prev[c]) out.push({ x: c % W, y: (c / W) | 0 });
  return out.reverse();
}
