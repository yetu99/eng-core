/**
 * Thermochemie (Modul chemie, v1.1, CH-T01 bis CH-T13): Reaktionsenthalpie, -entropie und freie Enthalpie aus
 * Bildungsgrößen (Satz von Hess), Temperaturabhängigkeit nach Ellingham (Δc_p = 0, CH-E11), Umkehrtemperatur,
 * Probe nach Gibbs-Helmholtz, Reaktionswärme, Brenn- und Heizwert (molar, massen- und volumenbezogen), Gemische.
 * SI: J/mol, J/(mol·K), K, kg, m³. Daten von außen (Tabelle ch_thermo, kJ/mol), Zuordnung über Summenformel (Hill) und Phase (CH-E13).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { R_GAS, T_STD, VM_NORM, type ChTable } from "./constants";
import { parseFormula } from "./formula";
import { molarMass } from "./mass";
import { eqConstant } from "./equilibrium";

const f6 = (x: number): string => fmt(x, 6);
const kJ = (x: number): string => `${f6(x / 1000)} kJ/mol`;

export type ThermoPhase = "s" | "l" | "g" | "aq";
export interface ThermoEntry {
  id: string; formula: string; phase: ThermoPhase; name: string; isDefault: boolean; hill: string;
  /** ΔfH° [J/mol] */ dfH: number;
  /** ΔfG° [J/mol] */ dfG: number | null;
  /** S° [J/(mol·K)] */ S: number | null;
  /** c_p° [J/(mol·K)] */ cp: number | null;
}
export interface ThermoTable { byId: ReadonlyMap<string, ThermoEntry>; byHill: ReadonlyMap<string, readonly ThermoEntry[]> }
export interface ThermoRow { id: string; formula: string; phase: string; name_de: string; default_phase: boolean; dfH_kJ_mol: number; dfG_kJ_mol: number | null; S_J_molK: number | null; cp_J_molK: number | null }

/** Tabelle aus Zeilen im Format ch_thermo (kJ/mol → J/mol). */
export function thermoTable(rows: readonly ThermoRow[]): ThermoTable {
  const byId = new Map<string, ThermoEntry>(), byHill = new Map<string, ThermoEntry[]>();
  for (const r of rows) {
    const p = parseFormula(r.formula);
    if (!p.ok || !["s", "l", "g", "aq"].includes(r.phase)) continue;
    const e: ThermoEntry = { id: r.id, formula: r.formula, phase: r.phase as ThermoPhase, name: r.name_de, isDefault: r.default_phase, hill: p.hill,
      dfH: r.dfH_kJ_mol * 1000, dfG: r.dfG_kJ_mol === null ? null : r.dfG_kJ_mol * 1000, S: r.S_J_molK, cp: r.cp_J_molK };
    byId.set(e.id, e);
    const l = byHill.get(e.hill) ?? []; l.push(e); byHill.set(e.hill, l);
  }
  return { byId, byHill };
}

/**
 * Stoff in der Tabelle suchen: Summenformel (Hill) und Phase. Ohne Zustandsangabe: Ionen (aq), sonst die Standardphase der Formel.
 * Liefert null mit Meldung, wenn nichts passt.
 */
export function thermoLookup(formula: string, table: ThermoTable): { entry: ThermoEntry | null; error: string | null } {
  const p = parseFormula(formula);
  if (!p.ok) return { entry: null, error: `${formula}: ${p.error}` };
  if (p.electron) return { entry: null, error: "Elektronen gehören in Halbreaktionen (Elektrochemie)" };
  const list = table.byHill.get(p.hill) ?? [];
  if (!list.length) return { entry: null, error: `${p.display}: keine Bildungsgrößen in der Tabelle` };
  const phase = p.state ?? (p.charge !== 0 ? "aq" : null);
  const hit = phase ? list.find((e) => e.phase === phase) : (list.find((e) => e.isDefault) ?? list[0]);
  if (!hit) return { entry: null, error: `${p.display}: Phase (${phase}) nicht in der Tabelle, vorhanden: ${list.map((e) => e.phase).join(", ")}` };
  return { entry: hit, error: null };
}

