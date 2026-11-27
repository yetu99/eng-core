/**
 * Chemisches Gleichgewicht (Modul chemie, v1.4, CH-G01 bis CH-G06): Gleichgewichtskonstante aus Δ_rG°, van't Hoff,
 * Temperaturfunktion nach PHREEQC, Reaktionsquotient und Richtung, Gleichgewichtszusammensetzung einer Reaktion
 * (ideale Gase bei Gesamtdruck p oder ideal verdünnte Lösung im Volumen V, reine Phasen mit Aktivität 1, CH-E19).
 * SI: J/mol, K, Pa, mol, m³; Standard p° = 10⁵ Pa, c° = 1000 mol/m³.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { C_STD, P_STD, R_GAS, T_STD } from "./constants";

const f6 = (x: number): string => fmt(x, 6);
const LN10 = Math.LN10;

/** CH-G01 K = exp(−Δ_rG° / (R·T)), log K = −Δ_rG° / (R·T·ln 10). */
export function eqConstant(dG: number, T: number): { K: number; logK: number; step: CalcStep } {
  if (!(T > 0) || !Number.isFinite(dG)) throw new Error("T > 0 und Δ_rG° endlich");
  const logK = -dG / (R_GAS * T * LN10);
  return { K: Math.pow(10, logK), logK, step: step("CH-G01", "Gleichgewichtskonstante", "K = exp(−Δ_rG° / (R · T)), lg K = −Δ_rG° / (R · T · ln 10)", `lg K = −${f6(dG / 1000)} kJ/mol / (8,314462618 J/(mol·K) · ${f6(T)} K · ln 10)`, logK, "1") };
}

/** CH-G02 van't Hoff mit konstantem Δ_rH°: lg K(T) = lg K(T₁) − Δ_rH° / (R · ln 10) · (1/T − 1/T₁). */
export function vantHoff(logK1: number, dH: number, T1: number, T: number): { logK: number; step: CalcStep } {
  if (!(T > 0 && T1 > 0) || !Number.isFinite(logK1) || !Number.isFinite(dH)) throw new Error("T > 0, lg K und Δ_rH° endlich");
  const logK = logK1 - (dH / (R_GAS * LN10)) * (1 / T - 1 / T1);
  return { logK, step: step("CH-G02", "Temperaturabhängigkeit (van't Hoff, Δ_rH° konstant)", "lg K(T) = lg K(T₁) − Δ_rH° / (R · ln 10) · (1/T − 1/T₁)", `lg K = ${f6(logK1)} − ${f6(dH / 1000)} kJ/mol / (R · ln 10) · (1/${f6(T)} K − 1/${f6(T1)} K)`, logK, "1") };
}

/** CH-G03 Temperaturfunktion (PHREEQC): lg K = A₁ + A₂·T + A₃/T + A₄·lg T + A₅/T² + A₆·T². */
export function analyticLogK(a: readonly number[], T: number): { logK: number; step: CalcStep } {
  if (!(T > 0) || a.length < 1 || a.length > 6 || a.some((x) => !Number.isFinite(x))) throw new Error("T > 0 und bis zu 6 endliche Koeffizienten");
  const A = [...a, 0, 0, 0, 0, 0, 0].slice(0, 6) as [number, number, number, number, number, number];
  const logK = A[0] + A[1] * T + A[2] / T + A[3] * Math.log10(T) + A[4] / (T * T) + A[5] * T * T;
  return { logK, step: step("CH-G03", "Temperaturfunktion (PHREEQC)", "lg K = A₁ + A₂ · T + A₃ / T + A₄ · lg T + A₅ / T² + A₆ · T²", `A = (${A.map((x) => fmt(x, 8)).join("; ")}), T = ${f6(T)} K`, logK, "1", "Parkhurst, Appelo: PHREEQC Version 3, USGS TM 6-A43 (2013)") };
}

