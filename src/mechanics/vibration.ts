/**
 * Eigenfrequenz (Blatt 1, Belastungsart FQ): Biegeeigenfrequenzen f₁ bis f₃ des geraden Balkens.
 * Konzept V2-A Abschnitt 5 bis 7 (freigegeben 12.10.2026, P5 bis P8). Umsetzung eng-core 0.6.1.
 *
 * Modell: Euler-Bernoulli, konstantes E·I und konstante Massenbelegung m′ = ρ·A + m_z über die ganze Länge,
 * kleine Schwingungen, starre Lager, keine Axialkraft, keine Dämpfung (Konzept V2-A Abschnitt 6, N7 bis N10).
 * Bewegungsgleichung E·I·w′′′′ + m′·ẅ = 0, Ansatz w(x, t) = φ(x)·cos(ωt), β⁴ = m′·ω²/(E·I).
 * Lagerungen wie Lastliste (Konzept Lastliste Abschnitt 4): KR, GG, EG, EE. x ab dem linken Ende.
 *
 * Einheitensystem N, mm, t, s (Konzept V2-A P7): ρ[t/mm³] = ρ[kg/m³]·10⁻¹², m_z[t/mm] = m_z[kg/m]·10⁻⁶,
 * E·I in N·mm² = t·mm³/s², damit ω in 1/s und f in Hz.
 * Vorzeichen (Konzept Lastliste Abschnitt 3): w nach unten positiv. Die Eigenform ist auf max |φ| = 1 normiert,
 * ihre erste Halbwelle von links ist positiv (nach unten), das Vorzeichen einer Eigenform ist sonst beliebig.
 *
 * Wurzeln der Frequenzgleichungen deterministisch: Einklammerung aus den Vorzeichen an den Stellen k·π,
 * Bisektion mit fester Schrittzahl (80), kein Startwert. Knoten und Ort des größten Ausschlags ebenso
 * (festes Raster, Vorzeichenwechsel, Bisektion).
 * Quellen: Gross/Hauger/Schröder/Wall, Technische Mechanik 4, Kap. 4; Blevins, Formulas for Natural Frequency
 * and Mode Shape, Tab. 8.1; Rayleigh, Theory of Sound (1877).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { LOADLIST_SUPPORTS, solveBeam, type LoadListSupport, type LoadSI, type BeamSolution } from "./loadlist";

export type VibrationSupport = LoadListSupport;

export interface VibrationCase { label: string; short: string }
/** Lastfälle der Belastungsart FQ sind die Lagerungen der Lastliste. */
export const VIBRATION_CASES = {
  KR: { label: LOADLIST_SUPPORTS.KR.label, short: LOADLIST_SUPPORTS.KR.short },
  GG: { label: LOADLIST_SUPPORTS.GG.label, short: LOADLIST_SUPPORTS.GG.short },
  EG: { label: LOADLIST_SUPPORTS.EG.label, short: LOADLIST_SUPPORTS.EG.short },
  EE: { label: LOADLIST_SUPPORTS.EE.label, short: LOADLIST_SUPPORTS.EE.short },
} as const satisfies Record<VibrationSupport, VibrationCase>;
export type VibrationCaseId = keyof typeof VIBRATION_CASES;
export function isVibrationCase(id: string): id is VibrationCaseId { return id in VIBRATION_CASES; }

/** Eingabe im Blatt 1 (StrengthInput.vibration), Lagerung aus dem Lastfall. */
export interface VibrationLoad {
  /** Zusatzmasse als Streckenmasse über die ganze Länge in kg/m (≥ 0, Standard 0) */
  mz: number;
  /** Mindestfrequenz in Hz (Nachweis f₁ ≥ f_min), null = kein Nachweis */
  fmin: number | null;
  /** Erregerfrequenz in Hz (Resonanzabstand), null = kein Nachweis */
  ferr: number | null;
  /** geforderter Resonanzabstand Δ_min in % (Standard 20) */
  dmin: number;
}

