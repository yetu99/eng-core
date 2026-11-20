/**
 * Netzwerkberechnung (Modul elektrik, EL-N und EL-W): modifizierte Knotenpunktanalyse (MNA) nach Ho, Ruehli, Brennan (1975)
 * für Gleichstrom (Arbeitspunkt) und Wechselstrom (Effektivwertzeiger bei einer Frequenz), Frequenzgang als Sweep.
 *
 * Konventionen (Konzept elektrik, Abschn. 3):
 *  - SI intern: V, A, Ω, S, F, H, Hz, W, VA, var. Phasen im Ergebnis in rad, im Rechenweg in Grad.
 *  - Verbraucherzählpfeilsystem für alle Bauteile (EL-E1): U = u_a − u_b, I fließt durch das Bauteil von a nach b,
 *    P = U · I > 0 aufgenommen, < 0 abgegeben (Quellen). Bei Quellen gilt a = plus, b = minus.
 *  - Wechselgrößen als Effektivwertzeiger (EL-E2): S = U · I*.
 *  - Bezug: Masse-Knoten; Teilnetze ohne Masse erhalten ihren ersten Knoten als Bezug 0 V (Hinweis).
 *  - Nichtlineare Bauteile (Diode, LED, Z-Diode, NPN, PNP, N-MOSFET, ab 0.21.0): Gleichstrom-Arbeitspunkt über
 *    Newton-Iteration (EL-H, EL-K, newton.ts), Wechselstrom als Kleinsignal am Arbeitspunkt (EL-H20, E-v11-7).
 *  - Ab 0.21.0 zusätzlich Klemmenströme je Bauteil, Pinstrom am Digitalpin (EL-A, pins.ts), Leitungsströme (EL-N14, wires.ts).
 *  - Gleichstrom: Kondensator offen, Spule als 0-V-Quelle (mit Wicklungswiderstand r), Wechselspannungsquellen 0 V,
 *    Transformator nicht gekoppelt. Wechselstrom: Gleichquellen deaktiviert (Spannungsquelle 0 V, Stromquelle offen,
 *    Batterie nur R_i).
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace, type TraceGroupOf } from "../trace";
import { C0, cabs, cadd, carg, cconj, cdiv, cmul, csub, cx, type Complex } from "./complex";
import { NONLINEAR, build, deg, f6, fc, flows, fp, label, primFlow, solve, utilization, type Built, type Solved } from "./mna";
import { G_MIN, devPins, devVolts, linearize, smallSignalCurrents, stamps, terminalCurrents, type Device, type Volts } from "./devices";
import { newtonDc, type NewtonOptions, type NewtonResult } from "./newton";
import { pinChecks, type BoardSum, type PinCheck } from "./pins";
import { wireCurrents, type ElWire } from "./wires";
import { U_T, criticalVoltage, limexpActive, X_MAX } from "./semiconductors";
export { R_MIN, UTIL_WARN } from "./mna";
export type { NewtonOptions, NewtonStage } from "./newton";
export type { ElWire, ElWireEnd } from "./wires";

export type ElGroup = TraceGroupOf<"elektrik">;
export type ElParam = number | string | boolean;
export interface ElElement { id: string; kind: string; pins: Readonly<Record<string, string>>; params: Readonly<Record<string, ElParam>>; label?: string }
/** Netzliste (Knotennamen frei, Masse-Knoten in ground). Strukturgleich mit der Netzliste der App Stromwerk. */
export interface ElNetlist {
  nodes: readonly string[]; ground: string | null; elements: readonly ElElement[];
  /** Drähte der Zeichnung (optional, ab 0.21.0) für die Leitungsströme EL-N14. */
  wires?: readonly ElWire[];
}
export interface ElFinding { level: "info" | "warn" | "fail"; elementId?: string; nodeId?: string; text: string }

export interface DcElementResult {
  u: number; i: number; p: number;
  /** Klemmenströme in das Bauteil hinein je Pin in A (ab 0.21.0). */
  pins?: Record<string, number>;
}
/** Arbeitspunkt eines Halbleiters (ab 0.21.0). */
export interface OperatingPoint { kind: string; region: string; volts: Record<string, number>; currents: Record<string, number>; p: number }
/** Verlauf der Newton-Iteration (ab 0.21.0, EL-K). */
export interface IterationInfo { stage: "newton" | "gmin" | "quellen"; steps: number; gminLevels: number; lambdaSteps: number; residual: number; change: number; aborted: boolean }
export interface DcResult {
  ok: boolean;
  /** Knotenspannungen gegen Bezug in V. */
  nodes: Record<string, number>;
  elements: Record<string, DcElementResult>;
  /** Σ P aller Bauteile in W (EL-N12, Sollwert 0). */
  balance: number;
  /** Auslastungen (EL-N13) je Bauteil, 1 = Grenzwert. */
  utilization: Record<string, number>;
  findings: ElFinding[];
  trace: Trace<ElGroup>;
  /** Halbleiter am Arbeitspunkt (ab 0.21.0). */
  operatingPoints?: Record<string, OperatingPoint>;
  /** Newton-Iteration, nur mit Halbleitern (ab 0.21.0). */
  iterations?: IterationInfo;
  /** Pinstrom je Digitalpin und Summen je Board (EL-A, ab 0.21.0). */
  pinChecks?: Record<string, PinCheck>;
  boardSums?: BoardSum[];
  /** Leitungsströme je Draht in A, positiv von a nach b (EL-N14, ab 0.21.0, nur mit net.wires). */
  wires?: Record<string, number>;
}
export interface AcElementResult { u: Complex; i: Complex; s: Complex }
export interface AcResult {
  ok: boolean;
  f: number;
  nodes: Record<string, Complex>;
  elements: Record<string, AcElementResult>;
  balance: Complex;
  utilization: Record<string, number>;
  findings: ElFinding[];
  trace: Trace<ElGroup>;
}