/** Gleichgewichtskonstante aus einer Tabellenzeile (ch_equilibria) bei T: Temperaturfunktion, sonst van't Hoff, sonst nur 25 °C. */
export function logKAt(e: { log_k_25: number; delta_h_J_mol: number | null; analytic: readonly number[] | null }, T: number): { logK: number; method: "tabelle" | "analytisch" | "vant_hoff"; steps: CalcStep[] } {
  if (Math.abs(T - T_STD) < 1e-9) return { logK: e.log_k_25, method: "tabelle", steps: [] };
  if (e.analytic && e.analytic.length) { const r = analyticLogK(e.analytic, T); return { logK: r.logK, method: "analytisch", steps: [r.step] }; }
  if (e.delta_h_J_mol !== null) { const r = vantHoff(e.log_k_25, e.delta_h_J_mol, T_STD, T); return { logK: r.logK, method: "vant_hoff", steps: [r.step] }; }
  throw new Error("keine Temperaturabhängigkeit bekannt, nur 25 °C");
}

export interface QTerm { label: string; nu: number; activity: number }
/** CH-G04 Reaktionsquotient Q = Π a_i^ν_i (ν > 0 Produkte, ν < 0 Edukte) und Richtung gegen K; CH-G05 Δ_rG = Δ_rG° + R·T·ln Q. */
export function reactionQuotient(terms: readonly QTerm[], K: number, T: number): { Q: number; lnQ: number; direction: "vorwaerts" | "rueckwaerts" | "gleichgewicht"; dG: number; steps: CalcStep[] } {
  if (!terms.length || !(K > 0) || !(T > 0)) throw new Error("Terme, K > 0 und T > 0 angeben");
  if (terms.some((t) => !(t.activity > 0) || !Number.isFinite(t.nu))) throw new Error("Aktivitäten müssen größer 0 sein");
  const lnQ = terms.reduce((s, t) => s + t.nu * Math.log(t.activity), 0);
  const Q = Math.exp(lnQ), d = lnQ - Math.log(K);
  const direction = Math.abs(d) < 1e-9 ? "gleichgewicht" : d < 0 ? "vorwaerts" : "rueckwaerts";
  const dG = R_GAS * T * d;
  return { Q, lnQ, direction, dG, steps: [
    step("CH-G04", "Reaktionsquotient und Richtung", "Q = Π a_i^ν_i; Q < K: läuft vorwärts, Q > K: rückwärts", `Q = ${terms.map((t) => `${f6(t.activity)}^${t.nu}`).join(" · ")} = ${f6(Q)}; K = ${f6(K)} → ${direction === "vorwaerts" ? "vorwärts" : direction === "rueckwaerts" ? "rückwärts" : "Gleichgewicht"}`, Q, "1"),
    step("CH-G05", "Freie Reaktionsenthalpie bei Q", "Δ_rG = Δ_rG° + R · T · ln Q = R · T · ln(Q / K)", `Δ_rG = 8,314462618 J/(mol·K) · ${f6(T)} K · ln(${f6(Q)} / ${f6(K)})`, dG, "J/mol"),
  ] };
}

export type EqKind = "gas" | "geloest" | "rein";
export interface EqSpecies { label: string; nu: number; n0: number; kind: EqKind }
export interface EqResult { ok: boolean; error: string | null; xi: number | null; n: number[]; x: number[]; activity: number[]; limited: string | null; steps: CalcStep[] }

/**
 * CH-G06 Gleichgewichtszusammensetzung einer Reaktion: ξ mit Q(ξ) = K, n_i = n_i,0 + ν_i · ξ.
 * mode gas: a_i = x_i · p / p° (nur Gase zählen zu n_ges); mode loesung: a_i = n_i / (V · c°); reine Phasen a = 1.
 * Bisektion über ξ (Q steigt monoton mit ξ); wird ein reiner Stoff vorher aufgebraucht, endet die Reaktion dort (limitiert).
 */
