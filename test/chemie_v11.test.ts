/**
 * Modul chemie v1.1 bis v1.4 (eng-core 0.25.0, Werkzeug Chemiewerk): Literaturwerte, Konventionen, Grenz- und Fehlerfälle für
 * Thermochemie (CH-T), Gleichgewicht (CH-G), Kinetik (CH-A), Elektrochemie (CH-Z), Wasserchemie (CH-W).
 * Zahlenwerte gegen die unabhängige Python-Rechnung stehen in golden.json (verification/chemie_v11.py).
 */
import { describe, expect, it } from "vitest";
import { chemie as C } from "../src/index";
import { CH_TABLE as E } from "../scripts/chemie-faelle";
import { CH_THERMO as TH, CH_EQ, CH_HALF } from "../verification/eval_v11";
import { chemieFaelleV11 } from "../scripts/chemie-faelle-v11";

const t = (f: string, side: "edukt" | "produkt", coefficient: number) => ({ formula: f, side, coefficient });
const eq = (id: string) => CH_EQ.get(id)!;
const h = (id: string) => CH_HALF.get(id)!;

describe("Daten und Zuordnung (CH-E13)", () => {
  it("Abzug vollständig, Standardphase eindeutig", () => {
    expect(TH.byId.size).toBe(172);
    expect(CH_EQ.size).toBe(23);
    expect(CH_HALF.size).toBe(45);
    for (const [, list] of TH.byHill) expect(list.filter((e) => e.isDefault).length).toBeLessThanOrEqual(1);
  });
  it("Zuordnung über Summenformel und Phase", () => {
    expect(C.thermoLookup("H2O", TH).entry?.id).toBe("H2O(l)");
    expect(C.thermoLookup("H2O(g)", TH).entry?.id).toBe("H2O(g)");
    expect(C.thermoLookup("Ca^2+", TH).entry?.id).toBe("Ca^2+(aq)");
    expect(C.thermoLookup("C2H4O2", TH).entry?.id).toBe("CH3COOH(l)");
    expect(C.thermoLookup("XeF2", TH).error).toMatch(/keine Bildungsgrößen/);
    expect(C.thermoLookup("NaCl(g)", TH).error).toMatch(/Phase/);
    expect(C.thermoLookup("e^-", TH).error).toMatch(/Halbreaktionen/);
  });
});

describe("Thermochemie (CH-T)", () => {
  it("Methanverbrennung: Δ_rH° −890,5 kJ/mol, Gibbs-Helmholtz innerhalb 0,1 kJ/mol", () => {
    const r = C.reactionThermo([t("CH4", "edukt", 1), t("O2", "edukt", 2), t("CO2", "produkt", 1), t("H2O(l)", "produkt", 2)], TH);
    expect(r.dH).toBeCloseTo(-890500, 6);
    expect(r.dG298).toBeCloseTo(-818100, 6);
    expect(Math.abs(r.ghDiff!)).toBeLessThan(100);
    expect(r.steps.map((s) => s.id)).toEqual(["CH-T01", "CH-T02", "CH-T03", "CH-T05", "CH-T06", "CH-G01"]);
  });
  it("Kalkbrennen: Umkehrtemperatur 1118,6 K, bei 1200 K freiwillig", () => {
    const r = C.reactionThermo([t("CaCO3", "edukt", 1), t("CaO", "produkt", 1), t("CO2", "produkt", 1)], TH, 1200);
    expect(r.Tinv).toBeCloseTo(179200 / 160.2, 6);
    expect(r.dGT!).toBeLessThan(0);
    expect(r.steps.some((s) => s.id === "CH-T04")).toBe(true);
  });
  it("Fehler: nicht bilanziert, fehlende Daten, beide Seiten", () => {
    expect(C.reactionThermo([t("H2", "edukt", 0), t("H2O", "produkt", 1)], TH).error).toMatch(/bilanzieren/);
    expect(C.reactionThermo([t("XeF2", "edukt", 1), t("Xe", "produkt", 1)], TH).error).toMatch(/XeF/);
    expect(C.reactionThermo([t("H2", "edukt", 1)], TH).error).toMatch(/Edukte und Produkte/);
  });
  it("Brenn- und Heizwert: Methan 55,5 und 50,0 MJ/kg, 39,7 und 35,8 MJ/m³ (i. N.); Wasserstoff 141,8 und 120,0 MJ/kg", () => {
    const m = C.fuelValue("CH4", TH, E), w = C.fuelValue("H2", TH, E);
    expect(m.Hs_w! / 1e6).toBeCloseTo(55.51, 2); expect(m.Hi_w! / 1e6).toBeCloseTo(50.02, 2);
    expect(m.Hs_v! / 1e6).toBeCloseTo(39.73, 2); expect(m.Hi_v! / 1e6).toBeCloseTo(35.80, 2);
    expect(w.Hs_w! / 1e6).toBeCloseTo(141.77, 2); expect(w.Hi_w! / 1e6).toBeCloseTo(119.94, 2);
    expect(C.fuelValue("C8H18", TH, E).Hs_v).toBeNull();
  });
  it("Brennstoff-Fehler", () => {
    expect(C.fuelValue("NaCl", TH, E).error).toMatch(/Element/);
    expect(C.fuelValue("CO2", TH, E).error).toMatch(/O₂-Bedarf|brennbar/);
    expect(C.fuelValue("N2", TH, E).error).toMatch(/brennbar/);
  });
  it("Gemisch: Summe der Anteile höchstens 1", () => {
    expect(() => C.mixtureValue([{ label: "a", x: 0.7, Hs_v: 1, Hi_v: 1 }, { label: "b", x: 0.4, Hs_v: 1, Hi_v: 1 }])).toThrow();
    expect(C.mixtureValue([{ label: "a", x: 0.6, Hs_v: 10, Hi_v: 9 }]).note).toMatch(/inert/);
  });
});

