/**
 * Werkstoffgruppen und Einflussfaktoren für den Ermüdungsnachweis (eng-core 0.9.0, Konzept 0.9.0 Abschnitt 3 und 4.3).
 *
 * Verfahren nach Roloff/Matek Maschinenelemente, 27. Aufl. 2025, Kap. 3.4 bis 3.7 (Aufbau nach DIN 743),
 * Kennwerte der Werkstoffgruppen nach FKM-Richtlinie 7. Ausg. in der Wiedergabe von Roloff/Matek TB 3-2, TB 3-7b,
 * TB 3-10, TB 3-11, TB 3-15, TB 3-16a, Steibler (2021) Anhang A6, A8, A11, A14 und Haibach (2006) Tab. 3.1-2.
 * Eigene Umsetzung, keine Normtexte. Einheiten: mm, MPa.
 */
import type { Material } from "../materials";

export type FatigueGroupId = "stahl" | "stahl_nr" | "austenit" | "gs" | "gjs" | "gjm" | "gjl" | "al_knet" | "al_guss" | "andere";
/** Technologischer Größeneinfluss: Kurvenfamilie (Roloff TB 3-10a, b). */
export type KtFamily = "baustahl" | "verguetung" | "einsatz" | "nichtrostend" | "gs" | "gjs" | "gjm" | "gjl" | "keiner";

export interface FatigueGroup {
  id: FatigueGroupId;
  label: string;
  /** Zug-Druck-Wechselfestigkeitsfaktor f_Wσ (null: keine Abschätzung, nur Datenbank oder manuell) */
  fWs: ((RmN: number) => number) | null;
  fWsText: string;
  /** Schub- bzw. Torsionsfaktor f_τ = f_Wτ (Roloff TB 3-2, gleiche Werte) */
  fTau: number;
  aG: number; bG: number;
  aR: number; RmNmin: number;
  aM: number; bM: number;
  /** Wöhlerlinie Typ I (Stahl, Eisenguss) oder Typ II (Aluminium, austenitischer Stahl, Ersatzgruppe) */
  woehler: "I" | "II";
  cast: boolean;
  /** Stahl: Wechselfestigkeiten nach DIN 743 (0,5 / 0,4 / 0,3 · R_m) */
  steel: boolean;
  src: string;
}

const SRC = "Roloff/Matek 27 TB 3-2, 3-7b, 3-15, 3-16a; Steibler 2021 Anh. A6, A8, A11, A14; Haibach 2006 Tab. 3.1-2";

function g(id: FatigueGroupId, label: string, fWs: FatigueGroup["fWs"], fWsText: string, fTau: number, aG: number, bG: number, aR: number, RmNmin: number, aM: number, bM: number, woehler: "I" | "II", cast: boolean, steel = false): FatigueGroup {
  return { id, label, fWs, fWsText, fTau, aG, bG, aR, RmNmin, aM, bM, woehler, cast, steel, src: SRC };
}

/** Konstanten je Gruppe. a_M in 1/MPa (Roloff TB 3-15 in mm²/N). */
export const FATIGUE_GROUPS: Readonly<Record<FatigueGroupId, FatigueGroup>> = {
  stahl: g("stahl", "Stahl (Walz- und Schmiedestahl)", () => 0.4, "0,40 (DIN 743)", 0.58, 0.5, 2700, 0.22, 400, 0.00035, -0.1, "I", false, true),
  stahl_nr: g("stahl_nr", "Stahl nichtrostend (ferritisch, martensitisch, Duplex)", () => 0.4, "0,40 (DIN 743)", 0.58, 0.4, 2400, 0.22, 400, 0.00035, -0.1, "I", false, true),
  austenit: g("austenit", "Stahl nichtrostend austenitisch", () => 0.4, "0,40 (DIN 743)", 0.58, 0.4, 2400, 0.22, 400, 0.00035, -0.1, "II", false, true),
  gs: g("gs", "Stahlguss (GS)", () => 0.34, "0,34", 0.58, 0.25, 2000, 0.2, 400, 0.00035, 0.05, "I", true),
  gjs: g("gjs", "Gusseisen mit Kugelgraphit (GJS)", (RmN) => 0.25 + 70 / RmN, "0,25 + 70 MPa / R_mN", 0.65, 0.05, 3200, 0.16, 400, 0, 0.4, "I", true),
  gjm: g("gjm", "Temperguss (GJM)", () => 0.3, "0,30", 0.75, -0.05, 3200, 0.12, 350, 0.00035, 0.13, "I", true),
  gjl: g("gjl", "Gusseisen mit Lamellengraphit (GJL)", () => 0.34, "0,34", 1.0, -0.05, 3200, 0.06, 100, 0, 0.5, "I", true),
  al_knet: g("al_knet", "Aluminium-Knetlegierung", () => 0.3, "0,30", 0.58, 0.05, 850, 0.22, 133, 0.001, -0.04, "II", false),
  al_guss: g("al_guss", "Aluminium-Gusslegierung", () => 0.3, "0,30", 0.75, -0.05, 3200, 0.2, 133, 0.001, 0.2, "II", true),
  andere: g("andere", "Ersatzgruppe (Cu, Ti, Ni, Mg, Zn): Konstanten Al-Knet", null, "keine Abschätzung", 0.58, 0.05, 850, 0.22, 133, 0.001, -0.04, "II", false),
};

