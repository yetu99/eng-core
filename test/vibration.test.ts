import { describe, expect, it } from "vitest";
import { computeStrength, designSize, PRIMARY_KPIS, solveModes, betaL, freqResidual, rootBracket, rayleigh, modeProfile, vibrationErrors, caseLabel, KINDS, VIB_RAYLEIGH_MAX, type StrengthInput, type VibrationSupport, type VibrationLoad } from "../src/index";
import { repo } from "../src/data";

const SUP: VibrationSupport[] = ["KR", "GG", "EG", "EE"];
const vib: VibrationLoad = { mz: 0, fmin: 30, ferr: null, dmin: 20 };
const base: StrengthInput = { mode: "single", kind: "FQ", sub: "KR", materialId: "W038", secType: "rund_hohl", dims: { D: 60, t: 4 }, L: 1200, F: 2, q: 2, a: 300, N: 0, T: 0, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null }, vibration: vib };
const run = (over: Partial<StrengthInput> = {}, v: Partial<VibrationLoad> = {}) => computeStrength(repo, { ...base, ...over, vibration: { ...vib, ...v } });
const f1 = (over: Partial<StrengthInput> = {}, v: Partial<VibrationLoad> = {}) => run(over, v).vibration!.modes[0]!.f;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const P = { EI: 1.94e10, m: 1.9e-6, L: 1200 };

describe("Eigenfrequenz: Wurzeln und Frequenzgleichung", () => {
  it("jede Klammer enthält genau einen Vorzeichenwechsel (Raster 10⁻³)", () => {
    for (const s of SUP) for (let n = 1; n <= 3; n++) {
      const [a, b] = rootBracket(s, n);
      let changes = 0, prev = freqResidual(s, a + 1e-9);
      for (let x = a + 1e-3; x < b; x += 1e-3) { const v = freqResidual(s, x); if (v * prev < 0) changes++; prev = v; }
      expect(changes, `${s} n = ${n}`).toBe(1);
    }
  });
  it("Wurzeln aufsteigend und mit Rest der Frequenzgleichung ≤ 10⁻¹²", () => {
    for (const s of SUP) {
      const r = [1, 2, 3].map((n) => betaL(s, n));
      expect(r[1]!).toBeGreaterThan(r[0]!); expect(r[2]!).toBeGreaterThan(r[1]!);
      for (const x of r) expect(Math.abs(freqResidual(s, x))).toBeLessThan(1e-12);
    }
  });
  it("GG: β_nL = nπ", () => {
    for (let n = 1; n <= 3; n++) expect(rel(betaL("GG", n), n * Math.PI)).toBeLessThan(1e-15);
  });
});

describe("Eigenfrequenz: Skalierung und Ordnung", () => {
  it("f skaliert mit 1/L²", () => {
    for (const s of SUP) expect(rel(f1({ sub: s, L: 600 }) * 600 ** 2, f1({ sub: s, L: 1200 }) * 1200 ** 2)).toBeLessThan(1e-12);
  });
  it("f skaliert mit √E und 1/√ρ (E·I und m′ getrennt variiert)", () => {
    for (const s of SUP) {
      const a = solveModes(s, P)[0]!.f;
      expect(rel(solveModes(s, { ...P, EI: 4 * P.EI })[0]!.f, 2 * a)).toBeLessThan(1e-12);
      expect(rel(solveModes(s, { ...P, m: 4 * P.m })[0]!.f, a / 2)).toBeLessThan(1e-12);
    }
  });
  it("Stahl und Aluminium: f₁ ∝ √(E/ρ) bei gleichem Querschnitt", () => {
    const al = run({ sub: "GG" }), st = run({ sub: "GG", materialId: "W001" });
    const ratio = Math.sqrt((st.E / st.vibration!.m) / (al.E / al.vibration!.m));
    expect(rel(st.vibration!.modes[0]!.f / al.vibration!.modes[0]!.f, ratio)).toBeLessThan(1e-12);
  });
  it("f_n steigt mit n", () => {
    for (const s of SUP) { const m = run({ sub: s }).vibration!.modes; expect(m[1]!.f).toBeGreaterThan(m[0]!.f); expect(m[2]!.f).toBeGreaterThan(m[1]!.f); }
  });
  it("Lagerung: EE > EG > GG > KR für f₁ bei gleichen Daten", () => {
    const [kr, gg, eg, ee] = SUP.map((s) => f1({ sub: s }));
    expect(ee!).toBeGreaterThan(eg!); expect(eg!).toBeGreaterThan(gg!); expect(gg!).toBeGreaterThan(kr!);
  });
  it("Zusatzmasse senkt f, m_z = ρ·A halbiert ω²", () => {
    const r0 = run(), mz = r0.vibration!.mKgM;
    expect(rel(f1({}, { mz }), r0.vibration!.modes[0]!.f / Math.SQRT2)).toBeLessThan(1e-12);
  });
  it("Einheitenkette: m′ = ρ·A·10⁻¹² + m_z·10⁻⁶ in t/mm", () => {
    const r = run({}, { mz: 2 });
    expect(rel(r.vibration!.m, 2700e-12 * r.section.A + 2e-6)).toBeLessThan(1e-14);
    expect(rel(r.vibration!.mKgM, 2700 * r.section.A * 1e-6 + 2)).toBeLessThan(1e-14);
  });
});