export const VIB_MODES = 3;
export const VIB_ROOT_STEPS = 80;
/** Rasterteilung für Knoten und größten Ausschlag (Vorzeichenwechsel, danach Bisektion) */
export const VIB_SHAPE_GRID = 400;
export const VIB_SLENDER_MIN = 10;
export const VIB_RAYLEIGH_MAX = 1.02;
/** g in mm/s² (9,81 m/s² wie G_ACC) */
export const G_MMS2 = 9810;

const PI = Math.PI;

/** Randbedingungen der freien Schwingung je Lagerung (Text für den Rechenweg). */
export const VIB_BC: Readonly<Record<VibrationSupport, string>> = {
  KR: "φ(0) = 0, φ′(0) = 0, φ″(L) = 0, φ‴(L) = 0",
  GG: "φ(0) = 0, φ″(0) = 0, φ(L) = 0, φ″(L) = 0",
  EG: "φ(0) = 0, φ′(0) = 0, φ(L) = 0, φ″(L) = 0",
  EE: "φ(0) = 0, φ′(0) = 0, φ(L) = 0, φ′(L) = 0",
};

/** Frequenzgleichung je Lagerung (Blevins Tab. 8.1) und die numerisch ausgewertete, beschränkte Form. */
export const FREQ_EQUATION: Readonly<Record<VibrationSupport, { title: string; eq: string; norm: string }>> = {
  KR: { title: "Kragträger, links eingespannt", eq: "cos(βL)·cosh(βL) + 1 = 0", norm: "cos(βL) + 1/cosh(βL)" },
  GG: { title: "gelenkig gelagert", eq: "sin(βL) = 0", norm: "sin(βL)" },
  EG: { title: "links eingespannt, rechts gelenkig", eq: "tan(βL) = tanh(βL)", norm: "sin(βL) − cos(βL)·tanh(βL)" },
  EE: { title: "beidseitig eingespannt", eq: "cos(βL)·cosh(βL) − 1 = 0", norm: "cos(βL) − 1/cosh(βL)" },
};

/**
 * Frequenzgleichung in beschränkter Form (geteilt durch cosh(βL) bzw. mit cos(βL) multipliziert), damit die
 * Auswertung für große βL nicht überläuft. Gleiche Nullstellen wie die Gleichung in FREQ_EQUATION.eq.
 */
export function freqResidual(s: VibrationSupport, x: number): number {
  switch (s) {
    case "KR": return Math.cos(x) + 1 / Math.cosh(x);
    case "GG": return Math.sin(x);
    case "EG": return Math.sin(x) - Math.cos(x) * Math.tanh(x);
    case "EE": return Math.cos(x) - 1 / Math.cosh(x);
  }
}

/**
 * Klammer der n-ten positiven Wurzel. An den Grenzen hat freqResidual entgegengesetzte Vorzeichen:
 * KR: Wert an k·π ist (−1)ᵏ + 1/cosh(kπ), also ((n − 1)π; nπ); GG: ((n − ½)π; (n + ½)π);
 * EG: Wert an k·π ist −(−1)ᵏ·tanh(kπ), EE: (−1)ᵏ − 1/cosh(kπ), also (nπ; (n + 1)π) (Wurzel 0 ausgeschlossen).
 */
export function rootBracket(s: VibrationSupport, n: number): [number, number] {
  switch (s) {
    case "KR": return [(n - 1) * PI, n * PI];
    case "GG": return [(n - 0.5) * PI, (n + 0.5) * PI];
    case "EG": case "EE": return [n * PI, (n + 1) * PI];
  }
}

/** Bisektion mit fester Schrittzahl in [a; b]; f(a) und f(b) müssen verschiedene Vorzeichen haben. */
function bisect(f: (x: number) => number, a: number, b: number, steps = VIB_ROOT_STEPS): number {
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) throw new Error(`Keine Vorzeichenwechsel in [${a}; ${b}]`);
  for (let k = 0; k < steps; k++) {
    const m = (a + b) / 2, fm = f(m);
    if (fm === 0) return m;
    if (fm * fa < 0) b = m; else { a = m; fa = fm; }
  }
  return (a + b) / 2;
}

/** β_n·L, n = 1, 2, …, deterministisch (Einklammerung, Bisektion 80 Schritte). */
export function betaL(s: VibrationSupport, n: number): number {
  const [a, b] = rootBracket(s, n);
  return bisect((x) => freqResidual(s, x), a, b);
}

