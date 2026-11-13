/**
 * Vorlagen S1 bis S8 (Modul elektrik, EL-S1 bis EL-S8): Nachrechnen und Auslegen typischer Grundschaltungen.
 * Jede Vorlage rechnet ihre Schaltung zusätzlich mit der Knotenpunktanalyse (EL-N, EL-W) und vergleicht (EL-S0-GP).
 * Eingabeschlüssel wie in der App Stromwerk (src/modules/vorlagen/sheets.ts), SI-Einheiten. Auslegen: gesuchte Größe
 * rechnerisch, dann Normwert der gewählten E-Reihe (EL-E5: LED-Vorwiderstand nächsthöher, sonst nächstliegend),
 * anschließend Nachrechnen mit dem Normwert.
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace } from "../trace";
import { voltageDivider } from "./basics";
import { cabs, carg } from "./complex";
import { solveAc, solveDc, type ElElement, type ElFinding, type ElGroup, type ElNetlist } from "./network";
import { eSeriesPick, isESeries, type ESeries } from "./tables";

export type SheetId = "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8";
export const SHEET_IDS: readonly SheetId[] = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];
export type SheetMode = "nachrechnen" | "auslegen";
export interface ElKpi { key: string; label: string; value: number | null; unit: string; status?: "ok" | "warn" | "fail" }
export interface ElCurve { key: string; label: string; xLabel: string; xUnit: string; yLabel: string; yUnit: string; logX: boolean; points: { x: number; y: number }[] }
export interface SheetResult { ok: boolean; kpis: ElKpi[]; curves: ElCurve[]; findings: ElFinding[]; trace: Trace<ElGroup> }

/** Toleranz der Gegenprüfung analytisch gegen Netzwerk (relativ). */
export const GP_TOL = 1e-9;
/** Zielwert für die Ladezeit (EL-S6-TZ): 99 % der Endspannung. */
export const T_TARGET = 0.99;
const f6 = (x: number): string => fmt(x, 6);
const PI2 = 2 * Math.PI;
const DEG = 180 / Math.PI;

class Ctx {
  steps: CalcStep[] = [];
  findings: ElFinding[] = [];
  kpis: ElKpi[] = [];
  curves: ElCurve[] = [];
  bad = false;
  constructor(readonly inp: Readonly<Record<string, number>>) {}
  s(id: string, title: string, formula: string, subst: string, value: number, unit: string): number { this.steps.push(step(id, title, formula, subst, value, unit)); return value; }
  get(key: string, name: string, opt: { positive?: boolean; min?: number; def?: number } = {}): number {
    const v = this.inp[key] ?? opt.def;
    if (typeof v !== "number" || !Number.isFinite(v)) { this.fail(`${name} fehlt`); return NaN; }
    if (opt.positive && !(v > 0)) { this.fail(`${name} muss größer 0 sein`); return NaN; }
    if (opt.min !== undefined && v < opt.min) { this.fail(`${name} muss mindestens ${opt.min} sein`); return NaN; }
    return v;
  }
  fail(text: string): void { this.findings.push({ level: "fail", text }); this.bad = true; }
  kpi(key: string, label: string, value: number | null, unit: string, status?: ElKpi["status"]): void { this.kpis.push(status ? { key, label, value, unit, status } : { key, label, value, unit }); }
  series(): ESeries { const n = this.inp["e_reihe"] ?? 24; return isESeries(n) ? n : 24; }
  /** Normwert (EL-S0-N nächstliegend, EL-S0-NH nächsthöher). */
  norm(x: number, unit: string, name: string, higher = false): number {
    const n = this.series(), p = eSeriesPick(x, n);
    if (!p) { this.fail(`${name}: kein Normwert bestimmbar`); return NaN; }
    const v = higher ? p.upper : p.nearest;
    this.s(higher ? "EL-S0-NH" : "EL-S0-N", `${name}: Normwert E${n}${higher ? " (nächsthöher)" : ""}`, higher ? "X_N = kleinster Normwert ≥ X" : "X_N = nächster Normwert (logarithmischer Abstand)", `X = ${f6(x)} ${unit} → X_N = ${f6(v)} ${unit}`, v, unit);
    return v;
  }
  gp(name: string, analytic: number, mna: number | null, unit: string): void {
    if (mna === null) { this.findings.push({ level: "warn", text: `Gegenprüfung ${name}: Netzwerk nicht lösbar` }); return; }
    const dev = analytic === 0 ? Math.abs(mna) : Math.abs(analytic - mna) / Math.abs(analytic);
    this.s("EL-S0-GP", `Gegenprüfung ${name}: analytisch gegen Netzwerk`, "δ = |X_analytisch − X_Netz| / |X_analytisch|", `δ = |${f6(analytic)} − ${f6(mna)}| ${unit} / ${f6(Math.abs(analytic))} ${unit}`, dev, "1");
    if (dev > GP_TOL) this.fail(`Gegenprüfung ${name}: Abweichung ${fmt(dev)}`);
  }
  curve(c: Omit<ElCurve, "points">, xs: readonly number[], f: (x: number) => number): void {
    this.curves.push({ ...c, points: xs.map((x) => ({ x, y: f(x) })).filter((p) => Number.isFinite(p.y)) });
  }
  result(): SheetResult { return { ok: !this.bad, kpis: this.kpis, curves: this.curves, findings: this.findings, trace: this.steps.length ? { vorlage: this.steps } : {} }; }
}

