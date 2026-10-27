import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeStrength, alphaK, alphaKChart, woehlerChart, gradientOf, supportNumber, ktValue, kgValue, krSigma, fatigueGroupOf, pOfCondition, FATIGUE_GROUPS, FATIGUE_DEFAULT, type StrengthInput, type FatigueInput, type NotchGeom, type LoadComp } from "../src/index";
import { repo } from "../src/data";

const base: StrengthInput = { mode: "single", kind: "biegung", sub: "KE", materialId: "W008", secType: "rund_voll", dims: { D: 32 }, L: 1000, F: 0.3, q: 0, a: 300, N: 0, T: 0, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null } };
const fat = (o: Partial<FatigueInput>): FatigueInput => ({ ...FATIGUE_DEFAULT, ...o });
const SD = (inp: StrengthInput) => computeStrength(repo, inp).fatigue!.SD as number;
const C: LoadComp[] = ["zd", "b", "t"];

describe("Formzahl und Stützzahl (Roloff TB 3-6, 3-7)", () => {
  it("α_k fällt mit wachsendem Radius und geht gegen 1", () => {
    for (const kind of ["absatz", "nut"] as const) for (const c of C) {
      let prev = Infinity;
      for (const r of [0.5, 1, 2, 4, 8, 16, 32]) {
        const g: NotchGeom = kind === "absatz" ? { kind, d: 40, D: 48, t: 4, r } : { kind, d: 40, D: 48, t: 4, r };
        const a = alphaK(g, c).alpha;
        expect(a, `${kind} ${c} r ${r}`).toBeLessThan(prev);
        expect(a).toBeGreaterThan(1);
        prev = a;
      }
      expect(alphaK({ kind, d: 40, D: 48, t: 4, r: 1e7 }, c).alpha).toBeLessThan(1.01);
    }
  });
  it("Gültigkeitsgrenzen erzeugen Fehler statt Werte", () => {
    expect(alphaK({ kind: "absatz", d: 40, D: 48, t: 4, r: 0.1 }, "b").errors.length).toBeGreaterThan(0);
    expect(alphaK({ kind: "bohrung", d: 20, D: 20, t: 5, r: 5 }, "b").errors.length).toBeGreaterThan(0);
  });
  it("Stützzahl stetig an den Bereichsgrenzen G′ = 0,1 und 1 und n wächst mit G′", () => {
    for (const g of Object.values(FATIGUE_GROUPS)) {
      for (const Gb of [0.1, 1]) expect(supportNumber(g, Gb, 600).n).toBeCloseTo(supportNumber(g, Gb * (1 + 1e-12), 600).n, 9);
      let prev = 0;
      for (const G of [0.01, 0.1, 0.5, 1, 3, 10]) { const n = supportNumber(g, G, 600).n; expect(n).toBeGreaterThan(prev); prev = n; }
    }
  });
  it("Querbohrung: Formeln TB 3-6e und Spannungsgefälle", () => {
    const g: NotchGeom = { kind: "bohrung", d: 30, D: 30, t: 3, r: 3 };
    expect(alphaK(g, "zd").alpha).toBeCloseTo(2.8, 12);
    expect(alphaK(g, "b").alpha).toBeCloseTo(3 + 1.4 * 0.2 - 2.8 * Math.sqrt(0.2), 12);
    expect(alphaK(g, "t").alpha).toBeCloseTo(2.023 - 1.125 * Math.sqrt(0.2), 12);
    expect(gradientOf(g, "b").G).toBeCloseTo(2.3 / 3 + 2 / 30, 12);
  });
});

