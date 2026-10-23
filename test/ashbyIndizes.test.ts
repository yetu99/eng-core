/**
 * Prüffälle Ashby weitere Materialindizes (eng-core 0.8.0), Konzept mechanik_ashby/konzept_ashby_indizes.md Abschnitt 6.
 * P4 und P5 (Einzelwerte, Bewertbarkeit, Rangfolge über alle 100 Werkstoffe) laufen als Golden aus verification/pruefung.py.
 */
import { describe, expect, it } from "vitest";
import {
  buildIndex, indexValue, indexId, indexTrace, indexLabel, pointTrace, points, ranking, coverage, requiredProps, allIndexSpecs, allIndexKeys,
  FUNCS, FUNC_GROUPS, productTasks, isCompound, powSubst, axisGroup, fmt, type AshbyState, type MatClass, type FunctionName, type ObjectiveName, type FreeVar,
} from "../src/index";
import { repo } from "../src/data";
import { collectCatalog } from "../scripts/katalog";

const ALL: Record<MatClass, boolean> = { Metall: true, Polymer: true, Keramik: true, Verbundwerkstoff: true, Naturwerkstoff: true };
const st = (fn: FunctionName, con: string, obj: ObjectiveName, free: FreeVar = "Querschnitt", classes = ALL): AshbyState =>
  ({ index: buildIndex(fn, con, obj, free)!, classes, limits: { Emin: null, rhoMax: null, sfMin: null, priceMax: null }, shapeMode: "none", phiUser: null });

const NEW_IDS = [
  ...["S", "F"].flatMap((c) => ["M", "K", "V"].flatMap((o) => [`A-IX-BAH-${c}-${o}`, `A-IX-BAB-${c}-${o}`])),
  "A-IX-GE-F-L", "A-IX-DB-Y-L", "A-IX-DB-L-L", "A-IX-WD-Q-D", "A-IX-WD-Q-K", "A-IX-WD-Z-E", "A-IX-WS-E-K", "A-IX-PT-V-L", "A-IX-TS-T-L", "A-IX-WT-P-A", "A-IX-WT-P-M",
];

describe("Indexkatalog 0.8.0", () => {
  const ids = allIndexSpecs().map((s) => indexId(buildIndex(s.fn, s.con, s.obj, s.free)!));
  it("23 neue IDs, alle eindeutig", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of NEW_IDS) expect(ids).toContain(id);
    expect(NEW_IDS.length).toBe(23);
  });
  it("bestehende 30 IDs unverändert vorhanden (6 Funktionen bis 0.7.0)", () => {
    const old = ids.filter((i) => /^A-IX-(ZS|BA|WE|ST|PL|FE)-/.test(i));
    expect(old.length).toBe(30);
    expect(old).toContain("A-IX-BA-S-M");
  });
  it("Kachelgruppen: 8 mechanisch, 5 thermisch, jede Funktion genau einmal", () => {
    expect(FUNC_GROUPS.Mechanisch.length).toBe(8); expect(FUNC_GROUPS.Thermisch.length).toBe(5);
    const all = [...FUNC_GROUPS.Mechanisch, ...FUNC_GROUPS.Thermisch];
    expect(new Set(all).size).toBe(Object.keys(FUNCS).length);
    for (const f of all) expect(FUNCS[f].group).toBe(FUNC_GROUPS.Mechanisch.includes(f) ? "Mechanisch" : "Thermisch");
  });
  it("Wärmedämmung hat drei Aufgaben (Temperaturanstieg gestrichen), Wärmespeicher eine", () => {
    expect(productTasks("Wärmedämmung").map((t) => t.id)).toEqual(["A-IX-WD-Q-D", "A-IX-WD-Q-K", "A-IX-WD-Z-E"]);
    expect(productTasks("Wärmespeicher").map((t) => t.id)).toEqual(["A-IX-WS-E-K"]);
  });
  it("ungültige Kombinationen liefern null", () => {
    expect(buildIndex("Wärmedämmung", "Zyklus", "Kosten")).toBeNull();
    expect(buildIndex("Zugstab", "Steifigkeit", "Masse", "Höhe")).toBeNull();
    expect(buildIndex("Präzisionsteil", "Verzerrung", "Leistung", "Höhe")).toBeNull();
    expect(buildIndex("Balken", "Steifigkeit", "CO₂", "Höhe")).toBeNull();
    expect(buildIndex("Gelenk", "Biegung ohne Versagen", "Masse")).toBeNull();
    expect(buildIndex("Balken", "Steifigkeit", "Leistung")).toBeNull();
  });
  it("allIndexKeys ohne freie Variable, allIndexSpecs mit", () => {
    expect(allIndexKeys().length).toBe(allIndexSpecs().filter((s) => s.free === "Querschnitt").length);
    expect(allIndexSpecs().length - allIndexKeys().length).toBe(12);
  });
});

