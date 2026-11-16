import type { Game } from '../game/game';
import { LW, LH, LINE, LIGHT, text } from '../render/view';

const STEPS: [string, string][] = [
  ['LINKER STICK = RICHTUNG', 'R2 LEICHT DRÜCKEN = GEHEN'],
  ['DER GESTRICHELTE RING IST DEIN LÄRM', 'JE TIEFER R2, DESTO SCHNELLER UND LAUTER'],
  ['L2 HALTEN = LAUSCHEN', 'WELLEN ZEIGEN WACHEN HINTER WÄNDEN'],
  ['GELBES LICHT = DU WIRST GESEHEN.  VIBRATION = GEFAHR IST NAH', 'ERREICHT DER ALARM 100 %, IST DER LAUF VORBEI'],
  ['DER AUSGANG IST RECHTS:  AUS ▶', 'LEISE BLEIBEN, LICHT MEIDEN'],
];

/** Einführung im ersten Trakt: ein Hinweis nach dem anderen, weiter geht es durch Selbermachen. */
export class Tutorial {
  step = 0;
  done = false;
  private acc = 0;
  private lx: number; private ly: number;

  constructor(g: Game) { this.lx = g.px; this.ly = g.py; g.alarmScale = 0.5; }

  update(dt: number, g: Game) {
    if (this.done) return;
    if (g.blockN > 1) { this.done = true; g.alarmScale = 1; return; }
    switch (this.step) {
      case 0: this.acc += Math.hypot(g.px - this.lx, g.py - this.ly); if (this.acc >= 2) this.next(); break;
      case 1: if (g.tempo > 0.01) this.acc += dt; if (this.acc >= 3) this.next(); break;
      case 2: if (g.listen > 0) this.acc += dt; if (this.acc >= 1) this.next(); break;
      case 3: this.acc += dt; if (this.acc >= 6) this.next(); break;
    }
    this.lx = g.px; this.ly = g.py;
  }

  private next() { this.step++; this.acc = 0; }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.done) return;
    const w = 700, h = 62, x = (LW - w) / 2, y = LH - h - 14;
    ctx.fillStyle = '#062848'; ctx.globalAlpha = 0.94; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = LINE; ctx.fillRect(x, y, 92, 16);
    text(ctx, `HINWEIS ${this.step + 1}/${STEPS.length}`, x + 46, y + 9, 10, 'center', '#062848');
    const [a, b] = STEPS[this.step];
    text(ctx, a, LW / 2, y + 25, 16, 'center', LIGHT);
    text(ctx, b, LW / 2, y + 46, 14, 'center', LINE, false);
  }
}
