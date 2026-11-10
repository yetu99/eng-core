/**
 * Montagevorspannkraft und Anziehmoment (Modul verbindungen, Präfix SV, eng-core 0.18.0), Konzept Abschn. 4.4, 4.5, 4.9.
 * F_M,zul nach VDI (R7/2) mit μ_G,min (Gestaltänderungsenergie, Torsion aus dem Gewindemoment), M_A nach (R13/1) und exakt
 * nach Roloff (8.24) mit tan ρ′ = μ_G/cos 30°, Losdrehmoment Roloff S. 277 f. Einheiten N, mm, N·mm.
 */
import type { ThreadProps } from "./thread";

/** Klammerausdruck der Gewindereibung: P/(π·d₂) + 1,155·μ_G (VDI R7, Gl. (154)). */
export const threadTerm = (T: Pick<ThreadProps, "P" | "d2">, muG: number): number => T.P / (Math.PI * T.d2) + 1.155 * muG;
/** F_M,zul = A₀·ν·R_p0,2min/√(1 + 3·[3/2·d₂/d₀·(P/(π·d₂) + 1,155·μ_G,min)]²) (VDI (R7/2), Roloff (8.32), (8.33)). */
export function fmZul(T: Pick<ThreadProps, "P" | "d2">, d0: number, nu: number, Rp: number, muG: number): number {
  const A0 = Math.PI / 4 * d0 * d0, k = 1.5 * T.d2 / d0 * threadTerm(T, muG);
  return A0 * nu * Rp / Math.sqrt(1 + 3 * k * k);
}
/** Gewindemoment M_G = F·d₂/2·(P/(π·d₂) + 1,155·μ_G) (VDI Gl. (154), Roloff (8.23)). */
export const threadTorque = (F: number, T: Pick<ThreadProps, "P" | "d2">, muG: number): number => F * T.d2 / 2 * threadTerm(T, muG);
/** M_A = F·(0,16·P + 0,58·d₂·μ_G + D_Km/2·μ_K) (VDI (R13/1), Roloff (8.26)). */
export const tighteningTorque = (F: number, T: Pick<ThreadProps, "P" | "d2">, muG: number, DKm: number, muK: number): number => F * (0.16 * T.P + 0.58 * T.d2 * muG + DKm / 2 * muK);
const RHO = (muG: number) => Math.atan(muG / Math.cos(Math.PI / 6));
/** M_A exakt = F·[d₂/2·tan(φ + ρ′) + D_Km/2·μ_K] (Roloff (8.24)); Anteile Steigung, Gewindereibung, Auflagereibung (G5). */
export function tighteningTorqueExact(F: number, T: Pick<ThreadProps, "P" | "d2">, muG: number, DKm: number, muK: number): { MA: number; pitch: number; thread: number; bearing: number } {
  const phi = Math.atan(T.P / (Math.PI * T.d2)), MG = F * T.d2 / 2 * Math.tan(phi + RHO(muG)), pitch = F * T.P / (2 * Math.PI), bearing = F * DKm / 2 * muK;
  return { MA: MG + bearing, pitch, thread: MG - pitch, bearing };
}
/** Losdrehmoment M_L = F_V·[d₂/2·tan(ρ′ − φ) + D_Km/2·μ_K] (Roloff S. 277) und inneres Losdrehmoment M_Li = F_V·P/(2π) (S. 278). */
export function looseningTorque(FV: number, T: Pick<ThreadProps, "P" | "d2">, muG: number, DKm: number, muK: number): { ML: number; MLi: number } {
  const phi = Math.atan(T.P / (Math.PI * T.d2));
  return { ML: FV * (T.d2 / 2 * Math.tan(RHO(muG) - phi) + DKm / 2 * muK), MLi: FV * T.P / (2 * Math.PI) };
}
/** Polares Widerstandsmoment W_P = π/16·d₀³ (VDI Gl. (156)). */
export const polarModulus = (d0: number): number => Math.PI / 16 * d0 * d0 * d0;
/** Dauerhaltbarkeit schlussvergütet σ_ASV = 0,85·(150/d + 45) (VDI (R9/5-1), Roloff (8.21)). */
export const sigmaASV = (d: number): number => 0.85 * (150 / d + 45);
/** Reduktionsfaktor κ nach Roloff zu (8.2) (Tabelle μ_G 0,08 bis 0,20, linear interpoliert, Randwerte gehalten). */
export const KAPPA_MU = [0.08, 0.1, 0.12, 0.14, 0.2] as const;
export const KAPPA_SHAFT = [1.11, 1.15, 1.19, 1.24, 1.41] as const;
export const KAPPA_REDUCED = [1.15, 1.2, 1.25, 1.32, 1.52] as const;
export function kappaRoloff(muG: number, reduced: boolean): number {
  const ys = reduced ? KAPPA_REDUCED : KAPPA_SHAFT, xs = KAPPA_MU;
  if (muG <= xs[0]) return ys[0]; if (muG >= xs[xs.length - 1]!) return ys[ys.length - 1]!;
  for (let i = 0; i < xs.length - 1; i++) if (muG <= xs[i + 1]!) return ys[i]! + (muG - xs[i]!) / (xs[i + 1]! - xs[i]!) * (ys[i + 1]! - ys[i]!);
  return ys[ys.length - 1]!;
}