describe("Korrekturrunde 21.10.2026", () => {
  it("Wärmetauscher je Masse: M = λ·σ_f²/ρ (Rohrwand, t ∝ 1/σ_f), Rechenweg mit σ_f²", () => {
    const x = st("Wärmetauscherwand", "Druck", "Masse"), ix = x.index;
    expect(ix.M).toBe("λ·σ_f² / ρ"); expect(ix.slope).toBe(1);
    const m = repo.byId("W038")!, p = points(repo, x, false).find((q) => q.m.id === "W038")!;
    expect(p.idx).toBeCloseTo(m.lam! * m.Rp! ** 2 / m.rho!, 9);
    const gr = pointTrace(ix, x, p, false).find((s) => s.id === "A-GR-Y")!;
    expect(gr.subst).toBe("λ·σ_f² = 195 · 260^2"); expect(gr.value).toBeCloseTo(195 * 260 ** 2, 6);
  });
  it("Leck vor Bruch bleibt K_IC²/σ_f (Ashby Gl. 6.49, M₂), Fließen vor Bruch K_IC/σ_f (M₁)", () => {
    expect(buildIndex("Druckbehälter", "Leck vor Bruch", "Leistung")!.M).toBe("K_IC² / σ_f");
    expect(buildIndex("Druckbehälter", "Fließen vor Bruch", "Leistung")!.M).toBe("K_IC / σ_f");
  });
  it("Dichte im Katalog als ρ (U+03C1), nie lateinisches p", () => {
    const bad = collectCatalog().filter((e) => e.group === "A" && /(^|[\s/·(])p([\s)·]|$)/.test(e.formula)).map((e) => e.id);
    expect(bad).toEqual([]);
    expect([...buildIndex("Balken", "Festigkeit", "Masse", "Breite")!.M].pop()!.codePointAt(0)).toBe(0x3c1);
  });
});

describe("Lesbarer Rechenweg (Browser-Abnahme 21.10.2026)", () => {
  it("powSubst: Exponent 1 weg, negative als Bruch, X^0 entfällt", () => {
    expect(powSubst(13182000, 1, 2700, -1)).toBe(`(${fmt(13182000)}) / 2700`);
    expect(powSubst(195, -1, 2700, 0)).toBe("1 / 195");
    expect(powSubst(195, 1, 260, 1)).toBe("195 · 260");
    expect(powSubst(4.75, 2, 300, -1)).toBe("4,75^2 / 300");
    expect(powSubst(195, -0.5, 2.4e6, -0.5)).toBe(`1 / (195^0,5 · (${fmt(2.4e6)})^0,5)`);
  });
  it("Einheit mit Exponent ohne Klammer um das Hochzeichen", () => {
    expect(axisGroup(["lam", ["sf", 2]]).unit).toBe("W/(m·K)·MPa²");
    expect(axisGroup([["lam", 2]]).unit).toBe("(W/(m·K))²");
  });
});

describe("P1 Wiki-Zahlenbeispiel Balken steif leicht (Stahl/Al)", () => {
  const ix = buildIndex("Balken", "Steifigkeit", "Masse")!;
  it("M und Massenverhältnis", () => {
    const st_ = indexValue(ix, 210, 7850), al = indexValue(ix, 70, 2700);
    expect(st_).toBeCloseTo(1.846e-3, 6); expect(al).toBeCloseTo(3.0987e-3, 6);
    expect(st_ / al).toBeCloseTo(0.5957, 4);
  });
});

describe("P2 Identitäten Ashby Tab. B1/B2", () => {
  const pairs: Array<[string, FreeVar, FunctionName]> = [["Steifigkeit", "Höhe", "Platte"], ["Steifigkeit", "Breite", "Zugstab"], ["Festigkeit", "Höhe", "Platte"], ["Festigkeit", "Breite", "Zugstab"]];
  for (const [con, free, ref] of pairs) for (const obj of ["Masse", "Kosten", "Bauraum"] as ObjectiveName[]) {
    it(`Balken nur ${free} frei, ${con}, ${obj} = ${ref}`, () => {
      const a = ranking(repo, st("Balken", con, obj, free), false), b = ranking(repo, st(ref, con, obj), false);
      expect(a.map((p) => p.m.id)).toEqual(b.map((p) => p.m.id));
      a.forEach((p, i) => expect(Math.abs(p.idx / b[i]!.idx - 1)).toBeLessThan(1e-12));
      expect(buildIndex("Balken", con, obj, free)!.M).toBe(buildIndex(ref, con, obj)!.M);
    });
  }
});

