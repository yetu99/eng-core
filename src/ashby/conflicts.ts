/**
 * Schritt 6: mehrere Randbedingungen (aktive Randbedingung, Ashby 9.5) und Zielkonflikt Masse/Kosten
 * mit Austauschkonstante α (Wertfunktion Z = α·m + C, Ashby 9.6).
 *
 * Für jeden Kandidaten wird das Profil aus Blatt 1 formtreu skaliert (Faktor s, A ∝ s², I ∝ s⁴, W ∝ s³)
 * und die nötige Größe getrennt aus Steifigkeit (f ≤ f_zul) und Festigkeit (σ_b ≤ σ_zul) bestimmt.
 * Geschlossene Lösung, keine Iteration.
 *
 * Zulässige Spannung wie im Nachweis von Blatt 1 (unterer Auslegungswert):
 *   duktil:  σ_zul = min(R_p / S_F, R_m / S_B), es zählen nur belegte Werte
 *   spröde:  σ_zul = σ_bB / S_B (sonst R_m / S_B)
 */
import { sectionProps, type Dims, type SecType } from "../sections";
import { strengthDesign, type Material, type Repo } from "../materials";
import { isBendingCase, BENDING_CASES, type BendingCaseId } from "../mechanics/cases";
import { bendingMax } from "../mechanics/beam";
import { isLoadListCase, normalizeLoads, solveBeam, LOADLIST_SUPPORTS, type LoadList } from "../mechanics/loadlist";
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";

export interface ConflictBasis { secType: SecType; dims: Dims; caseId: string; L: number; F: number; q: number; a: number; fDiv: number; SFreq: number; SBreq: number; loadList?: LoadList | undefined }
export interface ConflictRow {
  m: Material;
  /** Skalierungsfaktoren des Profils aus Steifigkeit und Festigkeit */
  sStiff: number; sStrength: number | null;
  mStiff: number; mStrength: number | null; mass: number | null;
  active: "Steifigkeit" | "Festigkeit" | "Festigkeit nicht belegt";
  cost: number | null;
  /** maßgebender Festigkeitskennwert (MPa) und zugehörige erforderliche Sicherheit */
  R: number | null; Sreq: number;
  /** zulässige Biegespannung σ_zul = R / S_erf in MPa */
  sigmaZul: number | null;
  /** welcher Kennwert σ_zul bestimmt */
  strengthBasis: "R_p" | "R_m" | "σ_bB" | null;
  /** Hinweis, z. B. wenn R_p nicht belegt ist */
  note: string | null;
  Z: number | null;
  /** Rechenweg für diesen Werkstoff */
  trace: CalcStep[];
}
export interface ConflictResult {
  caseId: BendingCaseId | "LL"; fzul: number;
  /** true, wenn der Lastfall aus Blatt 1 kein Biegefall war und ersatzweise EQ verwendet wird */
  caseSubstituted: boolean;
  /** Rechenweg der gemeinsamen Grundlage (f_zul, M_max, Durchbiegungsbeiwert, Profil) */
  basisTrace: CalcStep[];
  rows: ConflictRow[];
}

const REF_A = "Ashby (1999) Kap. 9.5, aktive Randbedingung";
const REF_B = "Ashby (1999) Kap. 9.6, Austauschkonstante";