const logspace = (a: number, b: number, n: number): number[] => Array.from({ length: n }, (_, k) => a * (b / a) ** (k / (n - 1)));
const linspace = (a: number, b: number, n: number): number[] => Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1));
const el = (id: string, kind: string, pins: Record<string, string>, params: Record<string, number | string | boolean> = {}): ElElement => ({ id, kind, pins, params, label: id });
const netOf = (nodes: string[], elements: ElElement[]): ElNetlist => ({ nodes, ground: "0", elements: [...elements, el("GND", "masse", { a: "0" })] });

function s1(c: Ctx, mode: SheetMode): void {
  const U = c.get("u_V", "Eingangsspannung U"), R1 = c.get("r1_ohm", "R1", { positive: true }), RL = c.get("r_last_ohm", "Lastwiderstand R_L", { positive: true });
  let R2 = mode === "auslegen" ? NaN : c.get("r2_ohm", "R2", { positive: true });
  if (mode === "auslegen") {
    const U2 = c.get("u2_V", "Zielspannung U_2");
    if (!(U2 > 0 && U2 < U)) { c.fail("Zielspannung U_2 muss zwischen 0 und U liegen"); return; }
    const r = c.s("EL-S1-R2", "R2 für die Zielspannung (unbelastet)", "R_2 = R_1 · U_2 / (U − U_2)", `R_2 = ${f6(R1)} Ω · ${f6(U2)} V / (${f6(U)} V − ${f6(U2)} V)`, (R1 * U2) / (U - U2), "Ω");
    c.kpi("r2_ohm", "R2 rechnerisch", r, "Ω");
    R2 = c.norm(r, "Ω", "R2"); c.kpi("r2_norm", `R2 Normwert E${c.series()}`, R2, "Ω");
  }
  if (c.bad) return;
  const d = voltageDivider(U, R1, R2); c.steps.push(...d.steps); const U2 = d.value;
  const R2L = c.s("EL-S1-RP", "R2 parallel zur Last", "R_2L = R_2 · R_L / (R_2 + R_L)", `R_2L = ${f6(R2)} Ω · ${f6(RL)} Ω / (${f6(R2)} Ω + ${f6(RL)} Ω)`, (R2 * RL) / (R2 + RL), "Ω");
  const U2L = c.s("EL-S1-U2L", "Belastete Ausgangsspannung", "U_2L = U · R_2L / (R_1 + R_2L)", `U_2L = ${f6(U)} V · ${f6(R2L)} Ω / (${f6(R1)} Ω + ${f6(R2L)} Ω)`, (U * R2L) / (R1 + R2L), "V");
  const IL = c.s("EL-S1-IL", "Laststrom", "I_L = U_2L / R_L", `I_L = ${f6(U2L)} V / ${f6(RL)} Ω`, U2L / RL, "A");
  const Iq = c.s("EL-S1-IQ", "Querstrom durch R2", "I_q = U_2L / R_2", `I_q = ${f6(U2L)} V / ${f6(R2)} Ω`, U2L / R2, "A");
  const q = c.s("EL-S1-Q", "Querstromverhältnis", "q = I_q / I_L", `q = ${f6(Iq)} A / ${f6(IL)} A`, Iq / IL, "1");
  const du = U2 === 0 ? 0 : c.s("EL-S1-DU", "Spannungseinbruch durch die Last", "ΔU = (U_2 − U_2L) / U_2", `ΔU = (${f6(U2)} V − ${f6(U2L)} V) / ${f6(U2)} V`, (U2 - U2L) / U2, "1");
  c.kpi("u2_V", "U2 unbelastet", U2, "V"); c.kpi("u2l_V", "U2 mit Last", U2L, "V"); c.kpi("il_A", "Laststrom I_L", IL, "A"); c.kpi("iq_A", "Querstrom I_q", Iq, "A"); c.kpi("q", "Querstromverhältnis q", q, "1"); c.kpi("du", "Spannungseinbruch ΔU", du, "1");
  c.curve({ key: "u2l", label: "Ausgangsspannung über Lastwiderstand", xLabel: "R_L", xUnit: "Ω", yLabel: "U_2L", yUnit: "V", logX: true }, logspace(R2 / 100, R2 * 1000, 61), (rl) => (U * ((R2 * rl) / (R2 + rl))) / (R1 + (R2 * rl) / (R2 + rl)));
  const r = solveDc(netOf(["1", "2", "0"], [el("U1", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: U }), el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: R1 }), el("R2", "widerstand", { a: "2", b: "0" }, { r_ohm: R2 }), el("RL", "widerstand", { a: "2", b: "0" }, { r_ohm: RL })]));
  c.gp("U_2L", U2L, r.ok ? r.nodes["2"]! : null, "V");
}

