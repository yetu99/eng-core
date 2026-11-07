/**
 * Viskosität von Ölen über der Temperatur nach Ubbelohde-Walther (Modul fluid, RH b, eng-core 0.13.0, Entscheidung R21).
 * Dubbel 26 Bd. 1 Kap. 33 (S. 681): lg lg(ν + C) = K − m·lg T, ν in mm²/s, T in K, C = 0,6 bis 0,9 für Mineralöle
 * (Vorschlag 0,8, freigegeben 06.11.2026). K und m aus zwei Stützpunkten (Datenblatt), zwischen den Stützpunkten
 * gerechnet, außerhalb von [T₁ − 20 K, T₂ + 20 K] Warnung „Extrapolation“. Beispiele HLP aus DIN 51524-2 Tab. 2 (fd 1.1).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import type { FdOilGrade, FdRepo } from "./fdData";

export const WALTHER_C_DEFAULT = 0.8;
export const WALTHER_C_RANGE = { min: 0.6, max: 0.9 } as const;
/** Zulässiger Abstand außerhalb der Stützpunkte ohne Extrapolationswarnung in K. */
export const WALTHER_MARGIN = 20;

const REF = "Dubbel 26 Bd. 1 Kap. 33 (S. 681)";

export interface WaltherInput {
  /** Stützpunkte: Temperatur in K, kinematische Viskosität in m²/s (SI). */
  T1: number; nu1: number; T2: number; nu2: number;
  /** Konstante C (Dubbel: 0,6 bis 0,9 für Mineralöle). */
  C: number;
}
export interface WaltherResult { K: number; m: number; nu: number; steps: CalcStep[]; errors: string[]; warnings: string[] }

const W = (nuMm: number, C: number): number => Math.log10(Math.log10(nuMm + C));

/** Konstanten K und m aus zwei Stützpunkten (ν in mm²/s). */
export function waltherConstants(T1: number, nu1: number, T2: number, nu2: number, C: number): { K: number; m: number } {
  const m = (W(nu1, C) - W(nu2, C)) / (Math.log10(T2) - Math.log10(T1));
  return { m, K: W(nu1, C) + m * Math.log10(T1) };
}
/** ν in mm²/s bei T (K) aus K, m, C. */
export function waltherNu(T: number, K: number, m: number, C: number): number {
  return Math.pow(10, Math.pow(10, K - m * Math.log10(T))) - C;
}

/** ν(T) nach Walther mit Rechenweg; T in K, Ergebnis in m²/s. */
export function walther(inp: WaltherInput, T: number): WaltherResult {
  const errors: string[] = [], warnings: string[] = [];
  const { T1, T2, C } = inp, n1 = inp.nu1 * 1e6, n2 = inp.nu2 * 1e6;
  if (![T1, T2, n1, n2, C, T].every(Number.isFinite)) errors.push("Walther: alle Eingaben müssen Zahlen sein.");
  else {
    if (!(T1 > 0 && T2 > 0) || Math.abs(T2 - T1) < 1) errors.push("Walther: zwei verschiedene Stütztemperaturen (Abstand mindestens 1 K) nötig.");
    if (!(C > 0)) errors.push("Walther: C muss größer als 0 sein.");
    if (!(n1 + C > 1 && n2 + C > 1)) errors.push("Walther: ν + C muss an beiden Stützpunkten größer als 1 mm²/s sein (sonst ist lg lg nicht definiert).");
    if (!errors.length && (n1 - n2) * (T1 - T2) >= 0) errors.push("Walther: die Viskosität muss mit steigender Temperatur fallen.");
    if (!(T > 0)) errors.push("Walther: Temperatur muss größer als 0 K sein.");
  }
  if (errors.length) return { K: NaN, m: NaN, nu: NaN, steps: [], errors, warnings };
  if (C < WALTHER_C_RANGE.min || C > WALTHER_C_RANGE.max) warnings.push(`Walther: C = ${fmt(C)} außerhalb 0,6 bis 0,9 (Dubbel für Mineralöle).`);
  const { K, m } = waltherConstants(T1, n1, T2, n2, C);
  const nuMm = waltherNu(T, K, m, C);
  const lo = Math.min(T1, T2) - WALTHER_MARGIN, hi = Math.max(T1, T2) + WALTHER_MARGIN;
  const inside = T >= lo && T <= hi;
  if (!inside) warnings.push(`Walther: ${fmt(T - 273.15)} °C liegt außerhalb der Stützpunkte ±20 K (${fmt(lo - 273.15)} bis ${fmt(hi - 273.15)} °C), Extrapolation unsicher.`);
  const steps: CalcStep[] = [
    step("FS-WA-KM", "Walther-Konstanten aus zwei Stützpunkten", "m = [W(ν₁) − W(ν₂)]/(lg T₂ − lg T₁); K = W(ν₁) + m·lg T₁; W(ν) = lg lg(ν + C)",
      `ν₁ = ${fmt(n1, 6)} mm²/s bei ${fmt(T1, 6)} K, ν₂ = ${fmt(n2, 6)} mm²/s bei ${fmt(T2, 6)} K, C = ${fmt(C)}: m = ${fmt(m, 6)}, K = ${fmt(K, 6)}`, m, "1", REF),
    step("FS-WA-NU", "Kinematische Viskosität Öl (Walther)", "ν = 10^(10^(K − m·lg T)) − C (ν in mm²/s, T in K)",
      `ν = 10^(10^(${fmt(K, 6)} − ${fmt(m, 6)}·lg ${fmt(T, 6)})) − ${fmt(C)} = ${fmt(nuMm, 6)} mm²/s`, nuMm * 1e-6, "m²/s", REF),
    step("FS-WA-N", "Gültigkeitsbereich Walther", "T₁ − 20 K ≤ T ≤ T₂ + 20 K",
      `${fmt(lo, 6)} ≤ ${fmt(T, 6)} ≤ ${fmt(hi, 6)} K: ${inside ? "zwischen den Stützpunkten" : "Extrapolation"}`, T, "K", "Verfahren (R21)"),
  ];
  return { K, m, nu: nuMm * 1e-6, steps, errors, warnings };
}

/** Beispiel-Stützpunkte eines HLP-Öls aus DIN 51524-2 (ν40 = Klassenmitte ISO VG, ν100 = Mindestwert), SI. */
export function oilGradePoints(g: FdOilGrade): { T1: number; nu1: number; T2: number; nu2: number; note: string } {
  return { T1: 313.15, nu1: g.iso_vg * 1e-6, T2: 373.15, nu2: g.nu100_min_mm2_s * 1e-6,
    note: `${g.grade}: ν40 = ${fmt(g.iso_vg)} mm²/s (Klassenmitte ISO 3448), ν100 = ${fmt(g.nu100_min_mm2_s)} mm²/s (Mindestwert ${g.source_locator}, ${g.source_id}); Datenblatt des Öls verwenden` };
}
export function oilGrade(fd: FdRepo, id: string): FdOilGrade | undefined { return fd.oilGrade(id); }
