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
 *  - Nichtlineare Bauteile (Diode, LED, Z-Diode, Transistoren, MOSFET) werden in v1 als offen behandelt (Hinweis).
 *  - Gleichstrom: Kondensator offen, Spule als 0-V-Quelle (mit Wicklungswiderstand r), Wechselspannungsquellen 0 V,
 *    Transformator nicht gekoppelt. Wechselstrom: Gleichquellen deaktiviert (Spannungsquelle 0 V, Stromquelle offen,
 *    Batterie nur R_i).
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace, type TraceGroupOf } from "../trace";
import { C0, C1, cabs, cadd, carg, cconj, cdiv, cinv, cmul, cneg, cpolar, cscale, csub, cx, solveLinear, type Complex } from "./complex";

export type ElGroup = TraceGroupOf<"elektrik">;
export type ElParam = number | string | boolean;
export interface ElElement { id: string; kind: string; pins: Readonly<Record<string, string>>; params: Readonly<Record<string, ElParam>>; label?: string }
/** Netzliste (Knotennamen frei, Masse-Knoten in ground). Strukturgleich mit der Netzliste der App Stromwerk. */
export interface ElNetlist { nodes: readonly string[]; ground: string | null; elements: readonly ElElement[] }
export interface ElFinding { level: "info" | "warn" | "fail"; elementId?: string; nodeId?: string; text: string }

export interface DcElementResult { u: number; i: number; p: number }
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

/** Wicklungs- und Potentiometer-Untergrenze (Ω), damit die Stellung 0 bzw. 1 nicht singulär wird. */
export const R_MIN = 1e-6;
/** Auslastung: ab hier Warnung, über 1 Fehler. */
export const UTIL_WARN = 0.8;

const LINEAR = new Set(["widerstand", "potentiometer", "kondensator", "spule", "gleichspannungsquelle", "batterie", "gleichstromquelle", "wechselspannungsquelle",
  "masse", "schalter", "taster", "lampe", "transformator", "voltmeter", "amperemeter", "digitalpin", "knoten"]);
const NONLINEAR = new Set(["led", "diode", "z_diode", "npn", "pnp", "n_mosfet"]);
export const isNonlinearKind = (k: string): boolean => NONLINEAR.has(k);

type Prim =
  | { t: "Y"; a: string; b: string; y: Complex; el: string; main: boolean }
  | { t: "V"; a: string; b: string; v: Complex; el: string; main: boolean; k: number }
  | { t: "I"; a: string; b: string; i: Complex; el: string }
  | { t: "X"; p1: string; p2: string; s1: string; s2: string; n: number; el: string; k: number };

const label = (e: ElElement): string => e.label ?? e.id;
const deg = (r: number): number => (r * 180) / Math.PI;
const f6 = (x: number): string => fmt(x, 6);
const fc = (c: Complex): string => (Math.abs(c.im) < 1e-15 * Math.max(1, Math.abs(c.re)) ? f6(c.re) : `${f6(c.re)} ${c.im < 0 ? "−" : "+"} j·${f6(Math.abs(c.im))}`);
const fp = (c: Complex): string => `${f6(cabs(c))} ∠ ${f6(deg(carg(c)))}°`;

class UnionFind {
  private p = new Map<string, string>();
  find(x: string): string { let r = x; while (this.p.has(r) && this.p.get(r) !== r) r = this.p.get(r)!; this.p.set(x, r); return r; }
  add(x: string): void { if (!this.p.has(x)) this.p.set(x, x); }
  union(a: string, b: string): boolean { const ra = this.find(a), rb = this.find(b); if (ra === rb) return false; this.p.set(rb, ra); return true; }
}

