/**
 * Wasserchemie (Modul chemie, v1.3, CH-W01 bis CH-W15): Ionenprodukt, pH beliebiger Säure-Base-Systeme über die
 * Ladungsbilanz (exakt, Bisektion), Speziesverteilung, Henderson-Hasselbalch als Näherung, Pufferkapazität,
 * Ionenstärke, Aktivitätskoeffizienten nach Davies, Wasserhärte (°dH, Härtebereiche WRMG), Ionenbilanz,
 * Kalk-Kohlensäure-Gleichgewicht (Sättigungsindex, pH_C, Calcitlösekapazität, CO₂-Partialdruck).
 * Annahmen (CH-E14): Aktivitäten nach Davies (I ≤ 0,5 mol/L), keine Ionenpaare, mol/L ≈ mol/kg, γ(neutral) = 1.
 * SI: Konzentrationen in mol/m³ (= mmol/L), Massenkonzentrationen in kg/m³ (1 mg/L = 10⁻³ kg/m³), T in K.
 * Konstanten von außen (Tabelle ch_equilibria, lg K bei T über logKAt).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { C_STD, P_STD, type ChTable } from "./constants";
import { molarMass } from "./mass";

const f6 = (x: number): string => fmt(x, 6);
const LN10 = Math.LN10;

/** CH-W01 Ionenprodukt: pK_w = −lg K_w, Neutralpunkt pH_n = pK_w / 2. */
export function waterIonProduct(logKw: number, T: number): { pKw: number; pHn: number; step: CalcStep } {
  if (!Number.isFinite(logKw) || !(T > 0)) throw new Error("lg K_w endlich, T > 0");
  const pKw = -logKw;
  return { pKw, pHn: pKw / 2, step: step("CH-W01", "Ionenprodukt des Wassers", "pK_w = −lg K_w, pH_n = pK_w / 2", `pK_w = ${f6(pKw)} bei ${f6(T - 273.15)} °C → pH_n = ${f6(pKw / 2)}`, pKw, "1") };
}

/** Dichte von Wasser bei 101 325 Pa nach Kell (1975), 0 bis 150 °C [kg/m³]. */
export function waterDensityKell(T: number): number {
  const t = T - 273.15;
  return (999.83952 + 16.945176 * t - 7.9870401e-3 * t * t - 46.170461e-6 * t ** 3 + 105.56302e-9 * t ** 4 - 280.54253e-12 * t ** 5) / (1 + 16.87985e-3 * t);
}

/** CH-W07a Debye-Hückel-Konstante A(T) = 1,82483·10⁶ · √(ρ_w / (g/cm³)) / (ε_r · T)^(3/2), ε_r nach Malmberg und Maryott (1956), ρ_w nach Kell (1975). */
export function debyeHuckelA(T: number): { A: number; eps: number; rho: number; step: CalcStep } {
  const th = T - 273.15;
  if (!(th >= 0 && th <= 100)) throw new Error("Temperatur 0 bis 100 °C");
  const eps = 87.74 - 0.40008 * th + 9.398e-4 * th * th - 1.41e-6 * th ** 3;
  const rho = waterDensityKell(T);
  const A = (1.82483e6 * Math.sqrt(rho / 1000)) / Math.pow(eps * T, 1.5);
  return { A, eps, rho, step: step("CH-W07a", "Debye-Hückel-Konstante", "A = 1,82483 · 10⁶ · √(ρ_w / (g/cm³)) / (ε_r · T)^(3/2); ε_r = 87,740 − 0,40008 · ϑ + 9,398 · 10⁻⁴ · ϑ² − 1,410 · 10⁻⁶ · ϑ³",
    `ϑ = ${f6(th)} °C: ε_r = ${f6(eps)}, ρ_w = ${f6(rho)} kg/m³ (Kell)`, A, "(L/mol)^½", "Robinson, Stokes: Electrolyte Solutions; Malmberg, Maryott, J. Res. NBS 56 (1956) 1; Kell, J. Chem. Eng. Data 20 (1975) 97") };
}

