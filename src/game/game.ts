import { W, P, clamp, solidAt, idx, los, bfs, angDiff } from './geom';
import {
  Block, GuardDef, generateBlock, tryBlock, guardPose, camAng, spotPos,
  GUARD_RANGE, GUARD_HALF, CAM_RANGE, CAM_HALF, DOG_SCENT, FLOOR_FACTOR,
} from '../gen/block';
import type { Input } from '../input/gamepad';

export const PLAYER_R = 0.3;
const MAX_SPEED = 5;      // Kacheln/s bei vollem Trigger
const NOISE = 7;          // Lärm-Radius in Kacheln bei vollem Tempo auf Beton
const WALL_DAMP = 0.6;    // Lärm hinter Wänden
export const LISTEN_MIN = 4, LISTEN_MAX = 14;

export interface Guard {
  def: GuardDef; tp: number; x: number; y: number; ang: number;
  mode: 'patrol' | 'go' | 'look' | 'back';
  path: P[]; pi: number; timer: number; goal: number;
  stepAcc: number; lastStep: number; noiseId: number; sees: boolean;
}
export interface Dog { x: number; y: number; scent: number; bark: number }
export interface Sleeper { x: number; y: number; awake: number }

const turn = (a: number, target: number, max: number) => {
  const d = angDiff(target, a);
  return a + clamp(d, -max, max);
};

/** Nähe zu einem Lichtkegel: 1 = drin, 0 = weiter als 2,5 Kacheln vom Rand. */
function coneProx(dist: number, ad: number, range: number, half: number, visible: boolean): number {
  if (!visible) return 0;
  if (dist < range && ad < half) return 1;
  const lateral = ad > half ? (ad - half > Math.PI / 2 ? dist : dist * Math.sin(ad - half)) : 0;
  const radial = Math.max(0, dist - range);
  return clamp(1 - Math.hypot(lateral, radial) / 2.5, 0, 0.95);
}

export class Game {
  blockN = 0;
  block!: Block;
  t = 0;            // Zeit im aktuellen Trakt
  runTime = 0;
  alarm = 0;
  /** Faktor auf die Alarm-Rate (die Einführung halbiert sie) */
  alarmScale = 1;
  quiet = 0;
  over = false;
  px = 0; py = 0; pang = 0;
  tempo = 0; noiseR = 0; floorType = 0; listen = 0;
  danger = 0; inLight = false; heard = false;
  bannerT = 0;
  guards: Guard[] = [];
  dogs: Dog[] = [];
  sleepers: Sleeper[] = [];
  lastNoise: P | null = null;
  noiseId = 0;
  /** Stärke des letzten gehörten Wachenschritts beim Lauschen (für die Haptik) */
  stepPulse = 0; stepPulseT = -9;
  private next: Block | null = null;
  private nextAttempt = 0;

  constructor(public seed: number, public daily: boolean) { this.enter(1); }

  private enter(n: number) {
    this.blockN = n;
    const b = (this.block = this.next && this.next.n === n ? this.next : generateBlock(this.seed, n));
    this.next = null; this.nextAttempt = 0;
    this.t = 0; this.bannerT = 2;
    this.px = b.start.x; this.py = b.start.y; this.pang = 0;
    this.lastNoise = null;
    this.guards = b.guards.map((def) => {
      const p = guardPose(def, 0);
      return { def, tp: 0, x: p.x, y: p.y, ang: p.ang, mode: 'patrol' as const, path: [], pi: 0, timer: 0, goal: -1, stepAcc: 0, lastStep: -9, noiseId: this.noiseId, sees: false };
    });
    this.dogs = b.dogs.map((d) => ({ ...d, scent: 0, bark: 0 }));
    this.sleepers = b.sleepers.map((d) => ({ ...d, awake: 0 }));
  }

  /** Bereitet den nächsten Trakt vor: ein Versuch pro Aufruf, damit kein Frame hängt. */
  pregen() {
    if (this.next || this.over) return;
    this.next = tryBlock(this.seed, this.blockN + 1, this.nextAttempt++);
  }

  get listenRange() { return this.listen > 0 ? LISTEN_MIN + (LISTEN_MAX - LISTEN_MIN) * this.listen : 0; }