function rc(c: Ctx, mode: SheetMode, high: boolean): void {
  const U = c.get("u_V", "Eingangsspannung U"), f = c.get("f_Hz", "Frequenz f", { positive: true });
  let R = high && mode === "auslegen" ? NaN : c.get("r_ohm", "R", { positive: true });
  let C = !high && mode === "auslegen" ? NaN : c.get("c_F", "C", { positive: true });
  if (mode === "auslegen") {
    const fg = c.get("fg_Hz", "Grenzfrequenz f_g", { positive: true }); if (c.bad) return;
    if (high) { const r = c.s("EL-S3-R", "R für die Grenzfrequenz", "R = 1 / (2π · f_g · C)", `R = 1 / (2π · ${f6(fg)} Hz · ${f6(C)} F)`, 1 / (PI2 * fg * C), "Ω"); c.kpi("r_ohm", "R rechnerisch", r, "Ω"); R = c.norm(r, "Ω", "R"); c.kpi("r_norm", `R Normwert E${c.series()}`, R, "Ω"); }
    else { const cc = c.s("EL-S2-C", "C für die Grenzfrequenz", "C = 1 / (2π · f_g · R)", `C = 1 / (2π · ${f6(fg)} Hz · ${f6(R)} Ω)`, 1 / (PI2 * fg * R), "F"); c.kpi("c_F", "C rechnerisch", cc, "F"); C = c.norm(cc, "F", "C"); c.kpi("c_norm", `C Normwert E${c.series()}`, C, "F"); }
  }
  if (c.bad) return;
  const tau = c.s("EL-S2-TAU", "Zeitkonstante", "τ = R · C", `τ = ${f6(R)} Ω · ${f6(C)} F`, R * C, "s");
  const fg = c.s("EL-S2-FG", "Grenzfrequenz", "f_g = 1 / (2π · R · C)", `f_g = 1 / (2π · ${f6(R)} Ω · ${f6(C)} F)`, 1 / (PI2 * R * C), "Hz");
  const x = f / fg;
  const H = high ? c.s("EL-S3-H", "Betrag der Übertragungsfunktion (Hochpass)", "|H| = (f / f_g) / √(1 + (f / f_g)²)", `|H| = ${f6(x)} / √(1 + ${f6(x)}²)`, x / Math.sqrt(1 + x * x), "1")
    : c.s("EL-S2-H", "Betrag der Übertragungsfunktion (Tiefpass)", "|H| = 1 / √(1 + (f / f_g)²)", `|H| = 1 / √(1 + ${f6(x)}²)`, 1 / Math.sqrt(1 + x * x), "1");
  const G = c.s("EL-W06-DB", "Verstärkung", "G = 20 · lg |H|", `G = 20 · lg ${f6(H)}`, 20 * Math.log10(H), "dB");
  const phi = high ? c.s("EL-S3-PHI", "Phase (Hochpass)", "φ = 90° − arctan(f / f_g)", `φ = 90° − arctan ${f6(x)}`, 90 - Math.atan(x) * DEG, "°")
    : c.s("EL-S2-PHI", "Phase (Tiefpass)", "φ = −arctan(f / f_g)", `φ = −arctan ${f6(x)}`, -Math.atan(x) * DEG, "°");
  const Ua = c.s("EL-S0-UA", "Ausgangsspannung", "U_a = |H| · U_e", `U_a = ${f6(H)} · ${f6(U)} V`, H * U, "V");
  c.kpi("fg_Hz", "Grenzfrequenz f_g", fg, "Hz"); c.kpi("tau_s", "Zeitkonstante τ", tau, "s"); c.kpi("h", "|H| bei f", H, "1"); c.kpi("g_dB", "Verstärkung bei f", G, "dB"); c.kpi("phi_deg", "Phase bei f", phi, "°"); c.kpi("ua_V", "Ausgangsspannung U_a", Ua, "V");
  const fs = logspace(fg / 1000, fg * 1000, 121);
  const h = (ff: number): number => { const y = ff / fg; return high ? y / Math.sqrt(1 + y * y) : 1 / Math.sqrt(1 + y * y); };
  c.curve({ key: "gain", label: "Amplitudengang", xLabel: "f", xUnit: "Hz", yLabel: "G", yUnit: "dB", logX: true }, fs, (ff) => 20 * Math.log10(h(ff)));
  c.curve({ key: "phase", label: "Phasengang", xLabel: "f", xUnit: "Hz", yLabel: "φ", yUnit: "°", logX: true }, fs, (ff) => (high ? 90 - Math.atan(ff / fg) * DEG : -Math.atan(ff / fg) * DEG));
  const a = high ? el("C1", "kondensator", { a: "1", b: "2" }, { c_F: C }) : el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: R });
  const b = high ? el("R1", "widerstand", { a: "2", b: "0" }, { r_ohm: R }) : el("C1", "kondensator", { a: "2", b: "0" }, { c_F: C });
  const r = solveAc(netOf(["1", "2", "0"], [el("AC1", "wechselspannungsquelle", { plus: "1", minus: "0" }, { u_eff_V: U === 0 ? 1 : U, f_Hz: f, phase_deg: 0 }), a, b]), f);
  if (r.ok) { const u2 = r.nodes["2"]!, u1 = r.nodes["1"]!; c.gp("|H|", H, cabs(u2) / cabs(u1), "1"); c.gp("φ", phi, (carg(u2) - carg(u1)) * DEG, "°"); } else c.gp("|H|", H, null, "1");
}