function num(e: ElElement, key: string, findings: ElFinding[], opt: { min?: number; positive?: boolean } = {}): number | null {
  const v = e.params[key];
  if (typeof v !== "number" || !Number.isFinite(v)) { findings.push({ level: "fail", elementId: e.id, text: `${label(e)}: Parameter ${key} fehlt oder ist keine Zahl` }); return null; }
  if (opt.positive && !(v > 0)) { findings.push({ level: "fail", elementId: e.id, text: `${label(e)}: ${key} muss größer 0 sein` }); return null; }
  if (opt.min !== undefined && v < opt.min) { findings.push({ level: "fail", elementId: e.id, text: `${label(e)}: ${key} muss mindestens ${opt.min} sein` }); return null; }
  return v;
}
const bool = (e: ElElement, key: string): boolean => e.params[key] === true || e.params[key] === "true";

interface Built {
  prims: Prim[];
  nb: number;
  /** Anschlüsse a, b je Bauteil für U = u_a − u_b. */
  term: Map<string, [string, string]>;
  /** Hauptprimitiv je Bauteil für I (Stromquelle: I-Primitiv). */
  main: Map<string, Prim>;
  findings: ElFinding[];
  steps: { netz: CalcStep[]; wechselstrom: CalcStep[] };
  sources: { el: string; f: number }[];
}

