/**
 * Druckbehälter (Blatt 1, Belastungsart PB): dickwandiger Zylinder und Hohlkugel unter Innen- und Außendruck.
 * Konzept V2-A (freigegeben 12.10.2026, P1 bis P4). Einheiten: N, mm, MPa.
 *
 * Modell: Lamé (gilt für jede Wandstärke), linear-elastisch, isotrop, rotationssymmetrisch, statisch, isotherm,
 * ungestörte Wand weit vom Boden. σ_r, σ_θ, σ_z sind Hauptspannungen.
 * Vorzeichen (Konzept Lastliste Abschnitt 3): Zug positiv, Druck negativ; p_i, p_a sind Überdrücke ≥ 0;
 * Randbedingungen σ_r(a) = −p_i, σ_r(b) = −p_a; u(r) nach außen positiv.
 *
 * Zylinder:  σ_r = A − B/r²,  σ_θ = A + B/r²,  A = (p_i·a² − p_a·b²)/(b² − a²),  B = (p_i − p_a)·a²·b²/(b² − a²)
 *            σ_z = A (geschlossen, Boden trägt die Axialkraft) bzw. 0 (offen)
 * Kugel:     σ_r = A − B/r³,  σ_t = A + B/(2r³), A = (p_i·a³ − p_a·b³)/(b³ − a³), B = (p_i − p_a)·a³·b³/(b³ − a³)
 * Quellen: Gross/Hauger/Schröder/Wall, Technische Mechanik 2, Kap. 6 (Lamé 1852); Roark, Tab. 13.5.
 *
 * Bemessen: geschlossene Lösung für p_a = 0 bei geschlossenem Zylinder und Kugel (P4), sonst Bisektion im
 * log-Raum über t mit fester Schrittzahl 60. Ergebnis aufgerundet auf 0,5 mm (Fertigungsraster Blatt 1).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";

export type PressureShape = "ZY" | "KU";

export interface PressureCase { label: string; short: string; shape: PressureShape; closed: boolean }
export const PRESSURE_CASES = {
  ZG: { label: "Zylinder, geschlossen (Boden trägt die Axialkraft)", short: "Zylinder · geschlossen", shape: "ZY", closed: true },
  ZO: { label: "Zylinder, offen (axial frei)", short: "Zylinder · offen", shape: "ZY", closed: false },
  KU: { label: "Hohlkugel", short: "Kugel", shape: "KU", closed: false },
} as const satisfies Record<string, PressureCase>;
export type PressureCaseId = keyof typeof PRESSURE_CASES;
export function isPressureCase(id: string): id is PressureCaseId { return id in PRESSURE_CASES; }

/** Eingabe im Blatt 1 (StrengthInput.pressure): Maße und Drücke, Form aus dem Lastfall. */
export interface PressureLoad {
  /** Seite des vorgegebenen Durchmessers */
  dim: "inner" | "outer";
  /** Durchmesser auf der gewählten Seite in mm */
  d: number;
  /** Wandstärke in mm */
  t: number;
  /** Innenüberdruck in MPa (≥ 0) */
  pi: number;
  /** Außenüberdruck in MPa (≥ 0) */
  pa: number;
}
export interface PressureInput extends PressureLoad { shape: PressureShape; closed: boolean }

/** Werkstoff- und Auslegungsgrößen für den Nachweis (MPa). Rp = null bei spröden Werkstoffen oder ohne Mindestwert. */
export interface PressureMaterial {
  E: number; nu: number; nuRef: string;
  Rp: number | null; Rm: number | null; brittle: boolean;
  /** Symbol der Bruchgröße (R_m bzw. σ_bB) */
  RmSym: string;
  SFreq: number; SBreq: number;
}

export interface StressPoint { r: number; sr: number; st: number; sz: number; sv: number; tresca: number; u: number }

export interface LameSolution {
  shape: PressureShape; closed: boolean; a: number; b: number; pi: number; pa: number;
  /** Konstante A und Koeffizient B der Lamé-Lösung */
  A: number; B: number;
  /** Axialspannung (Zylinder), für die Kugel die Tangentialspannung in zweiter Richtung */
  sz: (r: number) => number;
  at: (r: number) => StressPoint;
}

export const KESSEL_MIN_RATIO = 20;
export const BEULEN_RATIO = 100;
export const PRESSURE_DESIGN_STEPS = 60;
export const WALL_GRID = 0.5;