/** CH-W07 Davies: lg γ = −A · z² · (√I / (1 + √I) − 0,3 · I), I in mol/L. */
export function davies(z: number, I: number, A: number): { gamma: number; step: CalcStep } {
  if (!(I >= 0) || I > 0.5 + 1e-12) throw new Error("Davies gilt bis I = 0,5 mol/L");
  const s = Math.sqrt(I);
  const lg = -A * z * z * (s / (1 + s) - 0.3 * I);
  return { gamma: Math.pow(10, lg), step: step("CH-W07", `Aktivitätskoeffizient (Davies), z = ${z}`, "lg γ = −A · z² · (√I / (1 + √I) − 0,3 · I)", `lg γ = −${f6(A)} · ${z * z} · (√${f6(I)} / (1 + √${f6(I)}) − 0,3 · ${f6(I)})`, Math.pow(10, lg), "1", "Davies: Ion Association (1962)") };
}

export interface Ion { label: string; c: number; z: number }
/** CH-W06 Ionenstärke I = ½ · Σ c_i · z_i² (c in mol/m³ → I in mol/L). */
export function ionicStrength(ions: readonly Ion[]): { I: number; step: CalcStep } {
  if (ions.some((i) => !(i.c >= 0) || !Number.isFinite(i.z))) throw new Error("Konzentrationen ≥ 0");
  const I = (0.5 * ions.reduce((s, i) => s + i.c * i.z * i.z, 0)) / C_STD;
  return { I, step: step("CH-W06", "Ionenstärke", "I = ½ · Σ c_i · z_i²", `I = ½ · (${ions.filter((i) => i.c > 0).map((i) => `${f6(i.c)} mmol/L · ${i.z * i.z}`).join(" + ") || "0"}) / 1000`, I, "mol/L") };
}

/** CH-W14 Ionenbilanzfehler Δ = (Σ Kationen − Σ Anionen) / (Σ Kationen + Σ Anionen) in Äquivalenten. */
export function ionBalance(ions: readonly Ion[]): { cat: number; an: number; error: number; step: CalcStep } {
  const cat = ions.filter((i) => i.z > 0).reduce((s, i) => s + i.c * i.z, 0), an = ions.filter((i) => i.z < 0).reduce((s, i) => s - i.c * i.z, 0);
  if (!(cat + an > 0)) throw new Error("keine Ionen");
  const error = (cat - an) / (cat + an);
  return { cat, an, error, step: step("CH-W14", "Ionenbilanz", "Δ = (Σ c_i · z_i (Kationen) − Σ c_j · |z_j| (Anionen)) / (Σ Kationen + Σ Anionen)", `Δ = (${f6(cat)} − ${f6(an)}) mmol/L / (${f6(cat)} + ${f6(an)}) mmol/L`, error, "1", "Richtwert |Δ| ≤ 5 % (DVGW W 216)") };
}

export interface AcidSystem { label: string; cT: number; pK: readonly number[]; z0: number; species?: readonly string[] }
export interface AcidBaseInput { systems: readonly AcidSystem[]; strong: readonly Ion[]; pKw: number; T: number; activity: boolean }
export interface AcidBaseResult {
  ok: boolean; error: string | null; pH: number | null; cH: number | null; cOH: number | null; I: number; gammas: Record<number, number>;
  dist: Array<{ system: string; species: string; z: number; c: number; alpha: number }>; beta: number | null; iterations: number; steps: CalcStep[];
}

/**
 * CH-W02 pH aus der Ladungsbilanz c_H − c_OH + Σ c_k · z_k + Σ_Systeme c_T · Σ_i α_i · (z₀ − i) = 0 (Bisektion in pH, −1 bis 15);
 * mit activity: γ nach Davies, I iterativ aus allen Ionen (Fixpunkt, |ΔI| ≤ 10⁻¹² mol/L). CH-W03 Verteilung α_i; CH-W05 Pufferkapazität.
 */
