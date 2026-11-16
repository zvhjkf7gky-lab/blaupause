// Zwei-Motoren-Vibration. Der Effekt wird alle 100 ms mit 150 ms Dauer neu gesetzt,
// damit die Stärke fließend wirkt und beim Pausieren sofort endet.
let last = 0, active = false;

type Actuator = { playEffect?: (type: string, params: object) => Promise<unknown>; reset?: () => Promise<unknown> };
const actuator = (pad: Gamepad | null): Actuator | null => {
  const a = (pad as unknown as { vibrationActuator?: Actuator } | null)?.vibrationActuator;
  return a && typeof a.playEffect === 'function' ? a : null;
};

export const hasHaptics = (pad: Gamepad | null) => !!actuator(pad);

export function rumble(pad: Gamepad | null, weak: number, strong: number, now: number, force = false) {
  if (!force && now - last < 100) return;
  last = now;
  const a = actuator(pad);
  if (!a) return;
  if (weak < 0.01 && strong < 0.01) {
    if (active) { active = false; try { a.reset?.()?.catch(() => {}); } catch { /* egal */ } }
    return;
  }
  active = true;
  try {
    a.playEffect!('dual-rumble', { startDelay: 0, duration: 150, weakMagnitude: Math.min(1, weak), strongMagnitude: Math.min(1, strong) })?.catch(() => {});
  } catch { /* egal */ }
}