const sq = (x: number) => x * x;
/** Zahl im Rechenweg, negative Werte in Klammern. */
const fp = (x: number) => (x < 0 ? `(${fmt(x)})` : fmt(x));

/** Lamé-Lösung für Zylinder (eben bzw. geschlossen) und Kugel. E in MPa. */
export function lame(shape: PressureShape, closed: boolean, a: number, b: number, pi: number, pa: number, E: number, nu: number): LameSolution {
  const n = shape === "ZY" ? 2 : 3;
  const an = a ** n, bn = b ** n, dn = bn - an;
  const A = (pi * an - pa * bn) / dn;
  const B = ((pi - pa) * an * bn) / dn;
  const sz = (r: number) => (shape === "ZY" ? (closed ? A : 0) : A + B / (2 * r ** 3));
  const at = (r: number): StressPoint => {
    if (shape === "ZY") {
      const sr = A - B / (r * r), st = A + B / (r * r), z = closed ? A : 0;
      const sv = Math.sqrt(0.5 * (sq(st - sr) + sq(sr - z) + sq(z - st)));
      const tr = Math.max(sr, st, z) - Math.min(sr, st, z);
      return { r, sr, st, sz: z, sv, tresca: tr, u: (r / E) * (st - nu * (sr + z)) };
    }
    const sr = A - B / r ** 3, st = A + B / (2 * r ** 3);
    const sv = Math.abs(st - sr);
    return { r, sr, st, sz: st, sv, tresca: sv, u: (r / E) * ((1 - nu) * st - nu * sr) };
  };
  return { shape, closed, a, b, pi, pa, A, B, sz, at };
}

/** Radien aus der Eingabe. */
export function pressureRadii(inp: PressureLoad): { a: number; b: number } {
  return inp.dim === "inner" ? { a: inp.d / 2, b: inp.d / 2 + inp.t } : { a: inp.d / 2 - inp.t, b: inp.d / 2 };
}

/** Prüft die Eingabe (Konzept V2-A Abschnitt 6). Liefert Fehlertexte, leer = gültig. */
export function pressureErrors(inp: PressureLoad, checkWall = true): string[] {
  const e: string[] = [];
  const fin = (x: number) => Number.isFinite(x);
  if (!fin(inp.d) || !(inp.d > 0)) e.push("Durchmesser d muss größer als 0 sein");
  if (checkWall && (!fin(inp.t) || !(inp.t > 0))) e.push("Wandstärke t muss größer als 0 sein");
  if (!fin(inp.pi) || inp.pi < 0) e.push("Innendruck p_i muss ≥ 0 sein (Überdruck)");
  if (!fin(inp.pa) || inp.pa < 0) e.push("Außendruck p_a muss ≥ 0 sein (Unterdruck ist nicht Ziel, Beulen eigenes Paket)");
  if (fin(inp.pi) && fin(inp.pa) && inp.pi === 0 && inp.pa === 0) e.push("Mindestens ein Druck muss größer als 0 sein");
  if (checkWall && !e.length && inp.dim === "outer" && !(inp.t < inp.d / 2)) e.push("Wandstärke t muss kleiner als der Außenradius D/2 sein");
  return e;
}

export interface Allowable { sigmaZul: number; gov: "Rp" | "Rm" | null; subst: string }

/** P-NZ: σ_zul = min(R_p / S_F, R_m / S_B), spröde R_m / S_B. NaN, wenn kein Auslegungswert vorliegt. */
export function allowable(m: PressureMaterial): Allowable {
  const c: Array<{ v: number; gov: "Rp" | "Rm"; t: string }> = [];
  if (!m.brittle && m.Rp) c.push({ v: m.Rp / m.SFreq, gov: "Rp", t: `R_p / S_F = ${fmt(m.Rp)} / ${fmt(m.SFreq)} = ${fmt(m.Rp / m.SFreq)}` });
  if (m.Rm) c.push({ v: m.Rm / m.SBreq, gov: "Rm", t: `${m.RmSym} / S_B = ${fmt(m.Rm)} / ${fmt(m.SBreq)} = ${fmt(m.Rm / m.SBreq)}` });
  if (!c.length) return { sigmaZul: NaN, gov: null, subst: "kein Auslegungswert" };
  const g = c.reduce((x, y) => (y.v < x.v ? y : x));
  return { sigmaZul: g.v, gov: g.gov, subst: `min(${c.map((x) => x.t).join("; ")})${m.brittle ? " (spröde: nur Bruch)" : ""}` };
}