describe("P3 Steigungen der Leitlinien", () => {
  const S: Array<[FunctionName, string, ObjectiveName, FreeVar, number]> = [
    ["Balken", "Steifigkeit", "Masse", "Höhe", 3], ["Balken", "Steifigkeit", "Masse", "Breite", 1], ["Balken", "Festigkeit", "Masse", "Höhe", 2], ["Balken", "Festigkeit", "Masse", "Breite", 1],
    ["Balken", "Steifigkeit", "Bauraum", "Höhe", 0], ["Gelenk", "Biegung ohne Versagen", "Leistung", "Querschnitt", 1],
    ["Druckbehälter", "Fließen vor Bruch", "Leistung", "Querschnitt", 1], ["Druckbehälter", "Leck vor Bruch", "Leistung", "Querschnitt", 0.5],
    ["Wärmedämmung", "Wärmestrom", "Dicke vorgegeben", "Querschnitt", 0], ["Wärmedämmung", "Wärmestrom", "Kosten", "Querschnitt", -1], ["Wärmedämmung", "Zyklus", "Energie", "Querschnitt", -1],
    ["Wärmespeicher", "Energie", "Kosten", "Querschnitt", 1], ["Präzisionsteil", "Verzerrung", "Leistung", "Querschnitt", 1], ["Thermoschock", "Temperatursprung", "Leistung", "Querschnitt", 1],
    ["Wärmetauscherwand", "Druck", "je Fläche", "Querschnitt", -1], ["Wärmetauscherwand", "Druck", "Masse", "Querschnitt", 1],
  ];
  for (const [fn, con, obj, free, s] of S) it(`${fn} ${con} ${obj} ${free}: ${s}`, () => { expect(buildIndex(fn, con, obj, free)!.slope).toBeCloseTo(s, 12); expect(indexTrace(buildIndex(fn, con, obj, free)!)[0]!.value).toBeCloseTo(s, 12); });
  it("neue Indizes ohne Formwirkung", () => {
    for (const s of allIndexSpecs()) { const ix = buildIndex(s.fn, s.con, s.obj, s.free)!; if (NEW_IDS.includes(indexId(ix))) expect(ix.shape).toBeNull(); }
  });
});

describe("Bewertbarkeit (Konzept Abschnitt 5)", () => {
  it("n = Anzahl Punkte für jeden Index, fehlende Kennwerte benannt", () => {
    for (const s of allIndexSpecs()) {
      const x = st(s.fn, s.con, s.obj, s.free), c = coverage(repo, x);
      expect(c.n).toBe(points(repo, x, false).length);
      expect(c.N).toBe(repo.materials.length);
      for (const m of c.missing) { expect(m.props.length).toBeGreaterThan(0); for (const p of m.props) expect(requiredProps(x.index)).toContain(p); }
    }
  });
  it("Klassenhinweis: Wärmespeicher (WDB 1.0.2), nur Verbundwerkstoffe unter der Hälfte bewertbar", () => {
    // bis WDB 1.0.1 waren hier die Polymere unter der Hälfte (c_p 2 von 24); seit WDB 1.0.2 sind es 21 von 24
    const c = coverage(repo, st("Wärmespeicher", "Energie", "Kosten"));
    expect(c.byClass.find((k) => k.cls === "Verbundwerkstoff")?.low).toBe(true);
    expect(c.byClass.find((k) => k.cls === "Polymer")?.low).toBe(false);
    expect(c.byClass.find((k) => k.cls === "Metall")?.low).toBe(false);
  });
  it("Klassenhinweis datenunabhängig: low genau dann, wenn n < N/2", () => {
    for (const s of allIndexSpecs()) for (const k of coverage(repo, st(s.fn, s.con, s.obj, s.free)).byClass) expect(k.low).toBe(k.n < k.N / 2);
  });
  it("nur gewählte Klassen zählen", () => {
    const c = coverage(repo, st("Präzisionsteil", "Verzerrung", "Leistung", "Querschnitt", { ...ALL, Metall: false }));
    expect(c.N).toBe(repo.materials.filter((m) => m.cls !== "Metall").length);
    expect(c.byClass.some((k) => k.cls === "Metall")).toBe(false);
  });
});

