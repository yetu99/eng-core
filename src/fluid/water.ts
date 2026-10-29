/**
 * Stoffwerte Wasser (Modul fluid, ab 0.11.0): Dichte und Sättigungsdruck nach IAPWS-IF97, Viskosität nach IAPWS R12-08.
 * Konzept fachtools/konzept_rh_a.md, Entscheidung R1. Einheiten SI: T in K, p in Pa, ρ in kg/m³, η in Pa·s, ν in m²/s.
 *
 * IF97 Region 1 (IAPWS R7-97(2012), Gl. (7), Tab. 2 bis 4, S. 6 bis 8): dimensionslose Gibbs-Funktion
 *   γ(π, τ) = Σ nᵢ·(7,1 − π)^Iᵢ·(τ − 1,222)^Jᵢ,  π = p/16,53 MPa,  τ = 1 386 K/T,
 *   v = R·T·π·γ_π/p,  γ_π = Σ −nᵢ·Iᵢ·(7,1 − π)^(Iᵢ−1)·(τ − 1,222)^Jᵢ,  R = 0,461526 kJ/(kg·K) (Gl. (1)).
 *   Gültig 273,15 K ≤ T ≤ 623,15 K und p_s(T) ≤ p ≤ 100 MPa (S. 9).
 * IF97 Region 4 (Gl. (29), (30), Tab. 34, S. 33 f.): p_s(T) explizit, gültig 273,15 K ≤ T ≤ 647,096 K.
 * Viskosität (IAPWS R12-08, Gl. (10) bis (12), Tab. 1 und 2, S. 5 f.): η = η*·μ̄₀(T̄)·μ̄₁(T̄, ρ̄)·μ̄₂ mit μ̄₂ = 1
 *   (Abschn. 3, industrielle Anwendung mit Dichte aus IF97), T̄ = T/647,096 K, ρ̄ = ρ/322 kg/m³, η* = 1 µPa·s.
 * Prüfwerte: IF97 Tab. 5 und 35, R12-08 Tab. 4 (verification/fluid.py).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";

/** Spezifische Gaskonstante Wasser in J/(kg·K) (IF97 Gl. (1)). */
export const R_WATER = 461.526;
/** Gültigkeit IF97 Region 1 in K. */
export const IF97_R1_T = { min: 273.15, max: 623.15 } as const;
/** Obere Druckgrenze IF97 Region 1 in Pa. */
export const IF97_R1_PMAX = 100e6;

const I1 = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 8, 8, 21, 23, 29, 30, 31, 32] as const;
const J1 = [-2, -1, 0, 1, 2, 3, 4, 5, -9, -7, -1, 0, 1, 3, -3, 0, 1, 3, 17, -4, 0, 6, -5, -2, 10, -8, -11, -6, -29, -31, -38, -39, -40, -41] as const;
const N1 = [
  0.14632971213167, -0.84548187169114, -0.3756360367204e1, 0.33855169168385e1, -0.95791963387872, 0.15772038513228,
  -0.16616417199501e-1, 0.81214629983568e-3, 0.28319080123804e-3, -0.60706301565874e-3, -0.18990068218419e-1, -0.32529748770505e-1,
  -0.21841717175414e-1, -0.5283835796993e-4, -0.47184321073267e-3, -0.30001780793026e-3, 0.47661393906987e-4, -0.44141845330846e-5,
  -0.72694996297594e-15, -0.31679644845054e-4, -0.28270797985312e-5, -0.85205128120103e-9, -0.22425281908e-5, -0.65171222895601e-6,
  -0.14341729937924e-12, -0.40516996860117e-6, -0.12734301741641e-8, -0.17424871230634e-9, -0.68762131295531e-18, 0.14478307828521e-19,
  0.26335781662795e-22, -0.11947622640071e-22, 0.18228094581404e-23, -0.93537087292458e-25,
] as const;
const N4 = [
  0.11670521452767e4, -0.72421316703206e6, -0.17073846940092e2, 0.1202082470247e5, -0.32325550322333e7,
  0.1491510861353e2, -0.48232657361591e4, 0.40511340542057e6, -0.23855557567849, 0.65017534844798e3,
] as const;
const H0 = [1.67752, 2.20462, 0.6366564, -0.241605] as const;
/** Hᵢⱼ der Viskosität (R12-08 Tab. 2), nicht aufgeführte Koeffizienten sind null: [i, j, Hᵢⱼ]. */
const HIJ: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 5.20094e-1], [1, 0, 8.50895e-2], [2, 0, -1.08374], [3, 0, -2.89555e-1], [0, 1, 2.22531e-1], [1, 1, 9.99115e-1], [2, 1, 1.88797],
  [3, 1, 1.26613], [5, 1, 1.20573e-1], [0, 2, -2.81378e-1], [1, 2, -9.06851e-1], [2, 2, -7.72479e-1], [3, 2, -4.89837e-1], [4, 2, -2.5704e-1],
  [0, 3, 1.61913e-1], [1, 3, 2.57399e-1], [0, 4, -3.25372e-2], [3, 4, 6.98452e-2], [4, 5, 8.72102e-3], [3, 6, -4.35673e-3], [5, 6, -5.93264e-4],
];