/** @param alpha Austauschkonstante in €/kg */
export function multiConstraint(repo: Repo, candidates: Material[], basis: ConflictBasis, alpha: number): ConflictResult {
  const sec0 = sectionProps(basis.secType, basis.dims);
  const L = basis.L;
  // Lastliste: M_max und w_k = f·E·I aus dem Randwertproblem mit E·I = 1 (linear in 1/EI), Eigengewicht hier ohne (werkstoffabhängig)
  const llNorm = isLoadListCase(basis.caseId) && basis.loadList ? normalizeLoads(basis.loadList.loads, L) : null;
  const useLL = llNorm !== null && llNorm.errors.length === 0 && basis.loadList !== undefined;
  const caseSubstituted = !isBendingCase(basis.caseId) && !useLL;
  const caseId: BendingCaseId | "LL" = useLL ? "LL" : isBendingCase(basis.caseId) ? basis.caseId : "EQ";
  let mx: { M: number; w: number; fM: string; sM: string; sw: string }, ref: string;
  if (useLL && basis.loadList && llNorm) {
    const sol = solveBeam(basis.loadList.support, llNorm.loads, L, 1);
    mx = { M: Math.abs(sol.Mext.value), w: Math.abs(sol.wext.value), fM: "Lastliste, siehe B-LL-MX", sM: `|M| bei x = ${fmt(sol.Mext.x)} mm`, sw: `Lastliste, siehe B-LL-FX: |E·I·w| bei x = ${fmt(sol.wext.x)} mm${basis.loadList.selfWeight ? "; Eigengewicht hier nicht berücksichtigt" : ""}` };
    ref = LOADLIST_SUPPORTS[basis.loadList.support].ref;
  } else {
    const c = caseId === "LL" ? "EQ" : caseId;
    mx = bendingMax(c, L, basis.F * 1000, basis.q, basis.a, 1); // mx.w = f·E·I in N·mm³, mx.M in N·mm
    ref = BENDING_CASES[c].ref;
  }
  const fzul = L / basis.fDiv;
  const basisTrace: CalcStep[] = [
    step("C-FZUL", "Zulässige Durchbiegung", "f_zul = L / n", `${fmt(L)} / ${fmt(basis.fDiv)}`, fzul, "mm"),
    step("C-MMAX", "Größtes Biegemoment (Lastfall Blatt 1)", "M_max nach Lastfall, siehe B-M-…", `${mx.fM}: ${mx.sM}`, mx.M, "N·mm", ref),
    step("C-WK", "Durchbiegungsbeiwert (Durchbiegung mal E·I)", "w_k = f·E·I nach Lastfall, siehe B-F-…", `${mx.sw} (mit E·I = 1)`, mx.w, "N·mm³", ref),
    step("C-A0", "Ausgangsprofil Blatt 1: Fläche", "A₀ (siehe Q-…)", `${fmt(sec0.A)}`, sec0.A, "mm²"),
    step("C-I0", "Ausgangsprofil Blatt 1: Flächenträgheitsmoment", "I₀ (siehe Q-…)", `${fmt(sec0.I)}`, sec0.I, "mm⁴"),
    step("C-W0", "Ausgangsprofil Blatt 1: Widerstandsmoment", "W₀ (siehe Q-…)", `${fmt(sec0.W)}`, sec0.W, "mm³"),
  ];
  const rows = candidates.filter((m) => m.E !== null && m.rho !== null).map((m): ConflictRow => {
    const E = (m.E as number) * 1000, rho = m.rho as number;
    const sd = strengthDesign(repo, m, true, { RE: "lower", RM: "lower" }, { RE: null, RM: null });
    // zulässige Spannung wie im Nachweis von Blatt 1
    const opts: Array<{ R: number; S: number; b: "R_p" | "R_m" | "σ_bB" }> = [];
    const rp = sd.Rp?.v ?? null, rm = sd.Rm?.v ?? null;
    if (!sd.brittle && rp !== null) opts.push({ R: rp, S: basis.SFreq, b: "R_p" });
    if (rm !== null) opts.push({ R: rm, S: basis.SBreq, b: sd.Rm?.prop === "P-BB" ? "σ_bB" : "R_m" });
    const gov = opts.length ? opts.reduce((x, y) => (y.R / y.S < x.R / x.S ? y : x)) : null;
    const sigmaZul = gov ? gov.R / gov.S : null;
    const note = !sd.brittle && rp === null && rm !== null ? "R_p ohne Auslegungswert, nur R_m / S_B (Nachweis in Blatt 1 unvollständig)" : null;

    const sSt = Math.pow(mx.w / (E * fzul * sec0.I), 1 / 4);
    const sF = sigmaZul !== null ? Math.cbrt(mx.M / (sigmaZul * sec0.W)) : null;
    const mOf = (s: number) => rho * sec0.A * s * s * 1e-9 * L;
    const mStiff = mOf(sSt), mStrength = sF !== null ? mOf(sF) : null;
    const mass = mStrength !== null ? Math.max(mStiff, mStrength) : null;
    const cost = mass !== null && m.price !== null ? mass * m.price : null;
    const active: ConflictRow["active"] = mStrength === null ? "Festigkeit nicht belegt" : mStiff >= mStrength ? "Steifigkeit" : "Festigkeit";
    const Z = mass !== null && cost !== null ? alpha * mass + cost : null;

    const trace: CalcStep[] = [
      step("C-SST", "Skalierung aus Steifigkeit (I ∝ s⁴)", "s_St = (w_k / (E·f_zul·I₀))^(1/4)", `(${fmt(mx.w)} / (${fmt(E)}·${fmt(fzul)}·${fmt(sec0.I)}))^(1/4)`, sSt, "–", REF_A),
      step("C-MST", "Masse aus Steifigkeit", "m_St = ρ·A₀·s_St²·L", `${fmt(rho)} kg/m³ · ${fmt(sec0.A)} mm² · ${fmt(sSt)}² · ${fmt(L)} mm`, mStiff, "kg"),
    ];
    if (gov && sigmaZul !== null && sF !== null && mStrength !== null && mass !== null) {
      const alt = opts.filter((o) => o !== gov).map((o) => `${o.b} / S = ${fmt(o.R)} / ${fmt(o.S)} = ${fmt(o.R / o.S)}`);
      trace.push(
        step("C-SZUL", "Zulässige Biegespannung (wie Nachweis Blatt 1)", "σ_zul = min(R_p / S_F, R_m / S_B)", `${gov.b} / S = ${fmt(gov.R)} / ${fmt(gov.S)}${alt.length ? ` (statt ${alt.join(", ")})` : ""}`, sigmaZul, "MPa", "unterer Auslegungswert; spröde: σ_bB bzw. R_m"),
        step("C-SF", "Skalierung aus Festigkeit (W ∝ s³)", "s_F = (M_max / (σ_zul·W₀))^(1/3)", `(${fmt(mx.M)} / (${fmt(sigmaZul)}·${fmt(sec0.W)}))^(1/3)`, sF, "–", REF_A),
        step("C-MF", "Masse aus Festigkeit", "m_F = ρ·A₀·s_F²·L", `${fmt(rho)} kg/m³ · ${fmt(sec0.A)} mm² · ${fmt(sF)}² · ${fmt(L)} mm`, mStrength, "kg"),
        step("C-M", "Maßgebende Masse (aktive Randbedingung)", "m = max(m_St, m_F)", `max(${fmt(mStiff)}; ${fmt(mStrength)}) → ${active}`, mass, "kg", REF_A),
      );
      if (cost !== null && Z !== null) {
        trace.push(
          step("C-C", "Werkstoffkosten", "C = m·C_m", `${fmt(mass)} kg · ${fmt(m.price as number)} €/kg`, cost, "€"),
          step("C-Z", "Gesamtwertung", "Z = α·m + C", `${fmt(alpha)} €/kg · ${fmt(mass)} kg + ${fmt(cost)} €`, Z, "€", REF_B),
        );
      }
    }
    return { m, sStiff: sSt, sStrength: sF, mStiff, mStrength, mass, active, cost, R: gov?.R ?? null, Sreq: gov?.S ?? basis.SFreq, sigmaZul, strengthBasis: gov?.b ?? null, note, Z, trace };
  });
  return { caseId, fzul, caseSubstituted, basisTrace, rows };
}

