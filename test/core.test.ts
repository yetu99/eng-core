import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeStrength, sectionProps, designSize, designValue, buildIndex, ranking, multiConstraint, paretoFront, sym, fmt, type StrengthInput, type SecType, type AshbyState, type MatClass } from "../src/index";
import { repo } from "../src/data";

const golden = JSON.parse(readFileSync(new URL("./golden.json", import.meta.url), "utf8")) as Array<{ id: string; case: { type: string; sec?: SecType; dims?: Record<string, number>; inp?: StrengthInput }; expect: Record<string, number>; tol: number }>;

const base: StrengthInput = { mode: "single", kind: "biegung", sub: "EQ", materialId: "W038", secType: "rund_hohl", dims: { D: 60, t: 4 }, L: 1200, F: 2, q: 2, a: 300, N: 0, T: 0, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null } };

describe("Gegenrechnung (golden.json aus verification/pruefung.py)", () => {
  for (const g of golden) {
    it(g.id, () => {
      let got: Record<string, number | null>;
      if (g.case.type === "section") { const s = sectionProps(g.case.sec as SecType, g.case.dims ?? {}); got = s as unknown as Record<string, number>; }
      else {
        const r = computeStrength(repo, g.case.inp as StrengthInput);
        got = { M: r.bend?.M ?? null, w: r.bend?.w ?? null, dL: r.axial?.dL ?? null, sk: r.buck?.sigmaK ?? null, lamT: r.buck?.lambdaT ?? null, theta: r.tors?.theta ?? null, tau: r.tauT };
      }
      for (const [k, v] of Object.entries(g.expect)) {
        const x = got[k];
        expect(x, `${g.id} ${k}`).not.toBeNull();
        expect(Math.abs((x as number) - v) / Math.abs(v || 1), `${g.id} ${k}`).toBeLessThanOrEqual(g.tol);
      }
    });
  }
});

describe("Grenzfälle und Plausibilität", () => {
  it("Hohlrohr mit t → D/2 ergibt den Vollkreis", () => {
    const h = sectionProps("rund_hohl", { D: 40, t: 19.9999 }), v = sectionProps("rund_voll", { D: 40 });
    expect(h.I / v.I).toBeCloseTo(1, 6);
  });
  it("dünnwandiges Rohr: φ_B^e ≈ r/t", () => {
    const s = sectionProps("rund_hohl", { D: 200, t: 1 });
    expect(s.phiBe / (99.5 / 1)).toBeCloseTo(1, 2);
  });
  it("Vollkreis: alle Formfaktoren = 1", () => {
    const s = sectionProps("rund_voll", { D: 17 });
    for (const p of [s.phiBe, s.phiBf, s.phiTe, s.phiTf]) expect(p).toBeCloseTo(1, 12);
  });
  it("ungültige Geometrie wird abgefangen", () => {
    expect(sectionProps("rund_hohl", { D: 20, t: 10 }).errors.length).toBe(1);
    expect(computeStrength(repo, { ...base, dims: { D: 20, t: 12 } }).errors.length).toBeGreaterThan(0);
  });
  it("mehr Last ergibt mehr Ausnutzung (monoton)", () => {
    const u = [1, 2, 4, 8].map((q) => computeStrength(repo, { ...base, q }).util);
    for (let i = 1; i < u.length; i++) expect(u[i] as number).toBeGreaterThan(u[i - 1] as number);
  });
  it("Johnson und Euler sind am Übergang stetig", () => {
    const r = computeStrength(repo, { ...base, kind: "druck", sub: "K2", F: 20 });
    const b = r.buck!; const Rp = b.Rp!, lT = b.lambdaT!;
    expect(Rp - (Rp * Rp / (4 * Math.PI ** 2 * b.E)) * lT * lT).toBeCloseTo(Math.PI ** 2 * b.E / (lT * lT), 9);
  });
  it("Rechenergebnis ist deterministisch", () => {
    expect(JSON.stringify(computeStrength(repo, base).kpis)).toBe(JSON.stringify(computeStrength(repo, base).kpis));
  });
});

