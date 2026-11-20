/**
 * Modul elektrik (eng-core 0.19.0, Werkzeug Stromwerk): Konventionen, Hinweise und Grenzfälle.
 * Zahlenwerte gegen die unabhängige Python-Rechnung stehen in golden.json (verification/elektrik.py, Fälle EL-…).
 */
import { describe, expect, it } from "vitest";
import { elektrik as E } from "../src/index";
import { P1, P4, P5, Q7, Q8 } from "../scripts/elektrik-faelle";
import * as F from "../scripts/elektrik-faelle";

const el = (id: string, kind: string, pins: Record<string, string>, params: Record<string, number | string | boolean> = {}): E.ElElement => ({ id, kind, pins, params, label: id });

describe("Gleichstrom (EL-N)", () => {
  const r = E.solveDc(P1);
  it("Beispiel Reihe und Parallel: 220 Ω, 54,545 mA, Verbraucherzählpfeile", () => {
    expect(r.ok).toBe(true);
    expect(r.elements["R1"]!.i).toBeCloseTo(12 / 220, 14);
    expect(r.elements["U1"]!.i).toBeCloseTo(-12 / 220, 14);
    expect(r.elements["U1"]!.p).toBeLessThan(0);
    expect(r.elements["V1"]!.u).toBeCloseTo(1200 / 220, 12);
    expect(Math.abs(r.balance)).toBeLessThan(1e-12);
  });
  it("Auslastung über 1 ist ein Fehlerhinweis, über 0,8 eine Warnung", () => {
    const net = { nodes: ["1", "0"], ground: "0", elements: [el("U", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: 10 }), el("R", "widerstand", { a: "1", b: "0" }, { r_ohm: 100, p_max_W: 0.5 }), el("C", "kondensator", { a: "1", b: "0" }, { c_F: 1e-6, u_max_V: 12 })] };
    const x = E.solveDc(net);
    expect(x.utilization["R"]).toBeCloseTo(2, 14);
    expect(x.findings.some((f) => f.level === "fail" && f.elementId === "R")).toBe(true);
    expect(x.findings.some((f) => f.level === "warn" && f.elementId === "C")).toBe(true);
  });
  it("ab 0.21.0: LED ohne Pflichtparameter I_F wird gemeldet und bleibt offen; Transformator bei Gleichstrom offen", () => {
    const net = { nodes: ["1", "2", "0"], ground: "0", elements: [el("U", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: 5 }), el("D", "led", { anode: "1", kathode: "2" }, { u_f_V: 2 }), el("R", "widerstand", { a: "2", b: "0" }, { r_ohm: 100 }), el("T", "transformator", { p1: "1", p2: "0", s1: "2", s2: "0" }, { n1: 1, n2: 1 })] };
    const x = E.solveDc(net);
    expect(x.ok).toBe(true);
    expect(x.elements["R"]!.i).toBe(0);
    expect(x.findings.filter((f) => f.level === "fail").map((f) => f.elementId)).toEqual(["D"]);
    expect(x.findings.filter((f) => f.level === "info").map((f) => f.elementId)).toEqual(["T"]);
  });
  it("Masche aus Spannungsquellen und kurzgeschlossene Quelle werden gemeldet", () => {
    const loop = { nodes: ["1", "0"], ground: "0", elements: [el("U", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: 5 }), el("S", "schalter", { a: "1", b: "0" }, { geschlossen: true })] };
    expect(E.solveDc(loop).ok).toBe(false);
    const short = { nodes: ["1"], ground: null, elements: [el("U", "gleichspannungsquelle", { plus: "1", minus: "1" }, { u_V: 5 })] };
    expect(E.solveDc(short).ok).toBe(false);
  });
  it("Teilnetz ohne Masse bekommt einen eigenen Bezug mit Warnung", () => {
    const net = { nodes: ["1", "0", "5", "6"], ground: "0", elements: [el("U", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: 5 }), el("R", "widerstand", { a: "1", b: "0" }, { r_ohm: 10 }), el("R2", "widerstand", { a: "5", b: "6" }, { r_ohm: 10 })] };
    const x = E.solveDc(net);
    expect(x.ok).toBe(true);
    expect(x.findings.some((f) => f.level === "warn" && f.text.includes("ohne Verbindung zur Masse"))).toBe(true);
  });
  it("fehlender Parameter ist ein Fehlerhinweis ohne Absturz", () => {
    const x = E.solveDc({ nodes: ["1", "0"], ground: "0", elements: [el("R", "widerstand", { a: "1", b: "0" }, {})] });
    expect(x.findings.some((f) => f.level === "fail")).toBe(true);
  });
});