/** Bauteile → Primitive (Leitwert, Spannungsquelle, Stromquelle, idealer Übertrager). omega = null: Gleichstrom. */
function build(net: ElNetlist, omega: number | null): Built {
  const prims: Prim[] = [], term = new Map<string, [string, string]>(), main = new Map<string, Prim>(), findings: ElFinding[] = [];
  const steps = { netz: [] as CalcStep[], wechselstrom: [] as CalcStep[] }, sources: { el: string; f: number }[] = [];
  let nb = 0;
  const ac = omega !== null;
  const W = (s: CalcStep): void => { steps.wechselstrom.push(s); };
  const N = (s: CalcStep): void => { steps.netz.push(s); };
  const Y = (a: string, b: string, y: Complex, el: string, isMain: boolean): void => { const p: Prim = { t: "Y", a, b, y, el, main: isMain }; prims.push(p); if (isMain) main.set(el, p); };
  const V = (a: string, b: string, v: Complex, el: string, isMain: boolean): void => { const p: Prim = { t: "V", a, b, v, el, main: isMain, k: nb++ }; prims.push(p); if (isMain) main.set(el, p); };
  const pin = (e: ElElement, name: string): string | null => {
    const n = e.pins[name];
    if (n === undefined || n === "") { findings.push({ level: "warn", elementId: e.id, text: `${label(e)}: Anschluss ${name} offen` }); return null; }
    return n;
  };
  for (const e of net.elements) {
    const L = label(e);
    if (NONLINEAR.has(e.kind)) { findings.push({ level: "info", elementId: e.id, text: `${L}: Simulation folgt (v1.1), Bauteil wird als offen behandelt` }); continue; }
    if (!LINEAR.has(e.kind)) { findings.push({ level: "warn", elementId: e.id, text: `${L}: Bauteilart ${e.kind} unbekannt, nicht berechnet` }); continue; }
    if (e.kind === "masse" || e.kind === "knoten") continue;
    if (e.kind === "transformator") {
      const p1 = pin(e, "p1"), p2 = pin(e, "p2"), s1 = pin(e, "s1"), s2 = pin(e, "s2");
      const n1 = num(e, "n1", findings, { positive: true }), n2 = num(e, "n2", findings, { positive: true });
      if (!p1 || !p2 || !s1 || !s2 || n1 === null || n2 === null) continue;
      term.set(e.id, [p1, p2]);
      if (!ac) { findings.push({ level: "info", elementId: e.id, text: `${L}: Ein Transformator überträgt keine Gleichspannung, Primär- und Sekundärseite offen` }); continue; }
      const n = n2 / n1, k = nb++;
      const p: Prim = { t: "X", p1, p2, s1, s2, n, el: e.id, k }; prims.push(p); main.set(e.id, p);
      continue;
    }
    const twoPins: Record<string, [string, string]> = { gleichspannungsquelle: ["plus", "minus"], batterie: ["plus", "minus"], gleichstromquelle: ["plus", "minus"], wechselspannungsquelle: ["plus", "minus"], digitalpin: ["pin", "gnd"] };
    const [pa, pb] = twoPins[e.kind] ?? ["a", "b"];
    const a = pin(e, pa), b = pin(e, pb);
    if (!a || !b) continue;
    term.set(e.id, [a, b]);
    switch (e.kind) {
      case "widerstand": {
        const r = num(e, "r_ohm", findings, { positive: true }); if (r === null) break;
        N(step("EL-N01-R", `Leitwert ${L}`, "G = 1 / R", `G = 1 / ${f6(r)} Ω`, 1 / r, "S"));
        if (ac) W(step("EL-W02-R", `Impedanz ${L}`, "Z_R = R", `Z_R = ${f6(r)} Ω`, r, "Ω"));
        Y(a, b, cx(1 / r), e.id, true); break;
      }
      case "lampe": {
        const un = num(e, "u_nenn_V", findings, { positive: true }), pn = num(e, "p_nenn_W", findings, { positive: true }); if (un === null || pn === null) break;
        const r = (un * un) / pn;
        N(step("EL-N01-LA", `Widerstand Glühlampe ${L} (warm, EL-E4)`, "R = U_N² / P_N", `R = ${f6(un)}² V² / ${f6(pn)} W`, r, "Ω"));
        Y(a, b, cx(1 / r), e.id, true); break;
      }
      case "potentiometer": {
        const r = num(e, "r_ohm", findings, { positive: true }), x0 = num(e, "position", findings, { min: 0 }); if (r === null || x0 === null) break;
        if (x0 > 1) { findings.push({ level: "fail", elementId: e.id, text: `${L}: Stellung muss zwischen 0 und 1 liegen` }); break; }
        const s = pin(e, "s"); if (!s) break;
        const ras = Math.max(x0 * r, R_MIN), rsb = Math.max((1 - x0) * r, R_MIN);
        N(step("EL-N01-PA", `Teilwiderstand a–s ${L}`, "R_as = x · R", `R_as = ${f6(x0)} · ${f6(r)} Ω (mindestens ${fmt(R_MIN)} Ω)`, ras, "Ω"));
        N(step("EL-N01-PB", `Teilwiderstand s–b ${L}`, "R_sb = (1 − x) · R", `R_sb = (1 − ${f6(x0)}) · ${f6(r)} Ω (mindestens ${fmt(R_MIN)} Ω)`, rsb, "Ω"));
        Y(a, s, cx(1 / ras), e.id, true); Y(s, b, cx(1 / rsb), e.id, false); break;
      }
      case "kondensator": {
        const c = num(e, "c_F", findings, { positive: true }); if (c === null) break;
        if (!ac) { N(step("EL-N05", `Kondensator ${L} bei Gleichstrom (offen)`, "I_C = 0", "I_C = 0 A", 0, "A")); break; }
        const y = cx(0, omega * c);
        W(step("EL-W02-C", `Impedanz ${L}`, "Z_C = 1 / (jωC)", `Z_C = 1 / (j · ${f6(omega)} 1/s · ${f6(c)} F)`, cabs(cinv(y)), "Ω"));
        Y(a, b, y, e.id, true); break;
      }
      case "spule": {
        const l = num(e, "l_H", findings, { positive: true }); if (l === null) break;
        const r = typeof e.params["r_ohm"] === "number" && e.params["r_ohm"] > 0 ? e.params["r_ohm"] : 0;
        if (!ac) {
          if (r > 0) { const m = `${e.id}#m`; Y(a, m, cx(1 / r), e.id, false); V(m, b, C0, e.id, true); } else V(a, b, C0, e.id, true);
          break;
        }
        const z = cx(r, omega * l);
        W(step("EL-W02-L", `Impedanz ${L}`, "Z_L = r + jωL", `Z_L = ${f6(r)} Ω + j · ${f6(omega)} 1/s · ${f6(l)} H`, cabs(z), "Ω"));
        Y(a, b, cinv(z), e.id, true); break;
      }
      case "gleichspannungsquelle": case "digitalpin": {
        let u: number | null;
        if (e.kind === "digitalpin") { const high = num(e, "u_high_V", findings); u = high === null ? null : e.params["zustand"] === "LOW" ? 0 : high; }
        else u = num(e, "u_V", findings);
        if (u === null) break;
        if (ac) { V(a, b, C0, e.id, true); break; }
        N(step("EL-N02", `Spannungsquelle ${L}`, "u_+ − u_− = U", `u_+ − u_− = ${f6(u)} V`, u, "V"));
        V(a, b, cx(u), e.id, true); break;
      }
      case "batterie": {
        const u0 = num(e, "u_V", findings), ri = num(e, "r_i_ohm", findings, { min: 0 }); if (u0 === null || ri === null) break;
        if (ac) { if (ri > 0) Y(a, b, cx(1 / ri), e.id, true); else V(a, b, C0, e.id, true); break; }
        N(step("EL-N02", `Leerlaufspannung ${L}`, "u_+ − u_− = U", `U_0 = ${f6(u0)} V`, u0, "V"));
        if (ri > 0) { const m = `${e.id}#m`; Y(a, m, cx(1 / ri), e.id, false); V(m, b, cx(u0), e.id, true); } else V(a, b, cx(u0), e.id, true);
        break;
      }
      case "gleichstromquelle": {
        const i = num(e, "i_A", findings); if (i === null) break;
        if (ac) break;
        N(step("EL-N04", `Stromquelle ${L}`, "Einspeisung I_q am Pluspol", `I_q = ${f6(i)} A`, i, "A"));
        const p: Prim = { t: "I", a, b, i: cx(i), el: e.id }; prims.push(p); main.set(e.id, p); break;
      }
      case "wechselspannungsquelle": {
        const ue = num(e, "u_eff_V", findings), f = num(e, "f_Hz", findings, { positive: true }), ph = typeof e.params["phase_deg"] === "number" ? e.params["phase_deg"] : 0;
        if (ue === null || f === null) break;
        if (!ac) { findings.push({ level: "info", elementId: e.id, text: `${L}: Wechselspannungsquelle bei Gleichstrom mit 0 V gerechnet` }); V(a, b, C0, e.id, true); break; }
        sources.push({ el: e.id, f });
        const u = cpolar(ue, (ph * Math.PI) / 180);
        W(step("EL-W03", `Zeiger der Quelle ${L} (Effektivwert)`, "U = U_eff · e^(jφ)", `U = ${f6(ue)} V · e^(j · ${f6(ph)}°)`, ue, "V"));
        V(a, b, u, e.id, true); break;
      }
      case "schalter": case "taster": case "amperemeter": {
        const closed = e.kind === "amperemeter" || bool(e, e.kind === "schalter" ? "geschlossen" : "gedrueckt");
        if (closed) V(a, b, C0, e.id, true);
        break;
      }
      case "voltmeter": break;
    }
  }
  return { prims, nb, term, main, findings, steps, sources };
}

