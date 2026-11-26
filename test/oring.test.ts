/**
 * O-Ring (Modul dichtungen, eng-core 0.20.0, Nut zum Ring ab 0.22.0): Fachdaten fd 1.4, Bezeichnung P-OR7, Querschnittsverringerung, Grenzmaße, Fehlerfälle P-OR14,
 * Auslegung, Datenblatt, Grafiken S2 und S4. Literatur- und Gegenrechnungswerte stehen in golden.json (verification/dichtungen.py).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeOring, checkOring, designOring, orRepo, oringDatasheet, oringDesignation, oringSizes, orCompressionProfile, orGapChart, crossSectionReduction, compressionLimits,
  tolClassB, dimLimits, gapAllowed, sizeOf, mediaList, suggestMaterials, OR_WAHL_KEYS, FD_VERSION, FD_FILES, CORE_VERSION, moduleOfId, TRACE_GROUPS, PRUEFSTATUS, type OringInput,
  oringCatalog, oringGrooveForRing, orMainD2,
} from "../src/index";
import { orFaelle, orFehlerfaelle, orKatFaelle, orBase, dim } from "../scripts/or-faelle";
import { orJson } from "../scripts/or-json";

const fall = (id: string): OringInput => orFaelle.find((f) => f.id === id)!.inp;

describe("Fachdaten fd 1.4", () => {
  it("Stand, Zeilenzahlen, Version, Modul, Rechenweg-Gruppen", () => {
    expect(CORE_VERSION).toBe("0.24.0");
    expect(FD_VERSION).toBe("fd 1.5"); // ab eng-core 0.21.0 (Stromwerk Pinstrom), O-Ring-Tabellen unverändert
    expect(["oring_sizes", "oring_cs_tol", "oring_id_tol_a", "oring_grooves", "oring_compression", "oring_gap", "oring_surface", "oring_materials", "oring_media", "oring_cs_select", "fit_shaft_es"]
      .map((k) => FD_FILES[k]!.rows)).toEqual([349, 9, 32, 54, 20, 32, 14, 12, 327, 10, 13]);
    expect(moduleOfId("OR-C")).toBe("dichtungen");
    expect(TRACE_GROUPS.dichtungen).toEqual(["toleranz", "einbauraum", "dehnung", "verpressung", "fuellung", "spalt", "werkstoff", "auslegung", "nachweis"]);
    expect(mediaList(orRepo)).toHaveLength(31);
  });
  it("verification/or_faelle.json ist aktuell (npx tsx scripts/or-json.ts)", () => {
    expect(readFileSync(new URL("../verification/or_faelle.json", import.meta.url), "utf8")).toBe(orJson());
  });
  it("Prüfstatus: 58 Formeln im Modul dichtungen (55 aus 0.20.0, ab 0.22.0 OR-KAT, OR-KATN, OR-KATW)", () => {
    expect(PRUEFSTATUS.modules.dichtungen.formulas).toBe(58);
  });
});

describe("P-OR7 Bezeichnung und Größen", () => {
  it("ISO 3601-1 Abschn. 7.1 Beispiele und Roloff TB 19-2a", () => {
    expect(oringDesignation(sizeOf(orRepo, "011")!, "A", "S")).toBe("O-Ring-ISO3601-1-011A-7,65×1,78-S");
    expect(oringDesignation(sizeOf(orRepo, "125")!, "B", "N")).toBe("O-Ring-ISO3601-1-125B-32,99×2,62-N");
    expect(oringDesignation(sizeOf(orRepo, "211")!, "B", "S").replace("×", "x")).toBe("O-Ring-ISO3601-1-211B-20,22x3,53-S");
    expect(checkOring(orRepo, fall("P-OR15")).designation).toBe("O-Ring-ISO3601-1-211B-20,22×3,53-S");
  });
  it("Normreihe nach d₂, dann d₁; Gl. (A.1) gegen Klasse B (P-OR8)", () => {
    const all = oringSizes(orRepo);
    expect(all).toHaveLength(349);
    for (let i = 1; i < all.length; i++) expect(all[i]!.d2_mm > all[i - 1]!.d2_mm || (all[i]!.d2_mm === all[i - 1]!.d2_mm && all[i]!.d1_mm > all[i - 1]!.d1_mm)).toBe(true);
    for (const s of all) expect(Math.abs(tolClassB(s.d1_mm) - s.tol_b_mm)).toBeLessThanOrEqual(0.005 + 1e-12);
  });
});

describe("Formeln und Grenzfälle", () => {
  it("Querschnittsverringerung Gl. (5), (6): R(0) = 0 (B-or18), R(2) = 1,73, Stetigkeit bei 3 %, steigend", () => {
    expect(crossSectionReduction(0)).toBe(0);
    expect(crossSectionReduction(-2)).toBe(0);
    expect(crossSectionReduction(2)).toBeCloseTo(1.73, 12);
    expect(Math.abs(crossSectionReduction(3) - crossSectionReduction(3 + 1e-12))).toBeLessThan(0.002);
    for (let S = 0.5; S < 25; S += 0.5) expect(crossSectionReduction(S)).toBeGreaterThan(crossSectionReduction(S - 0.5));
  });
  it("Passungen ISO 286-1: H, h, f, g; außerhalb 500 mm Fehler", () => {
    const f7 = dimLimits(orRepo, "d", dim(50, "f7")); expect(typeof f7).toBe("object");
    if (typeof f7 === "object") { expect(f7.min).toBeCloseTo(49.95, 12); expect(f7.max).toBeCloseTo(49.975, 12); }
    const g6 = dimLimits(orRepo, "d", dim(50, "g6")); if (typeof g6 === "object") { expect(g6.max).toBeCloseTo(49.991, 12); expect(g6.min).toBeCloseTo(49.975, 12); }
    expect(typeof dimLimits(orRepo, "d", dim(605, "H8"))).toBe("string");
    expect(typeof dimLimits(orRepo, "d", dim(20, "p6"))).toBe("string");
  });
  it("Bild 8: Stützstellen, linear dazwischen, außerhalb nächster Wert", () => {
    expect(compressionLimits(orRepo, "c_statisch", 5.33)).toMatchObject({ min: 12, max: 28, outside: false });
    const z = compressionLimits(orRepo, "a_hydr_dyn", 3.0);
    expect(z.min).toBeCloseTo(12 - (3 - 2.62) / (3.53 - 2.62), 12);
    expect(compressionLimits(orRepo, "d_axial", 10)).toMatchObject({ min: 13, max: 20, outside: true });
  });
  it("TB 19-3 (P-OR9, B-or17): 80 Shore A wie 70, Silikon ×0,5, über der Tabelle kein Wert", () => {
    expect(gapAllowed(orRepo, 70, 100, 3.53, 1).gZul).toBeCloseTo(0.05, 12);
    expect(gapAllowed(orRepo, 80, 100, 3.53, 1).gZul).toBeCloseTo(0.05, 12);
    expect(gapAllowed(orRepo, 90, 100, 3.53, 1).gZul).toBeCloseTo(0.1, 12);
    expect(gapAllowed(orRepo, 70, 100, 3.53, 0.5).gZul).toBeCloseTo(0.025, 12);
    expect(gapAllowed(orRepo, 70, 120, 3.53, 1).gZul).toBeNull();
    expect(gapAllowed(orRepo, 90, 100, 3.0, 1).column).toBe(2.62);
  });
});

describe("Rechnung Aufgabe A und B", () => {
  it("jeder Fall ohne Fehler, Rechenweg nur mit OR-IDs", () => {
    for (const f of orFaelle) {
      const r = computeOring(orRepo, f.inp);
      expect(r.errors, f.id).toEqual([]);
      for (const s of Object.values(r.trace).flatMap((a) => a ?? [])) expect(moduleOfId(s.id), s.id).toBe("dichtungen");
    }
  });
  it("Parker 8.24 (P-OR1, B-or3): Radialspiel mit d₉min, Exzentrizität addiert", () => {
    const A = checkOring(orRepo, fall("P-OR1A")).values!, B = checkOring(orRepo, fall("P-OR1B")).values!, C = checkOring(orRepo, fall("P-OR1C")).values!;
    expect(A.tmax).toBeCloseTo(1.435, 12);
    expect(B.tmax).toBeCloseTo(15.027 - (14.966 + 12.157) / 2, 12);
    expect(C.tmax - B.tmax).toBeCloseTo(0.05, 12);
    expect(C.tmin).toBeCloseTo(B.tmin - 0.05, 12);
  });
  it("Spalt (P-OR9): Worst Case, geführt, drucklos ohne Extrusion, Stützring vorgesehen nicht bewertbar (U-or5)", () => {
    const a = checkOring(orRepo, fall("P-OR9A"));
    expect(a.values!.g).toBeCloseTo(0.089, 12);
    expect(a.checks.find((c) => c.key === "spalt")!.state).toBe("nicht erfüllt");
    expect(a.backup!.needed).toBe(1);
    expect(checkOring(orRepo, fall("P-OR9B")).values!.g).toBeCloseTo(0.0445, 12);
    expect(checkOring(orRepo, { ...fall("P-OR9A"), p: 0 }).checks.find((c) => c.key === "spalt")!.state).toBe("erfüllt");
    expect(checkOring(orRepo, fall("P-OR9E")).checks.find((c) => c.key === "spalt")!.state).toBe("nicht bewertbar");
    expect(checkOring(orRepo, { ...fall("P-OR9A"), p: 0 }).backup!.needed).toBe(0);
    const k = checkOring(orRepo, fall("P-OR21"));
    expect(k.gapAllowed!.gZul).toBeNull();
    expect(k.backup!.needed).toBe(0);
    expect(k.checks.find((c) => c.key === "spalt")!.state).toBe("nicht bewertbar");
  });
  it("Auslegung (P-OR3): t_x ohne Rundung (B-or5), bester Ring gültig, Übernahme rechnet gleich", () => {
    const r = designOring(orRepo, fall("P-OR3"));
    const d = r.design!;
    expect(d.tx).toBeCloseTo(5.33 * 0.8, 12);
    expect(d.groove.dim.nom).toBeCloseTo(123 - 2 * 5.33 * 0.8, 12);
    expect(d.best).not.toBeNull();
    const a = checkOring(orRepo, d.bestInput!);
    expect(a.values!.Cmin).toBeCloseTo(r.values!.Cmin, 12);
    for (const c of a.checks.filter((x) => OR_WAHL_KEYS.includes(x.key))) expect(c.ok, c.key).toBe(true);
    expect(d.candidates.filter((c) => c.valid).every((c, i, l) => i === 0 || c.score! >= l[i - 1]!.score!)).toBe(true);
  });
  it("Werkstoffvorschlag: Silikon nicht für bewegte Dichtungen, sortiert nach Bewertung", () => {
    const s = suggestMaterials(orRepo, "HLP", -20, 90, true);
    expect(s.some((x) => x.code === "VMQ")).toBe(false);
    for (let i = 1; i < s.length; i++) expect((s[i]!.rating ?? 0) >= (s[i - 1]!.rating ?? 0)).toBe(true);
    expect(s.map((x) => x.code)).toContain("NBR");
  });
  it("Optionen (P-OR18): Temperatur und Quellung erscheinen nur mit Option", () => {
    const r = checkOring(orRepo, fall("P-OR18"));
    expect(r.values!.FQ).toBeCloseTo(r.values!.Fmax * 1.08, 12);
    expect(r.trace.werkstoff!.some((s) => s.id === "OR-CT")).toBe(true);
    const o = checkOring(orRepo, { ...fall("P-OR18"), temp: null, swell: null });
    expect(o.values!.FQ).toBeNull();
    expect((o.trace.werkstoff ?? []).some((s) => s.id === "OR-CT")).toBe(false);
  });
});

describe("Grafiken und Datenblatt", () => {
  it("S2 Verpressung: Ellipse mit Flächengleichheit, Halbachsen aus d₂* und t (10⁻⁹)", () => {
    const r = checkOring(orRepo, fall("P-OR3N")), p = orCompressionProfile(r)!;
    expect(p.states[0]!.t).toBe(r.values!.tmax);
    expect(Math.abs(Math.PI / 4 * p.states[1]!.t * p.states[1]!.w - r.values!.AORmax)).toBeLessThan(1e-9);
    expect(p.curve).toHaveLength(50);
  });
  it("S4 Spalt: Treppen für 70 und 90 Shore A, Betriebspunkt", () => {
    const g = orGapChart(orRepo, 3.53, 70, 100, 0.089, 1);
    expect(g.series.map((s) => s.steps.length)).toEqual([3, 5]);
    expect(g.point.gZul).toBeCloseTo(0.05, 12);
  });
  it("Datenblatt (N-or1, N-or2): Normring mit Bezeichnung, Nut und Rauheit mit Herkunft", () => {
    const d = oringDatasheet(orRepo, { size: "211", d1: null, d2: null, cls: "B", sorte: "S" }, "kolben", "hydraulik");
    expect(d.designation).toBe("O-Ring-ISO3601-1-211B-20,22×3,53-S");
    expect(d.groove!.t_mm).toBe(3.05);
    expect(d.surfaces.length).toBeGreaterThan(0);
    expect(d.Dmax - d.Dmin).toBeCloseTo(2 * (0.27 + 2 * 0.1), 12);
  });
});

describe("Fehlerfälle P-OR14", () => {
  for (const f of orFehlerfaelle) {
    it(`${f.id}: ${f.label}`, () => {
      const r = computeOring(orRepo, f.inp);
      if (f.id === "P-OR14k") { expect(r.errors).toEqual([]); expect(r.warnings.join(" ")).toContain("Nut zu schmal"); }
      else expect(r.errors.length).toBeGreaterThan(0);
    });
  }
  it("Auslegung ohne Bezugsmaß und Flansch ohne d₂", () => {
    expect(designOring(orRepo, orBase({ task: "B" })).errors.length).toBeGreaterThan(0);
    expect(designOring(orRepo, orBase({ task: "B", install: "flansch_innen", d7: dim(50, "H11") })).errors.length).toBeGreaterThan(0);
  });
});

describe("Nut zum Ring (OR-KAT, OR-KATN, OR-KATW, eng-core 0.22.0)", () => {
  const kat = (id: string) => { const f = orKatFaelle.find((x) => x.id === id)!; return oringCatalog(orRepo, f.inp, f.d2max ?? null); };
  const ringOk = (inp: OringInput) => { const a = checkOring(orRepo, inp); return !a.errors.length && a.checks.filter((c) => OR_WAHL_KEYS.includes(c.key)).every((c) => c.ok === true); };
  it("Hauptreihe d₂ aus Bild 8", () => expect(orMainD2(orRepo)).toEqual([1.78, 2.62, 3.53, 5.33, 6.99]));
  it("jede gültige Zeile: Nennmaß im Bereich, Nachweise erfüllt, außerhalb der Grenzen nicht (± 0,002 mm)", () => {
    let n = 0;
    for (const f of orKatFaelle) {
      const c = oringCatalog(orRepo, f.inp, f.d2max ?? null);
      for (const r of c.groups.flatMap((g) => g.rows.filter((x) => x.valid))) {
        const x = r.groove!.dim.nom;
        expect(x).toBeGreaterThanOrEqual(r.lo! - 1e-12); expect(x).toBeLessThanOrEqual(r.hi! + 1e-12);
        expect(ringOk(r.input!)).toBe(true);
        const at = (v: number) => { const k = r.groove!.name === "d₃" ? "d3" : r.groove!.name === "d₆" ? "d6" : "h"; return { ...r.input!, [k]: { ...r.groove!.dim, nom: v } } as OringInput; };
        if (r.lo! > (r.groove!.name === "h" ? 0.06 : 1)) expect(ringOk(at(r.lo! - 0.002))).toBe(false);
        expect(ringOk(at(r.hi! + 0.002))).toBe(false);
        n++;
      }
    }
    expect(n).toBeGreaterThan(20);
  });
  it("Kolben Pneumatik Ø40: Anhang B ohne Normring, Katalog findet 219 (32,92 × 3,53) mit d₃ 34,05 h9", () => {
    expect(designOring(orRepo, { ...orKatFaelle.find((x) => x.id === "P-OR22d")!.inp, design: { C: null, d2: 3.53 } }).design?.best ?? null).toBeNull();
    const c = kat("P-OR22d");
    expect(c.rec?.size).toBe("219"); expect(c.rec?.groove?.dim).toEqual({ nom: 34.05, fit: "h9" });
    expect(c.step?.id).toBe("OR-KATW"); expect(c.rec?.steps.map((s) => s.id)).toEqual(["OR-KAT", "OR-KATN"]);
  });
  it("ISO 3601-2 B.2: Kolben statisch Ø123 empfiehlt 5,33 mm mit dem Ring aus dem Beispiel (348, 110,49 × 5,33)", () => {
    const c = kat("P-OR22a"); expect(c.rec?.d2).toBe(5.33); expect(c.rec?.size).toBe("348"); expect(c.isoD2).toBe(5.33);
  });
  it("Bauraumgrenze d₂ ≤ 3,53 mm wird eingehalten, kein Ring für Kolben Hydraulik Ø15 in der Hauptreihe", () => {
    expect(kat("P-OR22j").rec!.d2).toBeLessThanOrEqual(3.53);
    expect(kat("P-OR22j").groups.filter((g) => !g.allowed).map((g) => g.d2)).toEqual([5.33, 6.99]);
    expect(kat("P-OR22b").rec).toBeNull();
  });
  it("Flansch: Nuttiefe h mit ± Δh/2, Stange: Nutgrund H9; Einzelring wie Tabellenzeile", () => {
    expect(kat("P-OR22h").rec!.groove!.name).toBe("h"); expect(kat("P-OR22h").rec!.groove!.dim.dev).toBeDefined();
    const s = kat("P-OR22f"); expect(s.rec!.groove!.dim.fit).toBe("H9");
    const one = oringGrooveForRing(orRepo, orKatFaelle.find((x) => x.id === "P-OR22f")!.inp, s.rec!.size);
    expect(typeof one === "string" ? one : one.groove).toEqual(s.rec!.groove);
  });
  it("Fehler: Bezugsmaß fehlt, Flansch dynamisch, unbekannte Größe", () => {
    expect(oringCatalog(orRepo, orBase({ task: "B" })).errors).toEqual(["d₄ fehlt"]);
    expect(oringCatalog(orRepo, orBase({ task: "B", install: "flansch_innen", motion: "hydraulik", d7: dim(60, "H9") })).errors.length).toBe(1);
    expect(oringGrooveForRing(orRepo, orKatFaelle[0]!.inp, "999")).toMatch(/nicht in fd_oring_sizes/);
  });
});

