/**
 * Reaktionskinetik (Modul chemie, v1.4, CH-A01 bis CH-A07): Arrhenius, Aktivierungsenergie aus zwei Messpunkten,
 * Beschleunigungsfaktor, formale Zeitgesetze 0., 1. und 2. Ordnung (A → Produkte, r = k · c^n), Halbwertszeit, Umsatzzeit (CH-E18).
 * SI: k in (mol/m³)^(1−n)/s, c in mol/m³, t in s, E_A in J/mol, T in K.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { R_GAS } from "./constants";

const f6 = (x: number): string => fmt(x, 6);
export type RateOrder = 0 | 1 | 2;
const kUnit = (n: RateOrder): string => (n === 0 ? "mol/(m³·s)" : n === 1 ? "1/s" : "m³/(mol·s)");

/** CH-A01 k = A · exp(−E_A / (R · T)). */
export function arrhenius(A: number, Ea: number, T: number): { k: number; step: CalcStep } {
  if (!(A > 0) || !(Ea >= 0) || !(T > 0)) throw new Error("A > 0, E_A ≥ 0, T > 0");
  const k = A * Math.exp(-Ea / (R_GAS * T));
  return { k, step: step("CH-A01", "Geschwindigkeitskonstante (Arrhenius)", "k = A · exp(−E_A / (R · T))", `k = ${f6(A)} · exp(−${f6(Ea / 1000)} kJ/mol / (8,314462618 J/(mol·K) · ${f6(T)} K))`, k, "wie A") };
}

/** CH-A02 E_A = R · ln(k₂/k₁) / (1/T₁ − 1/T₂), dazu A = k₁ · exp(E_A / (R · T₁)). */
export function activationEnergy(k1: number, T1: number, k2: number, T2: number): { Ea: number; A: number; steps: CalcStep[] } {
  if (!(k1 > 0 && k2 > 0 && T1 > 0 && T2 > 0) || T1 === T2) throw new Error("k > 0, T > 0, T₁ ≠ T₂");
  const Ea = (R_GAS * Math.log(k2 / k1)) / (1 / T1 - 1 / T2);
  const A = k1 * Math.exp(Ea / (R_GAS * T1));
  return { Ea, A, steps: [
    step("CH-A02", "Aktivierungsenergie aus zwei Messpunkten", "E_A = R · ln(k₂ / k₁) / (1/T₁ − 1/T₂); A = k₁ · exp(E_A / (R · T₁))", `E_A = 8,314462618 J/(mol·K) · ln(${f6(k2)} / ${f6(k1)}) / (1/${f6(T1)} K − 1/${f6(T2)} K); A = ${f6(A)}`, Ea, "J/mol"),
  ] };
}

/** CH-A03 Beschleunigungsfaktor k(T₂) / k(T₁) = exp(E_A / R · (1/T₁ − 1/T₂)). */
export function rateFactor(Ea: number, T1: number, T2: number): { factor: number; step: CalcStep } {
  if (!(Ea >= 0) || !(T1 > 0 && T2 > 0)) throw new Error("E_A ≥ 0, T > 0");
  const factor = Math.exp((Ea / R_GAS) * (1 / T1 - 1 / T2));
  return { factor, step: step("CH-A03", "Beschleunigungsfaktor", "k(T₂) / k(T₁) = exp(E_A / R · (1/T₁ − 1/T₂))", `exp(${f6(Ea / 1000)} kJ/mol / R · (1/${f6(T1)} K − 1/${f6(T2)} K))`, factor, "1") };
}