export const isNonlinearKind = (k: string): boolean => NONLINEAR.has(k);

const addTrace = (t: Trace<ElGroup>, g: ElGroup, s: CalcStep[]): void => { if (s.length) (t[g] ??= []).push(...s); };


/** Optionen der Gleichstromrechnung (ab 0.21.0): Testschalter der Newton-Iteration (EL-K07 bis EL-K09). */
export interface DcOptions { newton?: NewtonOptions }

/** Klemmenströme eines linearen Bauteils aus seinen Primitiven (in das Bauteil hinein je Pin). */
function linearPins(e: ElElement, b: Built, s: Solved): Record<string, number> {
  const cur = new Map<string, number>();
  for (const p of b.prims) {
    if (p.el !== e.id || p.t === "X") continue;
    const i = primFlow(p, s).i.re;
    cur.set(p.a, (cur.get(p.a) ?? 0) + i); cur.set(p.b, (cur.get(p.b) ?? 0) - i);
  }
  const out: Record<string, number> = {}, used = new Set<string>();
  for (const [pin, node] of Object.entries(e.pins)) { if (used.has(node)) { out[pin] = 0; continue; } used.add(node); out[pin] = cur.get(node) ?? 0; }
  return out;
}

const DEV_TITLE: Record<string, string> = { led: "LED", diode: "Diode", z_diode: "Z-Diode", npn: "NPN-Transistor", pnp: "PNP-Transistor", n_mosfet: "N-MOSFET" };

/** Rechenweg eines Halbleiters am Arbeitspunkt (EL-H). */
function deviceSteps(d: Device, e: ElElement, v: Volts, cur: Record<string, number>, p: number, region: string, vOf: (n: string) => number): CalcStep[] {
  const L = label(e), out: CalcStep[] = [];
  if (d.t === "diode") {
    const nut = d.m.n * U_T, uj = v[0]!, x = uj / nut;
    out.push(step("EL-H03", `Sättigungsstrom ${L} aus Datenblattpunkt`, "I_S = I_F / (e^((U_F − r_S · I_F) / (n · U_T)) − 1)", `I_S = ${f6(d.iF)} A / (e^((${f6(d.uf)} V − ${f6(d.m.rs)} Ω · ${f6(d.iF)} A) / (${f6(d.m.n)} · ${f6(U_T)} V)) − 1)`, d.m.is, "A"));
    if (d.m.rs > 0) out.push(step("EL-H04", `Spannung ${L} mit Bahnwiderstand`, "U = U_j + r_S · I", `U = ${f6(uj)} V + ${f6(d.m.rs)} Ω · ${f6(cur["anode"]!)} A`, uj + d.m.rs * cur["anode"]!, "V"));
    if (limexpActive(x)) out.push(step("EL-H05", `Exponentenbegrenzung ${L}`, "x > x_max = 80: e^x ≈ e^x_max · (1 + x − x_max)", `x = U_j / (n U_T) = ${f6(uj)} V / ${f6(nut)} V`, x, "1"));
    out.push(step("EL-H02", `Strom ${L} (${region})`, "I = I_S · (e^(U_j / (n · U_T)) − 1)", `I = ${f6(d.m.is)} A · (e^(${f6(uj)} V / (${f6(d.m.n)} · ${f6(U_T)} V)) − 1)`, d.m.is * Math.expm1(Math.min(x, X_MAX)), "A"));
    if (d.m.zener) {
      const z = d.m.zener, nz = z.nz * U_T;
      out.push(step("EL-H06", `Z-Durchbruch ${L}`, "I_Z = −I_ZT · e^(−(U + U_Z) / (n_Z · U_T))", `I_Z = −${f6(z.izt)} A · e^(−(${f6(uj)} V + ${f6(z.uz)} V) / (${f6(z.nz)} · ${f6(U_T)} V))`, -z.izt * Math.exp(Math.min(-(uj + z.uz) / nz, X_MAX)), "A"));
    }
    const lin = linearize(d, v);
    out.push(step("EL-H07", `Differentieller Leitwert ${L}`, "g_d = dI / dU_j", `g_d bei U_j = ${f6(uj)} V (mit G_min = ${fmt(G_MIN)} S)`, lin.J[0]![0]!, "S"));
  } else if (d.t === "bjt") {
    const npn = d.m.polarity === 1, [ube, ubc] = v as [number, number];
    out.push(step("EL-H11", `Sättigungsstrom ${L}`, "I_S = I_C,ref / e^(U_BE,ref / U_T)", `I_S = ${f6(d.icRef)} A / e^(${f6(d.ubeRef)} V / ${f6(U_T)} V)`, d.m.is, "A"));
    if (npn) {
      out.push(step("EL-H09", `Kollektorstrom ${L} (${region})`, "I_C = I_S · (e^(U_BE/U_T) − e^(U_BC/U_T)) − (I_S/β_R) · (e^(U_BC/U_T) − 1)", `U_BE = ${f6(ube)} V, U_BC = ${f6(ubc)} V, β_R = ${f6(d.m.betaR)}`, cur["c"]!, "A"));
      out.push(step("EL-H10", `Basisstrom ${L}`, "I_B = (I_S/β_F) · (e^(U_BE/U_T) − 1) + (I_S/β_R) · (e^(U_BC/U_T) − 1)", `U_BE = ${f6(ube)} V, U_BC = ${f6(ubc)} V, β_F = ${f6(d.m.betaF)}`, cur["b"]!, "A"));
    } else {
      out.push(step("EL-H12-C", `Kollektorstrom ${L} (PNP, ${region}; in das Bauteil hinein)`, "I_C = −[I_S · (e^(U_EB/U_T) − e^(U_CB/U_T)) − (I_S/β_R) · (e^(U_CB/U_T) − 1)]", `U_EB = ${f6(-ube)} V, U_CB = ${f6(-ubc)} V, β_R = ${f6(d.m.betaR)}`, cur["c"]!, "A"));
      out.push(step("EL-H12-B", `Basisstrom ${L} (PNP; in das Bauteil hinein)`, "I_B = −[(I_S/β_F) · (e^(U_EB/U_T) − 1) + (I_S/β_R) · (e^(U_CB/U_T) − 1)]", `U_EB = ${f6(-ube)} V, U_CB = ${f6(-ubc)} V, β_F = ${f6(d.m.betaF)}`, cur["b"]!, "A"));
    }
    const lin = linearize(d, v), J = lin.J;
    out.push(step("EL-H13", `Jacobi-Matrix ${L} (Steilheit ∂I_C/∂U_BE)`, "∂I_C/∂U_BE, ∂I_C/∂U_BC, ∂I_B/∂U_BE, ∂I_B/∂U_BC", `[${f6(J[0]![0]!)}, ${f6(J[0]![1]!)}; ${f6(J[1]![0]!)}, ${f6(J[1]![1]!)}] S (mit G_min)`, J[0]![0]!, "S"));
  } else {
    const [ugs, uds] = v as [number, number], r = linearize(d, v);
    out.push(step("EL-H17", `Steilheitsfaktor ${L} aus R_DS(on)`, "K = 1 / (R_DS(on) · (U_GS,ref − U_th))", `K = 1 / (${f6(d.ron)} Ω · (${f6(d.ugsRef)} V − ${f6(d.m.uth)} V))`, d.m.k, "A/V²"));
    if (uds < 0) out.push(step("EL-H18", `Drain und Source getauscht ${L}`, "U_DS < 0: I_D(U_GS, U_DS) = −I_D(U_GD, −U_DS)", `U_DS = ${f6(uds)} V, U_GD = ${f6(ugs - uds)} V`, uds, "V"));
    const ugsE = uds < 0 ? ugs - uds : ugs, udsE = Math.abs(uds), ov = ugsE - d.m.uth;
    if (region === "sperrend") out.push(step("EL-H14", `Drainstrom ${L} (sperrend)`, "U_GS ≤ U_th: I_D = 0", `U_GS = ${f6(ugsE)} V ≤ U_th = ${f6(d.m.uth)} V`, 0, "A"));
    else if (region === "linear") out.push(step("EL-H15", `Drainstrom ${L} (linearer Bereich)`, "I_D = K · ((U_GS − U_th) · U_DS − U_DS²/2)", `I_D = ${f6(d.m.k)} A/V² · (${f6(ov)} V · ${f6(udsE)} V − ${f6(udsE)}² V² / 2)`, cur["d"]!, "A"));
    else out.push(step("EL-H16", `Drainstrom ${L} (Sättigung)`, "I_D = K/2 · (U_GS − U_th)²", `I_D = ${f6(d.m.k)} A/V² / 2 · ${f6(ov)}² V²`, cur["d"]!, "A"));
    out.push(step("EL-H19", `Steilheit ${L}`, "g_m = ∂I_D/∂U_GS, g_ds = ∂I_D/∂U_DS", `g_m = ${f6(r.J[0]![0]!)} S, g_ds = ${f6(r.J[0]![1]!)} S (mit G_min)`, r.J[0]![0]!, "S"));
  }
  const pn = devPins(d);
  out.push(step("EL-H21", `Verlustleistung ${L}`, "P = Σ u_Klemme · I_Klemme", `P = ${Object.entries(cur).map(([k, i]) => `${f6(vOf(pn[k]!))} V · (${f6(i)} A) [${k}]`).join(" + ")}`, p, "W"));
  return out;
}

