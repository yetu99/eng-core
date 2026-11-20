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
/** EL-Q7: Spannungsteiler 12 V, R1 1 kΩ, R2 2 kΩ; Innenwiderstand am Abgriff: Quelle kurzgeschlossen → R1 ∥ R2. */
export const Q7 = net(["1", "2", "0"], el("U1", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: 12 }),
  el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: 1000 }), el("R2", "widerstand", { a: "2", b: "0" }, { r_ohm: 2000 }));
/** EL-Q8: Batterie 9 V (R_i 2 Ω), R1 100 Ω, R2 200 Ω, Stromquelle 10 mA über R3 50 Ω; Klemmen 2–0 → (R_i + R1) ∥ R2. */
export const Q8 = net(["1", "2", "3", "0"], el("B1", "batterie", { plus: "1", minus: "0" }, { u_V: 9, r_i_ohm: 2, kapazitaet_Ah: 0.5 }),
  el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: 100 }), el("R2", "widerstand", { a: "2", b: "0" }, { r_ohm: 200 }),
  el("R3", "widerstand", { a: "2", b: "3" }, { r_ohm: 50 }), el("I1", "gleichstromquelle", { plus: "3", minus: "0" }, { i_A: 0.01 }));
const Q1 = net(["1", "2", "3", "4", "0"], el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: 100 }), el("R2", "widerstand", { a: "2", b: "0" }, { r_ohm: 200 }),
  el("R3", "widerstand", { a: "2", b: "3" }, { r_ohm: 150 }), el("R4", "widerstand", { a: "3", b: "0" }, { r_ohm: 150 }), el("R5", "widerstand", { a: "3", b: "4" }, { r_ohm: 47 }));

// ---------------------------------------------------------------- Halbleiter, Pinstrom, Leitungsströme (ab 0.21.0, Konzept v1.1 Abschn. 4)
const src = (id: string, plus: string, u: number): El => el(id, "gleichspannungsquelle", { plus, minus: "0" }, { u_V: u });
const R = (id: string, a: string, b: string, r: number): El => el(id, "widerstand", { a, b }, { r_ohm: r });
/** n der Diode in Sedra/Smith Bsp. iterative Analyse: 0,1 V je Dekade → n · U_T = 0,1 V / ln 10. */
export const N_SEDRA = 0.1 / Math.log(10) / E.U_T;
/** EL-D1 Sedra/Smith: 5 V, 1 kΩ, Diode 1 mA bei 0,7 V, 0,1 V je Dekade. */
export const D1 = net(["1", "2", "0"], src("U1", "1", 5), R("R1", "1", "2", 1000), el("D1", "diode", { anode: "2", kathode: "0" }, { u_f_V: 0.7, i_f_A: 1e-3, n: N_SEDRA }));
/** EL-D2 bis EL-D4: Uno-Pin HIGH, LED rot 2 V bei 20 mA (n = 2, I_max 30 mA) über R. */
export const ledPin = (r: number | null, pin = "D13"): E.ElNetlist => r === null
  ? net(["1", "0"], el("PIN", "digitalpin", { pin: "1", gnd: "0" }, { zustand: "HIGH", board: "Uno", pin }), el("LED1", "led", { anode: "1", kathode: "0" }, { u_f_V: 2, i_f_A: 0.02, i_max_A: 0.03, farbe: "rot" }))
  : net(["1", "2", "0"], el("PIN", "digitalpin", { pin: "1", gnd: "0" }, { zustand: "HIGH", board: "Uno", pin }), R("R1", "1", "2", r), el("LED1", "led", { anode: "2", kathode: "0" }, { u_f_V: 2, i_f_A: 0.02, i_max_A: 0.03, farbe: "rot" }));
/** EL-D5 Z-Diode 5,1 V bei 5 mA an 12 V über 470 Ω, Last 1 kΩ (P_tot 0,5 W). */
export const D5 = net(["1", "2", "0"], src("U1", "1", 12), R("R1", "1", "2", 470), el("Z1", "z_diode", { anode: "0", kathode: "2" }, { u_z_V: 5.1, i_zt_A: 0.005, n_z: 1, p_tot_W: 0.5 }), R("RL", "2", "0", 1000));
/** Diode mit Bahnwiderstand 0,5 Ω an 5 V über 100 Ω. */
export const D8 = net(["1", "2", "0"], src("U1", "1", 5), R("R1", "1", "2", 100), el("D1", "diode", { anode: "2", kathode: "0" }, { u_f_V: 0.7, i_f_A: 0.01, n: 1.8, r_s_ohm: 0.5, i_max_A: 0.2 }));
/** EL-X1 NPN als Schalter: Pin 5 V über R_B 1 kΩ, R_C 220 Ω an 5 V (BC547: I_C,max 100 mA, P_tot 0,5 W). */
export const X1 = net(["1", "2", "3", "4", "0"], el("PIN", "digitalpin", { pin: "1", gnd: "0" }, { zustand: "HIGH", board: "Uno", pin: "D9" }), R("RB", "1", "2", 1000), src("U1", "4", 5), R("RC", "4", "3", 220),
  el("Q1", "npn", { b: "2", c: "3", e: "0" }, { beta: 100, i_c_max_A: 0.1, p_tot_W: 0.5 }));
