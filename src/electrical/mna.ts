/**
 * Aufbau und Lösen der modifizierten Knotenpunktanalyse (Modul elektrik, intern, ab 0.21.0 aus network.ts herausgelöst).
 * Bauteile → Primitive (Leitwert, Spannungsquelle, Stromquelle, idealer Übertrager, ab 0.21.0 spannungsgesteuerte
 * Stromquelle für die Begleitmodelle der Halbleiter), Bezug je Teilnetz, Prüfung, LU-Zerlegung. Formeln und Konventionen
 * wie in network.ts beschrieben. Nicht über index.ts exportiert.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { C0, C1, cabs, cadd, carg, cinv, cmul, cneg, cconj, cpolar, cscale, csub, cx, solveLinear, type Complex } from "./complex";
import type { ElElement, ElFinding, ElNetlist } from "./network";
import { parseDevice, type Device } from "./devices";
import { DEFAULT_BOARD, boardHighVoltage } from "./pins";

export const LINEAR = new Set(["widerstand", "potentiometer", "kondensator", "spule", "gleichspannungsquelle", "batterie", "gleichstromquelle", "wechselspannungsquelle",
  "masse", "schalter", "taster", "lampe", "transformator", "voltmeter", "amperemeter", "digitalpin", "knoten"]);
export const NONLINEAR = new Set(["led", "diode", "z_diode", "npn", "pnp", "n_mosfet"]);
/** Wicklungs- und Potentiometer-Untergrenze (Ω), damit die Stellung 0 bzw. 1 nicht singulär wird. */
export const R_MIN = 1e-6;
/** Auslastung: ab hier Warnung, über 1 Fehler. */
export const UTIL_WARN = 0.8;

export type Prim =
  | { t: "Y"; a: string; b: string; y: Complex; el: string; main: boolean }
  | { t: "V"; a: string; b: string; v: Complex; el: string; main: boolean; k: number }
  | { t: "I"; a: string; b: string; i: Complex; el: string }
  | { t: "X"; p1: string; p2: string; s1: string; s2: string; n: number; el: string; k: number }
  /** Spannungsgesteuerte Stromquelle (ab 0.21.0): Strom g · (u_c − u_d) fließt im Bauteil von a nach b (verlässt Knoten a). */
  | { t: "G"; a: string; b: string; c: string; d: string; g: Complex; el: string };

export const label = (e: ElElement): string => e.label ?? e.id;
export const deg = (r: number): number => (r * 180) / Math.PI;
export const f6 = (x: number): string => fmt(x, 6);
export const fc = (c: Complex): string => (Math.abs(c.im) < 1e-15 * Math.max(1, Math.abs(c.re)) ? f6(c.re) : `${f6(c.re)} ${c.im < 0 ? "−" : "+"} j·${f6(Math.abs(c.im))}`);
export const fp = (c: Complex): string => `${f6(cabs(c))} ∠ ${f6(deg(carg(c)))}°`;

export class UnionFind {
  private p = new Map<string, string>();
  find(x: string): string { let r = x; while (this.p.has(r) && this.p.get(r) !== r) r = this.p.get(r)!; this.p.set(x, r); return r; }
  add(x: string): void { if (!this.p.has(x)) this.p.set(x, x); }
  union(a: string, b: string): boolean { const ra = this.find(a), rb = this.find(b); if (ra === rb) return false; this.p.set(rb, ra); return true; }
}

export function num(e: ElElement, key: string, findings: ElFinding[], opt: { min?: number; positive?: boolean } = {}): number | null {
  const v = e.params[key];
  if (typeof v !== "number" || !Number.isFinite(v)) { findings.push({ level: "fail", elementId: e.id, text: `${label(e)}: Parameter ${key} fehlt oder ist keine Zahl` }); return null; }
  if (opt.positive && !(v > 0)) { findings.push({ level: "fail", elementId: e.id, text: `${label(e)}: ${key} muss größer 0 sein` }); return null; }
  if (opt.min !== undefined && v < opt.min) { findings.push({ level: "fail", elementId: e.id, text: `${label(e)}: ${key} muss mindestens ${opt.min} sein` }); return null; }
  return v;
}
export const bool = (e: ElElement, key: string): boolean => e.params[key] === true || e.params[key] === "true";