/** Rechenweg der Newton-Iteration (EL-K). */
function newtonSteps(b: Built, nr: NewtonResult): CalcStep[] {
  const out: CalcStep[] = [];
  const d0 = b.devices.find((d) => d.t !== "mos");
  if (d0 && d0.t === "diode") out.push(step("EL-K02", "Startwerte", "x_0 = 0; pn-Übergänge bei U_krit, MOSFET bei U_GS = U_DS = 0", `${b.devices.length} Halbleiter, erster Übergang ${d0.el} bei U_krit`, criticalVoltage(d0.m.is, d0.m.n * U_T), "V"));
  else if (d0 && d0.t === "bjt") out.push(step("EL-K02", "Startwerte", "x_0 = 0; pn-Übergänge bei U_krit, MOSFET bei U_GS = U_DS = 0", `${b.devices.length} Halbleiter, U_BE bei U_krit`, criticalVoltage(d0.m.is, U_T), "V"));
  else out.push(step("EL-K02", "Startwerte", "x_0 = 0; pn-Übergänge bei U_krit, MOSFET bei U_GS = U_DS = 0", `${b.devices.length} Halbleiter, MOSFET bei U_GS = U_DS = 0 V`, 0, "V"));
  if (nr.limitedPn && d0) {
    const is = d0.m.is, nut = d0.t === "diode" ? d0.m.n * U_T : U_T;
    out.push(step("EL-K04", "pn-Spannungsbegrenzung (kritische Spannung)", "U_krit = n U_T · ln(n U_T / (√2 · I_S))", `U_krit = ${f6(nut)} V · ln(${f6(nut)} V / (√2 · ${f6(is)} A))`, criticalVoltage(is, nut), "V"));
  }
  if (nr.limitedMos) out.push(step("EL-K05", "MOSFET-Schrittbegrenzung", "|ΔU_GS| ≤ 0,5 V + 0,5 · |U_GS,alt − U_th|, |ΔU_DS| ≤ 2 V", "Schritt der Steuerspannungen begrenzt", 2, "V"));
  out.push(step("EL-K06", "Mindestleitwert parallel zu den Übergängen", "G_min = 1e-12 S", "G_min parallel zu jedem pn-Übergang und zwischen Drain und Source", G_MIN, "S"));
  if (nr.gminLevels) out.push(step("EL-K07", "G_min-Stufung", "G_min,k = 1e-2 S … 1e-11 S, dann 0 (Lösung der Stufe als Start)", `${nr.gminLevels} Stufen`, nr.gminLevels, "1"));
  if (nr.lambdaSteps) out.push(step("EL-K08", "Quellenstufung", "Quellen · λ, λ = 0 → 1 (Schritt 0,1, halbieren bei Misserfolg, verdoppeln bei Erfolg)", `${nr.lambdaSteps} Quellenschritte`, nr.lambdaSteps, "1"));
  out.push(step("EL-K01", "Newton-Iteration", "J(x_k) · x_(k+1) = z(x_k) mit Begleitmodellen am Punkt x_k", `${nr.steps} Schritte, Stufe ${nr.stage === "newton" ? "Newton" : nr.stage === "gmin" ? "G_min-Stufung" : "Quellenstufung"}`, nr.steps, "1"));
  if (nr.ok) out.push(step("EL-K03", "Konvergenz (größter Rest der Bauteilströme)", "|Δx_i| ≤ 1e-10 · |x_i| + 1e-12 V und |ΔI| ≤ 1e-10 · |I| + 1e-15 A in zwei Schritten", `letzte Änderung ${fmt(nr.change)} V, Rest ${fmt(nr.residual)} A`, nr.residual, "A"));
  else out.push(step("EL-K09", "Abbruch ohne Lösung", "Gesamtbudget 5000 Schritte bzw. alle Stufen ohne Konvergenz", `${nr.steps} Schritte, größte Änderung an ${nr.worst ?? "?"}, Rest ${fmt(nr.residual)} A`, nr.steps, "1"));
  return out;
}

