/**
 * Knicken eines geraden Druckstabs (ab 0.23.0 aus compute.ts herausgelöst, Formeln und Rechenschritte unverändert).
 * Euler für λ ≥ λ_T = π·√(2E/R_p), sonst Johnson-Parabel (tangiert Euler bei σ = R_p/2); ohne R_p nur Euler.
 * Einheiten: N, mm, MPa. Genutzt von der Werkbank (Blatt 1) und vom Fachwerk (Modul stabwerke, Eulerfall 2, L_k = l).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";

/** Knicklängenbeiwert β je Eulerfall (1 Krag, 2 gelenkig-gelenkig, 3 eingespannt-gelenkig, 4 beidseitig eingespannt); bis 0.22.0 in cases.ts. */
export const EULER_BETA: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 2, 2: 1, 3: 0.699, 4: 0.5 };

export interface BucklingInput {
  /** E-Modul [MPa] */
  E: number;
  /** Streckgrenze (Auslegungswert) [MPa]; null = nur Euler */
  Rp: number | null;
  /** Querschnittsfläche [mm²] */
  A: number;
  /** Trägheitsradius i = √(I_min/A) [mm] */
  i: number;
  /** Stablänge [mm] */
  L: number;
  eulerCase: 1 | 2 | 3 | 4;
  /** Normalkraft [N], Druck negativ */
  N: number;
  /** Hinweis am Schritt K-LK (Werkbank: Herkunft des Eulerfalls) */
  lkRef?: string;
}

export interface BucklingResult {
  eulerCase: 1 | 2 | 3 | 4; beta: number; Lk: number; lambda: number; lambdaT: number | null; sigmaK: number; Fk: number;
  model: "Euler" | "Johnson"; SK: number; Rp: number | null; E: number; sigmaD: number;
}

export interface BucklingCheck {
  buck: BucklingResult;
  /** Schritte K-LK, K-LAM, K-LAMT, K-SKJ bzw. K-SKE, K-FK (Gruppe Belastung) */
  steps: CalcStep[];
  /** Schritt N-SK (Gruppe Nachweis) */
  check: CalcStep;
  warnings: string[];
}

/** Knicknachweis (K-LK, K-LAM, K-LAMT, K-SKJ, K-SKE, K-FK, N-SK). */
export function bucklingCheck(inp: BucklingInput): BucklingCheck {
  const { E, Rp, A, L, eulerCase, N } = inp;
  const steps: CalcStep[] = [], warnings: string[] = [];
  const beta = EULER_BETA[eulerCase], Lk = beta * L, lam = Lk / inp.i;
  const lamT = Rp ? Math.PI * Math.sqrt(2 * E / Rp) : null;
  steps.push(step("K-LK", "Knicklänge", "L_k = β·L", `β = ${fmt(beta)} (Eulerfall ${eulerCase}): ${fmt(beta)}·${fmt(L)}`, Lk, "mm", inp.lkRef));
  steps.push(step("K-LAM", "Schlankheitsgrad", "λ = L_k / i", `${fmt(Lk)} / ${fmt(inp.i)}`, lam, "–"));
  if (lamT) steps.push(step("K-LAMT", "Übergangsschlankheit Johnson/Euler", "λ_T = π·√(2E / R_p)", `π·√(2·${fmt(E)} / ${fmt(Rp)})`, lamT, "–", "Johnson-Parabel tangiert Euler bei σ = R_p/2"));
  let sk = Math.PI ** 2 * E / (lam * lam), model: "Euler" | "Johnson" = "Euler";
  if (lamT && Rp && lam < lamT) {
    sk = Rp - (Rp * Rp / (4 * Math.PI ** 2 * E)) * lam * lam; model = "Johnson";
    steps.push(step("K-SKJ", "Knickspannung (unelastisch, Johnson)", "σ_k = R_p − R_p²·λ² / (4π²E)", `${fmt(Rp)} − ${fmt(Rp)}²·${fmt(lam)}² / (4π²·${fmt(E)})`, sk, "MPa", "Johnson-Parabel"));
  } else steps.push(step("K-SKE", "Knickspannung (Euler)", "σ_k = π²·E / λ²", `π²·${fmt(E)} / ${fmt(lam)}²`, sk, "MPa", "Ashby App. A.5"));
  if (!Rp) warnings.push("Knicken ohne R_p: nur Euler, unelastischer Bereich nicht abgedeckt");
  const Fk = sk * A;
  steps.push(step("K-FK", "Knicklast", "F_k = σ_k·A", `${fmt(sk)}·${fmt(A)}`, Fk, "N"));
  const buck: BucklingResult = { eulerCase, beta, Lk, lambda: lam, lambdaT: lamT, sigmaK: sk, Fk, model, SK: Fk / Math.abs(N), Rp, E, sigmaD: Math.abs(N) / A };
  const check = step("N-SK", "Sicherheit gegen Knicken", "S_K = F_k / |F_N|", `${fmt(Fk)} / ${fmt(Math.abs(N))}`, buck.SK, "–");
  return { buck, steps, check, warnings };
}
