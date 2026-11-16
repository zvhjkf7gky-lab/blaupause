import { LW, LH, LINE, LIGHT, RED, text, gridBg } from '../render/view';

type Ctx = CanvasRenderingContext2D;

function frame(ctx: Ctx, title: string, sub?: string, dim = false) {
  if (dim) { ctx.fillStyle = '#04182f'; ctx.globalAlpha = 0.82; ctx.fillRect(0, 0, LW, LH); ctx.globalAlpha = 1; }
  else gridBg(ctx);
  ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.strokeRect(24, 24, LW - 48, LH - 48);
  ctx.lineWidth = 1; ctx.strokeRect(32, 32, LW - 64, LH - 64);
  text(ctx, title, LW / 2, 130, 56, 'center');
  if (sub) text(ctx, sub, LW / 2, 180, 15, 'center', LINE, false);
}

export function drawConnect(ctx: Ctx, t: number) {
  frame(ctx, 'BLAUPAUSE', 'AUSBRUCH NACH PLAN');
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3);
  text(ctx, 'CONTROLLER VERBINDEN UND EINE TASTE DRÜCKEN', LW / 2, 340, 22, 'center');
  ctx.globalAlpha = 1;
  text(ctx, 'PS5-CONTROLLER (DUALSENSE) ÜBER BLUETOOTH ODER USB', LW / 2, 384, 14, 'center', LINE, false);
}

export function drawPortrait(ctx: Ctx) {
  frame(ctx, 'BLAUPAUSE');
  text(ctx, 'BITTE GERÄT QUER HALTEN', LW / 2, 340, 24, 'center');
}

export interface Item { label: string; value?: string }

export function drawMenu(ctx: Ctx, title: string, sub: string | undefined, items: Item[], sel: number, footer: string[], dim = false) {
  frame(ctx, title, sub, dim);
  const y0 = 270, dy = 52;
  items.forEach((it, i) => {
    const y = y0 + i * dy, on = i === sel;
    if (on) {
      ctx.fillStyle = LINE; ctx.globalAlpha = 0.12; ctx.fillRect(LW / 2 - 260, y - 21, 520, 42); ctx.globalAlpha = 1;
      ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.strokeRect(LW / 2 - 260, y - 21, 520, 42);
      text(ctx, '▶', LW / 2 - 240, y + 1, 18, 'left');
    }
    text(ctx, it.label, LW / 2 - 208, y + 1, 22, 'left', LINE, on);
    if (it.value) text(ctx, it.value, LW / 2 + 240, y + 1, 18, 'right', LIGHT, false);
  });
  footer.forEach((f, i) => text(ctx, f, LW / 2, LH - 62 - (footer.length - 1 - i) * 22, 14, 'center', LINE, false));
}

export function drawEnd(ctx: Ctx, lines: [string, string][], record: boolean) {
  frame(ctx, 'ABRIEGELUNG', 'DER ALARM HAT 100 % ERREICHT', true);
  ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.strokeRect(24, 24, LW - 48, LH - 48);
  lines.forEach(([k, v], i) => {
    const y = 270 + i * 46;
    text(ctx, k, LW / 2 - 200, y, 22, 'left', LINE, false);
    text(ctx, v, LW / 2 + 200, y, 24, 'right');
    ctx.globalAlpha = 0.35; ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(LW / 2 - 200, y + 21); ctx.lineTo(LW / 2 + 200, y + 21); ctx.stroke(); ctx.globalAlpha = 1;
  });
  if (record) text(ctx, 'NEUER BESTWERT', LW / 2, 270 + lines.length * 46 + 10, 20, 'center', LIGHT);
  text(ctx, 'DREIECK = NOCHMAL     KREIS = HAUPTMENÜ', LW / 2, LH - 62, 16, 'center');
}
