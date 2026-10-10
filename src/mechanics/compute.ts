/**
 * Festigkeitsnachweis (Blatt 1). Einheiten intern: N, mm, MPa; Eingaben F, N in kN, q in kN/m (= N/mm), T in N·m.
 *
 * Annahmen: linear-elastisch, kleine Verformungen, Bernoulli-Balken, statische Last, isotroper Werkstoff.
 * Vergleichsspannung nach GEH an der Randfaser: σ_v = √((|σ_b| + |σ_N|)² + 3τ_t²). τ_Q wird separat ausgewiesen.
 * Knicken: Euler für λ ≥ λ_T = π·√(2E/R_p), sonst Johnson-Parabel (tangiert Euler bei σ = R_p/2).
 */
import { fmt } from "../format";
import { sectionProps, SECTIONS, type Dims, type SecType, type SectionProps } from "../sections";
import { step, type CalcStep, type Trace, type TraceGroup } from "../trace";
import { defaultNu, strengthDesign, DV_SYMBOL, type DvChoice, type Material, type Repo, type StrengthDesign } from "../materials";
import { BENDING_CASES, BUCKLING_CASES, EULER_BETA, isBendingCase, isBucklingCase, type BendingCase, type Kind } from "./cases";
import { beamFns, bendingMax, type BeamFns, type BeamMax } from "./beam";

export const G_ACC = 9.81; // m/s²

export interface StrengthInput {
  mode: "single" | "combined";
  kind: Kind;
  /** Lastfall-ID (Z1, Z2, K1..K4, KE..BQ, T1, T2, im Modus combined auch "none") */
  sub: string;
  materialId: string;
  secType: SecType;
  dims: Dims;
  /** Länge in mm */
  L: number;
  /** Einzelkraft in kN (Zug, Druck, Biegung) */
  F: number;
  /** Streckenlast in kN/m */
  q: number;
  /** Abstand der Lasten bei 4-Punkt-Biegung in mm */
  a: number;
  /** Längskraft im Modus combined in kN (+Zug, −Druck) */
  N: number;
  /** Torsionsmoment in N·m */
  T: number;
  fDiv: number;
  SFreq: number; SBreq: number; SKreq: number;
  dvChoice: { RE: DvChoice; RM: DvChoice };
  dvManual: { RE: number | null; RM: number | null };
}

export interface Check { key: "fliessen" | "bruch" | "knicken" | "durchbiegung"; label: string; S: number | null; req: number; u: number | null; text: string }
export interface Kpi { key: string; label: string; sym: string; value: number; unit: string; result: boolean; main?: boolean }

export interface StrengthResult {
  input: StrengthInput;
  material: Material;
  section: SectionProps;
  errors: string[];
  warnings: string[];
  kind: Kind | "combined";
  caseId: string;
  E: number; G: number; nu: number;
  strength: StrengthDesign | null;
  mass: number;
  L: number;
  bend: (BeamMax & { fns: BeamFns; EI: number; case: BendingCase }) | null;
  fzul: number | null;
  axial: { N: number; qG: number; Nmax: number; dL: number; N_x: (x: number) => number; u_x: (x: number) => number } | null;
  buck: { eulerCase: 1 | 2 | 3 | 4; beta: number; Lk: number; lambda: number; lambdaT: number | null; sigmaK: number; Fk: number; model: "Euler" | "Johnson"; SK: number; Rp: number | null; E: number; sigmaD: number } | null;
  tors: { T: number; Teff: number; theta: number; twoSided: boolean; T_x: (x: number) => number; phi_x: (x: number) => number } | null;
  sigmaB: number; sigmaN: number; tauT: number; tauQ: number; sigmaV: number;
  checks: Check[];
  /** größte Ausnutzung S_erf/S; Infinity, wenn kein Nachweis möglich */
  util: number;
  governing: string | null;
  /** Nachweise ohne Auslegungswert */
  incomplete: string[];
  kpis: Kpi[];
  trace: Trace;
}

export class InputError extends Error {}

