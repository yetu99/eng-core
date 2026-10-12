import { describe, expect, it } from "vitest";
import {
  computeStrength, bendingMax, designSize, multiConstraint, loadListFromCase, normalizeLoads, solveBeam, polyRoots, solveLinear,
  BENDING_CASES, LOADLIST_MAX, caseLabel, type StrengthInput, type LoadList, type Load, type BendingCaseId,
} from "../src/index";
import { repo } from "../src/data";

const base: StrengthInput = { mode: "single", kind: "biegung", sub: "LL", materialId: "W038", secType: "rund_hohl", dims: { D: 60, t: 4 }, L: 1200, F: 2, q: 2, a: 300, N: 0, T: 0, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null } };
const run = (loadList: LoadList, over: Partial<StrengthInput> = {}) => computeStrength(repo, { ...base, ...over, loadList });
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);

describe("Lastliste: heutige Fälle als Spezialfälle (identische Werte)", () => {
  for (const c of Object.keys(BENDING_CASES) as BendingCaseId[]) {
    it(c, () => {
      const r0 = computeStrength(repo, { ...base, sub: c });
      const r1 = run(loadListFromCase(c, base.L, base.F, base.q, base.a));
      expect(r1.errors).toEqual([]);
      const b0 = r0.bend!, b1 = r1.bend!;
      expect(rel(b1.M, b0.M)).toBeLessThan(1e-12);
      expect(rel(b1.Q, b0.Q)).toBeLessThan(1e-12);
      expect(rel(b1.w, b0.w)).toBeLessThan(1e-12);
      expect(rel(r1.util, r0.util)).toBeLessThan(1e-12);
      expect(rel(r1.sigmaV, r0.sigmaV)).toBeLessThan(1e-12);
    });
  }
});

