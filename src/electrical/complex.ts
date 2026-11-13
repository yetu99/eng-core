/**
 * Komplexe Zahlen für das Modul elektrik (Wechselstromrechnung, komplexe LU-Zerlegung).
 * Reine Funktionen ohne Zustand; Gleichstrom rechnet mit im = 0 im selben Löser.
 */
export interface Complex { readonly re: number; readonly im: number }

export const C0: Complex = { re: 0, im: 0 };
export const C1: Complex = { re: 1, im: 0 };

export const cx = (re: number, im = 0): Complex => ({ re, im });
export const cadd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const csub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const cmul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cscale = (a: Complex, k: number): Complex => ({ re: a.re * k, im: a.im * k });
export const cneg = (a: Complex): Complex => ({ re: -a.re, im: -a.im });
export const cconj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
/** Betrag ohne Überlauf (Math.hypot). */
export const cabs = (a: Complex): number => Math.hypot(a.re, a.im);
/** Argument in rad, Wertebereich (−π, π]. */
export const carg = (a: Complex): number => Math.atan2(a.im, a.re);
export const cpolar = (r: number, phi: number): Complex => ({ re: r * Math.cos(phi), im: r * Math.sin(phi) });

/** Division nach Smith (numerisch stabil). Division durch 0 ergibt NaN. */
export function cdiv(a: Complex, b: Complex): Complex {
  if (b.re === 0 && b.im === 0) return { re: NaN, im: NaN };
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    const r = b.im / b.re, d = b.re + b.im * r;
    return { re: (a.re + a.im * r) / d, im: (a.im - a.re * r) / d };
  }
  const r = b.re / b.im, d = b.re * r + b.im;
  return { re: (a.re * r + a.im) / d, im: (a.im * r - a.re) / d };
}
export const cinv = (a: Complex): Complex => cdiv(C1, a);

/**
 * Löst A·x = b (komplex, dicht) mit LU-Zerlegung und Spaltenpivotisierung (größter Betrag).
 * Gibt null zurück, wenn ein Pivot kleiner als tol · max|A| ist (singulär). A und b werden nicht verändert.
 */
export function solveLinear(A: readonly (readonly Complex[])[], b: readonly Complex[], tol = 1e-12): Complex[] | null {
  const n = b.length;
  if (n === 0) return [];
  const M = A.map((row) => row.map((v) => ({ re: v.re, im: v.im })));
  const x = b.map((v) => ({ re: v.re, im: v.im }));
  let amax = 0;
  for (const row of M) for (const v of row) amax = Math.max(amax, cabs(v));
  if (amax === 0) return null;
  const lim = tol * amax;
  for (let k = 0; k < n; k++) {
    let p = k, pv = cabs(M[k]![k]!);
    for (let i = k + 1; i < n; i++) { const v = cabs(M[i]![k]!); if (v > pv) { pv = v; p = i; } }
    if (!(pv > lim)) return null;
    if (p !== k) { [M[k], M[p]] = [M[p]!, M[k]!]; [x[k], x[p]] = [x[p]!, x[k]!]; }
    const rk = M[k]!, piv = rk[k]!;
    for (let i = k + 1; i < n; i++) {
      const ri = M[i]!;
      if (ri[k]!.re === 0 && ri[k]!.im === 0) continue;
      const f = cdiv(ri[k]!, piv);
      for (let j = k; j < n; j++) ri[j] = csub(ri[j]!, cmul(f, rk[j]!));
      x[i] = csub(x[i]!, cmul(f, x[k]!));
    }
  }
  for (let k = n - 1; k >= 0; k--) {
    let s = x[k]!;
    const rk = M[k]!;
    for (let j = k + 1; j < n; j++) s = csub(s, cmul(rk[j]!, x[j]!));
    x[k] = cdiv(s, rk[k]!);
  }
  return x;
}