describe("Gleichgewicht (CH-G)", () => {
  it("K aus Δ_rG°, van't Hoff gegen Temperaturfunktion", () => {
    expect(C.eqConstant(0, 500).K).toBe(1);
    expect(C.vantHoff(-14, 0, 298.15, 350).logK).toBe(-14);
    // Kw: PHREEQC-Funktion bei 25 °C trifft −14 auf 0,01 (Tabellenwert −14 gilt bei 25 °C)
    expect(C.analyticLogK(eq("Kw").analytic!, 298.15).logK).toBeCloseTo(-14, 1);
    expect(C.logKAt(eq("Kw"), 333.15).method).toBe("analytisch");
    expect(C.logKAt(eq("H3PO4"), 333.15).method).toBe("vant_hoff");
    expect(() => C.logKAt(eq("HClO"), 333.15)).toThrow(/25 °C/);
  });
  it("Richtung aus Q und K", () => {
    expect(C.reactionQuotient([{ label: "A", nu: -1, activity: 1 }, { label: "B", nu: 1, activity: 0.5 }], 1, 298.15).direction).toBe("vorwaerts");
    expect(C.reactionQuotient([{ label: "A", nu: -1, activity: 1 }, { label: "B", nu: 1, activity: 2 }], 1, 298.15).direction).toBe("rueckwaerts");
  });
  it("Veresterung K = 4: Umsatz 2/3 (Lehrbuch)", () => {
    const r = C.equilibriumExtent([{ label: "S", nu: -1, n0: 1, kind: "geloest" }, { label: "A", nu: -1, n0: 1, kind: "geloest" }, { label: "E", nu: 1, n0: 0, kind: "geloest" }, { label: "W", nu: 1, n0: 0, kind: "geloest" }], 4, { mode: "loesung", V: 1e-3 });
    expect(r.xi).toBeCloseTo(2 / 3, 10);
  });
  it("Le Chatelier: höherer Druck verschiebt Ammoniak-Gleichgewicht zu NH₃", () => {
    const s = [{ label: "N2", nu: -1, n0: 1, kind: "gas" as const }, { label: "H2", nu: -3, n0: 3, kind: "gas" as const }, { label: "NH3", nu: 2, n0: 0, kind: "gas" as const }];
    expect(C.equilibriumExtent(s, 1e-4, { mode: "gas", p: 300e5 }).xi!).toBeGreaterThan(C.equilibriumExtent(s, 1e-4, { mode: "gas", p: 100e5 }).xi!);
  });
  it("reiner Feststoff aufgebraucht: Reaktion endet an der Grenze", () => {
    const r = C.equilibriumExtent([{ label: "CaCO3", nu: -1, n0: 0.01, kind: "rein" }, { label: "CaO", nu: 1, n0: 0, kind: "rein" }, { label: "CO2", nu: 1, n0: 0.0001, kind: "gas" }, { label: "N2", nu: 1e-300, n0: 1, kind: "gas" }], 0.5, { mode: "gas", p: 1e5 });
    expect(r.xi).toBeCloseTo(0.01, 12);
    expect(r.limited).toBe("CaCO3");
  });
  it("Fehlerfälle", () => {
    expect(C.equilibriumExtent([{ label: "A", nu: -1, n0: 1, kind: "gas" }], 1, { mode: "gas", p: 1e5 }).error).toMatch(/Produkte/);
    expect(C.equilibriumExtent([{ label: "A", nu: -1, n0: 0, kind: "gas" }, { label: "B", nu: 1, n0: 0, kind: "gas" }], 1, { mode: "gas", p: 1e5 }).error).toMatch(/keine Reaktion/);
  });
});