describe("Lastliste: Plausibilität", () => {
  const mixed: Load[] = [{ kind: "F", x: 300, F: 2 }, { kind: "q", x1: 500, x2: 1100, q1: 0.5, q2: 2 }, { kind: "M", x: 800, M: -90 }];
  const mirror = (l: Load): Load => (l.kind === "F" ? { ...l, x: 1200 - l.x } : l.kind === "M" ? { ...l, x: 1200 - l.x, M: -l.M } : { kind: "q", x1: 1200 - l.x2, x2: 1200 - l.x1, q1: l.q2, q2: l.q1 });
  for (const sup of ["GG", "EE"] as const) {
    it(`Spiegelung ${sup}: A ↔ B, gleiches |M|max und f`, () => {
      const a = run({ support: sup, loads: mixed, selfWeight: false }).bend!.ll!;
      const b = run({ support: sup, loads: mixed.map(mirror), selfWeight: false }).bend!.ll!;
      expect(rel(a.A, b.B)).toBeLessThan(1e-12);
      expect(rel(Math.abs(a.Mext.value), Math.abs(b.Mext.value))).toBeLessThan(1e-12);
      expect(rel(Math.abs(a.wext.value), Math.abs(b.wext.value))).toBeLessThan(1e-12);
      expect(Math.abs(a.wext.x - (1200 - b.wext.x))).toBeLessThan(1e-6);
    });
  }
  for (const sup of ["KR", "GG", "EG", "EE"] as const) {
    it(`Superposition und Linearität ${sup}`, () => {
      const l1: Load[] = [{ kind: "F", x: 250, F: 1.7 }, { kind: "M", x: 600, M: 80 }];
      const l2: Load[] = [{ kind: "q", x1: 100, x2: 1000, q1: 3, q2: -0.5 }];
      const s1 = run({ support: sup, loads: l1, selfWeight: false }).bend!.ll!;
      const s2 = run({ support: sup, loads: l2, selfWeight: false }).bend!.ll!;
      const s12 = run({ support: sup, loads: [...l1, ...l2], selfWeight: false }).bend!.ll!;
      const s2x = run({ support: sup, loads: l2.map((l) => (l.kind === "q" ? { ...l, q1: 2 * l.q1, q2: 2 * l.q2 } : l)), selfWeight: false }).bend!.ll!;
      for (const x of [0, 137, 250, 600, 777.7, 1200]) {
        expect(Math.abs(s12.M(x) - s1.M(x) - s2.M(x))).toBeLessThan(1e-6 * Math.abs(s12.Mext.value));
        expect(Math.abs(s12.w(x) - s1.w(x) - s2.w(x))).toBeLessThan(1e-9 * Math.abs(s12.wext.value) + 1e-15);
        expect(Math.abs(s2x.w(x) - 2 * s2.w(x))).toBeLessThan(1e-9 * Math.abs(s2x.wext.value) + 1e-15);
      }
      expect(Math.max(Math.abs(s12.resF), Math.abs(s12.resM))).toBeLessThan(1e-12);
    });
  }
  it("Randbedingungen erfüllt", () => {
    const l: Load[] = [{ kind: "F", x: 400, F: 3 }, { kind: "q", x1: 0, x2: 700, q1: 1, q2: 1 }];
    const kr = run({ support: "KR", loads: l, selfWeight: false }).bend!.ll!;
    expect(Math.abs(kr.w(0))).toBeLessThan(1e-15); expect(Math.abs(kr.phi(0))).toBeLessThan(1e-15); expect(Math.abs(kr.M(1200))).toBeLessThan(1e-6);
    const eg = run({ support: "EG", loads: l, selfWeight: false }).bend!.ll!;
    expect(Math.abs(eg.w(1200))).toBeLessThan(1e-12); expect(Math.abs(eg.phi(0))).toBeLessThan(1e-15);
    const ee = run({ support: "EE", loads: l, selfWeight: false }).bend!.ll!;
    expect(Math.abs(ee.w(1200))).toBeLessThan(1e-12); expect(Math.abs(ee.phi(1200))).toBeLessThan(1e-15);
  });
  it("Kraft auf dem Lager erzeugt kein Moment und keine Durchbiegung", () => {
    const s = run({ support: "GG", loads: [{ kind: "F", x: 0, F: 5 }, { kind: "F", x: 1200, F: 3 }], selfWeight: false });
    const ll = s.bend!.ll!;
    expect(ll.A).toBeCloseTo(5000, 9); expect(ll.B).toBeCloseTo(3000, 9);
    expect(Math.abs(ll.Mext.value)).toBeLessThan(1e-9); expect(Math.abs(ll.wext.value)).toBeLessThan(1e-15);
    expect(s.warnings).toContain("Lastliste ohne Querlast");
  });
  it("abhebendes Lager wird gewarnt", () => {
    const s = run({ support: "GG", loads: [{ kind: "M", x: 300, M: 200 }], selfWeight: false });
    expect(s.warnings.some((w) => w.startsWith("Lager A zieht"))).toBe(true);
  });
  it("Moment am freien Ende: Sprung und Vorzeichen", () => {
    const ll = run({ support: "KR", loads: [{ kind: "M", x: 1200, M: 200 }], selfWeight: false }).bend!.ll!;
    expect(ll.M(600)).toBeCloseTo(-200000, 6); expect(ll.MA).toBeCloseTo(-200000, 6); expect(ll.wext.x).toBe(1200);
  });
});

