/**
 * Normtabellen des Moduls elektrik (Entscheidung EL-E3: Konstanten im Kern, nicht in Supabase).
 * E-Reihen nach IEC 60063:2015, Farbcode nach IEC 60062:2016. Werte abgetippt, gegengeprüft in verification/elektrik.py.
 */
export const E_SOURCE = "IEC 60063:2015 (Vorzugsreihen E6 bis E96)";
export const COLOUR_SOURCE = "IEC 60062:2016 Tab. 1 (Farbcode)";

const E96 = [1.0, 1.02, 1.05, 1.07, 1.1, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.3, 1.33, 1.37, 1.4, 1.43, 1.47, 1.5, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74,
  1.78, 1.82, 1.87, 1.91, 1.96, 2.0, 2.05, 2.1, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.8, 2.87, 2.94, 3.01, 3.09,
  3.16, 3.24, 3.32, 3.4, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49,
  5.62, 5.76, 5.9, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98, 7.15, 7.32, 7.5, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76] as const;

export type ESeries = 6 | 12 | 24 | 48 | 96;
export const E_SERIES: Readonly<Record<ESeries, readonly number[]>> = {
  6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
  12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
  48: E96.filter((_, i) => i % 2 === 0),
  96: E96,
};
export const isESeries = (n: number): n is ESeries => n === 6 || n === 12 || n === 24 || n === 48 || n === 96;

export type Colour = "schwarz" | "braun" | "rot" | "orange" | "gelb" | "gruen" | "blau" | "violett" | "grau" | "weiss" | "gold" | "silber";
export const COLOURS: readonly Colour[] = ["schwarz", "braun", "rot", "orange", "gelb", "gruen", "blau", "violett", "grau", "weiss", "gold", "silber"];

/** Ziffer, Multiplikator (Zehnerexponent) und Toleranz in % je Farbe; null = für diese Stelle nicht definiert. */
export const COLOUR_CODE: Readonly<Record<Colour, { digit: number | null; exp: number; tol: number | null }>> = {
  schwarz: { digit: 0, exp: 0, tol: null },
  braun: { digit: 1, exp: 1, tol: 1 },
  rot: { digit: 2, exp: 2, tol: 2 },
  orange: { digit: 3, exp: 3, tol: 0.05 },
  gelb: { digit: 4, exp: 4, tol: 0.02 },
  gruen: { digit: 5, exp: 5, tol: 0.5 },
  blau: { digit: 6, exp: 6, tol: 0.25 },
  violett: { digit: 7, exp: 7, tol: 0.1 },
  grau: { digit: 8, exp: 8, tol: 0.01 },
  weiss: { digit: 9, exp: 9, tol: null },
  gold: { digit: null, exp: -1, tol: 5 },
  silber: { digit: null, exp: -2, tol: 10 },
};

/** Zahl auf 12 signifikante Stellen (entfernt Gleitkommareste wie 4700,000000001). */
export const clean = (x: number): number => (Number.isFinite(x) && x !== 0 ? Number(x.toPrecision(12)) : x);
/** m · 10^e exakt gerundet. */
export const scaled = (m: number, e: number): number => clean(e >= 0 ? m * 10 ** e : m / 10 ** -e);

export interface ESeriesPick { nearest: number; lower: number; upper: number; dev: number }

/**
 * Normwerte der Reihe zu einem positiven Wert: nächster Wert nach logarithmischem Abstand (Gleichstand: höherer Wert),
 * nächstniedrigerer (≤ x) und nächsthöherer (≥ x) Normwert, relative Abweichung dev = (nearest − x)/x.
 */
export function eSeriesPick(x: number, n: ESeries): ESeriesPick | null {
  if (!(x > 0) || !Number.isFinite(x)) return null;
  const base = E_SERIES[n];
  const e = Math.floor(Math.log10(x));
  const cand: number[] = [];
  for (const k of [e - 1, e, e + 1]) for (const m of base) cand.push(scaled(m, k));
  cand.sort((a, b) => a - b);
  const xc = clean(x);
  let lower = cand[0]!, upper = cand[cand.length - 1]!;
  for (const c of cand) { if (c <= xc) lower = c; }
  for (let i = cand.length - 1; i >= 0; i--) { if (cand[i]! >= xc) upper = cand[i]!; }
  const dl = Math.log(xc / lower), du = Math.log(upper / xc);
  const nearest = du <= dl ? upper : lower;
  return { nearest, lower, upper, dev: (nearest - x) / x };
}

/** Farbringe zu einem Wert (Umkehrung zu EL-R1): 2 bzw. 3 Ziffern und Multiplikator; null, wenn mit so vielen Ziffern nicht exakt darstellbar. */
export function colourBands(r: number, rings: 4 | 5): Colour[] | null {
  if (!(r > 0) || !Number.isFinite(r)) return null;
  const nd = rings === 4 ? 2 : 3;
  let e = Math.floor(Math.log10(clean(r))) - (nd - 1);
  let mant = Math.round(clean(r / 10 ** e));
  if (mant >= 10 ** nd) { mant = Math.round(mant / 10); e += 1; }
  if (Math.abs(scaled(mant, e) - r) > 1e-9 * r) return null;
  const mult = COLOURS.find((c) => COLOUR_CODE[c].exp === e);
  if (!mult) return null;
  return [...String(mant).padStart(nd, "0").split("").map((d) => COLOURS[Number(d)]!), mult];
}
