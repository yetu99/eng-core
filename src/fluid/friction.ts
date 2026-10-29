/**
 * Rohrreibungszahl λ (Entscheidungen R4, R5).
 * laminar (Re < 2 320): λ = 64/Re (Roloff 27 Gl. 18.9; VDI-WA L1.2 Gl. (4)).
 * turbulent (Re ≥ 2 320): Colebrook 1/√λ = −2·lg(2,51/(Re·√λ) + ε/3,71) (Roloff Gl. 18.11; VDI-WA L1.2 Gl. (10)).
 *   Newton auf x = 1/√λ, Startwert aus der expliziten Näherung λ₀ = 0,11·(ε + 68/Re)^0,25 (Roloff S. 742),
 *   Abbruch |Δx| < 10⁻¹² oder 50 Schritte; Restfehler im Rechenweg. 2 320 ≤ Re < 4 000: Übergangsgebiet, turbulent gerechnet
 *   (größerer Druckverlust), Warnung. Gültig Re ≤ 10⁸, ε ≤ 0,05.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";

export const RE_CRIT = 2320;
export const RE_TURB = 4000;
export const RE_MAX = 1e8;
export const EPS_MAX = 0.05;

export interface Friction {
  lambda: number;
  regime: "laminar" | "Übergang" | "turbulent";
  /** Näherung nach Roloff (nur turbulent, sonst null). */
  lambda0: number | null;
  iterations: number;
  residual: number;
  steps: CalcStep[];
  errors: string[];
  warnings: string[];
}

/** Restfunktion der Colebrook-Gleichung in x = 1/√λ. */
export function colebrookResidual(x: number, Re: number, eps: number): number {
  return x + 2 * Math.log10((2.51 * x) / Re + eps / 3.71);
}

/** Colebrook mit Newton, deterministisch. */
export function colebrook(Re: number, eps: number): { lambda: number; iterations: number; residual: number; lambda0: number } {
  const lambda0 = 0.11 * Math.pow(eps + 68 / Re, 0.25);
  let x = 1 / Math.sqrt(lambda0), it = 0;
  for (; it < 50; it++) {
    const u = (2.51 * x) / Re + eps / 3.71;
    const f = x + 2 * Math.log10(u);
    const df = 1 + (2 / Math.LN10) * (2.51 / Re) / u;
    const dx = f / df;
    x -= dx;
    if (Math.abs(dx) < 1e-12) { it++; break; }
  }
  return { lambda: 1 / (x * x), iterations: it, residual: colebrookResidual(x, Re, eps), lambda0 };
}

/** λ mit Rechenweg; `tag` kennzeichnet das Rohr im Rechenweg (z. B. "Rohr 2"). */
export function frictionFactor(Re: number, eps: number, tag = ""): Friction {
  const pre = tag ? `${tag}: ` : "";
  const errors: string[] = [], warnings: string[] = [];
  if (!(Re > 0)) errors.push(`${pre}Reynolds-Zahl muss größer als 0 sein.`);
  if (Re > RE_MAX) errors.push(`${pre}Re = ${fmt(Re)} über 10⁸, Colebrook nicht abgesichert.`);
  if (!(eps >= 0) || eps > EPS_MAX) errors.push(`${pre}relative Rauheit k/d = ${fmt(eps)} außerhalb 0 bis 0,05.`);
  if (errors.length) return { lambda: NaN, regime: "turbulent", lambda0: null, iterations: 0, residual: NaN, steps: [], errors, warnings };
  if (Re < RE_CRIT) {
    const lambda = 64 / Re;
    return { lambda, regime: "laminar", lambda0: null, iterations: 0, residual: 0, errors, warnings,
      steps: [step("RH-L-LAM", "Rohrreibungszahl laminar", "λ = 64/Re", `${pre}λ = 64/${fmt(Re, 6)}`, lambda, "1", "Roloff 27 Gl. 18.9; VDI-WA L1.2 Gl. (4)")] };
  }
  const regime = Re < RE_TURB ? "Übergang" : "turbulent";
  if (regime === "Übergang") warnings.push(`${pre}Re = ${fmt(Re)} im Übergangsgebiet 2 320 bis 4 000: turbulent gerechnet (sichere Seite), Ergebnis unsicher.`);
  const c = colebrook(Re, eps);
  return {
    lambda: c.lambda, regime, lambda0: c.lambda0, iterations: c.iterations, residual: c.residual, errors, warnings,
    steps: [
      step("RH-L-EX", "Rohrreibungszahl Näherung (Startwert)", "λ_0 = 0,11·(ε + 68/Re)^0,25", `${pre}λ_0 = 0,11·(${fmt(eps, 6)} + 68/${fmt(Re, 6)})^0,25`, c.lambda0, "1", "Roloff 27 S. 742"),
      step("RH-L-CB", "Rohrreibungszahl turbulent (Colebrook)", "1/√λ = −2·lg(2,51/(Re·√λ) + ε/3,71)",
        `${pre}Newton ab λ_0, ${c.iterations} Schritte, Restfehler ${fmt(Math.abs(c.residual), 2)}`, c.lambda, "1", "Roloff 27 Gl. 18.11; VDI-WA L1.2 Gl. (10)"),
    ],
  };
}