export interface PressureResult {
  input: PressureInput;
  errors: string[];
  warnings: string[];
  a: number; b: number; t: number;
  /** mittlerer Durchmesser D_m = a + b und Verhältnis D_m / t */
  Dm: number; ratio: number;
  sol: LameSolution | null;
  inner: StressPoint | null; outer: StressPoint | null;
  svMax: number; rGov: "a" | "b";
  sigmaZul: number; util: number;
  SF: number | null; SB: number | null;
  kessel: { st: number; sz: number; sr: number; dev: number } | null;
  /** vollplastischer Grenzdruck (nur Hinweis, Zylinder geschlossen) */
  pF: number | null;
  steps: { querschnitt: CalcStep[]; belastung: CalcStep[]; nachweis: CalcStep[] };
}

const REF_ZY = "Gross/Hauger TM 2, Kap. 6 (Lamé 1852); Roark Tab. 13.5";
const REF_KU = "Roark Tab. 13.5; Gross/Hauger TM 2, Kap. 6";

/** Spannungen, Verschiebungen und Nachweis eines Druckbehälters mit Rechenweg. */
export function computePressure(inp: PressureInput, m: PressureMaterial): PressureResult {
  const { a, b } = pressureRadii(inp);
  const t = b - a, Dm = a + b, ratio = Dm / t;
  const res: PressureResult = {
    input: inp, errors: pressureErrors(inp), warnings: [], a, b, t, Dm, ratio, sol: null, inner: null, outer: null,
    svMax: NaN, rGov: "a", sigmaZul: NaN, util: Infinity, SF: null, SB: null, kessel: null, pF: null,
    steps: { querschnitt: [], belastung: [], nachweis: [] },
  };
  if (res.errors.length) return res;
  const { pi, pa } = inp;
  const zy = inp.shape === "ZY";
  const n = zy ? 2 : 3, nn = zy ? "²" : "³";
  const sol = lame(inp.shape, inp.closed, a, b, pi, pa, m.E, m.nu);
  const P = sol.at(a), Q = sol.at(b);
  Object.assign(res, { sol, inner: P, outer: Q });
  const Q_ = res.steps.querschnitt, S = res.steps.belastung, N = res.steps.nachweis;

  Q_.push(step("P-GEO", "Innen- und Außenradius", inp.dim === "inner" ? "a = d_i / 2,  b = a + t" : "b = d_a / 2,  a = b − t",
    inp.dim === "inner" ? `a = ${fmt(inp.d)} / 2 = ${fmt(a)} mm,  b = ${fmt(a)} + ${fmt(t)} = ${fmt(b)} mm` : `b = ${fmt(inp.d)} / 2 = ${fmt(b)} mm,  a = ${fmt(b)} − ${fmt(t)} = ${fmt(a)} mm`,
    a, "mm", "Eingabe"));

  const pre = zy ? "P-ZY" : "P-KU";
  const ref = zy ? REF_ZY : REF_KU;
  const coef = `A = (${fmt(pi)}·${fmt(a)}${nn} − ${fmt(pa)}·${fmt(b)}${nn}) / (${fmt(b)}${nn} − ${fmt(a)}${nn}) = ${fmt(sol.A)} MPa,  B = (${fmt(pi)} − ${fmt(pa)})·${fmt(a)}${nn}·${fmt(b)}${nn} / (${fmt(b)}${nn} − ${fmt(a)}${nn}) = ${fmt(sol.B)} MPa·mm${nn}`;
  if (zy) {
    S.push(step("P-ZY-SR", "Radialspannung", "σ_r(r) = (p_i·a² − p_a·b²)/(b² − a²) − (p_i − p_a)·a²·b²/((b² − a²)·r²)",
      `${coef};  σ_r(a) = A − B/a² = ${fmt(P.sr)} MPa,  σ_r(b) = ${fmt(Q.sr)} MPa`, P.sr, "MPa", ref));
    S.push(step("P-ZY-ST", "Umfangsspannung", "σ_θ(r) = (p_i·a² − p_a·b²)/(b² − a²) + (p_i − p_a)·a²·b²/((b² − a²)·r²)",
      `σ_θ(a) = A + B/a² = ${fmt(sol.A)} + ${fmt(sol.B)} / ${fmt(a)}² = ${fmt(P.st)} MPa,  σ_θ(b) = ${fmt(Q.st)} MPa`, P.st, "MPa", ref));
    S.push(step("P-ZY-SZ", "Axialspannung", "geschlossen: σ_z = (p_i·a² − p_a·b²)/(b² − a²), konstant über r;  offen: σ_z = 0",
      inp.closed ? `geschlossen: σ_z = A = ${fmt(sol.A)} MPa` : "offen (axial frei): σ_z = 0", P.sz, "MPa", "Gleichgewicht am Schnitt, Gross/Hauger TM 2, Kap. 6"));
    S.push(step("P-ZY-SV", "Vergleichsspannung (GEH)", "σ_v = √(½·[(σ_θ − σ_r)² + (σ_r − σ_z)² + (σ_z − σ_θ)²]), bei r = a und r = b, größerer Wert maßgebend",
      `r = a: √(½·[(${fp(P.st)} − ${fp(P.sr)})² + (${fp(P.sr)} − ${fp(P.sz)})² + (${fp(P.sz)} − ${fp(P.st)})²]) = ${fmt(P.sv)} MPa;  r = b: ${fmt(Q.sv)} MPa`,
      Math.max(P.sv, Q.sv), "MPa", "Gestaltänderungsenergiehypothese"));
    S.push(step("P-ZY-U", "Radiale Verschiebung (Aufweitung)", "u(r) = r/E·[σ_θ − ν·(σ_r + σ_z)]",
      `u(a) = ${fmt(a)} / ${fmt(m.E)}·[${fp(P.st)} − ${fmt(m.nu)}·(${fp(P.sr)} + ${fp(P.sz)})] = ${fmt(P.u)} mm,  u(b) = ${fmt(Q.u)} mm`, P.u, "mm", `Hooke; ${m.nuRef}`));
  } else {
    S.push(step("P-KU-SR", "Radialspannung", "σ_r(r) = (p_i·a³ − p_a·b³)/(b³ − a³) − (p_i − p_a)·a³·b³/((b³ − a³)·r³)",
      `${coef};  σ_r(a) = A − B/a³ = ${fmt(P.sr)} MPa,  σ_r(b) = ${fmt(Q.sr)} MPa`, P.sr, "MPa", ref));
    S.push(step("P-KU-ST", "Tangentialspannung (beide Richtungen)", "σ_t(r) = (p_i·a³ − p_a·b³)/(b³ − a³) + (p_i − p_a)·a³·b³/(2·(b³ − a³)·r³)",
      `σ_t(a) = A + B/(2a³) = ${fmt(sol.A)} + ${fmt(sol.B)} / (2·${fmt(a)}³) = ${fmt(P.st)} MPa,  σ_t(b) = ${fmt(Q.st)} MPa`, P.st, "MPa", ref));
    S.push(step("P-KU-SV", "Vergleichsspannung (GEH)", "σ_v = |σ_t − σ_r| (GEH mit σ_θ = σ_φ), bei r = a und r = b, größerer Wert maßgebend",
      `r = a: |${fp(P.st)} − ${fp(P.sr)}| = ${fmt(P.sv)} MPa;  r = b: ${fmt(Q.sv)} MPa`, Math.max(P.sv, Q.sv), "MPa", "Gestaltänderungsenergiehypothese"));
    S.push(step("P-KU-U", "Radiale Verschiebung (Aufweitung)", "u(r) = r/E·[(1 − ν)·σ_t − ν·σ_r]",
      `u(a) = ${fmt(a)} / ${fmt(m.E)}·[(1 − ${fmt(m.nu)})·${fp(P.st)} − ${fmt(m.nu)}·${fp(P.sr)}] = ${fmt(P.u)} mm,  u(b) = ${fmt(Q.u)} mm`, P.u, "mm", `Hooke; ${m.nuRef}`));
  }
  const gov = Q.sv > P.sv ? Q : P;
  res.svMax = gov.sv; res.rGov = gov === Q ? "b" : "a";
  S.push(step("P-TR", "Vergleichsspannung nach Tresca (nur Kennwert)", "σ_T = σ_max − σ_min der Hauptspannungen σ_r, σ_θ, σ_z an der maßgebenden Stelle",
    `r = ${res.rGov}: max(${fmt(gov.sr)}; ${fmt(gov.st)}; ${fmt(gov.sz)}) − min(${fmt(gov.sr)}; ${fmt(gov.st)}; ${fmt(gov.sz)}) = ${fmt(gov.tresca)} MPa (zum Vergleich, Nachweis mit GEH)`, gov.tresca, "MPa", "Schubspannungshypothese, Konzept V2-A P3"));

  // Kesselformel als Vergleich (P1), nur im Gültigkeitsbereich
  const p = pi - pa;
  if (ratio >= KESSEL_MIN_RATIO) {
    const ks = zy ? p * Dm / (2 * t) : p * Dm / (4 * t);
    const kz = zy ? (inp.closed ? p * Dm / (4 * t) : 0) : ks;
    const dev = (ks - P.st) / P.st;
    res.kessel = { st: ks, sz: kz, sr: -p / 2, dev };
    if (zy) S.push(step("P-ZY-KS", "Kesselformel (Vergleich, dünnwandig)", "σ_θ = p·D_m/(2t),  σ_z = p·D_m/(4t) (geschlossen),  σ_r ≈ −p/2,  D_m = a + b,  p = p_i − p_a, nur wenn D_m/t ≥ 20",
      `D_m = ${fmt(Dm)} mm, D_m/t = ${fmt(ratio)};  σ_θ = ${fmt(p)}·${fmt(Dm)} / (2·${fmt(t)}) = ${fmt(ks)} MPa,  σ_z = ${fmt(kz)} MPa;  Abweichung zu Lamé σ_θ(a): ${fmt(dev * 100, 3)} %`, ks, "MPa", "Gross/Hauger TM 2, Kap. 6 (dünnwandig)"));
    else S.push(step("P-KU-KS", "Kesselformel (Vergleich, dünnwandig)", "σ_t = p·D_m/(4t),  D_m = a + b,  p = p_i − p_a, nur wenn D_m/t ≥ 20",
      `D_m = ${fmt(Dm)} mm, D_m/t = ${fmt(ratio)};  σ_t = ${fmt(p)}·${fmt(Dm)} / (4·${fmt(t)}) = ${fmt(ks)} MPa;  Abweichung zu Lamé σ_t(a): ${fmt(dev * 100, 3)} %`, ks, "MPa", "Gross/Hauger TM 2, Kap. 6 (dünnwandig)"));
  } else res.warnings.push(`Dickwandig (D_m/t = ${fmt(ratio, 3)} < ${KESSEL_MIN_RATIO}): Kesselformel gilt nicht, Ergebnis nach Lamé`);
  if (pa > 0 && pa >= pi) res.warnings.push(`Außendruck: Stabilität (Beulen) nicht nachgewiesen${ratio > BEULEN_RATIO ? `, bei D_m/t = ${fmt(ratio, 3)} > ${BEULEN_RATIO} besonders gefährdet` : ""}`);
  else if (pa > 0 && ratio > BEULEN_RATIO) res.warnings.push(`D_m/t = ${fmt(ratio, 3)} > ${BEULEN_RATIO}: bei Außendruck Beulen möglich, nicht nachgewiesen`);
  if (pi === pa) res.warnings.push(`Gleichdruck p_i = p_a: hydrostatischer Spannungszustand σ_r = σ_θ = ${fmt(-pi)} MPa${zy && !inp.closed ? ", σ_z = 0" : ""}`);

  // Nachweis
  const z = allowable(m);
  res.sigmaZul = z.sigmaZul;
  if (z.gov) {
    N.push(step("P-NZ", "Zulässige Spannung", "σ_zul = min(R_p / S_F, R_m / S_B)", z.subst, z.sigmaZul, "MPa", "wie C-SZUL; spröde: nur R_m / S_B"));
    res.util = res.svMax / z.sigmaZul;
    N.push(step("P-NA", "Ausnutzung", "u = σ_v,max / σ_zul", `${fmt(res.svMax)} / ${fmt(z.sigmaZul)} (maßgebend r = ${res.rGov})`, res.util, "–"));
  }
  if (!m.brittle && m.Rp) { res.SF = m.Rp / res.svMax; N.push(step("N-SF", "Sicherheit gegen Fließen", "S_F = R_p / σ_v", `${fmt(m.Rp)} / ${fmt(res.svMax)} (σ_v = σ_v,max)`, res.SF, "–")); }
  if (m.Rm) { res.SB = m.Rm / res.svMax; N.push(step("N-SB", "Sicherheit gegen Bruch", `S_B = ${m.RmSym} / σ_v`, `${fmt(m.Rm)} / ${fmt(res.svMax)} (σ_v = σ_v,max)`, res.SB, "–")); }
  if (zy && inp.closed && m.Rp && !m.brittle && b > a) {
    res.pF = (2 / Math.sqrt(3)) * m.Rp * Math.log(b / a);
    res.warnings.push(`Vollplastischer Grenzdruck (Hinweis, nicht genutzt): p_F = 2/√3·R_p·ln(b/a) = 2/√3·${fmt(m.Rp)}·ln(${fmt(b)}/${fmt(a)}) = ${fmt(res.pF)} MPa`);
  }
  return res;
}

