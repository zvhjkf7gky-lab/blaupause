export const B = { CROSS: 0, CIRCLE: 1, SQUARE: 2, TRIANGLE: 3, L2: 6, R2: 7, OPTIONS: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export interface Input {
  connected: boolean;
  pad: Gamepad | null;
  /** Linker Stick nach radialer Deadzone, Betrag 0..1 */
  lx: number; ly: number; mag: number;
  /** Trigger nach Deadzone, 0..1 */
  r2: number; l2: number;
  down: boolean[];
  pressed: boolean[];
  /** Menü-Navigation, nur im Moment des Auslösens ungleich 0 */
  navX: number; navY: number;
}

const DZ_IN = 0.12, DZ_OUT = 0.95, DZ_TRIG = 0.03;
let prevDown: boolean[] = [];
let prevNavX = 0, prevNavY = 0;

function findPad(): Gamepad | null {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let best: Gamepad | null = null;
  for (const p of pads) {
    if (!p || !p.connected) continue;
    if (!best || (p.mapping === 'standard' && best.mapping !== 'standard')) best = p;
  }
  return best;
}

const trig = (b: GamepadButton | undefined) => {
  if (!b) return 0;
  const v = b.value || (b.pressed ? 1 : 0);
  return v <= DZ_TRIG ? 0 : Math.min(1, (v - DZ_TRIG) / (1 - DZ_TRIG));
};

/** Einmal pro Frame aufrufen. */
export function readInput(): Input {
  const pad = findPad();
  const down: boolean[] = [], pressed: boolean[] = [];
  let lx = 0, ly = 0, mag = 0, r2 = 0, l2 = 0, navX = 0, navY = 0;
  if (pad) {
    for (let i = 0; i < pad.buttons.length; i++) {
      down[i] = pad.buttons[i].pressed;
      pressed[i] = down[i] && !prevDown[i];
    }
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0, m = Math.hypot(ax, ay);
    if (m > DZ_IN) {
      mag = Math.min(1, (m - DZ_IN) / (DZ_OUT - DZ_IN));
      lx = (ax / m) * mag; ly = (ay / m) * mag;
    }
    r2 = trig(pad.buttons[B.R2]); l2 = trig(pad.buttons[B.L2]);
    const nx = down[B.RIGHT] || ax > 0.6 ? 1 : down[B.LEFT] || ax < -0.6 ? -1 : 0;
    const ny = down[B.DOWN] || ay > 0.6 ? 1 : down[B.UP] || ay < -0.6 ? -1 : 0;
    if (nx !== prevNavX) navX = nx;
    if (ny !== prevNavY) navY = ny;
    prevNavX = nx; prevNavY = ny;
  } else { prevNavX = prevNavY = 0; }
  prevDown = down;
  return { connected: !!pad, pad, lx, ly, mag, r2, l2, down, pressed, navX, navY };
}