function s4(c: Ctx, mode: SheetMode): void {
  const U = c.get("u_V", "Eingangsspannung U"), R = c.get("r_ohm", "R", { positive: true }), L = c.get("l_H", "L", { positive: true });
  let C = mode === "auslegen" ? NaN : c.get("c_F", "C", { positive: true });
  if (mode === "auslegen") {
    const f0 = c.get("f0_Hz", "Resonanzfrequenz f_0", { positive: true }); if (c.bad) return;
    const cc = c.s("EL-S4-C", "C für die Resonanzfrequenz", "C = 1 / ((2π · f_0)² · L)", `C = 1 / ((2π · ${f6(f0)} Hz)² · ${f6(L)} H)`, 1 / ((PI2 * f0) ** 2 * L), "F");
    c.kpi("c_F", "C rechnerisch", cc, "F"); C = c.norm(cc, "F", "C"); c.kpi("c_norm", `C Normwert E${c.series()}`, C, "F");
  }
  if (c.bad) return;
  const f0 = c.s("EL-S4-F0", "Resonanzfrequenz", "f_0 = 1 / (2π · √(L · C))", `f_0 = 1 / (2π · √(${f6(L)} H · ${f6(C)} F))`, 1 / (PI2 * Math.sqrt(L * C)), "Hz");
  const Q = c.s("EL-S4-Q", "Güte", "Q = (1 / R) · √(L / C)", `Q = (1 / ${f6(R)} Ω) · √(${f6(L)} H / ${f6(C)} F)`, Math.sqrt(L / C) / R, "1");
  const B = c.s("EL-S4-B", "Bandbreite", "B = f_0 / Q", `B = ${f6(f0)} Hz / ${f6(Q)}`, f0 / Q, "Hz");
  const k = Math.sqrt(1 + 1 / (4 * Q * Q));
  const fu = c.s("EL-S4-FU", "Untere Grenzfrequenz", "f_u = f_0 · (√(1 + 1 / (4Q²)) − 1 / (2Q))", `f_u = ${f6(f0)} Hz · (√(1 + 1 / (4 · ${f6(Q)}²)) − 1 / (2 · ${f6(Q)}))`, f0 * (k - 1 / (2 * Q)), "Hz");
  const fo = c.s("EL-S4-FO", "Obere Grenzfrequenz", "f_o = f_0 · (√(1 + 1 / (4Q²)) + 1 / (2Q))", `f_o = ${f6(f0)} Hz · (√(1 + 1 / (4 · ${f6(Q)}²)) + 1 / (2 · ${f6(Q)}))`, f0 * (k + 1 / (2 * Q)), "Hz");
  const I0 = c.s("EL-S4-I0", "Strom bei Resonanz", "I_0 = U / R", `I_0 = ${f6(U)} V / ${f6(R)} Ω`, U / R, "A");
  const UC = c.s("EL-S4-UC", "Kondensatorspannung bei Resonanz", "U_C0 = Q · U", `U_C0 = ${f6(Q)} · ${f6(U)} V`, Q * U, "V");
  c.kpi("f0_Hz", "Resonanzfrequenz f_0", f0, "Hz"); c.kpi("q", "Güte Q", Q, "1"); c.kpi("b_Hz", "Bandbreite B", B, "Hz"); c.kpi("fu_Hz", "Untere Grenzfrequenz f_u", fu, "Hz"); c.kpi("fo_Hz", "Obere Grenzfrequenz f_o", fo, "Hz"); c.kpi("i0_A", "Strom bei Resonanz I_0", I0, "A");
  c.kpi("uc0_V", "Kondensatorspannung U_C0", UC, "V", UC > U ? "warn" : undefined);
  if (UC > U) c.findings.push({ level: "warn", text: `Spannungsüberhöhung: U_C0 = ${fmt(Q)} · U` });
  const hr = (f: number): number => 1 / Math.sqrt(1 + Q * Q * (f / f0 - f0 / f) ** 2);
  const fs = logspace(f0 / 100, f0 * 100, 161);
  c.curve({ key: "hr", label: "Strom bezogen I / I_0 (Bandpass, Spannung an R)", xLabel: "f", xUnit: "Hz", yLabel: "|H_R|", yUnit: "dB", logX: true }, fs, (f) => 20 * Math.log10(hr(f)));
  c.curve({ key: "hc", label: "Kondensatorspannung U_C / U", xLabel: "f", xUnit: "Hz", yLabel: "U_C / U", yUnit: "1", logX: true }, fs, (f) => hr(f) / (PI2 * f * R * C));
  c.s("EL-S4-H", "Bandpass bei f_u (Kontrolle 1/√2)", "|H_R| = 1 / √(1 + Q² · (f / f_0 − f_0 / f)²)", `|H_R(f_u)| = 1 / √(1 + ${f6(Q)}² · (${f6(fu / f0)} − ${f6(f0 / fu)})²)`, hr(fu), "1");
  c.s("EL-S4-HC", "Kondensatorspannung bei f_0", "U_C / U = |H_R| / (ω · R · C)", `U_C / U = 1 / (2π · ${f6(f0)} Hz · ${f6(R)} Ω · ${f6(C)} F)`, hr(f0) / (PI2 * f0 * R * C), "1");
  const r = solveAc(netOf(["1", "2", "3", "0"], [el("AC1", "wechselspannungsquelle", { plus: "1", minus: "0" }, { u_eff_V: U === 0 ? 1 : U, f_Hz: f0, phase_deg: 0 }), el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: R }), el("L1", "spule", { a: "2", b: "3" }, { l_H: L, r_ohm: 0 }), el("C1", "kondensator", { a: "3", b: "0" }, { c_F: C })]), f0);
  const us = U === 0 ? 1 : U;
  c.gp("I_0", I0 === 0 ? us / R : I0, r.ok ? cabs(r.elements["R1"]!.i) : null, "A");
  c.gp("U_C0", UC === 0 ? Q * us : UC, r.ok ? cabs(r.elements["C1"]!.u) : null, "V");
}