describe("Lastliste: Vorzeichen (Freigabe 12.10.2026, Hinweise zu B-LL-CA, B-LL-CB, B-LL-M, B-LL-QX, B-LL-W)", () => {
  it("beidseitig eingespannt: M_A und M_B haben das Vorzeichen der Momentenlinie (beide negativ wie Roark 1d)", () => {
    const ll = run({ support: "EE", loads: [{ kind: "F", x: 400, F: 3 }], selfWeight: false }).bend!.ll!;
    expect(ll.MA).toBeCloseTo(-3000 * 400 * 800 ** 2 / 1200 ** 2, 6);
    expect(ll.MB).toBeCloseTo(-3000 * 400 ** 2 * 800 / 1200 ** 2, 6);
    expect(ll.MA).toBeCloseTo(ll.M(1e-9), 3); expect(ll.MB).toBeCloseTo(ll.M(1200 - 1e-9), 3);
    expect(ll.M(400)).toBeGreaterThan(0);
  });
  it("Lasten nach oben kehren alle Vorzeichen um (M, Q, w, A, B, M_A, M_B)", () => {
    for (const sup of ["KR", "GG", "EG", "EE"] as const) {
      const lo: Load[] = [{ kind: "F", x: 350, F: 2 }, { kind: "q", x1: 100, x2: 900, q1: 1, q2: 3 }, { kind: "M", x: 700, M: 80 }];
      const up = lo.map((l): Load => (l.kind === "F" ? { ...l, F: -l.F } : l.kind === "M" ? { ...l, M: -l.M } : { ...l, q1: -l.q1, q2: -l.q2 }));
      const a = run({ support: sup, loads: lo, selfWeight: false }).bend!.ll!, b = run({ support: sup, loads: up, selfWeight: false }).bend!.ll!;
      for (const [x, y] of [[a.A, b.A], [a.B, b.B], [a.MA, b.MA], [a.MB, b.MB], [a.M(500), b.M(500)], [a.Q(500), b.Q(500)], [a.w(500), b.w(500)]] as const) expect(x).toBeCloseTo(-y, 6);
    }
  });
  it("w nach unten positiv, E·I·w″ = −M: Last nach unten ergibt w > 0 und M > 0 in Feldmitte", () => {
    const ll = run({ support: "GG", loads: [{ kind: "F", x: 600, F: 1 }], selfWeight: false }).bend!.ll!;
    expect(ll.w(600)).toBeGreaterThan(0); expect(ll.M(600)).toBeGreaterThan(0);
    const h = 1e-2, curv = (ll.w(300 + h) - 2 * ll.w(300) + ll.w(300 - h)) / (h * h);
    expect(curv * ll.EI / -ll.M(300)).toBeCloseTo(1, 4);
  });
  it("Q = dM/dx, Q am positiven Schnittufer nach unten positiv: Q(0⁺) = A", () => {
    const ll = run({ support: "GG", loads: [{ kind: "q", x1: 0, x2: 1200, q1: 2, q2: 2 }], selfWeight: false }).bend!.ll!;
    expect(ll.Q(0)).toBeCloseTo(ll.A, 9);
    const h = 1e-3; expect((ll.M(300 + h) - ll.M(300 - h)) / (2 * h)).toBeCloseTo(ll.Q(300), 4);
  });
  it("Streckenlast wird nach x₂ abgeschaltet: rechts von x₂ ist M = Resultierende · Hebelarm, Q = −R (Trapez, Dreieck, Vorzeichenwechsel)", () => {
    for (const [q1, q2] of [[1, 1], [0, 2], [3, 0.5], [-1, 1], [2, -2]] as const) {
      const ll = run({ support: "KR", loads: [{ kind: "q", x1: 200, x2: 700, q1, q2 }], selfWeight: false }).bend!.ll!;
      const R = (q1 + q2) / 2 * 500;
      // Krag: rechts von x₂ liegt keine Last mehr, also müssen M und Q dort exakt verschwinden
      expect(Math.abs(ll.M(900))).toBeLessThan(1e-6 * Math.max(1, Math.abs(R) * 500));
      expect(Math.abs(ll.Q(900))).toBeLessThan(1e-9 * Math.max(1, Math.abs(R)));
      // Lagerkraft = Resultierende, Einspannmoment = −(Moment der Last um x = 0)
      expect(ll.A).toBeCloseTo(R, 9);
      expect(ll.MA - (-(ll.sumM0))).toBeCloseTo(0, 6);
    }
  });
  it("Querkraft-Extremwert liegt am Angriffspunkt einer Einzellast (beidseitig geprüft)", () => {
    const ll = run({ support: "GG", loads: [{ kind: "F", x: 200, F: 5 }, { kind: "F", x: 1000, F: 1 }], selfWeight: false }).bend!.ll!;
    // Q links von 200: A = 5·1000/1200 + 1·200/1200; rechts von 200: A − 5
    expect(ll.Qext.value).toBeCloseTo(ll.A, 9); expect([0, 200]).toContain(ll.Qext.x);
    const ll2 = run({ support: "GG", loads: [{ kind: "F", x: 1000, F: 5 }], selfWeight: false }).bend!.ll!;
    expect(Math.abs(ll2.Qext.value)).toBeCloseTo(5000 * 1000 / 1200, 9); expect([1000, 1200]).toContain(ll2.Qext.x);
  });
});