/** Auslastung der Halbleiter (EL-N13-D, -Z, -Q, -M). */
function deviceUtilization(d: Device, e: ElElement, cur: Record<string, number>, p: number, out: Record<string, number>, findings: ElFinding[], steps: CalcStep[]): void {
  const L = label(e);
  let a: number | null = null;
  if (d.t === "diode" && d.kind !== "z_diode" && d.imax) { a = Math.abs(cur["anode"]!) / d.imax; steps.push(step("EL-N13-D", `Auslastung ${L}`, "a = |I| / I_max", `a = ${f6(Math.abs(cur["anode"]!))} A / ${f6(d.imax)} A`, a, "1")); }
  if (d.t === "diode" && d.kind === "z_diode" && d.ptot) { a = Math.abs(p) / d.ptot; steps.push(step("EL-N13-Z", `Auslastung ${L}`, "a = |P| / P_tot", `a = ${f6(Math.abs(p))} W / ${f6(d.ptot)} W`, a, "1")); }
  if (d.t === "bjt" && (d.icmax || d.ptot)) {
    const ai = d.icmax ? Math.abs(cur["c"]!) / d.icmax : 0, ap = d.ptot ? Math.abs(p) / d.ptot : 0;
    a = Math.max(ai, ap);
    steps.push(step("EL-N13-Q", `Auslastung ${L}`, "a = max(|I_C| / I_C,max, |P| / P_tot)", `a = max(${d.icmax ? `${f6(Math.abs(cur["c"]!))} A / ${f6(d.icmax)} A` : "I_C,max nicht angegeben"}, ${d.ptot ? `${f6(Math.abs(p))} W / ${f6(d.ptot)} W` : "P_tot nicht angegeben"})`, a, "1"));
  }
  if (d.t === "mos" && d.idmax) { a = Math.abs(cur["d"]!) / d.idmax; steps.push(step("EL-N13-M", `Auslastung ${L}`, "a = |I_D| / I_D,max", `a = ${f6(Math.abs(cur["d"]!))} A / ${f6(d.idmax)} A`, a, "1")); }
  if (a === null) return;
  out[e.id] = a;
  if (a > 10) { if (!findings.some((f) => f.elementId === e.id && f.text.includes("Vorwiderstand fehlt"))) findings.push({ level: "fail", elementId: e.id, text: `${L}: Strom mehr als zehnmal über dem Grenzwert, Vorwiderstand fehlt?` }); }
  else if (a > 1) findings.push({ level: "fail", elementId: e.id, text: `${L}: Auslastung ${fmt(a * 100, 3)} % über dem Grenzwert` });
  else if (a > 0.8) findings.push({ level: "warn", elementId: e.id, text: `${L}: Auslastung ${fmt(a * 100, 3)} %` });
}

interface DcCore { result: DcResult; volts: Map<string, Volts> }

