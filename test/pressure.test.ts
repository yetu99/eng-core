import { describe, expect, it } from "vitest";
import { computeStrength, designPressureStrength, lame, computePressure, designPressure, pressureErrors, pressureProfile, caseLabel, KINDS, type StrengthInput, type PressureLoad, type PressureMaterial } from "../src/index";
import { repo } from "../src/data";

const base: StrengthInput = { mode: "single", kind: "PB", sub: "ZG", materialId: "W038", secType: "rund_hohl", dims: { D: 60, t: 4 }, L: 1200, F: 2, q: 2, a: 300, N: 0, T: 0, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null }, pressure: { dim: "inner", d: 100, t: 5, pi: 10, pa: 0 } };
const run = (p: Partial<PressureLoad>, over: Partial<StrengthInput> = {}) => computeStrength(repo, { ...base, ...over, pressure: { ...base.pressure!, ...p } });
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const M: PressureMaterial = { E: 70000, nu: 0.3, nuRef: "Test", Rp: 260, Rm: 310, brittle: false, RmSym: "R_m", SFreq: 1.3, SBreq: 1.5 };

describe("Druckbehälter: Lamé und Randbedingungen", () => {
  it("Randbedingungen σ_r(a) = −p_i, σ_r(b) = −p_a für alle Formen", () => {
    for (const [shape, closed] of [["ZY", true], ["ZY", false], ["KU", false]] as const) {
      const s = lame(shape, closed, 40, 57, 13, 3, 70000, 0.3);
      expect(rel(s.at(40).sr, -13)).toBeLessThan(1e-12);
      expect(rel(s.at(57).sr, -3)).toBeLessThan(1e-12);
    }
  });
  it("Gleichgewicht d(r·σ_r)/dr = σ_θ (Zylinder) und d(r²σ_r)/dr = 2rσ_t (Kugel), numerisch geprüft", () => {
    const h = 1e-4;
    const z = lame("ZY", true, 50, 70, 20, 4, 70000, 0.3), k = lame("KU", false, 50, 70, 20, 4, 70000, 0.3);
    for (const r of [52, 60, 68]) {
      const dz = ((r + h) * z.at(r + h).sr - (r - h) * z.at(r - h).sr) / (2 * h);
      expect(Math.abs(dz - z.at(r).st)).toBeLessThan(1e-6);
      const dk = ((r + h) ** 2 * k.at(r + h).sr - (r - h) ** 2 * k.at(r - h).sr) / (2 * h);
      expect(Math.abs(dk - 2 * r * k.at(r).st)).toBeLessThan(1e-4);
    }
  });
  it("Zylinder geschlossen: σ_v(a) = √3·p·b²/(b² − a²) bei p_a = 0", () => {
    const r = run({});
    expect(rel(r.pressure!.inner!.sv, Math.sqrt(3) * 10 * 55 ** 2 / (55 ** 2 - 50 ** 2))).toBeLessThan(1e-12);
    expect(r.pressure!.rGov).toBe("a");
  });
  it("Kugel: σ_t,Kugel < σ_θ,Zylinder bei gleichen Maßen", () => {
    expect(run({}, { sub: "KU" }).pressure!.inner!.st).toBeLessThan(run({}).pressure!.inner!.st);
  });
  it("Gleichdruck: geschlossen und Kugel hydrostatisch (σ_v = 0), offen σ_v = p (σ_z = 0)", () => {
    expect(run({ pi: 8, pa: 8 }).pressure!.svMax).toBeLessThan(1e-12);
    expect(run({ pi: 8, pa: 8 }, { sub: "KU" }).pressure!.svMax).toBeLessThan(1e-12);
    expect(rel(run({ pi: 8, pa: 8 }, { sub: "ZO" }).pressure!.svMax, 8)).toBeLessThan(1e-12);
  });
  it("Grenzfall a → 0 mit Außendruck: Vollzylinder σ_r = σ_θ = −p (offen)", () => {
    const s = lame("ZY", false, 1e-6, 50, 0, 6, 70000, 0.3);
    expect(rel(s.at(25).sr, -6)).toBeLessThan(1e-9);
    expect(rel(s.at(25).st, -6)).toBeLessThan(1e-9);
  });
  it("dünne Wand: Lamé nähert die Kesselformel (D_m/t = 200 unter 0,5 %)", () => {
    const r = run({ d: 199, t: 1 });
    expect(Math.abs(r.pressure!.kessel!.dev)).toBeLessThan(5e-3);
  });
  it("Profil: Werte von a bis b, Ränder exakt", () => {
    const s = lame("ZY", true, 50, 55, 10, 0, 70000, 0.3), p = pressureProfile(s, 10);
    expect(p).toHaveLength(11);
    expect(p[0]!.r).toBe(50); expect(p[10]!.r).toBe(55);
  });
});

