/**
 * Kreiselpumpe aus Kennlinienpunkten (Modul fluid, RH b, eng-core 0.13.0, Entscheidungen R12 bis R18, freigegeben 06.11.2026).
 *
 * Kennlinien H(V̇), η(V̇), NPSH_R(V̇) je als Ausgleichspolynom 2. Grades nach kleinsten Quadraten (exakt bei drei Punkten),
 * gerechnet nur im Bereich der Punkte (R12). Drehzahl nach den Modellgesetzen V̇ ~ n, H ~ n², P ~ n³, η gleich
 * (Dubbel 26 Bd. 3 S. 232; ISO 9906 Gl. (27) bis (30)), NPSH_R ~ n^x mit x = 2 (ISO 9906 Gl. (31), erste Näherung) (R16).
 * Betriebspunkt H(V̇) = H_A(V̇) (Dubbel Bd. 3 S. 231): Raster 200 Teilintervalle auf Vorzeichenwechsel, dann Bisektion mit
 * 100 Schritten (R14). Spezifische Drehzahl n_q = 333·n·√V̇/(g·H)^(3/4) mit n in s⁻¹ im Bestpunkt (Dubbel Bd. 3 Gl. (8.1);
 * Einheit s⁻¹ nach Dimensionsprüfung, freigegeben 06.11.2026). Sicherheitszuschlag NPSH s = 2,0 m (freigegeben, Dubbel S. 230
 * nennt ca. 1 bis 2 m). Einheiten SI: V̇ in m³/s, H in m, n in s⁻¹, P in W.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";

export const NPSH_MARGIN_DEFAULT = 2.0;
export const NPSH_EXP_DEFAULT = 2;
/** Gültigkeit der Modellgesetze: |n/n₀ − 1| ≤ 0,2 (Dubbel Bd. 3 S. 232). */
export const AFFINITY_LIMIT = 0.2;
export const OP_GRID = 200;
export const BISECT_STEPS = 100;

export interface PumpPoint { Q: number; H: number; eta: number | null; npsh: number | null }
export type PumpSpeed = { kind: "n"; n: number } | { kind: "Qsoll"; Q: number };
export interface PumpInput {
  label?: string;
  /** Kennlinienpunkte bei der Drehzahl n0 (Datenblatt). */
  points: PumpPoint[];
  /** Drehzahl der Kennlinie in s⁻¹. */
  n0: number;
  /** Betriebsdrehzahl oder Soll-Förderstrom (Drehzahl gesucht). */
  speed: PumpSpeed;
  /** Sicherheitszuschlag NPSH in m. */
  npshMargin: number;
  /** Exponent x der NPSH-Umrechnung. */
  npshExp: number;
  /** Dampfdruck in Pa von Hand, nur wenn das Fluid keinen Sättigungsdruck kennt (Fremdfluid). */
  pv: number | null;
}

export interface QuadFit { c: [number, number, number]; r2: number; maxDev: number; n: number }

/** Ausgleichspolynom y = c0 + c1·x + c2·x² nach kleinsten Quadraten (x skaliert auf |x|max, Gauß mit Spaltenpivot). */
export function fitQuadratic(xs: readonly number[], ys: readonly number[]): QuadFit {
  const n = xs.length, s = Math.max(...xs.map(Math.abs)) || 1;
  const u = xs.map((x) => x / s);
  const S = (k: number) => u.reduce((a, x) => a + x ** k, 0);
  const T = (k: number) => u.reduce((a, x, i) => a + x ** k * ys[i]!, 0);
  const M = [[S(0), S(1), S(2), T(0)], [S(1), S(2), S(3), T(1)], [S(2), S(3), S(4), T(2)]];
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r]![c]! / M[c]![c]!; for (let k = c; k < 4; k++) M[r]![k]! -= f * M[c]![k]!; }
  }
  const b = [M[0]![3]! / M[0]![0]!, M[1]![3]! / M[1]![1]!, M[2]![3]! / M[2]![2]!];
  const c: [number, number, number] = [b[0]!, b[1]! / s, b[2]! / (s * s)];
  const yhat = xs.map((x) => c[0] + c[1] * x + c[2] * x * x);
  const mean = ys.reduce((a, y) => a + y, 0) / n;
  const ssr = ys.reduce((a, y, i) => a + (y - yhat[i]!) ** 2, 0), sst = ys.reduce((a, y) => a + (y - mean) ** 2, 0);
  return { c, r2: sst > 0 ? 1 - ssr / sst : 1, maxDev: Math.max(...ys.map((y, i) => Math.abs(y - yhat[i]!))), n };
}
export const polyAt = (c: readonly [number, number, number], x: number): number => c[0] + c[1] * x + c[2] * x * x;

