/**
 * Isotope und Kern (Modul chemie, CH-K01 bis CH-K10, Modul M4 des Chemiewerks).
 * Atommassen [u] (AME2020), Elektronen über m(¹H) ausgeglichen, Bindungsenergie der Elektronen vernachlässigt.
 * Konstanten CODATA 2022. Zeiten in s, Aktivität in Bq. Stabile Nuklide: Halbwertszeit null → "stabil".
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { MEV_J, MUC2_MEV, M_H1_U, M_NEUTRON_U, M_U_KG } from "./constants";

const f6 = (x: number): string => fmt(x, 6);
const f9 = (x: number): string => fmt(x, 10);

export interface BindingEnergy { N: number; massDefect_u: number; E_B_MeV: number; E_B_J: number; E_B_per_A_MeV: number; steps: CalcStep[] }

/** CH-K01 bis CH-K04. */
export function bindingEnergy(z: number, a: number, atomicMass_u: number): BindingEnergy {
  if (!Number.isInteger(z) || !Number.isInteger(a) || z < 1 || a < z) throw new Error("Z ≥ 1 und A ≥ Z ganzzahlig");
  if (!(atomicMass_u > 0)) throw new Error("Atommasse muss größer 0 sein");
  const N = a - z;
  const dm = z * M_H1_U + N * M_NEUTRON_U - atomicMass_u;
  const E = dm * MUC2_MEV, EJ = E * MEV_J, EA = E / a;
  const steps = [
    step("CH-K01", "Neutronenzahl", "N = A − Z", `N = ${a} − ${z}`, N, "1"),
    step("CH-K02", "Massendefekt", "Δm = Z · m(¹H) + N · m_n − m_Atom", `Δm = ${z} · 1,007825031898 u + ${N} · 1,00866491606 u − ${f9(atomicMass_u)} u`, dm, "u", "AME2020, CODATA 2022"),
    step("CH-K03", "Bindungsenergie", "E_B = Δm · m_u c², m_u c² = 931,494 103 72 MeV", `E_B = ${f6(dm)} u · 931,49410372 MeV/u (= ${f6(EJ)} J)`, E, "MeV", "CODATA 2022"),
    step("CH-K04", "Bindungsenergie je Nukleon", "E_B / A", `E_B / A = ${f6(E)} MeV / ${a}`, EA, "MeV"),
  ];
  return { N, massDefect_u: dm, E_B_MeV: E, E_B_J: EJ, E_B_per_A_MeV: EA, steps };
}

export interface DecayResult { stable: boolean; lambda: number | null; N: number | null; A: number | null; steps: CalcStep[] }

/** CH-K05 bis CH-K07. halfLife_s = null: stabil. */
export function decay(N0: number, halfLife_s: number | null, t_s: number): DecayResult {
  if (!(N0 >= 0) || !(t_s >= 0)) throw new Error("N_0 und t dürfen nicht negativ sein");
  if (halfLife_s === null) return { stable: true, lambda: null, N: N0, A: 0, steps: [] };
  if (!(halfLife_s > 0)) throw new Error("Halbwertszeit muss größer 0 sein");
  const lambda = Math.LN2 / halfLife_s, N = N0 * Math.pow(2, -t_s / halfLife_s), A = lambda * N;
  return { stable: false, lambda, N, A, steps: [
    step("CH-K05", "Zerfallskonstante", "λ = ln 2 / T½", `λ = 0,693147 / ${f6(halfLife_s)} s`, lambda, "1/s"),
    step("CH-K06", "Anzahl", "N(t) = N_0 · 2^(−t / T½)", `N = ${f6(N0)} · 2^(−${f6(t_s)} s / ${f6(halfLife_s)} s)`, N, "1"),
    step("CH-K07", "Aktivität", "A(t) = λ · N(t)", `A = ${f6(lambda)} 1/s · ${f6(N)}`, A, "Bq"),
  ] };
}

/** CH-K08 Anzahl aus Masse (m in kg, Atommasse in u). */
export function atomsFromMass(m_kg: number, atomicMass_u: number): { N0: number; step: CalcStep } {
  if (!(m_kg >= 0) || !(atomicMass_u > 0)) throw new Error("Masse ≥ 0 und Atommasse > 0");
  const N0 = m_kg / (atomicMass_u * M_U_KG);
  return { N0, step: step("CH-K08", "Anzahl aus Masse", "N_0 = m / (A_r · m_u), A_r = Atommasse des Nuklids in u, m_u = 1,660 539 068 92 · 10⁻²⁷ kg", `N_0 = ${f6(m_kg)} kg / (${f9(atomicMass_u)} · 1,66053906892·10⁻²⁷ kg)`, N0, "1", "CODATA 2022") };
}

/** CH-K09 Zeit bis Restanteil N / N_0. */
export function timeToFraction(fraction: number, halfLife_s: number): { t: number; step: CalcStep } {
  if (!(fraction > 0 && fraction <= 1)) throw new Error("Restanteil zwischen 0 (ausgeschlossen) und 1");
  if (!(halfLife_s > 0)) throw new Error("Halbwertszeit muss größer 0 sein");
  const t = halfLife_s * Math.log2(1 / fraction);
  return { t, step: step("CH-K09", "Zeit bis Restanteil", "t = T½ · log₂(N_0 / N)", `t = ${f6(halfLife_s)} s · log₂(1 / ${f6(fraction)})`, t, "s") };
}

/** CH-K10 mittlere Atommasse aus Häufigkeiten (Molenbrüche). Hinweis, wenn |Σ h − 1| > 10⁻³. */
export function meanAtomicMass(isotopes: ReadonlyArray<{ mass_u: number; abundance: number }>, standard?: number | null): { mean: number; sumH: number; note: string | null; step: CalcStep } {
  if (!isotopes.length || isotopes.some((i) => !(i.abundance >= 0) || !(i.mass_u > 0))) throw new Error("Isotope mit Masse > 0 und Häufigkeit ≥ 0");
  const sumH = isotopes.reduce((s, i) => s + i.abundance, 0);
  if (!(sumH > 0)) throw new Error("Summe der Häufigkeiten muss größer 0 sein");
  const mean = isotopes.reduce((s, i) => s + i.mass_u * i.abundance, 0) / sumH;
  const note = Math.abs(sumH - 1) > 1e-3 ? `Summe der Häufigkeiten ${fmt(sumH, 6)} ≠ 1, normiert` : null;
  const cmp = standard !== undefined && standard !== null ? `; Standardatomgewicht ${f6(standard)} u, Differenz ${fmt(mean - standard, 3)} u` : "";
  return { mean, sumH, note, step: step("CH-K10", "Mittlere Atommasse", "Ā = Σ h_i · m_i / Σ h_i", `Ā = (${isotopes.map((i) => `${f6(i.abundance)} · ${f9(i.mass_u)} u`).join(" + ")}) / ${f6(sumH)}${cmp}`, mean, "u") };
}
