/**
 * Elektrochemie (Modul chemie, v1.2, CH-Z01 bis CH-Z13): Standardpotential aus Δ_rG°, Zellspannung und Zellreaktion
 * aus zwei Halbzellen, Nernst-Gleichung mit Aktivitäten (CH-E17), Δ_rG und K aus der Zellspannung, Regel von Luther,
 * Faraday-Gesetze, Elektrolyse (reversible und thermoneutrale Spannung, Wirkungsgrade, spezifischer Energiebedarf).
 * SI: V, J/mol, C, A, s, kg, K. Spannungsreihe von außen (Tabelle ch_potentials, CH-E16).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { F_FARADAY, R_GAS } from "./constants";

const f6 = (x: number): string => fmt(x, 6);
const FTXT = "96485,33212 C/mol";

export interface HalfTerm { formula: string; nu: number }
export interface HalfCell { id: string; couple: string; text: string; z: number; E0: number; ox: HalfTerm[]; red: HalfTerm[] }

/** Halbreaktion "a A + z e^- = b B" (Reduktion) zerlegen; e⁻ zählt nur für z. */
export function parseHalfCell(id: string, couple: string, text: string, E0: number): HalfCell {
  const sides = text.split(" = ");
  if (sides.length !== 2) throw new Error(`${id}: Halbreaktion ohne „ = “`);
  const terms = (s: string) => s.split(" + ").map((t) => { const m = /^(\d+(?:[.,]\d+)?) (.+)$/.exec(t.trim()); return m ? { formula: m[2]!, nu: Number(m[1]!.replace(",", ".")) } : { formula: t.trim(), nu: 1 }; });
  const l = terms(sides[0]!), r = terms(sides[1]!);
  const z = l.filter((t) => t.formula === "e^-").reduce((s, t) => s + t.nu, 0);
  if (!(z > 0)) throw new Error(`${id}: keine Elektronen auf der linken Seite`);
  return { id, couple, text, z, E0, ox: l.filter((t) => t.formula !== "e^-"), red: r };
}

/** CH-Z01 E° = −Δ_rG° / (z · F). */
export function potentialFromGibbs(dG: number, z: number): { E0: number; step: CalcStep } {
  if (!Number.isFinite(dG) || !(z > 0)) throw new Error("Δ_rG° endlich, z > 0");
  const E0 = -dG / (z * F_FARADAY);
  return { E0, step: step("CH-Z01", "Standardpotential aus der freien Reaktionsenthalpie", "E° = −Δ_rG° / (z · F)", `E° = −${f6(dG / 1000)} kJ/mol / (${z} · ${FTXT})`, E0, "V") };
}

/** Aktivität eines Terms: Vorgabe nach Formel, sonst 1 (reine Phasen, H₂O, Standardzustand). */
const aOf = (t: HalfTerm, act: Readonly<Record<string, number>>): number => act[t.formula] ?? 1;

/** CH-Z03 Nernst für eine Halbzelle (Reduktion): E = E° − R·T/(z·F) · ln(Π a_red^ν / Π a_ox^ν). */
export function nernst(h: HalfCell, T: number, act: Readonly<Record<string, number>> = {}): { E: number; Q: number; step: CalcStep } {
  if (!(T > 0)) throw new Error("T > 0");
  const all = [...h.ox, ...h.red];
  if (all.some((t) => !(aOf(t, act) > 0))) throw new Error("Aktivitäten müssen größer 0 sein");
  const lnQ = h.red.reduce((s, t) => s + t.nu * Math.log(aOf(t, act)), 0) - h.ox.reduce((s, t) => s + t.nu * Math.log(aOf(t, act)), 0);
  const E = h.E0 - (R_GAS * T / (h.z * F_FARADAY)) * lnQ;
  const qt = (l: HalfTerm[]) => l.map((t) => `${f6(aOf(t, act))}${t.nu === 1 ? "" : `^${t.nu}`}`).join(" · ") || "1";
  return { E, Q: Math.exp(lnQ), step: step("CH-Z03", `Nernst-Gleichung ${h.couple}`, "E = E° − R · T / (z · F) · ln(Π a_red^ν / Π a_ox^ν)", `E = ${f6(h.E0)} V − 8,314462618 J/(mol·K) · ${f6(T)} K / (${h.z} · ${FTXT}) · ln((${qt(h.red)}) / (${qt(h.ox)}))`, E, "V") };
}

export interface CellResult {
  cathode: HalfCell; anode: HalfCell; z: number; equation: string;
  /** V */ dE0: number; E_cathode: number; E_anode: number; dE: number;
  /** J/mol */ dG0: number; dG: number; K: number; logK: number; spontaneous: boolean; steps: CalcStep[];
}

const tx = (n: number, f: string) => `${n === 1 ? "" : `${Number.isInteger(n) ? n : f6(n)} `}${f}`;