  step(dt: number, inp: Input) {
    if (this.over) return;
    const b = this.block, s = b.solid;
    this.t += dt; this.runTime += dt; this.bannerT -= dt;

    // --- Spieler: Stick gibt nur die Richtung, R2 das Tempo. L2 hat Vorrang (Lauschen, stillstehen).
    this.listen = inp.l2;
    let tempo = 0;
    if (inp.l2 <= 0 && inp.mag > 0) {
      this.pang = Math.atan2(inp.ly, inp.lx);
      tempo = 0.5 * inp.r2 + 0.5 * inp.r2 * inp.r2;
    }
    const ox = this.px, oy = this.py;
    this.px += Math.cos(this.pang) * tempo * MAX_SPEED * dt;
    this.py += Math.sin(this.pang) * tempo * MAX_SPEED * dt;
    if (this.px > W - 0.7) { this.enter(this.blockN + 1); return; }
    for (let it = 0; it < 2; it++) {
      const tx = Math.floor(this.px), ty = Math.floor(this.py);
      for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
        if (!solidAt(s, x, y)) continue;
        const cx = clamp(this.px, x, x + 1), cy = clamp(this.py, y, y + 1);
        const dx = this.px - cx, dy = this.py - cy, d = Math.hypot(dx, dy);
        if (d >= PLAYER_R) continue;
        if (d > 1e-6) { this.px += (dx / d) * (PLAYER_R - d); this.py += (dy / d) * (PLAYER_R - d); }
        else { this.px = ox; this.py = oy; }
      }
    }
    const moved = Math.hypot(this.px - ox, this.py - oy) / dt;
    this.tempo = Math.min(tempo, moved / MAX_SPEED + 0.02);
    this.floorType = b.floor[idx(clamp(Math.floor(this.px), 0, W - 1), Math.floor(this.py))] || 0;
    const noiseR = (this.noiseR = this.tempo > 0.01 ? this.tempo * NOISE * FLOOR_FACTOR[this.floorType] : 0);

    // --- Gefahren
    let rate = 0, danger = 0, inLight = false, heard = false;
    const px = this.px, py = this.py;
    const hears = (x: number, y: number, sens: number): number => {
      if (noiseR <= 0) return 0;
      const d = Math.hypot(px - x, py - y);
      const r = noiseR * sens * (los(s, x, y, px, py) ? 1 : WALL_DAMP);
      danger = Math.max(danger, clamp((r / Math.max(d, 0.01) - 0.5) / 0.5));
      return r > d ? 1 : 0;
    };