export function equilibriumExtent(species: readonly EqSpecies[], K: number, cond: { mode: "gas"; p: number } | { mode: "loesung"; V: number }): EqResult {
  const steps: CalcStep[] = [];
  const fail = (e: string): EqResult => ({ ok: false, error: e, xi: null, n: [], x: [], activity: [], limited: null, steps });
  if (!(K > 0) || !Number.isFinite(K)) return fail("K muss größer 0 sein");
  if (!species.some((s) => s.nu > 0) || !species.some((s) => s.nu < 0)) return fail("Edukte (ν < 0) und Produkte (ν > 0) angeben");
  if (species.some((s) => !(s.n0 >= 0) || !Number.isFinite(s.nu) || s.nu === 0)) return fail("n₀ ≥ 0 und ν ≠ 0");
  if (cond.mode === "gas" && !(cond.p > 0)) return fail("p muss größer 0 sein");
  if (cond.mode === "loesung" && !(cond.V > 0)) return fail("V muss größer 0 sein");
  const act = species.filter((s) => s.kind !== "rein");
  if (!act.length) return fail("mindestens ein Gas oder gelöster Stoff");
  if (cond.mode === "gas" && species.some((s) => s.kind === "geloest")) return fail("Gasphase: gelöste Stoffe nicht zulässig");
  if (cond.mode === "loesung" && species.some((s) => s.kind === "gas")) return fail("Lösung: Gase als gelöste Stoffe eingeben");
  // Grenzen von ξ: alle n_i ≥ 0
  let lo = -Infinity, hi = Infinity;
  for (const s of species) { const b = -s.n0 / s.nu; if (s.nu > 0) lo = Math.max(lo, b); else hi = Math.min(hi, b); }
  if (!(hi > lo)) return fail("keine Reaktion möglich: ein Edukt und ein Produkt fehlen gleichzeitig");
  const lnK = Math.log(K);
  const nOf = (xi: number) => species.map((s) => Math.max(0, s.n0 + s.nu * xi));
  const lnQ = (xi: number): number => {
    const n = nOf(xi);
    const nTot = species.reduce((t, s, i) => t + (s.kind === "gas" ? n[i]! : 0), 0);
    let r = 0;
    species.forEach((s, i) => {
      if (s.kind === "rein") return;
      const a = cond.mode === "gas" ? (n[i]! / nTot) * (cond.p / P_STD) : n[i]! / (cond.V * C_STD);
      r += s.nu * Math.log(a);
    });
    return r;
  };
  // reine Stoffe begrenzen ohne Singularität: an deren Grenze bleibt Q endlich
  const pureLimit = (xi: number) => species.some((s) => s.kind === "rein" && Math.abs(s.n0 + s.nu * xi) <= 1e-15 * Math.max(1, s.n0));
  const span = hi - lo, eps = span * 1e-15;
  let a = lo + eps, b = hi - eps;
  let limited: string | null = null;
  const fa = lnQ(a) - lnK, fb = lnQ(b) - lnK;
  let xi: number;
  if (Number.isFinite(fb) && fb < 0 && pureLimit(hi)) { xi = hi; limited = species.find((s) => s.kind === "rein" && s.nu < 0 && Math.abs(s.n0 + s.nu * hi) <= 1e-12 * Math.max(1, s.n0))?.label ?? null; }
  else if (Number.isFinite(fa) && fa > 0 && pureLimit(lo)) { xi = lo; limited = species.find((s) => s.kind === "rein" && s.nu > 0 && Math.abs(s.n0 + s.nu * lo) <= 1e-12 * Math.max(1, s.n0))?.label ?? null; }
  else {
    for (let k = 0; k < 400 && b - a > 1e-15 * Math.max(1, Math.abs(a), Math.abs(b)); k++) {
      const m = 0.5 * (a + b), fm = lnQ(m) - lnK;
      if (fm > 0) b = m; else a = m;
    }
    xi = 0.5 * (a + b);
  }
  const n = nOf(xi);
  const nTot = species.reduce((t, s, i) => t + (s.kind === "gas" ? n[i]! : 0), 0);
  const x = species.map((s, i) => (s.kind === "gas" ? n[i]! / nTot : 0));
  const activity = species.map((s, i) => (s.kind === "rein" ? 1 : cond.mode === "gas" ? x[i]! * (cond.p / P_STD) : n[i]! / (cond.V * C_STD)));
  steps.push(step("CH-G06", "Gleichgewichtszusammensetzung", "n_i = n_i,0 + ν_i · ξ; Π a_i^ν_i = K mit a_i = x_i · p / p° (Gas), n_i / (V · c°) (gelöst), 1 (rein); Bisektion in ξ",
    `K = ${f6(K)}, ${cond.mode === "gas" ? `p = ${f6(cond.p)} Pa` : `V = ${f6(cond.V)} m³`}, ξ ∈ [${f6(lo)}; ${f6(hi)}] mol → ${species.map((s, i) => `n(${s.label}) = ${f6(n[i]!)} mol`).join(", ")}${limited ? `; ${limited} aufgebraucht` : ""}`, xi, "mol"));
  return { ok: true, error: null, xi, n, x, activity, limited, steps };
}