describe("Eigenfrequenz: Eigenformen", () => {
  it("Randbedingungen, Normierung und n − 1 Knoten", () => {
    for (const s of SUP) for (const md of solveModes(s, P)) {
      expect(Math.abs(md.phi(0))).toBeLessThan(1e-12);
      if (s !== "KR") expect(Math.abs(md.phi(P.L))).toBeLessThan(1e-7);
      const h = 1e-3;
      if (s !== "GG") expect(Math.abs(md.phi(h) / h)).toBeLessThan(1e-3);   // φ′(0) = 0 (eingespannt)
      if (s === "EE") expect(Math.abs(md.phi(P.L - h) / h)).toBeLessThan(1e-3);
      expect(md.nodes).toHaveLength(md.n - 1);
      for (const x of md.nodes) expect(Math.abs(md.phi(x))).toBeLessThan(1e-9);
      const prof = modeProfile(md, P.L, 2000);
      expect(Math.max(...prof.map((p) => Math.abs(p.phi)))).toBeLessThanOrEqual(1 + 1e-12);
      expect(Math.abs(md.phi(md.xMax))).toBeCloseTo(1, 12);
      expect(md.phi(Math.min(...md.nodes, P.L) / 2)).toBeGreaterThan(0);   // erste Halbwelle positiv
    }
  });
  it("Randbedingungen bei x = L je Lagerung (Ableitungen numerisch, h = 0,1 mm, bezogen auf βⁿ, Grenze 10⁻⁵ bzw. 10⁻³ gegen Werte der Größenordnung 1 bei verletzter Bedingung)", () => {
    const h = 0.1, L = P.L;
    const d1 = (f: (x: number) => number, x: number) => (f(x + h) - f(x - h)) / (2 * h);
    const d2 = (f: (x: number) => number, x: number) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
    const d3 = (f: (x: number) => number, x: number) => (f(x + 2 * h) - 2 * f(x + h) + 2 * f(x - h) - f(x - 2 * h)) / (2 * h ** 3);
    for (const s of SUP) for (const md of solveModes(s, P)) {
      const b = md.beta;
      if (s === "KR") { expect(Math.abs(d2(md.phi, L)) / b ** 2).toBeLessThan(1e-5); expect(Math.abs(d3(md.phi, L)) / b ** 3).toBeLessThan(1e-3); }
      if (s === "GG" || s === "EG") expect(Math.abs(d2(md.phi, L)) / b ** 2).toBeLessThan(1e-5);   // gelenkig: φ″(L) = 0
      if (s === "EE") expect(Math.abs(d1(md.phi, L)) / b).toBeLessThan(1e-5);                     // eingespannt: φ′(L) = 0
      if (s === "EE") expect(Math.abs(d2(md.phi, L)) / b ** 2).toBeGreaterThan(0.1);                // Gegenprobe: eingespannt hat φ″(L) ≠ 0
    }
  });
  it("EG: σ aus φ(L) = 0 gleich σ aus φ″(L) = 0 (wegen tan βL = tanh βL)", () => {
    for (const md of solveModes("EG", P)) {
      const l = md.betaL;
      expect(rel(md.sigma!, (Math.cosh(l) + Math.cos(l)) / (Math.sinh(l) + Math.sin(l)))).toBeLessThan(1e-14);
    }
  });
  it("Orthogonalität ∫φ_i·φ_j dx = 0 (Simpson, 4000 Intervalle)", () => {
    for (const s of SUP) {
      const m = solveModes(s, P), n = 4000, h = P.L / n;
      const dot = (a: number, b: number) => { let sum = 0; for (let i = 0; i <= n; i++) { const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2; sum += w * m[a]!.phi(i * h) * m[b]!.phi(i * h); } return (sum * h) / 3; };
      const nrm = Math.sqrt(dot(0, 0) * dot(1, 1));
      expect(Math.abs(dot(0, 1)) / nrm).toBeLessThan(1e-9);
      expect(Math.abs(dot(0, 2)) / Math.sqrt(dot(0, 0) * dot(2, 2))).toBeLessThan(1e-9);
      expect(Math.abs(dot(1, 2)) / Math.sqrt(dot(1, 1) * dot(2, 2))).toBeLessThan(1e-9);
    }
  });
  it("Rayleigh: obere Schranke f₁ ≤ f_R ≤ 1,02·f₁ für alle Lagerungen und Querschnitte", () => {
    for (const s of SUP) for (const over of [{}, { secType: "rechteck_voll" as const, dims: { b: 30, h: 60 } }, { L: 300 }]) {
      const r = run({ sub: s, ...over }, { mz: 3 }).vibration!;
      expect(r.rayleighRatio).toBeGreaterThanOrEqual(1);
      expect(r.rayleighRatio).toBeLessThanOrEqual(VIB_RAYLEIGH_MAX);
    }
    expect(rayleigh("GG", P).sol.support).toBe("GG");
  });
});