export interface ThermoTerm { formula: string; side: "edukt" | "produkt"; coefficient: number }
export interface ThermoResult {
  ok: boolean; error: string | null;
  entries: Array<{ formula: string; id: string; name: string; coefficient: number; side: "edukt" | "produkt"; dfH: number; dfG: number | null; S: number | null }>;
  /** J/mol */ dH: number | null;
  /** J/(mol·K) */ dS: number | null;
  /** ΔrG° bei 298,15 K aus ΔfG° [J/mol] */ dG298: number | null;
  /** ΔrG°(T) = ΔrH° − T·ΔrS° [J/mol] */ dGT: number | null;
  T: number; K: number | null; logK: number | null;
  /** Umkehrtemperatur [K], nur wenn ΔrH° und ΔrS° gleiches Vorzeichen haben */ Tinv: number | null;
  /** Gibbs-Helmholtz bei 298,15 K: ΔrG°(ΔfG°) − (ΔrH° − T°·ΔrS°) [J/mol] */ ghDiff: number | null;
  steps: CalcStep[];
}

const sumTxt = (list: ThermoResult["entries"], val: (e: ThermoResult["entries"][number]) => number, unit: (x: number) => string): string =>
  list.map((e) => `${e.side === "produkt" ? "+" : "−"} ${e.coefficient} · ${unit(val(e))}`).join(" ").replace(/^\+ /, "");

/**
 * CH-T01 bis CH-T06 und CH-G01 für eine bilanzierte Gleichung (Koeffizienten > 0).
 * T [K] für ΔrG°(T) und K; ΔrH°, ΔrS° temperaturunabhängig (CH-E11).
 */
export function reactionThermo(terms: readonly ThermoTerm[], table: ThermoTable, T = T_STD): ThermoResult {
  const steps: CalcStep[] = [];
  const empty = (error: string, entries: ThermoResult["entries"] = []): ThermoResult => ({ ok: false, error, entries, dH: null, dS: null, dG298: null, dGT: null, T, K: null, logK: null, Tinv: null, ghDiff: null, steps });
  if (!(T > 0) || !Number.isFinite(T)) return empty("T muss größer 0 sein");
  if (!terms.some((t) => t.side === "edukt") || !terms.some((t) => t.side === "produkt")) return empty("Edukte und Produkte angeben");
  if (terms.some((t) => !(t.coefficient > 0) || !Number.isFinite(t.coefficient))) return empty("Gleichung zuerst bilanzieren");
  const entries: ThermoResult["entries"] = [], missing: string[] = [];
  for (const t of terms) {
    const l = thermoLookup(t.formula, table);
    if (!l.entry) { missing.push(l.error ?? t.formula); continue; }
    entries.push({ formula: t.formula, id: l.entry.id, name: l.entry.name, coefficient: t.coefficient, side: t.side, dfH: l.entry.dfH, dfG: l.entry.dfG, S: l.entry.S });
  }
  if (missing.length) return empty(missing.join("; "), entries);
  const sg = (e: ThermoResult["entries"][number]) => (e.side === "produkt" ? 1 : -1) * e.coefficient;
  const dH = entries.reduce((s, e) => s + sg(e) * e.dfH, 0);
  steps.push(step("CH-T01", "Reaktionsenthalpie (Hess)", "Δ_rH° = Σ ν_i · Δ_fH°_i (Produkte) − Σ ν_j · Δ_fH°_j (Edukte)", `Δ_rH° = ${sumTxt(entries, (e) => e.dfH, kJ)}`, dH, "J/mol"));
  const hasS = entries.every((e) => e.S !== null);
  const dS = hasS ? entries.reduce((s, e) => s + sg(e) * e.S!, 0) : null;
  if (dS !== null) steps.push(step("CH-T02", "Reaktionsentropie", "Δ_rS° = Σ ν_i · S°_i (Produkte) − Σ ν_j · S°_j (Edukte)", `Δ_rS° = ${sumTxt(entries, (e) => e.S!, (x) => `${f6(x)} J/(mol·K)`)}`, dS, "J/(mol·K)"));
  const hasG = entries.every((e) => e.dfG !== null);
  const dG298 = hasG ? entries.reduce((s, e) => s + sg(e) * e.dfG!, 0) : null;
  if (dG298 !== null) steps.push(step("CH-T03", "Freie Reaktionsenthalpie bei 298,15 K", "Δ_rG° = Σ ν_i · Δ_fG°_i (Produkte) − Σ ν_j · Δ_fG°_j (Edukte)", `Δ_rG° = ${sumTxt(entries, (e) => e.dfG!, kJ)}`, dG298, "J/mol"));
  let dGT: number | null = null;
  if (dS !== null) {
    dGT = Math.abs(T - T_STD) < 1e-9 && dG298 !== null ? dG298 : dH - T * dS;
    if (!(Math.abs(T - T_STD) < 1e-9 && dG298 !== null)) steps.push(step("CH-T04", "Freie Reaktionsenthalpie bei T (Ellingham, Δc_p = 0)", "Δ_rG°(T) = Δ_rH° − T · Δ_rS°", `Δ_rG° = ${kJ(dH)} − ${f6(T)} K · ${f6(dS)} J/(mol·K)`, dGT, "J/mol"));
  } else if (Math.abs(T - T_STD) < 1e-9) dGT = dG298;
  let Tinv: number | null = null;
  if (dS !== null && dS !== 0 && dH !== 0 && Math.sign(dH) === Math.sign(dS)) {
    Tinv = dH / dS;
    steps.push(step("CH-T05", "Umkehrtemperatur (Δ_rG° = 0)", "T_U = Δ_rH° / Δ_rS°", `T_U = ${kJ(dH)} / ${f6(dS)} J/(mol·K)`, Tinv, "K"));
  }
  let ghDiff: number | null = null;
  if (dS !== null && dG298 !== null) {
    ghDiff = dG298 - (dH - T_STD * dS);
    steps.push(step("CH-T06", "Probe Gibbs-Helmholtz bei 298,15 K", "δ = Δ_rG°(Δ_fG°) − (Δ_rH° − T° · Δ_rS°)", `δ = ${kJ(dG298)} − (${kJ(dH)} − 298,15 K · ${f6(dS)} J/(mol·K))`, ghDiff, "J/mol"));
  }
  let K: number | null = null, logK: number | null = null;
  if (dGT !== null) { const k = eqConstant(dGT, T); K = k.K; logK = k.logK; steps.push(k.step); }
  return { ok: true, error: null, entries, dH, dS, dG298, dGT, T, K, logK, Tinv, ghDiff, steps };
}