function s5(c: Ctx, mode: SheetMode): void {
  const U = c.get("u_V", "Versorgung U"), UF = c.get("u_f_V", "Flussspannung U_F", { min: 0 }), IF = c.get("i_f_A", "LED-Strom I_F", { positive: true });
  if (c.bad) return;
  if (!(U > UF)) { c.fail("Versorgung U muss größer als die Flussspannung U_F sein"); return; }
  let R = mode === "auslegen" ? NaN : c.get("r_ohm", "Vorwiderstand R", { positive: true });
  if (mode === "auslegen") {
    const r = c.s("EL-S5-R", "Vorwiderstand für den LED-Strom", "R = (U − U_F) / I_F", `R = (${f6(U)} V − ${f6(UF)} V) / ${f6(IF)} A`, (U - UF) / IF, "Ω");
    c.kpi("r_ohm", "R rechnerisch", r, "Ω"); R = c.norm(r, "Ω", "R", true); c.kpi("r_norm", `R Normwert E${c.series()} (nächsthöher)`, R, "Ω");
  }
  if (c.bad) return;
  const I = c.s("EL-S5-I", "LED-Strom", "I = (U − U_F) / R", `I = (${f6(U)} V − ${f6(UF)} V) / ${f6(R)} Ω`, (U - UF) / R, "A");
  const PR = c.s("EL-S5-PR", "Leistung im Vorwiderstand", "P_R = I² · R", `P_R = (${f6(I)} A)² · ${f6(R)} Ω`, I * I * R, "W");
  const PL = c.s("EL-S5-PL", "Leistung in der LED", "P_LED = U_F · I", `P_LED = ${f6(UF)} V · ${f6(I)} A`, UF * I, "W");
  const over = I > IF * (1 + 1e-12);
  c.kpi("i_A", "LED-Strom I", I, "A", over ? "warn" : "ok"); c.kpi("pr_W", "Leistung im Vorwiderstand P_R", PR, "W"); c.kpi("pled_W", "Leistung in der LED", PL, "W");
  if (over) c.findings.push({ level: "warn", text: `LED-Strom ${fmt(I * 1000)} mA über I_F = ${fmt(IF * 1000)} mA` });
  c.curve({ key: "i", label: "LED-Strom über Vorwiderstand", xLabel: "R", xUnit: "Ω", yLabel: "I", yUnit: "A", logX: true }, logspace(R / 10, R * 10, 61), (r) => (U - UF) / r);
  const net = netOf(["1", "2", "0"], [el("U1", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: U }), el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: R }), el("UF", "gleichspannungsquelle", { plus: "2", minus: "0" }, { u_V: UF })]);
  const r = solveDc(net);
  c.gp("I (LED als Quelle U_F)", I, r.ok ? r.elements["R1"]!.i : null, "A");
}