describe("Eigenfrequenz: Nachweise, Hinweise, Rechenweg", () => {
  it("Mindestfrequenz: u = f_min / f₁, Resonanzabstand: u = Δ_min / Δ", () => {
    const r = run({ sub: "GG" }, { fmin: 100, ferr: 100 });
    const f = r.vibration!.modes[0]!.f;
    expect(rel(r.checks.find((c) => c.key === "frequenz")!.u!, 100 / f)).toBeLessThan(1e-14);
    const d = (Math.abs(100 - f) / f) * 100;
    expect(rel(r.checks.find((c) => c.key === "resonanz")!.u!, 20 / d)).toBeLessThan(1e-12);
    expect(r.governing).toBe("Resonanzabstand");
  });
  it("ohne Anforderung: keine Ausnutzung, Hinweis", () => {
    const r = run({}, { fmin: null });
    expect(r.util).toBe(Infinity);
    expect(r.incomplete).toEqual(["Frequenz"]);
  });
  it("Hinweise: gedrungen (L/h < 10), andere Hauptachse, Erregung nahe f₂", () => {
    expect(run({ L: 500 }).warnings.some((w) => w.startsWith("Gedrungener Balken"))).toBe(true);
    expect(run({ secType: "rechteck_voll", dims: { b: 20, h: 40 } }).warnings.some((w) => w.startsWith("Schwingung in der anderen Hauptachse"))).toBe(true);
    const f2 = run({ sub: "GG" }).vibration!.modes[1]!.f;
    expect(run({ sub: "GG" }, { ferr: f2 * 1.05 }).warnings.some((w) => w.includes("nahe f₂"))).toBe(true);
  });
  it("Eingabefehler", () => {
    expect(vibrationErrors(1200, { mz: -1, fmin: 0, ferr: -5, dmin: 100 })).toHaveLength(4);
    expect(vibrationErrors(0, vib)).toHaveLength(1);
    expect(run({ sub: "XX" }).errors.length).toBe(1);
    expect(computeStrength(repo, { ...base, vibration: undefined }).errors.length).toBe(1);
  });
  it("Rechenweg: Formel-IDs, keine Formfaktoren und Torsionswerte", () => {
    for (const s of SUP) {
      const ids = Object.values(run({ sub: s }, { ferr: 100 }).trace).flat().map((x) => x!.id);
      for (const id of ["W-E", "W-RHO", "Q-RH-A", "Q-RH-I", "Q-m", "V-EI", "V-MB", "V-EW", `V-CK-${s}`, "V-BL", "V-OM", "V-FN", `V-PH-${s}`, "V-RQ", "V-NZ", "V-NR"]) expect(ids).toContain(id);
      expect(ids.some((id) => id.startsWith("F-") || id.endsWith("-K") || id.endsWith("-WT") || id === "Q-i")).toBe(false);
    }
  });
  it("Belastungsart FQ im Katalog Blatt 1, Hauptkennwert f₁", () => {
    expect(KINDS.FQ.label).toBe("Eigenfrequenz");
    expect(caseLabel("single", "FQ", "EG")).toBe("Links eingespannt, rechts gelenkig");
    expect(run().kpis.filter((k) => k.main).map((k) => k.key)).toEqual(["f1"]);
  });
  it("deterministisch", () => {
    expect(JSON.stringify(run({}, { ferr: 50 }).kpis)).toBe(JSON.stringify(run({}, { ferr: 50 }).kpis));
  });
});