describe("Druckbehälter: Plausibilität und Monotonie", () => {
  it("mehr Druck ergibt mehr Ausnutzung", () => {
    const u = [2, 5, 10, 20].map((pi) => run({ pi }).util);
    for (let i = 1; i < u.length; i++) expect(u[i]!).toBeGreaterThan(u[i - 1]!);
  });
  it("mehr Wandstärke ergibt weniger Ausnutzung (alle Formen)", () => {
    for (const sub of ["ZG", "ZO", "KU"]) {
      const u = [2, 4, 8, 16].map((t) => run({ t }, { sub }).util);
      for (let i = 1; i < u.length; i++) expect(u[i]!).toBeLessThan(u[i - 1]!);
    }
  });
  it("Ausnutzung = σ_v,max / σ_zul = max(S_erf / S)", () => {
    const r = run({});
    expect(rel(r.util, r.pressure!.svMax / r.pressure!.sigmaZul)).toBeLessThan(1e-12);
    expect(r.governing).toBe("Bruch");
  });
  it("Kesselformel nur bei D_m/t ≥ 20, sonst Hinweis", () => {
    const r = run({ t: 20 });
    expect(r.pressure!.kessel).toBeNull();
    expect(r.warnings.some((w) => w.startsWith("Dickwandig"))).toBe(true);
  });
  it("Rechenweg: Formel-IDs und Gruppen", () => {
    const ids = Object.values(run({}).trace).flat().map((s) => s!.id);
    for (const id of ["P-GEO", "P-ZY-SR", "P-ZY-ST", "P-ZY-SZ", "P-ZY-SV", "P-ZY-U", "P-TR", "P-ZY-KS", "P-NZ", "P-NA", "N-SF", "N-SB"]) expect(ids).toContain(id);
    expect(ids.some((id) => id.startsWith("Q-"))).toBe(false);
  });
  it("Belastungsart PB im Katalog Blatt 1", () => {
    expect(KINDS.PB.label).toBe("Druckbehälter");
    expect(caseLabel("single", "PB", "KU")).toBe("Hohlkugel");
  });
  it("Polymer: Hinweis 23 °C wie Blatt 1", () => {
    expect(computeStrength(repo, { ...base, materialId: "W060" }).warnings.some((w) => w.startsWith("Polymer"))).toBe(true);
  });
  it("deterministisch", () => {
    expect(JSON.stringify(run({}).kpis)).toBe(JSON.stringify(run({}).kpis));
  });
});

