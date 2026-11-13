/**
 * Rechner R1 bis R6 (Modul elektrik, EL-R1 bis EL-R6). Eingabeschlüssel wie in der App Stromwerk
 * (src/modules/rechner/tools.ts). SI intern; Anzeigegrößen (Wh, h, 1/min) werden als zusätzliche Kennwerte ausgegeben.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { ohm, OHM_GIVEN, type OhmGiven } from "./basics";
import type { ElFinding } from "./network";
import type { ElKpi, SheetResult } from "./sheets";
import { COLOUR_CODE, COLOURS, E_SERIES, clean, eSeriesPick, isESeries, scaled, type Colour } from "./tables";

export type ToolId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";
export const TOOL_IDS: readonly ToolId[] = ["R1", "R2", "R3", "R4", "R5", "R6"];
const f6 = (x: number): string => fmt(x, 6);
const S3 = Math.sqrt(3);

type Inp = Readonly<Record<string, number | string>>;
class T {
  steps: CalcStep[] = []; kpis: ElKpi[] = []; findings: ElFinding[] = []; bad = false;
  constructor(readonly inp: Inp) {}
  s(id: string, title: string, formula: string, subst: string, value: number, unit: string): number { this.steps.push(step(id, title, formula, subst, value, unit)); return value; }
  n(key: string, name: string, opt: { positive?: boolean; min?: number; max?: number; def?: number } = {}): number {
    const raw = this.inp[key] ?? opt.def, v = typeof raw === "string" ? Number(raw.replace(",", ".")) : raw;
    if (typeof v !== "number" || !Number.isFinite(v)) { this.fail(`${name} fehlt`); return NaN; }
    if (opt.positive && !(v > 0)) { this.fail(`${name} muss größer 0 sein`); return NaN; }
    if (opt.min !== undefined && v < opt.min) { this.fail(`${name} muss mindestens ${opt.min} sein`); return NaN; }
    if (opt.max !== undefined && v > opt.max) { this.fail(`${name} darf höchstens ${opt.max} sein`); return NaN; }
    return v;
  }
  str(key: string, def: string): string { const v = this.inp[key]; return typeof v === "string" ? v : typeof v === "number" ? String(v) : def; }
  fail(text: string): void { this.findings.push({ level: "fail", text }); this.bad = true; }
  kpi(key: string, label: string, value: number | null, unit: string, status?: ElKpi["status"]): void { this.kpis.push(status ? { key, label, value, unit, status } : { key, label, value, unit }); }
  result(): SheetResult { return { ok: !this.bad, kpis: this.kpis, curves: [], findings: this.findings, trace: this.steps.length ? { rechner: this.steps } : {} }; }
}

const isColour = (c: string): c is Colour => (COLOURS as readonly string[]).includes(c);

/** EL-R1 Farbcode (IEC 60062): 4 Ringe (2 Ziffern) oder 5 Ringe (3 Ziffern), Multiplikator, Toleranz. */
function r1(t: T): void {
  const rings = t.str("ringe", "4") === "5" ? 5 : 4, nd = rings - 2;
  const cols = Array.from({ length: rings }, (_, k) => t.str(`ring${k + 1}`, ""));
  const bad = cols.find((c) => !isColour(c));
  if (bad !== undefined) { t.fail(`Farbe „${bad}“ unbekannt`); return; }
  const cs = cols as Colour[];
  const digits = cs.slice(0, nd).map((c) => COLOUR_CODE[c].digit);
  if (digits.some((d) => d === null)) { t.fail("Gold und Silber sind keine Ziffernringe"); return; }
  const mult = COLOUR_CODE[cs[nd]!], tolC = COLOUR_CODE[cs[nd + 1]!];
  if (tolC.tol === null) { t.fail(`${cs[nd + 1]} ist kein Toleranzring`); return; }
  const z = digits as number[], mant = z.reduce((s, d) => s * 10 + d, 0), R = scaled(mant, mult.exp);
  if (nd === 2) t.s("EL-R1", "Widerstand aus 4 Ringen", "R = (10 · z_1 + z_2) · 10^m", `R = (10 · ${z[0]} + ${z[1]}) · 10^${mult.exp} Ω (${cs.slice(0, 3).join(", ")})`, R, "Ω");
  else t.s("EL-R1-5", "Widerstand aus 5 Ringen", "R = (100 · z_1 + 10 · z_2 + z_3) · 10^m", `R = (100 · ${z[0]} + 10 · ${z[1]} + ${z[2]}) · 10^${mult.exp} Ω (${cs.slice(0, 4).join(", ")})`, R, "Ω");
  const tol = tolC.tol / 100;
  const rmin = t.s("EL-R1-TU", "Untere Grenze", "R_min = R · (1 − t)", `R_min = ${f6(R)} Ω · (1 − ${f6(tol)})`, clean(R * (1 - tol)), "Ω");
  const rmax = t.s("EL-R1-TO", "Obere Grenze", "R_max = R · (1 + t)", `R_max = ${f6(R)} Ω · (1 + ${f6(tol)})`, clean(R * (1 + tol)), "Ω");
  t.kpi("r_ohm", "Widerstand R", R, "Ω"); t.kpi("tol", "Toleranz", tol, "1"); t.kpi("rmin_ohm", "R_min", rmin, "Ω"); t.kpi("rmax_ohm", "R_max", rmax, "Ω");
  const m = clean(R / 10 ** Math.floor(Math.log10(R)));
  const inE = ([6, 12, 24, 48, 96] as const).find((n) => E_SERIES[n].some((x) => Math.abs(x - m) < 1e-9));
  t.findings.push({ level: "info", text: inE === undefined ? "Wert liegt in keiner E-Reihe (E6 bis E96)" : `Wert der Reihe E${inE}` });
}

