/**
 * Modul chemie (eng-core 0.24.0, Werkzeug Chemiewerk): Golden-Fälle aus Konzept Abschn. 4, Konventionen, Grenzfälle.
 * Zahlenwerte gegen die unabhängige Python-Rechnung stehen zusätzlich in golden.json (verification/chemie.py, Fälle CH-…).
 */
import { describe, expect, it } from "vitest";
import { chemie as C, MODULES, TOOLS } from "../src/index";
import { CH_TABLE as T, CH_SNAPSHOT, iso, sp, chemieFaelle } from "../scripts/chemie-faelle";

const bal = (l: string[], r: string[]) => C.balance(sp(l, r));
const ox = (f: string) => Object.fromEntries(C.oxidationStates(f, T).atoms.map((a) => [a.element, a.ox.toString(true)]));

describe("Register und Konstanten", () => {
  it("Modul chemie mit Präfix CH, Werkzeug chemiewerk, ohne Werkstoff- und Fachdaten", () => {
    expect(MODULES.chemie.prefixes).toEqual(["CH"]);
    expect(TOOLS.chemiewerk.modules).toEqual(["chemie"]);
    expect(MODULES.chemie.fd).toBe(false);
  });
  it("CODATA 2022, DIN 1343, 118 Symbole", () => {
    expect(C.R_GAS).toBeCloseTo(8.314462618, 9);
    expect(C.VM_NORM * 1000).toBeCloseTo(22.413969545, 8);
    expect(C.SYMBOLS).toHaveLength(118);
    expect(C.zOf("Og")).toBe(118);
    expect(CH_SNAPSHOT.version).toBe("ch-2026-11-25a");
  });
});

describe("Formelparser (CH-P)", () => {
  it("Gruppen, Hydrate, Komplexe, Zustand, Hill", () => {
    expect(C.parseFormula("Ca(OH)2").composition).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(C.parseFormula("CuSO4·5H2O").composition).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    expect(C.parseFormula("CuSO4*5H2O").hill).toBe("CuH10O9S");
    const k = C.parseFormula("[Cu(NH3)4]^2+");
    expect(k.composition).toEqual({ Cu: 1, N: 4, H: 12 }); expect(k.charge).toBe(2); expect(k.display).toBe("[Cu(NH₃)₄]²⁺");
    const f = C.parseFormula("Fe^3+(aq)"); expect(f.charge).toBe(3); expect(f.state).toBe("aq");
    expect(C.parseFormula("C2H5OH").hill).toBe("C2H6O");
    expect(C.parseFormula("C₆H₁₂O₆").hill).toBe("C6H12O6");
  });
  it("CH-E1: eindeutige Ladungen", () => {
    for (const [f, q] of [["Fe^2+", 2], ["Fe²⁺", 2], ["Fe{2+}", 2], ["MnO4^-", -1], ["MnO4⁻", -1], ["SO4^2-", -2], ["H+", 1], ["Cl-", -1], ["OH-", -1], ["Fe^+3", 3]] as const) {
      const p = C.parseFormula(f); expect(p.ok, f).toBe(true); expect(p.charge, f).toBe(q);
    }
    expect(C.parseFormula("e-").electron).toBe(true);
  });
  it("CH-E1: Ziffer direkt vor dem Vorzeichen wird mit beiden Lesarten gemeldet, nie still gerechnet", () => {
    for (const f of ["MnO4-", "Fe2+", "SO42-", "NH4+"]) {
      const p = C.parseFormula(f);
      expect(p.ok, f).toBe(false); expect(p.readings, f).toHaveLength(2);
    }
    const r = C.parseFormula("SO42-").readings.map((x) => x.formula);
    expect(r).toEqual(["SO42^-", "SO4^2-"]);
  });
  it("Fehlerfälle (CH-P06)", () => {
    for (const f of ["Xy2", "Ca(OH2", "H0", "2H2O", "co", "", "Ca(OH))", "()", "Fe++", "H·", "Ca(((((((O)))))))"]) {
      const p = C.parseFormula(f); expect(p.ok, f).toBe(false); expect(p.steps[0]!.id, f).toBe("CH-P06");
    }
    expect(C.parseFormula("Co").composition).toEqual({ Co: 1 });
    expect(C.parseFormula("CO").composition).toEqual({ C: 1, O: 1 });
  });
});