interface Solved {
  ok: boolean;
  V: Map<string, Complex>;
  branch: Complex[];
  findings: ElFinding[];
  unknowns: { nodes: number; branches: number };
  skipped: Set<string>;
}

/** Bezug je Teilnetz, Prüfung auf Spannungsmaschen und Stromquellen ohne Rückweg, Aufstellen und Lösen. */
function solve(net: ElNetlist, b: Built): Solved {
  const findings: ElFinding[] = [];
  const order: string[] = [...net.nodes];
  const seen = new Set(order);
  for (const p of b.prims) for (const n of p.t === "X" ? [p.p1, p.p2, p.s1, p.s2] : [p.a, p.b]) if (!seen.has(n)) { seen.add(n); order.push(n); }
  const uf = new UnionFind();
  order.forEach((n) => uf.add(n));
  for (const p of b.prims) {
    if (p.t === "Y" || p.t === "V") uf.union(p.a, p.b);
    if (p.t === "X") { uf.union(p.p1, p.p2); uf.union(p.s1, p.s2); }
  }
  const ground = net.ground !== null && seen.has(net.ground) ? net.ground : null;
  if (ground === null && order.length) findings.push({ level: "warn", nodeId: order[0]!, text: `Keine Masse gesetzt: Bezugsknoten ${order[0]} = 0 V` });
  const refOf = new Map<string, string>();
  const comps = new Map<string, string[]>();
  for (const n of order) { const r = uf.find(n); if (!comps.has(r)) comps.set(r, []); comps.get(r)!.push(n); }
  for (const nodes of comps.values()) {
    const ref = ground !== null && nodes.includes(ground) ? ground : nodes[0]!;
    nodes.forEach((n) => refOf.set(n, ref));
    if (ref !== ground && nodes.length > 1 && !(ground === null && nodes.includes(order[0]!))) {
      findings.push({ level: "warn", nodeId: ref, text: `Teilnetz ohne Verbindung zur Masse (${nodes.filter((n) => !n.includes("#")).join(", ")}): Bezug ${ref} = 0 V gesetzt` });
    }
  }
  const skipped = new Set<string>();
  // Stromquellen müssen beide Pole im selben Teilnetz haben
  for (const p of b.prims) if (p.t === "I" && uf.find(p.a) !== uf.find(p.b)) {
    skipped.add(p.el); findings.push({ level: "fail", elementId: p.el, text: `Stromquelle ${p.el}: kein geschlossener Stromkreis zwischen den Polen, nicht berechnet` });
  }
  // Maschen aus idealen Spannungsquellen bzw. Kurzschlussbrücken
  const vf = new UnionFind();
  order.forEach((n) => vf.add(n));
  for (const p of b.prims) {
    if (p.t !== "V") continue;
    if (p.a === p.b) {
      if (cabs(p.v) > 0) { findings.push({ level: "fail", elementId: p.el, text: `${p.el}: Quelle ist kurzgeschlossen (beide Pole am selben Knoten)` }); return { ok: false, V: new Map(), branch: [], findings, unknowns: { nodes: 0, branches: 0 }, skipped }; }
      continue;
    }
    if (!vf.union(p.a, p.b)) {
      findings.push({ level: "fail", elementId: p.el, text: `${p.el}: bildet mit idealen Spannungsquellen bzw. Kurzschlussbrücken (Schalter, Amperemeter, Spule) eine Masche, Ströme unbestimmt; Kurzschluss prüfen` });
      return { ok: false, V: new Map(), branch: [], findings, unknowns: { nodes: 0, branches: 0 }, skipped };
    }
  }
  const idx = new Map<string, number>();
  for (const n of order) if (refOf.get(n) !== n) idx.set(n, idx.size);
  const nn = idx.size, n = nn + b.nb;
  const A: Complex[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => C0));
  const z: Complex[] = Array.from({ length: n }, () => C0);
  const add = (r: number | undefined, c: number | undefined, v: Complex): void => { if (r !== undefined && c !== undefined) A[r]![c] = cadd(A[r]![c]!, v); };
  const rhs = (r: number | undefined, v: Complex): void => { if (r !== undefined) z[r] = cadd(z[r]!, v); };
  for (const p of b.prims) {
    if (p.t === "Y") { const ia = idx.get(p.a), ib = idx.get(p.b); add(ia, ia, p.y); add(ib, ib, p.y); add(ia, ib, cneg(p.y)); add(ib, ia, cneg(p.y)); }
    else if (p.t === "V") {
      if (p.a === p.b) { const k = nn + p.k; A[k]![k] = C1; continue; }
      const ia = idx.get(p.a), ib = idx.get(p.b), k = nn + p.k;
      add(ia, k, C1); add(ib, k, cneg(C1)); add(k, ia, C1); add(k, ib, cneg(C1)); z[k] = p.v;
    } else if (p.t === "I") { if (skipped.has(p.el)) continue; rhs(idx.get(p.a), p.i); rhs(idx.get(p.b), cneg(p.i)); }
    else {
      const k = nn + p.k, s1 = idx.get(p.s1), s2 = idx.get(p.s2), p1 = idx.get(p.p1), p2 = idx.get(p.p2);
      add(s1, k, C1); add(s2, k, cneg(C1)); add(p1, k, cx(-p.n)); add(p2, k, cx(p.n));
      add(k, s1, C1); add(k, s2, cneg(C1)); add(k, p1, cx(-p.n)); add(k, p2, cx(p.n));
    }
  }
  const x = solveLinear(A, z);
  if (x === null) {
    findings.push({ level: "fail", text: "Gleichungssystem singulär: Schaltung nicht eindeutig lösbar (Masche aus Quellen, Knoten nur über Stromquellen angeschlossen oder Übertrager ohne Last prüfen)" });
    return { ok: false, V: new Map(), branch: [], findings, unknowns: { nodes: nn, branches: b.nb }, skipped };
  }
  const V = new Map<string, Complex>();
  for (const nd of order) { const i = idx.get(nd); V.set(nd, i === undefined ? C0 : x[i]!); }
  return { ok: true, V, branch: x.slice(nn), findings, unknowns: { nodes: nn, branches: b.nb }, skipped };
}