/** CH-T07 Reaktionswärme bei konstantem Druck Q_p = ξ · Δ_rH° [J]; Q_p < 0: Wärme wird abgegeben. */
export function reactionHeat(xi: number, dH: number): { Q: number; step: CalcStep } {
  if (!Number.isFinite(xi) || !Number.isFinite(dH)) throw new Error("ξ und Δ_rH° müssen endlich sein");
  const Q = xi * dH;
  return { Q, step: step("CH-T07", "Reaktionswärme (p konstant)", "Q_p = ξ · Δ_rH°", `Q_p = ${f6(xi)} mol · ${kJ(dH)}`, Q, "J") };
}

export interface FuelResult {
  ok: boolean; error: string | null; formula: string; name: string | null;
  /** O₂-Bedarf je mol Brennstoff, Produkte je mol */ o2: number | null; products: { CO2: number; H2O: number; N2: number; SO2: number } | null;
  equation: string;
  /** J/mol */ Hs_m: number | null; Hi_m: number | null;
  /** J/kg */ Hs_w: number | null; Hi_w: number | null;
  /** J/m³ im Normzustand DIN 1343, nur Gase */ Hs_v: number | null; Hi_v: number | null;
  M: number | null; gas: boolean;
  steps: CalcStep[];
}

const ALLOWED = new Set(["C", "H", "O", "N", "S"]);
const q = (x: number): string => (Number.isInteger(x) ? String(x) : fmt(x, 6));