function dcCore(net: ElNetlist, opts: DcOptions = {}): DcCore {
  const b = build(net, null);
  const trace: Trace<ElGroup> = {};
  addTrace(trace, "netz", b.steps.netz);
  let s: Solved, nr: NewtonResult | null = null;
  const findings = [...b.findings];
  if (b.devices.length) {
    nr = newtonDc(net, b, opts.newton);
    addTrace(trace, "konvergenz", newtonSteps(b, nr));
    if (!nr.ok || !nr.solved?.ok) {
      findings.push(...(nr.solved?.findings ?? []));
      if (nr.solved?.ok !== false) findings.push({ level: "fail", ...(nr.worst ? { elementId: nr.worst } : {}), text: `Keine Lösung gefunden (Newton, G_min-Stufung und Quellenstufung ohne Konvergenz). Größte Änderung an ${nr.worst ?? "?"}. Prüfe Rückkopplungen und ideale Quellen direkt an Halbleitern.` });
      return { result: { ok: false, nodes: {}, elements: {}, balance: NaN, utilization: {}, findings, trace, iterations: iterInfo(nr) }, volts: new Map() };
    }
    s = nr.solved;
    if (nr.stage === "quellen") findings.push({ level: "warn", text: "Lösung erst mit Quellenstufung gefunden. Die Schaltung kann mehrere Arbeitspunkte haben (z. B. Kippstufe), angezeigt ist einer." });
  } else s = solve(net, b);
  findings.push(...s.findings);
  if (!s.ok) return { result: { ok: false, nodes: {}, elements: {}, balance: NaN, utilization: {}, findings, trace }, volts: new Map() };
  const res: string[] = [];
  const rs: CalcStep[] = [step("EL-N10", "Lineares Gleichungssystem der Knotenpunktanalyse", "A · x = z", `${s.unknowns.nodes + s.unknowns.branches} Unbekannte (${s.unknowns.nodes} Knotenspannungen, ${s.unknowns.branches} Zweigströme), LU-Zerlegung mit Spaltenpivotisierung`, s.unknowns.nodes + s.unknowns.branches, "1")];
  const fl = flows(net, b, s);
  const elements: Record<string, DcElementResult> = {};
  let bal = 0, absSum = 0;
  for (const e of net.elements) {
    const f = fl.get(e.id); if (!f) continue;
    const u = f.u.re, i = f.i.re, p = f.s.re, L = label(e);
    elements[e.id] = { u, i, p, pins: linearPins(e, b, s) }; bal += p; absSum += Math.abs(p);
    if (e.kind === "masse" || e.kind === "knoten") continue;
    rs.push(step("EL-N11-U", `Spannung ${L}`, "U = u_a − u_b", `U = ${f6(u)} V`, u, "V"));
    const m = b.main.get(e.id);
    if (m?.t === "Y" && e.kind !== "potentiometer") rs.push(step("EL-N11-I", `Strom ${L}`, "I = G · U", `I = ${f6(m.y.re)} S · ${f6(u)} V`, i, "A"));
    else if (m?.t === "Y") rs.push(step("EL-N11-I", `Strom ${L} (Anschluss a)`, "I = G · U", `I = ${f6(m.y.re)} S · ${f6(csub(s.V.get(m.a) ?? C0, s.V.get(m.b) ?? C0).re)} V`, i, "A"));
    else if (m?.t === "V") rs.push(step("EL-N11-IV", `Strom ${L}`, "I = x_k (Zweigstrom)", `I = ${f6(i)} A`, i, "A"));
    else if (m?.t === "I") rs.push(step("EL-N11-IQ", `Strom ${L} (Verbraucherzählpfeil)`, "I = −I_q", `I = −${f6(-i)} A`, i, "A"));
    if (e.kind === "batterie") { const u0 = e.params["u_V"] as number, ri = e.params["r_i_ohm"] as number; rs.push(step("EL-N03", `Klemmenspannung ${L} (Verbraucherzählpfeil, I < 0 bei Stromabgabe)`, "U_Kl = U_0 + R_i · I (Verbraucherzählpfeil)", `U_Kl = ${f6(u0)} V + ${f6(ri)} Ω · (${f6(i)} A)`, u0 + ri * i, "V")); }
    if (e.kind === "spule") { const r = typeof e.params["r_ohm"] === "number" ? e.params["r_ohm"] : 0; rs.push(step("EL-N06", `Spule ${L} bei Gleichstrom`, "U_L = r · I", `U_L = ${f6(r)} Ω · ${f6(i)} A`, r * i, "V")); }
    if ((e.kind === "schalter" || e.kind === "taster" || e.kind === "amperemeter") && m) rs.push(step("EL-N07", `Strom durch ${L} (Kurzschlussbrücke)`, "u_a − u_b = 0, I = x_k (Zweigstrom)", `u_a − u_b = 0 V, I = ${f6(i)} A`, i, "A"));
    if (e.kind === "voltmeter") rs.push(step("EL-N08", `Anzeige ${L}`, "U_V = u_a − u_b", `U_V = ${f6(u)} V`, u, "V"));
    if (e.kind !== "voltmeter" && e.kind !== "amperemeter") rs.push(step("EL-N11-P", `Leistung ${L}`, "P = U · I", `P = ${f6(u)} V · ${f6(i)} A`, p, "W"));
    res.push(`${L} ${f6(p)}`);
  }
  // Halbleiter am Arbeitspunkt (exakte Kennlinie bei den Knotenspannungen der Lösung)
  const hl: CalcStep[] = [], operatingPoints: Record<string, OperatingPoint> = {}, volts = new Map<string, Volts>();
  const vOf = (n: string): number => s.V.get(n)?.re ?? 0;
  if (b.devices.length) hl.push(step("EL-H01", "Temperaturspannung (25 °C)", "U_T = k · T / q", `U_T = 1,380649e-23 J/K · 298,15 K / 1,602176634e-19 C`, U_T, "V"));
  const devUtil: Array<[Device, ElElement, Record<string, number>, number]> = [];
  for (const d of b.devices) {
    const e = net.elements.find((x) => x.id === d.el)!, v = devVolts(d, vOf), lin = linearize(d, v);
    volts.set(d.el, v);
    const cur = terminalCurrents(d, lin.f), pins = devPins(d);
    const p = Object.entries(pins).reduce((acc, [pin, node]) => acc + vOf(node) * (cur[pin] ?? 0), 0);
    const [ta, tb, ti] = d.t === "diode" ? [d.a, d.k, cur["anode"]!] : d.t === "bjt" ? [d.c, d.e, cur["c"]!] : [d.d, d.s, cur["d"]!];
    elements[d.el] = { u: vOf(ta) - vOf(tb), i: ti, p, pins: cur };
    bal += p; absSum += Math.abs(p); res.push(`${label(e)} ${f6(p)}`);
    const vnames = d.t === "diode" ? ["U_j"] : d.t === "bjt" ? ["U_BE", "U_BC"] : ["U_GS", "U_DS"];
    operatingPoints[d.el] = { kind: e.kind, region: lin.region, volts: Object.fromEntries(vnames.map((k, j) => [k, v[j]!])), currents: cur, p };
    hl.push(...deviceSteps(d, e, v, cur, p, lin.region, vOf));
    if (lin.limexp) findings.push({ level: "fail", elementId: d.el, text: `${label(e)}: Strom unbegrenzt (Exponentenbegrenzung aktiv), Vorwiderstand fehlt?` });
    if (d.t === "mos" && v[1]! < -0.3) findings.push({ level: "warn", elementId: d.el, text: `${label(e)}: U_DS < −0,3 V, Body-Diode ist nicht modelliert.` });
    if (d.t === "mos") {
      const attached = net.elements.filter((x) => x.kind !== "knoten" && x.kind !== "masse" && Object.values(x.pins).includes(d.g));
      if (attached.every((x) => x.kind === "n_mosfet" && x.pins["g"] === d.g) && net.ground !== d.g) findings.push({ level: "warn", elementId: d.el, nodeId: d.g, text: `${label(e)}: Gate ohne Ansteuerung (schwebender Knoten).` });
    }
    devUtil.push([d, e, cur, p]);
  }
  addTrace(trace, "netz", rs);
  addTrace(trace, "halbleiter", hl);
  const nachweis: CalcStep[] = [step("EL-N12", "Leistungsbilanz", "Σ P = 0", `Σ P = ${res.join(" + ") || "0"} W`, bal, "W")];
  if (Math.abs(bal) > 1e-9 * Math.max(absSum, 1e-12)) findings.push({ level: "fail", text: `Leistungsbilanz nicht erfüllt: Σ P = ${fmt(bal)} W` });
  const util = utilization(net, fl, false, findings, nachweis);
  for (const [d, e, cur, p] of devUtil) deviceUtilization(d, e, cur, p, util, findings, nachweis);
  const pr = pinChecks(net, (id) => elements[id]?.i, findings);
  nachweis.push(...pr.steps);
  addTrace(trace, "nachweis", nachweis);
  const nodes: Record<string, number> = {};
  for (const n of net.nodes) nodes[n] = vOf(n);
  const result: DcResult = { ok: true, nodes, elements, balance: bal, utilization: util, findings, trace };
  if (b.devices.length) { result.operatingPoints = operatingPoints; result.iterations = iterInfo(nr!); }
  if (Object.keys(pr.pins).length) { result.pinChecks = pr.pins; result.boardSums = pr.boards; }
  if (net.wires?.length) {
    const w = wireCurrents(net.wires, (el, pin) => elements[el]?.pins?.[pin] ?? 0);
    result.wires = w.currents;
    addTrace(trace, "netz", [step("EL-N14", "Leitungsströme (minimale Norm)", "B · i = s, i = Bᵀ · φ mit (B · Bᵀ) · φ = s", `${net.wires.length} Drähte, größter Rest der Knotenregel ${fmt(w.residual)} A`, w.residual, "A")]);
  }
  return { result, volts };
}