export interface Built {
  prims: Prim[];
  nb: number;
  /** Anschlüsse a, b je Bauteil für U = u_a − u_b. */
  term: Map<string, [string, string]>;
  /** Hauptprimitiv je Bauteil für I (Stromquelle: I-Primitiv). */
  main: Map<string, Prim>;
  findings: ElFinding[];
  steps: { netz: CalcStep[]; wechselstrom: CalcStep[] };
  sources: { el: string; f: number }[];
  /** Nichtlineare Bauteile (ab 0.21.0, EL-H); ihre Begleitmodelle stempelt die Newton-Iteration. */
  devices: Device[];
}

/** Bauteile → Primitive (Leitwert, Spannungsquelle, Stromquelle, idealer Übertrager). omega = null: Gleichstrom. */
export function build(net: ElNetlist, omega: number | null): Built {
  const prims: Prim[] = [], term = new Map<string, [string, string]>(), main = new Map<string, Prim>(), findings: ElFinding[] = [];
  const steps = { netz: [] as CalcStep[], wechselstrom: [] as CalcStep[] }, sources: { el: string; f: number }[] = [], devices: Device[] = [];
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
    if (NONLINEAR.has(e.kind)) { const d = parseDevice(e, (nm) => pin(e, nm), findings, prims); if (d) devices.push(d); continue; }
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
        W(step("EL-W02-C", `Betrag der Impedanz ${L} (Z_C = 1 / (jωC) = −j · |Z_C|)`, "|Z_C| = 1 / (ω · C)", `|Z_C| = 1 / (${f6(omega)} 1/s · ${f6(c)} F)`, cabs(cinv(y)), "Ω"));
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
        W(step("EL-W02-L", `Betrag der Impedanz ${L} (Z_L = r + jωL)`, "|Z_L| = √(r² + (ω · L)²)", `|Z_L| = √((${f6(r)} Ω)² + (${f6(omega)} 1/s · ${f6(l)} H)²)`, cabs(z), "Ω"));
        Y(a, b, cinv(z), e.id, true); break;
      }
      case "gleichspannungsquelle": case "digitalpin": {
        let u: number | null;
        if (e.kind === "digitalpin") {
          // HIGH-Spannung: Parameter u_high_V, sonst aus dem Board (E-v11-11, fd_mcu_boards)
          const brd = typeof e.params["board"] === "string" && e.params["board"] ? (e.params["board"] as string) : DEFAULT_BOARD;
          const high = e.params["u_high_V"] === undefined && boardHighVoltage(brd) !== undefined ? boardHighVoltage(brd)! : num(e, "u_high_V", findings);
          u = high === null ? null : e.params["zustand"] === "LOW" ? 0 : high;
        }
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
  return { prims, nb, term, main, findings, steps, sources, devices };
}

export interface Solved {
  ok: boolean;
  V: Map<string, Complex>;
  branch: Complex[];
  findings: ElFinding[];
  unknowns: { nodes: number; branches: number };
  skipped: Set<string>;
}