/**
 * CH-T08 bis CH-T12: vollständige Verbrennung C_aH_bO_cN_dS_e + x O₂ → a CO₂ + b/2 H₂O + d/2 N₂ + e SO₂ bei 25 °C.
 * Brennwert H_s mit H₂O(l), Heizwert H_i mit H₂O(g); massenbezogen über M, volumenbezogen über V_m,n (DIN 1343, ideales Gas).
 */
export function fuelValue(formula: string, table: ThermoTable, elements: ChTable): FuelResult {
  const steps: CalcStep[] = [];
  const fail = (error: string, name: string | null = null): FuelResult => ({ ok: false, error, formula, name, o2: null, products: null, equation: "", Hs_m: null, Hi_m: null, Hs_w: null, Hi_w: null, Hs_v: null, Hi_v: null, M: null, gas: false, steps });
  const p = parseFormula(formula);
  if (!p.ok) return fail(p.error ?? "Formel nicht lesbar");
  if (p.charge !== 0 || p.electron) return fail("Brennstoff muss neutral sein");
  const els = Object.keys(p.composition);
  const bad = els.filter((e) => !ALLOWED.has(e));
  if (bad.length) return fail(`Element ${bad.join(", ")}: Verbrennung nur für C, H, O, N, S`);
  if (!els.some((e) => e === "C" || e === "H" || e === "S")) return fail("kein brennbares Element (C, H, S)");
  const fuel = thermoLookup(formula, table);
  if (!fuel.entry) return fail(fuel.error ?? "keine Bildungsgrößen");
  const [a, b, c, d, e] = ["C", "H", "O", "N", "S"].map((k) => p.composition[k] ?? 0) as [number, number, number, number, number];
  const o2 = a + b / 4 + e - c / 2;
  if (!(o2 > 0)) return fail("Stoff enthält genug Sauerstoff für die eigene Oxidation (kein O₂-Bedarf)", fuel.entry.name);
  const products = { CO2: a, H2O: b / 2, N2: d / 2, SO2: e };
  const prodTxt = [[a, "CO₂"], [b / 2, "H₂O"], [d / 2, "N₂"], [e, "SO₂"]].filter(([n]) => (n as number) > 0).map(([n, s]) => `${n === 1 ? "" : q(n as number) + " "}${s}`).join(" + ");
  const equation = `${p.display} + ${o2 === 1 ? "" : q(o2) + " "}O₂ → ${prodTxt}`;
  steps.push(step("CH-T08", "Verbrennungsgleichung", "C_aH_bO_cN_dS_e + (a + b/4 + e − c/2) O₂ → a CO₂ + b/2 H₂O + d/2 N₂ + e SO₂", `a = ${a}, b = ${b}, c = ${c}, d = ${d}, e = ${e}: ${equation}`, o2, "mol/mol"));
  const look = (f: string) => thermoLookup(f, table).entry;
  const need = { CO2: look("CO2(g)"), H2Ol: look("H2O(l)"), H2Og: look("H2O(g)"), SO2: look("SO2(g)"), O2: look("O2(g)"), N2: look("N2(g)") };
  const miss = Object.entries(need).filter(([, v]) => !v).map(([k]) => k);
  if (miss.length) return fail(`Bildungsgrößen fehlen: ${miss.join(", ")}`, fuel.entry.name);
  const H = (w: ThermoEntry) => a * need.CO2!.dfH + (b / 2) * w.dfH + (d / 2) * need.N2!.dfH + e * need.SO2!.dfH - fuel.entry!.dfH - o2 * need.O2!.dfH;
  const Hs_m = -H(need.H2Ol!), Hi_m = -H(need.H2Og!);
  steps.push(step("CH-T09", "Brennwert molar (H₂O flüssig)", "H_s,m = −Δ_cH° = −(a · Δ_fH°(CO₂) + b/2 · Δ_fH°(H₂O, l) + e · Δ_fH°(SO₂) − Δ_fH°(Brennstoff))",
    `H_s,m = −(${a} · ${kJ(need.CO2!.dfH)} + ${q(b / 2)} · ${kJ(need.H2Ol!.dfH)} + ${e} · ${kJ(need.SO2!.dfH)} − (${kJ(fuel.entry.dfH)}))`, Hs_m, "J/mol"));
  steps.push(step("CH-T10", "Heizwert molar (H₂O gasförmig)", "H_i,m = −Δ_cH° mit Δ_fH°(H₂O, g) = H_s,m − b/2 · (Δ_fH°(H₂O, g) − Δ_fH°(H₂O, l))",
    `H_i,m = ${kJ(Hs_m)} − ${q(b / 2)} · (${kJ(need.H2Og!.dfH)} − (${kJ(need.H2Ol!.dfH)}))`, Hi_m, "J/mol"));
  const mm = molarMass(p, elements);
  let Hs_w: number | null = null, Hi_w: number | null = null;
  if (mm.ok && mm.M) {
    Hs_w = Hs_m / mm.M; Hi_w = Hi_m / mm.M;
    steps.push(step("CH-T11", "Brenn- und Heizwert massenbezogen", "H_s = H_s,m / M, H_i = H_i,m / M", `H_s = ${kJ(Hs_m)} / ${f6(mm.M)} kg/mol; H_i = ${kJ(Hi_m)} / ${f6(mm.M)} kg/mol → H_i = ${f6(Hi_w / 1e6)} MJ/kg`, Hs_w, "J/kg"));
  }
  const gas = fuel.entry.phase === "g";
  let Hs_v: number | null = null, Hi_v: number | null = null;
  if (gas) {
    Hs_v = Hs_m / VM_NORM; Hi_v = Hi_m / VM_NORM;
    steps.push(step("CH-T12", "Brenn- und Heizwert volumenbezogen (Normzustand DIN 1343, ideales Gas)", "H_s,n = H_s,m / V_m,n, H_i,n = H_i,m / V_m,n",
      `H_s,n = ${kJ(Hs_m)} / ${f6(VM_NORM)} m³/mol; H_i,n = ${kJ(Hi_m)} / ${f6(VM_NORM)} m³/mol → H_i,n = ${f6(Hi_v / 1e6)} MJ/m³`, Hs_v, "J/m³", "DIN 1343, Verbrennung bei 25 °C"));
  }
  return { ok: true, error: null, formula, name: fuel.entry.name, o2, products, equation, Hs_m, Hi_m, Hs_w, Hi_w, Hs_v, Hi_v, M: mm.M, gas, steps };
}

