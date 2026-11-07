/**
 * Durchflussmessung mit Venturirohr und Blende (Modul fluid, RH b, eng-core 0.13.0, Entscheidungen R19, R20).
 * Eigene Umsetzung ohne Normtext, Normen nur als Fundstelle und Gültigkeitsgrenze (E12):
 *   V̇ = C/√(1 − β⁴)·ε·(π·d²/4)·√(2·Δp/ρ), ε = 1 für Flüssigkeiten (ISO 5167-1 Gl. (1), (2)); Gase ausgeschlossen.
 *   Venturi: C je Bauart aus fd_flowmeter (ISO 5167-4 Abschn. 5.5.2 bis 5.5.4) mit Gültigkeit D, β, Re_D; C von Hand möglich.
 *   Blende: C nach Reader-Harris/Gallagher (ISO 5167-2 Gl. (4)) mit Druckentnahme Eck, D und D/2 oder Flansch und Zusatzterm
 *   für D < 71,12 mm; Anwendungsgrenzen ISO 5167-2 Abschn. 5.3.1 (S. 19). V̇ aus Δp über Bisektion (C hängt von Re_D ab).
 *   Bleibender Druckverlust Blende ISO 5167-2 Gl. (7), Venturi Δϖ = ξ·Δp mit ξ von Hand (ISO 5167-4 Gl. (3), Definition).
 *   Ersatz-ζ für den Strang ζ = Δϖ/(ρ·v_D²/2), bezogen auf das Rohr (Roloff Gl. 18.6).
 * Einheiten SI (m, Pa, m³/s); Re_D = v_D·D/ν = 4·V̇/(π·D·ν).
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace } from "../trace";
import type { FdFlowmeter, FdRepo } from "./fdData";
import type { FluidCheck, FluidKpi } from "./line";

export type OrificeTaps = "eck" | "D" | "flansch";
export type MeterDevice =
  /** Venturi nach Bauart (variant aus fd_flowmeter) oder mit C von Hand (variant null, C gesetzt); ξ von Hand oder null. */
  | { kind: "venturi"; variant: string | null; C: number | null; xi: number | null }
  | { kind: "blende"; taps: OrificeTaps };
export interface MeterInput {
  label?: string;
  device: MeterDevice;
  /** Rohrinnendurchmesser D und Drosseldurchmesser d in m. */
  D: number; d: number;
  /** Dichte (kg/m³) und kinematische Viskosität (m²/s) des Fluids. */
  rho: number; nu: number;
  /** Gegeben ist der Wirkdruck (Volumenstrom gesucht) oder der Volumenstrom (Wirkdruck gesucht). */
  mode: { kind: "dp"; dp: number } | { kind: "Q"; Q: number };
}
export type MeterGroup = "messung" | "nachweis";
export interface MeterResult {
  beta: number; C: number; Re: number; Q: number; dp: number; dw: number | null; zeta: number | null; vD: number;
  row: FdFlowmeter | null; residual: number | null;
  checks: FluidCheck[]; kpis: FluidKpi[]; trace: Trace<MeterGroup>; errors: string[]; warnings: string[];
}

const REF1 = "ISO 5167-1:2023 Gl. (1), (2) (Q228)", REF2 = "ISO 5167-2:2023 (Q229)", REF4 = "ISO 5167-4:2023 (Q230)";
const TAPS_TXT: Record<OrificeTaps, string> = { eck: "Eck-Druckentnahmen", D: "D- und D/2-Druckentnahmen", flansch: "Flansch-Druckentnahmen" };