/** Koeffizient σ der Eigenform (Blevins Tab. 8.1), null bei GG (Sinusform). */
export function shapeSigma(s: VibrationSupport, lam: number): number | null {
  if (s === "GG") return null;
  if (s === "KR") return (Math.sinh(lam) - Math.sin(lam)) / (Math.cosh(lam) + Math.cos(lam));
  return (Math.cosh(lam) - Math.cos(lam)) / (Math.sinh(lam) - Math.sin(lam));
}

/** Formeltext der Eigenform je Lagerung (V-PH-*). */
export const SHAPE_FORMULA: Readonly<Record<VibrationSupport, string>> = {
  KR: "φ(x) = cosh βx − cos βx − σ·(sinh βx − sin βx),  σ = (sinh βL − sin βL)/(cosh βL + cos βL);  normiert auf max |φ| = 1, erste Halbwelle positiv (nach unten)",
  GG: "φ_n(x) = sin(nπ·x/L);  normiert auf max |φ| = 1, erste Halbwelle positiv (nach unten)",
  EG: "φ(x) = cosh βx − cos βx − σ·(sinh βx − sin βx) (erfüllt φ(0) = φ′(0) = 0),  σ = (cosh βL − cos βL)/(sinh βL − sin βL) aus φ(L) = 0, gleichwertig σ = (cosh βL + cos βL)/(sinh βL + sin βL) aus φ″(L) = 0 wegen tan βL = tanh βL;  normiert auf max |φ| = 1, erste Halbwelle positiv (nach unten)",
  EE: "φ(x) = cosh βx − cos βx − σ·(sinh βx − sin βx),  σ = (cosh βL − cos βL)/(sinh βL − sin βL);  normiert auf max |φ| = 1, erste Halbwelle positiv (nach unten)",
};

/** Unnormierte Eigenform und ihre Ableitung nach ξ = x/L (für Vorzeichen und Extremstellen). */
function rawShape(s: VibrationSupport, lam: number, sigma: number | null): { phi: (xi: number) => number; dphi: (xi: number) => number } {
  if (s === "GG") return { phi: (xi) => Math.sin(lam * xi), dphi: (xi) => lam * Math.cos(lam * xi) };
  const sg = sigma as number;
  return {
    phi: (xi) => { const z = lam * xi; return Math.cosh(z) - Math.cos(z) - sg * (Math.sinh(z) - Math.sin(z)); },
    dphi: (xi) => { const z = lam * xi; return lam * (Math.sinh(z) + Math.sin(z) - sg * (Math.cosh(z) - Math.cos(z))); },
  };
}

/** Alle Nullstellen von f im offenen Intervall (0; 1): Raster VIB_SHAPE_GRID, Vorzeichenwechsel, Bisektion. */
function interiorZeros(f: (xi: number) => number): number[] {
  const out: number[] = [];
  const N = VIB_SHAPE_GRID;
  let x0 = 1 / N, f0 = f(x0);
  for (let i = 2; i < N; i++) {
    const x1 = i / N, f1 = f(x1);
    if (f0 === 0) out.push(x0);
    else if (f0 * f1 < 0) out.push(bisect(f, x0, x1));
    x0 = x1; f0 = f1;
  }
  if (f0 === 0) out.push(x0);
  return out;
}

export interface VibrationMode {
  n: number;
  /** β_n·L (–) */
  betaL: number;
  /** β_n in 1/mm */
  beta: number;
  /** Kreisfrequenz in 1/s */
  omega: number;
  /** Eigenfrequenz in Hz */
  f: number;
  /** Koeffizient der Eigenform, null bei GG */
  sigma: number | null;
  /** Rest der Frequenzgleichung (beschränkte Form) an β_n·L */
  residual: number;
  /** Knoten (innere Nullstellen der Eigenform) in mm, aufsteigend */
  nodes: number[];
  /** Ort des größten Ausschlags in mm (bei gleich großen Ausschlägen der erste von links) */
  xMax: number;
  /** Normierte Eigenform φ_n(x), x in mm, max |φ| = 1, erste Halbwelle positiv */
  phi: (x: number) => number;
}

