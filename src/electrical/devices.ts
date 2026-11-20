/**
 * Nichtlineare Bauteile im Netz (Modul elektrik, intern, ab 0.21.0): Parameter lesen, Begleitmodelle stempeln (EL-H08,
 * EL-H13, EL-H19), Kleinsignalmodell (EL-H20), Klemmenströme und Bereich am Arbeitspunkt (EL-H21).
 *
 * Parameter (SI, Schlüssel wie in der App Stromwerk, fehlende optionale Werte mit Vorgabe):
 *  - led: u_f_V, i_f_A (Pflicht), n = 2, r_s_ohm = 0, i_max_A (Auslastung)
 *  - diode: u_f_V (Pflicht), i_f_A = 10 mA, n = 1,8, r_s_ohm = 0, i_max_A
 *  - z_diode: u_z_V (Pflicht), i_zt_A = 5 mA, n_z = 1, u_f_V = 0,7 V, i_f_A = 10 mA, n = 1,8, p_tot_W
 *  - npn, pnp: beta (Pflicht), u_be_ref_V = 0,65 V, i_c_ref_A = 1 mA, beta_r = 1, i_c_max_A, p_tot_W
 *  - n_mosfet: u_th_V, r_on_ohm (Pflicht), u_gs_ref_V = 10 V, i_d_max_A
 * Mindestleitwert G_min = 1e-12 S (EL-K06) liegt parallel zu jedem pn-Übergang und zwischen Drain und Source und gehört
 * zum Modell (Ströme der Ergebnisse enthalten ihn).
 */
import { C0, cx, type Complex } from "./complex";
import type { ElElement, ElFinding } from "./network";
import { label, num, type Prim } from "./mna";
import {
  U_T, bjtCriticalVoltage, bjtEval, bjtSaturationCurrent, criticalVoltage, diodeEval, diodeLimit, mosEval, mosK, mosLimit, pnjlim, saturationCurrent,
  type BjtModel, type DiodeModel, type MosModel, type MosRegion,
} from "./semiconductors";

/** Mindestleitwert in S (EL-K06). */
export const G_MIN = 1e-12;

export interface DiodeDev { t: "diode"; el: string; kind: "led" | "diode" | "z_diode"; a: string; k: string; j: string; m: DiodeModel; uf: number; iF: number; imax: number | null; ptot: number | null }
export interface BjtDev { t: "bjt"; el: string; kind: "npn" | "pnp"; b: string; c: string; e: string; m: BjtModel; ubeRef: number; icRef: number; icmax: number | null; ptot: number | null }
export interface MosDev { t: "mos"; el: string; g: string; d: string; s: string; m: MosModel; ron: number; ugsRef: number; idmax: number | null }
export type Device = DiodeDev | BjtDev | MosDev;

const opt = (e: ElElement, key: string, def: number, findings: ElFinding[], positive = true): number | null => {
  const v = e.params[key];
  if (v === undefined || v === null || v === "") return def;
  if (typeof v !== "number" || !Number.isFinite(v) || (positive && !(v > 0)) || (!positive && v < 0)) {
    findings.push({ level: "fail", elementId: e.id, text: `${label(e)}: ${key} muss ${positive ? "größer 0" : "mindestens 0"} sein` });
    return null;
  }
  return v;
};
const optMax = (e: ElElement, key: string): number | null => { const v = e.params[key]; return typeof v === "number" && v > 0 ? v : null; };

/**
 * Bauteil lesen. Rückgabe null bei fehlendem Anschluss oder ungültigem Parameter (Hinweis in findings). linear nimmt
 * zusätzliche lineare Primitive auf (Bahnwiderstand r_S, EL-H04).
 */
