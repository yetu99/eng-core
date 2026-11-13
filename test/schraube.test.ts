/**
 * Schraubenverbindung (Modul verbindungen, eng-core 0.18.0): Fachdaten fd 1.3, Normteile mit Klasse A/B, Identitäten P-SV6,
 * P-SV7, P-SV9, P-SV10, Fehlerfälle P-SV11, Datenblatt, Auslegung. Literatur- und Gegenrechnungswerte stehen in golden.json
 * (verification/verbindungen.py, Abschnitt SV).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeBoltJoint, svRepo, jointDiagram, boltDatasheet, computeBoltUnpreloaded, partOf, threadOf, threadProps, gradeOf, pgOf, kefSuggest, engagementOf, embedOf,
  coneLayers, coneTan, frustum, plateResilience, fmZul, tighteningTorque, tighteningTorqueExact, svAllRequiredOk, shearRatioOf,
  FD_VERSION, FD_FILES, CORE_VERSION, moduleOfId, TRACE_GROUPS, type BoltJointInput,
} from "../src/index";
import { svFaelle, svFehlerfaelle, svBase, plate } from "../scripts/sv-faelle";
import { svJson } from "../scripts/sv-json";

const fall = (id: string): BoltJointInput => svFaelle.find((f) => f.id === id)!.inp;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("Fachdaten fd 1.3", () => {
  it("Stand, Zeilenzahlen, Version, Modul", () => {
    expect(CORE_VERSION).toBe("0.19.0");
    expect(FD_VERSION).toBe("fd 1.3.1");
    expect(["threads", "bolt_grades", "bolt_geometry", "clearance_holes", "counterbore", "sv_friction", "sv_mu_t", "sv_tightening", "sv_embed", "sv_pg", "sv_kef", "sv_shear", "sv_engagement"]
      .map((k) => FD_FILES[k]!.rows)).toEqual([33, 13, 89, 17, 29, 10, 18, 12, 6, 40, 96, 8, 40]);
    expect(moduleOfId("SV-FMZUL")).toBe("verbindungen");
    for (const g of ["kraft", "festigkeit", "schwingung", "pressung", "gleiten", "anziehen", "vorwahl"]) expect(TRACE_GROUPS.verbindungen).toContain(g);
  });
  it("verification/sv_faelle.json ist aktuell (npx tsx scripts/sv-json.ts)", () => {
    expect(readFileSync(new URL("../verification/sv_faelle.json", import.meta.url), "utf8")).toBe(svJson());
  });
  it("DIN 13-1 Grundprofil und Festigkeitsklassen (8.8: 640 bis M16, 660 darüber)", () => {
    for (const t of svRepo.threads.filter((x) => x.series === "regel")) {
      expect(Math.abs(t.d2_mm - (t.d_mm - 0.64952 * t.p_mm))).toBeLessThan(1.5e-3);
      expect(Math.abs(t.d3_mm - (t.d_mm - 1.22687 * t.p_mm))).toBeLessThan(1.5e-3);
    }
    expect(gradeOf(svRepo, "8.8", 16)!.yield_min_mpa).toBe(640);
    expect(gradeOf(svRepo, "8.8", 20)!.yield_min_mpa).toBe(660);
    expect(gradeOf(svRepo, "9.8", 20)).toBeNull();
  });
  it("Normteil nach Norm, d, Länge mit Produktklasse A/B (B-sv12), fehlende Normteile (B-sv9)", () => {
    expect(partOf(svRepo, "ISO 4014", 16, 150)!.product_class).toBe("A");
    expect(partOf(svRepo, "ISO 4014", 16, 160)!.product_class).toBe("B");
    expect(partOf(svRepo, "ISO 4014", 16, 160)!.dw_min_mm).toBe(22);
    expect(partOf(svRepo, "ISO 4017", 24, 200)!.id).toBe("4017-M24-B");
    expect(partOf(svRepo, "ISO 4032", 4)).toBeNull();
    expect(partOf(svRepo, "ISO 4762", 18)).toBeNull();
    const r = computeBoltJoint(svRepo, svBase({ d: 18, norm: "ISO 4762" }));
    expect(r.errors[0]).toMatch(/B-sv9/);
  });
  it("p_G-Zuordnung (O-sv1), τ_B gesperrt (PG04), l_e angehoben (B-sv13), Setzbeträge, τ_B/R_m", () => {
    expect(pgOf(svRepo, "W038", null)!.id).toBe("PG24");
    expect(pgOf(svRepo, "W999", "Gusseisen, lamellar")!.id).toBe("PG18");
    expect(svRepo.pg.find((p) => p.id === "PG04")!.tau_b_mpa).toBeNull();
    const le = engagementOf(svRepo, "AlMg-Leg.", 330, "10.9", "regel")!;
    expect([le.le_d_max, le.le_d_print_max]).toEqual([2, 1.4]);
    expect(engagementOf(svRepo, "AlMg-Leg.", 330, "12.9", "regel")).toBeNull();
    const e = embedOf(svRepo, "lt10", "schub")!; expect(e.f_thread_um + 2 * e.f_bearing_um + e.f_interface_um).toBe(11);   // VDI B2
    expect(shearRatioOf(svRepo, "A2-70")!.tau_rm).toBe(0.72);
  });
  it("Krafteinleitung VDI Tab. 2: Stützstellen exakt, B1 SV 4 a_k/h 0,093 → 0,3456 (O-sv3)", () => {
    for (const k of svRepo.kef) expect(kefSuggest(svRepo, k.sv_type, k.la_h, k.ak_h)).toBeCloseTo(k.n, 12);
    expect(kefSuggest(svRepo, 4, 0, 0.093)).toBeCloseTo(0.3456, 4);
    expect(kefSuggest(svRepo, 4, 0.5, 0.9)).toBeCloseTo(svRepo.kef.find((k) => k.sv_type === 4 && k.la_h === 0.3 && k.ak_h === 0.5)!.n, 12);
    expect(kefSuggest(svRepo, 7, 0, 0)).toBeNull();
  });
});

describe("Identitäten (P-SV6, P-SV7, P-SV9, P-SV10)", () => {
  it("P-SV6 Teilkörper mit gleichem E = ein Körper; Kegel und Hülse an D_A,Gr = Kegel; Kegelstumpf additiv", () => {
    for (const w of [1, 2] as const) for (const DA of [15, 30, 80]) {
      const t = coneTan(w === 2 ? "ESV" : "DSV", 42, 21, DA);
      const one = coneLayers([{ h: 42, E: 205000 }], 21, 13.5, DA, w, t)[0]!;
      const three = coneLayers([{ h: 12, E: 205000 }, { h: 20, E: 205000 }, { h: 10, E: 205000 }], 21, 13.5, DA, w, t).reduce((a, b) => a + b, 0);
      expect(rel(three, one)).toBeLessThan(1e-12);
    }
    const t = 0.55, DAGr = 21 + 42 * t;   // DSV, w = 1
    const atGr = coneLayers([{ h: 42, E: 205000 }], 21, 13.5, DAGr, 1, t)[0]!, cone = 2 * frustum(21, 21 + 42 * t, 13.5, 205000, t);
    expect(rel(atGr, cone)).toBeLessThan(1e-12);
    expect(rel(frustum(21, 30, 13.5, 2e5, t) + frustum(30, 40, 13.5, 2e5, t), frustum(21, 40, 13.5, 2e5, t))).toBeLessThan(1e-12);
  });
  it("P-SV6 Rechenweg Kegel (40) = Teilkörper-Summe; Fall Hülse und Kegel und Hülse", () => {
    for (const id of ["P-SV3", "P-SV4", "P-SV15", "P-SV17", "P-SV14"]) {
      const r = computeBoltJoint(svRepo, fall(id)), s = r.trace.nachgiebigkeit!.find((x) => x.id.startsWith("SV-DP-") && x.id !== "SV-DP-HZ")!;
      expect(rel(s.value, r.plate!.dPK), id).toBeLessThan(1e-12);
    }
    expect(computeBoltJoint(svRepo, fall("P-SV15")).plate!.case).toBe("huelse");
    expect(computeBoltJoint(svRepo, fall("P-SV17")).plate!.case).toBe("kegel-huelse");
    expect(computeBoltJoint(svRepo, fall("P-SV14")).trace.nachgiebigkeit!.some((x) => x.id === "SV-DP-T")).toBe(true);
  });
  it("P-SV7 M_A (R13/1) gegen exakt (8.24): M4 bis M39, μ 0,08 bis 0,16 unter 0,5 %; B2 0,11 %", () => {
    let worst = 0;
    for (const t of svRepo.threads.filter((x) => x.series === "regel")) {
      const T = threadProps(t), p = partOf(svRepo, "ISO 4014", T.d)!, DKm = (p.dw_min_mm! + svRepo.holes.find((h) => h.d_mm === T.d)!.medium_mm) / 2;
      for (const m of [0.08, 0.1, 0.12, 0.14, 0.16]) worst = Math.max(worst, Math.abs(tighteningTorque(1e4, T, m, DKm, m) / tighteningTorqueExact(1e4, T, m, DKm, m).MA - 1));
    }
    expect(worst).toBeLessThan(5e-3);
    const T16 = threadProps(threadOf(svRepo, 16)!);
    expect(Math.abs(tighteningTorque(118800, T16, 0.12, 19.75, 0.12) / tighteningTorqueExact(118800, T16, 0.12, 19.75, 0.12).MA - 1)).toBeLessThan(2e-3);
  });
  it("P-SV9 Verspannungsschaubild: Pfeile F_SA, F_PA, F_KR exakt (G1)", () => {
    for (const id of ["P-SV1", "P-SV3", "P-SV12", "P-SV14"]) {
      const r = computeBoltJoint(svRepo, fall(id)), D = jointDiagram(r)!, op = D.operating[0]!;
      const dx = op.x - D.states[2]!.fS;
      expect(Math.abs(dx / D.dS - r.FSAmax) / r.FAmax, id).toBeLessThan(1e-12);
      expect(Math.abs(dx / D.dPn - r.FPAmax) / r.FAmax, id).toBeLessThan(1e-12);
      expect(Math.abs(op.FKR - r.FKRmin) / r.FAmax, id).toBeLessThan(1e-12);
      expect(D.lines.find((l) => l.key === "FMmax")!.pts[1]).toEqual([r.FMmax * r.dS, r.FMmax]);
    }
  });
  it("P-SV10 Kegel gegen Hohlzylinder (B-sv4): ESV Kegel kleiner, DSV Kegel größer", () => {
    const b1 = computeBoltJoint(svRepo, fall("P-SV3")).plate!, b2 = computeBoltJoint(svRepo, fall("P-SV4")).plate!, r81 = computeBoltJoint(svRepo, fall("P-SV1")).plate!;
    expect([b1.dPK, b1.dPHZ!, b2.dPK, b2.dPHZ!, r81.dPK, r81.dPHZ!].map((x) => +(x * 1e6).toFixed(3))).toEqual([0.363, 0.271, 0.781, 0.563, 0.2, 0.254]);
  });
  it("F_M,zul (R7/2): ν linear, μ fallend; Plattenmodell-Schalter ändert nur δ_P", () => {
    const T = threadProps(threadOf(svRepo, 12)!);
    expect(rel(fmZul(T, T.dS, 1, 940, 0.1), fmZul(T, T.dS, 0.9, 940, 0.1) / 0.9)).toBeLessThan(1e-12);
    expect(fmZul(T, T.dS, 0.9, 940, 0.14)).toBeLessThan(fmZul(T, T.dS, 0.9, 940, 0.1));
    const a = computeBoltJoint(svRepo, fall("P-SV1")), b = computeBoltJoint(svRepo, { ...fall("P-SV1"), plateModel: "kegel" });
    expect(a.dS).toBe(b.dS); expect(a.FMzul).toBe(b.FMzul); expect(b.dP).toBe(a.plate!.dPK);
    const out: never[] = []; expect(plateResilience([plate(42, 205000)], 21.115, 13.5, 80, 80, "DSV", "kegel", out).case).toBe("kegel");
  });
});

describe("Literaturfälle (Kernwerte, Rundung der Quelle)", () => {
  it("Roloff Bsp. 8.1, 8.3, EKB, VDI B1, B2", () => {
    const r1 = computeBoltJoint(svRepo, fall("P-SV1"));
    expect([r1.dS * 1e6, r1.plate!.Aers!, r1.dP * 1e6, r1.PhiK, r1.FZ, r1.FMmax].map((x, i) => rel(x, [2.029, 982, 0.254, 0.111, 4820, 87000][i]!) < 5e-3)).toEqual(Array(6).fill(true));
    const r2 = computeBoltJoint(svRepo, fall("P-SV2"));
    expect(rel(r2.FQ, 1870)).toBeLessThan(1e-3); expect(rel(r2.AsMin!, 34.5)).toBeLessThan(3e-3); expect(rel(r2.FMmax, 17310)).toBeLessThan(2e-3);
    const r3 = computeBoltJoint(svRepo, fall("P-SV3"));
    expect(rel(r3.FMzul, 64800)).toBeLessThan(3e-3); expect(rel(r3.FMmax, 48458)).toBeLessThan(1e-3); expect(r3.mEff).toBeCloseTo(14.5, 12); expect(rel(r3.kefN!, 0.3456)).toBeLessThan(2e-3);
    expect(r3.pB).toBeLessThan(r3.pM);   // VDI B1 S. 136: p_B entfällt, da F_Z > Φ_n·F_A,max
    const r4 = computeBoltJoint(svRepo, fall("P-SV4"));
    expect(r4.fZ).toBeCloseTo(0.011, 15); expect(r4.FKerf).toBeCloseTo(56000, 8); expect(rel(r4.SG!, 1.26)).toBeLessThan(5e-3); expect(rel(r4.MA, 302000)).toBeLessThan(1e-2);
    const r5 = computeBoltJoint(svRepo, fall("P-SV5"));
    expect(r5.checks.find((c) => c.key === "montage")!.ok).toBe(false);
    expect(r5.FMmax).toBeGreaterThan(r5.FMzul);
  });
});

describe("Auslegung, Datenblatt, nicht vorgespannt", () => {
  it("Aufgabe B: kleinste gültige Schraube, Reihenfolge nach d, dann Klasse; Übernahme rechnet gültig nach", () => {
    const r = computeBoltJoint(svRepo, fall("P-SV12"));
    const v = r.candidates.filter((c) => c.valid);
    expect(v[0]).toMatchObject({ d: 14, grade: "8.8", status: "gültig" });
    expect(r.candidates.map((c) => c.d)).toEqual([...r.candidates.map((c) => c.d)].sort((a, b) => a - b));
    expect(r.trace.vorwahl!.find((s) => s.id === "SV-WAHL")!.value).toBe(14);
    expect(r.candidates.find((c) => c.d === 12 && c.grade === "8.8")!).toMatchObject({ status: "ungültig" });
    const a = computeBoltJoint(svRepo, { ...fall("P-SV12"), task: "A", d: 14, grade: "8.8" });
    expect(svAllRequiredOk(a)).toBe(true);
    expect(r.candidates.find((c) => c.d === 30)!.error).toMatch(/ISO 4017 Ganzgewinde/);
  });
  it("Datenblatt M16 ISO 4014 (N2): Maße mit Herkunft, M_A 10.9 μ 0,12 ≈ TB 8-14 (302 N·m, B-sv3)", () => {
    const ds = boltDatasheet(svRepo, 16, "ISO 4014", { length: 80 })!;
    expect([ds.head!.s_mm, ds.head!.k_mm, ds.b, ds.nut!.m_max_mm, ds.washer!.d2_max_mm, ds.holes.mittel, ds.counterbore!.dc_r1_mm]).toEqual([24, 10, 38, 14.8, 30, 17.5, 40]);
    const g = ds.grades.find((x) => x.grade === "10.9")!.rows.find((x) => x.mu === 0.12)!;
    expect(rel(g.MA, 302000)).toBeLessThan(5e-3); expect(rel(g.FMzul, 119000)).toBeLessThan(5e-3);
    expect(ds.sources.map((s) => s.part)).toEqual(["Gewinde", "Schraube", "Mutter", "Scheibe", "Senkung"]);
    expect(boltDatasheet(svRepo, 3, "ISO 4014")).toBeNull();
  });
  it("SV-NV nicht vorgespannt (Roloff (8.38))", () => {
    const r = computeBoltUnpreloaded(svRepo, 20000, "8.8", false);
    expect(r.AsErf).toBeCloseTo(39.0625, 12); expect(r.d).toBe(10);
    expect(computeBoltUnpreloaded(svRepo, 0, "8.8", false).errors.length).toBe(1);
  });
});

describe("Fehler und Hinweise (P-SV11)", () => {
  it("jeder Fehlerfall meldet einen Fehler, Klasse unter 8.8 einen Hinweis", () => {
    const want: Record<string, RegExp> = { a: /M4 bis M39/, b: /d_W muss größer als die Bohrung/, c: /D_A muss größer als die Bohrung/, d: /h > 0/, e: /Schaftlänge/, f: /Krafteinleitungsfaktor/,
      g: /Reibungszahlen/, h: /Anziehfaktor/, i: /F_Kerf < 0/, k: /F_A,min/ };
    for (const f of svFehlerfaelle) {
      const r = computeBoltJoint(svRepo, f.inp), k = f.id.slice(-1);
      if (k === "j") { expect(r.errors).toEqual([]); expect(r.warnings.some((w) => /unter 8\.8/.test(w))).toBe(true); continue; }
      expect(r.errors.length, f.id).toBeGreaterThan(0); expect(r.errors[0], f.id).toMatch(want[k]!);
    }
  });
  it("Temperatur kein Pflichtfeld: leer ergibt ΔF′_Vth = 0 und den Vermerk im Rechenweg (S11)", () => {
    const r = computeBoltJoint(svRepo, fall("P-SV4"));
    expect(r.dFVth).toBe(0);
    expect(r.trace.vorspannung!.find((s) => s.id === "SV-FMMIN")!.subst).toMatch(/Temperatur nicht berücksichtigt/);
    expect(computeBoltJoint(svRepo, fall("P-SV13")).trace.vorspannung!.some((s) => s.id === "SV-OPT-VTH")).toBe(true);
  });
  it("Optionen: nichtrostend ohne σ_A von Hand ergibt keinen Dauerhaltbarkeitswert", () => {
    const r = computeBoltJoint(svRepo, { ...fall("P-SV16"), sigmaA: null });
    expect(r.SD).toBeNull(); expect(r.checks.find((c) => c.key === "dauer")!.ok).toBeNull();
  });
});

describe("Freigabe Runde 1 (09.11.2026): U3 Scheiben, U8 nicht bewertbar, SV-PHIK", () => {
  it("U3: mit Scheibe zwei Auflagen je Seite, maßgebend die kleinere Sicherheit", () => {
    const r = computeBoltJoint(svRepo, fall("P-SV20"));
    expect(r.contacts.map((c) => c.label)).toEqual(["Kopf auf Scheibe", "Scheibe auf Platte", "Mutter auf Scheibe", "Scheibe auf Platte"]);
    const w = svRepo.geometry.find((g) => g.norm === "ISO 7089" && g.d_mm === 12)!;
    expect(r.contacts[0]!.Ap).toBeCloseTo(Math.PI / 4 * (16.63 ** 2 - w.d1_min_mm! ** 2), 10);
    expect(r.SpHead).toBe(Math.min(r.contacts[0]!.Sp!, r.contacts[1]!.Sp!));
    expect(r.checks.find((c) => c.key === "pressung-kopf")!.text).toMatch(/Kopf auf Scheibe/);
  });
  it("0.18.1 (F2): Kennwert p zeigt die maßgebende Auflage (kleinste S_p), ohne p_G die größte Pressung", () => {
    const r = computeBoltJoint(svRepo, fall("P-SV20"));
    const p = r.kpis.find((k) => k.key === "p")!;
    expect(p.label).toBe("Flächenpressung maßgebende Auflage");
    expect(p.value).toBe(r.contacts[0]!.pMax);
    expect(p.value).toBeGreaterThan(r.contacts[1]!.pMax);
    const n = computeBoltJoint(svRepo, fall("P-SV1"));
    expect(n.kpis.find((k) => k.key === "p")!.value).toBe(Math.max(...n.contacts.map((c) => c.pMax)));
  });
  it("U8: fehlendes p_G der Scheibe: Nachweis nicht bewertbar, Auslegung bricht mit Hinweis ab", () => {
    const r = computeBoltJoint(svRepo, fall("P-SV19"));
    expect(r.candidates).toEqual([]);
    expect(r.warnings.some((x) => x.startsWith("Auslegung abgebrochen: p_G fehlt (Scheibe ISO 7089)"))).toBe(true);
    expect(r.checks.find((c) => c.key === "pressung-kopf")!.state).toBe("nicht bewertbar");
    expect(r.trace.vorwahl!.find((s) => s.id === "SV-WAHL")!.subst).toMatch(/abgebrochen/);
  });
  it("U8: l_e nur bei ESV Pflicht; fehlendes l_e macht die Größe nicht bewertbar", () => {
    expect(computeBoltJoint(svRepo, fall("P-SV4")).checks.find((c) => c.key === "einschraubtiefe")!.required).toBe(false);
    const r = computeBoltJoint(svRepo, { ...fall("P-SV13"), task: "B" });
    const c = r.candidates.filter((x) => x.grade === "12.9" && x.status === "nicht bewertbar");
    expect(c.length).toBeGreaterThan(0); expect(c[0]!.reason).toMatch(/l_e/);
  });
  it("SV-PHIK: Formel nennt beide Wege, Beispiel P-SV1 zeigt Roloff und VDI", () => {
    const s = computeBoltJoint(svRepo, fall("P-SV1")).trace.kraft!.find((x) => x.id === "SV-PHIK")!;
    expect(s.formula).toMatch(/Roloff \(8\.17\): δ_PZu = 0/);
    expect(s.subst).toMatch(/= 0,11134 \(VDI-Weg mit δ_PZu = δ_M = 0,12505: Φ_K = 0,16611\)/);
  });
  it("U2: Temperaturzunahme geht nicht in F_M,min ein; ESV-Länge aus l_e + 2·P erfüllt die Einschraubtiefe", () => {
    const r = computeBoltJoint(svRepo, fall("P-SV13"));
    expect(r.dFVth).toBeLessThan(0);
    expect(r.FMmin).toBeCloseTo(r.FKerf + (1 - r.PhiN) * r.FAmax + r.FZ, 9);
    expect(r.checks.find((c) => c.key === "einschraubtiefe")!.ok).toBe(true);
  });
});


describe("Freigabe Runde 2 (09.11.2026): SV-N-P ausgeschrieben, SV-WAHL alle Treffer mit Längenregel", () => {
  it("SV-N-P P-SV3: p_M, p_B, maßgebender Zustand und S_p im Beispiel", () => {
    const s = computeBoltJoint(svRepo, fall("P-SV3")).trace.nachweis!.find((x) => x.id === "SV-N-P")!;
    expect(s.formula).toMatch(/S_p = p_G\/p_max/);
    expect(s.subst).toMatch(/p_G 1300 N\/mm², Kolben 16MnCr5\): p_M = 64900\/90,02 = 720,9, p_B = .* = 709,7 N\/mm²; p_max = 720,9 N\/mm² \(Montage maßgebend\); S_p = 1300\/720,9 = 1,803/);
  });
  it("SV-WAHL listet alle gültigen Schrauben mit Länge und Bedarf", () => {
    const r = computeBoltJoint(svRepo, fall("P-SV12")), s = r.trace.vorwahl!.find((x) => x.id === "SV-WAHL")!;
    const v = r.candidates.filter((c) => c.valid);
    expect((s.subst.match(/ \(Bedarf /g) ?? []).length).toBe(v.length);
    const m18 = r.candidates.find((c) => c.d === 18 && c.grade === "8.8")!;
    expect(m18.lNeed).toBeCloseTo(40 + 15.8 + 5, 12);
    expect(m18.length).toBe(svRepo.geometry.find((g) => g.id === "4014-M18")!.l_series.find((l) => l >= m18.lNeed!));
  });
});

describe("fd 1.3.1 (B-sv15): Normlängen nach Normtabelle", () => {
  it("ISO 4014 M18 ab 70 mm, Auslegung P-SV12 wählt M18 × 70; ISO 4017 M16 ab 30 mm", () => {
    expect(partOf(svRepo, "ISO 4014", 18, 100)!.l_series[0]).toBe(70);
    expect(partOf(svRepo, "ISO 4014", 33, 200)!.l_series[0]).toBe(120);
    expect(partOf(svRepo, "ISO 4017", 16, 100)!.l_series[0]).toBe(30);
    const r = computeBoltJoint(svRepo, fall("P-SV12"));
    expect(r.candidates.find((c) => c.d === 18 && c.grade === "8.8")!.length).toBe(70);
    expect(r.candidates.find((c) => c.d === 16 && c.grade === "8.8")!.length).toBe(65);
  });
});