function s6(c: Ctx, mode: SheetMode): void {
  const U = c.get("u_V", "Ladespannung U"), C = c.get("c_F", "C", { positive: true }), t = c.get("t_s", "Betrachtungszeit t", { min: 0 });
  let R = mode === "auslegen" ? NaN : c.get("r_ohm", "R", { positive: true });
  if (mode === "auslegen") {
    const tau = c.get("tau_s", "Zeitkonstante τ", { positive: true }); if (c.bad) return;
    const r = c.s("EL-S6-R", "R für die Zeitkonstante", "R = τ / C", `R = ${f6(tau)} s / ${f6(C)} F`, tau / C, "Ω");
    c.kpi("r_ohm", "R rechnerisch", r, "Ω"); R = c.norm(r, "Ω", "R"); c.kpi("r_norm", `R Normwert E${c.series()}`, R, "Ω");
  }
  if (c.bad) return;
  const tau = c.s("EL-S6-TAU", "Zeitkonstante", "τ = R · C", `τ = ${f6(R)} Ω · ${f6(C)} F`, R * C, "s");
  const e = Math.exp(-t / tau);
  const ul = c.s("EL-S6-UL", "Kondensatorspannung beim Laden", "u_C(t) = U · (1 − e^(−t/τ))", `u_C = ${f6(U)} V · (1 − e^(−${f6(t)} s / ${f6(tau)} s))`, U * (1 - e), "V");
  const ue = c.s("EL-S6-UE", "Kondensatorspannung beim Entladen", "u_C(t) = U · e^(−t/τ)", `u_C = ${f6(U)} V · e^(−${f6(t)} s / ${f6(tau)} s)`, U * e, "V");
  const i = c.s("EL-S6-I", "Lade- bzw. Entladestrom (Betrag)", "i(t) = (U / R) · e^(−t/τ)", `i = (${f6(U)} V / ${f6(R)} Ω) · e^(−${f6(t)} s / ${f6(tau)} s)`, (U / R) * e, "A");
  const tz = c.s("EL-S6-TZ", `Ladezeit bis ${fmt(T_TARGET * 100)} %`, "t = −τ · ln(1 − u / U)", `t = −${f6(tau)} s · ln(1 − ${f6(T_TARGET)})`, -tau * Math.log(1 - T_TARGET), "s");
  const te = c.s("EL-S6-TE", `Entladezeit bis ${fmt((1 - T_TARGET) * 100)} %`, "t = −τ · ln(u / U)", `t = −${f6(tau)} s · ln ${f6(1 - T_TARGET)}`, -tau * Math.log(1 - T_TARGET), "s");
  const W = c.s("EL-S6-W", "Gespeicherte Energie (voll geladen)", "W = ½ · C · U²", `W = ½ · ${f6(C)} F · (${f6(U)} V)²`, 0.5 * C * U * U, "J");
  c.kpi("tau_s", "Zeitkonstante τ", tau, "s"); c.kpi("ul_V", "u_C(t) Laden", ul, "V"); c.kpi("ue_V", "u_C(t) Entladen", ue, "V"); c.kpi("i_A", "Strom i(t)", i, "A"); c.kpi("t99_s", "Ladezeit bis 99 %", tz, "s"); c.kpi("t01_s", "Entladezeit bis 1 %", te, "s"); c.kpi("w_J", "Energie W", W, "J");
  const ts = linspace(0, 5 * tau, 101);
  c.curve({ key: "ul", label: "Laden u_C(t)", xLabel: "t", xUnit: "s", yLabel: "u_C", yUnit: "V", logX: false }, ts, (x) => U * (1 - Math.exp(-x / tau)));
  c.curve({ key: "ue", label: "Entladen u_C(t)", xLabel: "t", xUnit: "s", yLabel: "u_C", yUnit: "V", logX: false }, ts, (x) => U * Math.exp(-x / tau));
  c.curve({ key: "i", label: "Strom i(t)", xLabel: "t", xUnit: "s", yLabel: "i", yUnit: "A", logX: false }, ts, (x) => (U / R) * Math.exp(-x / tau));
  const r = solveDc(netOf(["1", "2", "0"], [el("U1", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: U }), el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: R }), el("C1", "kondensator", { a: "2", b: "0" }, { c_F: C })]));
  c.gp("u_C(t → ∞) = U", U, r.ok ? r.nodes["2"]! : null, "V");
}