export function parseDevice(e: ElElement, pin: (name: string) => string | null, findings: ElFinding[], linear: Prim[]): Device | null {
  const L = label(e);
  if (e.kind === "led" || e.kind === "diode" || e.kind === "z_diode") {
    const a = pin("anode"), k = pin("kathode");
    if (!a || !k) return null;
    const isLed = e.kind === "led", isZ = e.kind === "z_diode";
    const uf = isZ ? opt(e, "u_f_V", 0.7, findings) : num(e, "u_f_V", findings, { positive: true });
    const iF = isLed ? num(e, "i_f_A", findings, { positive: true }) : opt(e, "i_f_A", 0.01, findings);
    const n = opt(e, "n", isLed ? 2 : 1.8, findings), rs = opt(e, "r_s_ohm", 0, findings, false);
    const uz = isZ ? num(e, "u_z_V", findings, { positive: true }) : 0;
    const izt = isZ ? opt(e, "i_zt_A", 0.005, findings) : 0, nz = isZ ? opt(e, "n_z", 1, findings) : 1;
    if (uf === null || iF === null || n === null || rs === null || uz === null || izt === null || nz === null) return null;
    if (uf - rs * iF <= 0) { findings.push({ level: "fail", elementId: e.id, text: `${L}: U_F − r_S · I_F muss größer 0 sein` }); return null; }
    const m: DiodeModel = { is: saturationCurrent(uf, iF, n, rs), n, rs, zener: isZ ? { uz, izt, nz } : null };
    let j = a;
    if (rs > 0) { j = `${e.id}#j`; linear.push({ t: "Y", a, b: j, y: cx(1 / rs), el: e.id, main: false }); }
    return { t: "diode", el: e.id, kind: e.kind, a, k, j, m, uf, iF, imax: optMax(e, "i_max_A"), ptot: optMax(e, "p_tot_W") };
  }
  if (e.kind === "npn" || e.kind === "pnp") {
    const b = pin("b"), c = pin("c"), em = pin("e");
    if (!b || !c || !em) return null;
    const beta = num(e, "beta", findings, { positive: true }), ubeRef = opt(e, "u_be_ref_V", 0.65, findings), icRef = opt(e, "i_c_ref_A", 1e-3, findings), betaR = opt(e, "beta_r", 1, findings);
    if (beta === null || ubeRef === null || icRef === null || betaR === null) return null;
    const m: BjtModel = { polarity: e.kind === "npn" ? 1 : -1, is: bjtSaturationCurrent(ubeRef, icRef), betaF: beta, betaR };
    return { t: "bjt", el: e.id, kind: e.kind, b, c, e: em, m, ubeRef, icRef, icmax: optMax(e, "i_c_max_A"), ptot: optMax(e, "p_tot_W") };
  }
  const g = pin("g"), d = pin("d"), s = pin("s");
  if (!g || !d || !s) return null;
  const uth = num(e, "u_th_V", findings), ron = num(e, "r_on_ohm", findings, { positive: true }), ugsRef = opt(e, "u_gs_ref_V", 10, findings);
  if (uth === null || ron === null || ugsRef === null) return null;
  if (!(ugsRef > uth)) { findings.push({ level: "fail", elementId: e.id, text: `${L}: U_GS,ref muss größer U_th sein` }); return null; }
  return { t: "mos", el: e.id, g, d, s, m: { uth, k: mosK(ron, ugsRef, uth) }, ron, ugsRef, idmax: optMax(e, "i_d_max_A") };
}

/** Steuerspannungen eines Bauteils (Diode: [U_j], BJT: [U_BE, U_BC], MOSFET: [U_GS, U_DS]). */
export type Volts = number[];
export const devVolts = (d: Device, v: (n: string) => number): Volts =>
  d.t === "diode" ? [v(d.j) - v(d.k)] : d.t === "bjt" ? [v(d.b) - v(d.e), v(d.b) - v(d.c)] : [v(d.g) - v(d.s), v(d.d) - v(d.s)];

/** Startwerte (EL-K02): pn-Übergänge in Durchlass bei U_krit, BJT U_BC = 0, MOSFET 0. */
export function startVolts(d: Device): Volts {
  if (d.t === "diode") return [criticalVoltage(d.m.is, d.m.n * U_T)];
  if (d.t === "bjt") return [d.m.polarity * bjtCriticalVoltage(d.m), 0];
  return [0, 0];
}

/** Spannungsbegrenzung (EL-K04, EL-K05). Rückgabe [begrenzte Spannungen, begrenzt?]. */
export function limitVolts(d: Device, vnew: Volts, vold: Volts): [Volts, boolean] {
  if (d.t === "diode") { const [v, l] = diodeLimit(d.m, vnew[0]!, vold[0]!); return [[v], l]; }
  if (d.t === "bjt") {
    const s = d.m.polarity, vc = bjtCriticalVoltage(d.m);
    const [a, la] = pnjlim(s * vnew[0]!, s * vold[0]!, U_T, vc), [b, lb] = pnjlim(s * vnew[1]!, s * vold[1]!, U_T, vc);
    return [[s * a, s * b], la || lb];
  }
  const [ugs, uds, l] = mosLimit(d.m, vnew[0]!, vold[0]!, vnew[1]!, vold[1]!);
  return [[ugs, uds], l];
}