export function acidBase(inp: AcidBaseInput): AcidBaseResult {
  const steps: CalcStep[] = [];
  const fail = (e: string): AcidBaseResult => ({ ok: false, error: e, pH: null, cH: null, cOH: null, I: 0, gammas: {}, dist: [], beta: null, iterations: 0, steps });
  if (!Number.isFinite(inp.pKw) || !(inp.T > 0)) return fail("pK_w und T angeben");
  for (const s of inp.systems) {
    if (!(s.cT >= 0) || !s.pK.length || s.pK.some((p) => !Number.isFinite(p))) return fail(`${s.label}: c_T ≥ 0 und pK_s angeben`);
    for (let i = 1; i < s.pK.length; i++) if (!(s.pK[i]! > s.pK[i - 1]!)) return fail(`${s.label}: pK_s müssen steigen`);
  }
  if (inp.strong.some((i) => !(i.c >= 0))) return fail("Konzentrationen ≥ 0");
  const A = inp.activity ? debyeHuckelA(inp.T) : null;
  if (A) steps.push(A.step);
  const Kw = Math.pow(10, -inp.pKw);
  const gam = (z: number, I: number) => (A && z !== 0 ? davies(z, I, A.A).gamma : 1);
  const solve = (I: number) => {
    const g = (z: number) => gam(z, I);
    const parts = (aH: number) => inp.systems.map((s) => {
      const n = s.pK.length; const lw: number[] = []; let lp = 0;
      for (let i = 0; i <= n; i++) { if (i > 0) lp += -s.pK[i - 1]! * LN10 - Math.log(aH); lw.push(lp - Math.log(g(s.z0 - i))); }
      const m = Math.max(...lw); const ws = lw.map((x) => Math.exp(x - m)); const sum = ws.reduce((t, x) => t + x, 0);
      return ws.map((x, i) => ({ alpha: x / sum, z: s.z0 - i }));
    });
    const charge = (pH: number) => {
      const aH = Math.pow(10, -pH);
      const cH = (aH / g(1)) * C_STD, cOH = (Kw / aH / g(-1)) * C_STD;
      let q = cH - cOH + inp.strong.reduce((t, i) => t + i.c * i.z, 0);
      parts(aH).forEach((p, k) => { q += inp.systems[k]!.cT * p.reduce((t, x) => t + x.alpha * x.z, 0); });
      return q;
    };
    let lo = -1, hi = 15;
    if (charge(lo) < 0 || charge(hi) > 0) return null;
    for (let k = 0; k < 200 && hi - lo > 1e-13; k++) { const m = 0.5 * (lo + hi); if (charge(m) > 0) lo = m; else hi = m; }
    const pH = 0.5 * (lo + hi), aH = Math.pow(10, -pH);
    return { pH, aH, cH: (aH / g(1)) * C_STD, cOH: (Kw / aH / g(-1)) * C_STD, parts: parts(aH) };
  };
  let I = inp.activity ? ionicStrength(inp.strong).I : 0, it = 0;
  let sol = solve(I);
  if (!sol) return fail("Ladungsbilanz ohne Lösung im Bereich pH −1 bis 15");
  if (inp.activity) {
    for (it = 1; it <= 200; it++) {
      const ions: Ion[] = [...inp.strong, { label: "H⁺", c: sol.cH, z: 1 }, { label: "OH⁻", c: sol.cOH, z: -1 }];
      sol.parts.forEach((p, k) => p.forEach((x) => ions.push({ label: "", c: inp.systems[k]!.cT * x.alpha, z: x.z })));
      const In = ionicStrength(ions).I;
      if (In > 0.5) return fail(`Ionenstärke ${fmt(In, 3)} mol/L über 0,5 (Davies nicht gültig)`);
      const done = Math.abs(In - I) <= 1e-12;
      I = In; sol = solve(I);
      if (!sol) return fail("Ladungsbilanz ohne Lösung");
      if (done) break;
    }
    const ions: Ion[] = [...inp.strong, { label: "H⁺", c: sol.cH, z: 1 }, { label: "OH⁻", c: sol.cOH, z: -1 }];
    sol.parts.forEach((p, k) => p.forEach((x, i) => ions.push({ label: inp.systems[k]!.species?.[i] ?? `${inp.systems[k]!.label} (${i})`, c: inp.systems[k]!.cT * x.alpha, z: x.z })));
    steps.push(ionicStrength(ions).step);
    for (const z of [1, 2, 3]) steps.push(davies(z, I, A!.A).step);
  }
  const dist = sol.parts.flatMap((p, k) => p.map((x, i) => ({ system: inp.systems[k]!.label, species: inp.systems[k]!.species?.[i] ?? `${inp.systems[k]!.label} − ${i} H⁺`, z: x.z, c: inp.systems[k]!.cT * x.alpha, alpha: x.alpha })));
  steps.push(step("CH-W02", "pH aus der Ladungsbilanz", "c_H⁺ − c_OH⁻ + Σ c_k · z_k + Σ c_T · Σ_i α_i · z_i = 0, pH = −lg a_H⁺",
    `${inp.systems.map((s) => `${s.label}: c_T = ${f6(s.cT)} mmol/L, pK_s = ${s.pK.map(f6).join("; ")}`).join("; ")}${inp.strong.length ? `; starke Ionen ${inp.strong.map((i) => `${i.label} ${f6(i.c)} mmol/L`).join(", ")}` : ""}; pK_w = ${f6(inp.pKw)}${inp.activity ? `; I = ${f6(I)} mol/L` : ""}`, sol.pH, "1"));
  for (const s of inp.systems) {
    const d = dist.filter((x) => x.system === s.label);
    steps.push(step("CH-W03", `Speziesverteilung ${s.label}`, "α_i = (Π_{j≤i} K_j / a_H^i / γ_i) / Σ_k (Π_{j≤k} K_j / a_H^k / γ_k)", d.map((x) => `α(${x.species}) = ${f6(x.alpha)}`).join("; "), d[0]?.alpha ?? 0, "1"));
  }
  // CH-W05 Pufferkapazität β = ln 10 · (c_H + c_OH + Σ c_T · Σ_i (i − n̄)² · α_i)  (bedingte Konstanten bei festem I)
  let sysSum = 0;
  sol.parts.forEach((p, k) => { const nb = p.reduce((t, x, i) => t + i * x.alpha, 0); sysSum += inp.systems[k]!.cT * p.reduce((t, x, i) => t + (i - nb) ** 2 * x.alpha, 0); });
  const beta = LN10 * (sol.cH + sol.cOH + sysSum);
  steps.push(step("CH-W05", "Pufferkapazität", "β = dc_B / dpH = ln 10 · (c_H⁺ + c_OH⁻ + Σ c_T · Σ_i (i − n̄)² · α_i)", `β = 2,302585 · (${f6(sol.cH)} + ${f6(sol.cOH)} + ${f6(sysSum)}) mmol/L`, beta, "mol/m³"));
  return { ok: true, error: null, pH: sol.pH, cH: sol.cH, cOH: sol.cOH, I, gammas: inp.activity ? { 1: gam(1, I), 2: gam(2, I), 3: gam(3, I) } : { 1: 1, 2: 1, 3: 1 }, dist, beta, iterations: it, steps };
}