export interface GroupChoice { group: FatigueGroup; cast: boolean; kt: KtFamily; note: string | null }

/** Zuordnung aus der WDB-Subklasse. null = nicht unterstützt (Polymer, Keramik, Verbund, Naturwerkstoff). */
export function fatigueGroupOf(mat: Material): GroupChoice | null {
  if (mat.cls !== "Metall") return null;
  const s = (mat.subclass ?? "").toLowerCase();
  const G = FATIGUE_GROUPS;
  if (s.startsWith("stahlguss")) return { group: G.gs, cast: true, kt: "gs", note: s.includes("nichtrostend") ? "nichtrostender Stahlguss: Konstanten Stahlguss, Wöhlerlinie Typ II" : null };
  if (s.startsWith("stahl")) {
    if (s.includes("nichtrostend austenitisch")) return { group: G.austenit, cast: false, kt: "nichtrostend", note: null };
    if (s.includes("nichtrostend")) return { group: G.stahl_nr, cast: false, kt: s.includes("martensitisch") ? "verguetung" : "nichtrostend", note: null };
    const kt: KtFamily = s.includes("einsatz") ? "einsatz"
      : /vergütung|feder|presshärtbar|wälzlager|formenstahl|arbeitsstahl|hochfester baustahl/.test(s) ? "verguetung" : "baustahl";
    return { group: G.stahl, cast: false, kt, note: null };
  }
  if (s.includes("gusseisen, globular")) return { group: G.gjs, cast: true, kt: "gjs", note: null };
  if (s.includes("gusseisen, lamellar")) return { group: G.gjl, cast: true, kt: "gjl", note: null };
  if (s.includes("temperguss")) return { group: G.gjm, cast: true, kt: "gjm", note: null };
  if (s.startsWith("aluminium") && s.includes("knet")) return { group: G.al_knet, cast: false, kt: "keiner", note: null };
  if (s.startsWith("aluminium") && s.includes("guss")) return { group: G.al_guss, cast: true, kt: "keiner", note: null };
  return { group: G.andere, cast: /guss/.test(s), kt: "keiner", note: "Werkstoff außerhalb der FKM-Gruppen: Konstanten der Al-Knetlegierungen als Ersatz, Wechselfestigkeit nur aus der Datenbank oder manuell" };
}

/** Wöhlerlinie Typ II auch für nichtrostenden Stahlguss (Hinweis in fatigueGroupOf). */
export function woehlerType(c: GroupChoice): "I" | "II" {
  return c.group.id === "gs" && c.note ? "II" : c.group.woehler;
}

/** Erforderliche Sicherheit gegen Dauerbruch (Roloff TB 3-16a): Walz- und Schmiedewerkstoff 1,5; Guss 2,1, zerstörungsfrei geprüft 1,9. */
export function sdRequired(c: GroupChoice, castTested: boolean): number {
  return c.cast ? (castTested ? 1.9 : 2.1) : 1.5;
}

export interface KtValue { Kt: number; formula: string; subst: string; id: string; note: string | null }

const lg = Math.log10;