/**
 * CH-Z02, CH-Z04, CH-Z05, CH-Z06: Zelle aus zwei Halbzellen. Kathode = höheres Potential (Reduktion), Anode = Oxidation.
 * Zellreaktion: Kathode · (L/z_K) + Anode rückwärts · (L/z_A), L = kgV(z_K, z_A); gleiche Stoffe auf beiden Seiten werden verrechnet.
 */
export function cell(h1: HalfCell, h2: HalfCell, T: number, act: Readonly<Record<string, number>> = {}): CellResult {
  if (h1.id === h2.id) throw new Error("zwei verschiedene Halbzellen wählen");
  const n1 = nernst(h1, T, act), n2 = nernst(h2, T, act);
  const [K_, A_, nk, na] = n1.E >= n2.E ? [h1, h2, n1, n2] : [h2, h1, n2, n1];
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const zi = Number.isInteger(K_.z) && Number.isInteger(A_.z) ? (K_.z * A_.z) / g(K_.z, A_.z) : K_.z * A_.z;
  const fk = zi / K_.z, fa = zi / A_.z;
  const net = new Map<string, number>();
  const add = (f: string, v: number) => net.set(f, (net.get(f) ?? 0) + v);
  K_.ox.forEach((t) => add(t.formula, -t.nu * fk)); K_.red.forEach((t) => add(t.formula, t.nu * fk));
  A_.red.forEach((t) => add(t.formula, -t.nu * fa)); A_.ox.forEach((t) => add(t.formula, t.nu * fa));
  const left = [...net].filter(([, v]) => v < -1e-12).map(([f, v]) => tx(-v, f)), right = [...net].filter(([, v]) => v > 1e-12).map(([f, v]) => tx(v, f));
  const equation = `${left.join(" + ")} → ${right.join(" + ")}`;
  const dE0 = K_.E0 - A_.E0, dE = nk.E - na.E;
  const dG0 = -zi * F_FARADAY * dE0, dG = -zi * F_FARADAY * dE;
  const logK = (zi * F_FARADAY * dE0) / (R_GAS * T * Math.LN10);
  const steps: CalcStep[] = [
    step("CH-Z02", "Standard-Zellspannung", "ΔE° = E°(Kathode) − E°(Anode); Kathode: höheres Potential, Reduktion", `ΔE° = ${f6(K_.E0)} V − (${f6(A_.E0)} V); Zellreaktion (z = ${zi}): ${equation}`, dE0, "V"),
    nk.step, na.step,
    step("CH-Z04", "Zellspannung", "ΔE = E(Kathode) − E(Anode)", `ΔE = ${f6(nk.E)} V − (${f6(na.E)} V)`, dE, "V"),
    step("CH-Z05", "Freie Reaktionsenthalpie aus der Zellspannung", "Δ_rG = −z · F · ΔE (Δ_rG° mit ΔE°)", `Δ_rG = −${zi} · ${FTXT} · ${f6(dE)} V`, dG, "J/mol"),
    step("CH-Z06", "Gleichgewichtskonstante der Zellreaktion", "lg K = z · F · ΔE° / (R · T · ln 10)", `lg K = ${zi} · ${FTXT} · ${f6(dE0)} V / (8,314462618 J/(mol·K) · ${f6(T)} K · ln 10)`, logK, "1"),
  ];
  return { cathode: K_, anode: A_, z: zi, equation, dE0, E_cathode: nk.E, E_anode: na.E, dE, dG0, dG, K: Math.pow(10, logK), logK, spontaneous: dE > 0, steps };
}

/** CH-Z07 Regel von Luther: E°₃ = (z₁ · E°₁ + z₂ · E°₂) / (z₁ + z₂) für A → B (z₁) und B → C (z₂). */
export function luther(z1: number, E1: number, z2: number, E2: number): { E3: number; z3: number; step: CalcStep } {
  if (!(z1 > 0 && z2 > 0) || !Number.isFinite(E1) || !Number.isFinite(E2)) throw new Error("z > 0, E° endlich");
  const z3 = z1 + z2, E3 = (z1 * E1 + z2 * E2) / z3;
  return { E3, z3, step: step("CH-Z07", "Regel von Luther", "E°₃ = (z₁ · E°₁ + z₂ · E°₂) / (z₁ + z₂)", `E°₃ = (${z1} · ${f6(E1)} V + ${z2} · ${f6(E2)} V) / ${z3}`, E3, "V") };
}