/** CH-W04 Henderson-Hasselbalch (Näherung für Puffer): pH = pK_s + lg(c_B / c_S). */
export function hendersonHasselbalch(pK: number, cS: number, cB: number): { pH: number; step: CalcStep } {
  if (!(cS > 0 && cB > 0) || !Number.isFinite(pK)) throw new Error("c_S, c_B > 0");
  const pH = pK + Math.log10(cB / cS);
  return { pH, step: step("CH-W04", "Henderson-Hasselbalch (Näherung)", "pH = pK_s + lg(c_B / c_S)", `pH = ${f6(pK)} + lg(${f6(cB)} / ${f6(cS)})`, pH, "1") };
}

export type HardnessRange = "weich" | "mittel" | "hart";
/**
 * CH-W08 Gesamthärte c(Ca + Mg) = β_Ca / M_Ca + β_Mg / M_Mg; °dH = c / (10 mg/L / M(CaO)); Bereich nach WRMG § 9
 * (weich < 1,5, mittel 1,5 bis 2,5, hart > 2,5 mmol/L); Karbonathärte KH = min(K_S4,3 / 2, GH), Nichtkarbonathärte GH − KH.
 */
export function hardness(betaCa: number, betaMg: number, ks43: number | null, elements: ChTable): { c: number; dH: number; range: HardnessRange; KH: number | null; NKH: number | null; KH_dH: number | null; steps: CalcStep[] } {
  if (!(betaCa >= 0 && betaMg >= 0) || (ks43 !== null && !(ks43 >= 0))) throw new Error("Konzentrationen ≥ 0");
  const M = (f: string) => { const r = molarMass(f, elements); if (!r.ok || !r.M) throw new Error(`molare Masse ${f} fehlt`); return r.M; };
  const MCa = M("Ca"), MMg = M("Mg"), MCaO = M("CaO");
  const c = betaCa / MCa + betaMg / MMg; // mol/m³
  const unit = 0.01 / MCaO; // 10 mg/L = 0,01 kg/m³ → mol/m³ je °dH
  const dH = c / unit;
  const range: HardnessRange = c < 1.5 ? "weich" : c <= 2.5 ? "mittel" : "hart";
  const steps = [step("CH-W08", "Gesamthärte", "c(Ca + Mg) = β_Ca / M_Ca + β_Mg / M_Mg; 1 °dH = 10 mg/L CaO = 10 mg/L / M(CaO); WRMG: weich < 1,5, mittel ≤ 2,5, hart > 2,5 mmol/L",
    `c = ${f6(betaCa * 1000)} mg/L / ${f6(MCa * 1000)} g/mol + ${f6(betaMg * 1000)} mg/L / ${f6(MMg * 1000)} g/mol = ${f6(c)} mmol/L; °dH = ${f6(c)} / ${f6(unit)} → ${range}`, dH, "°dH", "WRMG § 9; DIN 38409-6")];
  let KH: number | null = null, NKH: number | null = null, KH_dH: number | null = null;
  if (ks43 !== null) {
    KH = Math.min(ks43 / 2, c); NKH = c - KH; KH_dH = KH / unit;
    steps.push(step("CH-W08b", "Karbonat- und Nichtkarbonathärte", "KH = min(K_S4,3 / 2, GH); NKH = GH − KH", `KH = min(${f6(ks43)} / 2; ${f6(c)}) mmol/L = ${f6(KH)} mmol/L = ${f6(KH_dH)} °dH; NKH = ${f6(NKH)} mmol/L`, KH, "mol/m³", "DIN 38409-7"));
  }
  return { c, dH, range, KH, NKH, KH_dH, steps };
}