describe("Wechselstrom und Frequenzgang (EL-W)", () => {
  it("Tiefpass bei f_g: |H| = 1/√2, φ = −45°", () => {
    const fg = 1 / (2 * Math.PI * 1e-4), r = E.solveAc(P5, fg), u = r.nodes["2"]!;
    expect(E.cabs(u)).toBeCloseTo(Math.SQRT1_2, 14);
    expect((E.carg(u) * 180) / Math.PI).toBeCloseTo(-45, 12);
    expect(E.cabs(r.balance)).toBeLessThan(1e-12);
  });
  it("Sweep: ein −3-dB-Punkt nahe f_g, Kennpunkt stetig in N", () => {
    const s = E.sweep(P5, "1", "2", 10, 1e5, 2001);
    expect(s.marks!.f3dB.length).toBe(1);
    expect(s.marks!.f3dB[0]! / 1591.5494309189535 - 1).toBeLessThan(1e-4);
  });
  it("ungültiger Frequenzbereich", () => { expect(E.sweep(P5, "1", "2", 100, 10, 5).ok).toBe(false); });
});

describe("Ersatzwiderstand (EL-E)", () => {
  it("Brücke nicht reduzierbar, Testquelle liefert das Ergebnis", () => {
    const r = E.equivalentResistance(P4, "1", "0");
    expect(r.reducible).toBe(false);
    expect(r.r).not.toBeNull();
  });
  it("gleiche Klemmen: 0; Quelle zwischen den Klemmen wird entfernt", () => {
    expect(E.equivalentResistance(P1, "1", "1").r).toBe(0);
    expect(E.equivalentResistance(P1, "1", "0").r).toBeCloseTo(220, 12);
  });
  it("EL-E04: Spannungsquelle innen kurzgeschlossen (Spannungsteiler am Abgriff: R1 ∥ R2)", () => {
    const r = E.equivalentResistance(Q7, "2", "0");
    expect(r.r! / (2000 / 3) - 1).toBeLessThan(1e-12);
    expect(r.reducible).toBe(true);
    expect(r.trace.ersatz!.find((s) => s.id === "EL-E04")!.subst).toBe("U1 kurzgeschlossen");
  });
  it("EL-E04: Batterie durch R_i, Stromquelle offen", () => {
    const r = E.equivalentResistance(Q8, "2", "0");
    expect(Math.abs(r.r! - 1 / (1 / 102 + 1 / 200))).toBeLessThan(1e-12);
    expect(r.trace.ersatz!.find((s) => s.id === "EL-E04")!.subst).toBe("B1 durch R_i ersetzt, I1 offen");
  });
  it("EL-E04: Brücke zwischen den Mitten mit kurzgeschlossener Quelle ist reduzierbar und stimmt mit der Testquelle", () => {
    const r = E.equivalentResistance(P4, "2", "3");
    const soll = 1 / (1 / (1 / (1 / 1000 + 1 / 1200) + 1 / (1 / 820 + 1 / 1500)) + 1 / 330);
    expect(r.reducible).toBe(true);
    expect(Math.abs(r.r! / soll - 1)).toBeLessThan(1e-12);
    expect(Math.abs(r.rMna! / soll - 1)).toBeLessThan(1e-9);
  });
  it("Klemmen über Kurzschluss verbunden (Amperemeter): 0", () => {
    const r = E.equivalentResistance(P1, "1", "3");
    expect(r.r).toBe(0);
    expect(r.ok).toBe(true);
  });
});

describe("Normtabellen und Rechner (EL-R)", () => {
  it("E-Reihen: Anzahl Werte, Auswahl nach logarithmischem Abstand", () => {
    for (const n of [6, 12, 24, 48, 96] as const) expect(E.E_SERIES[n].length).toBe(n);
    expect(E.eSeriesPick(1.23, 6)!.nearest).toBe(1.5);   // ln(1,5/1,23) = 0,198 < ln 1,23 = 0,207
    expect(E.eSeriesPick(1.2, 6)!.nearest).toBe(1);
    const p = E.eSeriesPick(9.9, 12)!;
    expect([p.nearest, p.lower, p.upper]).toEqual([10, 8.2, 10]);
    expect(p.dev).toBeCloseTo(0.1 / 9.9, 14);
  });
  it("Farbcode: Hin und zurück für alle E24-Werte von 1 Ω bis 10 MΩ", () => {
    for (let e = 0; e < 7; e++) for (const m of E.E_SERIES[24]) {
      const r = E.scaled(m * 10, e - 1), bands = E.colourBands(r, 4)!;
      const res = E.computeTool("R1", { ringe: "4", ring1: bands[0]!, ring2: bands[1]!, ring3: bands[2]!, ring4: "gold" });
      expect(res.kpis.find((k) => k.key === "r_ohm")!.value).toBe(r);
    }
  });
  it("unbekannte Vorlage oder Rechner ergeben ok = false", () => {
    expect(E.computeSheet("S9" as E.SheetId, "nachrechnen", {}).ok).toBe(false);
    expect(E.computeTool("R9" as E.ToolId, {}).ok).toBe(false);
  });
});

