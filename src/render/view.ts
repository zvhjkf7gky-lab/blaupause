export const LW = 960, LH = 640;   // logische Fläche 3:2
export const T = 40, OY = 40;      // Kachelgröße, Höhe der Anzeigenleiste
export const BG = '#0B3A6B', LINE = '#DCEBFF', LIGHT = '#FFE9A8', RED = '#FF4D3D';
export const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace';

/** Passt den Canvas an Fenster und Pixeldichte an und setzt die Transformation auf die logische Fläche. */
export function fit(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight;
  const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, cw, ch);
  const s = Math.min(w / LW, h / LH);
  ctx.setTransform(dpr * s, 0, 0, dpr * s, (dpr * (w - LW * s)) / 2, (dpr * (h - LH * s)) / 2);
}

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, align: CanvasTextAlign = 'left', color = LINE, bold = true) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

export function gridBg(ctx: CanvasRenderingContext2D, y0 = 0) {
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.globalAlpha = 0.09;
  ctx.beginPath();
  for (let x = 0; x <= LW; x += T) { ctx.moveTo(x, y0); ctx.lineTo(x, LH); }
  for (let y = y0; y <= LH; y += T) { ctx.moveTo(0, y); ctx.lineTo(LW, y); }
  ctx.stroke();
  ctx.globalAlpha = 0.13;
  ctx.beginPath();
  for (let x = 0; x <= LW; x += T * 4) { ctx.moveTo(x, y0); ctx.lineTo(x, LH); }
  for (let y = y0; y <= LH; y += T * 4) { ctx.moveTo(0, y); ctx.lineTo(LW, y); }
  ctx.stroke();
  ctx.globalAlpha = 1;
}