const REF_IF = "IAPWS-IF97 (R7-97, 2012)";
const REF_MU = "IAPWS R12-08";

/** Sättigungsdruck p_s(T) in Pa (IF97 Gl. (30)). */
export function saturationPressure(T: number): number {
  const th = T + N4[8] / (T - N4[9]);
  const A = th * th + N4[0] * th + N4[1];
  const B = N4[2] * th * th + N4[3] * th + N4[4];
  const C = N4[5] * th * th + N4[6] * th + N4[7];
  return Math.pow((2 * C) / (-B + Math.sqrt(B * B - 4 * A * C)), 4) * 1e6;
}

/** γ_π der IF97 Region 1 (Tab. 4). */
export function if97GammaPi(pi: number, tau: number): number {
  let g = 0;
  for (let i = 0; i < 34; i++) g += -N1[i]! * I1[i]! * Math.pow(7.1 - pi, I1[i]! - 1) * Math.pow(tau - 1.222, J1[i]!);
  return g;
}

/** Dichte Wasser in Region 1 in kg/m³ (ohne Gültigkeitsprüfung). */
export function waterDensity(T: number, p: number): number {
  const pi = p / 16.53e6, tau = 1386 / T;
  return p / (R_WATER * T * pi * if97GammaPi(pi, tau));
}

/** μ̄₀ (R12-08 Gl. (11)). */
export function muBar0(T: number): number {
  const Tb = T / 647.096;
  let s = 0;
  for (let i = 0; i < 4; i++) s += H0[i]! / Math.pow(Tb, i);
  return (100 * Math.sqrt(Tb)) / s;
}

/** μ̄₁ (R12-08 Gl. (12)). */
export function muBar1(T: number, rho: number): number {
  const Tb = T / 647.096, rb = rho / 322;
  let s = 0;
  for (const [i, j, h] of HIJ) s += h * Math.pow(1 / Tb - 1, i) * Math.pow(rb - 1, j);
  return Math.exp(rb * s);
}

/** Dynamische Viskosität in Pa·s (R12-08 Gl. (10), μ̄₂ = 1). */
export function waterViscosity(T: number, rho: number): number {
  return 1e-6 * muBar0(T) * muBar1(T, rho);
}

export interface WaterState {
  T: number; p: number; rho: number; eta: number; nu: number; ps: number;
  steps: CalcStep[]; errors: string[]; warnings: string[];
}

/**
 * Stoffwerte Wasser bei T (K) und p (Pa, absolut) mit Rechenweg. Fehler außerhalb von IF97 Region 1 (auch p < p_s:
 * Dampf). Hinweis über 100 °C (Druck über 1 bar nötig, sonst siedet das Wasser).
 */