/** EL-X2 NPN aktiv: 2 V über 100 kΩ, R_C 1 kΩ an 10 V. */
export const X2 = net(["1", "2", "3", "4", "0"], src("U0", "1", 2), R("RB", "1", "2", 1e5), src("U1", "4", 10), R("RC", "4", "3", 1000), el("Q1", "npn", { b: "2", c: "3", e: "0" }, { beta: 100 }));
/** EL-X3 PNP als Schalter: Emitter 5 V, Basis über 47 kΩ an Pin LOW, R_C 1 kΩ gegen Masse. */
export const X3 = net(["1", "2", "3", "4", "0"], src("U1", "1", 5), el("PIN", "digitalpin", { pin: "4", gnd: "0" }, { zustand: "LOW", board: "Uno", pin: "D8" }), R("RB", "2", "4", 47000),
  el("Q1", "pnp", { b: "2", c: "3", e: "1" }, { beta: 100 }), R("RC", "3", "0", 1000));
/** EL-X4, EL-X5 N-MOSFET: U_GS fest, Last 10 Ω an 12 V (U_th 2 V, R_on 0,05 Ω bei 10 V, I_D,max 5 A). */
export const mos = (ugs: number): E.ElNetlist => net(["1", "2", "3", "0"], src("UG", "1", ugs), src("U1", "2", 12), R("RL", "2", "3", 10), el("M1", "n_mosfet", { g: "1", d: "3", s: "0" }, { u_th_V: 2, r_on_ohm: 0.05, i_d_max_A: 5 }));
/** MOSFET mit U_DS < 0: Source an Masse, Drain über 10 Ω an −12 V, Gate 10 V. */
export const X8 = net(["1", "2", "3", "0"], src("UG", "1", 10), src("U1", "2", -12), R("RL", "3", "2", 10), el("M1", "n_mosfet", { g: "1", d: "3", s: "0" }, { u_th_V: 2, r_on_ohm: 0.05 }));
/** EL-X6 Emitterschaltung mit Spannungsteiler 47 kΩ / 10 kΩ, R_C 4,7 kΩ, R_E 1 kΩ an 12 V; Eingang über 10 µF, Ausgang an 10 kΩ über 10 µF. */
export const X6 = net(["1", "2", "3", "4", "5", "6", "7", "0"], src("U1", "1", 12), R("R1", "1", "3", 47000), R("R2", "3", "0", 10000), R("RC", "1", "4", 4700), R("RE", "5", "0", 1000),
  el("Q1", "npn", { b: "3", c: "4", e: "5" }, { beta: 100 }), el("AC1", "wechselspannungsquelle", { plus: "2", minus: "0" }, { u_eff_V: 0.01, f_Hz: 1000, phase_deg: 0 }),
  el("C1", "kondensator", { a: "2", b: "3" }, { c_F: 1e-5 }), el("C2", "kondensator", { a: "4", b: "6" }, { c_F: 1e-5 }), R("RL", "6", "0", 10000), el("CE", "kondensator", { a: "5", b: "0" }, { c_F: 1e-4 }), R("RX", "7", "0", 1));
/** Kleinsignal Diode: 5 V über 1 kΩ an die Diode, Wechselquelle 10 mV über 10 µF. */
export const D9 = net(["1", "2", "3", "0"], src("U1", "1", 5), R("R1", "1", "2", 1000), el("D1", "diode", { anode: "2", kathode: "0" }, { u_f_V: 0.7 }),
  el("AC1", "wechselspannungsquelle", { plus: "3", minus: "0" }, { u_eff_V: 0.01, f_Hz: 1000, phase_deg: 0 }), el("C1", "kondensator", { a: "3", b: "2" }, { c_F: 1e-5 }));
/** Kleinsignal MOSFET: Sättigung U_GS 2,5 V, Wechselquelle 10 mV am Gate in Reihe, Last 10 Ω an 12 V. */
export const M9 = net(["1", "2", "3", "4", "0"], src("UG", "4", 2.5), el("AC1", "wechselspannungsquelle", { plus: "1", minus: "4" }, { u_eff_V: 0.01, f_Hz: 1000, phase_deg: 0 }),
  src("U1", "2", 12), R("RL", "2", "3", 10), el("M1", "n_mosfet", { g: "1", d: "3", s: "0" }, { u_th_V: 2, r_on_ohm: 0.05 }));