/** EL-R2 Normwert der E-Reihe. */
function r2(t: T): void {
  const x = t.n("wert", "Wunschwert", { positive: true }), n = t.n("e_reihe", "E-Reihe");
  if (t.bad) return;
  if (!isESeries(n)) { t.fail("E-Reihe muss 6, 12, 24, 48 oder 96 sein"); return; }
  const p = eSeriesPick(x, n)!;
  t.s("EL-R2-N", `Nächster Normwert E${n}`, "X_N = nächster Normwert (logarithmischer Abstand)", `X = ${f6(x)} → X_N = ${f6(p.nearest)} (Nachbarn ${f6(p.lower)} und ${f6(p.upper)})`, p.nearest, "1");
  t.s("EL-R2-A", "Relative Abweichung", "Δ = (X_N − X) / X", `Δ = (${f6(p.nearest)} − ${f6(x)}) / ${f6(x)}`, p.dev, "1");
  t.kpi("nearest", `Nächster Normwert E${n}`, p.nearest, "Ω"); t.kpi("lower", "Nächstniedriger", p.lower, "Ω"); t.kpi("upper", "Nächsthöher", p.upper, "Ω"); t.kpi("dev", "Abweichung", p.dev, "1");
}

/** EL-R3 Ohm und Leistung. */
function r3(t: T): void {
  const g = t.str("gegeben", "U und R");
  if (!(OHM_GIVEN as readonly string[]).includes(g)) { t.fail(`Auswahl „${g}“ unbekannt`); return; }
  const num = (k: string): number | undefined => { const v = t.inp[k]; return typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : undefined; };
  try {
    const r = ohm(g as OhmGiven, { u: num("u_V"), i: num("i_A"), r: num("r_ohm"), p: num("p_W") });
    t.steps.push(...r.steps);
    t.kpi("u_V", "Spannung U", r.value.u, "V"); t.kpi("i_A", "Strom I", r.value.i, "A"); t.kpi("r_ohm", "Widerstand R", r.value.r, "Ω"); t.kpi("p_W", "Leistung P", r.value.p, "W");
  } catch (e) { t.fail((e as Error).message); }
}