describe("Molare Masse (CH-M)", () => {
  it("Golden: Molmassen und Massenanteil", () => {
    const g: Record<string, number> = { H2O: 18.015, CO2: 44.009, H2SO4: 98.072, Fe3O4: 231.531, C6H12O6: 180.156, NaCl: 58.439769, "CuSO4·5H2O": 249.677 };
    for (const [f, v] of Object.entries(g)) { const r = C.molarMass(f, T); expect(r.Mr!, f).toBeCloseTo(v, 6); expect(r.M!, f).toBeCloseTo(v / 1000, 9); }
    expect(C.molarMass("H2O", T).fractions.find((x) => x.element === "H")!.w).toBeCloseTo(0.111907, 6);
  });
  it("Ion mit Hinweis, Element ohne Standardatomgewicht mit Hinweis (CH-E3, CH-E4)", () => {
    expect(C.molarMass("SO4^2-", T).notes.some((n) => n.includes("Elektronenmasse"))).toBe(true);
    expect(C.molarMass("TcO4^-", T).notes.some((n) => n.includes("Tc: kein Standardatomgewicht"))).toBe(true);
  });
});

describe("Bilanzieren (CH-B)", () => {
  it("Golden: eindeutige Gleichungen", () => {
    expect(bal(["C3H8", "O2"], ["CO2", "H2O"]).coefficients).toEqual([1, 5, 3, 4]);
    expect(bal(["KMnO4", "HCl"], ["KCl", "MnCl2", "Cl2", "H2O"]).coefficients).toEqual([2, 16, 2, 2, 5, 8]);
    expect(bal(["Fe", "Cl2"], ["FeCl3"]).coefficients).toEqual([2, 3, 2]);
    expect(bal(["NaOH", "H2SO4"], ["Na2SO4", "H2O"]).coefficients).toEqual([2, 1, 1, 2]);
    expect(bal(["Fe2O3", "CO"], ["Fe", "CO2"]).coefficients).toEqual([1, 3, 2, 3]);
    expect(bal(["N2", "H2"], ["NH3"]).coefficients).toEqual([1, 3, 2]);
    expect(bal(["CuSO4·5H2O"], ["CuSO4", "H2O"]).coefficients).toEqual([1, 1, 5]);
    expect(bal(["MnO4^-", "Fe^2+", "H^+"], ["Mn^2+", "Fe^3+", "H2O"]).coefficients).toEqual([1, 5, 8, 1, 5, 4]);
    expect(bal(["Ca(OH)2", "CO2"], ["CaCO3", "H2O"]).equation).toBe("Ca(OH)₂ + CO₂ → CaCO₃ + H₂O");
  });
  it("mehrdeutig, nicht bilanzierbar, Vorzeichen, Grenzen", () => {
    expect(bal(["H2", "O2"], ["H2O", "H2O2"]).status).toBe("mehrdeutig");
    const n = bal(["Fe", "O2"], ["FeCl3"]); expect(n.status).toBe("nicht_bilanzierbar"); expect(n.message).toBe("Element Cl fehlt auf der Eduktseite; Element O fehlt auf der Produktseite");
    expect(bal(["H2O"], ["H2", "O2", "N2"]).status).toBe("nicht_bilanzierbar");
    expect(bal(["H2", "H2O"], ["O2"]).message).toContain("gehört auf die andere Seite");
    expect(bal(["MnO4^-", "H2O2", "H^+"], ["Mn^2+", "O2", "H2O"]).status).toBe("mehrdeutig");
    expect(bal(Array.from({ length: 11 }, () => "H2"), ["H2O"]).status).not.toBe("fehler");
    expect(bal(Array.from({ length: 12 }, () => "H2"), ["H2O"]).status).toBe("fehler");
    expect(bal(["MnO4-"], ["Mn^2+"]).status).toBe("fehler");
    const b = bal(["C3H8", "O2"], ["CO2", "H2O"]);
    expect(b.check.every((c) => c.left === c.right)).toBe(true);
    expect(b.matrix.rows).toEqual(["C", "H", "O"]);
  });
  it("große Koeffizienten exakt (BigInt)", () => {
    const r = bal(["K4Fe(CN)6", "KMnO4", "H2SO4"], ["KHSO4", "Fe2(SO4)3", "MnSO4", "HNO3", "CO2", "H2O"]);
    expect(r.coefficients).toEqual([10, 122, 299, 162, 5, 122, 60, 60, 188]);
  });
});

