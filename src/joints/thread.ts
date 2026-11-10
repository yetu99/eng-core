/**
 * Gewinde und Querschnitte der Schraube (Modul verbindungen, Präfix SV, eng-core 0.18.0), Konzept fachtools/konzept_sv.md Abschn. 4.1.
 * Metrisches ISO-Gewinde 60° (DIN 13-1, Feingewinde Roloff TB 8-2 als Option). Einheiten mm, mm².
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import type { FdThread } from "./boltData";

export const SV_REF_VDI = "VDI 2230-1:2015 (Q237)";
export const SV_REF_DIN13 = "DIN 13-1:1999 (Q238)";
export const SV_REF_ISO898 = "ISO 898-1:2013 (Q239)";
export const SV_REF_ISO3506 = "ISO 3506-1:2020 (Q247)";
export const SV_REF_EKB = "Roloff/Matek EKB 9 (Q246)";
export const SV_REF_ROLOFF = "Roloff/Matek 27 (Q219)";
/** Relative Toleranz der Grenzvergleiche (wie PV, O-pv2). */
export const SV_REL_TOL = 1e-9;

export interface ThreadProps {
  d: number; P: number; d2: number; d3: number; D1: number; series: "regel" | "fein";
  /** Spannungsquerschnitt, Kernquerschnitt, Nennquerschnitt in mm² (gerechnet, nicht Tabellenwert) */
  As: number; Ad3: number; AN: number;
  /** Durchmesser zu A_s (d_S = (d₂ + d₃)/2) und Steigungswinkel in Grad */
  dS: number; phiDeg: number;
}

/** Querschnitte aus d₂, d₃ (A_s gerechnet, VDI Tab. A11 und Roloff TB 8-1 nur als Vergleich P-SV0). */
export function threadProps(t: FdThread): ThreadProps {
  const dS = (t.d2_mm + t.d3_mm) / 2;
  return { d: t.d_mm, P: t.p_mm, d2: t.d2_mm, d3: t.d3_mm, D1: t.d1_mm, series: t.series, As: Math.PI / 4 * dS * dS, Ad3: Math.PI / 4 * t.d3_mm * t.d3_mm,
    AN: Math.PI / 4 * t.d_mm * t.d_mm, dS, phiDeg: Math.atan(t.p_mm / (Math.PI * t.d2_mm)) * 180 / Math.PI };
}

/** Rechenschritte Gewinde (SV-AS, SV-A3, SV-AN, SV-PHI; bei Feingewinde SV-OPT-FEIN). */
export function threadSteps(T: ThreadProps, t: FdThread): CalcStep[] {
  const name = t.series === "regel" ? `M${fmt(T.d)}` : `M${fmt(T.d)}×${fmt(T.P)}`;
  const src = t.series === "regel" ? `${SV_REF_DIN13} S. 3` : `${SV_REF_ROLOFF} TB 8-2`;
  const out: CalcStep[] = [];
  if (t.series === "fein") out.push(step("SV-OPT-FEIN", "Feingewinde (Option)", "Datenzeile fd_threads Reihe fein, gleiche Formeln wie Regelgewinde",
    `${name}: P ${fmt(T.P)}, d₂ ${fmt(T.d2)}, d₃ ${fmt(T.d3)} mm`, T.P, "mm", "DIN 13-2 bis 13-11; " + `${SV_REF_ROLOFF} TB 8-2`));
  out.push(
    step("SV-AS", "Spannungsquerschnitt", "A_s = π/4·((d₂ + d₃)/2)²", `${name}: A_s = π/4·((${fmt(T.d2)} + ${fmt(T.d3)})/2)² = ${fmt(T.As)} mm² (Tabelle ${fmt(t.as_mm2)})`, T.As, "mm²", `${SV_REF_ROLOFF} (8.34); ${SV_REF_VDI} Tab. A11; ${src}`),
    step("SV-A3", "Kernquerschnitt", "A_d3 = π/4·d₃²", `A_d3 = π/4·${fmt(T.d3)}² = ${fmt(T.Ad3)} mm²`, T.Ad3, "mm²", `${SV_REF_VDI} Abschn. 5.1.1`),
    step("SV-AN", "Nennquerschnitt", "A_N = π/4·d²", `A_N = π/4·${fmt(T.d)}² = ${fmt(T.AN)} mm²`, T.AN, "mm²", `${SV_REF_VDI} Abschn. 5.1.1`),
    step("SV-PHI", "Steigungswinkel", "φ = arctan(P/(π·d₂))", `φ = arctan(${fmt(T.P)}/(π·${fmt(T.d2)})) = ${fmt(T.phiDeg, 4)}°`, T.phiDeg, "°", `${SV_REF_ROLOFF} (8.1)`),
  );
  return out;
}