describe("Druckbehälter: Eingaben", () => {
  it("Fehler für negative Drücke, Nullen, t ≥ Außenradius", () => {
    expect(pressureErrors({ dim: "inner", d: 100, t: 5, pi: -1, pa: 0 }).length).toBe(1);
    expect(pressureErrors({ dim: "inner", d: 100, t: 5, pi: 0, pa: 0 }).length).toBe(1);
    expect(pressureErrors({ dim: "outer", d: 100, t: 50, pi: 1, pa: 0 }).length).toBe(1);
    expect(pressureErrors({ dim: "inner", d: 0, t: 0, pi: 1, pa: 0 }).length).toBe(2);
    expect(run({ pi: -2 }).errors.length).toBeGreaterThan(0);
  });
  it("unbekannter Lastfall und fehlende Drücke", () => {
    expect(computeStrength(repo, { ...base, sub: "XX" }).errors.length).toBe(1);
    expect(computeStrength(repo, { ...base, pressure: undefined }).errors.length).toBe(1);
  });
  it("spröder Werkstoff: nur Bruch, σ_zul = R_m / S_B", () => {
    const r = computeStrength(repo, { ...base, materialId: "W029" });   // EN-GJL-250
    expect(r.checks.map((c) => c.key)).toEqual(["bruch"]);
    expect(rel(r.pressure!.sigmaZul, r.strength!.Rm!.v! / base.SBreq)).toBeLessThan(1e-12);
    expect(r.warnings).toContain("Spröder Werkstoff: nur Bruchnachweis");
  });
});

describe("Druckbehälter: Bemessen", () => {
  const des = (p: Partial<PressureLoad>, sub = "ZG") => designPressureStrength(repo, { ...base, sub, SFreq: 1.3, SBreq: 1.5, pressure: { ...base.pressure!, ...p } });
  it("geschlossene Lösung: Rückeinsetzen ergibt u = 1, gewählte Wand erfüllt den Nachweis, Raster 0,5 mm", () => {
    for (const [sub, dim, d] of [["ZG", "outer", 110], ["ZG", "inner", 100], ["KU", "outer", 110], ["KU", "inner", 100]] as const) {
      const r = des({ dim, d, pi: 10 }, sub);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.closedForm).toBe(true);
      expect(Math.abs((r.trace.find((s) => s.id === "P-NA")!.value) - 1)).toBeLessThan(1e-9);
      expect(r.tGew % 0.5).toBe(0);
      expect(r.result.util).toBeLessThanOrEqual(1);
    }
  });
  it("Bisektion (offen, gemischte Drücke): u(t_erf) = 1 ± 10⁻⁶", () => {
    for (const [sub, p] of [["ZO", { dim: "outer" as const, d: 110, pi: 10, pa: 0 }], ["ZG", { dim: "inner" as const, d: 100, pi: 30, pa: 5 }], ["KU", { dim: "inner" as const, d: 100, pi: 30, pa: 5 }]] as const) {
      const r = des(p, sub);
      expect(r.ok).toBe(true);
      if (r.ok) { expect(r.closedForm).toBe(false); expect(Math.abs(r.trace.find((s) => s.id === "P-NA")!.value - 1)).toBeLessThan(1e-6); }
    }
  });
  it("geschlossene Lösung = Bisektion (gleiche Aufgabe)", () => {
    const pi = { dim: "outer" as const, d: 110, t: 1, pi: 10, pa: 0, shape: "ZY" as const, closed: true };
    const a = designPressure(pi, M), b = designPressure({ ...pi, pa: 1e-12 }, M);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(rel(a.tErf, b.tErf)).toBeLessThan(1e-9);
  });
  it("D8: Druck über der Werkstoffgrenze liefert eine Meldung", () => {
    const r = des({ dim: "outer", d: 110, pi: 120 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("Druck übersteigt die Grenze des Werkstoffs");
    expect(des({ dim: "outer", d: 110, pi: 140 }, "KU").ok).toBe(false);
  });
  it("mehr Druck ergibt mehr Wandstärke", () => {
    const t = [5, 10, 20, 40].map((pi) => { const r = des({ dim: "inner", d: 100, pi }); return r.ok ? r.tErf : NaN; });
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
  });
  it("computePressure ohne Auslegungswert: keine Ausnutzung", () => {
    const r = computePressure({ dim: "inner", d: 100, t: 5, pi: 10, pa: 0, shape: "ZY", closed: true }, { ...M, Rp: null, Rm: null });
    expect(r.util).toBe(Infinity);
  });
});