const iterInfo = (nr: NewtonResult): IterationInfo => ({ stage: nr.stage, steps: nr.steps, gminLevels: nr.gminLevels, lambdaSteps: nr.lambdaSteps, residual: nr.residual, change: nr.change, aborted: nr.aborted });

/** Gleichstrom-Arbeitspunkt (EL-N01 bis EL-N14, ab 0.21.0 mit Halbleitern EL-H, EL-K und Pinstrom EL-A). */
export function solveDc(net: ElNetlist, opts: DcOptions = {}): DcResult {
  return dcCore(net, opts).result;
}

interface DcOp { ok: boolean; volts: Map<string, Volts>; findings: ElFinding[] }
/** Arbeitspunkt für die Kleinsignalrechnung (nur wenn Halbleiter vorhanden). */
function opFor(net: ElNetlist): DcOp | null {
  if (!net.elements.some((e) => NONLINEAR.has(e.kind))) return null;
  const r = dcCore(net);
  return { ok: r.result.ok, volts: r.volts, findings: r.result.findings.filter((f) => f.level === "fail") };
}

/** Wechselstrom bei der Frequenz f (EL-W01 bis EL-W05), Effektivwertzeiger; Halbleiter als Kleinsignal (EL-H20). */
export function solveAc(net: ElNetlist, f: number): AcResult {
  return acCore(net, f, opFor(net));
}