describe("Größe und Rauheit (Roloff TB 3-10, 3-11)", () => {
  it("K_t stetig an den Kurvengrenzen und 1 bis zum Bezugsdurchmesser", () => {
    expect(ktValue("verguetung", "m", 16).Kt).toBe(1);
    expect(ktValue("verguetung", "m", 299.999).Kt).toBeCloseTo(0.67, 2);
    expect(ktValue("verguetung", "p", 299.999).Kt).toBeCloseTo(0.57, 2);
    expect(ktValue("baustahl", "m", 299.999).Kt).toBeCloseTo(0.89, 2);
    expect(ktValue("baustahl", "p", 299.999).Kt).toBeCloseTo(0.75, 2);
    expect(ktValue("einsatz", "m", 149.999).Kt).toBeCloseTo(0.60, 2);
    expect(ktValue("gjs", "m", 60).Kt).toBe(1);
    expect(ktValue("gjl", "m", 7.5).Kt).toBeCloseTo(1.207, 12);
  });
  it("K_g: 1 bis 7,5 mm, 0,8 ab 150 mm, stetig", () => {
    expect(kgValue(7.5)).toBeCloseTo(1, 12); expect(kgValue(149.9999)).toBeCloseTo(0.8, 5); expect(kgValue(300)).toBe(0.8);
  });
  it("Rauheit: Stahl wie DIN 743 (1 − 0,22·lg R_z·(lg(R_m/20) − 1)), höchstens 1", () => {
    for (const Rm of [400, 570, 1000]) for (const Rz of [1.6, 6.3, 25]) expect(krSigma(FATIGUE_GROUPS.stahl, Rz, Rm)).toBeCloseTo(1 - 0.22 * Math.log10(Rz) * (Math.log10(Rm / 20) - 1), 12);
    expect(krSigma(FATIGUE_GROUPS.stahl, 6.3, 150)).toBe(1);
  });
});

describe("Nachweis (Roloff/Matek 27 Beispiele 3.3 c und 3.4)", () => {
  it("Bsp. 3.4: S_D = 1,93", () => {
    const r = computeStrength(repo, { ...base, mode: "combined", materialId: "W001", dims: { D: 60 }, F: 1.3, T: 1700, N: 0, dvChoice: { RE: "manual", RM: "manual" }, dvManual: { RE: 335, RM: 570 }, fatigue: fat({ notch: { type: "absatz", D: 70, r: 2 }, xK: 0, R: { zd: 0, b: -1, t: 1 }, dEff: 80, sigmaW: { zd: null, b: 290, t: null } }) });
    expect(r.fatigue!.SD).toBeCloseTo(1.933, 3);
    expect(r.checks.find((c) => c.key === "dauerbruch")!.S).toBeCloseTo(1.933, 3);
  });
  it("Bsp. 3.3 c: S_D = 3,49", () => {
    expect(SD({ ...base, kind: "torsion", sub: "T1", materialId: "W001", dims: { D: 25 }, T: 160, dvChoice: { RE: "manual", RM: "manual" }, dvManual: { RE: 295, RM: 470 }, fatigue: fat({ notch: { type: "beta", beta: { t: 1.36 } }, R: { zd: 0, b: -1, t: 0 }, Rz: 12.5, sigmaW: { zd: null, b: null, t: 145 } }) })).toBeCloseTo(3.494, 3);
  });
});