function s7(c: Ctx, mode: SheetMode): void {
  const U = c.get("u_V", "Speisespannung U"), R1 = c.get("r1_ohm", "R1", { positive: true }), R2 = c.get("r2_ohm", "R2", { positive: true }), R3 = c.get("r3_ohm", "R3", { positive: true });
  let R4 = mode === "auslegen" ? NaN : c.get("r4_ohm", "R4", { positive: true });
  if (c.bad) return;
  if (mode === "auslegen") {
    const r = c.s("EL-S7-R4", "R4 für den Abgleich (U_d = 0)", "R_4 = R_3 · R_2 / R_1", `R_4 = ${f6(R3)} Ω · ${f6(R2)} Ω / ${f6(R1)} Ω`, (R3 * R2) / R1, "Ω");
    c.kpi("r4_ohm", "R4 rechnerisch", r, "Ω"); R4 = c.norm(r, "Ω", "R4"); c.kpi("r4_norm", `R4 Normwert E${c.series()}`, R4, "Ω");
  }
  const Ud = c.s("EL-S7-UD", "Brückenspannung", "U_d = U · (R_2 / (R_1 + R_2) − R_4 / (R_3 + R_4))", `U_d = ${f6(U)} V · (${f6(R2)} / ${f6(R1 + R2)} − ${f6(R4)} / ${f6(R3 + R4)})`, U * (R2 / (R1 + R2) - R4 / (R3 + R4)), "V");
  const bal = Math.abs(Ud) <= 1e-12 * Math.max(Math.abs(U), 1e-300);
  c.kpi("ud_V", "Brückenspannung U_d", Ud, "V", bal ? "ok" : undefined);
  c.curve({ key: "ud", label: "Brückenspannung über R4", xLabel: "R_4", xUnit: "Ω", yLabel: "U_d", yUnit: "V", logX: true }, logspace(R4 / 10, R4 * 10, 61), (r4) => U * (R2 / (R1 + R2) - r4 / (R3 + r4)));
  const r = solveDc(netOf(["1", "2", "3", "0"], [el("U1", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: U }), el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: R1 }), el("R2", "widerstand", { a: "2", b: "0" }, { r_ohm: R2 }), el("R3", "widerstand", { a: "1", b: "3" }, { r_ohm: R3 }), el("R4", "widerstand", { a: "3", b: "0" }, { r_ohm: R4 }), el("V1", "voltmeter", { a: "2", b: "3" })]));
  // Bei Abgleich ist U_d = 0; Vergleich dann absolut über die Teilspannung
  if (r.ok) { if (bal) c.gp("Teilspannung u_2 im Abgleich", (U * R2) / (R1 + R2), r.nodes["2"]!, "V"); else c.gp("U_d", Ud, r.elements["V1"]!.u, "V"); } else c.gp("U_d", Ud, null, "V");
}

