/** Pressverband (Modul verbindungen, eng-core 0.17.0): Fachdaten fd 1.2, Passung, Identitäten P-PV10 bis P-PV15, WDB-Zuordnung. */
import { describe, expect, it } from "vitest";
import {
  computePressFit, pvRepo, fitLimits, selectFits, passungstafel, pressFitProfile, pvK, pvMaterialFromWdb, pvFrictionDefault, hubGroupOf, zetaAnnexB, solveZeta,
  FD_VERSION, FD_FILES, CORE_VERSION, moduleOfId, TRACE_GROUPS, type PressFitInput,
} from "../src/index";
import { repo } from "../src/data";
import { pvFaelle, pvFehlerfaelle, U_A1 } from "../scripts/pv-faelle";

const fall = (id: string): PressFitInput => pvFaelle.find((f) => f.id === id)!.inp;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("Fachdaten fd 1.2 (im Abzug fd 1.3)", () => {
  it("Stand, Zeilenzahlen, Version", () => {
    expect(CORE_VERSION).toBe("0.18.0");
    expect(FD_VERSION).toBe("fd 1.3.1");
    expect(["fit_it", "fit_shaft_dev", "pv_friction", "pv_groups", "pv_join_temp", "pv_coolants", "pv_rz", "pv_chamfer"].map((k) => FD_FILES[k]!.rows))
      .toEqual([13, 25, 28, 15, 4, 2, 3, 8]);
    expect(pvRepo.shaftDev.every((r) => typeof r.d_over_mm === "number")).toBe(true);   // Abzug mit Spalte x vollständig (sql/02_fd_alias.sql)
    expect(moduleOfId("PV-FIT-SEL")).toBe("verbindungen");
    expect(TRACE_GROUPS.verbindungen).toContain("plastisch");
  });
});

describe("Passung ISO 286-1 (P-PV9, Passungstafel)", () => {
  it("⌀160 H7/u6 und ⌀80 H6/r6", () => {
    const a = fitLimits(pvRepo, 160, { kind: "iso", hole: 7, field: "u", grade: 6 }), b = fitLimits(pvRepo, 80, { kind: "iso", hole: 6, field: "r", grade: 6 });
    expect(a).toMatchObject({ ES: 0.04, ei: 0.19 }); expect(typeof a !== "string" && a.es).toBeCloseTo(0.215, 12);
    expect(b).toMatchObject({ ES: 0.019, ei: 0.043 }); expect(typeof b !== "string" && b.Ug).toBeCloseTo(0.062, 12);
    expect(fitLimits(pvRepo, 20, { kind: "iso", hole: 7, field: "t", grade: 6 })).toMatch(/nicht definiert/);
    expect(fitLimits(pvRepo, 600, { kind: "iso", hole: 7, field: "s", grade: 6 })).toMatch(/500/);
    expect(fitLimits(pvRepo, 3, { kind: "iso", hole: 7, field: "p", grade: 6 })).toMatchObject({ ei: 0.006 });   // 3 mm gehört zur Zeile bis 3
  });
  it("Passungstafel ⌀80: IT6 19 µm, r6 +43/+62, Lagebild H und p bis z nutzbar", () => {
    const t = passungstafel(pvRepo, 80, { kind: "iso", hole: 6, field: "r", grade: 6 });
    expect(t.range).toEqual([50, 80]);
    expect(t.it.map((x) => x.um)).toEqual([2, 3, 5, 8, 13, 19, 30, 46, 74, 120, 190]);
    expect(t.fit).toMatchObject({ label: "H6/r6", hole: [0, 19], shaft: [43, 62], Uk: 24, Ug: 62 });
    expect(t.lage.holes.filter((h) => h.usable).map((h) => h.name)).toEqual(["H"]);
    expect(t.lage.shafts.filter((h) => h.usable).map((h) => h.name)).toEqual(["p", "r", "s", "t", "u", "v", "x", "y", "z"]);
  });
  it("Vorschlag Roloff Bsp. 12.2: H6/r6 vor H6/r5 (ISO-Paarung)", () => {
    const r = computePressFit(pvRepo, fall("P-PV8"));
    expect(r.candidates.slice(0, 2).map((c) => [c.label, c.iso])).toEqual([["H6/r6", false], ["H6/r5", true]]);
    expect(r.candidates[0]!.dist * 1e3).toBeCloseTo(0.28, 2);
    const l = selectFits(pvRepo, 80, r.Uu!, r.Uo!);
    expect(l.every((c) => c.Uk >= r.Uu! && c.Ug <= r.Uo!)).toBe(true);
  });
});