/** Pareto-Front: kein anderer Kandidat ist zugleich leichter und billiger. */
export function paretoFront(rows: ConflictRow[]): ConflictRow[] {
  const v = rows.filter((r) => r.mass !== null && r.cost !== null).sort((a, b) => (a.mass as number) - (b.mass as number));
  let best = Infinity; const front: ConflictRow[] = [];
  for (const r of v) if ((r.cost as number) < best) { best = r.cost as number; front.push(r); }
  return front;
}

/** Zeilen mit Wertung, aufsteigend nach Z (Empfehlung = erster Eintrag). Gleichstand: nach Werkstoff-ID. */
export function byScore(rows: ConflictRow[]): ConflictRow[] {
  return rows.filter((r) => r.Z !== null).sort((a, b) => (a.Z as number) - (b.Z as number) || a.m.id.localeCompare(b.m.id));
}

/** Zeilen mit Masse, aufsteigend nach maßgebender Masse. */
export function byMass(rows: ConflictRow[]): ConflictRow[] {
  return rows.filter((r) => r.mass !== null).sort((a, b) => (a.mass as number) - (b.mass as number) || a.m.id.localeCompare(b.m.id));
}

/** Austauschkonstanten als Größenordnung nach Ashby Tab. 9.3 (Werte 1999, US-$, hier als €/kg). */
export const ALPHA_PRESETS: ReadonlyArray<readonly [number, string]> = [[0, "ortsfest"], [1, "PKW"], [7, "LKW"], [300, "Flugzeug"], [5000, "Raumfahrt"]];