function s8(c: Ctx, mode: SheetMode): void {
  const U = c.get("u_V", "Spannung U"), R = c.get("r_ohm", "R", { positive: true }), t = c.get("t_s", "Betrachtungszeit t", { min: 0 });
  let L = mode === "auslegen" ? NaN : c.get("l_H", "L", { positive: true });
  if (mode === "auslegen") {
    const tau = c.get("tau_s", "Zeitkonstante τ", { positive: true }); if (c.bad) return;
    const l = c.s("EL-S8-L", "L für die Zeitkonstante", "L = τ · R", `L = ${f6(tau)} s · ${f6(R)} Ω`, tau * R, "H");
    c.kpi("l_H", "L rechnerisch", l, "H"); L = c.norm(l, "H", "L"); c.kpi("l_norm", `L Normwert E${c.series()}`, L, "H");
  }
  if (c.bad) return;
  const tau = c.s("EL-S8-TAU", "Zeitkonstante", "τ = L / R", `τ = ${f6(L)} H / ${f6(R)} Ω`, L / R, "s");
  const e = Math.exp(-t / tau);
  const Ie = c.s("EL-S8-IE", "Endstrom", "I_∞ = U / R", `I_∞ = ${f6(U)} V / ${f6(R)} Ω`, U / R, "A");
  const i = c.s("EL-S8-I", "Strom beim Einschalten", "i(t) = (U / R) · (1 − e^(−t/τ))", `i = ${f6(Ie)} A · (1 − e^(−${f6(t)} s / ${f6(tau)} s))`, Ie * (1 - e), "A");
  const ul = c.s("EL-S8-UL", "Spulenspannung beim Einschalten", "u_L(t) = U · e^(−t/τ)", `u_L = ${f6(U)} V · e^(−${f6(t)} s / ${f6(tau)} s)`, U * e, "V");
  const W = c.s("EL-S8-W", "Gespeicherte Energie (Endstrom)", "W = ½ · L · I_∞²", `W = ½ · ${f6(L)} H · (${f6(Ie)} A)²`, 0.5 * L * Ie * Ie, "J");
  c.kpi("tau_s", "Zeitkonstante τ", tau, "s"); c.kpi("i_A", "Strom i(t)", i, "A"); c.kpi("ul_V", "Spulenspannung u_L(t)", ul, "V"); c.kpi("ie_A", "Endstrom I_∞", Ie, "A"); c.kpi("w_J", "Energie W", W, "J");
  const ts = linspace(0, 5 * tau, 101);
  c.curve({ key: "i", label: "Strom i(t)", xLabel: "t", xUnit: "s", yLabel: "i", yUnit: "A", logX: false }, ts, (x) => Ie * (1 - Math.exp(-x / tau)));
  c.curve({ key: "ul", label: "Spulenspannung u_L(t)", xLabel: "t", xUnit: "s", yLabel: "u_L", yUnit: "V", logX: false }, ts, (x) => U * Math.exp(-x / tau));
  const r = solveDc(netOf(["1", "2", "0"], [el("U1", "gleichspannungsquelle", { plus: "1", minus: "0" }, { u_V: U }), el("R1", "widerstand", { a: "1", b: "2" }, { r_ohm: R }), el("L1", "spule", { a: "2", b: "0" }, { l_H: L, r_ohm: 0 })]));
  c.gp("I_∞", Ie, r.ok ? r.elements["L1"]!.i : null, "A");
}

/** Vorlage rechnen. Unbekannte Vorlage oder ungültige Eingaben ergeben ok = false mit Hinweis. */
export function computeSheet(id: SheetId, mode: SheetMode, inputs: Readonly<Record<string, number>>): SheetResult {
  const c = new Ctx(inputs);
  switch (id) {
    case "S1": s1(c, mode); break;
    case "S2": rc(c, mode, false); break;
    case "S3": rc(c, mode, true); break;
    case "S4": s4(c, mode); break;
    case "S5": s5(c, mode); break;
    case "S6": s6(c, mode); break;
    case "S7": s7(c, mode); break;
    case "S8": s8(c, mode); break;
    default: c.fail(`Vorlage ${String(id)} unbekannt`);
  }
  return c.result();
}