/** Strom (a → b) und Leistung eines Primitivs. */
function primFlow(p: Prim, s: Solved): { i: Complex; s: Complex } {
  const v = (n: string): Complex => s.V.get(n) ?? C0;
  if (p.t === "Y") { const u = csub(v(p.a), v(p.b)), i = cmul(p.y, u); return { i, s: cmul(u, cconj(i)) }; }
  if (p.t === "V") { const u = csub(v(p.a), v(p.b)), i = s.branch[p.k]!; return { i, s: cmul(u, cconj(i)) }; }
  if (p.t === "I") { const u = csub(v(p.a), v(p.b)), i = cneg(p.i); return { i, s: cmul(u, cconj(i)) }; }
  const is = s.branch[p.k]!, ip = cscale(is, -p.n), up = csub(v(p.p1), v(p.p2)), us = csub(v(p.s1), v(p.s2));
  return { i: ip, s: cadd(cmul(up, cconj(ip)), cmul(us, cconj(is))) };
}

interface ElementFlows { u: Complex; i: Complex; s: Complex }
function flows(net: ElNetlist, b: Built, s: Solved): Map<string, ElementFlows> {
  const out = new Map<string, ElementFlows>();
  for (const e of net.elements) {
    const t = b.term.get(e.id);
    if (!t || s.skipped.has(e.id)) continue;
    const u = csub(s.V.get(t[0]) ?? C0, s.V.get(t[1]) ?? C0);
    const m = b.main.get(e.id);
    let st = C0;
    for (const p of b.prims) if (p.el === e.id) st = cadd(st, primFlow(p, s).s);
    out.set(e.id, { u, i: m ? primFlow(m, s).i : C0, s: st });
  }
  return out;
}