/** Durchflusskoeffizient der Blende nach Reader-Harris/Gallagher, D in m (ISO 5167-2 Gl. (4)). */
export function orificeC(beta: number, Re: number, D: number, taps: OrificeTaps): { C: number; A: number; M2: number; L1: number; L2: number } {
  const Dmm = D * 1e3;
  const [L1, L2] = taps === "eck" ? [0, 0] : taps === "D" ? [1, 0.47] : [25.4 / Dmm, 25.4 / Dmm];
  const A = Math.pow(19000 * beta / Re, 0.8), M2 = 2 * L2 / (1 - beta);
  let C = 0.5961 + 0.0261 * beta ** 2 - 0.216 * beta ** 8 + 0.000521 * Math.pow(1e6 * beta / Re, 0.7)
    + (0.0188 + 0.0063 * A) * beta ** 3.5 * Math.pow(1e6 / Re, 0.3)
    + (0.043 + 0.080 * Math.exp(-10 * L1) - 0.123 * Math.exp(-7 * L1)) * (1 - 0.11 * A) * beta ** 4 / (1 - beta ** 4)
    - 0.031 * (M2 - 0.8 * Math.pow(M2, 1.1)) * Math.pow(beta, 1.3);
  if (Dmm < 71.12) C += 0.011 * (0.75 - beta) * (2.8 - Dmm / 25.4);
  return { C, A, M2, L1, L2 };
}
/** Volumenstrom aus Wirkdruck (ε = 1). */
export const meterQ = (C: number, beta: number, d: number, dp: number, rho: number): number => C / Math.sqrt(1 - beta ** 4) * (Math.PI * d * d / 4) * Math.sqrt(2 * dp / rho);
/** Wirkdruck aus Volumenstrom (ε = 1). */
export const meterDp = (C: number, beta: number, d: number, Q: number, rho: number): number => rho / 2 * (Q * Math.sqrt(1 - beta ** 4) / (C * Math.PI * d * d / 4)) ** 2;
/** Bleibender Druckverlust der Blende (ISO 5167-2 Gl. (7)). */
export const orificeLoss = (C: number, beta: number, dp: number): number => {
  const s = Math.sqrt(1 - beta ** 4 * (1 - C * C));
  return (s - C * beta * beta) / (s + C * beta * beta) * dp;
};
const venturiRow = (rows: readonly FdFlowmeter[], Re: number): FdFlowmeter | null =>
  rows.find((r) => Re >= r.re_min && (r.re_max === null || Re <= r.re_max) && !(r.re_max === null && Re === r.re_min && rows.some((q) => q.re_max === Re))) ?? null;

