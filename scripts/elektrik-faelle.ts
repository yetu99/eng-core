/**
 * Beispielfälle Modul elektrik (Werkzeug Stromwerk) für den Formelkatalog (scripts/katalog.ts).
 * Jeder Lauf erzeugt seine Formeln mit nachrechenbarem Beispiel; das Beispiel „Reihe und Parallel“ zuerst.
 * Dieselben Netze prüft verification/elektrik.py (Fälle EL-P, EL-Q, EL-V, EL-T) mit einem unabhängigen Verfahren.
 */
import { elektrik as E, type CalcStep } from "../src/index";

type El = E.ElElement;
const el = (id: string, kind: string, pins: Record<string, string>, params: Record<string, number | string | boolean> = {}): El => ({ id, kind, pins, params, label: id });
const net = (nodes: string[], ...els: El[]): E.ElNetlist => ({ nodes, ground: "0", elements: [...els, el("GND", "masse", { a: "0" })] });

export const P1 = net(["1", "2", "3", "0"], el("U1", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: 12 }), el("A1", "amperemeter", { a: "1", b: "3" }),
  el("R1", "widerstand", { a: "3", b: "2" }, { r_ohm: 100, p_max_W: 0.5 }), el("R2", "widerstand", { a: "2", b: "0" }, { r_ohm: 200, p_max_W: 0.25 }),
  el("R3", "widerstand", { a: "2", b: "0" }, { r_ohm: 300, p_max_W: 0.25 }), el("V1", "voltmeter", { a: "3", b: "2" }));
const P2 = net(["1", "2", "3", "4", "0"], el("B1", "batterie", { plus: "1", minus: "0" }, { u_V: 9, r_i_ohm: 0.5, kapazitaet_Ah: 0.5 }),
  el("P1", "potentiometer", { a: "1", b: "0", s: "2" }, { r_ohm: 10000, position: 0.3 }), el("R1", "widerstand", { a: "2", b: "3" }, { r_ohm: 4700, p_max_W: 0.25 }),
  el("H1", "lampe", { a: "3", b: "0" }, { u_nenn_V: 12, p_nenn_W: 5 }), el("S1", "schalter", { a: "1", b: "4" }, { geschlossen: true }), el("R2", "widerstand", { a: "4", b: "0" }, { r_ohm: 220, p_max_W: 0.5 }));
const P3 = net(["1", "2", "3", "0"], el("I1", "gleichstromquelle", { plus: "1", minus: "0" }, { i_A: 0.01 }), el("R1", "widerstand", { a: "1", b: "0" }, { r_ohm: 1000 }),
  el("L1", "spule", { a: "1", b: "2" }, { l_H: 0.1, r_ohm: 12 }), el("R2", "widerstand", { a: "2", b: "0" }, { r_ohm: 470 }), el("C1", "kondensator", { a: "2", b: "3" }, { c_F: 1e-6, u_max_V: 6.3 }),
  el("R3", "widerstand", { a: "3", b: "0" }, { r_ohm: 1000 }), el("PIN", "digitalpin", { pin: "3", gnd: "0" }, { zustand: "HIGH", u_high_V: 5 }));
export const P4 = net(["1", "2", "3", "0"], el("U1", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: 10 }), el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: 1000 }),
  el("R2", "widerstand", { a: "2", b: "0" }, { r_ohm: 1200 }), el("R3", "widerstand", { a: "1", b: "3" }, { r_ohm: 820 }), el("R4", "widerstand", { a: "3", b: "0" }, { r_ohm: 1500 }),
  el("R5", "widerstand", { a: "2", b: "3" }, { r_ohm: 330 }));
export const P5 = net(["1", "2", "0"], el("AC1", "wechselspannungsquelle", { plus: "1", minus: "0" }, { u_eff_V: 1, f_Hz: 1000, phase_deg: 0 }),
  el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: 1000 }), el("C1", "kondensator", { a: "2", b: "0" }, { c_F: 1e-7, u_max_V: 50 }));
const P7 = { ...net(["1", "2", "3", "0"], el("AC1", "wechselspannungsquelle", { plus: "1", minus: "0" }, { u_eff_V: 230, f_Hz: 50, phase_deg: 0 }),
  el("T1", "transformator", { p1: "1", p2: "0", s1: "2", s2: "0" }, { n1: 230, n2: 12 }), el("R1", "widerstand", { a: "2", b: "3" }, { r_ohm: 4 }),
  el("L1", "spule", { a: "3", b: "0" }, { l_H: 0.02, r_ohm: 0.5 })) };
const Q1 = net(["1", "2", "3", "4", "0"], el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: 100 }), el("R2", "widerstand", { a: "2", b: "0" }, { r_ohm: 200 }),
  el("R3", "widerstand", { a: "2", b: "3" }, { r_ohm: 150 }), el("R4", "widerstand", { a: "3", b: "0" }, { r_ohm: 150 }), el("R5", "widerstand", { a: "3", b: "4" }, { r_ohm: 47 }));

export const SHEET_BASE: Record<string, number> = { u_V: 12, r1_ohm: 1e4, r2_ohm: 1e4, r_last_ohm: 1e6, r_ohm: 1000, c_F: 1e-7, f_Hz: 1000, l_H: 0.01, u_f_V: 2, i_f_A: 0.02, t_s: 5e-4,
  r3_ohm: 1000, r4_ohm: 1200, u2_V: 5, fg_Hz: 1000, f0_Hz: 5000, tau_s: 1e-3, e_reihe: 24 };

