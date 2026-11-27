/**
 * Beispielfälle Modul chemie v1.1 bis v1.4 (eng-core 0.25.0) für Formelkatalog und Freigabe-Excel:
 * Thermochemie (CH-T), Gleichgewicht (CH-G), Kinetik (CH-A), Elektrochemie (CH-Z), Wasserchemie (CH-W).
 * Daten: test/fixtures/ch_v11.json (Abzug Chemiewerk ch_thermo, ch_equilibria, ch_potentials). Dieselben Fälle rechnet
 * verification/chemie_v11.py unabhängig nach.
 */
import { chemie as C, type CalcStep } from "../src/index";
import { CH_TABLE } from "./chemie-faelle";
import { CH_THERMO, CH_EQ, CH_HALF } from "../verification/eval_v11";

/** Literaturstelle je Gruppe (4. Zeichen der ID). */
export const CH_REF_V11: Readonly<Record<string, string>> = {
  T: "Atkins, de Paula: Physikalische Chemie Kap. 2, 3 (Hess, Gibbs-Helmholtz, Ellingham); Daten CRC Handbook (ch_thermo); DIN 1343; DIN EN ISO 6976 (Begriffe Brenn- und Heizwert)",
  G: "Atkins, de Paula: Physikalische Chemie Kap. 6 (Gleichgewicht, van't Hoff); Parkhurst, Appelo: PHREEQC 3, USGS TM 6-A43",
  A: "Atkins, de Paula: Physikalische Chemie Kap. 17, 18 (Zeitgesetze, Arrhenius)",
  Z: "Hamann, Vielstich: Elektrochemie; Bard, Parsons, Jordan: Standard Potentials in Aqueous Solution (IUPAC 1985); CODATA 2022 (F exakt)",
  W: "Stumm, Morgan: Aquatic Chemistry, 3. Aufl. Kap. 3, 4; DIN 38404-10 (Calcitsättigung, Begriffe); WRMG § 9; Davies (1962)",
};
const withRef = (s: CalcStep): CalcStep => (s.ref !== undefined || !s.id.startsWith("CH-") ? s : { ...s, ref: CH_REF_V11[s.id.charAt(3)] ?? "" });
const eq = (id: string) => { const e = CH_EQ.get(id); if (!e) throw new Error(`Gleichgewicht ${id} fehlt`); return e; };
const half = (id: string) => { const h = CH_HALF.get(id); if (!h) throw new Error(`Halbzelle ${id} fehlt`); return h; };
const T = (f: string, side: "edukt" | "produkt", coefficient: number) => ({ formula: f, side, coefficient });

