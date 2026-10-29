/**
 * Rohrhydraulik (Modul fluid, 0.11.0): Fehlerfälle (P13), Monotonie, Energiebilanz, Fachdaten, Katalog, Einheiten.
 * Literatur- und Gegenrechnungswerte stehen in golden.json (verification/fluid.py).
 */
import { describe, expect, it } from "vitest";
import { bendZeta, colebrook, computeLine, fdRepo, frictionFactor, formulaState, moduleOfId, reportMeta, TOOLS, units, waterState, FD_VERSION, PRUEFSTATUS, type LineInput } from "../src/index";
import { fluidFaelle } from "../scripts/fluid-faelle";
import sources from "../data/sources.json";
import { DATA_VERSION } from "../src/dataVersion";

const P0 = 101325;
const base = (over: Partial<LineInput> = {}): LineInput => ({
  fluid: { spec: { kind: "wasser" }, T: units.cToK(20), p: P0 }, Q: units.m3hToM3s(5), g: 9.81, eta: null, velocityGuideId: null,
  start: { p: P0, z: 0, v0: true }, end: { p: P0, v0: true },
  elements: [{ kind: "rohr", L: 50, geom: { kind: "d", d: 0.04 }, rough: { kind: "hand", k: 2e-5 }, dz: 0 }],
  ...over,
});
const allSteps = (r: ReturnType<typeof computeLine>) => Object.values(r.trace).flatMap((a) => a ?? []);

describe("Wasser (IAPWS)", () => {
  it("Gültigkeit: Fehler außerhalb Region 1 und unter dem Sättigungsdruck", () => {
    expect(waterState(units.cToK(400), 1e6).errors.length).toBeGreaterThan(0);
    expect(waterState(units.cToK(120), P0).errors[0]).toMatch(/verdampft/);
    expect(waterState(units.cToK(120), 3e5).errors).toEqual([]);
    expect(waterState(units.cToK(120), 3e5).warnings.length).toBe(1);
  });
  it("ν nimmt mit der Temperatur ab, ρ hat das Maximum bei etwa 4 °C", () => {
    const nu = [0, 20, 40, 60, 80].map((c) => waterState(units.cToK(c), P0).nu);
    for (let i = 1; i < nu.length; i++) expect(nu[i]!).toBeLessThan(nu[i - 1]!);
    const r = (c: number) => waterState(units.cToK(c), P0).rho;
    expect(r(4)).toBeGreaterThan(r(0));
    expect(r(4)).toBeGreaterThan(r(8));
  });
});

describe("Rohrreibungszahl", () => {
  it("laminar exakt 64/Re, Übergang mit Warnung, Grenzen", () => {
    expect(frictionFactor(1000, 0.001).lambda).toBe(0.064);
    const t = frictionFactor(3000, 0);
    expect(t.regime).toBe("Übergang");
    expect(t.warnings.length).toBe(1);
    expect(frictionFactor(2e8, 0).errors.length).toBe(1);
    expect(frictionFactor(1e5, 0.06).errors.length).toBe(1);
  });
  it("Newton konvergiert in höchstens 6 Schritten auf Restfehler < 1e-12", () => {
    for (const Re of [4e3, 1e5, 1e8]) for (const eps of [0, 1e-4, 0.05]) {
      const c = colebrook(Re, eps);
      expect(c.iterations).toBeLessThanOrEqual(6);
      expect(Math.abs(c.residual)).toBeLessThan(1e-12);
    }
  });
});

describe("Strang", () => {
  it("Fehlerfälle: leerer Strang, d ≤ 0, variabler Durchmesser außerhalb C, ISO VG ohne Dichte, Re über 10⁸", () => {
    expect(computeLine(fdRepo, base({ elements: [] })).errors.length).toBeGreaterThan(0);
    expect(computeLine(fdRepo, base({ elements: [{ kind: "rohr", L: 1, geom: { kind: "d", d: 0 }, rough: { kind: "hand", k: 0 }, dz: 0 }] })).errors.length).toBeGreaterThan(0);
    expect(computeLine(fdRepo, base({ elements: [{ kind: "rohr", L: 1, geom: { kind: "var" }, rough: { kind: "hand", k: 0 }, dz: 0 }] })).errors.length).toBeGreaterThan(0);
    const vg = fdRepo.fluidValues.find((v) => v.rho_kg_m3 === null)!;
    expect(computeLine(fdRepo, base({ fluid: { spec: { kind: "tabelle", valueId: vg.id }, T: 313.15, p: P0 } })).errors[0]).toMatch(/Dichte/);
    expect(computeLine(fdRepo, base({ Q: 1e3 })).errors.some((e) => e.includes("10⁸"))).toBe(true);
  });
  it("Drucklinie endet genau bei p_E, Energiebilanz H_A − H_E = h_v", () => {
    for (const f of fluidFaelle()) {
      const r = computeLine(fdRepo, f.inp, f.task);
      expect(r.errors, f.id).toEqual([]);
      const last = r.nodes[r.nodes.length - 1]!;
      expect(Math.abs(last.p - f.inp.end.p) / f.inp.end.p, f.id).toBeLessThan(1e-12);
      expect(Math.abs(r.nodes[0]!.H - last.H - r.dpV / (r.fluid.rho * f.inp.g)), f.id).toBeLessThan(1e-9);
    }
  });
  it("Monotonie: Δp steigt mit V̇, fällt mit d", () => {
    const dp = (Q: number, d: number) => computeLine(fdRepo, base({ Q, elements: [{ kind: "rohr", L: 50, geom: { kind: "d", d }, rough: { kind: "hand", k: 2e-5 }, dz: 0 }] })).dpErf;
    expect(dp(2e-3, 0.04)).toBeGreaterThan(dp(1e-3, 0.04));
    expect(dp(2e-3, 0.05)).toBeLessThan(dp(2e-3, 0.04));
  });
  it("Aufgabe B ohne Durchfluss, Aufgabe C ohne passendes Rohr", () => {
    expect(computeLine(fdRepo, base({ elements: [{ kind: "rohr", L: 10, geom: { kind: "d", d: 0.04 }, rough: { kind: "hand", k: 0 }, dz: 20 }] }), { kind: "B", dpAvail: 1e5 }).errors[0]).toMatch(/kein Durchfluss/);
    const c = computeLine(fdRepo, base({ Q: 3, elements: [{ kind: "rohr", L: 100, geom: { kind: "var" }, rough: { kind: "hand", k: 0 }, dz: 0 }] }), { kind: "C", dpAllow: 5e4, select: { norm: "DIN 8074", series: "SDR 11", minWall: null } });
    expect(c.errors.some((e) => e.includes("kein Rohr"))).toBe(true);
  });
  it("Kavitation: Saugleitung mit großer Höhe wird gemeldet", () => {
    const r = computeLine(fdRepo, base({ start: { p: P0, z: 0, v0: true }, elements: [{ kind: "rohr", L: 20, geom: { kind: "d", d: 0.04 }, rough: { kind: "hand", k: 2e-5 }, dz: 12 }] }), { kind: "A" });
    // Druck am Anfang ist erforderlicher Pumpendruck; Kavitation tritt erst im Knoten nach oben auf, wenn p_A vorgegeben ist
    expect(r.checks.find((c) => c.key === "kavitation")!.ok).toBe(true);
    const s = computeLine(fdRepo, base({ end: { p: 2000, v0: true }, elements: [{ kind: "rohr", L: 5, geom: { kind: "d", d: 0.04 }, rough: { kind: "hand", k: 2e-5 }, dz: 0 }] }), { kind: "A" });
    expect(s.checks.find((c) => c.key === "kavitation")!.ok).toBe(false);
  });
});

