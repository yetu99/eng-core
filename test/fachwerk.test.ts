/**
 * Fachwerk (Modul stabwerke, eng-core 0.23.0): Bestimmtheit, Nullstabregeln, PdvV-Verträglichkeit, Einflusslinie, Kraftgrößenverfahren,
 * Stabnachweis mit Knicken aus dem Kern, Vorlagen, Fehlerfälle. Literatur- und Gegenrechnungswerte stehen in golden.json
 * (verification/stabwerke.py, Fälle P-FW…).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FW_AMP_WARN, computeTruss, computeStrength, bucklingCheck, trussBarProps, trussPreset, trussChordNodes, trussModel, trussPdvv, proposeRedundants, redundantsError, sectionProps, TRUSS_PRESETS, CORE_VERSION, type TrussInput, type StrengthInput, type TrussPresetId } from "../src/index";
import { repo } from "../src/data";
import pruef from "../src/pruefstatus.json";
import { fwJson } from "../scripts/fw-json";
import { fwFaelle, fwFehler } from "../scripts/fw-faelle";

const fall = (id: string): TrussInput => fwFaelle.find((f) => f.id === id)!.inp;
const D = { A: 100, E: 2e5, Rp: 235, iGyr: 10 };

describe("Stand", () => {
  it("Kernversion 0.25.0", () => { expect(CORE_VERSION).toBe("0.25.0"); });
  it("verification/fw_faelle.json ist aktuell (npx tsx scripts/fw-json.ts)", () => {
    expect(readFileSync(new URL("../verification/fw_faelle.json", import.meta.url), "utf8")).toBe(fwJson());
  });
  it("Prüfstatus: 19 Formeln im Modul stabwerke", () => { expect((pruef as { modules: Record<string, { formulas: number }> }).modules["stabwerke"]!.formulas).toBe(19); });
  it("alle Literaturfälle rechenbar, Rechenweg nur mit FW-, K- und N-SK-Schritten", () => {
    for (const f of fwFaelle) {
      const r = computeTruss(f.inp);
      expect(r.errors, f.id).toEqual([]);
      const ids = Object.values(r.trace).flatMap((a) => a!.map((s) => s.id));
      expect(ids.every((id) => id.startsWith("FW-") || id.startsWith("K-") || id === "N-SK"), f.id).toBe(true);
      expect(r.residual!, f.id).toBeLessThan(1e-6 * f.Fref);
    }
  });
  it("deterministisch: zwei Läufe gleich", () => { const f = fall("P-FW6"); expect(JSON.stringify(computeTruss(f))).toBe(JSON.stringify(computeTruss(f))); });
});

describe("Bestimmtheit (FW-ABZ, FW-RANG)", () => {
  it("Dreieck: 2k = s + r, Rang 6, bestimmt", () => { const m = computeTruss(trussPreset("dreieck", D)).model!; expect([m.abz, m.rank, m.n, m.f, m.kind]).toEqual([0, 6, 0, 0, "bestimmt"]); });
  it("Ausnahmefachwerke Gross Abb. 6.2b, c erkannt", () => {
    for (const id of ["P-FW20a", "P-FW20b"]) { const r = computeTruss(fwFehler.find((f) => f.id === id)!.inp); expect(r.kind, id).toBe("ausnahme"); expect(r.errors[0], id).toMatch(/Ausnahmefachwerk/); }
  });
  it("verschieblich, n > 3, Eingabefehler", () => {
    expect(computeTruss(fwFehler.find((f) => f.id === "P-FW20c")!.inp).errors[0]).toMatch(/verschieblich/);
    expect(computeTruss(fwFehler.find((f) => f.id === "P-FW20d")!.inp).errors[0]).toMatch(/n = 3/);
    const e = computeTruss(fwFehler.find((f) => f.id === "P-FW20e")!.inp).errors;
    expect(e).toContain("Stab S4: doppelt (gleiche Knoten wie ein anderer Stab)"); expect(e).toContain("Stab S4: Fläche A muss größer als 0 sein");
    expect(computeTruss({ nodes: [{ x: 0, y: 0 }], bars: [], supports: [], loads: [] }).errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Nullstäbe (FW-NULL, Gross Abb. 6.6)", () => {
  it("Gross Bsp. 6.1: Stab 4 Regel 2, 5 und 9 Regel 3, 10 und 13 Regel 1", () => {
    const r = computeTruss(fall("P-FW2"));
    expect(r.bars.filter((b) => b.zero).map((b) => [b.name, b.zeroRule])).toEqual([["4", 2], ["5", 3], ["9", 3], ["10", 1], ["13", 1]]);
  });
  it("Gross Bsp. 6.3: Stäbe 12 und 13 Regel 1", () => { expect(computeTruss(fall("P-FW3")).bars.filter((b) => b.zero).map((b) => [b.name, b.zeroRule])).toEqual([["12", 1], ["13", 1]]); });
});

describe("PdvV (FW-VV, FW-VS, FW-EL)", () => {
  it("Verschiebungsfigur: Bindung i gibt um 1 nach, alle übrigen Stäbe starr, Lager fest", () => {
    for (const id of ["P-FW2", "P-FW4", "P-FW6"]) {
      const inp = fall(id), m = trussModel(inp);
      for (let b = 0; b < m.s; b++) {
        const p = trussPdvv(inp, m, { kind: "bar", index: b }, () => {});
        if (typeof p === "string") throw new Error(p);
        inp.bars.forEach((bar, c) => {
          const e = m.e[c]!, dl = e[0] * (p.du[bar.j]!.ux - p.du[bar.i]!.ux) + e[1] * (p.du[bar.j]!.uy - p.du[bar.i]!.uy);
          expect(dl, `${id} Bindung ${b} Stab ${c}`).toBeCloseTo(c === b ? -1 : 0, 10);
        });
        m.reactions.forEach((re) => { const d = p.du[re.node]!; expect(re.dir[0] * d.ux + re.dir[1] * d.uy).toBeCloseTo(0, 10); });
      }
    }
  });
  it("Lagerkraft über PdvV: Lager um 1 in Lagerrichtung (Gross Bsp. 6.1, A = F/3)", () => { expect(computeTruss(fall("P-FW2")).pdvv!.value).toBeCloseTo(10000 / 3, 8); });
  it("Dubbel Abb. 12.25e: Einflusslinie linear η(x) = −5/2 + x/(2 m), Laststellung F2, F3 ergibt −55 kN", () => {
    const inp = fall("P-FW6"), r = computeTruss(inp);
    for (const p of r.influence!.points) expect(p.eta).toBeCloseTo(-2.5 + p.x / 2000, 12);
    expect(10 * r.influence!.points[0]!.eta + 20 * r.influence!.points[1]!.eta).toBeCloseTo(-55, 10);
    expect(trussChordNodes(inp, "ober")).toEqual([0, 1, 2]);
  });
  it("PdvV im unbestimmten System: Hinweis statt Ergebnis", () => {
    const r = computeTruss({ ...fall("P-FW11a"), pdvv: { kind: "bar", index: 0 } });
    expect(r.pdvv).toBeNull(); expect(r.warnings).toContain("PdvV nur für statisch und kinematisch bestimmte Fachwerke");
  });
});

describe("Kraftgrößenverfahren (FW-D10, FW-D11, FW-X, FW-SUP)", () => {
  it("Vorschlag und eigene Wahl ergeben gleiche Stabkräfte (Gross TM 2 Bsp. 6.9)", () => {
    const a = computeTruss(fall("P-FW11a")), b = computeTruss(fall("P-FW11b"));
    expect(a.redundants).toEqual([{ kind: "bar", index: 4 }]); expect(b.redundants).toEqual([{ kind: "bar", index: 5 }]);
    a.bars.forEach((x, i) => expect(x.S).toBeCloseTo(b.bars[i]!.S, 8));
  });
  it("Prüfung der Überzähligen", () => {
    const m = trussModel(fall("P-FW11a"));
    expect(proposeRedundants(m)).toEqual([{ kind: "bar", index: 5 }]);
    expect(redundantsError(m, [])).toMatch(/genau 1/);
    expect(redundantsError(m, [{ kind: "support", index: 1 }])).toMatch(/verschieblich/);
    expect(computeTruss({ ...fall("P-FW11a"), redundants: [{ kind: "support", index: 1 }] }).errors[0]).toMatch(/verschieblich/);
  });
  it("Durchlaufträger: Verschiebung am Mittellager 0 (Reduktionssatz)", () => {
    const r = computeTruss(trussPreset("durchlauf", D));
    expect(r.kind).toBe("unbestimmt"); expect(Math.abs(r.displacements![3]!.uy)).toBeLessThan(1e-9);
  });
});

describe("Stabnachweis (FW-SIG, FW-SF, Knicken über den Kern)", () => {
  it("bucklingCheck gleich der Werkbank (Druck, Eulerfall 2, Johnson und Euler)", () => {
    const base: StrengthInput = { mode: "single", kind: "druck", sub: "K2", materialId: "W001", secType: "rund_hohl", dims: { D: 60, t: 4 }, L: 1200, F: 20, q: 0, a: 0, N: 0, T: 0, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null } };
    for (const L of [300, 1200, 4000]) {
      const w = computeStrength(repo, { ...base, L }), sec = sectionProps("rund_hohl", { D: 60, t: 4 });
      const b = bucklingCheck({ E: w.E, Rp: w.strength!.Rp!.v, A: sec.A, i: sec.i, L, eulerCase: 2, N: -20000, lkRef: "Eulerfall gewählt" });
      expect(b.buck).toEqual(w.buck);
      expect([...b.steps, b.check]).toEqual([...w.trace.belastung!.filter((s) => s.id.startsWith("K-")), ...w.trace.nachweis!.filter((s) => s.id === "N-SK")]);
    }
  });
  it("Stabwerte aus Kernprofil und Werkstoffdatenbank (S235JR, Rohr 60 × 4)", () => {
    const p = trussBarProps(repo, "W001", "rund_hohl", { D: 60, t: 4 }), sec = sectionProps("rund_hohl", { D: 60, t: 4 });
    expect(p.errors).toEqual([]); expect([p.A, p.iGyr, p.Rp]).toEqual([sec.A, sec.i, 235]); expect(p.E).toBe(repo.byId("W001")!.E! * 1000);
    expect(trussBarProps(repo, "W999", "rund_hohl", { D: 60, t: 4 }).errors[0]).toMatch(/Unbekannter Werkstoff/);
  });
  it("Gross TM 2 Bsp. 1.6: σ₁ = σ₂ = −150 MPa, S_F = 1 bei σ_zul = 150 MPa", () => {
    const r = computeTruss(fall("P-FW7"));
    expect(r.bars[0]!.check.sigma).toBeCloseTo(-150, 9); expect(r.bars[2]!.check.sigma).toBeCloseTo(100, 9); expect(r.bars[0]!.check.SF).toBeCloseTo(1, 12);
    expect(r.bars[0]!.check.buck).toBeNull(); expect(r.warnings).toContain("Stabnachweis: ohne Trägheitsradius kein Knicknachweis");
  });
  it("maßgebender Stab und Knicken im Rechenweg für die kleinste Knicksicherheit", () => {
    const r = computeTruss(trussPreset("pratt", D));
    const sk = r.bars.filter((b) => b.check.SK !== null).map((b) => b.check.SK!);
    expect(r.trace.nachweis!.find((s) => s.id === "N-SK")!.value).toBe(Math.min(...sk));
    expect(r.util).toBe(Math.max(...r.bars.map((b) => b.check.util ?? 0)));
  });
});

describe("Vorlagen", () => {
  it("alle Vorlagen rechenbar, Feldzahl gerade 2 bis 12", () => {
    for (const id of Object.keys(TRUSS_PRESETS) as TrussPresetId[]) {
      const r = computeTruss(trussPreset(id, D));
      expect(r.errors, id).toEqual([]); expect(r.kind, id).toBe(id === "durchlauf" ? "unbestimmt" : "bestimmt");
    }
    expect(trussPreset("pratt", D, { panels: 3 }).nodes.length).toBe(10);
    expect(trussPreset("warren", D, { panels: 40 }).nodes.length).toBe(25);
  });
  it("symmetrische Last: Warren und Pratt symmetrisch", () => {
    for (const id of ["warren", "pratt", "howe"] as const) {
      const r = computeTruss(trussPreset(id, D)), R = r.reactions;
      expect(R[1]!.R, id).toBeCloseTo(R[2]!.R, 8);
    }
  });
});

describe("Prüfung 25.11.2026 (unabhängige Proben)", () => {
  it("Clapeyron: Arbeit der Lasten = Formänderungsenergie (FW-VK, FW-SUP), bestimmt und unbestimmt", () => {
    for (const f of fwFaelle) {
      const r = computeTruss(f.inp);
      const We = f.inp.loads.reduce((a, l) => a + 0.5 * (l.Fx * 1000 * r.displacements![l.node]!.ux + l.Fy * 1000 * r.displacements![l.node]!.uy), 0);
      const Wi = r.bars.reduce((a, b) => a + 0.5 * b.S * b.S * b.l / (b.E * b.A), 0);
      expect(Math.abs(We - Wi) / Wi, f.id).toBeLessThan(1e-12);
    }
  });
  it("Maxwell: Verschiebungen aus Einheitslasten vertauschbar (Durchlaufträger, n = 1)", () => {
    const base = trussPreset("durchlauf", D);
    const u = (n: number) => computeTruss({ ...base, loads: [{ node: n, Fx: 0, Fy: -1e-3 }] }).displacements!;
    for (const [i, j] of [[1, 5], [2, 10], [4, 12]] as const) expect(u(j)[i]!.uy).toBeCloseTo(u(i)[j]!.uy, 12);
  });
  it("nahezu verschiebliche Geometrie (Gross Abb. 6.2c, Knoten IV 1 mm aus der Geraden): Hinweis", () => {
    const inp = fwFehler.find((f) => f.id === "P-FW20b")!.inp;
    const r = computeTruss({ ...inp, nodes: inp.nodes.map((p, i) => (i === 3 ? { ...p, y: p.y + 1 } : p)) });
    expect(r.kind).toBe("bestimmt");
    expect(r.warnings.some((w) => w.includes("nahezu verschieblich"))).toBe(true);
    expect(Math.max(...r.bars.map((b) => Math.abs(b.S)))).toBeGreaterThan(FW_AMP_WARN * 1000);
    expect(computeTruss(fall("P-FW6")).warnings.some((w) => w.includes("nahezu verschieblich"))).toBe(false);
  });
  it("Gesamtprobe enthält das Moment (FW-PRB)", () => {
    const r = computeTruss(fall("P-FW6"));
    expect(r.probe!.max).toBeLessThan(1e-9 * 20000);
    expect(r.trace.gleichgewicht!.find((s) => s.id === "FW-PRB")!.formula).toContain("|ΣM|/L_max");
  });
});