describe("Identitäten und Rundläufe", () => {
  it("P-PV10 Fugenspannungen gegen lame() (A.3, U 65 µm)", () => {
    const inp = fall("P-PV4"), r = computePressFit(pvRepo, inp), pr = pressFitProfile(inp, r.max!.p, 10);
    expect(Math.abs(pr.hub[0]!.st - r.stress!.tAi)).toBeLessThan(1e-12 * r.max!.p);
    expect(Math.abs(pr.hub[10]!.st - r.stress!.tAa)).toBeLessThan(1e-12 * r.max!.p);
    expect(Math.abs(pr.shaft[0]!.st - r.stress!.tIi)).toBeLessThan(1e-12 * r.max!.p);
    expect(Math.abs(pr.shaft[10]!.st - r.stress!.tIa)).toBeLessThan(1e-12 * r.max!.p);
    expect(rel(2 * pr.hub[10]!.u, r.dDaA!)).toBeLessThan(1e-12);   // P-PV14
  });
  it("P-PV11 Gl. (19), (25) gegen K-Weg bei gleichen E, μ und Vollwelle", () => {
    const QA = 0.5, E = 215000, K = pvK(E, E, 0.3, 0.3, QA, 0);
    expect(rel(K * 90 / E, 2 * 90 / ((1 - QA * QA) * E))).toBeLessThan(1e-12);
    expect(rel(1.4e-3 * E / K, (1 - QA * QA) / 2 * E * 1.4e-3)).toBeLessThan(1e-12);
  });
  it("P-PV12 Rundlauf p → U → p (elastisch und elastisch-plastisch)", () => {
    const b = computePressFit(pvRepo, fall("P-PV1"));
    const a = computePressFit(pvRepo, { ...fall("P-PV1"), task: "A", fit: { kind: "manual", Uk: b.Uu!, Ug: b.Uu! } });
    expect(rel(a.min!.p, 90)).toBeLessThan(1e-12);
    expect(rel(U_A1, b.Uu!)).toBeLessThan(1e-12);
    const be = computePressFit(pvRepo, fall("P-PV5"));
    const ae = computePressFit(pvRepo, { ...fall("P-PV5"), task: "A", fit: { kind: "manual", Uk: be.Uu!, Ug: be.Uu! } });
    expect(ae.min!.state).toBe("elastisch-plastisch");
    expect(rel(ae.min!.p, 220)).toBeLessThan(1e-9);
  });
  it("DIN Anhang B: Iteration A.5 und A.6 gegen Tab. A.1 und A.2", () => {
    const b5 = zetaAnnexB(0.5, 220, 400), b6 = zetaAnnexB(0.5, 256.2, 400);   // A.6 mit dem gedruckten p = 256,2 N/mm²
    b5.steps.forEach((z, i) => expect(Math.abs(z - [1.1351, 1.1529, 1.1532][i]!)).toBeLessThan(1e-4));
    b6.steps.forEach((z, i) => expect(Math.abs(z - [1.2396, 1.3039, 1.3081, 1.3081][i]!)).toBeLessThan(1e-4));
    expect(Math.abs(solveZeta(0.5, 220, 400)! - b5.zeta)).toBeLessThan(1e-3);
  });
});