export function computeStrength(repo: Repo, inp: StrengthInput): StrengthResult {
  const mat = repo.byId(inp.materialId);
  if (!mat) throw new InputError(`Unbekannter Werkstoff ${inp.materialId}`);
  const sec = sectionProps(inp.secType, inp.dims);
  const G: Trace = {};
  const add = (g: TraceGroup, s: CalcStep) => { (G[g] ??= []).push(s); };
  sec.trace.forEach((s) => add(s.id.startsWith("F-") ? "formfaktor" : "querschnitt", s));
  const kind: Kind | "combined" = inp.mode === "combined" ? "combined" : inp.kind;

  const res: StrengthResult = {
    input: inp, material: mat, section: sec, errors: [...sec.errors], warnings: [...sec.notes], kind, caseId: "none",
    E: NaN, G: NaN, nu: NaN, strength: null, mass: NaN, L: inp.L, bend: null, fzul: null, axial: null, buck: null, tors: null,
    sigmaB: 0, sigmaN: 0, tauT: 0, tauQ: 0, sigmaV: 0, checks: [], util: Infinity, governing: null, incomplete: [], kpis: [], trace: G,
  };
  if (!(inp.L > 0)) res.errors.push("Länge L muss größer als 0 sein");
  if (mat.E === null || mat.rho === null) res.errors.push(`${mat.name}: E-Modul oder Dichte nicht belegt`);
  if (res.errors.length) return res;
  const Egpa = mat.E as number, rho = mat.rho as number;

  // Werkstoff
  const E = Egpa * 1000;
  const rowG = repo.row(mat.id, "P-G"), rowNu = repo.row(mat.id, "P-NU");
  const nu = rowNu?.value ?? defaultNu(mat.cls);
  const Gm = rowG?.value ? rowG.value * 1000 : E / (2 * (1 + nu));
  add("werkstoff", step("W-E", "E-Modul", "E (Werkstoffdatenbank, Standardvariante)", `${fmt(Egpa)} GPa`, E, "MPa", "WDB v0.3"));
  add("werkstoff", step("W-RHO", "Dichte", "ρ (Werkstoffdatenbank)", `${fmt(rho)} kg/m³`, rho, "kg/m³", "WDB v0.3"));
  if (rowG?.value) add("werkstoff", step("W-G-DB", "Schubmodul", "G (Werkstoffdatenbank)", `${fmt(rowG.value)} GPa`, Gm, "MPa", repo.sourceName(rowG.source_id)));
  else add("werkstoff", step("W-G", "Schubmodul", "G = E / (2·(1 + ν))", `${fmt(E)} / (2·(1 + ${fmt(nu)}))`, Gm, "MPa", rowNu ? `ν aus ${repo.sourceName(rowNu.source_id)}` : "ν Klassen-Richtwert (Annahme)"));

  let caseId = "none", N = 0, Tm = 0, eulerCase: 1 | 2 | 3 | 4 | null = null;
  const F = inp.F * 1000, q = inp.q, a = inp.a, L = inp.L;
  if (inp.mode === "combined") {
    caseId = inp.sub; N = inp.N * 1000; Tm = inp.T * 1e3;
    eulerCase = isBendingCase(caseId) ? BENDING_CASES[caseId].euler : 2;
  } else if (inp.kind === "biegung") caseId = inp.sub;
  else if (inp.kind === "zug") N = F;
  else if (inp.kind === "druck") { N = -F; if (!isBucklingCase(inp.sub)) res.errors.push(`Unbekannter Eulerfall ${inp.sub}`); else eulerCase = (Number(inp.sub.slice(1)) as 1 | 2 | 3 | 4); }
  else Tm = inp.T * 1e3;
  if ((inp.mode === "combined" || inp.kind === "biegung") && caseId !== "none" && !isBendingCase(caseId)) res.errors.push(`Unbekannter Lastfall ${caseId}`);
  if (inp.kind === "biegung" && inp.mode === "single" && caseId === "none") res.errors.push("Biegung ohne Lastfall");
  if (res.errors.length) return res;
  res.caseId = caseId;

  const bending = isBendingCase(caseId);
  const S = strengthDesign(repo, mat, bending, inp.dvChoice, inp.dvManual);
  res.strength = S; res.E = E; res.G = Gm; res.nu = nu;
  const Rp = S.Rp?.v ?? null, Rm = S.Rm?.v ?? null;
  if (S.Rp) add("werkstoff", step("W-RP", "Streckgrenze (Auslegungswert)", "R_p = Auslegungswert aus der Datenbankzeile des Werkstoffs (Standard: unterer Wert)", `${mat.name}: Datenbank ${S.Rp.db} MPa (${S.Rp.type}${S.Rp.cond ? ", " + S.Rp.cond : ""}) → ${S.Rp.basis}`, Rp ?? NaN, "MPa", S.Rp.src));
  if (S.Rm) add("werkstoff", step(S.Rm.prop === "P-BB" ? "W-BB" : "W-RM", (S.Rm.prop === "P-BB" ? "Biegefestigkeit" : "Zugfestigkeit") + " (Auslegungswert)", `${DV_SYMBOL[S.Rm.prop]} = Auslegungswert aus der Datenbankzeile des Werkstoffs (Standard: unterer Wert)`, `${mat.name}: Datenbank ${S.Rm.db} MPa (${S.Rm.type}${S.Rm.cond ? ", " + S.Rm.cond : ""}) → ${S.Rm.basis}`, Rm ?? NaN, "MPa", S.Rm.src));
  for (const d of [S.Rp, S.Rm]) if (d?.warn) res.warnings.push(`${DV_SYMBOL[d.prop]}: ${d.warn}`);
  if (S.brittle) res.warnings.push("Spröder Werkstoff: nur Bruchnachweis");
  if (mat.cls === "Polymer") res.warnings.push("Polymer: Werte gelten für 23 °C und Kurzzeitbelastung");

  res.mass = rho * sec.A * 1e-9 * L;
  add("querschnitt", step("Q-m", "Masse", "m = ρ·A·L", `${fmt(rho)} kg/m³ · ${fmt(sec.A)} mm² · ${fmt(L)} mm`, res.mass, "kg"));

  let sigmaB = 0, tauQ = 0, sigN = 0, tauT = 0;
  // Biegung
  if (bending && isBendingCase(caseId)) {
    const EI = E * sec.I;
    const mx = bendingMax(caseId, L, F, q, a, EI);
    const bc: BendingCase = BENDING_CASES[caseId];
    res.bend = { ...mx, fns: beamFns(caseId, L, F, q, a), EI, case: bc };
    sigmaB = mx.M / sec.W; tauQ = sec.kappa * mx.Q / sec.A; res.fzul = L / inp.fDiv;
    add("belastung", step(`B-M-${caseId}`, "Größtes Biegemoment", mx.fM, mx.sM, mx.M, "N·mm", bc.ref));
    add("belastung", step("B-SIG", "Biegespannung", "σ_b = M_max / W", `${fmt(mx.M)} / ${fmt(sec.W)}`, sigmaB, "MPa"));
    add("belastung", step("B-TAUQ", "Schubspannung aus Querkraft (Näherung)", "τ_Q = κ·Q_max / A", `${fmt(sec.kappa)}·${fmt(mx.Q)} / ${fmt(sec.A)}`, tauQ, "MPa", "κ je Querschnitt"));
    add("belastung", step(`B-F-${caseId}`, "Größte Durchbiegung", mx.fw, mx.sw, mx.w, "mm", bc.ref));
    add("nachweis", step("N-FZUL", "Zulässige Durchbiegung", `f_zul = L / ${fmt(inp.fDiv)}`, `${fmt(L)} / ${fmt(inp.fDiv)}`, res.fzul, "mm", "Vorgabe"));
  }
  // Längskraft
  if (N !== 0) {
    if (inp.mode === "single" && inp.kind === "zug" && inp.sub === "Z2") {
      const qG = rho * G_ACC * sec.A * 1e-9; // N/mm
      const Nmax = N + qG * L;
      sigN = Nmax / sec.A;
      const dL = N * L / (E * sec.A) + qG * L * L / (2 * E * sec.A);
      res.axial = { N, qG, Nmax, dL, N_x: (x) => N + qG * (L - x), u_x: (x) => (N * x + qG * (L * x - x * x / 2)) / (E * sec.A) };
      add("belastung", step("Z-QG", "Eigengewicht je Länge", "q_G = ρ·g·A", `${fmt(rho)}·${G_ACC}·${fmt(sec.A)}·10⁻⁹`, qG, "N/mm"));
      add("belastung", step("Z-NMAX", "Größte Normalkraft (Einspannung)", "N_max = F + q_G·L", `${fmt(N)} + ${fmt(qG)}·${fmt(L)}`, Nmax, "N"));
      add("belastung", step("Z-SIG2", "Größte Zugspannung mit Eigengewicht (Einspannung)", "σ_N,max = N_max / A", `${fmt(Nmax)} / ${fmt(sec.A)}`, sigN, "MPa"));
      add("belastung", step("Z-DL2", "Längenänderung mit Eigengewicht", "ΔL = ΔL_F + ΔL_G = F·L/(E·A) + q_G·L²/(2·E·A)", `${fmt(N)}·${fmt(L)}/(${fmt(E)}·${fmt(sec.A)}) + ${fmt(qG)}·${fmt(L)}²/(2·${fmt(E)}·${fmt(sec.A)})`, dL, "mm", "Integration σ(x)/E"));
    } else {
      sigN = N / sec.A;
      const dL = N * L / (E * sec.A);
      res.axial = { N, qG: 0, Nmax: N, dL, N_x: () => N, u_x: (x) => N * x / (E * sec.A) };
      add("belastung", step("Z-SIG", N > 0 ? "Zugspannung" : "Druckspannung", "σ_N = F_N / A", `${fmt(N)} / ${fmt(sec.A)}`, sigN, "MPa"));
      add("belastung", step("Z-DL", "Längenänderung", "ΔL = F_N·L / (E·A)", `${fmt(N)}·${fmt(L)} / (${fmt(E)}·${fmt(sec.A)})`, dL, "mm"));
    }
  }
  // Knicken
  if (N < 0 && eulerCase !== null) {
    const beta = EULER_BETA[eulerCase], Lk = beta * L, lam = Lk / sec.i;
    const lamT = Rp ? Math.PI * Math.sqrt(2 * E / Rp) : null;
    add("belastung", step("K-LK", "Knicklänge", "L_k = β·L", `β = ${fmt(beta)} (Eulerfall ${eulerCase}): ${fmt(beta)}·${fmt(L)}`, Lk, "mm", inp.mode === "combined" ? "aus der Lagerung abgeleitet" : "Eulerfall gewählt"));
    add("belastung", step("K-LAM", "Schlankheitsgrad", "λ = L_k / i", `${fmt(Lk)} / ${fmt(sec.i)}`, lam, "–"));
    if (lamT) add("belastung", step("K-LAMT", "Übergangsschlankheit Johnson/Euler", "λ_T = π·√(2E / R_p)", `π·√(2·${fmt(E)} / ${fmt(Rp)})`, lamT, "–", "Johnson-Parabel tangiert Euler bei σ = R_p/2"));
    let sk = Math.PI ** 2 * E / (lam * lam), model: "Euler" | "Johnson" = "Euler";
    if (lamT && Rp && lam < lamT) {
      sk = Rp - (Rp * Rp / (4 * Math.PI ** 2 * E)) * lam * lam; model = "Johnson";
      add("belastung", step("K-SKJ", "Knickspannung (unelastisch, Johnson)", "σ_k = R_p − R_p²·λ² / (4π²E)", `${fmt(Rp)} − ${fmt(Rp)}²·${fmt(lam)}² / (4π²·${fmt(E)})`, sk, "MPa", "Johnson-Parabel"));
    } else add("belastung", step("K-SKE", "Knickspannung (Euler)", "σ_k = π²·E / λ²", `π²·${fmt(E)} / ${fmt(lam)}²`, sk, "MPa", "Ashby App. A.5"));
    if (!Rp) res.warnings.push("Knicken ohne R_p: nur Euler, unelastischer Bereich nicht abgedeckt");
    const Fk = sk * sec.A;
    add("belastung", step("K-FK", "Knicklast", "F_k = σ_k·A", `${fmt(sk)}·${fmt(sec.A)}`, Fk, "N"));
    res.buck = { eulerCase, beta, Lk, lambda: lam, lambdaT: lamT, sigmaK: sk, Fk, model, SK: Fk / Math.abs(N), Rp, E, sigmaD: Math.abs(N) / sec.A };
    add("nachweis", step("N-SK", "Sicherheit gegen Knicken", "S_K = F_k / |F_N|", `${fmt(Fk)} / ${fmt(Math.abs(N))}`, res.buck.SK, "–"));
  }
  // Torsion
  if (Tm !== 0) {
    const twoSided = inp.mode === "single" && inp.sub === "T2";
    const Teff = twoSided ? Tm / 2 : Tm;
    tauT = Teff / sec.Wt;
    const theta = (twoSided ? Tm * L / (4 * Gm * sec.K) : Tm * L / (Gm * sec.K)) * 180 / Math.PI;
    res.tors = {
      T: Tm, Teff, theta, twoSided,
      T_x: (x) => (twoSided ? (x < L / 2 ? Tm / 2 : -Tm / 2) : Tm),
      phi_x: (x) => (twoSided ? (Tm / 2) * Math.min(x, L - x) : Tm * x) / (Gm * sec.K) * 180 / Math.PI,
    };
    if (twoSided) add("belastung", step("T-TA", "Einspannmoment je Seite", "M_t,A = M_t,B = M_t / 2", `${fmt(Tm)} / 2`, Teff, "N·mm", "Verträglichkeit, gleiche Steifigkeit beider Hälften"));
    add("belastung", step("T-TAU", "Torsionsspannung", "τ_t = M_t,max / Wₜ  (einseitig M_t, beidseitig M_t,A)", `${fmt(Teff)} / ${fmt(sec.Wt)}`, tauT, "MPa", "Ashby App. A.6"));
    add("belastung", step(twoSided ? "T-PHI2" : "T-PHI1", twoSided ? "Verdrehwinkel in Feldmitte" : "Verdrehwinkel am freien Ende", twoSided ? "φ_Mitte = M_t,A·(L/2) / (G·Iₜ) = M_t·L / (4·G·Iₜ)" : "φ_Ende = M_t·L / (G·Iₜ)", `${fmt(Tm)}·${fmt(L)} / (${twoSided ? "4·" : ""}${fmt(Gm)}·${fmt(sec.K)})`, theta, "°", "Ashby App. A.6"));
  }
  const sigma = Math.abs(sigmaB) + Math.abs(sigN);
  const sv = Math.sqrt(sigma * sigma + 3 * tauT * tauT);
  add("nachweis", step("N-SV", "Vergleichsspannung (GEH, Randfaser)", "σ_v = √(σ² + 3τ_t²),  σ = |σ_b| + |σ_N|", `√(${fmt(sigma)}² + 3·${fmt(tauT)}²)`, sv, "MPa", "Gestaltänderungsenergiehypothese"));
  Object.assign(res, { sigmaB, sigmaN: sigN, tauT, tauQ, sigmaV: sv });

  // Nachweise
  const checks: Check[] = [];
  const mk = (key: Check["key"], label: string, S_: number | null, req: number, text: string): Check => ({ key, label, S: S_, req, u: S_ ? req / S_ : null, text });
  if (!S.brittle) {
    if (Rp) { const SF = Rp / sv; checks.push(mk("fliessen", "Fließen", SF, inp.SFreq, `R_p / σ_v = ${fmt(Rp)} / ${fmt(sv, 3)}`)); add("nachweis", step("N-SF", "Sicherheit gegen Fließen", "S_F = R_p / σ_v", `${fmt(Rp)} / ${fmt(sv)}`, SF, "–")); }
    else checks.push(mk("fliessen", "Fließen", null, inp.SFreq, S.Rp?.warn || "R_p nicht belegt"));
  }
  if (Rm && S.Rm) { const SB = Rm / sv; checks.push(mk("bruch", "Bruch", SB, inp.SBreq, `${DV_SYMBOL[S.Rm.prop]} / σ_v = ${fmt(Rm)} / ${fmt(sv, 3)}`)); add("nachweis", step("N-SB", "Sicherheit gegen Bruch", `S_B = ${DV_SYMBOL[S.Rm.prop]} / σ_v`, `${fmt(Rm)} / ${fmt(sv)}`, SB, "–")); }
  else checks.push(mk("bruch", "Bruch", null, inp.SBreq, S.Rm?.warn || "R_m nicht belegt"));
  if (res.buck) checks.push(mk("knicken", "Knicken", res.buck.SK, inp.SKreq, `F_k / F = ${fmt(res.buck.Fk, 3)} / ${fmt(Math.abs(N), 3)} N`));
  if (res.bend && res.fzul) checks.push(mk("durchbiegung", "Durchbiegung", res.fzul / res.bend.w, 1, `f = ${fmt(res.bend.w, 3)} mm ≤ ${fmt(res.fzul, 3)} mm`));
  res.checks = checks;
  const valid = checks.filter((c) => c.u !== null);
  res.util = valid.length ? Math.max(...valid.map((c) => c.u as number)) : Infinity;
  res.governing = valid.length ? [...valid].sort((x, y) => (y.u as number) - (x.u as number))[0]?.label ?? null : null;
  res.incomplete = checks.filter((c) => c.u === null).map((c) => c.label);

  // Kennwerte
  const K: Kpi[] = [];
  const kp = (key: string, label: string, s: string, value: number, unit: string, result = false, main = false) => K.push(main ? { key, label, sym: s, value, unit, result, main } : { key, label, sym: s, value, unit, result });
  kp("A", "Fläche", "A", sec.A, "mm²"); kp("m", "Masse", "m", res.mass, "kg");
  if (res.bend || inp.mode === "combined") { kp("I", "Flächenträgheitsmoment", "I", sec.I, "mm⁴"); kp("W", "Widerstandsmoment", "W", sec.W, "mm³"); }
  if (res.tors) { kp("K", "Torsionsträgheitsmoment", "Iₜ", sec.K, "mm⁴"); kp("Wt", "Torsionswiderstand", "Wₜ", sec.Wt, "mm³"); }
  if (res.buck) { kp("i", "Trägheitsradius", "i", sec.i, "mm"); kp("lambda", "Schlankheitsgrad", "λ", res.buck.lambda, "–"); }
  if (res.bend) kp("sigmaB", "Biegespannung", "σ_b", sigmaB, "MPa", true);
  if (res.axial) kp("sigmaN", N > 0 ? "Zugspannung" : "Druckspannung", "σ_N", sigN, "MPa", true);
  if (res.tors) kp("tauT", "Torsionsspannung", "τ_t", tauT, "MPa", true);
  kp("sigmaV", "Vergleichsspannung", "σ_v", sv, "MPa", true, true);
  if (res.bend) kp("f", "Durchbiegung", "f", res.bend.w, "mm", true);
  if (res.axial) kp("dL", "Längenänderung", "ΔL", res.axial.dL, "mm", true);
  if (res.tors) kp("theta", res.tors.twoSided ? "Verdrehwinkel in Feldmitte" : "Verdrehwinkel am freien Ende", res.tors.twoSided ? "φ_Mitte" : "φ_Ende", res.tors.theta, "°", true);
  if (res.buck) kp("Fk", "Knicklast", "F_k", res.buck.Fk / 1000, "kN", true);
  res.kpis = K;
  return res;
}

/** Bezeichnung der Querschnittsmaße für Überschriften. */
export function dimsLabel(secType: SecType, dims: Dims): string {
  return `${SECTIONS[secType].label} ${SECTIONS[secType].fields.map(([k]) => fmt(dims[k] ?? NaN)).join(" × ")} mm`;
}

export { BUCKLING_CASES };