describe("Rechenweg der Produktindizes", () => {
  it("endet mit A-MP = Indexwert der Rangliste, Achsgruppen nur bei Produkten", () => {
    for (const t of [["Wärmedämmung", "Wärmestrom", "Kosten"], ["Wärmetauscherwand", "Druck", "Masse"], ["Thermoschock", "Temperatursprung", "Leistung"], ["Druckbehälter", "Leck vor Bruch", "Leistung"]] as Array<[FunctionName, string, ObjectiveName]>) {
      const x = st(...t), ix = x.index;
      for (const p of ranking(repo, x, false).slice(0, 5)) {
        const tr = pointTrace(ix, x, p, false);
        expect(tr.find((s) => s.id === "A-MP")?.value).toBe(p.idx);
        expect(tr.find((s) => s.id === "A-REL")?.value).toBe(p.rel);
        expect(tr.some((s) => s.id === "A-GR-X")).toBe(isCompound(ix.product!.xG));
        expect(tr.some((s) => s.id === "A-GR-Y")).toBe(isCompound(ix.product!.yG));
      }
    }
  });
  it("Druckbehälter nutzt A-K-KIC, Thermoschock A-Y-SF, A-Y-E, A-K-ALPHA", () => {
    const d = st("Druckbehälter", "Fließen vor Bruch", "Leistung"), p = ranking(repo, d, false)[0]!;
    expect(pointTrace(d.index, d, p, false).map((s) => s.id)).toContain("A-K-KIC");
    const t = st("Thermoschock", "Temperatursprung", "Leistung"), q = ranking(repo, t, false)[0]!;
    expect(pointTrace(t.index, t, q, false).map((s) => s.id)).toEqual(["A-Y-SF", "A-Y-E", "A-K-ALPHA", "A-GR-X", "A-MP", "A-REL"]);
  });
  it("legacy-Rechenweg der neuen mechanischen Indizes ohne neue Schritt-IDs", () => {
    const x = st("Balken", "Festigkeit", "Kosten", "Höhe"), p = ranking(repo, x, false)[0]!;
    expect(pointTrace(x.index, x, p, false).map((s) => s.id)).toEqual(["A-Y-SF", "A-X-CRHO", "A-M", "A-REL"]);
  });
});

describe("Kürzel-Erklärung (Tooltip, Entscheidung 4)", () => {
  it("jede A-ID im Katalog hat einen Klartext", () => {
    const missing = collectCatalog().filter((e) => e.group === "A" && !indexLabel(e.id)).map((e) => e.id);
    expect(missing).toEqual([]);
  });
  it("Beispiele", () => {
    expect(indexLabel("A-IX-BAH-S-M")).toBe("Materialindex · Balken, nur Höhe frei · Steifigkeit · Masse minimieren");
    expect(indexLabel("A-IX-BA-S-M")).toBe("Materialindex · Balken · Steifigkeit · Masse minimieren");
    expect(indexLabel("A-IX-PT-V-L")).toBe("Materialindex · Präzisionsteil · thermische Verzerrung minimal");
    expect(indexLabel("A-MP")).toContain("Produkt von Potenzen");
    expect(indexLabel("X-UNBEKANNT")).toBeNull();
  });
});

describe("P6 bis P8 Plausibilität gegen Ashby (Größenordnung, Rangfolge)", () => {
  const val = (x: AshbyState, id: string) => points(repo, x, false).find((p) => p.m.id === id)?.idx ?? NaN;
  it("P6 Tab. 6.40: λ/α in W/m (α in 1/K) für Al ~10⁷, Cu ~2·10⁷ (Faktor ≤ 2)", () => {
    const x = st("Präzisionsteil", "Verzerrung", "Leistung");
    const al = val(x, "W038") * 1e6, cu = val(x, "W044") * 1e6;
    expect(al / 1e7).toBeGreaterThan(0.5); expect(al / 1e7).toBeLessThan(2);
    expect(cu / 2e7).toBeGreaterThan(0.5); expect(cu / 2e7).toBeLessThan(2);
  });
  it("P7 Tab. 6.38: √(λ·ρ·c_p) = 1 / M(WD-Z-E) für Beton und Glas ~3·10³ (Faktor ≤ 2,5)", () => {
    const x = st("Wärmedämmung", "Zyklus", "Energie");
    for (const id of ["W088", "W086"]) { const e = 1 / val(x, id); expect(e / 3e3).toBeGreaterThan(0.4); expect(e / 3e3).toBeLessThan(2.5); }
  });
  it("P8 Rangfolge: Präzision PKD und Cu vorn, Gelenk Elastomer vorn, Speicher je Kosten Beton vorn, Dämmung Cu hinten", () => {
    const top = (x: AshbyState, n: number) => ranking(repo, x, false).slice(0, n).map((p) => p.m.id);
    expect(top(st("Präzisionsteil", "Verzerrung", "Leistung"), 5)).toEqual(expect.arrayContaining(["W089", "W044"]));
    expect(ranking(repo, st("Gelenk", "Biegung ohne Versagen", "Leistung"), false)[0]!.m.elastomer).toBe(true);
    expect(top(st("Wärmespeicher", "Energie", "Kosten"), 1)).toEqual(["W088"]);
    const d = ranking(repo, st("Wärmedämmung", "Wärmestrom", "Dicke vorgegeben"), false);
    expect(d.slice(-3).map((p) => p.m.name).some((n) => n.startsWith("Cu"))).toBe(true);
  });
});