/** Linearisierung am Punkt v: Ströme f (Diode [I], BJT [I_C, I_B], MOSFET [I_D]) und Jacobi-Matrix J (Zeile je Strom). */
export interface Lin { f: number[]; J: number[][]; limexp: boolean; region: string }
export function linearize(d: Device, v: Volts): Lin {
  if (d.t === "diode") {
    const r = diodeEval(d.m, v[0]!);
    const zener = d.m.zener !== null && v[0]! < -0.5 * d.m.zener.uz;
    return { f: [r.i + G_MIN * v[0]!], J: [[r.g + G_MIN]], limexp: r.limited, region: zener ? "Durchbruch" : v[0]! > 0.5 * d.uf ? "leitend" : "sperrend" };
  }
  if (d.t === "bjt") {
    const r = bjtEval(d.m, v[0]!, v[1]!), s = d.m.polarity;
    const fwd = s * v[0]! > 0.5 * d.ubeRef, rev = s * v[1]! > 0.5 * d.ubeRef;
    const region = fwd && rev ? "gesättigt" : fwd ? "aktiv" : rev ? "invers" : "sperrend";
    // G_min parallel B–E und B–C: I_B += G_min (U_BE + U_BC), I_C −= G_min · U_BC
    return {
      f: [r.ic - G_MIN * v[1]!, r.ib + G_MIN * (v[0]! + v[1]!)],
      J: [[r.gcbe, r.gcbc - G_MIN], [r.gbbe + G_MIN, r.gbbc + G_MIN]], limexp: r.limited, region,
    };
  }
  const r = mosEval(d.m, v[0]!, v[1]!);
  return { f: [r.id + G_MIN * v[1]!], J: [[r.gm, r.gds + G_MIN]], limexp: false, region: r.region satisfies MosRegion };
}

/** Steuerknoten je Spannung: Diode [(j, k)], BJT [(b, e), (b, c)], MOSFET [(g, s), (d, s)]. */
const ctrl = (d: Device): [string, string][] => (d.t === "diode" ? [[d.j, d.k]] : d.t === "bjt" ? [[d.b, d.e], [d.b, d.c]] : [[d.g, d.s], [d.d, d.s]]);
/** Strompfade je Strom: Diode j → k, BJT I_C c → e, I_B b → e, MOSFET d → s. */
const paths = (d: Device): [string, string][] => (d.t === "diode" ? [[d.j, d.k]] : d.t === "bjt" ? [[d.c, d.e], [d.b, d.e]] : [[d.d, d.s]]);

/**
 * Begleitmodell als Primitive (EL-H08, EL-H13, EL-H19): je Strom f_r ≈ Σ_c J_rc · u_c + I_eq,r mit
 * I_eq,r = f_r − Σ_c J_rc · v_c. gstep: zusätzlicher Leitwert der G_min-Stufung (EL-K07) parallel zu den Übergängen.
 * withEq = false: nur die Leitwerte (Kleinsignal, EL-H20).
 */
export function stamps(d: Device, v: Volts, lin: Lin, gstep: number, withEq = true): Prim[] {
  const out: Prim[] = [], cs = ctrl(d), ps = paths(d);
  ps.forEach(([a, b], r) => {
    cs.forEach(([c, dd], col) => {
      const g = lin.J[r]![col]!;
      if (g !== 0) out.push(a === c && b === dd ? { t: "Y", a, b, y: cx(g), el: d.el, main: false } : { t: "G", a, b, c, d: dd, g: cx(g), el: d.el });
    });
    if (withEq) {
      const ieq = lin.f[r]! - cs.reduce((acc, _, col) => acc + lin.J[r]![col]! * v[col]!, 0);
      if (ieq !== 0) out.push({ t: "I", a, b, i: cx(-ieq), el: d.el });
    }
  });
  if (gstep > 0) for (const [a, b] of d.t === "mos" ? [[d.d, d.s] as [string, string]] : cs) out.push({ t: "Y", a, b, y: cx(gstep), el: d.el, main: false });
  return out;
}

/** Klemmenströme in das Bauteil hinein (Gleichstrom) aus den Strömen f. */
export function terminalCurrents(d: Device, f: number[]): Record<string, number> {
  if (d.t === "diode") return { anode: f[0]!, kathode: -f[0]! };
  if (d.t === "bjt") return { c: f[0]!, b: f[1]!, e: -(f[0]! + f[1]!) };
  return { d: f[0]!, s: -f[0]!, g: 0 };
}

/** Klemmen (Pinname → Knoten) für Leistung und Leitungsströme. */
export const devPins = (d: Device): Record<string, string> =>
  d.t === "diode" ? { anode: d.a, kathode: d.k } : d.t === "bjt" ? { b: d.b, c: d.c, e: d.e } : { g: d.g, d: d.d, s: d.s };

/** Kleinsignal-Klemmenströme (Wechselstrom) aus den Leitwerten der Jacobi-Matrix und den Zeigern der Steuerspannungen. */
export function smallSignalCurrents(d: Device, J: number[][], vc: Complex[]): Record<string, Complex> {
  const f = J.map((row) => row.reduce((acc, g, c) => ({ re: acc.re + g * vc[c]!.re, im: acc.im + g * vc[c]!.im }), C0));
  if (d.t === "diode") return { anode: f[0]!, kathode: { re: -f[0]!.re, im: -f[0]!.im } };
  if (d.t === "bjt") return { c: f[0]!, b: f[1]!, e: { re: -(f[0]!.re + f[1]!.re), im: -(f[0]!.im + f[1]!.im) } };
  return { d: f[0]!, s: { re: -f[0]!.re, im: -f[0]!.im }, g: C0 };
}