describe("Lastliste: Eingabeprüfung", () => {
  it("Position außerhalb, x₁ ≥ x₂, zu viele Lasten", () => {
    const n = normalizeLoads([{ kind: "F", x: 1300, F: 1 }, { kind: "q", x1: 500, x2: 500, q1: 1, q2: 1 }, { kind: "M", x: -1, M: 1 }], 1200);
    expect(n.errors.map((e) => e.index)).toEqual([0, 1, 2]);
    const many = Array.from({ length: LOADLIST_MAX + 1 }, (_, i): Load => ({ kind: "F", x: i, F: 1 }));
    expect(normalizeLoads(many, 1200).errors.length).toBe(1);
    const r = run({ support: "GG", loads: [{ kind: "F", x: 1300, F: 1 }], selfWeight: false });
    expect(r.errors).toEqual(["Last 1: Position x = 1300 mm liegt außerhalb 0 … 1200 mm"]);
    expect(r.loadErrors[0]?.index).toBe(0);
  });
  it("leere Liste", () => {
    const r = run({ support: "EE", loads: [], selfWeight: false });
    expect(r.errors).toEqual([]); expect(r.util).toBe(0);
  });
  it("Bezeichnung", () => expect(caseLabel("single", "biegung", "LL")).toBe("Lastliste"));
});

describe("Lastliste: Kopplung", () => {
  it("Überlagert: Eulerfall aus der Lagerung", () => {
    for (const [sup, ec] of [["KR", 1], ["GG", 2], ["EG", 3], ["EE", 4]] as const) {
      const r = computeStrength(repo, { ...base, mode: "combined", N: -10, T: 50, loadList: { support: sup, loads: [{ kind: "F", x: 600, F: 1 }], selfWeight: false } });
      expect(r.buck?.eulerCase).toBe(ec);
    }
  });
  it("Bemessen mit Lastliste", () => {
    const d = designSize(repo, { ...base, loadList: { support: "GG", loads: [{ kind: "F", x: 300, F: 2 }, { kind: "q", x1: 600, x2: 1200, q1: 4, q2: 4 }], selfWeight: true } }, "formtreu");
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.result.util).toBeLessThanOrEqual(1);
  });
  it("Schritt 6 nutzt die Lastliste", () => {
    const m = repo.byId("W038")!;
    const mc = multiConstraint(repo, [m], { secType: "rund_hohl", dims: { D: 60, t: 4 }, caseId: "LL", L: 1200, F: 2, q: 2, a: 300, fDiv: 300, SFreq: 1.5, SBreq: 2, loadList: loadListFromCase("EQ", 1200, 2, 2, 300) }, 5);
    const mc0 = multiConstraint(repo, [m], { secType: "rund_hohl", dims: { D: 60, t: 4 }, caseId: "EQ", L: 1200, F: 2, q: 2, a: 300, fDiv: 300, SFreq: 1.5, SBreq: 2 }, 5);
    expect(mc.caseId).toBe("LL"); expect(mc.caseSubstituted).toBe(false);
    expect(rel(mc.rows[0]!.mass!, mc0.rows[0]!.mass!)).toBeLessThan(1e-12);
  });
});

describe("Numerik", () => {
  it("Nullstellen vollständig und deterministisch", () => {
    // (u − 1)(u − 2)(u − 3)(u − 4)(u − 4,5) auf (0, 5)
    const roots = [1, 2, 3, 4, 4.5];
    let p = [1];
    for (const r of roots) p = [...p.map((c) => -r * c), 0].map((c, i) => c + (i > 0 ? p[i - 1]! : 0));
    const got = polyRoots(p, 5);
    expect(got.length).toBe(5);
    got.forEach((g, i) => expect(Math.abs(g - roots[i]!)).toBeLessThan(1e-12));
    expect(polyRoots(p, 5)).toEqual(got);
  });
  it("lineares System mit Pivot", () => {
    const x = solveLinear([[0, 2, 1, 0], [1, 1, 0, 0], [0, 0, 3, 1], [2, 0, 0, 1]], [5, 3, 10, 7]);
    const A = [[0, 2, 1, 0], [1, 1, 0, 0], [0, 0, 3, 1], [2, 0, 0, 1]], b = [5, 3, 10, 7];
    A.forEach((r, i) => expect(r.reduce((s, c, k) => s + c * x[k]!, 0)).toBeCloseTo(b[i]!, 12));
  });
  it("solveBeam mit E·I = 1 skaliert linear", () => {
    const loads = normalizeLoads([{ kind: "F", x: 500, F: 2 }], 1200).loads;
    const a = solveBeam("EG", loads, 1200, 1), b = solveBeam("EG", loads, 1200, 2e10);
    expect(rel(a.wext.value, b.wext.value * 2e10)).toBeLessThan(1e-12);
    expect(rel(a.Mext.value, b.Mext.value)).toBeLessThan(1e-14);
  });
  it("bendingMax unverändert (Referenz)", () => expect(bendingMax("EQ", 1200, 0, 2, 0, 1).M).toBe(360000));
});