/** EL-M5: acht Uno-Pins D2 bis D9, je 28 mA über LED (I_max 30 mA) und 106 Ω. */
export const M5 = net(["0", ...Array.from({ length: 8 }, (_, k) => [`p${k}`, `l${k}`]).flat()],
  ...Array.from({ length: 8 }, (_, k) => [el(`PIN${k}`, "digitalpin", { pin: `p${k}`, gnd: "0" }, { zustand: "HIGH", board: "Uno", pin: `D${k + 2}` }), R(`R${k}`, `p${k}`, `l${k}`, 106),
    el(`LED${k}`, "led", { anode: `l${k}`, kathode: "0" }, { u_f_V: 2, i_f_A: 0.02, i_max_A: 0.03 })]).flat());
/** EL-M6 ESP32: LED blau 3,0 V bei 20 mA über 33 Ω an 3,3 V. */
export const M6 = net(["1", "2", "0"], el("PIN", "digitalpin", { pin: "1", gnd: "0" }, { zustand: "HIGH", board: "ESP32 DevKit", pin: "GPIO2" }), R("R1", "1", "2", 33),
  el("LED1", "led", { anode: "2", kathode: "0" }, { u_f_V: 3, i_f_A: 0.02, farbe: "blau" }));
/** EL-M7 Uno-Pin LOW, LED von 5 V über 100 Ω in den Pin (Senkstrom). */
export const M7 = net(["1", "2", "3", "0"], src("U1", "1", 5), R("R1", "1", "2", 100), el("LED1", "led", { anode: "2", kathode: "3" }, { u_f_V: 2, i_f_A: 0.02, i_max_A: 0.03 }),
  el("PIN", "digitalpin", { pin: "3", gnd: "0" }, { zustand: "LOW", board: "Uno", pin: "D4" }));
/** EL-F-NL3 Kippstufe aus zwei NPN (leicht unsymmetrisch). */
export const F7 = net(["1", "2", "3", "4", "5", "0"], src("U1", "1", 5), R("RC1", "1", "2", 1000), R("RC2", "1", "3", 1100), R("RB1", "3", "4", 10000), R("RB2", "2", "5", 10000),
  el("Q1", "npn", { b: "4", c: "2", e: "0" }, { beta: 100 }), el("Q2", "npn", { b: "5", c: "3", e: "0" }, { beta: 100 }));
/** EL-X7 Darlington: Basis über 1 MΩ an 5 V, Kollektoren über 100 Ω an 5 V. */
export const X7 = net(["1", "2", "3", "4", "0"], src("U1", "1", 5), R("RB", "1", "2", 1e6), R("RC", "1", "3", 100),
  el("Q1", "npn", { b: "2", c: "3", e: "4" }, { beta: 100 }), el("Q2", "npn", { b: "4", c: "3", e: "0" }, { beta: 100 }));