describe("Stöchiometrie (CH-S)", () => {
  const M = (f: string) => C.molarMass(f, T).M;
  const st: C.StoichSpecies[] = [{ label: "H2", side: "edukt", coefficient: 2, M: M("H2"), gas: true }, { label: "O2", side: "edukt", coefficient: 1, M: M("O2"), gas: true }, { label: "H2O", side: "produkt", coefficient: 2, M: M("H2O"), gas: false }];
  it("Golden: 4 g H₂ und 40 g O₂, H₂ limitierend", () => {
    const r = C.stoichiometry(st, [{ index: 0, kind: "m", value: 0.004 }, { index: 1, kind: "m", value: 0.04 }]);
    expect(r.xi!).toBeCloseTo(0.9920635, 7);
    expect(r.rows[0]!.limiting).toBe(true);
    expect(r.rows[2]!.m! * 1000).toBeCloseTo(35.744048, 5);
    expect(r.rows[1]!.rest_m! * 1000).toBeCloseTo(8.255952, 5);
    expect(r.rows[2]!.V).toBeNull();
  });
  it("Gasvolumen Normzustand und ideales Gas, Ausbeute", () => {
    const r = C.stoichiometry(st, [{ index: 1, kind: "n", value: 1 }]);
    expect(r.rows[1]!.V! * 1000).toBeCloseTo(22.41397, 5);
    const g = C.stoichiometry(st, [{ index: 1, kind: "n", value: 1 }], { mode: "frei", T: 298.15, p: 1e5 }, 0.85);
    expect(g.rows[1]!.V! * 1000).toBeCloseTo(24.78957, 5);
    expect(g.rows[2]!.n).toBeCloseTo(1.7, 12);
    expect(C.yieldOf(0.03, 0.04).eta).toBeCloseTo(0.75, 14);
  });
  it("Vorgaben: gemischt, null, negativ, unbilanziert", () => {
    expect(C.stoichiometry(st, [{ index: 0, kind: "n", value: 1 }, { index: 2, kind: "n", value: 1 }]).ok).toBe(false);
    expect(C.stoichiometry(st, [{ index: 0, kind: "n", value: 0 }]).ok).toBe(false);
    expect(C.stoichiometry(st, [{ index: 0, kind: "n", value: 1 }], undefined, 1.2).ok).toBe(false);
    expect(C.stoichiometry([{ ...st[0]!, coefficient: 0 }], [{ index: 0, kind: "n", value: 1 }]).ok).toBe(false);
  });
});

describe("Oxidationszahlen (CH-O)", () => {
  it("Golden: Regeln, Konflikte, Brüche", () => {
    expect(ox("Fe3O4")).toEqual({ Fe: "+8/3", O: "−2" });
    expect(ox("KMnO4")["Mn"]).toBe("+7");
    expect(ox("K2Cr2O7")["Cr"]).toBe("+6");
    expect(ox("H2O2")["O"]).toBe("−1");
    expect(ox("NaH")["H"]).toBe("−1");
    expect(ox("OF2")["O"]).toBe("+2");
    expect(ox("KO2")["O"]).toBe("−1/2");
    expect(ox("S2O3^2-")["S"]).toBe("+2");
    expect(ox("NH4^+")["N"]).toBe("−3");
    expect(ox("CH4")["C"]).toBe("−4");
    expect(ox("C6H12O6")["C"]).toBe("0");
    expect(ox("HClO4")["Cl"]).toBe("+7");
    expect(ox("ICl")).toEqual({ Cl: "−1", I: "+1" });
    expect(ox("LiAlH4")["H"]).toBe("−1");
    expect(ox("O2")["O"]).toBe("0");
    expect(ox("Hg2^2+")["Hg"]).toBe("+1");
  });
  it("CH-E8: Schätzung bei mehreren freien Elementen ist markiert", () => {
    const r = C.oxidationStates("CuFeS2", T);
    expect(r.estimated).toBe(true); expect(ox("CuFeS2")).toEqual({ Cu: "+2", Fe: "+2", S: "−2" });
    expect(C.oxidationStates("FeS2", T).estimated).toBe(true);
    expect(C.oxidationStates("KMnO4", T).estimated).toBe(false);
  });
});