describe("Eigenfrequenz: Bemessen formtreu", () => {
  it("f₁(s) = f_min, gewählte Maße erfüllen f₁ ≥ f_min", () => {
    for (const s of SUP) for (const mz of [0, 4]) {
      const d = designSize(repo, { ...base, sub: s, vibration: { ...vib, mz, fmin: 2 * f1({ sub: s }, { mz }) } }, "formtreu");
      expect(d.ok).toBe(true);
      if (!d.ok) continue;
      const raw = computeStrength(repo, { ...base, sub: s, dims: d.raw, vibration: { ...vib, mz } }).vibration!.modes[0]!.f;
      expect(rel(raw, 2 * f1({ sub: s }, { mz }))).toBeLessThan(mz ? 1e-6 : 1e-12);
      expect(d.result.util).toBeLessThanOrEqual(1);
      expect(d.dims["t"]! % 0.5).toBe(0);
    }
  });
  it("ohne Zusatzmasse: s = f_min / f₁", () => {
    const d = designSize(repo, { ...base, vibration: { ...vib, fmin: 80 } }, "formtreu");
    expect(d.ok && rel(d.s, 80 / f1())).toBeLessThan(1e-14);
  });
  it("nur formtreu, nur mit f_min, mehr f_min ergibt größeres s", () => {
    expect(designSize(repo, base, "t").ok).toBe(false);
    expect(designSize(repo, { ...base, vibration: { ...vib, fmin: null } }, "formtreu").ok).toBe(false);
    const s = [40, 80, 160].map((fmin) => { const d = designSize(repo, { ...base, vibration: { ...vib, mz: 2, fmin } }, "formtreu"); return d.ok ? d.s : NaN; });
    expect(s[1]!).toBeGreaterThan(s[0]!); expect(s[2]!).toBeGreaterThan(s[1]!);
  });
});

describe("Hauptkennwerte (Darstellung, alle Belastungsarten)", () => {
  const cases: Array<[string, Partial<StrengthInput>]> = [
    ["zug", { kind: "zug", sub: "Z1" }], ["druck", { kind: "druck", sub: "K2", F: 20 }], ["biegung", { kind: "biegung", sub: "EQ" }],
    ["torsion", { kind: "torsion", sub: "T1", T: 200 }], ["combined", { mode: "combined", sub: "EQ", N: -10, T: 150 }],
    ["PB", { kind: "PB", sub: "ZG", pressure: { dim: "inner", d: 100, t: 5, pi: 10, pa: 0 } }], ["FQ", { kind: "FQ", sub: "GG" }],
  ];
  it("jeder Hauptkennwert existiert und ist markiert, alle anderen nicht", () => {
    for (const [k, over] of cases) {
      const r = computeStrength(repo, { ...base, ...over, vibration: { ...vib, ferr: 100 } });
      expect(r.errors, k).toEqual([]);
      const keys = r.kpis.map((x) => x.key);
      for (const p of PRIMARY_KPIS[k as keyof typeof PRIMARY_KPIS]) expect(keys, `${k} ${p}`).toContain(p);
      for (const x of r.kpis) expect(!!x.primary, `${k} ${x.key}`).toBe(PRIMARY_KPIS[k as keyof typeof PRIMARY_KPIS].includes(x.key));
    }
  });
});
