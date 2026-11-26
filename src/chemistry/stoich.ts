/**
 * Stöchiometrie unter einer bilanzierten Gleichung (Modul chemie, CH-S01 bis CH-S08).
 * SI: n [mol], m [kg], V [m³], T [K], p [Pa]. Gas ideal; Normzustand DIN 1343 (CH-E5).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { P_NORM_PA, R_GAS, T_NORM_K, VM_NORM } from "./constants";

const f6 = (x: number): string => fmt(x, 6);

export interface StoichSpecies { label: string; side: "edukt" | "produkt"; coefficient: number; /** kg/mol */ M: number | null; /** gasförmig (Zustand (g) oder laut Daten) */ gas: boolean }
export interface StoichGiven { index: number; kind: "m" | "n"; /** kg bzw. mol */ value: number }
export interface GasConditions { mode: "norm" | "frei"; T: number; p: number }
export interface StoichRow { label: string; coefficient: number; n: number | null; m: number | null; V: number | null; limiting: boolean; rest_n: number | null; rest_m: number | null }
export interface StoichResult { ok: boolean; xi: number | null; rows: StoichRow[]; error: string | null; steps: CalcStep[] }

/**
 * CH-S01 bis CH-S08. Genau eine Vorgabe (Edukt oder Produkt) oder mehrere nur auf der Eduktseite.
 * eta: Ausbeute 0 < η ≤ 1, wirkt auf die Produkte (CH-S06).
 */