export interface CarbonateInput {
  T: number; pH: number; Ca: number; alk: number; I: number;
  /** lg K bei T: CO₂(aq)/HCO₃⁻, HCO₃⁻/CO₃²⁻, K_w, Calcit, Henry CO₂ */
  logK1: number; logK2: number; logKw: number; logKsp: number; logKH: number;
}
export interface CarbonateResult {
  CT: number; cCO2: number; cHCO3: number; cCO3: number; SI: number; pHC: number; dpH: number;
  /** Calcitlösekapazität [mol/m³], > 0 calcitlösend, < 0 abscheidend */ D: number; D_mass: number; pCO2: number; gamma1: number; gamma2: number; A: number; steps: CalcStep[];
}

/** Carbonatsystem bei pH und C_T: Konzentrationen und Alkalität (Säurekapazität K_S4,3). */
function carb(pH: number, CT: number, k: { K1: number; K2: number; Kw: number; g1: number; g2: number }) {
  const aH = Math.pow(10, -pH);
  const r1 = k.K1 / (aH * k.g1), r2 = (k.K1 * k.K2) / (aH * aH * k.g2);
  const a0 = 1 / (1 + r1 + r2);
  const cCO2 = CT * a0, cHCO3 = CT * r1 * a0, cCO3 = CT * r2 * a0;
  const cH = (aH / k.g1) * C_STD, cOH = (k.Kw / aH / k.g1) * C_STD;
  return { cCO2, cHCO3, cCO3, cH, cOH, alk: cHCO3 + 2 * cCO3 + cOH - cH, fac: r1 * a0 + 2 * r2 * a0 };
}

/**
 * CH-W09 C_T aus pH und K_S4,3; CH-W10 Sättigungsindex SI = lg(a_Ca · a_CO3 / K_sp); CH-W11 pH_C (SI = 0 bei gleichem Ca und K_S4,3);
 * CH-W12 Calcitlösekapazität D_C (geschlossenes System: Ca + x, C_T + x, K_S4,3 + 2x, I konstant); CH-W13 CO₂-Partialdruck.
 * Konzentrationen in mol/m³, I in mol/L.
 */
