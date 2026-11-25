/**
 * Lineare Algebra für das Modul stabwerke (ab 0.23.0): LU-Zerlegung mit Spaltenpivot (Zeilentausch nach dem betragsgrößten
 * Element der Spalte), Lösen von M·x = b und Mᵀ·x = b mit derselben Zerlegung, Rang und unabhängige Spalten über
 * Zeilenstufenform. Feste relative Schranke TRUSS_TOL bezogen auf den betragsgrößten Eintrag; deterministisch, keine Iteration.
 */

export type Matrix = number[][];

/** Relative Schranke für Pivot und Rang (Einträge der Gleichgewichtsmatrix sind Richtungskosinus, Betrag ≤ 1). */
export const TRUSS_TOL = 1e-10;

export interface LuFactor {
  n: number;
  /** L (unter der Diagonale, Diagonale 1) und U (ab der Diagonale) in einer Matrix */
  lu: Matrix;
  /** Zeile k von P·M ist Zeile piv[k] von M */
  piv: number[];
}

function maxAbs(M: Matrix): number {
  let m = 0;
  for (const r of M) for (const v of r) m = Math.max(m, Math.abs(v));
  return m;
}

/** LU-Zerlegung P·M = L·U einer quadratischen Matrix; null, wenn singulär (Pivot ≤ TRUSS_TOL·max|M|). */
export function luFactor(M: Matrix): LuFactor | null {
  const n = M.length;
  if (n === 0 || M.some((r) => r.length !== n)) return null;
  const lu = M.map((r) => [...r]);
  const piv = Array.from({ length: n }, (_, i) => i);
  const tol = TRUSS_TOL * Math.max(maxAbs(M), 1e-300);
  for (let k = 0; k < n; k++) {
    let p = k, best = Math.abs(lu[k]![k]!);
    for (let i = k + 1; i < n; i++) { const v = Math.abs(lu[i]![k]!); if (v > best) { best = v; p = i; } }
    if (!(best > tol)) return null;
    if (p !== k) { [lu[k], lu[p]] = [lu[p]!, lu[k]!]; [piv[k], piv[p]] = [piv[p]!, piv[k]!]; }
    const rk = lu[k]!, d = rk[k]!;
    for (let i = k + 1; i < n; i++) {
      const ri = lu[i]!, f = ri[k]! / d;
      ri[k] = f;
      if (f !== 0) for (let j = k + 1; j < n; j++) ri[j] = ri[j]! - f * rk[j]!;
    }
  }
  return { n, lu, piv };
}

/** Löst M·x = b mit der Zerlegung. */
export function luSolve(F: LuFactor, b: readonly number[]): number[] {
  const { n, lu, piv } = F;
  const y = piv.map((p) => b[p]!);
  for (let i = 0; i < n; i++) { let s = y[i]!; const r = lu[i]!; for (let j = 0; j < i; j++) s -= r[j]! * y[j]!; y[i] = s; }
  for (let i = n - 1; i >= 0; i--) { let s = y[i]!; const r = lu[i]!; for (let j = i + 1; j < n; j++) s -= r[j]! * y[j]!; y[i] = s / r[i]!; }
  return y;
}

/** Löst Mᵀ·x = b mit derselben Zerlegung: Uᵀ·z = b, Lᵀ·w = z, x = Pᵀ·w. */
export function luSolveT(F: LuFactor, b: readonly number[]): number[] {
  const { n, lu, piv } = F;
  const z = [...b];
  for (let i = 0; i < n; i++) { let s = z[i]!; for (let j = 0; j < i; j++) s -= lu[j]![i]! * z[j]!; z[i] = s / lu[i]![i]!; }
  for (let i = n - 1; i >= 0; i--) { let s = z[i]!; for (let j = i + 1; j < n; j++) s -= lu[j]![i]! * z[j]!; z[i] = s; }
  const x = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) x[piv[i]!] = z[i]!;
  return x;
}

/**
 * Zeilenstufenform mit Spaltenpivot, Spalten in gegebener Reihenfolge: Pivotspalten sind die linear unabhängigen Spalten
 * (jede Spalte, die nicht aus den vorherigen kombinierbar ist). Rang = Anzahl der Pivotspalten.
 */
export function pivotColumns(M: Matrix, nCols: number): number[] {
  const m = M.length;
  const R = M.map((r) => [...r]);
  const tol = TRUSS_TOL * Math.max(maxAbs(M), 1e-300);
  const cols: number[] = [];
  let row = 0;
  for (let c = 0; c < nCols && row < m; c++) {
    let p = row, best = Math.abs(R[row]![c]!);
    for (let i = row + 1; i < m; i++) { const v = Math.abs(R[i]![c]!); if (v > best) { best = v; p = i; } }
    if (!(best > tol)) continue;
    if (p !== row) [R[row], R[p]] = [R[p]!, R[row]!];
    const rr = R[row]!, d = rr[c]!;
    for (let i = row + 1; i < m; i++) {
      const ri = R[i]!, f = ri[c]! / d;
      if (f !== 0) for (let j = c; j < nCols; j++) ri[j] = ri[j]! - f * rr[j]!;
    }
    cols.push(c); row++;
  }
  return cols;
}

/** Verhältnis kleinster zu größter Pivot |u_kk| der Zerlegung (Anzeichen schlechter Kondition, 1 = ideal). */
export function pivotRatio(F: LuFactor): number {
  let lo = Infinity, hi = 0;
  for (let k = 0; k < F.n; k++) { const v = Math.abs(F.lu[k]![k]!); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return hi > 0 ? lo / hi : 0;
}

/** Löst ein kleines quadratisches System (bis 3 × 3 im Kraftgrößenverfahren); null, wenn singulär. */
export function solveSmall(M: Matrix, b: readonly number[]): number[] | null {
  const F = luFactor(M);
  return F ? luSolve(F, b) : null;
}