/** Bezug je Teilnetz, Prüfung auf Spannungsmaschen und Stromquellen ohne Rückweg, Aufstellen und Lösen. */
export function solve(net: ElNetlist, b: Built): Solved {
  const findings: ElFinding[] = [];
  const order: string[] = [...net.nodes];
  const seen = new Set(order);
  for (const p of b.prims) for (const n of p.t === "X" ? [p.p1, p.p2, p.s1, p.s2] : p.t === "G" ? [p.a, p.b, p.c, p.d] : [p.a, p.b]) if (!seen.has(n)) { seen.add(n); order.push(n); }
  const uf = new UnionFind();
  order.forEach((n) => uf.add(n));
  for (const p of b.prims) {
    if (p.t === "Y" || p.t === "V") uf.union(p.a, p.b);
    if (p.t === "G") uf.union(p.a, p.b); // Begleitmodell: Klemmen im Bauteil über G_min verbunden
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
    else if (p.t === "G") { const ia = idx.get(p.a), ib = idx.get(p.b), ic = idx.get(p.c), id = idx.get(p.d); add(ia, ic, p.g); add(ia, id, cneg(p.g)); add(ib, ic, cneg(p.g)); add(ib, id, p.g); }
    else {
      const k = nn + p.k, s1 = idx.get(p.s1), s2 = idx.get(p.s2), p1 = idx.get(p.p1), p2 = idx.get(p.p2);
      add(s1, k, C1); add(s2, k, cneg(C1)); add(p1, k, cx(-p.n)); add(p2, k, cx(p.n));
      add(k, s1, C1); add(k, s2, cneg(C1)); add(k, p1, cx(-p.n)); add(k, p2, cx(p.n));
    }
  }
  // Mit Halbleitern (ab 0.21.0): Zeilen- und Spaltenausgleich vor der LU-Zerlegung, damit sehr große Leitwerte
  // (Exponentenbegrenzung EL-H05) neben Einheitsstempeln der Quellen nicht als singulär gelten. Lineare Netze unverändert.
  const x = b.devices.length ? solveEquilibrated(A, z) : solveLinear(A, z);
  if (x === null) {
    findings.push({ level: "fail", text: "Gleichungssystem singulär: Schaltung nicht eindeutig lösbar (Masche aus Quellen, Knoten nur über Stromquellen angeschlossen oder Übertrager ohne Last prüfen)" });
    return { ok: false, V: new Map(), branch: [], findings, unknowns: { nodes: nn, branches: b.nb }, skipped };
  }
  const V = new Map<string, Complex>();
  for (const nd of order) { const i = idx.get(nd); V.set(nd, i === undefined ? C0 : x[i]!); }
  return { ok: true, V, branch: x.slice(nn), findings, unknowns: { nodes: nn, branches: b.nb }, skipped };
}

/** Strom (a → b) und Leistung eines Primitivs. */
export function primFlow(p: Prim, s: Solved): { i: Complex; s: Complex } {
  const v = (n: string): Complex => s.V.get(n) ?? C0;
  if (p.t === "Y") { const u = csub(v(p.a), v(p.b)), i = cmul(p.y, u); return { i, s: cmul(u, cconj(i)) }; }
  if (p.t === "V") { const u = csub(v(p.a), v(p.b)), i = s.branch[p.k]!; return { i, s: cmul(u, cconj(i)) }; }
  if (p.t === "I") { const u = csub(v(p.a), v(p.b)), i = cneg(p.i); return { i, s: cmul(u, cconj(i)) }; }
  if (p.t === "G") { const u = csub(v(p.a), v(p.b)), i = cmul(p.g, csub(v(p.c), v(p.d))); return { i, s: cmul(u, cconj(i)) }; }
  const is = s.branch[p.k]!, ip = cscale(is, -p.n), up = csub(v(p.p1), v(p.p2)), us = csub(v(p.s1), v(p.s2));
  return { i: ip, s: cadd(cmul(up, cconj(ip)), cmul(us, cconj(is))) };
}

export interface ElementFlows { u: Complex; i: Complex; s: Complex }
export function flows(net: ElNetlist, b: Built, s: Solved): Map<string, ElementFlows> {
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

export function utilization(net: ElNetlist, fl: Map<string, ElementFlows>, ac: boolean, findings: ElFinding[], steps: CalcStep[]): Record<string, number> {
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

/** Lösen mit Zeilen- und Spaltenausgleich: A' = D_r · A · D_c, x = D_c · y (Beträge auf 1 normiert). */
function solveEquilibrated(A: Complex[][], z: Complex[]): Complex[] | null {
  const n = z.length;
  const r = A.map((row) => { const m = Math.max(...row.map(cabs)); return m > 0 ? 1 / m : 1; });
  const As = A.map((row, i) => row.map((v) => cscale(v, r[i]!)));
  const c = Array.from({ length: n }, (_, j) => { let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, cabs(As[i]![j]!)); return m > 0 ? 1 / m : 1; });
  const Ac = As.map((row) => row.map((v, j) => cscale(v, c[j]!)));
  const y = solveLinear(Ac, z.map((v, i) => cscale(v, r[i]!)));
  return y ? y.map((v, j) => cscale(v, c[j]!)) : null;
}