export interface VibrationProps {
  /** Biegesteifigkeit E·I in N·mm² */
  EI: number;
  /** Massenbelegung m′ in t/mm */
  m: number;
  /** Länge in mm */
  L: number;
}

/** Eigenfrequenzen und Eigenformen der ersten nModes Moden. */
export function solveModes(s: VibrationSupport, p: VibrationProps, nModes = VIB_MODES): VibrationMode[] {
  const k = Math.sqrt(p.EI / p.m) / (p.L * p.L);
  const modes: VibrationMode[] = [];
  for (let n = 1; n <= nModes; n++) {
    const lam = betaL(s, n);
    const sigma = shapeSigma(s, lam);
    const raw = rawShape(s, lam, sigma);
    // größter Ausschlag: Ränder und innere Nullstellen von φ′; bei gleich großen Ausschlägen (10⁻⁹) der erste von links
    const cand = [0, ...interiorZeros(raw.dphi), 1].map((c) => ({ c, v: Math.abs(raw.phi(c)) }));
    const amp = Math.max(...cand.map((c) => c.v));
    const xi = (cand.find((c) => c.v >= amp * (1 - 1e-9)) as { c: number }).c;
    // Vorzeichen: erste Halbwelle positiv (alle Formen beginnen an x = 0 mit positiver Krümmung bzw. Steigung)
    const sgn = raw.phi(Math.min(1e-3, (interiorZeros(raw.phi)[0] ?? 1) / 2)) >= 0 ? 1 : -1;
    const scale = sgn / amp;
    const omega = lam * lam * k;
    modes.push({
      n, betaL: lam, beta: lam / p.L, omega, f: omega / (2 * PI), sigma, residual: freqResidual(s, lam),
      nodes: interiorZeros(raw.phi).map((z) => z * p.L), xMax: xi * p.L,
      phi: (x) => scale * raw.phi(x / p.L),
    });
  }
  return modes;
}

/** Werte der Eigenform an n + 1 gleich verteilten Stellen (Darstellung). */
export function modeProfile(mode: VibrationMode, L: number, n = 120): Array<{ x: number; phi: number }> {
  return Array.from({ length: n + 1 }, (_, i) => { const x = (L * i) / n; return { x, phi: mode.phi(x) }; });
}

// ---------- Rayleigh-Kontrolle (V-RQ) ----------
type Poly = number[];
const pMul = (a: Poly, b: Poly): Poly => { const r = new Array<number>(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] = (r[i + j] as number) + x * y; })); return r; };
const pInt = (p: Poly, h: number): number => p.reduce((s, c, i) => s + (c * h ** (i + 1)) / (i + 1), 0);

export interface RayleighCheck {
  /** Streckenlast aus Eigengewicht q = m′·g in N/mm */
  q: number;
  /** ∫w dx in mm², ∫w² dx in mm³ (Biegelinie unter q) */
  intW: number; intW2: number;
  /** Rayleigh-Frequenz in Hz */
  fR: number;
  sol: BeamSolution;
}

/**
 * Rayleigh-Quotient mit der Biegelinie unter Eigengewicht (Lastliste, exakt integriert):
 * f_R = 1/(2π)·√(g·∫m′·w dx / ∫m′·w² dx), m′ konstant. Obere Schranke von f₁.
 */
export function rayleigh(s: VibrationSupport, p: VibrationProps): RayleighCheck {
  const q = p.m * G_MMS2;
  const load: LoadSI = { kind: "q", no: "q_G", x1: 0, x2: p.L, q1: q, q2: q, R: q * p.L, xc: p.L / 2 };
  const sol = solveBeam(s, [load], p.L, p.EI);
  let iw = 0, iw2 = 0;
  for (const g of sol.segments) { const h = g.x1 - g.x0; iw += pInt(g.EIw, h); iw2 += pInt(pMul(g.EIw, g.EIw), h); }
  const intW = iw / p.EI, intW2 = iw2 / (p.EI * p.EI);
  return { q, intW, intW2, fR: Math.sqrt((G_MMS2 * intW) / intW2) / (2 * PI), sol };
}

// ---------- Berechnung mit Rechenweg ----------
export interface VibrationMaterial { E: number; rho: number }
export interface VibrationSection { A: number; I: number; Imin: number; h: number }

