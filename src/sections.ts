/**
 * Querschnittsbibliothek. Einheiten: Längen in mm, Flächen mm², Flächenmomente mm⁴, Widerstandsmomente mm³.
 * Biegung um die horizontale Schwerachse (Last senkrecht). Formfaktoren nach Ashby (1999), Kap. 7.2.
 */
import { fmt } from "./format";
import { step, type CalcStep } from "./trace";

export type SecType = "rund_voll" | "rund_hohl" | "rechteck_voll" | "rechteck_hohl" | "dreieck_voll" | "dreieck_hohl";
export type Dims = Record<string, number>;

export interface SectionDef {
  label: string;
  /** [Schlüssel, Bezeichnung, Standardwert in mm] */
  fields: ReadonlyArray<readonly [string, string, number]>;
}

export const SECTIONS: Readonly<Record<SecType, SectionDef>> = {
  rund_voll: { label: "Rund voll", fields: [["D", "Durchmesser D", 40]] },
  rund_hohl: { label: "Rund hohl", fields: [["D", "Außen-Ø D", 60], ["t", "Wandstärke t", 4]] },
  rechteck_voll: { label: "Rechteck voll", fields: [["b", "Breite b", 30], ["h", "Höhe h", 60]] },
  rechteck_hohl: { label: "Rechteck hohl", fields: [["b", "Breite b", 40], ["h", "Höhe h", 80], ["t", "Wandstärke t", 4]] },
  dreieck_voll: { label: "Dreieck voll", fields: [["a", "Seitenlänge a", 60]] },
  dreieck_hohl: { label: "Dreieck hohl", fields: [["a", "Seitenlänge a", 90], ["t", "Wandstärke t", 5]] },
};

export interface SectionProps {
  A: number;
  /** Flächenträgheitsmoment um die Biegeachse */
  I: number;
  /** kleinstes Flächenträgheitsmoment (Knicken) */
  Imin: number;
  /** größter Randabstand */
  e: number;
  /** Widerstandsmoment Biegung (maßgebender Rand) */
  W: number;
  /** Torsionsträgheitsmoment Iₜ */
  K: number;
  /** Torsionswiderstandsmoment Wₜ (τ_max = T / Wₜ) */
  Wt: number;
  /** Trägheitsradius i = √(I_min / A) */
  i: number;
  /** Faktor für die maximale Querkraftschubspannung τ_Q = κ·Q/A (Näherung) */
  kappa: number;
  phiBe: number;
  phiBf: number;
  phiTe: number;
  phiTf: number;
  trace: CalcStep[];
  errors: string[];
  notes: string[];
}

const PI = Math.PI, SQ3 = Math.sqrt(3), SQPI = Math.sqrt(Math.PI);

function need(d: Dims, k: string): number {
  const v = d[k];
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
}