describe("Kinetik (CH-A)", () => {
  it("RGT-Regel: E_A ≈ 50 kJ/mol verdoppelt k zwischen 20 und 30 °C", () => {
    expect(C.rateFactor(50e3, 293.15, 303.15).factor).toBeCloseTo(1.97, 2);
  });
  it("Halbwertszeiten und Grenzen", () => {
    expect(C.rateLaw(1, Math.LN2, 1, 1).c).toBeCloseTo(0.5, 14);
    expect(C.rateLaw(0, 1, 10, 100).c).toBe(0);
    expect(() => C.rateLaw(1, 1, 1, 1, 1)).toThrow();
    expect(() => C.activationEnergy(1, 300, 2, 300)).toThrow();
  });
});

describe("Elektrochemie (CH-Z)", () => {
  it("Daniell-Element 1,10 V, Zellreaktion, Nernst", () => {
    const c = C.cell(h("Cu2"), h("Zn"), 298.15);
    expect(c.dE0).toBeCloseTo(1.1037, 10);
    expect(c.equation).toBe("Cu^2+(aq) + Zn(s) → Cu(s) + Zn^2+(aq)");
    expect(c.cathode.id).toBe("Cu2");
    expect(C.nernst(h("Cu2"), 298.15, { "Cu^2+(aq)": 0.01 }).E).toBeCloseTo(0.3419 - (C.R_GAS * 298.15 / (2 * C.F_FARADAY)) * Math.log(100), 12);
  });
  it("Bleiakku 2,05 V; Wasser 1,229 V; Elektronen werden verrechnet", () => {
    const b = C.cell(h("PbO2"), h("PbSO4"), 298.15);
    expect(b.dE0).toBeCloseTo(2.0501, 4);
    expect(b.equation).toBe("PbO2(s) + SO4^2-(aq) + 4 H^+(aq) + Pb(s) + SO4^2-(aq) → PbSO4(s) + 2 H2O(l) + PbSO4(s)".replace(" + SO4^2-(aq) + 4 H^+(aq) + Pb(s) + SO4^2-(aq)", " + 2 SO4^2-(aq) + 4 H^+(aq) + Pb(s)").replace("PbSO4(s) + 2 H2O(l) + PbSO4(s)", "2 PbSO4(s) + 2 H2O(l)"));
    expect(C.cell(h("O2_H2O"), h("H"), 298.15).z).toBe(4);
  });
  it("Luther und Faraday", () => {
    expect(C.luther(2, -0.447, 1, 0.771).E3).toBeCloseTo(-0.041, 12);
    expect(C.faraday({ I: 1, t: C.F_FARADAY, z: 1 }).n).toBeCloseTo(1, 14);
    expect(() => C.faraday({ I: 1, z: 1 })).toThrow();
  });
  it("Wasserelektrolyse: U_rev 1,229 V, U_th 1,481 V, 39,4 kWh/kg bei η = 1", () => {
    const e = C.electrolysis({ dG: 237100, dH: 285800, z: 2, U: 285800 / (2 * C.F_FARADAY), M: 0.002016 });
    expect(e.Urev).toBeCloseTo(1.2287, 4);
    expect(e.eta).toBeCloseTo(1, 12);
    expect(e.w / 3.6e6).toBeCloseTo(39.38, 2);
    expect(() => C.electrolysis({ dG: -1, dH: 1, z: 2, U: 2, M: 1 })).toThrow();
  });
});