/** EL-L Leitungsströme am Beispiel Reihe und Parallel, mit Knotenpunkt und doppeltem Draht. */
export const L1: E.ElNetlist = { ...net(["1", "2", "3", "0"], el("U1", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: 12 }), el("A1", "amperemeter", { a: "1", b: "3" }),
  el("R1", "widerstand", { a: "3", b: "2" }, { r_ohm: 100 }), el("R2", "widerstand", { a: "2", b: "0" }, { r_ohm: 200 }), el("R3", "widerstand", { a: "2", b: "0" }, { r_ohm: 300 }),
  el("V1", "voltmeter", { a: "3", b: "2" }), el("K1", "knoten", { k: "2" })),
  wires: [
    { id: "w1", a: { el: "U1", pin: "plus" }, b: { el: "A1", pin: "a" } }, { id: "w2", a: { el: "A1", pin: "b" }, b: { el: "R1", pin: "a" } }, { id: "w3", a: { el: "R1", pin: "a" }, b: { el: "V1", pin: "a" } },
    { id: "w4", a: { el: "R1", pin: "b" }, b: { el: "K1", pin: "k" } }, { id: "w5", a: { el: "K1", pin: "k" }, b: { el: "R2", pin: "a" } }, { id: "w6", a: { el: "K1", pin: "k" }, b: { el: "R3", pin: "a" } },
    { id: "w7", a: { el: "V1", pin: "b" }, b: { el: "K1", pin: "k" } }, { id: "w8", a: { el: "U1", pin: "minus" }, b: { el: "GND", pin: "a" } }, { id: "w9", a: { el: "GND", pin: "a" }, b: { el: "R2", pin: "b" } },
    { id: "w10", a: { el: "R2", pin: "b" }, b: { el: "R3", pin: "b" } }, { id: "w11", a: { el: "R2", pin: "b" }, b: { el: "R3", pin: "b" } },
  ] };

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
  push("EL-Q7 Innenwiderstand Spannungsteiler 12 V, R1 1 kΩ, R2 2 kΩ am Abgriff (Quelle kurzgeschlossen)", flat(E.equivalentResistance(Q7, "2", "0").trace));
  push("EL-Q8 Innenwiderstand Batterie 9 V (R_i 2 Ω), R1 100 Ω, R2 200 Ω, Stromquelle 10 mA über R3 50 Ω (offen)", flat(E.equivalentResistance(Q8, "2", "0").trace));
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
  // Halbleiter (ab 0.21.0): Literaturfälle zuerst
  push("EL-D1 Sedra/Smith (iterative Analyse): 5 V, 1 kΩ, Diode 1 mA bei 0,7 V, 0,1 V je Dekade", flat(E.solveDc(D1).trace));
  push("EL-D2 Uno D13 HIGH, LED rot 2 V bei 20 mA (n = 2, I_max 30 mA) über 220 Ω", flat(E.solveDc(ledPin(220)).trace));
  push("EL-D5 Z-Diode 5,1 V bei 5 mA an 12 V über 470 Ω, Last 1 kΩ, P_tot 0,5 W", flat(E.solveDc(D5).trace));
  push("EL-X1 NPN als Schalter: Uno D9 5 V, R_B 1 kΩ, R_C 220 Ω an 5 V (I_C,max 100 mA, P_tot 0,5 W)", flat(E.solveDc(X1).trace));
  push("EL-X3 PNP als Schalter: Emitter 5 V, Basis über 47 kΩ an Uno D8 LOW, R_C 1 kΩ", flat(E.solveDc(X3).trace));
  push("EL-X4 N-MOSFET Schalter U_GS 5 V, Last 10 Ω an 12 V (U_th 2 V, R_on 0,05 Ω bei 10 V, I_D,max 5 A)", flat(E.solveDc(mos(5)).trace));
  push("EL-X5 N-MOSFET Sättigung U_GS 2,5 V, Last 10 Ω an 12 V", flat(E.solveDc(mos(2.5)).trace));
  push("EL-X9 N-MOSFET gesperrt U_GS 1 V, Last 10 Ω an 12 V", flat(E.solveDc(mos(1)).trace));
  push("EL-X8 N-MOSFET mit U_DS < 0 (Source an Masse, Drain über 10 Ω an −12 V, Gate 10 V)", flat(E.solveDc(X8).trace));
  push("EL-D8 Diode mit Bahnwiderstand 0,5 Ω an 5 V über 100 Ω", flat(E.solveDc(D8).trace));
  push("EL-M4 Uno D13 HIGH, LED direkt am Pin (ohne Vorwiderstand)", flat(E.solveDc(ledPin(null)).trace));
  push("EL-M6 ESP32 GPIO2 HIGH 3,3 V, LED blau 3,0 V über 33 Ω", flat(E.solveDc(M6).trace));
  push("EL-M5 Uno D2 bis D9 je LED über 106 Ω (Summenstrom, Portgruppen)", flat(E.solveDc(M5).trace));
  push("EL-D9 Kleinsignal Diode am Arbeitspunkt (5 V über 1 kΩ), 10 mV bei 1 kHz", flat(E.solveAc(D9, 1000).trace));
  push("EL-X6 Emitterschaltung mit Spannungsteiler, Kleinsignal 10 mV bei 1 kHz", flat(E.solveAc(X6, 1000).trace));
  push("EL-M9 Kleinsignal N-MOSFET in Sättigung (U_GS 2,5 V), 10 mV bei 1 kHz", flat(E.solveAc(M9, 1000).trace));
  push("EL-L1 Leitungsströme Reihe und Parallel mit Knotenpunkt und doppeltem Draht", flat(E.solveDc(L1).trace));
  push("EL-F-NL6 Testschalter: nur G_min-Stufung (Diode Sedra/Smith)", flat(E.solveDc(D1, { newton: { stages: ["gmin"] } }).trace));
  push("EL-F-NL7 Testschalter: nur Quellenstufung (Diode Sedra/Smith)", flat(E.solveDc(D1, { newton: { stages: ["quellen"] } }).trace));
  push("EL-F-NL4 Testschalter: Budget 3 Schritte (Abbruch)", flat(E.solveDc(D1, { newton: { budget: 3 } }).trace));
  return out;
}