describe("Literaturfälle (Kernwerte, Rundung der Quelle)", () => {
  it("DIN A.1 bis A.7, Roloff Bsp. 12.2", () => {
    const r1 = computePressFit(pvRepo, fall("P-PV1")); expect(rel(r1.pzulA, 118.1)).toBeLessThan(1e-3); expect(rel(r1.Uu! * 1e3, 60.61)).toBeLessThan(1e-3);
    expect(rel(computePressFit(pvRepo, fall("P-PV2")).max!.p, 113.2)).toBeLessThan(1e-3);
    const r3 = computePressFit(pvRepo, fall("P-PV3")); expect(rel(r3.K, 1.936)).toBeLessThan(1e-3); expect(rel(r3.pzulI, 138.6)).toBeLessThan(1e-3);
    expect(rel(computePressFit(pvRepo, fall("P-PV4")).max!.p, 43.5)).toBeLessThan(2e-3);
    const r6 = computePressFit(pvRepo, fall("P-PV6")); expect(r6.max!.state).toBe("elastisch-plastisch"); expect(rel(r6.max!.qPA!, 0.237)).toBeLessThan(3e-3);
    const r7 = computePressFit(pvRepo, fall("P-PV7b")); expect(rel(r7.spin!.uab / 1e3, 192.5)).toBeLessThan(1e-3); expect(rel(r7.spin!.pn, 63.4)).toBeLessThan(1e-3);
    const r8 = computePressFit(pvRepo, fall("P-PV8"));
    expect([r8.K, r8.perf!, r8.Uu! * 1e3, r8.pzulA, r8.Uo! * 1e3].map((x) => +x.toFixed(2))).toEqual([2.06, 9.73, 19.01, 42.75, 66.43]);
    expect(r8.join!.thetaA).toBeCloseTo(136.25, 10);
  });
  it("Fügen: Fasenlänge Tab. 6 bzw. ∛D_F, Unterkühlen mit α kalt", () => {
    expect(computePressFit(pvRepo, fall("P-PV16")).join!.le).toBeCloseTo(Math.cbrt(40), 12);
    expect(computePressFit(pvRepo, fall("P-PV17")).join!.le).toBe(5);
    const r9 = computePressFit(pvRepo, fall("P-PV9"));
    expect(r9.join!.thetaA).toBeCloseTo(20 + (0.215 + 0.16) / (11e-6 * 160) + 8.5 / 11 * (-195.8 - 20), 9);
    expect(r9.checks.find((c) => c.key === "fuegetemperatur")!.ok).toBe(true);
  });
});

describe("Fehler und Hinweise (P-PV15)", () => {
  it("jeder Fehlerfall meldet einen Fehler oder einen Hinweis", () => {
    for (const f of pvFehlerfaelle) {
      const r = computePressFit(pvRepo, f.inp);
      expect(r.errors.length + r.warnings.length, f.id).toBeGreaterThan(0);
    }
    expect(computePressFit(pvRepo, pvFehlerfaelle.find((f) => f.id === "P-PV15h")!.inp).warnings[0]).toMatch(/elastisch-plastisch nicht anwendbar/);
    expect(computePressFit(pvRepo, pvFehlerfaelle.find((f) => f.id === "P-PV15i")!.inp).spin).toBeNull();
  });
  it("Warnung plastisch immer sichtbar (PV-N-ELAST), auch ohne Option", () => {
    const r = computePressFit(pvRepo, { ...fall("P-PV6"), plastic: false });
    expect(r.max!.state).toBe("unzulässig");
    expect(r.trace.nachweis!.find((s) => s.id === "PV-N-ELAST")!.value).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.startsWith("Plastisch: Nabe"))).toBe(true);
  });
});