describe("Redox (CH-R, Modus D)", () => {
  const rx = (l: string[], r: string[], m: C.RedoxMedium) => C.redox(sp(l, r), m, T);
  it("Golden: sauer und basisch", () => {
    const a = rx(["MnO4^-", "Fe^2+"], ["Mn^2+", "Fe^3+"], "sauer");
    expect(a.equation).toBe("MnO₄⁻ + 5 Fe²⁺ + 8 H⁺ → Mn²⁺ + 5 Fe³⁺ + 4 H₂O"); expect(a.electrons).toBe(5); expect(a.algebraic).toBe("gleich");
    expect(a.reduction!.text).toBe("MnO₄⁻ + 8 H⁺ + 5 e⁻ → Mn²⁺ + 4 H₂O");
    expect(rx(["Cu", "NO3^-"], ["Cu^2+", "NO"], "sauer").equation).toBe("3 Cu + 2 NO₃⁻ + 8 H⁺ → 3 Cu²⁺ + 2 NO + 4 H₂O");
    const h = rx(["MnO4^-", "H2O2"], ["Mn^2+", "O2"], "sauer");
    expect(h.equation).toBe("2 MnO₄⁻ + 5 H₂O₂ + 6 H⁺ → 2 Mn²⁺ + 5 O₂ + 8 H₂O"); expect(h.algebraic).toBe("mehrdeutig"); expect(h.electrons).toBe(10);
    const b = rx(["Cr2O7^2-", "SO3^2-"], ["Cr(OH)3", "SO4^2-"], "basisch");
    expect(b.equation).toBe("Cr₂O₇²⁻ + 3 SO₃²⁻ + 4 H₂O → 2 Cr(OH)₃ + 3 SO₄²⁻ + 2 OH⁻"); expect(b.electrons).toBe(6);
  });
  it("Dis- und Komproportionierung, H₂O als Partner", () => {
    expect(rx(["Cl2"], ["Cl^-", "ClO^-"], "basisch").equation).toBe("Cl₂ + 2 OH⁻ → Cl⁻ + ClO⁻ + H₂O");
    expect(rx(["IO3^-", "I^-"], ["I2"], "sauer").equation).toBe("IO₃⁻ + 5 I⁻ + 6 H⁺ → 3 I₂ + 3 H₂O");
    expect(rx(["H2O2", "Fe^2+"], ["Fe^3+"], "sauer").equation).toBe("H₂O₂ + 2 Fe²⁺ + 2 H⁺ → 2 Fe³⁺ + 2 H₂O");
  });
  it("Hilfsstoffe in der Eingabe werden ignoriert und neu bestimmt", () => {
    expect(rx(["MnO4^-", "Fe^2+", "H^+"], ["Mn^2+", "Fe^3+", "H2O"], "sauer").equation).toBe("MnO₄⁻ + 5 Fe²⁺ + 8 H⁺ → Mn²⁺ + 5 Fe³⁺ + 4 H₂O");
  });
  it("Meldungen: Zuschauer, keine Redoxreaktion, neutral, mehr als zwei Paare", () => {
    expect(rx(["KMnO4", "HCl"], ["MnCl2", "Cl2"], "sauer").message).toContain("Zuschauerionen");
    expect(rx(["NaOH", "HCl"], ["NaCl"], "sauer").status).toBe("keine_redox");
    expect(C.redox(sp(["MnO4^-", "Fe^2+"], ["Mn^2+", "Fe^3+"]), "neutral" as C.RedoxMedium, T).status).toBe("fehler");
    expect(rx(["MnO4^-", "Fe^2+", "Cu"], ["Mn^2+", "Fe^3+", "Cu^2+"], "sauer").status).toBe("fehler");
  });
  it("CH-R08 Elektronenzahl der molekularen Gleichung", () => {
    expect(C.electronTransfer(sp(["KMnO4", "HCl"], ["KCl", "MnCl2", "Cl2", "H2O"]), [2, 16, 2, 2, 5, 8], T).z).toBe(10);
    expect(C.electronTransfer(sp(["KMnO4", "HCl"], ["KCl", "MnCl2", "Cl2", "H2O"]), [1, 1, 1, 1, 1, 1], T).z).toBeNull();
  });
});