export function waterState(T: number, p: number): WaterState {
  const errors: string[] = [], warnings: string[] = [];
  if (!(Number.isFinite(T) && Number.isFinite(p))) errors.push("Temperatur und Druck müssen Zahlen sein.");
  else {
    if (T < IF97_R1_T.min || T > IF97_R1_T.max) errors.push(`Temperatur ${fmt(T - 273.15)} °C außerhalb IF97 Region 1 (0 bis 350 °C).`);
    if (p <= 0 || p > IF97_R1_PMAX) errors.push(`Druck ${fmt(p / 1e5)} bar außerhalb IF97 Region 1 (bis 1 000 bar absolut).`);
  }
  const ps = errors.length ? NaN : saturationPressure(T);
  if (!errors.length && p < ps) errors.push(`Druck ${fmt(p / 1e5)} bar unter dem Sättigungsdruck ${fmt(ps / 1e5)} bar bei ${fmt(T - 273.15)} °C: Wasser verdampft (außerhalb IF97 Region 1).`);
  if (!errors.length && T > 373.15) warnings.push("Wasser über 100 °C: nur flüssig, solange der Druck überall über dem Sättigungsdruck liegt.");
  if (errors.length) return { T, p, rho: NaN, eta: NaN, nu: NaN, ps, steps: [], errors, warnings };
  const pi = p / 16.53e6, tau = 1386 / T;
  const gp = if97GammaPi(pi, tau);
  const rho = p / (R_WATER * T * pi * gp);
  const m0 = muBar0(T), m1 = muBar1(T, rho);
  const eta = 1e-6 * m0 * m1, nu = eta / rho;
  const steps: CalcStep[] = [
    step("FS-IF-PI", "Reduzierter Druck (IF97 Region 1)", "π = p/16,53 MPa; τ = 1 386 K/T", `π = ${fmt(p / 1e6, 6)}/16,53 = ${fmt(pi, 6)}; τ = 1 386/${fmt(T, 6)} = ${fmt(tau, 6)}`, pi, "1", `${REF_IF}, Gl. (7)`),
    step("FS-IF-GP", "Ableitung der Gibbs-Funktion", "γ_π = Σ −n_i·I_i·(7,1 − π)^(I_i−1)·(τ − 1,222)^J_i", `34 Glieder nach Tab. 2 mit π = ${fmt(pi, 6)}, τ = ${fmt(tau, 6)}`, gp, "1", `${REF_IF}, Tab. 2 und 4`),
    step("FS-IF-RHO", "Dichte Wasser", "ρ = p/(R·T·π·γ_π)", `ρ = ${fmt(p, 6)}/(461,526·${fmt(T, 6)}·${fmt(pi, 6)}·${fmt(gp, 6)})`, rho, "kg/m³", `${REF_IF}, Tab. 3, Gl. (1)`),
    step("FS-IF-PS", "Sättigungsdruck", "p_s = 1 MPa·[2C/(−B + √(B² − 4AC))]⁴", `T = ${fmt(T, 6)} K nach Gl. (29b), Tab. 34`, ps, "Pa", `${REF_IF}, Gl. (30), Tab. 34`),
    step("FS-MU-0", "Viskosität Gasgrenze", "μ̄_0 = 100·√T̄ / Σ H_i/T̄^i", `T̄ = ${fmt(T / 647.096, 6)}`, m0, "1", `${REF_MU}, Gl. (11), Tab. 1`),
    step("FS-MU-1", "Viskosität Dichteeinfluss", "μ̄_1 = exp[ρ̄·Σ_i (1/T̄ − 1)^i·Σ_j H_ij·(ρ̄ − 1)^j]", `ρ̄ = ${fmt(rho / 322, 6)}, T̄ = ${fmt(T / 647.096, 6)}`, m1, "1", `${REF_MU}, Gl. (12), Tab. 2`),
    step("FS-MU", "Dynamische Viskosität Wasser", "η = 1 µPa·s·μ̄_0·μ̄_1 (μ̄_2 = 1)", `η = 10⁻⁶·${fmt(m0, 6)}·${fmt(m1, 6)}`, eta, "Pa·s", `${REF_MU}, Gl. (10), Abschn. 3`),
    step("FS-NU", "Kinematische Viskosität", "ν = η/ρ", `ν = ${fmt(eta, 6)}/${fmt(rho, 6)}`, nu, "m²/s", "Definition"),
  ];
  return { T, p, rho, eta, nu, ps, steps, errors, warnings };
}