describe("Werkstoffe aus der WDB (P7, O-pv1) und Haftbeiwerte (P8)", () => {
  it("Zuordnung zuerst über die Werkstoff-ID, dann über die Unterklasse", () => {
    const gjl = pvMaterialFromWdb(repo, pvRepo, "W029")!; expect(gjl.group?.id).toBe("PG07"); expect(gjl.mat.brittle).toBe(true); expect(gjl.mat.alphaCool).toBeCloseTo(8e-6, 15);
    expect(pvMaterialFromWdb(repo, pvRepo, "W040")!.group?.id).toBe("PG03");
    expect(pvMaterialFromWdb(repo, pvRepo, "W033")!.group?.id).toBe("PG02");
    expect(pvMaterialFromWdb(repo, pvRepo, "W042")!.group).toBeNull();   // Al-Guss ohne Ersatzgruppe (Prüfliste fd 1.2)
    expect(pvMaterialFromWdb(repo, pvRepo, "W015")!.group).toBeNull();   // nichtrostend: keine Zeile
    const s = pvMaterialFromWdb(repo, pvRepo, "W001")!; expect(s.group?.id).toBe("PG10"); expect(s.mat.E).toBeGreaterThan(190000); expect(s.mat.brittle).toBe(false);
    expect(hubGroupOf("Gusseisen, lamellar")).toBe("Gusseisen lamellar");
  });
  it("Vorbelegung: unterer Wert, bei mehreren Zeilen der kleinere", () => {
    expect(pvFrictionDefault(pvRepo, "quer", "Gusseisen lamellar").nuR).toBe(0.16);
    expect(pvFrictionDefault(pvRepo, "quer", "Stahl").nuR).toBe(0.14);
    expect(pvFrictionDefault(pvRepo, "laengs", "Stahl")).toMatchObject({ nuR: 0.08, nuL: 0.1 });
    expect(pvFrictionDefault(pvRepo, "quer", "Magnesium").nuR).toBe(0.1);
  });
});

describe("Haberhauer/Bodenstein 17. Aufl. 2014, S. 137 f., 2. Beispiel (Plausibilität)", () => {
  it("Topfscheibe EN-GJL-200 auf E295, ⌀50 H7/s6: p_k 5,7 und p_g 29 N/mm² mit der Glättung 0,8·(Rz_A + Rz_I) des Buchs (DIN 7190:2001)", () => {
    // Buch: ΔU = 0,8·(6 + 4) = 8 µm; hier nachgestellt mit 0,4·(Rz_A + Rz_I) = 8 µm (Rz 10/10). Moment mit F_a 0,4 kN, μ 0,1, b 60 mm: 134 N·m.
    const r = computePressFit(pvRepo, { ...fall("P-PV16"), DF: 50, DaA: 70, lF: 60, rzA: { kind: "rz", Rz: 10 }, rzI: { kind: "rz", Rz: 10 }, fit: { kind: "iso", hole: 7, field: "s", grade: 6 },
      hub: { ...fall("P-PV8").hub, E: 105000, mu: 0.25, Rm: 200 }, shaft: { ...fall("P-PV8").shaft, E: 210000, mu: 0.3 }, T: 0, Fax: 400, Sr: 1, nuR: 0.1, joining: { kind: "quer", thetaR: 20, thetaI: 20, clearance: "din", thetaAzul: null } });
    expect([r.fit!.Uk * 1e3, r.fit!.Ug * 1e3].map((x) => Math.round(x))).toEqual([18, 59]);
    expect(rel(r.min!.p, 5.7)).toBeLessThan(0.02);
    expect(rel(r.max!.p, 29)).toBeLessThan(0.02);
    const Tbook = 50 / 2 * Math.sqrt((r.min!.p * 0.1 * Math.PI * 50 * 60) ** 2 - 400 ** 2) / 1e3;   // Gl. (2.12) des Buchs
    expect(rel(Tbook, 134)).toBeLessThan(0.02);
  });
});

describe("Formelfreigabe 0.17.0: Rutschen bei Drehzahl mit p_n (PV-SR, PV-N-SR)", () => {
  it("A.7 bei 10 000 1/min: S_r,ist = p_n·A_F·ν/(K_A·F_res) = 16,36 statt 17,67 im Stillstand", () => {
    const r = computePressFit(pvRepo, fall("P-PV7a"));
    expect(rel(r.spin!.pn, 83.34)).toBeLessThan(1e-3);
    expect(rel(r.SrIst!, 16.36)).toBeLessThan(1e-3);
    expect(rel(r.SrIst! / (r.spin!.pn * r.AF * 0.1 / 4000), 1)).toBeLessThan(1e-12);
    const s0 = computePressFit(pvRepo, { ...fall("P-PV7a"), spinN: null });
    expect(rel(s0.SrIst!, 17.6715)).toBeLessThan(1e-4);
  });
});