function utilization(net: ElNetlist, fl: Map<string, ElementFlows>, ac: boolean, findings: ElFinding[], steps: CalcStep[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of net.elements) {
    const f = fl.get(e.id); if (!f) continue;
    let a: number | null = null;
    if (e.kind === "widerstand" && typeof e.params["p_max_W"] === "number" && e.params["p_max_W"] > 0) {
      const P = f.s.re, pm = e.params["p_max_W"];
      a = Math.abs(P) / pm;
      steps.push(step("EL-N13-R", `Auslastung ${label(e)}`, "a = |P| / P_max", `a = ${f6(Math.abs(P))} W / ${f6(pm)} W`, a, "1"));
    }
    if (e.kind === "kondensator" && typeof e.params["u_max_V"] === "number" && e.params["u_max_V"] > 0) {
      const um = e.params["u_max_V"];
      if (ac) { a = (Math.SQRT2 * cabs(f.u)) / um; steps.push(step("EL-N13-CA", `Auslastung ${label(e)} (Scheitelwert)`, "a = √2 · |U| / U_max", `a = √2 · ${f6(cabs(f.u))} V / ${f6(um)} V`, a, "1")); }
      else { a = Math.abs(f.u.re) / um; steps.push(step("EL-N13-C", `Auslastung ${label(e)}`, "a = |U| / U_max", `a = ${f6(Math.abs(f.u.re))} V / ${f6(um)} V`, a, "1")); }
    }
    if (a === null) continue;
    out[e.id] = a;
    if (a > 1) findings.push({ level: "fail", elementId: e.id, text: `${label(e)}: Auslastung ${fmt(a * 100, 3)} % über dem Grenzwert` });
    else if (a > UTIL_WARN) findings.push({ level: "warn", elementId: e.id, text: `${label(e)}: Auslastung ${fmt(a * 100, 3)} %` });
  }
  return out;
}