function acCore(net: ElNetlist, f: number, op: DcOp | null): AcResult {
  if (!(f > 0) || !Number.isFinite(f)) return { ok: false, f, nodes: {}, elements: {}, balance: C0, utilization: {}, findings: [{ level: "fail", text: "Frequenz muss größer 0 sein" }], trace: {} };
  if (op && !op.ok) return { ok: false, f, nodes: {}, elements: {}, balance: C0, utilization: {}, findings: [{ level: "fail", text: "Gleichstrom-Arbeitspunkt der Halbleiter nicht gefunden, Kleinsignalrechnung nicht möglich" }, ...op.findings], trace: {} };
  const omega = 2 * Math.PI * f;
  const b = build(net, omega);
  const ss: CalcStep[] = [];
  const extra = [];
  const Js = new Map<string, number[][]>();
  for (const d of b.devices) {
    const v = op?.volts.get(d.el); if (!v) continue;
    const lin = linearize(d, v);
    Js.set(d.el, lin.J);
    extra.push(...stamps(d, v, lin, 0, false));
    const L = label(net.elements.find((x) => x.id === d.el)!);
    if (d.t === "diode") ss.push(step("EL-H20-D", `Kleinsignal ${L}`, "Y = g_d am Arbeitspunkt", `U_j = ${f6(v[0]!)} V`, lin.J[0]![0]!, "S"));
    else if (d.t === "bjt") ss.push(step("EL-H20-Q", `Kleinsignal ${L} (hybrid-π, Steilheit g_m)`, "g_m = ∂I_C/∂U_BE, g_π = ∂I_B/∂U_BE, g_μ = ∂I_B/∂U_BC, g_o aus ∂I_C/∂U_BC", `U_BE = ${f6(v[0]!)} V, U_BC = ${f6(v[1]!)} V; g_π = ${f6(lin.J[1]![0]!)} S`, lin.J[0]![0]!, "S"));
    else ss.push(step("EL-H20-M", `Kleinsignal ${L} (Steilheit g_m)`, "g_m = ∂I_D/∂U_GS, g_ds = ∂I_D/∂U_DS am Arbeitspunkt", `U_GS = ${f6(v[0]!)} V, U_DS = ${f6(v[1]!)} V; g_ds = ${f6(lin.J[0]![1]!)} S`, lin.J[0]![0]!, "S"));
  }
  const s = solve(net, { ...b, prims: [...b.prims, ...extra] });
  const findings = [...b.findings, ...s.findings];
  if (b.devices.length) findings.push({ level: "info", text: "Kleinsignal am Arbeitspunkt, gilt für kleine Amplituden." });
  for (const src of b.sources) if (Math.abs(src.f - f) > 1e-12 * f) findings.push({ level: "warn", elementId: src.el, text: `${src.el}: Quelle mit f = ${fmt(src.f)} Hz, gerechnet wird bei f = ${fmt(f)} Hz` });
  const trace: Trace<ElGroup> = {};
  addTrace(trace, "wechselstrom", [step("EL-W01", "Kreisfrequenz", "ω = 2π · f", `ω = 2π · ${f6(f)} Hz`, omega, "1/s"), ...b.steps.wechselstrom, ...ss]);
  if (!s.ok) return { ok: false, f, nodes: {}, elements: {}, balance: C0, utilization: {}, findings, trace };
  const rs: CalcStep[] = [step("EL-W04", "Komplexes Gleichungssystem der Knotenpunktanalyse", "Y · u = i", `${s.unknowns.nodes + s.unknowns.branches} Unbekannte, komplexe LU-Zerlegung mit Spaltenpivotisierung`, s.unknowns.nodes + s.unknowns.branches, "1")];
  const fl = flows(net, b, s);
  const elements: Record<string, AcElementResult> = {};
  let bal = C0, absSum = 0;
  for (const e of net.elements) {
    const fe = fl.get(e.id); if (!fe) continue;
    elements[e.id] = { u: fe.u, i: fe.i, s: fe.s }; bal = cadd(bal, fe.s); absSum += cabs(fe.s);
    if (e.kind === "masse" || e.kind === "knoten") continue;
    const L = label(e);
    rs.push(step("EL-W04-U", `Spannung ${L}`, "U = u_a − u_b", `U = ${fc(fe.u)} V = ${fp(fe.u)} V`, cabs(fe.u), "V"));
    const m = b.main.get(e.id);
    if (m?.t === "Y") rs.push(step("EL-W04-I", `Strom ${L}`, "I = Y · U", `I = (${fc(m.y)}) S · (${fc(csub(s.V.get(m.a) ?? C0, s.V.get(m.b) ?? C0))}) V`, cabs(fe.i), "A"));
    else if (m) rs.push(step("EL-W04-IV", `Strom ${L}`, "I = x_k (Zweigstrom)", `I = ${fc(fe.i)} A = ${fp(fe.i)} A`, cabs(fe.i), "A"));
    if (e.kind === "transformator" && m?.t === "X") {
      const us = csub(s.V.get(m.s1) ?? C0, s.V.get(m.s2) ?? C0), is = s.branch[m.k]!;
      rs.push(step("EL-N09-U", `Sekundärspannung ${L}`, "u_s = (n_2 / n_1) · u_p", `u_s = ${f6(m.n)} · ${fp(fe.u)} V`, cabs(us), "V"));
      rs.push(step("EL-N09-I", `Primärstrom ${L}`, "i_p = −(n_2 / n_1) · i_s", `i_p = −${f6(m.n)} · ${fp(is)} A`, cabs(fe.i), "A"));
    }
    if (e.kind === "voltmeter" || e.kind === "amperemeter") continue;
    rs.push(step("EL-W05-S", `Scheinleistung ${L}`, "S = U · I*", `S = (${fc(fe.u)}) V · (${fc(cconj(fe.i))}) A`, cabs(fe.s), "VA"));
    rs.push(step("EL-W05-P", `Wirkleistung ${L}`, "P = Re S", `P = Re(${fc(fe.s)}) VA`, fe.s.re, "W"));
    rs.push(step("EL-W05-Q", `Blindleistung ${L}`, "Q = Im S", `Q = Im(${fc(fe.s)}) VA`, fe.s.im, "var"));
    if (cabs(fe.s) > 0) rs.push(step("EL-W05-CP", `Leistungsfaktor λ ${L} (${fe.s.re < 0 ? "Abgabe" : "Aufnahme"} von Wirkleistung)`, "λ = |P| / |S|", `λ = |${f6(fe.s.re)}| W / ${f6(cabs(fe.s))} VA`, Math.abs(fe.s.re) / cabs(fe.s), "1"));
  }
  // Halbleiter als Kleinsignal: Klemmenströme aus den Leitwerten, S = Σ U_Klemme · I_Klemme*
  for (const d of b.devices) {
    const J = Js.get(d.el); if (!J) continue;
    const V = (n: string): Complex => s.V.get(n) ?? C0;
    const ctrlV = d.t === "diode" ? [csub(V(d.j), V(d.k))] : d.t === "bjt" ? [csub(V(d.b), V(d.e)), csub(V(d.b), V(d.c))] : [csub(V(d.g), V(d.s)), csub(V(d.d), V(d.s))];
    const cur = smallSignalCurrents(d, J, ctrlV), pins = devPins(d);
    let sd = C0;
    for (const [pin, node] of Object.entries(pins)) sd = cadd(sd, cmul(V(node), cconj(cur[pin] ?? C0)));
    const [ta, tb, ti] = d.t === "diode" ? [d.a, d.k, cur["anode"]!] : d.t === "bjt" ? [d.c, d.e, cur["c"]!] : [d.d, d.s, cur["d"]!];
    elements[d.el] = { u: csub(V(ta), V(tb)), i: ti, s: sd };
    bal = cadd(bal, sd); absSum += cabs(sd);
  }
  const nachweis: CalcStep[] = [step("EL-W05-B", "Leistungsbilanz Wechselstrom", "Σ S = 0", `Σ S = ${fc(bal)} VA`, cabs(bal), "VA")];
  if (cabs(bal) > 1e-9 * Math.max(absSum, 1e-12)) findings.push({ level: "fail", text: `Leistungsbilanz nicht erfüllt: |Σ S| = ${fmt(cabs(bal))} VA` });
  const util = utilization(net, fl, true, findings, nachweis);
  addTrace(trace, "wechselstrom", rs); addTrace(trace, "nachweis", nachweis);
  const nodes: Record<string, Complex> = {};
  for (const n of net.nodes) nodes[n] = s.V.get(n) ?? C0;
  return { ok: true, f, nodes, elements, balance: bal, utilization: util, findings, trace };
}