export function carbonate(inp: CarbonateInput, elements: ChTable): CarbonateResult {
  if (!(inp.Ca > 0 && inp.alk > 0)) throw new Error("Ca und K_S4,3 größer 0");
  if (!(inp.pH > 3 && inp.pH < 12)) throw new Error("pH zwischen 3 und 12");
  const Ad = debyeHuckelA(inp.T);
  const g1 = davies(1, inp.I, Ad.A), g2 = davies(2, inp.I, Ad.A);
  const k = { K1: 10 ** inp.logK1, K2: 10 ** inp.logK2, Kw: 10 ** inp.logKw, g1: g1.gamma, g2: g2.gamma };
  const Ksp = 10 ** inp.logKsp;
  const steps: CalcStep[] = [Ad.step, g1.step, g2.step];
  const c0 = carb(inp.pH, 1, k);
  const CT = (inp.alk - c0.cOH + c0.cH) / c0.fac;
  if (!(CT > 0)) throw new Error("K_S4,3 zu klein für diesen pH (C_T ≤ 0)");
  const c = carb(inp.pH, CT, k);
  steps.push(step("CH-W09", "Gesamter anorganischer Kohlenstoff aus K_S4,3", "K_S4,3 = c_HCO₃ + 2 · c_CO₃ + c_OH − c_H → C_T = (K_S4,3 − c_OH + c_H) / (α₁ + 2 · α₂)",
    `pH = ${f6(inp.pH)}, K_S4,3 = ${f6(inp.alk)} mmol/L, lg K₁ = ${f6(inp.logK1)}, lg K₂ = ${f6(inp.logK2)}, γ₁ = ${f6(k.g1)}, γ₂ = ${f6(k.g2)} → CO₂ ${f6(c.cCO2)}, HCO₃⁻ ${f6(c.cHCO3)}, CO₃²⁻ ${f6(c.cCO3)} mmol/L`, CT, "mol/m³"));
  const si = (Ca: number, cCO3: number) => Math.log10((k.g2 * Ca / C_STD) * (k.g2 * cCO3 / C_STD) / Ksp);
  const SI = si(inp.Ca, c.cCO3);
  steps.push(step("CH-W10", "Sättigungsindex Calcit", "SI = lg(γ₂ · c_Ca · γ₂ · c_CO₃ / K_sp); SI < 0 calcitlösend, SI > 0 abscheidend",
    `SI = lg(${f6(k.g2)} · ${f6(inp.Ca / C_STD)} · ${f6(k.g2)} · ${f6(c.cCO3 / C_STD)} / 10^${f6(inp.logKsp)})`, SI, "1", "DIN 38404-10 (Begriffe); Konstanten PHREEQC"));
  // pH_C: SI(pH) = 0 bei festem Ca und K_S4,3, C_T folgt aus K_S4,3
  const siAt = (pH: number) => { const u = carb(pH, 1, k); const ct = (inp.alk - u.cOH + u.cH) / u.fac; return ct > 0 ? si(inp.Ca, carb(pH, ct, k).cCO3) : -Infinity; };
  // obere Grenze: c_OH = K_S4,3 (darüber C_T ≤ 0); SI(pH) steigt bis zu einem Maximum und fällt danach (C_T → 0), Maximum per Goldenem Schnitt
  let pa = 4, pb = 14;
  for (let i = 0; i < 200 && pb - pa > 1e-13; i++) { const m = 0.5 * (pa + pb); const u = carb(m, 1, k); if (inp.alk - u.cOH + u.cH > 0) pa = m; else pb = m; }
  let ga = 4, gb = pa - 1e-9; const gr = (Math.sqrt(5) - 1) / 2;
  let x1 = gb - gr * (gb - ga), x2 = ga + gr * (gb - ga), s1 = siAt(x1), s2 = siAt(x2);
  for (let i = 0; i < 200 && gb - ga > 1e-12; i++) { if (s1 < s2) { ga = x1; x1 = x2; s1 = s2; x2 = ga + gr * (gb - ga); s2 = siAt(x2); } else { gb = x2; x2 = x1; s2 = s1; x1 = gb - gr * (gb - ga); s1 = siAt(x1); } }
  let lo = 4, hi = 0.5 * (ga + gb);
  if (!(siAt(lo) < 0)) throw new Error("bereits bei pH 4 übersättigt");
  if (!(siAt(hi) > 0)) throw new Error("Calcitsättigung mit diesem Ca und K_S4,3 nicht erreichbar");
  for (let i = 0; i < 200 && hi - lo > 1e-13; i++) { const m = 0.5 * (lo + hi); if (siAt(m) > 0) hi = m; else lo = m; }
  const pHC = 0.5 * (lo + hi);
  steps.push(step("CH-W11", "pH bei Calcitsättigung (gleiches Ca und K_S4,3)", "pH_C: SI(pH_C) = 0; ΔpH = pH − pH_C", `pH_C = ${f6(pHC)}; ΔpH = ${f6(inp.pH)} − ${f6(pHC)}`, pHC, "1"));
  // Calcitlösekapazität: x mol/m³ CaCO3 gelöst (x < 0 abgeschieden)
  const pHof = (ct: number, alk: number) => { let a = 0, b = 14; for (let i = 0; i < 200 && b - a > 1e-13; i++) { const m = 0.5 * (a + b); if (carb(m, ct, k).alk > alk) b = m; else a = m; } return 0.5 * (a + b); };
  const siX = (x: number) => { const ct = CT + x, al = inp.alk + 2 * x; return si(inp.Ca + x, carb(pHof(ct, al), ct, k).cCO3); };
  let xa = -Math.min(inp.Ca, CT, inp.alk / 2) * (1 - 1e-9), xb = 1;
  for (let i = 0; i < 60 && siX(xb) < 0; i++) xb *= 2;
  if (!(siX(xa) < 0 && siX(xb) > 0)) throw new Error("Calcitlösekapazität nicht bestimmbar");
  for (let i = 0; i < 200 && xb - xa > 1e-14 * Math.max(1, Math.abs(xa), Math.abs(xb)); i++) { const m = 0.5 * (xa + xb); if (siX(m) > 0) xb = m; else xa = m; }
  const D = 0.5 * (xa + xb);
  const MC = molarMass("CaCO3", elements).M ?? 0.1000869;
  steps.push(step("CH-W12", "Calcitlösekapazität (geschlossenes System)", "x mit SI = 0 nach Lösen von x CaCO₃: Ca + x, C_T + x, K_S4,3 + 2x (I konstant); D_C = x · M(CaCO₃); > 0 calcitlösend",
    `x = ${f6(D)} mmol/L → D_C = ${f6(D * MC * 1000)} mg/L CaCO₃`, D, "mol/m³", "Begriff nach DIN 38404-10"));
  const KH = 10 ** inp.logKH;
  const pCO2 = ((c.cCO2 / C_STD) / KH) * P_STD;
  const MCO2 = molarMass("CO2", elements).M ?? 0.0440095;
  steps.push(step("CH-W13", "CO₂-Partialdruck im Gleichgewicht und freies CO₂", "p_CO₂ = (c_CO₂ / c°) / K_H · p°; β_CO₂ = c_CO₂ · M(CO₂)", `p_CO₂ = ${f6(c.cCO2 / C_STD)} / 10^${f6(inp.logKH)} · 10⁵ Pa; β_CO₂ = ${f6(c.cCO2 * MCO2 * 1000)} mg/L`, pCO2, "Pa"));
  return { CT, cCO2: c.cCO2, cHCO3: c.cHCO3, cCO3: c.cCO3, SI, pHC, dpH: inp.pH - pHC, D, D_mass: D * MC, pCO2, gamma1: k.g1, gamma2: k.g2, A: Ad.A, steps };
}

/** CH-W15 Ionenstärke aus der elektrischen Leitfähigkeit (Näherung): I ≈ 1,6 · 10⁻⁵ · κ / (µS/cm). */
export function ionicStrengthFromConductivity(kappa_uS_cm: number): { I: number; step: CalcStep } {
  if (!(kappa_uS_cm > 0)) throw new Error("Leitfähigkeit > 0");
  const I = 1.6e-5 * kappa_uS_cm;
  return { I, step: step("CH-W15", "Ionenstärke aus Leitfähigkeit (Näherung)", "I ≈ 1,6 · 10⁻⁵ · κ / (µS/cm)", `I ≈ 1,6 · 10⁻⁵ · ${f6(kappa_uS_cm)}`, I, "mol/L", "Russell, J. AWWA 68 (1976) 499") };
}