export interface VibrationResult {
  support: VibrationSupport;
  load: VibrationLoad;
  errors: string[];
  warnings: string[];
  L: number;
  EI: number;
  /** Massenbelegung in t/mm und in kg/m */
  m: number; mKgM: number;
  modes: VibrationMode[];
  rayleigh: RayleighCheck | null;
  /** f_R / f₁ */
  rayleighRatio: number;
  /** Ausnutzung f_min / f₁ (null ohne f_min) */
  uMin: number | null;
  /** Resonanzabstand Δ in % (null ohne f_err) */
  delta: number | null;
  /** Ausnutzung Δ_min / Δ (null ohne f_err) */
  uRes: number | null;
  /** Schlankheit L / h */
  slender: number;
  steps: { belastung: CalcStep[]; nachweis: CalcStep[] };
}

const greek = (n: number) => ["₀", "₁", "₂", "₃", "₄", "₅"][n] ?? String(n);

/** Prüft die Eingabe (Konzept V2-A Abschnitt 6). Leer = gültig. */
export function vibrationErrors(L: number, v: VibrationLoad): string[] {
  const e: string[] = [];
  const fin = Number.isFinite;
  if (!(L > 0)) e.push("Länge L muss größer als 0 sein");
  if (!fin(v.mz) || v.mz < 0) e.push("Zusatzmasse m_z muss ≥ 0 sein");
  if (v.fmin !== null && !(fin(v.fmin) && v.fmin > 0)) e.push("Mindestfrequenz f_min muss größer als 0 sein");
  if (v.ferr !== null && !(fin(v.ferr) && v.ferr > 0)) e.push("Erregerfrequenz f_err muss größer als 0 sein");
  if (!fin(v.dmin) || v.dmin < 0 || v.dmin >= 100) e.push("Resonanzabstand Δ_min muss zwischen 0 und 100 % liegen");
  return e;
}