describe("Fachdaten fd 1.0", () => {
  it("Stand und Zeilenzahlen", () => {
    expect(FD_VERSION).toBe("fd 1.0");
    expect([fdRepo.fluids.length, fdRepo.fluidValues.length, fdRepo.roughness.length, fdRepo.lossCoeff.length, fdRepo.pipeSizes.length, fdRepo.velocityGuide.length]).toEqual([21, 32, 20, 87, 68, 20]);
  });
  it("jede Fachdaten-Quelle steht in den Werkstoffdaten (wa_sources); bis zum Abzug WDB 1.1.1 fehlen genau Teile von Q221 bis Q226", () => {
    const known = new Set((sources as { id: string }[]).map((x) => x.id));
    const used = new Set([...fdRepo.fluids, ...fdRepo.fluidValues, ...fdRepo.roughness, ...fdRepo.lossCoeff, ...fdRepo.pipeSizes, ...fdRepo.velocityGuide].map((r) => r.source_id));
    const missing = [...used].filter((id) => !known.has(id)).sort();
    if (DATA_VERSION === "WDB 1.1") for (const id of missing) expect(["Q221", "Q222", "Q223", "Q224", "Q225", "Q226"], id).toContain(id);
    else expect(missing).toEqual([]);
  });
  it("Bogen: Interpolation trifft die Tabellenzeilen, außerhalb 1 bis 10 kein Wert", () => {
    expect(bendZeta(fdRepo, "glatt", 2)!.zeta).toBeCloseTo(0.14, 12);
    expect(bendZeta(fdRepo, "rauh", 10)!.zeta).toBeCloseTo(0.2, 12);
    expect(bendZeta(fdRepo, "glatt", 0.5)).toBeNull();
  });
});

describe("Katalog und Prüfstatus Fachtools", () => {
  it("jeder Rechenschritt der Beispielfälle hat eine Katalog-ID im Modul fluid", () => {
    const ids = new Set(fluidFaelle().flatMap((f) => allSteps(computeLine(fdRepo, f.inp, f.task)).map((s) => s.id)));
    for (const id of ids) {
      expect(moduleOfId(id), id).toBe("fluid");
      expect(formulaState(id), id).not.toBe("unbekannt");
    }
    expect(ids.size).toBe(PRUEFSTATUS.modules.fluid.formulas);
  });
  it("reportMeta Fachtools zählt gemeinsam und fluid, Werkbank bleibt unverändert", () => {
    const f = reportMeta("Ingenieur-Fachtools");
    expect(f.formulas).toBe(TOOLS.fachtools.modules.reduce((a, m) => a + PRUEFSTATUS.modules[m].formulas, 0));
    expect(f.fd).toBe("fd 1.0");
    expect(reportMeta().formulas).toBe(PRUEFSTATUS.modules.gemeinsam.formulas + PRUEFSTATUS.modules.festigkeit.formulas + PRUEFSTATUS.modules.ashby.formulas);
  });
});

describe("Anzeigeeinheiten", () => {
  it("Umrechnungen sind umkehrbar", () => {
    expect(units.m3sToM3h(units.m3hToM3s(12.5))).toBeCloseTo(12.5, 12);
    expect(units.m3sToLmin(units.lminToM3s(30))).toBeCloseTo(30, 12);
    expect(units.paAbsToBarGauge(units.barGaugeToPaAbs(3))).toBeCloseTo(3, 12);
    expect(units.kToC(units.cToK(20))).toBeCloseTo(20, 12);
  });
});