export interface PumpCurves {
  H: QuadFit; eta: QuadFit | null; npsh: QuadFit | null; Qmin: number; Qmax: number;
  steps: CalcStep[]; errors: string[]; warnings: string[];
}

const REF_D3 = "Dubbel 26 Bd. 3";
const coef = (f: QuadFit, u: string) => `${fmt(f.c[0], 6)} + ${fmt(f.c[1], 6)}·V̇ + ${fmt(f.c[2], 6)}·V̇² (${u}, V̇ in m³/s)`;

/** Kennlinien aus den Punkten mit Prüfung der Eingaben (R12). */
export function pumpCurves(p: PumpInput): PumpCurves {
  const errors: string[] = [], warnings: string[] = [], steps: CalcStep[] = [];
  const pts = [...p.points].sort((a, b) => a.Q - b.Q);
  const empty = { H: { c: [NaN, NaN, NaN] as [number, number, number], r2: NaN, maxDev: NaN, n: 0 }, eta: null, npsh: null, Qmin: NaN, Qmax: NaN, steps, errors, warnings };
  if (pts.length < 3) { errors.push("Pumpe: mindestens drei Kennlinienpunkte nötig."); return empty; }
  if (pts.some((x) => !(x.Q >= 0) || !(x.H > 0))) { errors.push("Pumpe: Förderstrom ≥ 0 und Förderhöhe > 0 in allen Punkten."); return empty; }
  if (new Set(pts.map((x) => x.Q)).size < 3) { errors.push("Pumpe: mindestens drei verschiedene Förderströme nötig."); return empty; }
  if (!(p.n0 > 0)) { errors.push("Pumpe: Drehzahl der Kennlinie muss größer als 0 sein."); return empty; }
  const etaPts = pts.filter((x) => x.eta !== null), npPts = pts.filter((x) => x.npsh !== null);
  if (etaPts.some((x) => !(x.eta! > 0 && x.eta! <= 1))) { errors.push("Pumpe: Wirkungsgrad zwischen 0 und 1 eingeben."); return empty; }
  if (npPts.some((x) => !(x.npsh! > 0))) { errors.push("Pumpe: NPSH_R größer als 0 eingeben."); return empty; }
  const Qmin = pts[0]!.Q, Qmax = pts[pts.length - 1]!.Q;
  const H = fitQuadratic(pts.map((x) => x.Q), pts.map((x) => x.H));
  steps.push(step("PU-FIT-H", "Förderhöhenkennlinie (Ausgleichspolynom)", "H(V̇) = a₀ + a₁·V̇ + a₂·V̇² (kleinste Quadrate)", `${pts.length} Punkte: H = ${coef(H, "H in m")}`, H.c[0], "m", "Verfahren (R12), Dubbel 26 Bd. 3 S. 230"));
  let eta: QuadFit | null = null, npsh: QuadFit | null = null;
  if (etaPts.length >= 3 && new Set(etaPts.map((x) => x.Q)).size >= 3) {
    eta = fitQuadratic(etaPts.map((x) => x.Q), etaPts.map((x) => x.eta!));
    steps.push(step("PU-FIT-ETA", "Wirkungsgradkennlinie (Ausgleichspolynom)", "η(V̇) = b₀ + b₁·V̇ + b₂·V̇²", `${etaPts.length} Punkte: η = ${coef(eta, "η in 1")}`, eta.c[0], "1", "Verfahren (R12)"));
  } else if (etaPts.length) warnings.push("Pumpe: weniger als drei Wirkungsgradpunkte, η-Kennlinie entfällt (keine Leistung, kein n_q).");
  if (npPts.length >= 3 && new Set(npPts.map((x) => x.Q)).size >= 3) {
    npsh = fitQuadratic(npPts.map((x) => x.Q), npPts.map((x) => x.npsh!));
    steps.push(step("PU-FIT-NPSH", "NPSH_R-Kennlinie (Ausgleichspolynom)", "NPSH_R(V̇) = c₀ + c₁·V̇ + c₂·V̇²", `${npPts.length} Punkte: NPSH_R = ${coef(npsh, "NPSH_R in m")}`, npsh.c[0], "m", "Verfahren (R12)"));
  } else if (npPts.length) warnings.push("Pumpe: weniger als drei NPSH_R-Punkte, NPSH-Nachweis entfällt.");
  const g = [H, eta, npsh].filter((x): x is QuadFit => x !== null);
  steps.push(step("PU-FIT-R2", "Güte des Ausgleichs", "R² = 1 − Σ(y − ŷ)²/Σ(y − ȳ)²; größte Abweichung max|y − ŷ|",
    `H: R² = ${fmt(H.r2, 6)}, max ${fmt(H.maxDev, 4)} m${eta ? `; η: R² = ${fmt(eta.r2, 6)}, max ${fmt(eta.maxDev, 4)}` : ""}${npsh ? `; NPSH_R: R² = ${fmt(npsh.r2, 6)}, max ${fmt(npsh.maxDev, 4)} m` : ""}`,
    Math.min(...g.map((x) => x.r2)), "1", "Verfahren (R12)"));
  if (H.r2 < 0.98) warnings.push(`Pumpe: Förderhöhe schlecht durch eine Parabel beschrieben (R² = ${fmt(H.r2, 4)}); Punkte prüfen.`);
  return { H, eta, npsh, Qmin, Qmax, steps, errors, warnings };
}