export function chemieFaelleV11(): Array<{ text: string; steps: CalcStep[] }> {
  const out: Array<{ text: string; steps: CalcStep[] }> = [];
  const push = (text: string, steps: CalcStep[]) => out.push({ text, steps: steps.map(withRef) });
  // Thermochemie
  const methan = C.reactionThermo([T("CH4", "edukt", 1), T("O2", "edukt", 2), T("CO2", "produkt", 1), T("H2O(l)", "produkt", 2)], CH_THERMO);
  push("Thermochemie CH₄ + 2 O₂ → CO₂ + 2 H₂O(l), 298,15 K", methan.steps);
  push("Thermochemie Kalkbrennen CaCO₃ → CaO + CO₂ bei 1200 K (Ellingham)", C.reactionThermo([T("CaCO3", "edukt", 1), T("CaO", "produkt", 1), T("CO2", "produkt", 1)], CH_THERMO, 1200).steps);
  push("Thermochemie Haber-Bosch N₂ + 3 H₂ → 2 NH₃ bei 700 K", C.reactionThermo([T("N2", "edukt", 1), T("H2", "edukt", 3), T("NH3", "produkt", 2)], CH_THERMO, 700).steps);
  push("Reaktionswärme: 2 mol Methan verbrannt", [C.reactionHeat(2, methan.dH!).step]);
  for (const f of ["CH4", "H2", "C8H18", "CH3OH"]) push(`Brenn- und Heizwert ${f}`, C.fuelValue(f, CH_THERMO, CH_TABLE).steps);
  { const ch4 = C.fuelValue("CH4", CH_THERMO, CH_TABLE), h2 = C.fuelValue("H2", CH_THERMO, CH_TABLE);
    push("Biogas 60 % CH₄, 2 % H₂, Rest CO₂ und N₂", [C.mixtureValue([{ label: "CH₄", x: 0.6, Hs_v: ch4.Hs_v!, Hi_v: ch4.Hi_v! }, { label: "H₂", x: 0.02, Hs_v: h2.Hs_v!, Hi_v: h2.Hi_v! }]).step]); }
  // Gleichgewicht
  push("lg K Kohlensäure 1. Stufe bei 10 °C (Temperaturfunktion PHREEQC)", C.logKAt(eq("H2CO3"), 283.15).steps);
  push("lg K Phosphorsäure 1. Stufe bei 40 °C (van't Hoff)", C.logKAt(eq("H3PO4"), 313.15).steps);
  push("Reaktionsquotient N₂ + 3 H₂ ⇌ 2 NH₃, a = 0,5; 0,2; 2, K = 10⁻⁴, 700 K", C.reactionQuotient([{ label: "N₂", nu: -1, activity: 0.5 }, { label: "H₂", nu: -3, activity: 0.2 }, { label: "NH₃", nu: 2, activity: 2 }], 1e-4, 700).steps);
  push("Gleichgewicht Ammoniak, 1 mol N₂ + 3 mol H₂, K = 10^−4,5, 200 bar", C.equilibriumExtent([{ label: "N₂", nu: -1, n0: 1, kind: "gas" }, { label: "H₂", nu: -3, n0: 3, kind: "gas" }, { label: "NH₃", nu: 2, n0: 0, kind: "gas" }], 10 ** -4.5, { mode: "gas", p: 200e5 }).steps);
  push("Gleichgewicht Veresterung, je 1 mol Säure und Alkohol, K = 4, 1 L", C.equilibriumExtent([{ label: "CH₃COOH", nu: -1, n0: 1, kind: "geloest" }, { label: "C₂H₅OH", nu: -1, n0: 1, kind: "geloest" }, { label: "Ester", nu: 1, n0: 0, kind: "geloest" }, { label: "H₂O", nu: 1, n0: 0, kind: "geloest" }], 4, { mode: "loesung", V: 1e-3 }).steps);
  // Kinetik
  push("Arrhenius A = 10¹³ 1/s, E_A = 100 kJ/mol, 300 K", [C.arrhenius(1e13, 100e3, 300).step]);
  { const r = C.activationEnergy(1e-3, 300, 4e-3, 320); push("Aktivierungsenergie aus k(300 K) = 10⁻³ und k(320 K) = 4 · 10⁻³ 1/s", [...r.steps, C.rateFactor(r.Ea, 300, 320).step]); }
  push("Zeitgesetz 1. Ordnung k = 10⁻³ 1/s, c₀ = 1 mol/L, t = 600 s, Umsatz 90 %", C.rateLaw(1, 1e-3, 1000, 600, 0.9).steps);
  push("Zeitgesetz 2. Ordnung k = 2 · 10⁻⁶ m³/(mol·s), c₀ = 0,5 mol/L, t = 1200 s", C.rateLaw(2, 2e-6, 500, 1200, 0.75).steps);
  push("Zeitgesetz 0. Ordnung k = 0,05 mol/(m³·s), c₀ = 1 mol/L, t = 1 h", C.rateLaw(0, 0.05, 1000, 3600, 0.5).steps);
  { const t = [0, 300, 600, 900, 1200, 1800]; const c = t.map((x, i) => 1000 * Math.exp(-1.2e-3 * x) * (1 + 0.004 * (-1) ** i)); push("Reaktionsordnung aus Messreihe (6 Punkte)", [C.orderFromData(t, c).step]); }
  // Elektrochemie
  push("Standardpotential Zn²⁺/Zn aus Δ_rG° = 147,1 kJ/mol", [C.potentialFromGibbs(147100, 2).step]);
  push("Daniell-Element Zn | Zn²⁺ (0,1) || Cu²⁺ (1) | Cu, 25 °C", C.cell(half("Zn"), half("Cu2"), 298.15, { "Zn^2+(aq)": 0.1, "Cu^2+(aq)": 1 }).steps);
  push("Bleiakkumulator PbO₂/PbSO₄ gegen PbSO₄/Pb", C.cell(half("PbSO4"), half("PbO2"), 298.15).steps);
  push("Luther Fe³⁺/Fe aus Fe²⁺/Fe und Fe³⁺/Fe²⁺", [C.luther(2, -0.447, 1, 0.771).step]);
  push("Faraday Kupfer 10 A, 1 h", C.faraday({ I: 10, t: 3600, z: 2, M: 0.063546 }).steps);
  push("Faraday Silber 0,01 mol, 2 A, η_F = 0,95", C.faraday({ I: 2, n: 0.01, z: 1, M: 0.1078682, etaF: 0.95 }).steps);
  { const w = C.reactionThermo([T("H2O(l)", "edukt", 1), T("H2", "produkt", 1), T("O2", "produkt", 0.5)], CH_THERMO); push("Wasserelektrolyse 1,8 V, η_F = 0,98", C.electrolysis({ dG: w.dG298!, dH: w.dH!, z: 2, U: 1.8, M: 0.002016, etaF: 0.98 }).steps); }
  // Wasserchemie
  push("Ionenprodukt des Wassers bei 10 °C", [C.waterIonProduct(C.logKAt(eq("Kw"), 283.15).logK, 283.15).step]);
  push("Essigsäure 0,1 mol/L (ideal)", C.acidBase({ systems: [{ label: "Essigsäure", cT: 100, pK: [-eq("CH3COOH").log_k_25], z0: 0, species: ["CH₃COOH", "CH₃COO⁻"] }], strong: [], pKw: 14, T: 298.15, activity: false }).steps);
  push("Phosphatpuffer 10 mmol/L mit 15 mmol/L Na⁺ (Davies)", C.acidBase({ systems: [{ label: "Phosphat", cT: 10, pK: [-eq("H3PO4").log_k_25, -eq("H2PO4").log_k_25, -eq("HPO4").log_k_25], z0: 0, species: ["H₃PO₄", "H₂PO₄⁻", "HPO₄²⁻", "PO₄³⁻"] }], strong: [{ label: "Na⁺", c: 15, z: 1 }], pKw: 14, T: 298.15, activity: true }).steps);
  push("Acetatpuffer je 0,1 mol/L (Näherung)", [C.hendersonHasselbalch(-eq("CH3COOH").log_k_25, 100, 100).step]);
  push("Wasserhärte 80 mg/L Ca, 12 mg/L Mg, K_S4,3 = 4 mmol/L", C.hardness(0.08, 0.012, 4, CH_TABLE).steps);
  { const ions = [{ label: "Ca²⁺", c: 2, z: 2 }, { label: "Mg²⁺", c: 0.5, z: 2 }, { label: "Na⁺", c: 1, z: 1 }, { label: "K⁺", c: 0.1, z: 1 }, { label: "HCO₃⁻", c: 4, z: -1 }, { label: "Cl⁻", c: 1, z: -1 }, { label: "SO₄²⁻", c: 0.5, z: -2 }, { label: "NO₃⁻", c: 0.2, z: -1 }];
    push("Wasseranalyse: Ionenstärke und Ionenbilanz", [C.ionicStrength(ions).step, C.ionBalance(ions).step]); }
  push("Ionenstärke aus Leitfähigkeit 500 µS/cm", [C.ionicStrengthFromConductivity(500).step]);
  { const Tk = 283.15, L = (id: string) => C.logKAt(eq(id), Tk).logK;
    push("Kalk-Kohlensäure 10 °C, pH 7,5, Ca 2 mmol/L, K_S4,3 4 mmol/L, I 0,008 mol/L", C.carbonate({ T: Tk, pH: 7.5, Ca: 2, alk: 4, I: 0.008, logK1: L("H2CO3"), logK2: L("HCO3"), logKw: L("Kw"), logKsp: L("Calcit"), logKH: L("CO2g") }, CH_TABLE).steps); }
  return out;
}