export interface BodePoint { f: number; h: Complex; gainDb: number; phaseDeg: number }
export interface BodeMarks { fPeak: number; gPeak: number; f3dB: number[] }
export interface SweepResult { ok: boolean; points: BodePoint[]; marks: BodeMarks | null; findings: ElFinding[]; trace: Trace<ElGroup> }

/** −3-dB-Abstand: 20 · lg √2. */
export const DB3 = 20 * Math.log10(Math.SQRT2);

/** Logarithmische Frequenzpunkte (EL-W07). */
export function logFrequencies(fMin: number, fMax: number, n: number): number[] {
  if (n < 2) return [fMin];
  return Array.from({ length: n }, (_, k) => fMin * (fMax / fMin) ** (k / (n - 1)));
}

/** Kennpunkte (EL-W08): Maximum und Schnittpunkte mit G_max − 3,0103 dB, lineare Interpolation über lg f. */
export function bodeMarks(points: readonly { f: number; gainDb: number }[]): BodeMarks | null {
  const ok = points.filter((p) => Number.isFinite(p.gainDb));
  if (!ok.length) return null;
  let pk = ok[0]!;
  for (const p of ok) if (p.gainDb > pk.gainDb) pk = p;
  const lvl = pk.gainDb - DB3, f3dB: number[] = [];
  for (let k = 1; k < ok.length; k++) {
    const a = ok[k - 1]!, b = ok[k]!, da = a.gainDb - lvl, db = b.gainDb - lvl;
    if (da === 0) { if (!f3dB.includes(a.f)) f3dB.push(a.f); continue; }
    if (da * db < 0) { const t = da / (da - db); f3dB.push(10 ** (Math.log10(a.f) + t * (Math.log10(b.f) - Math.log10(a.f)))); }
  }
  return { fPeak: pk.f, gPeak: pk.gainDb, f3dB };
}

/** Frequenzgang H = U_aus / U_ein zwischen zwei Knoten (jeweils gegen Masse), EL-W06 bis EL-W08. */
export function sweep(net: ElNetlist, inNode: string, outNode: string, fMin: number, fMax: number, n: number): SweepResult {
  const findings: ElFinding[] = [];
  if (!(fMin > 0) || !(fMax > fMin) || !(n >= 2) || !Number.isInteger(n)) return { ok: false, points: [], marks: null, findings: [{ level: "fail", text: "Frequenzbereich ungültig: 0 < f_min < f_max und mindestens 2 Punkte" }], trace: {} };
  const points: BodePoint[] = [];
  const op = opFor(net);
  for (const f of logFrequencies(fMin, fMax, n)) {
    const r = acCore(net, f, op);
    if (!r.ok) return { ok: false, points: [], marks: null, findings: r.findings, trace: r.trace };
    const ui = r.nodes[inNode], uo = r.nodes[outNode];
    if (!ui || !uo) return { ok: false, points: [], marks: null, findings: [{ level: "fail", text: "Eingangs- oder Ausgangsknoten unbekannt" }], trace: {} };
    if (cabs(ui) === 0) return { ok: false, points: [], marks: null, findings: [{ level: "fail", nodeId: inNode, text: "Eingangsspannung ist 0: Übertragungsfunktion nicht definiert" }], trace: {} };
    const h = cdiv(uo, ui);
    points.push({ f, h, gainDb: 20 * Math.log10(cabs(h)), phaseDeg: deg(carg(h)) });
  }
  const marks = bodeMarks(points);
  const t: CalcStep[] = [step("EL-W07", "Frequenzpunkte logarithmisch", "f_k = f_min · (f_max / f_min)^(k / (N − 1))", `f_min = ${f6(fMin)} Hz, f_max = ${f6(fMax)} Hz, N = ${n}`, n, "1")];
  if (marks) {
    const pk = points.find((p) => p.f === marks.fPeak)!;
    t.push(step("EL-W06-H", "Übertragungsfunktion im Maximum", "H = U_aus / U_ein", `H = ${fc(pk.h)} bei f = ${f6(pk.f)} Hz`, cabs(pk.h), "1"));
    t.push(step("EL-W06-DB", "Verstärkung im Maximum", "G = 20 · lg |H|", `G = 20 · lg ${f6(cabs(pk.h))}`, pk.gainDb, "dB"));
    t.push(step("EL-W06-PHI", "Phase im Maximum", "φ = arg H", `φ = arg(${fc(pk.h)})`, pk.phaseDeg, "°"));
    marks.f3dB.forEach((f, k) => t.push(step("EL-W08", `−3-dB-Punkt ${k + 1}`, "G(f) = G_max − 20 · lg √2", `G_max = ${f6(marks.gPeak)} dB, Schnitt mit ${f6(marks.gPeak - DB3)} dB, lineare Interpolation über lg f`, f, "Hz")));
    if (!marks.f3dB.length) findings.push({ level: "info", text: "Im Frequenzbereich kein −3-dB-Punkt" });
  }
  return { ok: true, points, marks, findings, trace: { wechselstrom: t } };
}