export function computeMeter(fd: FdRepo, inp: MeterInput): MeterResult {
  const errors: string[] = [], warnings: string[] = [];
  const G: Trace<MeterGroup> = {}; const add = (g: MeterGroup, s: CalcStep) => { (G[g] ??= []).push(s); };
  const { D, d, rho, nu } = inp;
  const fail = (): MeterResult => ({ beta: NaN, C: NaN, Re: NaN, Q: NaN, dp: NaN, dw: null, zeta: null, vD: NaN, row: null, residual: null, checks: [], kpis: [], trace: G, errors, warnings });
  if (!(D > 0 && d > 0 && d < D)) errors.push("Messung: 0 < d < D nötig.");
  if (!(rho > 0 && nu > 0)) errors.push("Messung: Dichte und Viskosität müssen größer als 0 sein.");
  if (inp.mode.kind === "dp" && !(inp.mode.dp > 0)) errors.push("Messung: Wirkdruck muss größer als 0 sein.");
  if (inp.mode.kind === "Q" && !(inp.mode.Q > 0)) errors.push("Messung: Volumenstrom muss größer als 0 sein.");
  const dev = inp.device;
  let rows: FdFlowmeter[] = [];
  if (dev.kind === "venturi") {
    if (dev.variant !== null) { rows = fd.flowmeters.filter((r) => r.kind === "Venturi" && r.variant === dev.variant).slice().sort((a, b) => a.re_min - b.re_min); if (!rows.length) errors.push(`Venturi-Bauart „${dev.variant}“ nicht in den Fachdaten (fd 1.1).`); }
    else if (!(dev.C !== null && dev.C > 0 && dev.C <= 1.05)) errors.push("Venturi mit C von Hand: 0 < C ≤ 1,05 eingeben.");
    if (dev.xi !== null && !(dev.xi >= 0 && dev.xi < 1)) errors.push("Venturi: relativer Druckverlust ξ zwischen 0 und 1 eingeben.");
  }
  if (errors.length) return fail();
  const beta = d / D, At = Math.PI * d * d / 4, AD = Math.PI * D * D / 4;
  const ReOf = (Q: number) => 4 * Q / (Math.PI * D * nu);
  const tag = inp.label?.trim() ? `${inp.label.trim()}: ` : "";
  add("messung", step("RH-M-BETA", "Durchmesserverhältnis", "β = d/D", `${tag}β = ${fmt(d, 6)}/${fmt(D, 6)}`, beta, "1", REF1));
  // C als Funktion von Re_D
  let row: FdFlowmeter | null = null;
  const Cof = (Re: number): number => {
    if (dev.kind === "blende") return orificeC(beta, Re, D, dev.taps).C;
    if (dev.variant === null) return dev.C!;
    return (venturiRow(rows, Re) ?? (Re < rows[0]!.re_min ? rows[0]! : rows[rows.length - 1]!)).c;
  };
  let Q: number, dp: number, residual: number | null = null;
  if (inp.mode.kind === "Q") { Q = inp.mode.Q; dp = meterDp(Cof(ReOf(Q)), beta, d, Q, rho); }
  else {
    dp = inp.mode.dp;
    const g = (q: number) => meterDp(Cof(ReOf(q)), beta, d, q, rho) - dp;
    const qIdeal = meterQ(1, beta, d, dp, rho);
    let lo = 0, hi = qIdeal * 1.2;
    for (let k = 0; k < BISECT; k++) { const m = (lo + hi) / 2; if (g(m) < 0) lo = m; else hi = m; }
    Q = (lo + hi) / 2; residual = g(Q);
    add("messung", step("RH-M-QIT", "Volumenstrom aus Wirkdruck (C hängt von Re_D ab)", "V̇ mit Δp(V̇, C(Re_D)) = Δp_gemessen (Bisektion, 100 Schritte)",
      `${tag}Δp = ${fmt(dp, 6)} Pa, Restfehler ${fmt(residual, 3)} Pa`, Q, "m³/s", "Verfahren (R19)"));
  }
  const Re = ReOf(Q), vD = Q / AD, C = Cof(Re);
  if (dev.kind === "blende") {
    const o = orificeC(beta, Re, D, dev.taps);
    add("messung", step("RH-M-CB", "Durchflusskoeffizient Blende (Reader-Harris/Gallagher)",
      "C = 0,5961 + 0,0261β² − 0,216β⁸ + 0,000521(10⁶β/Re_D)^0,7 + (0,0188 + 0,0063A)β^3,5(10⁶/Re_D)^0,3 + (0,043 + 0,080e^(−10L₁) − 0,123e^(−7L₁))(1 − 0,11A)β⁴/(1 − β⁴) − 0,031(M′₂ − 0,8M′₂^1,1)β^1,3 [+ 0,011(0,75 − β)(2,8 − D/25,4) für D < 71,12 mm]; A = (19 000β/Re_D)^0,8; M′₂ = 2L′₂/(1 − β)",
      `${tag}${TAPS_TXT[dev.taps]}: β = ${fmt(beta, 6)}, Re_D = ${fmt(Re, 6)}, D = ${fmt(D * 1e3, 6)} mm, L₁ = ${fmt(o.L1, 6)}, L′₂ = ${fmt(o.L2, 6)}, A = ${fmt(o.A, 6)}, M′₂ = ${fmt(o.M2, 6)}`, C, "1", `${REF2} Abschn. 5.3.2.1 Gl. (4)`));
  } else if (dev.variant === null) {
    add("messung", step("RH-M-CV", "Durchflusskoeffizient Venturi", "C aus fd_flowmeter je Bauart und Re_D-Bereich, sonst Eingabe", `${tag}C von Hand = ${fmt(C, 6)}`, C, "1", "Eingabe"));
  } else {
    row = venturiRow(rows, Re);
    const r = row ?? (Re < rows[0]!.re_min ? rows[0]! : rows[rows.length - 1]!);
    add("messung", step("RH-M-CV", "Durchflusskoeffizient Venturi", "C aus fd_flowmeter je Bauart und Re_D-Bereich, sonst Eingabe",
      `${tag}${r.id} ${r.variant}${r.remark ? ` (${r.remark})` : ""}: C = ${fmt(r.c, 6)} bei Re_D = ${fmt(Re, 6)}`, r.c, "1", `${r.source_locator} (${r.source_id})`));
  }
  add("messung", step("RH-M-Q", "Volumenstrom (Wirkdruckverfahren)", "V̇ = C/√(1 − β⁴)·ε·(π·d²/4)·√(2·Δp/ρ), ε = 1 (Flüssigkeit)",
    `${tag}V̇ = ${fmt(C, 6)}/√(1 − ${fmt(beta, 6)}⁴)·1·(π·${fmt(d, 6)}²/4)·√(2·${fmt(dp, 6)}/${fmt(rho, 6)})`, meterQ(C, beta, d, dp, rho), "m³/s", REF1));
  if (inp.mode.kind === "Q")
    add("messung", step("RH-M-DP", "Wirkdruck", "Δp = (ρ/2)·[V̇·√(1 − β⁴)/(C·ε·π·d²/4)]²", `${tag}Δp = (${fmt(rho, 6)}/2)·[${fmt(Q, 6)}·√(1 − ${fmt(beta, 6)}⁴)/(${fmt(C, 6)}·1·π·${fmt(d, 6)}²/4)]²`, dp, "Pa", `${REF1}, umgestellt`));
  let dw: number | null = null;
  if (dev.kind === "blende") {
    dw = orificeLoss(C, beta, dp);
    add("messung", step("RH-M-DW", "Bleibender Druckverlust Blende", "Δϖ = [√(1 − β⁴(1 − C²)) − C·β²]/[√(1 − β⁴(1 − C²)) + C·β²]·Δp",
      `${tag}Δϖ = [√(1 − ${fmt(beta, 6)}⁴(1 − ${fmt(C, 6)}²)) − ${fmt(C, 6)}·${fmt(beta, 6)}²]/[… + …]·${fmt(dp, 6)}`, dw, "Pa", `${REF2} Abschn. 5.4 Gl. (7)`));
  } else if (dev.xi !== null) {
    dw = dev.xi * dp;
    add("messung", step("RH-M-DWV", "Bleibender Druckverlust Venturi", "Δϖ = ξ·Δp (ξ von Hand)", `${tag}Δϖ = ${fmt(dev.xi, 6)}·${fmt(dp, 6)}`, dw, "Pa", `${REF4} Abschn. 5.9.2 Gl. (3) (Definition)`));
  }
  let zeta: number | null = null;
  if (dw !== null) {
    zeta = dw / (rho * vD * vD / 2);
    add("messung", step("RH-M-ZETA", "Ersatz-Widerstandszahl für den Strang", "ζ = Δϖ/(ρ·v_D²/2), v_D = V̇/(π·D²/4)", `${tag}ζ = ${fmt(dw, 6)}/(${fmt(rho, 6)}·${fmt(vD, 6)}²/2)`, zeta, "1", "Roloff 27 Gl. 18.6 (umgestellt)"));
  }
  // Gültigkeit
  const checks: FluidCheck[] = [];
  let ok: boolean, txt: string, ref: string;
  if (dev.kind === "blende") {
    const Dmm = D * 1e3, dmm = d * 1e3;
    const reMin = dev.taps === "flansch" ? Math.max(5000, 170 * beta * beta * Dmm) : beta <= 0.56 ? 5000 : 16000 * beta * beta;
    ok = dmm >= 12.5 && Dmm >= 50 && Dmm <= 1000 && beta >= 0.1 && beta <= 0.75 && Re >= reMin;
    txt = `d = ${fmt(dmm)} mm (≥ 12,5), D = ${fmt(Dmm)} mm (50 bis 1 000), β = ${fmt(beta, 4)} (0,1 bis 0,75), Re_D = ${fmt(Re)} (≥ ${fmt(reMin)})`;
    ref = `${REF2} Abschn. 5.3.1 (S. 19)`;
  } else if (dev.variant === null) { ok = true; txt = "C von Hand: keine Normgrenzen geprüft"; ref = "Eingabe"; }
  else {
    const r = row ?? (Re < rows[0]!.re_min ? rows[0]! : rows[rows.length - 1]!), Dmm = D * 1e3;
    ok = row !== null && Dmm >= r.d_min_mm && Dmm <= r.d_max_mm && beta >= r.beta_min && beta <= r.beta_max;
    txt = `D = ${fmt(Dmm)} mm (${fmt(r.d_min_mm)} bis ${fmt(r.d_max_mm)}), β = ${fmt(beta, 4)} (${fmt(r.beta_min)} bis ${fmt(r.beta_max)}), Re_D = ${fmt(Re)} (${fmt(r.re_min)} bis ${r.re_max === null ? "∞" : fmt(r.re_max)})`;
    ref = `${r.source_locator} (${r.source_id})`;
  }
  checks.push({ key: "messung", label: "Gültigkeit Messgerät", ok, text: txt });
  add("nachweis", step("RH-M-N", "Gültigkeit des Messgeräts", "D, β, Re_D in den Grenzen der Bauart", `${tag}${txt}: ${ok ? "eingehalten" : "nicht eingehalten"}`, ok ? 1 : 0, "1", ref));
  if (!ok) warnings.push(`Messung außerhalb der Normgrenzen (${txt}); Ergebnis nur Schätzung, Gerät kalibrieren oder C von Hand.`);
  const kpis: FluidKpi[] = [
    { key: "Q", label: "Volumenstrom", sym: "V̇", value: Q, unit: "m³/s", primary: inp.mode.kind === "dp" },
    { key: "dp", label: "Wirkdruck", sym: "Δp", value: dp, unit: "Pa", primary: inp.mode.kind === "Q" },
    { key: "C", label: "Durchflusskoeffizient", sym: "C", value: C, unit: "1", primary: true },
    { key: "beta", label: "Durchmesserverhältnis", sym: "β", value: beta, unit: "1" },
    { key: "Re", label: "Reynolds-Zahl im Rohr", sym: "Re_D", value: Re, unit: "1" },
    ...(dw !== null ? [{ key: "dw", label: "Bleibender Druckverlust", sym: "Δϖ", value: dw, unit: "Pa", primary: true }] : []),
    ...(zeta !== null ? [{ key: "zeta", label: "Ersatz-Widerstandszahl", sym: "ζ", value: zeta, unit: "1" }] : []),
  ];
  return { beta, C, Re, Q, dp, dw, zeta, vD, row, residual, checks, kpis, trace: G, errors, warnings };
}
const BISECT = 100;