/** Eigenfrequenzen, Nachweise und Rechenweg (Gruppen belastung und nachweis). E in MPa, ρ in kg/m³. */
export function computeVibration(s: VibrationSupport, sec: VibrationSection, mat: VibrationMaterial, L: number, v: VibrationLoad): VibrationResult {
  const res: VibrationResult = {
    support: s, load: v, errors: vibrationErrors(L, v), warnings: [], L, EI: NaN, m: NaN, mKgM: NaN, modes: [], rayleigh: null, rayleighRatio: NaN,
    uMin: null, delta: null, uRes: null, slender: L / sec.h, steps: { belastung: [], nachweis: [] },
  };
  if (res.errors.length) return res;
  const B = res.steps.belastung, N = res.steps.nachweis;
  const EI = mat.E * sec.I;
  const mKgM = mat.rho * sec.A * 1e-6 + v.mz;          // kg/m
  const m = mat.rho * 1e-12 * sec.A + v.mz * 1e-6;     // t/mm
  Object.assign(res, { EI, m, mKgM });
  B.push(step("V-EI", "Biegesteifigkeit", "E·I", `${fmt(mat.E)} MPa · ${fmt(sec.I)} mm⁴`, EI, "N·mm²"));
  B.push(step("V-MB", "Massenbelegung", "m′ = ρ·A + m_z;  Rechnung in t/mm: ρ[kg/m³]·10⁻¹²·A[mm²] + m_z[kg/m]·10⁻⁶ (1 kg/m³ = 10⁻¹² t/mm³, 1 kg/m = 10⁻⁶ t/mm);  Anzeige in kg/m: ρ[kg/m³]·A[mm²]·10⁻⁶ + m_z[kg/m] (1 mm² = 10⁻⁶ m²)",
    `t/mm: ${fmt(mat.rho)}·10⁻¹²·${fmt(sec.A)} + ${fmt(v.mz)}·10⁻⁶ = ${fmt(m)} t/mm;  kg/m: ${fmt(mat.rho)}·${fmt(sec.A)}·10⁻⁶ + ${fmt(v.mz)} = ${fmt(mKgM)} kg/m`, m, "t/mm", "Einheitensystem N, mm, t, s (Konzept V2-A P7)"));

  const modes = solveModes(s, { EI, m, L });
  res.modes = modes;
  const m1 = modes[0] as VibrationMode;
  const fq = FREQ_EQUATION[s];
  const list = (f: (md: VibrationMode) => string) => modes.map(f).join(";  ");
  B.push(step("V-EW", "Eigenwertgleichung (Ansatz)", "E·I·w′′′′ + m′·ẅ = 0,  w(x, t) = φ(x)·cos(ωt),  φ(x) = C₁·sin βx + C₂·cos βx + C₃·sinh βx + C₄·cosh βx,  β⁴ = m′·ω²/(E·I)",
    `${LOADLIST_SUPPORTS[s].label}: ${VIB_BC[s]};  β₁ = β₁L / L = ${fmt(m1.betaL, 7)} / ${fmt(L)} = ${fmt(m1.beta)} 1/mm`, m1.beta, "1/mm", "Gross/Hauger TM 4, Kap. 4; Blevins Tab. 8.1"));
  const resid = Math.max(...modes.map((md) => Math.abs(md.residual)));
  B.push(step(`V-CK-${s}`, `Frequenzgleichung (${fq.title})`, fq.eq,
    `aus det = 0 der Randbedingungen ${VIB_BC[s]};  Kontrolle mit β_nL (V-BL), beschränkte Form ${fq.norm}: ${list((md) => `n = ${md.n}: ${fmt(md.residual, 2)}`)}`,
    resid, "–", "Blevins Tab. 8.1; Gross/Hauger TM 4, Kap. 4 (Kontrolle, Sollwert 0)"));
  B.push(step("V-BL", "Wurzeln der Frequenzgleichung", "β_nL = n-te positive Wurzel der Frequenzgleichung, n = 1, 2, 3;  Einklammerung aus den Vorzeichen an k·π (KR: ((n − 1)π; nπ), GG: ((n − ½)π; (n + ½)π), EG und EE: (nπ; (n + 1)π)), Bisektion 80 Schritte, ohne Startwert",
    list((md) => { const [a, b] = rootBracket(s, md.n); return `β${greek(md.n)}L = ${fmt(md.betaL, 7)} in (${fmt(a, 5)}; ${fmt(b, 5)})`; }),
    m1.betaL, "–", "deterministisch wie Nullstellensuche Lastliste; Literatur Blevins Tab. 8.1"));
  B.push(step("V-OM", "Kreisfrequenz", "ω_n = (β_nL)² / L²·√(E·I / m′)",
    list((md) => `ω${greek(md.n)} = ${fmt(md.betaL, 7)}² / ${fmt(L)}²·√(${fmt(EI)} / ${fmt(m)}) = ${fmt(md.omega)} 1/s`), m1.omega, "1/s", "Blevins Tab. 8.1"));
  B.push(step("V-FN", "Eigenfrequenz", "f_n = ω_n / (2π)", list((md) => `f${greek(md.n)} = ${fmt(md.omega)} / (2π) = ${fmt(md.f)} Hz`), m1.f, "Hz"));
  const nodesTxt = modes.filter((md) => md.nodes.length).map((md) => `Form ${md.n}: x = ${md.nodes.map((x) => fmt(x)).join(" und ")} mm`).join(";  ");
  const sigTxt = s === "GG" ? "Sinusform"
    : s === "EG" ? list((md) => `σ${greek(md.n)} = ${fmt(md.sigma, 10)} (Kontrolle aus φ″(L) = 0: ${fmt((Math.cosh(md.betaL) + Math.cos(md.betaL)) / (Math.sinh(md.betaL) + Math.sin(md.betaL)), 10)})`)
    : list((md) => `σ${greek(md.n)} = ${fmt(md.sigma, 7)}`);
  B.push(step(`V-PH-${s}`, `Eigenform (${fq.title}), Ort des größten Ausschlags`, SHAPE_FORMULA[s],
    `${sigTxt};  Knoten ${nodesTxt || "keine"};  größter Ausschlag Form 1 bei x = ${fmt(m1.xMax)} mm`, m1.xMax, "mm", "Blevins Tab. 8.1"));

  // Rayleigh-Kontrolle mit der Biegelinie unter Eigengewicht (obere Schranke)
  const rq = rayleigh(s, { EI, m, L });
  res.rayleigh = rq; res.rayleighRatio = rq.fR / m1.f;
  B.push(step("V-RQ", "Rayleigh-Kontrolle (Plausibilität)", "f_R = 1/(2π)·√(g·∫m′·w dx / ∫m′·w² dx),  w = Biegelinie unter Eigengewicht q = m′·g (Lastliste), m′ konstant;  obere Schranke: f_R ≥ f₁",
    `q = ${fmt(m)}·${G_MMS2} = ${fmt(rq.q)} N/mm;  ∫w dx = ${fmt(rq.intW)} mm²,  ∫w² dx = ${fmt(rq.intW2)} mm³;  f_R = 1/(2π)·√(${G_MMS2}·${fmt(rq.intW)} / ${fmt(rq.intW2)}) = ${fmt(rq.fR)} Hz;  f_R / f₁ = ${fmt(res.rayleighRatio, 6)}`,
    rq.fR, "Hz", `Rayleigh 1877; Sollwert 1 ≤ f_R / f₁ ≤ ${fmt(VIB_RAYLEIGH_MAX)}`));
  if (!(res.rayleighRatio >= 1 - 1e-9 && res.rayleighRatio <= VIB_RAYLEIGH_MAX)) res.warnings.push(`Rayleigh-Kontrolle: f_R / f₁ = ${fmt(res.rayleighRatio, 6)} außerhalb 1 … ${fmt(VIB_RAYLEIGH_MAX)}`);

  // Nachweise
  if (v.fmin !== null) {
    res.uMin = v.fmin / m1.f;
    N.push(step("V-NZ", "Nachweis Mindestfrequenz", "u = f_min / f₁", `${fmt(v.fmin)} / ${fmt(m1.f)}`, res.uMin, "–", "Nachweis f₁ ≥ f_min"));
  }
  if (v.ferr !== null) {
    res.delta = (Math.abs(v.ferr - m1.f) / m1.f) * 100;
    res.uRes = res.delta > 0 ? v.dmin / res.delta : Infinity;
    N.push(step("V-NR", "Resonanzabstand", "Δ = |f_err − f₁| / f₁ ≥ Δ_min",
      `|${fmt(v.ferr)} − ${fmt(m1.f)}| / ${fmt(m1.f)} = ${fmt(res.delta, 3)} % ${res.delta >= v.dmin ? "≥" : "<"} Δ_min = ${fmt(v.dmin)} %`, res.delta, "%", "Konstruktionsregel"));
    for (const md of modes.slice(1)) {
      const d = (Math.abs(v.ferr - md.f) / md.f) * 100;
      if (d < v.dmin) res.warnings.push(`Erregerfrequenz ${fmt(v.ferr)} Hz liegt nahe f${greek(md.n)} = ${fmt(md.f)} Hz (Abstand ${fmt(d, 3)} % < ${fmt(v.dmin)} %)`);
    }
  }
  if (res.slender < VIB_SLENDER_MIN) res.warnings.push(`Gedrungener Balken (L/h = ${fmt(res.slender, 3)} < ${VIB_SLENDER_MIN}): Schubverformung und Drehträgheit (Timoshenko) senken die Frequenzen, Ergebnis nach Euler-Bernoulli zu hoch`);
  if (sec.Imin < sec.I * (1 - 1e-9)) res.warnings.push(`Schwingung in der anderen Hauptachse hat die kleinere Frequenz: f₁ · √(I_min / I) = ${fmt(m1.f * Math.sqrt(sec.Imin / sec.I))} Hz (gerechnet in der Lastebene mit I)`);
  return res;
}

/** Kurzbeschreibung für Überschriften. */
export function vibrationText(s: VibrationSupport, v: VibrationLoad): string {
  const parts = [`Eigenfrequenz, ${LOADLIST_SUPPORTS[s].label}`, `m_z ${fmt(v.mz)} kg/m`];
  if (v.fmin !== null) parts.push(`f_min ${fmt(v.fmin)} Hz`);
  if (v.ferr !== null) parts.push(`f_err ${fmt(v.ferr)} Hz, Δ_min ${fmt(v.dmin)} %`);
  return parts.join("; ");
}