/** Förderhöhe bei Drehzahlverhältnis r (Modellgesetze auf die ganze Kennlinie): H_r(V̇) = r²·H₀(V̇/r). */
export const headAt = (pc: PumpCurves, r: number, Q: number): number => r * r * polyAt(pc.H.c, Q / r);
export const etaAt = (pc: PumpCurves, r: number, Q: number): number | null => (pc.eta ? polyAt(pc.eta.c, Q / r) : null);
export const npshAt = (pc: PumpCurves, r: number, Q: number, x: number): number | null => (pc.npsh ? r ** x * polyAt(pc.npsh.c, Q / r) : null);

export interface RootSearch { x: number; residual: number; roots: number; ok: boolean }

/**
 * Nullstelle von f im Intervall [lo, hi]: Raster mit `grid` Teilintervallen, erster Vorzeichenwechsel, Bisektion mit
 * `steps` Schritten. Nicht endliche Werte (Strang außerhalb der Gültigkeit) zählen als kein Wechsel.
 */
export function gridBisect(f: (x: number) => number, lo: number, hi: number, grid = OP_GRID, steps = BISECT_STEPS): RootSearch {
  const xs = Array.from({ length: grid + 1 }, (_, i) => lo + (hi - lo) * i / grid);
  const fs = xs.map(f);
  let first = -1, roots = 0;
  for (let i = 0; i < grid; i++) {
    const a = fs[i]!, b = fs[i + 1]!;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a === 0 || a * b < 0 || (i === grid - 1 && b === 0)) { roots++; if (first < 0) first = i; }
  }
  if (first < 0) return { x: NaN, residual: NaN, roots: 0, ok: false };
  let a = xs[first]!, b = xs[first + 1]!, fa = fs[first]!;
  if (fa === 0) return { x: a, residual: 0, roots, ok: true };
  for (let k = 0; k < steps; k++) { const m = (a + b) / 2, fm = f(m); if (fm === 0) { a = b = m; break; } if (fa * fm < 0) b = m; else { a = m; fa = fm; } }
  const x = (a + b) / 2;
  return { x, residual: f(x), roots, ok: true };
}

/** Bestpunkt aus der η-Kennlinie bei n₀: Scheitel der Parabel im Kennlinienbereich, sonst der Rand mit größerem η. */
export function bestPoint(pc: PumpCurves): { Q: number; H: number; eta: number } | null {
  if (!pc.eta) return null;
  const [, b1, b2] = pc.eta.c;
  const cands = [pc.Qmin, pc.Qmax];
  if (b2 < 0) { const q = -b1 / (2 * b2); if (q > pc.Qmin && q < pc.Qmax) cands.push(q); }
  const Q = cands.reduce((best, q) => (polyAt(pc.eta!.c, q) > polyAt(pc.eta!.c, best) ? q : best), cands[0]!);
  return Q > 0 ? { Q, H: polyAt(pc.H.c, Q), eta: polyAt(pc.eta.c, Q) } : null;
}

/** Spezifische Drehzahl n_q = 333·n·√V̇/(g·H)^(3/4), n in s⁻¹ (Dubbel Bd. 3 Gl. (8.1)). */
export function specificSpeed(n: number, Q: number, H: number, g: number): number { return 333 * n * Math.sqrt(Q) / Math.pow(g * H, 0.75); }

export const PUMP_REFS = { d3: REF_D3, iso9906: "ISO 9906 Abschn. 6.1.1" } as const;