/** EL-R4 Akku und Laufzeit: n Zellen in Reihe, m parallel; nutzbarer Anteil η_n. */
function r4(t: T): void {
  const C = t.n("kapazitaet_Ah", "Kapazität", { positive: true }), U = t.n("u_V", "Nennspannung", { positive: true }), I = t.n("i_A", "Laststrom", { positive: true });
  const eta = t.n("nutzbar", "Nutzbarer Anteil", { positive: true, max: 1, def: 1 }), ns = t.n("n_reihe", "Zellen in Reihe", { positive: true, def: 1 }), mp = t.n("m_parallel", "Zellen parallel", { positive: true, def: 1 });
  if (t.bad) return;
  if (!Number.isInteger(ns) || !Number.isInteger(mp)) { t.fail("Zellenzahlen müssen ganzzahlig sein"); return; }
  const Ug = t.s("EL-R4-U", "Spannung des Pakets", "U_ges = n · U", `U_ges = ${ns} · ${f6(U)} V`, ns * U, "V");
  const Cg = t.s("EL-R4-C", "Kapazität des Pakets", "C_ges = m · C", `C_ges = ${mp} · ${f6(C)} Ah · 3600 s/h`, mp * C * 3600, "A·s");
  const E = t.s("EL-R4-E", "Energieinhalt", "E = U_ges · C_ges", `E = ${f6(Ug)} V · ${f6(Cg)} A·s`, Ug * Cg, "J");
  const tt = t.s("EL-R4-T", "Laufzeit", "t = η_n · C_ges / I", `t = ${f6(eta)} · ${f6(Cg)} A·s / ${f6(I)} A`, (eta * Cg) / I, "s");
  const cr = t.s("EL-R4-CR", "C-Rate", "C-Rate = I / C_ges", `C-Rate = ${f6(I)} A / ${f6(mp * C)} Ah`, I / (mp * C), "1/h");
  t.kpi("u_ges_V", "Paketspannung", Ug, "V"); t.kpi("c_ges_Ah", "Paketkapazität", mp * C, "Ah"); t.kpi("e_Wh", "Energie", E / 3600, "Wh"); t.kpi("e_J", "Energie", E, "J"); t.kpi("t_h", "Laufzeit", tt / 3600, "h"); t.kpi("t_s", "Laufzeit", tt, "s"); t.kpi("c_rate", "C-Rate", cr, "1/h");
}

/** EL-R5 Drehstromleistung (symmetrische Last). */
function r5(t: T): void {
  const U = t.n("u_V", "Leiterspannung", { positive: true }), I = t.n("i_A", "Leiterstrom", { min: 0 }), cp = t.n("cos_phi", "cos φ", { min: 0, max: 1 }), sch = t.str("schaltung", "Stern");
  if (t.bad) return;
  if (sch !== "Stern" && sch !== "Dreieck") { t.fail("Schaltung muss Stern oder Dreieck sein"); return; }
  const S = t.s("EL-R5-S", "Scheinleistung", "S = √3 · U_L · I_L", `S = √3 · ${f6(U)} V · ${f6(I)} A`, S3 * U * I, "VA");
  const P = t.s("EL-R5-P", "Wirkleistung", "P = √3 · U_L · I_L · cos φ", `P = √3 · ${f6(U)} V · ${f6(I)} A · ${f6(cp)}`, S3 * U * I * cp, "W");
  const Q = t.s("EL-R5-Q", "Blindleistung", "Q = S · sin φ", `Q = ${f6(S)} VA · √(1 − ${f6(cp)}²)`, S * Math.sqrt(1 - cp * cp), "var");
  const us = sch === "Stern" ? t.s("EL-R5-US", "Strangspannung (Stern)", "U_Str = U_L / √3", `U_Str = ${f6(U)} V / √3`, U / S3, "V") : t.s("EL-R5-USD", "Strangspannung (Dreieck)", "U_Str = U_L", `U_Str = ${f6(U)} V`, U, "V");
  const is = sch === "Stern" ? t.s("EL-R5-IS", "Strangstrom (Stern)", "I_Str = I_L", `I_Str = ${f6(I)} A`, I, "A") : t.s("EL-R5-ISD", "Strangstrom (Dreieck)", "I_Str = I_L / √3", `I_Str = ${f6(I)} A / √3`, I / S3, "A");
  t.kpi("s_VA", "Scheinleistung S", S, "VA"); t.kpi("p_W", "Wirkleistung P", P, "W"); t.kpi("q_var", "Blindleistung Q", Q, "var"); t.kpi("u_str_V", "Strangspannung", us, "V"); t.kpi("i_str_A", "Strangstrom", is, "A");
}