/**
 * CH-T13 Gemisch idealer Gase (z. B. Biogas): H_n = Σ x_i · H_n,i mit Volumenanteilen x_i (Σ x_i = 1, inerte Anteile ohne Heizwert).
 * values: J/m³ im Normzustand; Rückgabe Brennwert und Heizwert des Gemischs.
 */
export function mixtureValue(parts: ReadonlyArray<{ label: string; x: number; Hs_v: number; Hi_v: number }>): { Hs_v: number; Hi_v: number; sumX: number; note: string | null; step: CalcStep } {
  if (!parts.length) throw new Error("keine Anteile");
  if (parts.some((p) => !(p.x >= 0) || !Number.isFinite(p.Hs_v) || !Number.isFinite(p.Hi_v))) throw new Error("Anteile ≥ 0 und Heizwerte endlich");
  const sumX = parts.reduce((s, p) => s + p.x, 0);
  if (!(sumX > 0) || sumX > 1 + 1e-9) throw new Error("Summe der Volumenanteile muss zwischen 0 und 1 liegen");
  const Hs_v = parts.reduce((s, p) => s + p.x * p.Hs_v, 0), Hi_v = parts.reduce((s, p) => s + p.x * p.Hi_v, 0);
  const note = sumX < 1 - 1e-9 ? `Rest ${fmt((1 - sumX) * 100, 4)} % inert (z. B. CO₂, N₂)` : null;
  return { Hs_v, Hi_v, sumX, note, step: step("CH-T13", "Heizwert eines Gasgemischs (ideal)", "H_i,n = Σ x_i · H_i,n,i (Volumenanteile x_i, Normzustand)", parts.map((p) => `${f6(p.x)} · ${f6(p.Hi_v / 1e6)} MJ/m³ (${p.label})`).join(" + "), Hi_v, "J/m³") };
}

/** Hilfsgröße R für Aufrufer ohne eigenen Import. */
export const THERMO_R = R_GAS;