describe("Wasserchemie (CH-W)", () => {
  it("Debye-Hückel A(25 °C) = 0,511, Davies γ₁(0,01) ≈ 0,90", () => {
    const A = C.debyeHuckelA(298.15).A;
    expect(A).toBeCloseTo(0.5108, 3);
    expect(C.davies(1, 0.01, A).gamma).toBeCloseTo(0.9018, 3);
    expect(() => C.davies(1, 0.6, A)).toThrow();
  });
  it("pH: Essigsäure 0,1 mol/L 2,88; sehr verdünnte Salzsäure 6,79; Neutralpunkt 7", () => {
    expect(C.acidBase({ systems: [{ label: "HAc", cT: 100, pK: [4.757], z0: 0 }], strong: [], pKw: 14, T: 298.15, activity: false }).pH).toBeCloseTo(2.881, 3);
    expect(C.acidBase({ systems: [], strong: [{ label: "Cl⁻", c: 1e-4, z: -1 }], pKw: 14, T: 298.15, activity: false }).pH).toBeCloseTo(6.791, 3);
    expect(C.acidBase({ systems: [], strong: [], pKw: 14, T: 298.15, activity: false }).pH).toBeCloseTo(7, 10);
  });
  it("Henderson-Hasselbalch stimmt für den Acetatpuffer bis auf die Aktivitätskorrektur", () => {
    const ex = C.acidBase({ systems: [{ label: "HAc", cT: 200, pK: [4.757], z0: 0 }], strong: [{ label: "Na⁺", c: 100, z: 1 }], pKw: 14, T: 298.15, activity: false }).pH!;
    expect(Math.abs(ex - C.hendersonHasselbalch(4.757, 100, 100).pH)).toBeLessThan(0.002);
  });
  it("Härte: 80 mg/L Ca + 12 mg/L Mg = 2,49 mmol/L = 14,0 °dH, mittel", () => {
    const r = C.hardness(0.08, 0.012, 4, E);
    expect(r.c).toBeCloseTo(2.4898, 4); expect(r.dH).toBeCloseTo(13.96, 2); expect(r.range).toBe("mittel"); expect(r.KH).toBe(2);
    expect(C.hardness(0.02, 0, null, E).range).toBe("weich");
  });
  it("Kalk-Kohlensäure: SI und pH_C konsistent, D_C verschwindet im Sättigungszustand", () => {
    const L = (id: string, T: number) => C.logKAt(eq(id), T).logK;
    const base = { T: 283.15, Ca: 2, alk: 4, I: 0.008, logK1: L("H2CO3", 283.15), logK2: L("HCO3", 283.15), logKw: L("Kw", 283.15), logKsp: L("Calcit", 283.15), logKH: L("CO2g", 283.15) };
    const r = C.carbonate({ ...base, pH: 7.5 }, E);
    const sat = C.carbonate({ ...base, pH: r.pHC }, E);
    expect(Math.abs(sat.SI)).toBeLessThan(1e-9);
    expect(r.SI).toBeGreaterThan(0); expect(r.D).toBeLessThan(0);
    expect(C.carbonate({ ...base, pH: 7.0 }, E).D).toBeGreaterThan(0);
  });
  it("Ionenbilanz und Leitfähigkeit", () => {
    expect(C.ionBalance([{ label: "Na", c: 1, z: 1 }, { label: "Cl", c: 1, z: -1 }]).error).toBe(0);
    expect(C.ionicStrengthFromConductivity(500).I).toBeCloseTo(0.008, 12);
  });
});

describe("Katalogfälle", () => {
  it("alle 56 neuen IDs kommen in den Beispielfällen vor", () => {
    const ids = new Set(chemieFaelleV11().flatMap((f) => f.steps.map((s) => s.id)));
    expect([...ids].filter((i) => /^CH-[TGAZW]/.test(i)).length).toBe(56);
  });
});
