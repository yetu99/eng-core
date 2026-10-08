/**
 * Schritt 6: mehrere Randbedingungen (aktive Randbedingung, Ashby 9.5) und Zielkonflikt Masse/Kosten
 * mit Austauschkonstante α (Wertfunktion Z = α·m + C, Ashby 9.6).
 *
 * Für jeden Kandidaten wird das Profil aus Blatt 1 formtreu skaliert (Faktor s, A ∝ s², I ∝ s⁴, W ∝ s³)
 * und die nötige Größe getrennt aus Steifigkeit (f ≤ f_zul) und Festigkeit (σ ≤ R / S_erf) bestimmt.
 * Geschlossene Lösung, keine Iteration. Festigkeit: unterer Auslegungswert (R_p duktil, σ_bB/R_m spröde).
 */
import { sectionProps, type Dims, type SecType } from "../sections";
import { strengthDesign, type Material, type Repo } from "../materials";
import { isBendingCase, type BendingCaseId } from "../mechanics/cases";
import { bendingMax } from "../mechanics/beam";

export interface ConflictBasis { secType: SecType; dims: Dims; caseId: string; L: number; F: number; q: number; a: number; fDiv: number; SFreq: number; SBreq: number }
export interface ConflictRow { m: Material; mStiff: number; mStrength: number | null; mass: number | null; active: "Steifigkeit" | "Festigkeit" | "Festigkeit nicht belegt"; cost: number | null; R: number | null; Sreq: number; Z: number | null }
export interface ConflictResult { caseId: BendingCaseId; fzul: number; rows: ConflictRow[] }

/** @param alpha Austauschkonstante in €/kg */
export function multiConstraint(repo: Repo, candidates: Material[], basis: ConflictBasis, alpha: number): ConflictResult {
  const sec0 = sectionProps(basis.secType, basis.dims);
  const caseId: BendingCaseId = isBendingCase(basis.caseId) ? basis.caseId : "EQ";
  const L = basis.L;
  const mx = bendingMax(caseId, L, basis.F * 1000, basis.q, basis.a, 1); // mx.w = w·E·I, mx.M in N·mm
  const fzul = L / basis.fDiv;
  const rows = candidates.filter((m) => m.E !== null && m.rho !== null).map((m): ConflictRow => {
    const E = (m.E as number) * 1000, rho = m.rho as number;
    const sd = strengthDesign(repo, m, true, { RE: "lower", RM: "lower" }, { RE: null, RM: null });
    const R = sd.brittle ? sd.Rm?.v ?? null : sd.Rp?.v ?? null;
    const Sreq = sd.brittle ? basis.SBreq : basis.SFreq;
    const sSt = Math.pow(mx.w / (E * fzul) / sec0.I, 1 / 4);
    const sF = R ? Math.cbrt(mx.M * Sreq / R / sec0.W) : null;
    const mOf = (s: number) => rho * sec0.A * s * s * 1e-9 * L;
    const mStiff = mOf(sSt), mStrength = sF !== null ? mOf(sF) : null;
    const mass = mStrength !== null ? Math.max(mStiff, mStrength) : null;
    const cost = mass !== null && m.price !== null ? mass * m.price : null;
    return { m, mStiff, mStrength, mass, active: mStrength === null ? "Festigkeit nicht belegt" : mStiff >= mStrength ? "Steifigkeit" : "Festigkeit", cost, R, Sreq, Z: mass !== null && cost !== null ? alpha * mass + cost : null };
  });
  return { caseId, fzul, rows };
}

/** Pareto-Front: kein anderer Kandidat ist zugleich leichter und billiger. */
export function paretoFront(rows: ConflictRow[]): ConflictRow[] {
  const v = rows.filter((r) => r.mass !== null && r.cost !== null).sort((a, b) => (a.mass as number) - (b.mass as number));
  let best = Infinity; const front: ConflictRow[] = [];
  for (const r of v) if ((r.cost as number) < best) { best = r.cost as number; front.push(r); }
  return front;
}

/** Austauschkonstanten als Größenordnung nach Ashby Tab. 9.3 (Werte 1999, US-$, hier als €/kg). */
export const ALPHA_PRESETS: ReadonlyArray<readonly [number, string]> = [[0, "ortsfest"], [1, "PKW"], [7, "LKW"], [300, "Flugzeug"], [5000, "Raumfahrt"]];