/** Technologischer Größeneinfluss K_t für R_m (prop "m") bzw. R_p (prop "p"), d = d_eff in mm (Roloff TB 3-10a, b). */
export function ktValue(fam: KtFamily, prop: "m" | "p", d: number): KtValue {
  const steel = (c: number, d0: number, dLim: number, end: number, id: string, label: string): KtValue => {
    let note: string | null = null, dd = d;
    if (d > 500) { note = "d_eff > 500 mm: Wert bei 500 mm verwendet (außerhalb TB 3-10a)"; dd = 500; }
    const v = dd <= d0 ? 1 : dd < dLim ? 1 - c * lg(dd / d0) : end;
    const formula = `K_t = 1 für d ≤ ${d0} mm; 1 − ${String(c).replace(".", ",")}·lg(d/${d0} mm) für d < ${dLim} mm; ${String(end).replace(".", ",")} bis 500 mm (${label})`;
    return { Kt: v, formula, subst: `d_eff = ${dd} mm`, id, note };
  };
  const cast = (a: number, dN: number, id: string, label: string): KtValue => {
    const v = d <= dN ? 1 : (1 - 0.7686 * a * lg(d / 7.5)) / (1 - 0.7686 * a * lg(dN / 7.5));
    return { Kt: v, formula: "K_t = (1 − 0,7686·a_d·lg(d/7,5 mm)) / (1 − 0,7686·a_d·lg(d_eff,N/7,5 mm)) für d > d_eff,N, sonst 1 (Gusswerkstoffe)", subst: `${label}: a_d = ${String(a).replace(".", ",")}, d_eff,N = ${dN} mm, d_eff = ${d} mm`, id, note: null };
  };
  switch (fam) {
    case "baustahl": return prop === "m" ? steel(0.23, 100, 300, 0.89, "E-KT-B1", "Baustahl, Zugfestigkeit") : steel(0.26, 32, 300, 0.75, "E-KT-B2", "Baustahl, Streckgrenze");
    case "verguetung": return prop === "m" ? steel(0.26, 16, 300, 0.67, "E-KT-B3", "Vergütungsstahl, Zugfestigkeit") : steel(0.34, 16, 300, 0.57, "E-KT-B4", "Vergütungsstahl, Streckgrenze");
    case "einsatz": return steel(0.41, 16, 150, 0.6, "E-KT-B5", "Einsatzstahl, Zugfestigkeit und Streckgrenze");
    case "gs": return prop === "m" ? cast(0.15, 100, "E-KT-G", "Stahlguss, Zugfestigkeit") : cast(0.3, 100, "E-KT-G", "Stahlguss, Streckgrenze");
    case "gjs": return cast(0.15, 60, "E-KT-G", "GJS");
    case "gjm": return cast(0.15, 15, "E-KT-G", "GJM");
    case "gjl": {
      const dd = Math.max(d, 7.5);
      return { Kt: 1.207 * (dd / 7.5) ** -0.1922, formula: "K_t = 1,207·(d/7,5 mm)^−0,1922 (GJL, Zugfestigkeit)", subst: `d_eff = ${d} mm`, id: "E-KT-GJL", note: null };
    }
    case "nichtrostend": return { Kt: 1, formula: "K_t = 1 (keine Kurve in TB 3-10 für diesen Werkstoff, Annahme)", subst: "nichtrostender Stahl", id: "E-KT-1", note: "nichtrostender Stahl: technologischer Größeneinfluss nicht erfasst (K_t = 1)" };
    case "keiner": return { Kt: 1, formula: "K_t = 1 (keine Kurve in TB 3-10 für diesen Werkstoff, Annahme)", subst: "Aluminium bzw. Ersatzgruppe", id: "E-KT-1", note: null };
  }
}

/** Kurvenfamilie für den gleichwertigen Durchmesser nach Roloff TB 3-10c: 1 = Baustahl, GS; 2 = vergütet, Einsatz, Eisenguss. */
export function deffFamily(fam: KtFamily): 1 | 2 {
  return fam === "verguetung" || fam === "einsatz" || fam === "gjs" || fam === "gjl" || fam === "gjm" ? 2 : 1;
}

/** Geometrischer Größeneinfluss K_g (Roloff TB 3-10d, DIN 743): Biegung und Torsion. */
export function kgValue(d: number): number {
  if (d < 7.5) return 1;
  if (d >= 150) return 0.8;
  return 1 - 0.2 * lg(d / 7.5) / lg(20);
}

/** Rauheitsfaktor Normalspannung (FKM-Form; für Stahl identisch mit Roloff TB 3-11 bzw. DIN 743). Höchstens 1. */
export function krSigma(grp: FatigueGroup, Rz: number, Rm: number): number {
  if (Rz <= 1) return 1;
  const v = 1 - grp.aR * lg(Rz) * lg(2 * Rm / grp.RmNmin);
  return Math.min(1, v);
}

/** Stützzahl nach FKM (Roloff TB 3-7b, Haibach Gl. 3.1-14 bis 16), drei Bereiche des bezogenen Spannungsgefälles. */
export function supportNumber(grp: FatigueGroup, G: number, Rm: number): { n: number; id: string; formula: string } {
  const e = grp.aG + Rm / grp.bG;
  if (G <= 0.1) return { n: 1 + G * 10 ** -(e - 0.5), id: "E-N-1", formula: "n = 1 + G′·mm·10^−(a_G − 0,5 + R_m/b_G)  (G′ ≤ 0,1 mm⁻¹)" };
  if (G <= 1) return { n: 1 + Math.sqrt(G) * 10 ** -e, id: "E-N-2", formula: "n = 1 + √(G′·mm)·10^−(a_G + R_m/b_G)  (0,1 < G′ ≤ 1 mm⁻¹)" };
  return { n: 1 + G ** 0.25 * 10 ** -e, id: "E-N-3", formula: "n = 1 + ⁴√(G′·mm)·10^−(a_G + R_m/b_G)  (G′ > 1 mm⁻¹)" };
}