/** CH-Z08 Faraday: Q = I · t, n = η_F · Q / (z · F), m = n · M; umgekehrt t für eine Stoffmenge. */
export function faraday(inp: { I: number; t?: number; n?: number; z: number; M?: number | null; etaF?: number }): { Q: number; n: number; m: number | null; t: number; steps: CalcStep[] } {
  const etaF = inp.etaF ?? 1;
  if (!(inp.I > 0) || !(inp.z > 0) || !(etaF > 0 && etaF <= 1)) throw new Error("I > 0, z > 0, 0 < η_F ≤ 1");
  if ((inp.t === undefined) === (inp.n === undefined)) throw new Error("entweder t oder n vorgeben");
  let t: number, n: number;
  const steps: CalcStep[] = [];
  if (inp.t !== undefined) {
    if (!(inp.t > 0)) throw new Error("t > 0"); t = inp.t; n = (etaF * inp.I * t) / (inp.z * F_FARADAY);
    steps.push(step("CH-Z08", "Faraday: Stoffmenge aus Strom und Zeit", "n = η_F · I · t / (z · F); umgekehrt t = n · z · F / (η_F · I)", `n = ${f6(etaF)} · ${f6(inp.I)} A · ${f6(t)} s / (${inp.z} · ${FTXT})`, n, "mol"));
  } else {
    if (!(inp.n! > 0)) throw new Error("n > 0"); n = inp.n!; t = (n * inp.z * F_FARADAY) / (etaF * inp.I);
    steps.push(step("CH-Z08", "Faraday: Zeit für eine Stoffmenge", "n = η_F · I · t / (z · F); umgekehrt t = n · z · F / (η_F · I)", `t = ${f6(n)} mol · ${inp.z} · ${FTXT} / (${f6(etaF)} · ${f6(inp.I)} A)`, t, "s"));
  }
  const Q = inp.I * t;
  const m = inp.M ? n * inp.M : null;
  if (m !== null) steps.push(step("CH-Z09", "Faraday: Masse", "m = n · M", `m = ${f6(n)} mol · ${f6(inp.M!)} kg/mol`, m, "kg"));
  return { Q, n, m, t, steps };
}

export interface ElectrolysisResult { Urev: number; Uth: number; etaU_HHV: number; etaU_rev: number; w: number; eta: number; steps: CalcStep[] }
/**
 * CH-Z10 bis CH-Z13 Elektrolyse je mol Produkt: U_rev = Δ_rG° / (z · F), U_th = Δ_rH° / (z · F), Spannungswirkungsgrad η_U = U_th / U
 * (bezogen auf den Brennwert, auch U_rev / U), spezifischer Energiebedarf w = z · F · U / (η_F · M), Gesamtwirkungsgrad η = Δ_rH° / (w · M) = η_U · η_F.
 */
export function electrolysis(inp: { dG: number; dH: number; z: number; U: number; M: number; etaF?: number }): ElectrolysisResult {
  const etaF = inp.etaF ?? 1;
  if (!(inp.dG > 0) || !(inp.dH > 0)) throw new Error("Elektrolyse: Δ_rG° > 0 und Δ_rH° > 0 (Zersetzung)");
  if (!(inp.z > 0 && inp.U > 0 && inp.M > 0) || !(etaF > 0 && etaF <= 1)) throw new Error("z, U, M > 0 und 0 < η_F ≤ 1");
  const Urev = inp.dG / (inp.z * F_FARADAY), Uth = inp.dH / (inp.z * F_FARADAY);
  const etaU_HHV = Uth / inp.U, etaU_rev = Urev / inp.U;
  const w = (inp.z * F_FARADAY * inp.U) / (etaF * inp.M);
  const eta = inp.dH / (w * inp.M);
  const steps = [
    step("CH-Z10", "Reversible Zellspannung", "U_rev = Δ_rG° / (z · F)", `U_rev = ${f6(inp.dG / 1000)} kJ/mol / (${inp.z} · ${FTXT})`, Urev, "V"),
    step("CH-Z11", "Thermoneutrale Spannung", "U_th = Δ_rH° / (z · F)", `U_th = ${f6(inp.dH / 1000)} kJ/mol / (${inp.z} · ${FTXT})`, Uth, "V"),
    step("CH-Z12", "Spannungswirkungsgrad", "η_U = U_th / U (Brennwert); η_U,rev = U_rev / U", `η_U = ${f6(Uth)} V / ${f6(inp.U)} V; η_U,rev = ${f6(Urev)} V / ${f6(inp.U)} V = ${f6(etaU_rev)}`, etaU_HHV, "1"),
    step("CH-Z13", "Spezifischer Energiebedarf und Gesamtwirkungsgrad", "w = z · F · U / (η_F · M); η = Δ_rH° / (w · M) = η_U · η_F", `w = ${inp.z} · ${FTXT} · ${f6(inp.U)} V / (${f6(etaF)} · ${f6(inp.M)} kg/mol) = ${f6(w / 3.6e6)} kWh/kg; η = ${f6(eta)}`, w, "J/kg"),
  ];
  return { Urev, Uth, etaU_HHV, etaU_rev, w, eta, steps };
}