describe("Verbindungsvorschlag (CH-V, Modus C)", () => {
  const v = (a: string, b: string) => C.suggestCompound(a, b, T);
  it("Golden", () => {
    expect(v("Al", "O").variants.map((x) => [x.formula, x.equation])).toEqual([["Al2O3", "4 Al + 3 O₂ → 2 Al₂O₃"]]);
    expect(v("O", "Al").variants[0]!.formula).toBe("Al2O3");
    expect(v("Mg", "N").variants[0]!.formula).toBe("Mg3N2");
    expect(v("Na", "Cl").variants[0]!.formula).toBe("NaCl");
    expect(v("Fe", "O").variants.map((x) => x.formula)).toEqual(["FeO", "Fe2O3"]);
    expect(v("H", "N").variants[0]!.formula).toBe("NH3");
    expect(v("Xe", "F").variants.map((x) => x.formula)).toEqual(["XeF2", "XeF4", "XeF6"]);
  });
  it("kein Vorschlag", () => {
    expect(v("Fe", "Cu").ok).toBe(false);
    expect(v("He", "O").ok).toBe(false);
    expect(v("O", "O").ok).toBe(false);
    expect(v("Fe", "Cu").steps[0]!.id).toBe("CH-V05");
  });
});

describe("Isotope und Kern (CH-K)", () => {
  it("Golden: Bindungsenergien", () => {
    const fe = C.bindingEnergy(26, 56, iso(26, 56).mass_u);
    expect(fe.massDefect_u).toBeCloseTo(0.5284628, 7); expect(fe.E_B_MeV).toBeCloseTo(492.25996, 4); expect(fe.E_B_per_A_MeV).toBeCloseTo(8.79036, 5);
    expect(C.bindingEnergy(2, 4, iso(2, 4).mass_u).E_B_MeV).toBeCloseTo(28.29566, 4);
    expect(C.bindingEnergy(8, 16, iso(8, 16).mass_u).E_B_per_A_MeV).toBeCloseTo(7.97621, 5);
    expect(C.bindingEnergy(92, 235, iso(92, 235).mass_u).E_B_per_A_MeV).toBeCloseTo(7.59092, 5);
    expect(C.bindingEnergy(1, 1, iso(1, 1).mass_u).E_B_MeV).toBeCloseTo(0, 6);
  });
  it("Zerfall, Aktivität, Masse, Restzeit, stabil", () => {
    const d = C.decay(1e20, 3600, 7200); expect(d.N).toBeCloseTo(2.5e19, -6); expect(d.A! / 4.8135e15).toBeCloseTo(1, 4);
    const c = iso(6, 14); const n = C.atomsFromMass(1e-6, c.mass_u).N0;
    expect(C.decay(n, c.half_life_s, 0).A! / 1.657217e8).toBeCloseTo(1, 5);
    expect(C.timeToFraction(0.25, c.half_life_s!).t).toBeCloseTo(2 * c.half_life_s!, 0);
    expect(C.decay(1, null, 1e9).stable).toBe(true);
    expect(() => C.decay(1, 0, 1)).toThrow();
  });
  it("mittlere Atommasse Cl und Cu aus dem Abzug", () => {
    const m = (z: number) => C.meanAtomicMass(CH_SNAPSHOT.isotopes.filter((i) => i.z === z && i.abundance).map((i) => ({ mass_u: i.mass_u, abundance: i.abundance! })));
    expect(m(17).mean).toBeCloseTo(35.452139, 5); expect(m(29).mean).toBeCloseTo(63.546039, 5);
    expect(C.meanAtomicMass([{ mass_u: 10, abundance: 1 }, { mass_u: 11, abundance: 1 }]).note).toContain("normiert");
  });
});

describe("Katalog", () => {
  it("alle 57 IDs aus dem Konzept kommen in den Beispielfällen vor", () => {
    const ids = new Set(chemieFaelle().flatMap((f) => f.steps.map((s) => s.id)).filter((id) => id.startsWith("CH-")));
    const exp = ([["P", 7], ["M", 5], ["B", 7], ["S", 8], ["O", 7], ["R", 8], ["V", 5], ["K", 10]] as const).flatMap(([g, n]) => Array.from({ length: n }, (_, i) => `CH-${g}${String(i + 1).padStart(2, "0")}`));
    expect([...ids].sort()).toEqual(exp.sort());
  });
});
