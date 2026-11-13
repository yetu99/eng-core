/**
 * Modul elektrik (eng-core 0.19.0, Werkzeug Stromwerk): Konventionen, Hinweise und Grenzfälle.
 * Zahlenwerte gegen die unabhängige Python-Rechnung stehen in golden.json (verification/elektrik.py, Fälle EL-…).
 */
import { describe, expect, it } from "vitest";
import { elektrik as E } from "../src/index";
import { P1, P4, P5 } from "../scripts/elektrik-faelle";

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
  it("nichtlineare Bauteile: offen mit Hinweis; Transformator bei Gleichstrom offen", () => {
    const net = { nodes: ["1", "2", "0"], ground: "0", elements: [el("U", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: 5 }), el("D", "led", { anode: "1", kathode: "2" }, { u_f_V: 2 }), el("R", "widerstand", { a: "2", b: "0" }, { r_ohm: 100 }), el("T", "transformator", { p1: "1", p2: "0", s1: "2", s2: "0" }, { n1: 1, n2: 1 })] };
    const x = E.solveDc(net);
    expect(x.ok).toBe(true);
    expect(x.elements["R"]!.i).toBe(0);
    expect(x.findings.filter((f) => f.level === "info").map((f) => f.elementId).sort()).toEqual(["D", "T"]);
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