/** EL-R6 Motorkenngrößen (Drehstrom-Asynchronmotor). */
function r6(t: T): void {
  const P = t.n("p_W", "Abgabeleistung", { positive: true }), nr = t.n("n_rpm", "Drehzahl", { positive: true }), U = t.n("u_V", "Spannung", { positive: true });
  const eta = t.n("eta", "Wirkungsgrad", { positive: true, max: 1 }), cp = t.n("cos_phi", "cos φ", { positive: true, max: 1 });
  const f = t.n("f_Hz", "Netzfrequenz", { positive: true, def: 50 }), p = t.n("polpaare", "Polpaarzahl", { positive: true, def: 2 });
  if (t.bad) return;
  if (!Number.isInteger(p)) { t.fail("Polpaarzahl muss ganzzahlig sein"); return; }
  const n = nr / 60;
  const M = t.s("EL-R6-M", "Drehmoment", "M = P / (2π · n)", `M = ${f6(P)} W / (2π · ${f6(n)} 1/s)`, P / (2 * Math.PI * n), "N·m");
  const Pz = t.s("EL-R6-PZ", "Aufgenommene Leistung", "P_zu = P / η", `P_zu = ${f6(P)} W / ${f6(eta)}`, P / eta, "W");
  const I = t.s("EL-R6-I", "Stromaufnahme (Drehstrom)", "I = P_zu / (√3 · U · cos φ)", `I = ${f6(Pz)} W / (√3 · ${f6(U)} V · ${f6(cp)})`, Pz / (S3 * U * cp), "A");
  const ns = t.s("EL-R6-NS", "Synchrone Drehzahl", "n_s = f / p", `n_s = ${f6(f)} Hz / ${p}`, f / p, "1/s");
  const s = t.s("EL-R6-S", "Schlupf", "s = (n_s − n) / n_s", `s = (${f6(ns)} − ${f6(n)}) / ${f6(ns)} (1/s)`, (ns - n) / ns, "1");
  t.kpi("m_Nm", "Drehmoment M", M, "N·m"); t.kpi("p_zu_W", "Aufgenommene Leistung", Pz, "W"); t.kpi("i_A", "Strom I", I, "A"); t.kpi("ns_rpm", "Synchrone Drehzahl", ns * 60, "1/min"); t.kpi("s", "Schlupf s", s, "1", s < 0 || s >= 1 ? "warn" : undefined);
  if (s < 0) t.findings.push({ level: "warn", text: "Drehzahl über der synchronen Drehzahl (Generatorbetrieb oder falsche Polpaarzahl)" });
}

/** Rechner ausführen. */
export function computeTool(id: ToolId, inputs: Inp): SheetResult {
  const t = new T(inputs);
  switch (id) {
    case "R1": r1(t); break; case "R2": r2(t); break; case "R3": r3(t); break;
    case "R4": r4(t); break; case "R5": r5(t); break; case "R6": r6(t); break;
    default: t.fail(`Rechner ${String(id)} unbekannt`);
  }
  return t.result();
}