    for (const g of this.guards) {
      const d = Math.hypot(px - g.x, py - g.y);
      const toP = Math.atan2(py - g.y, px - g.x);
      const ad = Math.abs(angDiff(toP, g.ang));
      const vis = d < GUARD_RANGE + 2.5 && los(s, g.x, g.y, px, py);
      const prox = coneProx(d, ad, GUARD_RANGE, GUARD_HALF, vis);
      danger = Math.max(danger, prox);
      g.sees = prox >= 1;
      const gx = g.x, gy = g.y;
      if (g.sees) {
        inLight = true;
        rate += 0.2 + 0.25 * (1 - d / GUARD_RANGE);
        g.ang = turn(g.ang, toP, 2 * dt);
      } else if (g.mode === 'patrol') {
        g.tp += dt;
        const p = guardPose(g.def, g.tp);
        g.x = p.x; g.y = p.y; g.ang = turn(g.ang, p.ang, 5 * dt);
      } else if (g.mode === 'look') {
        g.timer -= dt;
        g.ang += Math.cos(g.timer * 2.5) * 1.6 * dt;
        if (g.timer <= 0) {
          const p = guardPose(g.def, g.tp);
          const path = bfs(s, Math.floor(g.x), Math.floor(g.y), Math.floor(p.x), Math.floor(p.y));
          g.path = path ?? []; g.pi = 1; g.mode = 'back';
        }
      } else {
        const sp = (g.mode === 'go' ? 2.4 : 1.8) * b.speedMul;
        if (g.pi >= g.path.length) {
          if (g.mode === 'go') { g.mode = 'look'; g.timer = 2.5; }
          else {
            // zurück auf die Runde: das letzte Stück bis zum exakten Routenpunkt
            const p = guardPose(g.def, g.tp);
            const dd = Math.hypot(p.x - g.x, p.y - g.y);
            if (dd < sp * dt) { g.x = p.x; g.y = p.y; g.mode = 'patrol'; }
            else { g.x += ((p.x - g.x) / dd) * sp * dt; g.y += ((p.y - g.y) / dd) * sp * dt; }
          }
        } else {
          const tgt = g.path[g.pi], tx = tgt.x + 0.5, ty = tgt.y + 0.5;
          const dd = Math.hypot(tx - g.x, ty - g.y);
          if (dd <= sp * dt) { g.x = tx; g.y = ty; g.pi++; }
          else {
            g.x += ((tx - g.x) / dd) * sp * dt; g.y += ((ty - g.y) / dd) * sp * dt;
            g.ang = turn(g.ang, Math.atan2(ty - g.y, tx - g.x), 6 * dt);
          }
        }
      }
      g.stepAcc += Math.hypot(g.x - gx, g.y - gy);
      if (g.stepAcc > 0.9) {
        g.stepAcc = 0; g.lastStep = this.runTime;
        if (this.listen > 0 && d < this.listenRange) {
          const v = 0.25 + 0.75 * (1 - d / this.listenRange);
          if (this.runTime - this.stepPulseT > 0.08 || v > this.stepPulse) { this.stepPulse = v; this.stepPulseT = this.runTime; }
        }
      }
      if (hears(g.x, g.y, 1)) { heard = true; rate += 0.12; this.investigate(g, px, py); }
    }
    for (const c of b.cams) {
      const d = Math.hypot(px - c.x, py - c.y);
      const ad = Math.abs(angDiff(Math.atan2(py - c.y, px - c.x), camAng(c, this.t)));
      const prox = coneProx(d, ad, CAM_RANGE, CAM_HALF, d < CAM_RANGE + 2.5 && los(s, c.x, c.y, px, py));
      danger = Math.max(danger, prox);
      if (prox >= 1) { inLight = true; rate += 0.3; }
    }
    for (const sp of b.spots) {
      const p = spotPos(sp, this.t), d = Math.hypot(px - p.x, py - p.y);
      if (d < sp.r) { inLight = true; rate += 0.35; danger = 1; }
      else danger = Math.max(danger, clamp(1 - (d - sp.r) / 2.5, 0, 0.95));
    }
    for (const sl of this.sleepers) {
      if (hears(sl.x, sl.y, 1.3)) { heard = true; sl.awake = 3; }
      if (sl.awake > 0) { sl.awake -= dt; rate += 0.25; }
    }
    for (const dg of this.dogs) {
      if (hears(dg.x, dg.y, 1.6)) { heard = true; dg.bark = 3; }
      if (Math.hypot(px - dg.x, py - dg.y) < DOG_SCENT) dg.scent = Math.min(4, dg.scent + dt);
      else dg.scent = Math.max(0, dg.scent - dt * 2);
      danger = Math.max(danger, dg.scent / 4);
      if (dg.scent >= 4) dg.bark = Math.max(dg.bark, 0.5);
      if (dg.bark > 0) { dg.bark -= dt; rate += 0.2; }
    }

    if (heard) {
      if (!this.heard) this.noiseId++;
      this.lastNoise = { x: px, y: py };
    }
    this.heard = heard;
    // Ab 50 % Alarm gehen alle Wachen zur letzten Geräuschquelle.
    if (this.alarm >= 0.5 && this.lastNoise)
      for (const g of this.guards)
        if (g.mode === 'patrol' && g.noiseId !== this.noiseId) { g.noiseId = this.noiseId; this.investigate(g, this.lastNoise.x, this.lastNoise.y); }

    this.danger = danger; this.inLight = inLight;
    if (rate > 0) { this.alarm += rate * this.alarmScale * dt; this.quiet = 0; }
    else { this.quiet += dt; if (this.quiet > 2) this.alarm = Math.max(0, this.alarm - 0.04 * dt); }
    if (this.alarm >= 1) { this.alarm = 1; this.over = true; }
  }

  private investigate(g: Guard, x: number, y: number) {
    const tx = Math.floor(x), ty = Math.floor(y), goal = idx(tx, ty);
    g.noiseId = this.noiseId;
    if (g.mode === 'go' && g.goal === goal) return;
    const path = bfs(this.block.solid, Math.floor(g.x), Math.floor(g.y), tx, ty);
    if (!path) return;
    g.path = path; g.pi = 1; g.goal = goal; g.mode = 'go';
  }
}