describe("Plausibilität", () => {
  const ab = (r: number, Rz = 6.3, o: Partial<FatigueInput> = {}) => ({ ...base, fatigue: fat({ notch: { type: "absatz", D: 38, r }, xK: 0, Rz, ...o }) });
  it("S_D fällt mit der Rauheit und steigt mit dem Kerbradius", () => {
    expect(SD(ab(3, 1.6))).toBeGreaterThan(SD(ab(3, 6.3)));
    expect(SD(ab(3, 6.3))).toBeGreaterThan(SD(ab(3, 25)));
    expect(SD(ab(1))).toBeLessThan(SD(ab(2)));
    expect(SD(ab(2))).toBeLessThan(SD(ab(3)));
  });
  it("Überlastungsfall 1 ≥ Fall 2 bei Mittelspannung und S ≥ 1", () => {
    const mk = (ol: 1 | 2 | 3) => SD({ ...base, mode: "combined", T: 400, N: 0, fatigue: fat({ notch: { type: "absatz", D: 38, r: 3 }, xK: 0, R: { zd: 0, b: -1, t: 1 }, overload: ol }) });
    expect(mk(2)).toBeGreaterThan(1);
    expect(mk(1)).toBeGreaterThanOrEqual(mk(2));
  });
  it("mehr Last ergibt weniger Sicherheit, Zeitfestigkeit ≥ Dauerfestigkeit bei N < N_D", () => {
    expect(SD({ ...base, F: 0.4, fatigue: fat({}) })).toBeLessThan(SD({ ...base, F: 0.3, fatigue: fat({}) }));
    const r = computeStrength(repo, { ...base, F: 0.9, fatigue: fat({ notch: { type: "absatz", D: 38, r: 3 }, xK: 0, N: 1e5 }) }).fatigue!;
    expect(r.SZ!).toBeGreaterThan(r.SD!);
  });
  it("Schalter aus: Ergebnis von Blatt 1 unverändert", () => {
    const off = computeStrength(repo, base), on = computeStrength(repo, { ...base, fatigue: fat({ on: false }) });
    expect(JSON.stringify(on.kpis)).toBe(JSON.stringify(off.kpis));
    expect(JSON.stringify(on.checks)).toBe(JSON.stringify(off.checks));
    expect(on.fatigue).toBeNull();
  });
  it("Schalter an: Ausnutzung berücksichtigt den Dauerbruch", () => {
    const r = computeStrength(repo, { ...base, F: 0.9, fatigue: fat({ notch: { type: "absatz", D: 38, r: 1 }, xK: 0 }) });
    const c = r.checks.find((x) => x.key === "dauerbruch")!;
    expect(r.util).toBeGreaterThanOrEqual(c.u!);
  });
  it("deterministisch", () => {
    const i = ab(3);
    expect(JSON.stringify(computeStrength(repo, i).fatigue)).toBe(JSON.stringify(computeStrength(repo, i).fatigue));
  });
});

describe("Werkstoffdaten WDB 1.1 und Gruppen", () => {
  it("jeder Metallwerkstoff hat eine Gruppe, Nichtmetalle keine", () => {
    for (const m of repo.materials) expect(fatigueGroupOf(m) !== null, m.id).toBe(m.cls === "Metall");
  });
  it("Bedingung der Schwingfestigkeitswerte im Pflichtformat, P lesbar", () => {
    const pv = JSON.parse(readFileSync(new URL("../data/propertyValues.json", import.meta.url), "utf8")) as Array<{ id: string; property_id: string; condition: string | null }>;
    const re = /^(Umlaufbiegung|Flachbiegung|Biegung|Zug-Druck|Torsion); R = (−1|0); N = ([0-9]+(,[0-9]+)?·10\^[0-9]+|k\. A\.); [^;]+; P = ([0-9]+(,[0-9]+)? %|k\. A\.)$/;
    const rows = pv.filter((r) => ["P-SBW", "P-SZDW", "P-TTW", "P-SZSCH"].includes(r.property_id));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.condition, r.id).toMatch(re);
    expect(pOfCondition("Umlaufbiegung; R = −1; N = 1·10^7; ungekerbt; P = 50 %")).toBe(50);
    expect(pOfCondition("Biegung; R = −1; N = k. A.; Probe k. A.; P = k. A.")).toBeNull();
  });
  it("Regel E10: Datenbankwert mit P = 50 % gegen Abschätzung, der kleinere zählt (GJS-400-15)", () => {
    const f = computeStrength(repo, { ...base, materialId: "W030", dims: { D: 20 }, F: 0.1, fatigue: fat({}) }).fatigue!;
    expect(f.comps[0]!.WN).toBe(Math.min(188, (0.25 + 70 / 400) * 400));
  });
  it("Polymere und Druck: Hinweis statt Nachweis", () => {
    expect(computeStrength(repo, { ...base, materialId: "W069", fatigue: fat({}) }).fatigue!.errors.length).toBe(1);
    expect(computeStrength(repo, { ...base, kind: "druck", sub: "K2", F: 5, fatigue: fat({}) }).warnings.join()).toContain("Dauerfestigkeit");
  });
  it("Schubmodul: dynamischer Datenbankwert wird nicht verwendet (PMMA), Abweichung > 15 % als Hinweis (Al2O3)", () => {
    const p = computeStrength(repo, { ...base, materialId: "W064", kind: "torsion", sub: "T1", T: 10 });
    expect(p.trace.werkstoff!.some((s) => s.id === "W-G")).toBe(true);
    expect(p.G).toBeCloseTo(3300 / (2 * 1.37), 6);
    const a = computeStrength(repo, { ...base, materialId: "W082", kind: "torsion", sub: "T1", T: 10 });
    expect(a.warnings.join()).toContain("Schubmodul der Datenbank");
  });
});

