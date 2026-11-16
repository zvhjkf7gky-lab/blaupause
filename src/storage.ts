export interface Score { blocks: number; time: number }
interface Save { best: Score | null; daily: Record<string, Score>; vib: number; tutorial: boolean }

const KEY = 'blaupause.v1';
let data: Save = { best: null, daily: {}, vib: 1, tutorial: true };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) data = { ...data, ...JSON.parse(raw) };
} catch { /* ohne Speicher spielbar */ }

const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* egal */ } };
const better = (a: Score, b: Score | null | undefined) => !b || a.blocks > b.blocks || (a.blocks === b.blocks && a.time < b.time);

/** Tages-Seed aus dem Datum in UTC: JJJJMMTT */
export function todaySeed(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export const store = {
  get vib() { return data.vib; },
  set vib(v: number) { data.vib = v; persist(); },
  get tutorial() { return data.tutorial; },
  set tutorial(v: boolean) { data.tutorial = v; persist(); },
  best: () => data.best,
  dailyBest: () => data.daily[String(todaySeed())] ?? null,
  /** Speichert das Ergebnis; true, wenn es ein neuer Bestwert für diesen Modus ist. */
  submit(daily: boolean, seed: number, s: Score): boolean {
    let rec = false;
    if (daily) {
      const k = String(seed);
      if (better(s, data.daily[k])) { data.daily = { [k]: s }; rec = true; }
    } else if (better(s, data.best)) { data.best = s; rec = true; }
    persist();
    return rec;
  },
};
