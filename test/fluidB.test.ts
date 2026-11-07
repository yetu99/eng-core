/**
 * Rohrhydraulik Teil b (Modul fluid, 0.13.0): Fehlerfälle (P37), Gleichwertigkeit t_S > t_R ⇔ l < a·t_S/2 (P28), Energiebilanz
 * mit Pumpe, Kavitation nur druckseitig, Walther, Querschnitte, Messung, Druckstoß, Beispielfälle für die Gegenrechnung aktuell.
 * Literatur- und Gegenrechnungswerte stehen in golden.json (verification/fluid.py, add_cases_b).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeLine, computeMeter, computeSurge, fdRepo, fitQuadratic, gridBisect, orificeC, rpm, sectionGeometry, units, walther, wallPsi, waterSound, type LineInput, type PumpInput } from "../src/index";
import { anlageAnalytisch, fluidFaelleB, PUMPE_ANALYTISCH, PUMPE_B } from "../scripts/fluid-faelle";
import { fluidBJson } from "../scripts/fluid-b-json";

const P0 = 101325;
const pump = (over: Partial<PumpInput> = {}): PumpInput => ({ points: PUMPE_ANALYTISCH, n0: rpm.toHz(1450), speed: { kind: "n", n: rpm.toHz(1450) }, npshMargin: 2, npshExp: 2, pv: null, ...over });
const steps = (t: Record<string, { id: string }[] | undefined>) => Object.values(t).flatMap((a) => a ?? []);

describe("Beispielfälle RH b", () => {
  it("verification/fluid_b_faelle.json ist aktuell (npx tsx scripts/fluid-b-json.ts)", () => {
    expect(readFileSync(new URL("../verification/fluid_b_faelle.json", import.meta.url), "utf8")).toBe(fluidBJson());
  });
  it("alle Fälle rechnen ohne Fehler", () => {
    for (const f of fluidFaelleB()) expect(computeLine(fdRepo, f.inp, f.task).errors, f.id).toEqual([]);
  });
});

describe("Pumpe und Betriebspunkt", () => {
  it("Energiebilanz mit Pumpe: Ende = Enddruck, Sprung der Energiehöhe an der Pumpe = H_A", () => {
    const r = computeLine(fdRepo, anlageAnalytisch(), { kind: "D", pump: pump() });
    expect(r.errors).toEqual([]);
    expect(r.nodes[0]!.p).toBe(P0);
    expect(Math.abs(r.nodes.at(-1)!.p - P0)).toBeLessThan(1e-8);
    const dH = r.nodes[1]!.H - r.nodes[0]!.H;
    expect(dH).toBeCloseTo(r.dpErf / (1000 * 9.81), 10);
    expect(steps(r.trace).some((s) => s.id === "PU-BE")).toBe(true);
  });
  it("Fehlerfälle: weniger als drei Punkte, Pumpe außerhalb D, zwei Pumpen, kein Schnittpunkt", () => {
    const inp = anlageAnalytisch();
    expect(computeLine(fdRepo, inp, { kind: "D", pump: pump({ points: PUMPE_ANALYTISCH.slice(0, 2) }) }).errors[0]).toMatch(/drei/);
    expect(computeLine(fdRepo, { ...inp, Q: 0.01 }, { kind: "A" }).errors.some((e) => e.includes("nur in Aufgabe D"))).toBe(true);
    expect(computeLine(fdRepo, { ...inp, elements: [{ kind: "pumpe" }, ...inp.elements] }, { kind: "D", pump: pump() }).errors.some((e) => e.includes("genau ein"))).toBe(true);
    const klein = computeLine(fdRepo, inp, { kind: "D", pump: pump({ speed: { kind: "n", n: rpm.toHz(800) } }) });
    expect(klein.errors[0]).toMatch(/erreicht die Förderhöhe/);
    expect(computeLine(fdRepo, inp, { kind: "D", pump: pump({ points: PUMPE_ANALYTISCH.map((p) => ({ ...p, H: -1 })) }) }).errors[0]).toMatch(/Förderhöhe > 0/);
  });
  it("Modellgesetze: über 20 % Warnung, Soll-Förderstrom trifft V̇_soll", () => {
    const r = computeLine(fdRepo, anlageAnalytisch(), { kind: "D", pump: pump({ speed: { kind: "Qsoll", Q: units.m3hToM3s(60) } }) });
    expect(r.Q).toBeCloseTo(units.m3hToM3s(60), 12);
    expect(r.checks.find((c) => c.key === "drehzahl")!.ok).toBe(false);
  });
  it("mit Pumpe gilt der Kavitationshinweis nur druckseitig; NPSH braucht bei Fremdfluiden p_v von Hand", () => {
    const f = fluidFaelleB().find((x) => x.id === "RH-K8")!;
    const r = computeLine(fdRepo, f.inp, f.task);
    expect(r.checks.find((c) => c.key === "kavitation")!.label).toContain("Druckseite");
    expect(r.checks.find((c) => c.key === "npsh")!.ok).toBe(true);
    const hand: LineInput = { ...anlageAnalytisch() };
    const n0 = computeLine(fdRepo, hand, { kind: "D", pump: pump() });
    expect(n0.pump!.npshA).toBeNull();
    expect(computeLine(fdRepo, hand, { kind: "D", pump: pump({ pv: 2339.2 }) }).pump!.npshA).toBeCloseTo((P0 - 2339.2) / 9810, 9);
  });
  it("PU-N-BER: fallende Parabel mit Steigung 0 im Nullpunkt ist stabil (Toleranz ε), steigender Ast wird gemeldet", () => {
    const r = computeLine(fdRepo, anlageAnalytisch(), { kind: "D", pump: pump() });
    expect(r.checks.find((c) => c.key === "kennlinie")!.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("nicht überall fallend"))).toBe(false);
    const steps0 = steps(r.trace).find((s) => s.id === "PU-N-BER") as unknown as { subst: string };
    expect(steps0.subst).toContain("in 0 bis");
    const sattel = PUMPE_ANALYTISCH.map((p, i) => ({ ...p, H: [36, 40, 24][i]! }));
    const u = computeLine(fdRepo, anlageAnalytisch(), { kind: "D", pump: pump({ points: sattel }) });
    expect(u.checks.find((c) => c.key === "kennlinie")!.ok).toBe(false);
  });
  it("Ausgleichspolynom: drei Punkte exakt, R² = 1; Raster-Bisektion findet die Nullstelle", () => {
    const f = fitQuadratic([0, 1, 2], [1, 2, 5]);
    expect(f.c.map((x) => +x.toFixed(12))).toEqual([1, 0, 1]);
    expect(f.r2).toBe(1);
    expect(gridBisect((x) => x * x - 2, 0, 3).x).toBeCloseTo(Math.SQRT2, 12);
    expect(gridBisect((x) => x * x + 1, 0, 3).ok).toBe(false);
    expect(fitQuadratic(PUMPE_B.map((p) => p.Q), PUMPE_B.map((p) => p.H)).r2).toBeGreaterThan(0.99);
  });
});

describe("Querschnitte, Walther, Überdruckhöhe", () => {
  it("Querschnitt: Fehler bei d_i ≥ d_a, unmöglichem Umfang; Hinweis φ = 1 bei A, U von Hand", () => {
    expect(sectionGeometry(fdRepo, { kind: "ring", da: 0.03, di: 0.03 }).errors.length).toBe(1);
    expect(sectionGeometry(fdRepo, { kind: "ring", da: 1, di: 0.005 }).errors[0]).toMatch(/Tabelle/);
    expect(sectionGeometry(fdRepo, { kind: "au", A: 1, U: 1 }).errors[0]).toMatch(/unmöglich/);
    expect(sectionGeometry(fdRepo, { kind: "au", A: 1e-4, U: 0.05 }).warnings.length).toBe(1);
    const q = sectionGeometry(fdRepo, { kind: "rechteck", b: 0.1, h: 0.1 });
    expect(q.phi).toBe(0.88); expect(q.dh).toBeCloseTo(0.1, 15);
    expect(sectionGeometry(fdRepo, { kind: "ring", da: 2, di: 1 }).phi).toBeCloseTo(1.5 - 0.05 / 4, 12);
  });
  it("Walther: Fehler bei gleicher Temperatur und steigender Viskosität, Extrapolation mit Warnung", () => {
    const w = { T1: 313.15, nu1: 46e-6, T2: 373.15, nu2: 6.1e-6, C: 0.8 };
    expect(walther({ ...w, T2: 313.15 }, 300).errors.length).toBeGreaterThan(0);
    expect(walther({ ...w, nu2: 60e-6 }, 300).errors[0]).toMatch(/fallen/);
    expect(walther(w, 253.15).warnings.some((x) => x.includes("Extrapolation"))).toBe(true);
    expect(walther(w, 333.15).warnings).toEqual([]);
    expect(walther({ ...w, C: 0.5 }, 333.15).warnings[0]).toMatch(/0,6 bis 0,9/);
  });
  it("Überdruckhöhe h_pe = h_p − p_L/(ρ·g) an jedem Knoten", () => {
    const f = fluidFaelleB().find((x) => x.id === "RH-K11")!;
    const r = computeLine(fdRepo, f.inp, f.task);
    for (const n of r.nodes) expect(n.hpe).toBeCloseTo(n.hp - 95000 / (r.fluid.rho * 9.81), 10);
  });
});

describe("Durchflussmessung", () => {
  it("Normgrenzen: Warnung außerhalb, Fehler bei d ≥ D und ungültigem C", () => {
    const base = { D: 0.03, d: 0.015, rho: 1000, nu: 1e-6, mode: { kind: "Q" as const, Q: 1e-3 } };
    const r = computeMeter(fdRepo, { ...base, device: { kind: "blende", taps: "eck" } });
    expect(r.checks[0]!.ok).toBe(false); expect(r.warnings.length).toBe(1);
    expect(computeMeter(fdRepo, { ...base, d: 0.03, device: { kind: "blende", taps: "eck" } }).errors.length).toBe(1);
    expect(computeMeter(fdRepo, { ...base, device: { kind: "venturi", variant: null, C: 1.2, xi: null } }).errors.length).toBe(1);
    expect(computeMeter(fdRepo, { ...base, device: { kind: "venturi", variant: "unbekannt", C: null, xi: null } }).errors.length).toBe(1);
  });
  it("Blende: C steigt mit fallender Reynolds-Zahl, Druckentnahmen unterscheiden sich, Grenzwert Re → ∞", () => {
    expect(orificeC(0.5, 1e4, 0.1, "flansch").C).toBeGreaterThan(orificeC(0.5, 1e6, 0.1, "flansch").C);
    expect(orificeC(0.6, 1e5, 0.1, "eck").C).not.toBeCloseTo(orificeC(0.6, 1e5, 0.1, "D").C, 4);
  });
  it("Venturi bearbeitet: an Re_D = 10⁶ gilt C = 0,995, darüber 1,000", () => {
    const at = (Re: number) => computeMeter(fdRepo, { device: { kind: "venturi", variant: "maschinell bearbeiteter Einlaufkonus", C: null, xi: null }, D: 0.2, d: 0.1, rho: 1000, nu: 1e-6, mode: { kind: "Q", Q: Re * Math.PI * 0.2 * 1e-6 / 4 } });
    expect(at(1e6).C).toBe(0.995); expect(at(1.0001e6).C).toBe(1);
  });
});

describe("Druckstoß", () => {
  it("P28: t_S > t_R ist gleichbedeutend mit l < a·t_S/2 (Roloff Gl. 18.22)", () => {
    for (const [L, a, tS] of [[800, 1000, 6], [800, 1000, 1.6], [800, 1000, 1.59], [10, 1300, 0.01]] as const) expect(tS > 2 * L / a).toBe(L < a * tS / 2);
  });
  it("schnell und langsam, starre Wand ist obere Schranke, Fehlerfälle", () => {
    const base = { fluid: { kind: "wasser" as const, T: units.cToK(20), p: P0 }, L: 500, dv: 1, p: 5e5, ps: null };
    const s = computeSurge(fdRepo, { ...base, wave: { kind: "starr" }, tS: 0 });
    const w = computeSurge(fdRepo, { ...base, wave: { kind: "wand", D: 0.3, e: 0.008, E: 210e9, nu: 0.3, anchor: "a", wall: "duenn" }, tS: 0 });
    expect(w.a).toBeLessThan(s.a); expect(s.a).toBeCloseTo(waterSound(units.cToK(20), P0).w, 12);
    expect(computeSurge(fdRepo, { ...base, wave: { kind: "starr" }, tS: 10 }).fast).toBe(false);
    expect(computeSurge(fdRepo, { ...base, wave: { kind: "wand", D: 0.3, e: 0.008, E: 210e9, nu: 0.3, anchor: "b", wall: "dick" }, tS: 0 }).errors[0]).toMatch(/O-b6/);
    expect(computeSurge(fdRepo, { ...base, wave: { kind: "starr" }, L: 0, tS: 0 }).errors.length).toBe(1);
    expect(computeSurge(fdRepo, { ...base, fluid: { kind: "hand", rho: 900, K: null }, wave: { kind: "starr" }, tS: 0 }).errors[0]).toMatch(/Kompressionsmodul/);
  });
  it("Wandbeiwert: dickwandig geht für dünne Wände in dünnwandig über (Verankerung a und c)", () => {
    for (const anchor of ["a", "c"] as const) expect(wallPsi(1, 1e-4, 0.3, anchor, "dick") / wallPsi(1, 1e-4, 0.3, anchor, "duenn")).toBeCloseTo(1, 3);
  });
});