/** CH-A04 bis CH-A06 c(t), Halbwertszeit, Zeit bis Umsatz X für A → Produkte mit r = k · c^n. */
export function rateLaw(order: RateOrder, k: number, c0: number, t: number, X?: number): { c: number; tHalf: number; tX: number | null; steps: CalcStep[] } {
  if (![0, 1, 2].includes(order) || !(k > 0) || !(c0 > 0) || !(t >= 0)) throw new Error("n ∈ {0, 1, 2}, k > 0, c₀ > 0, t ≥ 0");
  if (X !== undefined && !(X > 0 && X < 1)) throw new Error("Umsatz 0 < X < 1");
  const u = kUnit(order);
  let c: number, tHalf: number, tX: number | null = null;
  const steps: CalcStep[] = [];
  if (order === 0) {
    c = Math.max(0, c0 - k * t); tHalf = c0 / (2 * k); if (X !== undefined) tX = (X * c0) / k;
    steps.push(step("CH-A04", "Zeitgesetz 0. Ordnung", "n = 0: c = max(0, c₀ − k · t); n = 1: c = c₀ · exp(−k · t); n = 2: c = c₀ / (1 + k · c₀ · t)", `c = ${f6(c0)} mol/m³ − ${f6(k)} ${u} · ${f6(t)} s`, c, "mol/m³"));
    steps.push(step("CH-A05", "Halbwertszeit 0. Ordnung", "n = 0: t½ = c₀ / (2 · k); n = 1: t½ = ln 2 / k; n = 2: t½ = 1 / (k · c₀)", `t½ = ${f6(c0)} mol/m³ / (2 · ${f6(k)} ${u})`, tHalf, "s"));
    if (tX !== null) steps.push(step("CH-A06", "Zeit bis Umsatz X, 0. Ordnung", "n = 0: t_X = X · c₀ / k; n = 1: t_X = −ln(1 − X) / k; n = 2: t_X = X / (k · c₀ · (1 − X))", `t = ${f6(X!)} · ${f6(c0)} mol/m³ / ${f6(k)} ${u}`, tX, "s"));
  } else if (order === 1) {
    c = c0 * Math.exp(-k * t); tHalf = Math.LN2 / k; if (X !== undefined) tX = -Math.log(1 - X) / k;
    steps.push(step("CH-A04", "Zeitgesetz 1. Ordnung", "n = 0: c = max(0, c₀ − k · t); n = 1: c = c₀ · exp(−k · t); n = 2: c = c₀ / (1 + k · c₀ · t)", `c = ${f6(c0)} mol/m³ · exp(−${f6(k)} 1/s · ${f6(t)} s)`, c, "mol/m³"));
    steps.push(step("CH-A05", "Halbwertszeit 1. Ordnung", "n = 0: t½ = c₀ / (2 · k); n = 1: t½ = ln 2 / k; n = 2: t½ = 1 / (k · c₀)", `t½ = ln 2 / ${f6(k)} 1/s`, tHalf, "s"));
    if (tX !== null) steps.push(step("CH-A06", "Zeit bis Umsatz X, 1. Ordnung", "n = 0: t_X = X · c₀ / k; n = 1: t_X = −ln(1 − X) / k; n = 2: t_X = X / (k · c₀ · (1 − X))", `t = −ln(1 − ${f6(X!)}) / ${f6(k)} 1/s`, tX, "s"));
  } else {
    c = c0 / (1 + k * c0 * t); tHalf = 1 / (k * c0); if (X !== undefined) tX = X / (k * c0 * (1 - X));
    steps.push(step("CH-A04", "Zeitgesetz 2. Ordnung", "n = 0: c = max(0, c₀ − k · t); n = 1: c = c₀ · exp(−k · t); n = 2: c = c₀ / (1 + k · c₀ · t)", `c = ${f6(c0)} mol/m³ / (1 + ${f6(k)} ${u} · ${f6(c0)} mol/m³ · ${f6(t)} s)`, c, "mol/m³"));
    steps.push(step("CH-A05", "Halbwertszeit 2. Ordnung", "n = 0: t½ = c₀ / (2 · k); n = 1: t½ = ln 2 / k; n = 2: t½ = 1 / (k · c₀)", `t½ = 1 / (${f6(k)} ${u} · ${f6(c0)} mol/m³)`, tHalf, "s"));
    if (tX !== null) steps.push(step("CH-A06", "Zeit bis Umsatz X, 2. Ordnung", "n = 0: t_X = X · c₀ / k; n = 1: t_X = −ln(1 − X) / k; n = 2: t_X = X / (k · c₀ · (1 − X))", `t = ${f6(X!)} / (${f6(k)} ${u} · ${f6(c0)} mol/m³ · (1 − ${f6(X!)}))`, tX, "s"));
  }
  return { c, tHalf, tX, steps };
}

/** CH-A07 Ordnung aus Messreihe: lineare Regression von c, ln c und 1/c über t; beste Ordnung nach Bestimmtheitsmaß R². */
export function orderFromData(t: readonly number[], c: readonly number[]): { fits: Array<{ order: RateOrder; k: number; r2: number }>; best: RateOrder; step: CalcStep } {
  if (t.length !== c.length || t.length < 3 || c.some((x) => !(x > 0)) || t.some((x) => !Number.isFinite(x))) throw new Error("mindestens 3 Punkte, c > 0");
  const lin = (y: readonly number[]) => {
    const n = t.length, mx = t.reduce((s, x) => s + x, 0) / n, my = y.reduce((s, x) => s + x, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (t[i]! - mx) * (y[i]! - my); sxx += (t[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; }
    if (sxx === 0) throw new Error("Zeitpunkte müssen verschieden sein");
    const b = sxy / sxx; return { b, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) };
  };
  const f0 = lin(c), f1 = lin(c.map(Math.log)), f2 = lin(c.map((x) => 1 / x));
  const fits: Array<{ order: RateOrder; k: number; r2: number }> = [{ order: 0, k: -f0.b, r2: f0.r2 }, { order: 1, k: -f1.b, r2: f1.r2 }, { order: 2, k: f2.b, r2: f2.r2 }];
  const best = [...fits].sort((x, y) => y.r2 - x.r2)[0]!.order;
  return { fits, best, step: step("CH-A07", "Reaktionsordnung aus Messreihe", "Regression c, ln c, 1/c über t; Steigung −k, −k, +k; größtes R²", fits.map((f) => `n = ${f.order}: k = ${f6(f.k)} ${kUnit(f.order)}, R² = ${fmt(f.r2, 6)}`).join("; "), best, "1") };
}