describe("Auslegungswerte", () => {
  const mat = (id: string) => repo.byId(id)!;
  it("Bereich: unterer Wert (S235JR R_m 360 … 510)", () => { expect(designValue(repo, mat("W001"), "P-RM")?.v).toBe(360); });
  it("Mindestwert: ≥ 235", () => { expect(designValue(repo, mat("W001"), "P-RE")?.v).toBe(235); });
  it("nur Höchstwert (DC01 R_p ≤ 280): kein Auslegungswert, Nachweis unvollständig", () => {
    expect(designValue(repo, mat("W004"), "P-RE")?.v).toBeNull();
    const r = computeStrength(repo, { ...base, materialId: "W004" });
    expect(r.incomplete).toContain("Fließen");
  });
  it("Mitte und manuell werden als Abweichung markiert", () => {
    expect(designValue(repo, mat("W001"), "P-RM", "mid")?.warn).toBe("nicht konservativ");
    expect(designValue(repo, mat("W001"), "P-RM", "manual", 400)?.v).toBe(400);
  });
});

describe("Bemessen", () => {
  it("formtreu: gewählte Maße erfüllen alle Nachweise, Raster eingehalten", () => {
    const d = designSize(repo, { ...base, q: 4 }, "formtreu");
    expect(d.ok).toBe(true);
    if (d.ok) { expect(d.result.util).toBeLessThanOrEqual(1); expect((d.dims["t"] ?? 0) % 0.5).toBe(0); expect((d.dims["D"] ?? 0) % 1).toBe(0); }
  });
  it("Einzelmaß ohne Lösung liefert eine Meldung", () => {
    const d = designSize(repo, { ...base, q: 40, dims: { D: 30, t: 2 } }, "t");
    expect(d.ok).toBe(false);
  });
});

describe("Ashby", () => {
  const classes: Record<MatClass, boolean> = { Metall: true, Polymer: true, Keramik: true, Verbundwerkstoff: true, Naturwerkstoff: true };
  const st = (shapeMode: AshbyState["shapeMode"]): AshbyState => ({ index: buildIndex("Balken", "Steifigkeit", "Masse")!, classes, limits: { Emin: 20, rhoMax: null, sfMin: null, priceMax: null }, shapeMode, phiUser: null });
  it("Index Balken steif leicht = E^½/ρ, Steigung 2", () => { const ix = buildIndex("Balken", "Steifigkeit", "Masse")!; expect(ix.M).toBe("E^½ / ρ"); expect(ix.slope).toBe(2); });
  it("CO₂ ist deaktiviert", () => { expect(buildIndex("Balken", "Steifigkeit", "CO₂")).toBeNull(); });
  it("Rangliste ohne Form: CFK UD vorne", () => { expect(ranking(repo, st("none"), false)[0]?.m.name).toBe("CFK UD (HT/EP)"); });
  it("gleiches φ für alle ändert die Rangfolge nicht", () => {
    const a = ranking(repo, st("none"), false).map((p) => p.m.id);
    const b = ranking(repo, { ...st("modul1"), phiUser: { Be: 7, Bf: 3.5, Te: 7, Tf: 3.5 } }, true).map((p) => p.m.id);
    expect(b).toEqual(a);
  });
  it("Zielkonflikt: Pareto-Front sortiert, Z minimal plausibel", () => {
    const cands = ranking(repo, st("none"), false).map((p) => p.m);
    const mc = multiConstraint(repo, cands, { secType: "rund_hohl", dims: { D: 60, t: 4 }, caseId: "EQ", L: 1200, F: 2, q: 2, a: 300, fDiv: 300, SFreq: 1.5, SBreq: 2 }, 5);
    const front = paretoFront(mc.rows);
    for (let i = 1; i < front.length; i++) { expect(front[i]!.mass!).toBeGreaterThan(front[i - 1]!.mass!); expect(front[i]!.cost!).toBeLessThan(front[i - 1]!.cost!); }
  });
});

describe("Formatierung", () => {
  it("deutsche Zahlen", () => { expect(fmt(2773.4)).toBe("2773"); expect(fmt(277264)).toBe("2,773·10⁵"); expect(fmt(0.35224)).toBe("0,3522"); });
  it("Indizes", () => { expect(sym("φ_B^e")).toBe("φ<sub>B</sub><sup>e</sup>"); });
});