describe("Diagrammdaten Blatt 3 (alphaKChart, woehlerChart)", () => {
  it("α_k-Kurvenschar: Werte identisch mit alphaK, Punkt auf seiner Kurve, monoton in r/t", () => {
    const g: NotchGeom = { kind: "absatz", d: 50, D: 60, t: 5, r: 2 };
    for (const c of C) {
      const ch = alphaKChart("absatz", c, g);
      expect(ch.log).toBe(true);
      const cur = ch.curves.find((k) => k.current)!;
      expect(cur.ratio).toBeCloseTo(1.2, 12);
      expect(ch.point!.alpha).toBe(alphaK(g, c).alpha);
      expect(ch.point!.x).toBeCloseTo(0.4, 12);
      for (const k of ch.curves) for (let i = 1; i < k.pts.length; i++) expect(k.pts[i]!.alpha).toBeLessThan(k.pts[i - 1]!.alpha);
      const p = cur.pts[37]!;
      expect(p.alpha).toBeCloseTo(alphaK({ kind: "absatz", d: 1, D: 1.2, t: 0.1, r: p.x * 0.1 }, c).alpha, 12);
    }
  });
  it("α_k-Kurvenschar: Parameter außerhalb der Standardreihe wird ergänzt, Querbohrung linear bis 0,4", () => {
    const ch = alphaKChart("nut", "b", { kind: "nut", d: 40, D: 50, t: 5, r: 1 });
    expect(ch.curves.filter((k) => k.current)).toHaveLength(1);
    expect(ch.curves.some((k) => Math.abs(k.ratio - 1.25) < 1e-12)).toBe(true);
    const b = alphaKChart("bohrung", "b", { kind: "bohrung", d: 30, D: 30, t: 3, r: 3 });
    expect(b.log).toBe(false);
    expect(b.xMax).toBe(0.4);
    expect(b.point!.x).toBeCloseTo(0.2, 12);
    expect(b.point!.alpha).toBe(alphaK({ kind: "bohrung", d: 30, D: 30, t: 3, r: 3 }, "b").alpha);
    expect(alphaKChart("absatz", "b", null).point).toBeNull();
  });
  it("Wöhlerdiagramm: Knick bei N_D, Dauerfestigkeit = σ_GA, gleiche Werte wie der Nachweis", () => {
    const r = computeStrength(repo, { ...base, fatigue: fat({ notch: { type: "absatz", D: 40, r: 2 }, N: 2e5 }) }).fatigue!;
    const w = woehlerChart(r)!;
    expect(w.typ).toBe("I");
    const s = w.series.find((x) => x.c === "b")!;
    const fc = r.comps.find((x) => x.c === "b")!;
    expect(s.GA).toBe(fc.GA);
    const atND = s.pts.find((p) => Math.abs(Math.log10(p.N) - 6) < 1e-9)!;
    expect(atND.s).toBeCloseTo(fc.GA!, 9);
    expect(s.pts[s.pts.length - 1]!.s).toBeCloseTo(fc.GA!, 9);
    for (let i = 1; i < s.pts.length; i++) expect(s.pts[i]!.s).toBeLessThanOrEqual(s.pts[i - 1]!.s + 1e-12);
    const p2 = s.pts.reduce((a, b) => (Math.abs(Math.log10(b.N / 2e5)) < Math.abs(Math.log10(a.N / 2e5)) ? b : a));
    expect(p2.s).toBeGreaterThan(fc.GA!);
    expect(fc.AK).not.toBeNull();
  });
});