// ---------------- Bemessen ----------------
export type PressureDesign =
  | { ok: true; tErf: number; tGew: number; closedForm: boolean; utilErf: number; steps: CalcStep[] }
  | { ok: false; message: string; steps: CalcStep[] };

/** Größte GEH-Spannung der Wand (r = a oder r = b) bei Wandstärke t. */
function svMaxAt(inp: PressureInput, t: number, m: PressureMaterial): number {
  const { a, b } = pressureRadii({ ...inp, t });
  const s = lame(inp.shape, inp.closed, a, b, inp.pi, inp.pa, m.E, m.nu);
  return Math.max(s.at(a).sv, s.at(b).sv);
}

/**
 * Erforderliche Wandstärke für σ_v,max = σ_zul (Konzept V2-A Abschnitt 4.4).
 * Geschlossene Lösung (p_a = 0, Zylinder geschlossen oder Kugel), sonst Bisektion im log-Raum (60 Schritte).
 * Das Ergebnis wird auf 0,5 mm aufgerundet. Der vorgegebene Durchmesser (innen oder außen) bleibt fest.
 */
export function designPressure(inp: PressureInput, m: PressureMaterial): PressureDesign {
  const T: CalcStep[] = [];
  const errs = pressureErrors(inp, false);
  if (errs.length) return { ok: false, message: errs.join("; "), steps: T };
  const z = allowable(m);
  if (!z.gov) return { ok: false, message: "Kein Auslegungswert für R_p oder R_m, Bemessen nicht möglich", steps: T };
  const sz = z.sigmaZul, p = inp.pi;
  T.push(step("P-NZ", "Zulässige Spannung", "σ_zul = min(R_p / S_F, R_m / S_B)", z.subst, sz, "MPa", "wie C-SZUL; spröde: nur R_m / S_B"));
  const outer = inp.dim === "outer";
  const r0 = inp.d / 2;
  const closedForm = inp.pa === 0 && (inp.shape === "KU" || inp.closed);
  let tErf: number;
  if (closedForm) {
    const zy = inp.shape === "ZY";
    const lim = zy ? sz / Math.sqrt(3) : (2 * sz) / 3;
    if (!(p < lim)) return { ok: false, steps: T, message: `Druck übersteigt die Grenze des Werkstoffs: p = ${fmt(p)} MPa ≥ ${zy ? "σ_zul/√3" : "2σ_zul/3"} = ${fmt(lim)} MPa, auch t → ∞ reicht nicht` };
    if (zy) {
      const k = Math.sqrt(1 - (Math.sqrt(3) * p) / sz);
      tErf = outer ? r0 * (1 - k) : r0 * (1 / k - 1);
      T.push(outer
        ? step("P-ZY-B", "Erforderliche Wandstärke, Außenradius b fest", "t = b·(1 − √(1 − √3·p/σ_zul))", `${fmt(r0)}·(1 − √(1 − √3·${fmt(p)} / ${fmt(sz)}))`, tErf, "mm", "aus σ_v(a) = √3·p·b²/(b² − a²) = σ_zul")
        : step("P-ZY-BI", "Erforderliche Wandstärke, Innenradius a fest", "t = a·(1/√(1 − √3·p/σ_zul) − 1)", `${fmt(r0)}·(1/√(1 − √3·${fmt(p)} / ${fmt(sz)}) − 1)`, tErf, "mm", "aus σ_v(a) = √3·p·b²/(b² − a²) = σ_zul"));
    } else {
      const k = Math.cbrt(1 - (3 * p) / (2 * sz));
      tErf = outer ? r0 * (1 - k) : r0 * (1 / k - 1);
      T.push(outer
        ? step("P-KU-B", "Erforderliche Wandstärke, Außenradius b fest", "t = b·(1 − (1 − 3p/(2σ_zul))^(1/3))", `${fmt(r0)}·(1 − (1 − 3·${fmt(p)} / (2·${fmt(sz)}))^(1/3))`, tErf, "mm", "aus σ_v(a) = 1,5·p·b³/(b³ − a³) = σ_zul")
        : step("P-KU-BI", "Erforderliche Wandstärke, Innenradius a fest", "t = a·((1 − 3p/(2σ_zul))^(−1/3) − 1)", `${fmt(r0)}·((1 − 3·${fmt(p)} / (2·${fmt(sz)}))^(−1/3) − 1)`, tErf, "mm", "aus σ_v(a) = 1,5·p·b³/(b³ − a³) = σ_zul"));
    }
  } else {
    const tLo = r0 * 1e-6, tHi = outer ? r0 * (1 - 1e-6) : r0 * 1e3;
    const u = (t: number) => svMaxAt(inp, t, m) / sz;
    if (!(u(tHi) <= 1)) return { ok: false, steps: T, message: outer ? "Druck übersteigt die Grenze des Werkstoffs: auch eine fast volle Wand (a → 0) reicht nicht" : "Druck übersteigt die Grenze des Werkstoffs: auch t = 1000·a reicht nicht" };
    let lo = Math.log(tLo), hi = Math.log(tHi);
    if (u(tLo) <= 1) hi = lo;
    else for (let i = 0; i < PRESSURE_DESIGN_STEPS; i++) { const mid = (lo + hi) / 2; if (u(Math.exp(mid)) > 1) lo = mid; else hi = mid; }
    tErf = Math.exp(hi);
    T.push(step("P-BIS", "Erforderliche Wandstärke (numerisch)", "σ_v,max(t) = σ_zul, Bisektion im log-Raum über t",
      `t ∈ [${fmt(tLo)}; ${fmt(tHi)}] mm, ${PRESSURE_DESIGN_STEPS} Schritte, ${outer ? "Außenradius b" : "Innenradius a"} = ${fmt(r0)} mm fest; ${inp.shape === "ZY" && !inp.closed ? "Zylinder offen" : "mit Außendruck"}, keine geschlossene Lösung`,
      tErf, "mm", "deterministisch, feste Schrittzahl"));
  }
  const utilErf = svMaxAt(inp, tErf, m) / sz;
  T.push(step("P-NA", "Ausnutzung mit t_erf (Kontrolle)", "u = σ_v,max / σ_zul", `σ_v,max(t = ${fmt(tErf, 6)} mm) / ${fmt(sz)}`, utilErf, "–", "Sollwert 1"));
  const tGew = Math.ceil(tErf / WALL_GRID - 1e-9) * WALL_GRID;
  if (outer && !(tGew < r0)) return { ok: false, steps: T, message: `Gewählte Wandstärke ${fmt(tGew)} mm erreicht den Außenradius ${fmt(r0)} mm, keine Lösung im Fertigungsraster` };
  T.push(step("D-GEW-t", "Gewähltes Maß t", "t aufgerundet auf 0,5 mm", `${fmt(tErf)} → ${fmt(tGew)}`, tGew, "mm", "Fertigungsraster"));
  return { ok: true, tErf, tGew, closedForm, utilErf, steps: T };
}

/** Werte der Wand an n + 1 gleich verteilten Radien von a bis b (Spannungsdiagramm). */
export function pressureProfile(sol: LameSolution, n = 60): StressPoint[] {
  return Array.from({ length: n + 1 }, (_, i) => sol.at(sol.a + ((sol.b - sol.a) * i) / n));
}

/** Kurzbeschreibung für Überschriften. */
export function pressureText(caseId: PressureCaseId, p: PressureLoad): string {
  const { a, b } = pressureRadii(p);
  return `${PRESSURE_CASES[caseId].label}; a ${fmt(a)} mm, b ${fmt(b)} mm (t ${fmt(b - a)} mm); p_i ${fmt(p.pi)} MPa, p_a ${fmt(p.pa)} MPa`;
}
