/**
 * Molare Masse, Massenanteile, Stoffmenge, Teilchenzahl (Modul chemie, CH-M01 bis CH-M05).
 * SI im Kern (CH-E2): M in kg/mol, m in kg, n in mol. M_u = 1 g/mol (CH-E3), Ionen ohne Elektronenkorrektur.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { M_U, N_A, type ChTable } from "./constants";
import { parseFormula, type Composition, type ParsedFormula } from "./formula";

const f6 = (x: number): string => fmt(x, 6);

export interface MassResult {
  ok: boolean;
  /** Molare Masse [kg/mol]. */
  M: number | null;
  /** Relative Formelmasse Σ ν · A_r (dimensionslos, Zahlenwert in g/mol). */
  Mr: number | null;
  /** Massenanteile je Element (Summe 1). */
  fractions: Array<{ element: string; count: number; Ar: number; w: number }>;
  notes: string[];
  error: string | null;
  steps: CalcStep[];
}

/** CH-M01, CH-M02 (und CH-M05 als Hinweis). Formel als Text oder bereits geparst. */
export function molarMass(formula: string | ParsedFormula, table: ChTable): MassResult {
  const p = typeof formula === "string" ? parseFormula(formula) : formula;
  if (!p.ok) return { ok: false, M: null, Mr: null, fractions: [], notes: [], error: p.error, steps: p.steps };
  if (p.electron) return { ok: true, M: 0, Mr: 0, fractions: [], notes: ["Elektron: Masse im Rahmen von M_u vernachlässigt"], error: null, steps: [] };
  const comp: Composition = p.composition, notes: string[] = [];
  const els = Object.keys(comp).sort();
  for (const e of els) {
    const el = table.get(e);
    if (!el || el.atomicMass_u === null) return { ok: false, M: null, Mr: null, fractions: [], notes, error: `kein Atomgewicht für ${e}`, steps: p.steps };
    if (el.massNote && /kein Standardatomgewicht/.test(el.massNote)) notes.push(`${e}: kein Standardatomgewicht, Masse des langlebigsten Isotops (${f6(el.atomicMass_u)} u)`);
  }
  const terms = els.map((e) => ({ element: e, count: comp[e]!, Ar: table.get(e)!.atomicMass_u! }));
  const Mr = terms.reduce((s, t) => s + t.count * t.Ar, 0);
  const M = Mr * M_U;
  if (p.charge !== 0) notes.push("Ion: molare Masse ohne Korrektur der Elektronenmasse (Δ ≈ 0,000 55 g/mol je Ladung)");
  const steps: CalcStep[] = [...p.steps];
  steps.push(step("CH-M01", `Molare Masse ${p.hill}`, "M = Σ ν_i · A_r,i · M_u, M_u = 1 g/mol", `M = (${terms.map((t) => `${t.count} · ${f6(t.Ar)}`).join(" + ")}) · 10⁻³ kg/mol`, M, "kg/mol", "IUPAC CIAAW 2021, Abzug ch_elements"));
  const fractions = terms.map((t) => ({ ...t, w: (t.count * t.Ar) / Mr }));
  for (const f of fractions) steps.push(step("CH-M02", `Massenanteil ${f.element} in ${p.hill}`, "w_i = ν_i · A_r,i / Σ ν_j · A_r,j", `w_${f.element} = ${f.count} · ${f6(f.Ar)} / ${f6(Mr)}`, f.w, "1"));
  if (p.charge !== 0) steps.push(step("CH-M05", "Ionen", "M(Ion) = M(Atome), Elektronenmasse vernachlässigt", `${p.display}: z = ${p.charge > 0 ? "+" : "−"}${Math.abs(p.charge)}, M ohne Korrektur`, M, "kg/mol"));
  return { ok: true, M, Mr, fractions, notes, error: null, steps };
}

/** CH-M03 Stoffmenge n = m / M (m in kg, M in kg/mol). */
export function amountFromMass(m: number, M: number): { n: number; step: CalcStep } {
  if (!(M > 0)) throw new Error("M muss größer 0 sein");
  if (!(m >= 0)) throw new Error("m darf nicht negativ sein");
  const n = m / M;
  return { n, step: step("CH-M03", "Stoffmenge", "n = m / M", `n = ${f6(m)} kg / ${f6(M)} kg/mol`, n, "mol") };
}

/** CH-M04 Teilchenzahl N = n · N_A. */
export function particles(n: number): { N: number; step: CalcStep } {
  const N = n * N_A;
  return { N, step: step("CH-M04", "Teilchenzahl", "N = n · N_A, N_A = 6,022 140 76 · 10²³ 1/mol", `N = ${f6(n)} mol · 6,02214076·10²³ 1/mol`, N, "1") };
}