describe("Halbleiter, Newton, Pinstrom, Leitungsströme (ab 0.21.0, Konzept v1.1)", () => {
  it("U_T bei 25 °C und Sättigungsstrom aus dem Datenblattpunkt", () => {
    expect(E.U_T).toBeCloseTo(0.0256926, 7);
    const is = E.saturationCurrent(2, 0.02, 2);
    expect(is * Math.expm1(2 / (2 * E.U_T))).toBeCloseTo(0.02, 15);
  });
  it("Exponentenbegrenzung stetig und stetig differenzierbar (EL-H05)", () => {
    const [a, da] = E.limexp(E.X_MAX - 1e-9), [b, db] = E.limexp(E.X_MAX + 1e-9);
    expect(Math.abs(b - a) / a).toBeLessThan(1e-8);
    expect(db / da).toBeCloseTo(1, 8);
    expect(Number.isFinite(E.limexp(1e5)[0])).toBe(true);
  });
  it("MOSFET symmetrisch: I_D(U_GS, −U_DS) = −I_D(U_GD, U_DS) (EL-H18)", () => {
    const m = { uth: 2, k: 2.5 };
    const a = E.mosEval(m, 5, -0.3), b = E.mosEval(m, 5.3, 0.3);
    expect(a.id).toBeCloseTo(-b.id, 14);
    expect(a.swapped).toBe(true);
  });
  it("Sollwerte Konzept 4.1 und 4.2 (Auszug)", () => {
    const d1 = E.solveDc(F.D1);
    expect(d1.elements["D1"]!.i).toBeCloseTo(4.2373e-3, 7);
    expect(E.solveDc(F.ledPin(220)).elements["LED1"]!.i).toBeCloseTo(13.724e-3, 6);
    const x1 = E.solveDc(F.X1);
    expect(x1.operatingPoints!["Q1"]!.region).toBe("gesättigt");
    expect(E.solveDc(F.X2).operatingPoints!["Q1"]!.region).toBe("aktiv");
    expect(E.solveDc(F.mos(5)).operatingPoints!["M1"]!.region).toBe("linear");
    expect(E.solveDc(F.mos(2.5)).elements["M1"]!.i).toBeCloseTo(0.3125, 9);
    expect(E.solveDc(F.mos(1)).operatingPoints!["M1"]!.region).toBe("sperrend");
  });
  it("Leistungsbilanz und Knotenregel mit Halbleitern", () => {
    for (const n of [F.D1, F.D5, F.D8, F.X1, F.X3, F.X7, F.X8, F.M5]) {
      const r = E.solveDc(n);
      expect(r.ok).toBe(true);
      const absSum = Object.values(r.elements).reduce((s, e) => s + Math.abs(e.p), 0);
      expect(Math.abs(r.balance)).toBeLessThanOrEqual(1e-9 * absSum);
      for (const e of Object.values(r.elements)) if (e.pins) expect(Math.abs(Object.values(e.pins).reduce((s, i) => s + i, 0))).toBeLessThan(1e-12 + 1e-12 * Math.abs(e.i));
    }
  });
  it("Pinstrom: Stufen nach E-v11-9 (EL-M1 bis EL-M7)", () => {
    expect(E.solveDc(F.ledPin(220)).pinChecks!["PIN"]!.level).toBe("ok");
    expect(E.solveDc(F.ledPin(100)).pinChecks!["PIN"]!.level).toBe("warn");
    expect(E.solveDc(F.ledPin(47)).pinChecks!["PIN"]!.level).toBe("fail");
    const m4 = E.solveDc(F.ledPin(null));
    expect(m4.ok).toBe(true);
    expect(m4.findings.some((f) => f.level === "fail" && f.text.includes("Vorwiderstand fehlt"))).toBe(true);
    expect(m4.findings.filter((f) => f.text.includes("Vorwiderstand fehlt"))).toHaveLength(1);
    const m5 = E.solveDc(F.M5);
    expect(m5.boardSums![0]!.a).toBeGreaterThan(1);
    expect(m5.findings.some((f) => f.text.startsWith("Uno: Summenstrom"))).toBe(true);
    expect(E.solveDc(F.M6).pinChecks!["PIN"]!.aAbs).toBeNull();
    expect(E.solveDc(F.M7).pinChecks!["PIN"]!.i).toBeLessThan(0);
  });
  it("HIGH-Spannung folgt dem Board, Parameter u_high_V hat Vorrang (E-v11-11)", () => {
    expect(E.solveDc(F.M6).nodes["1"]).toBeCloseTo(3.3, 15);
    const over = { ...F.M6, elements: F.M6.elements.map((e) => (e.kind === "digitalpin" ? { ...e, params: { ...e.params, u_high_V: 3 } } : e)) };
    expect(E.solveDc(over).nodes["1"]).toBeCloseTo(3, 15);
    expect(E.boardHighVoltage("Uno")).toBe(5);
  });
  it("Fehlerfälle EL-F-NL: Gate offen, Abbruch, Determinismus, Kippstufe", () => {
    const gate = { nodes: ["1", "2", "3", "0"], ground: "0", elements: [...F.mos(5).elements.filter((e) => e.id !== "UG")] };
    const g = E.solveDc(gate);
    expect(g.findings.some((f) => f.text.includes("Gate ohne Ansteuerung"))).toBe(true);
    const ab = E.solveDc(F.D1, { newton: { budget: 3 } });
    expect(ab.ok).toBe(false);
    expect(ab.iterations!.aborted).toBe(true);
    expect(ab.trace.konvergenz!.some((s) => s.id === "EL-K09")).toBe(true);
    const a = E.solveDc(F.F7), b = E.solveDc(F.F7);
    expect(a.ok).toBe(true);
    expect(JSON.stringify(a.nodes)).toBe(JSON.stringify(b.nodes));
    expect(E.solveDc(F.X7).iterations!.stage).toBe("newton");
  });
  it("Stufen als Testschalter liefern dieselbe Lösung (EL-K07, EL-K08)", () => {
    const n = E.solveDc(F.D1), g = E.solveDc(F.D1, { newton: { stages: ["gmin"] } }), q = E.solveDc(F.D1, { newton: { stages: ["quellen"] } });
    expect(g.iterations!.stage).toBe("gmin");
    expect(q.iterations!.stage).toBe("quellen");
    expect(g.nodes["2"]).toBeCloseTo(n.nodes["2"]!, 11);
    expect(q.nodes["2"]).toBeCloseTo(n.nodes["2"]!, 11);
    expect(q.findings.some((f) => f.text.startsWith("Lösung erst mit Quellenstufung"))).toBe(true);
  });
  it("Wechselstrom: Kleinsignal am Arbeitspunkt (EL-H20), Verstärkung der Emitterschaltung ≈ g_m · (R_C ∥ R_L)", () => {
    const dc = E.solveDc(F.X6), ic = dc.elements["Q1"]!.i;
    const ac = E.solveAc(F.X6, 1000);
    expect(ac.ok).toBe(true);
    const v = E.cabs(ac.nodes["6"]!) / 0.01, approx = (ic / E.U_T) * (4700 * 10000) / 14700;
    expect(Math.abs(v - approx) / approx).toBeLessThan(0.01);
    expect(ac.findings.some((f) => f.text.startsWith("Kleinsignal am Arbeitspunkt"))).toBe(true);
    const sw = E.sweep(F.X6, "2", "6", 10, 1e5, 30);
    expect(sw.ok).toBe(true);
  });
  it("Leitungsströme: Knotenregel, parallele Drähte, Messgeräte (EL-N14)", () => {
    const r = E.solveDc(F.L1), w = r.wires!;
    expect(w["w1"]).toBeCloseTo(12 / 220, 14);
    expect(w["w10"]).toBeCloseTo(w["w11"]!, 14);
    expect(Math.abs(w["w3"]!)).toBeLessThan(1e-15);
    expect(w["w5"]! + w["w6"]!).toBeCloseTo(w["w4"]! + w["w7"]!, 14);
    expect(E.solveDc(F.P1).wires).toBeUndefined();
  });
  it("lineare Netze ohne Halbleiter: keine Newton-Iteration, keine Rechenweg-Gruppen halbleiter und konvergenz", () => {
    const r = E.solveDc(F.P1);
    expect(r.iterations).toBeUndefined();
    expect(r.trace.halbleiter).toBeUndefined();
    expect(r.trace.konvergenz).toBeUndefined();
  });
});