export function stoichiometry(species: readonly StoichSpecies[], given: readonly StoichGiven[], gas: GasConditions = { mode: "norm", T: T_NORM_K, p: P_NORM_PA }, eta = 1): StoichResult {
  const steps: CalcStep[] = [];
  const err = (e: string): StoichResult => ({ ok: false, xi: null, rows: [], error: e, steps });
  if (!given.length) return err("keine Vorgabe");
  if (!(eta > 0 && eta <= 1)) return err("Ausbeute η muss zwischen 0 und 1 liegen");
  if (species.some((s) => !(s.coefficient > 0) || !Number.isInteger(s.coefficient))) return err("Gleichung zuerst bilanzieren");
  if (gas.mode === "frei" && !(gas.T > 0 && gas.p > 0)) return err("T und p müssen größer 0 sein");
  const idx = new Set<number>();
  for (const g of given) {
    const s = species[g.index];
    if (!s) return err(`Vorgabe für unbekannten Stoff ${g.index}`);
    if (idx.has(g.index)) return err(`doppelte Vorgabe für ${s.label}`);
    idx.add(g.index);
    if (!(g.value > 0) || !Number.isFinite(g.value)) return err(`Vorgabe für ${s.label} muss größer 0 sein`);
    if (g.kind === "m" && !(s.M && s.M > 0)) return err(`keine molare Masse für ${s.label}`);
  }
  if (given.length > 1 && given.some((g) => species[g.index]!.side !== "edukt")) return err("mehrere Vorgaben nur auf der Eduktseite (sonst eine einzige Vorgabe)");
  // Stoffmengen der Vorgaben und Laufzahl je Vorgabe (CH-S01)
  const n0 = new Map<number, number>();
  const xis = given.map((g) => {
    const s = species[g.index]!;
    const n = g.kind === "n" ? g.value : g.value / s.M!;
    if (g.kind === "m") steps.push(step("CH-M03", `Stoffmenge ${s.label}`, "n = m / M", `n = ${f6(g.value)} kg / ${f6(s.M!)} kg/mol`, n, "mol"));
    n0.set(g.index, n);
    const xi = n / s.coefficient;
    steps.push(step("CH-S01", `Reaktionslaufzahl aus ${s.label}`, "ξ = n_k / ν_k", `ξ = ${f6(n)} mol / ${s.coefficient}`, xi, "mol"));
    return { i: g.index, xi };
  });
  const xi = Math.min(...xis.map((x) => x.xi));
  const lim = new Set(xis.filter((x) => Math.abs(x.xi - xi) <= 1e-12 * xi).map((x) => x.i));
  if (given.length > 1) steps.push(step("CH-S02", "Limitierender Reaktant", "ξ = min_k (n_k / ν_k)", `ξ = min(${xis.map((x) => f6(x.xi)).join("; ")}) mol → ${[...lim].map((i) => species[i]!.label).join(", ")}${lim.size > 1 ? " (stöchiometrisch)" : ""}`, xi, "mol"));
  const Vm = gas.mode === "norm" ? VM_NORM : (R_GAS * gas.T) / gas.p;
  let gasDone = false, firstS3 = true;
  const rows: StoichRow[] = species.map((s, i) => {
    const yieldF = s.side === "produkt" ? eta : 1;
    const n = s.coefficient * xi * yieldF;
    if (firstS3 || (s.side === "produkt" && eta < 1)) {
      if (s.side === "produkt" && eta < 1) steps.push(step("CH-S06", `Stoffmenge ${s.label} mit Ausbeute`, "n_i,ist = η · ν_i · ξ", `n = ${f6(eta)} · ${s.coefficient} · ${f6(xi)} mol`, n, "mol"));
      else steps.push(step("CH-S03", `Stoffmenge ${s.label}`, "n_i = ν_i · ξ", `n = ${s.coefficient} · ${f6(xi)} mol`, n, "mol"));
      firstS3 = false;
    }
    const m = s.M ? n * s.M : null;
    if (m !== null && i === species.length - 1) steps.push(step("CH-S04", `Masse ${s.label}`, "m_i = n_i · M_i", `m = ${f6(n)} mol · ${f6(s.M!)} kg/mol`, m, "kg"));
    let V: number | null = null;
    if (s.gas) {
      V = n * Vm;
      if (!gasDone) {
        steps.push(gas.mode === "norm"
          ? step("CH-S07", `Normvolumen ${s.label}`, "V = n · V_m,n, V_m,n = R · T_n / p_n (DIN 1343)", `V = ${f6(n)} mol · 8,314462618 J/(mol·K) · 273,15 K / 101325 Pa`, V, "m³", "DIN 1343")
          : step("CH-S08", `Volumen ${s.label} (ideales Gas)`, "V = n · R · T / p", `V = ${f6(n)} mol · 8,314462618 J/(mol·K) · ${f6(gas.T)} K / ${f6(gas.p)} Pa`, V, "m³"));
        gasDone = true;
      }
    }
    let rest_n: number | null = null, rest_m: number | null = null;
    const nGiven = n0.get(i);
    if (nGiven !== undefined && s.side === "edukt" && given.length > 1) {
      rest_n = Math.max(0, nGiven - s.coefficient * xi); rest_m = s.M ? rest_n * s.M : null;
      if (!lim.has(i)) steps.push(step("CH-S05", `Überschuss ${s.label}`, "n_rest = n_k,0 − ν_k · ξ", `n_rest = ${f6(nGiven)} mol − ${s.coefficient} · ${f6(xi)} mol`, rest_n, "mol"));
    }
    return { label: s.label, coefficient: s.coefficient, n, m, V, limiting: lim.has(i) && given.length > 1, rest_n, rest_m };
  });
  return { ok: true, xi, rows, error: null, steps };
}

/** CH-S06 Ausbeute aus Ist- und theoretischer Masse. */
export function yieldOf(mIst: number, mTheor: number): { eta: number; step: CalcStep } {
  if (!(mTheor > 0) || !(mIst >= 0)) throw new Error("Massen müssen positiv sein");
  const eta = mIst / mTheor;
  return { eta, step: step("CH-S06", "Ausbeute", "η = m_ist / m_theor", `η = ${f6(mIst)} kg / ${f6(mTheor)} kg`, eta, "1") };
}