const addTrace = (t: Trace<ElGroup>, g: ElGroup, s: CalcStep[]): void => { if (s.length) (t[g] ??= []).push(...s); };

/** Gleichstrom-Arbeitspunkt (EL-N01 bis EL-N13). */
export function solveDc(net: ElNetlist): DcResult {
  const b = build(net, null);
  const s = solve(net, b);
  const findings = [...b.findings, ...s.findings];
  const trace: Trace<ElGroup> = {};
  addTrace(trace, "netz", b.steps.netz);
  if (!s.ok) return { ok: false, nodes: {}, elements: {}, balance: NaN, utilization: {}, findings, trace };
  const res: string[] = [];
  const rs: CalcStep[] = [step("EL-N10", "Lineares Gleichungssystem der Knotenpunktanalyse", "A · x = z", `${s.unknowns.nodes + s.unknowns.branches} Unbekannte (${s.unknowns.nodes} Knotenspannungen, ${s.unknowns.branches} Zweigströme), LU-Zerlegung mit Spaltenpivotisierung`, s.unknowns.nodes + s.unknowns.branches, "1")];
  const fl = flows(net, b, s);
  const elements: Record<string, DcElementResult> = {};
  let bal = 0, absSum = 0;
  for (const e of net.elements) {
    const f = fl.get(e.id); if (!f) continue;
    const u = f.u.re, i = f.i.re, p = f.s.re, L = label(e);
    elements[e.id] = { u, i, p }; bal += p; absSum += Math.abs(p);
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
  const nachweis: CalcStep[] = [step("EL-N12", "Leistungsbilanz", "Σ P = 0", `Σ P = ${res.join(" + ") || "0"} W`, bal, "W")];
  if (Math.abs(bal) > 1e-9 * Math.max(absSum, 1e-12)) findings.push({ level: "fail", text: `Leistungsbilanz nicht erfüllt: Σ P = ${fmt(bal)} W` });
  const util = utilization(net, fl, false, findings, nachweis);
  addTrace(trace, "netz", rs); addTrace(trace, "nachweis", nachweis);
  const nodes: Record<string, number> = {};
  for (const n of net.nodes) nodes[n] = (s.V.get(n) ?? C0).re;
  return { ok: true, nodes, elements, balance: bal, utilization: util, findings, trace };
}

/** Wechselstrom bei der Frequenz f (EL-W01 bis EL-W05), Effektivwertzeiger. */
export function solveAc(net: ElNetlist, f: number): AcResult {
  if (!(f > 0) || !Number.isFinite(f)) return { ok: false, f, nodes: {}, elements: {}, balance: C0, utilization: {}, findings: [{ level: "fail", text: "Frequenz muss größer 0 sein" }], trace: {} };
  const omega = 2 * Math.PI * f;
  const b = build(net, omega);
  const s = solve(net, b);
  const findings = [...b.findings, ...s.findings];
  for (const src of b.sources) if (Math.abs(src.f - f) > 1e-12 * f) findings.push({ level: "warn", elementId: src.el, text: `${src.el}: Quelle mit f = ${fmt(src.f)} Hz, gerechnet wird bei f = ${fmt(f)} Hz` });
  const trace: Trace<ElGroup> = {};
  addTrace(trace, "wechselstrom", [step("EL-W01", "Kreisfrequenz", "ω = 2π · f", `ω = 2π · ${f6(f)} Hz`, omega, "1/s"), ...b.steps.wechselstrom]);
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
  for (const f of logFrequencies(fMin, fMax, n)) {
    const r = solveAc(net, f);
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