export interface ElRun { text: string; steps: CalcStep[] }
const flat = (t: Partial<Record<string, CalcStep[]>>): CalcStep[] => Object.values(t).flatMap((x) => x ?? []);

export function elektrikFaelle(): ElRun[] {
  const out: ElRun[] = [];
  const push = (text: string, steps: CalcStep[]): void => { out.push({ text, steps }); };
  push("EL-P1 Beispiel Reihe und Parallel: 12 V, R1 100 Ω, R2 200 Ω ∥ R3 300 Ω, Voltmeter an R1, Amperemeter im Hauptzweig", flat(E.solveDc(P1).trace));
  push("EL-P2 Batterie 9 V (R_i 0,5 Ω), Potentiometer 10 kΩ Stellung 0,3, R 4,7 kΩ, Glühlampe 12 V 5 W, Schalter geschlossen, R 220 Ω", flat(E.solveDc(P2).trace));
  push("EL-P3 Stromquelle 10 mA, Spule 0,1 H (r 12 Ω), Kondensator 1 µF offen, Digitalpin HIGH 5 V", flat(E.solveDc(P3).trace));
  push("EL-P5 RC-Tiefpass 1 kΩ, 100 nF bei 1 kHz, Quelle 1 V", flat(E.solveAc(P5, 1000).trace));
  push("EL-P7 Transformator 230 V / 12 V mit R 4 Ω und Spule 20 mH (r 0,5 Ω), 50 Hz", flat(E.solveAc(P7, 50).trace));
  push("EL-B1 Frequenzgang RC-Tiefpass 10 Hz bis 100 kHz, 200 Punkte", flat(E.sweep(P5, "1", "2", 10, 1e5, 200).trace));
  push("EL-Q1 Ersatzwiderstand Leiter R1 100 Ω, R2 200 Ω, R3 150 Ω, R4 150 Ω, R5 47 Ω (offen)", flat(E.equivalentResistance(Q1, "1", "0").trace));
  push("EL-Q2 Ersatzwiderstand Brücke mit Querwiderstand 330 Ω (nicht reduzierbar)", flat(E.equivalentResistance(P4, "1", "0").trace));
  for (const g of E.OHM_GIVEN) {
    const v = { "U und R": { u: 12, r: 120 }, "U und I": { u: 230, i: 0.5 }, "I und R": { i: 0.02, r: 150 }, "P und U": { p: 60, u: 230 }, "P und R": { p: 0.25, r: 1000 }, "P und I": { p: 2, i: 0.1 } }[g];
    push(`Ohm und Leistung, gegeben ${g}`, E.ohm(g, v).steps);
  }
  push("Leitwert 470 Ω", E.conductance(470).steps);
  for (const k of ["R", "L", "C"] as const) {
    const xs = { R: [100, 220, 470], L: [0.001, 0.0022], C: [1e-6, 2.2e-6] }[k];
    push(`Reihenschaltung ${k}: ${xs.join(", ")}`, E.series(k, xs).steps); push(`Parallelschaltung ${k}: ${xs.join(", ")}`, E.parallel(k, xs).steps);
  }
  push("Stromteiler 1 A auf 100 Ω, 200 Ω, 300 Ω, Zweig 1", E.currentDivider(1, [100, 200, 300], 0).steps);
  for (const id of E.SHEET_IDS) for (const mode of ["nachrechnen", "auslegen"] as const) push(`Vorlage ${id} ${mode} (Eingaben ${Object.entries(SHEET_BASE).map(([k, v]) => `${k} ${v}`).join(", ")})`, flat(E.computeSheet(id, mode, SHEET_BASE).trace));
  const tools: Array<[E.ToolId, Record<string, number | string>, string]> = [
    ["R1", { ringe: "4", ring1: "gelb", ring2: "violett", ring3: "rot", ring4: "gold" }, "gelb, violett, rot, gold"],
    ["R1", { ringe: "5", ring1: "braun", ring2: "schwarz", ring3: "schwarz", ring4: "braun", ring5: "braun" }, "braun, schwarz, schwarz, braun, braun"],
    ["R2", { wert: 4300, e_reihe: "12" }, "4300 Ω, E12"], ["R4", { kapazitaet_Ah: 3, u_V: 3.6, i_A: 5, nutzbar: 0.9, n_reihe: 4, m_parallel: 2 }, "4S2P, 3 Ah, 3,6 V, 5 A, 90 %"],
    ["R5", { u_V: 400, i_A: 10, cos_phi: 0.85, schaltung: "Stern" }, "400 V, 10 A, cos φ 0,85, Stern"], ["R5", { u_V: 400, i_A: 16, cos_phi: 0.9, schaltung: "Dreieck" }, "400 V, 16 A, cos φ 0,9, Dreieck"],
    ["R6", { p_W: 1500, n_rpm: 1450, u_V: 400, eta: 0.85, cos_phi: 0.82, f_Hz: 50, polpaare: 2 }, "1,5 kW, 1450 1/min, 400 V, η 0,85, cos φ 0,82, 50 Hz, p = 2"],
  ];
  for (const [id, inp, txt] of tools) push(`Rechner ${id}: ${txt}`, flat(E.computeTool(id, inp).trace));
  return out;
}