/** Berechnet alle Querschnittswerte inklusive Rechenweg. Ungültige Geometrie → errors nicht leer. */
export function sectionProps(type: SecType, dims: Dims): SectionProps {
  const T: CalcStep[] = [], errors: string[] = [], notes: string[] = [];
  let A = NaN, I = NaN, Imin = NaN, e = NaN, W = NaN, K = NaN, Wt = NaN, kappa = NaN;

  for (const [k, label] of SECTIONS[type].fields) {
    const v = need(dims, k);
    if (!(v > 0)) errors.push(`${label} muss größer als 0 sein`);
  }
  if (errors.length) return empty(errors);

  switch (type) {
    case "rund_voll": {
      const D = need(dims, "D");
      A = PI * D * D / 4; I = PI * D ** 4 / 64; Imin = I; e = D / 2; W = I / e;
      K = PI * D ** 4 / 32; Wt = K / (D / 2); kappa = 4 / 3;
      T.push(step("Q-RV-A", "Fläche", "A = π·D²/4", `π·${fmt(D)}²/4`, A, "mm²", "Ashby App. A.2"));
      T.push(step("Q-RV-I", "Flächenträgheitsmoment", "I = π·D⁴/64", `π·${fmt(D)}⁴/64`, I, "mm⁴", "Ashby App. A.2"));
      T.push(step("Q-RV-W", "Widerstandsmoment Biegung", "W = I / (D/2)", `${fmt(I)} / ${fmt(e)}`, W, "mm³"));
      T.push(step("Q-RV-K", "Torsionsträgheitsmoment", "Iₜ = Iₚ = π·D⁴/32", `π·${fmt(D)}⁴/32`, K, "mm⁴", "Ashby App. A.6"));
      T.push(step("Q-RV-WT", "Widerstandsmoment Torsion", "Wₜ = Iₚ / (D/2)", `${fmt(K)} / ${fmt(D / 2)}`, Wt, "mm³"));
      break;
    }
    case "rund_hohl": {
      const D = need(dims, "D"), t = need(dims, "t"), d = D - 2 * t;
      if (!(d > 0)) return empty(["Wandstärke t muss kleiner als D/2 sein"]);
      A = PI * (D * D - d * d) / 4; I = PI * (D ** 4 - d ** 4) / 64; Imin = I; e = D / 2; W = I / e;
      K = PI * (D ** 4 - d ** 4) / 32; Wt = K / (D / 2); kappa = 2;
      T.push(step("Q-RH-d", "Innendurchmesser", "d = D − 2t", `${fmt(D)} − 2·${fmt(t)}`, d, "mm"));
      T.push(step("Q-RH-A", "Fläche", "A = π·(D² − d²)/4", `π·(${fmt(D)}² − ${fmt(d)}²)/4`, A, "mm²", "Ashby App. A.2"));
      T.push(step("Q-RH-I", "Flächenträgheitsmoment", "I = π·(D⁴ − d⁴)/64", `π·(${fmt(D)}⁴ − ${fmt(d)}⁴)/64`, I, "mm⁴", "Ashby App. A.2"));
      T.push(step("Q-RH-W", "Widerstandsmoment Biegung", "W = I / (D/2)", `${fmt(I)} / ${fmt(e)}`, W, "mm³"));
      T.push(step("Q-RH-K", "Torsionsträgheitsmoment", "Iₜ = π·(D⁴ − d⁴)/32", `π·(${fmt(D)}⁴ − ${fmt(d)}⁴)/32`, K, "mm⁴", "Ashby App. A.6"));
      T.push(step("Q-RH-WT", "Widerstandsmoment Torsion", "Wₜ = Iₜ / (D/2)", `${fmt(K)} / ${fmt(D / 2)}`, Wt, "mm³"));
      break;
    }
    case "rechteck_voll": {
      const b = need(dims, "b"), h = need(dims, "h");
      A = b * h; I = b * h ** 3 / 12; Imin = Math.min(b * h ** 3, h * b ** 3) / 12; e = h / 2; W = b * h * h / 6; kappa = 1.5;
      const a = Math.max(b, h) / 2, c = Math.min(b, h) / 2, r = c / a;
      K = a * c ** 3 * (16 / 3 - 3.36 * r * (1 - r ** 4 / 12));
      const fr = 1 + 0.6095 * r + 0.8865 * r ** 2 - 1.8023 * r ** 3 + 0.91 * r ** 4;
      Wt = 8 * a * c * c / (3 * fr);
      T.push(step("Q-RE-A", "Fläche", "A = b·h", `${fmt(b)}·${fmt(h)}`, A, "mm²"));
      T.push(step("Q-RE-I", "Flächenträgheitsmoment (Biegeachse horizontal)", "I = b·h³/12", `${fmt(b)}·${fmt(h)}³/12`, I, "mm⁴", "Ashby App. A.2"));
      T.push(step("Q-RE-W", "Widerstandsmoment Biegung", "W = b·h²/6", `${fmt(b)}·${fmt(h)}²/6`, W, "mm³"));
      T.push(step("Q-RE-K", "Torsionsträgheitsmoment", "Iₜ = a·c³·[16/3 − 3,36·(c/a)·(1 − c⁴/(12a⁴))],  a = max/2, c = min/2", `a = ${fmt(a)}, c = ${fmt(c)}`, K, "mm⁴", "Roark Tab. 10.1 Fall 4"));
      T.push(step("Q-RE-WT", "Widerstandsmoment Torsion", "Wₜ = 8·a·c² / (3·[1 + 0,6095r + 0,8865r² − 1,8023r³ + 0,91r⁴]),  r = c/a", `r = ${fmt(r)}`, Wt, "mm³", "Roark Tab. 10.1 Fall 4"));
      notes.push("Torsion Rechteck voll: Näherung nach Roark, Abweichung zur Reihenlösung unter 0,2 %");
      break;
    }
    case "rechteck_hohl": {
      const b = need(dims, "b"), h = need(dims, "h"), t = need(dims, "t"), bi = b - 2 * t, hi = h - 2 * t;
      if (!(bi > 0 && hi > 0)) return empty(["Wandstärke t muss kleiner als min(b, h)/2 sein"]);
      A = b * h - bi * hi; I = (b * h ** 3 - bi * hi ** 3) / 12; Imin = Math.min(I, (h * b ** 3 - hi * bi ** 3) / 12); e = h / 2; W = I / e;
      const Am = (b - t) * (h - t), Um = 2 * ((b - t) + (h - t));
      K = 4 * Am * Am * t / Um; Wt = 2 * Am * t; kappa = A / (2 * t * (h - t));
      T.push(step("Q-RR-A", "Fläche", "A = b·h − (b − 2t)·(h − 2t)", `${fmt(b)}·${fmt(h)} − ${fmt(bi)}·${fmt(hi)}`, A, "mm²"));
      T.push(step("Q-RR-I", "Flächenträgheitsmoment", "I = [b·h³ − (b − 2t)·(h − 2t)³]/12", `[${fmt(b)}·${fmt(h)}³ − ${fmt(bi)}·${fmt(hi)}³]/12`, I, "mm⁴"));
      T.push(step("Q-RR-W", "Widerstandsmoment Biegung", "W = I / (h/2)", `${fmt(I)} / ${fmt(e)}`, W, "mm³"));
      T.push(step("Q-RR-AM", "Von der Wandmittellinie umschlossene Fläche", "Aₘ = (b − t)·(h − t)", `${fmt(b - t)}·${fmt(h - t)}`, Am, "mm²", "Bredt"));
      T.push(step("Q-RR-K", "Torsionsträgheitsmoment (dünnwandig)", "Iₜ = 4·Aₘ²·t / Uₘ", `4·${fmt(Am)}²·${fmt(t)} / ${fmt(Um)}`, K, "mm⁴", "1. Bredtsche Formel"));
      T.push(step("Q-RR-WT", "Widerstandsmoment Torsion", "Wₜ = 2·Aₘ·t", `2·${fmt(Am)}·${fmt(t)}`, Wt, "mm³", "1. Bredtsche Formel"));
      notes.push("Torsion Hohlrechteck nach Bredt: gültig für t ≪ b, h; τ_Q als Näherung über die Stege");
      break;
    }
    case "dreieck_voll": {
      const a = need(dims, "a");
      A = SQ3 / 4 * a * a; I = SQ3 * a ** 4 / 96; Imin = I; e = a / SQ3; W = I / e; kappa = 1.5;
      K = SQ3 * a ** 4 / 80; Wt = a ** 3 / 20;
      T.push(step("Q-DV-A", "Fläche", "A = √3/4·a²", `√3/4·${fmt(a)}²`, A, "mm²"));
      T.push(step("Q-DV-I", "Flächenträgheitsmoment (Schwerachse)", "I = √3·a⁴/96", `√3·${fmt(a)}⁴/96`, I, "mm⁴", "Roark Tab. A.1"));
      T.push(step("Q-DV-e", "Randabstand zur Spitze", "e = a/√3", `${fmt(a)}/√3`, e, "mm"));
      T.push(step("Q-DV-W", "Widerstandsmoment Biegung (Spitze)", "W = I/e = a³/32", `${fmt(a)}³/32`, W, "mm³"));
      T.push(step("Q-DV-K", "Torsionsträgheitsmoment", "Iₜ = √3·a⁴/80", `√3·${fmt(a)}⁴/80`, K, "mm⁴", "Roark Tab. 10.1 Fall 7"));
      T.push(step("Q-DV-WT", "Widerstandsmoment Torsion", "Wₜ = a³/20", `${fmt(a)}³/20`, Wt, "mm³", "Roark Tab. 10.1 Fall 7"));
      notes.push("Dreieck unsymmetrisch: Randspannung an der Basis halb so groß wie an der Spitze, gerechnet wird mit der Spitze");
      break;
    }
    case "dreieck_hohl": {
      const a = need(dims, "a"), t = need(dims, "t"), ai = a - 2 * SQ3 * t;
      if (!(ai > 0)) return empty(["Wandstärke t zu groß für die Seitenlänge a"]);
      A = SQ3 / 4 * (a * a - ai * ai); I = SQ3 * (a ** 4 - ai ** 4) / 96; Imin = I; e = a / SQ3; W = I / e;
      const am = a - SQ3 * t, Am = SQ3 / 4 * am * am, Um = 3 * am;
      K = 4 * Am * Am * t / Um; Wt = 2 * Am * t; kappa = 2;
      T.push(step("Q-DH-ai", "Innere Seitenlänge", "aᵢ = a − 2√3·t", `${fmt(a)} − 2√3·${fmt(t)}`, ai, "mm"));
      T.push(step("Q-DH-A", "Fläche", "A = √3/4·(a² − aᵢ²)", `√3/4·(${fmt(a)}² − ${fmt(ai)}²)`, A, "mm²"));
      T.push(step("Q-DH-I", "Flächenträgheitsmoment", "I = √3·(a⁴ − aᵢ⁴)/96", `√3·(${fmt(a)}⁴ − ${fmt(ai)}⁴)/96`, I, "mm⁴"));
      T.push(step("Q-DH-W", "Widerstandsmoment Biegung (Spitze)", "W = I / (a/√3)", `${fmt(I)} / ${fmt(e)}`, W, "mm³"));
      T.push(step("Q-DH-K", "Torsionsträgheitsmoment (Bredt)", "Iₜ = 4·Aₘ²·t / Uₘ,  aₘ = a − √3·t", `aₘ = ${fmt(am)}`, K, "mm⁴", "1. Bredtsche Formel"));
      T.push(step("Q-DH-WT", "Widerstandsmoment Torsion", "Wₜ = 2·Aₘ·t", `2·${fmt(Am)}·${fmt(t)}`, Wt, "mm³", "1. Bredtsche Formel"));
      notes.push("Torsion Hohldreieck nach Bredt: gültig für t ≪ a");
      break;
    }
  }
  const i = Math.sqrt(Imin / A);
  const phiBe = 4 * PI * I / (A * A), phiBf = 4 * SQPI * W / A ** 1.5, phiTe = 2 * PI * K / (A * A), phiTf = 2 * SQPI * Wt / A ** 1.5;
  T.push(step("Q-i", "Trägheitsradius (min.)", "i = √(I_min / A)", `√(${fmt(Imin)} / ${fmt(A)})`, i, "mm"));
  T.push(step("F-BE", "Formfaktor Biegung, elastisch", "φ_B^e = 4π·I / A²", `4π·${fmt(I)} / ${fmt(A)}²`, phiBe, "–", "Ashby Gl. 7.4"));
  T.push(step("F-BF", "Formfaktor Biegung, Versagen", "φ_B^f = 4√π·W / A^1,5", `4√π·${fmt(W)} / ${fmt(A)}^1,5`, phiBf, "–", "Ashby Gl. 7.11"));
  T.push(step("F-TE", "Formfaktor Torsion, elastisch", "φ_T^e = 2π·Iₜ / A²", `2π·${fmt(K)} / ${fmt(A)}²`, phiTe, "–", "Ashby Gl. 7.8"));
  T.push(step("F-TF", "Formfaktor Torsion, Versagen", "φ_T^f = 2√π·Wₜ / A^1,5", `2√π·${fmt(Wt)} / ${fmt(A)}^1,5`, phiTf, "–", "Ashby Gl. 7.14"));
  return { A, I, Imin, e, W, K, Wt, i, kappa, phiBe, phiBf, phiTe, phiTf, trace: T, errors, notes };
}

function empty(errors: string[]): SectionProps {
  return { A: NaN, I: NaN, Imin: NaN, e: NaN, W: NaN, K: NaN, Wt: NaN, i: NaN, kappa: NaN, phiBe: NaN, phiBf: NaN, phiTe: NaN, phiTf: NaN, trace: [], errors, notes: [] };
}

/** Höhe des Querschnitts in Lastrichtung (senkrecht) in mm, für die Schlankheit L/h (Eigenfrequenz, Hinweis Timoshenko). */
export function sectionHeight(type: SecType, dims: Dims): number {
  switch (type) {
    case "rund_voll": case "rund_hohl": return need(dims, "D");
    case "rechteck_voll": case "rechteck_hohl": return need(dims, "h");
    case "dreieck_voll": case "dreieck_hohl": return need(dims, "a") * SQ3 / 2;
  }
}
