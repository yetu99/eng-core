/**
 * Stabnachweis im Fachwerk (Modul stabwerke, eng-core 0.23.0): Spannung σ = S/A (FW-SIG), Sicherheit gegen Fließen
 * S_F = R_p/|σ| für Zug und Druck (FW-SF), Knicken der Druckstäbe über den Kern (bucklingCheck: K-LK, K-LAM, K-LAMT,
 * K-SKJ bzw. K-SKE, K-FK, N-SK) mit Eulerfall 2 (β = 1, L_k = l, Gelenke an beiden Enden). Knicken aus der Ebene nur Hinweis.
 * Stabwerte aus Kernprofil und Werkstoffdatenbank über trussBarProps (FW-E4).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { sectionProps, type Dims, type SecType } from "../sections";
import { strengthDesign, type Repo } from "../materials";
import { bucklingCheck, type BucklingResult } from "../mechanics/buckling";
import { FW_REF_DUBBEL, FW_REF_GROSS2, type TrussBarInput } from "./truss";

export interface TrussBarCheck {
  sigma: number;
  SF: number | null;
  buck: BucklingResult | null;
  SK: number | null;
  /** größte Ausnutzung S_erf/S (Fließen, Knicken); 0 bei Nullstab, null ohne Kennwerte */
  util: number | null;
  ok: boolean | null;
  /** fehlende Kennwerte, Hinweise */
  notes: string[];
  steps: CalcStep[];
}

/** Nachweis eines Stabs (FW-SIG, FW-SF, Knicken über den Kern). */
export function trussBarCheck(bar: TrussBarInput, name: string, S: number, l: number, SFreq: number, SKreq: number, zero: boolean): TrussBarCheck {
  const steps: CalcStep[] = [], notes: string[] = [];
  const sigma = zero ? 0 : S / bar.A;
  steps.push(step("FW-SIG", "Stabspannung", "σ = S / A", `${name}: ${fmt(S)} / ${fmt(bar.A)}`, sigma, "MPa", `${FW_REF_GROSS2} Abschn. 1.1; ${FW_REF_DUBBEL} Abschn. 20.1`));
  let SF: number | null = null, buck: BucklingResult | null = null, SK: number | null = null;
  const utils: number[] = [];
  if (zero) return { sigma, SF, buck, SK, util: 0, ok: true, notes: ["Nullstab"], steps };
  if (bar.Rp) {
    SF = bar.Rp / Math.abs(sigma);
    steps.push(step("FW-SF", "Sicherheit gegen Fließen", "S_F = R_p / |σ|", `${name}: ${fmt(bar.Rp)} / |${fmt(sigma)}|`, SF, "–", "wie Werkbank (Zug und Druck)"));
    utils.push(SFreq / SF);
  } else notes.push("ohne R_p kein Fließnachweis");
  if (S < 0) {
    if (bar.iGyr) {
      const bk = bucklingCheck({ E: bar.E, Rp: bar.Rp ?? null, A: bar.A, i: bar.iGyr, L: l, eulerCase: 2, N: S, lkRef: "Fachwerkstab gelenkig an beiden Enden (Eulerfall 2), Knicken in der Ebene" });
      steps.push(...bk.steps, bk.check); notes.push(...bk.warnings);
      buck = bk.buck; SK = bk.buck.SK; utils.push(SKreq / SK);
    } else notes.push("ohne Trägheitsradius kein Knicknachweis");
  }
  const util = utils.length ? Math.max(...utils) : null;
  return { sigma, SF, buck, SK, util, ok: util === null ? null : util <= 1 + 1e-12, notes, steps };
}

export interface TrussBarProps { A: number; E: number; Rp: number | null; iGyr: number; errors: string[]; label: string }

/** Stabwerte aus Kernprofil (A, i) und Werkstoffdatenbank (E, R_p unterer Wert), Standardvariante. */
export function trussBarProps(repo: Repo, materialId: string, secType: SecType, dims: Dims): TrussBarProps {
  const mat = repo.byId(materialId);
  const sec = sectionProps(secType, dims);
  const errors = [...sec.errors];
  if (!mat) errors.push(`Unbekannter Werkstoff ${materialId}`);
  else if (mat.E === null) errors.push(`${mat.name}: E-Modul nicht belegt`);
  const S = mat ? strengthDesign(repo, mat, false, { RE: "lower", RM: "lower" }, { RE: null, RM: null }) : null;
  return { A: sec.A, E: mat?.E != null ? mat.E * 1000 : NaN, Rp: S?.Rp?.v ?? null, iGyr: sec.i, errors, label: mat ? `${mat.name} (${materialId})` : materialId };
}
