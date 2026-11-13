/**
 * Ersatzwiderstand zwischen zwei Knoten (Modul elektrik, EL-E01 bis EL-E03).
 * Ersatzwiderstand der passiven Schaltung, wie ihn eine Quelle an den Klemmen sieht: alle Quellen (Spannungs-, Strom-,
 * Wechselspannungsquelle, Batterie, Digitalpin) werden entfernt (offen). Gleichstrombild: Kondensator offen, Spule → Wicklungswiderstand r (0 = Kurzschluss), Schalter nach Stellung,
 * Amperemeter Kurzschluss, Voltmeter und nichtlineare Bauteile offen.
 * EL-E01 Reihen-/Parallelreduktion mit Spur; EL-E02 allgemein über eine Testquelle 1 A und die Knotenpunktanalyse;
 * EL-E03 Gegenprüfung beider Wege.
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace } from "../trace";
import { solveDc, type ElElement, type ElFinding, type ElGroup, type ElNetlist } from "./network";

export interface ReductionStep { kind: "reihe" | "parallel"; elementIds: string[]; label: string; r: number }
export interface EquivalentResult { ok: boolean; r: number | null; reducible: boolean; rMna: number | null; steps: ReductionStep[]; findings: ElFinding[]; trace: Trace<ElGroup> }

interface Edge { a: string; b: string; r: number; ids: string[]; name: string }
const f6 = (x: number): string => fmt(x, 6);
/** Toleranz der Gegenprüfung EL-E03 (relativ). */
export const EQ_TOL = 1e-9;

const par = (r1: number, r2: number): number => (r1 === 0 || r2 === 0 ? 0 : (r1 * r2) / (r1 + r2));

/** Widerstandskanten des deaktivierten Netzes. */
export function resistiveEdges(net: ElNetlist, findings: ElFinding[]): Edge[] {
  const out: Edge[] = [];
  const nm = (e: ElElement): string => e.label ?? e.id;
  const num = (e: ElElement, k: string): number | null => (typeof e.params[k] === "number" && Number.isFinite(e.params[k]) ? (e.params[k] as number) : null);
  const two = (e: ElElement, a: string, b: string, r: number): void => { const na = e.pins[a], nb = e.pins[b]; if (na && nb) out.push({ a: na, b: nb, r, ids: [e.id], name: nm(e) }); };
  for (const e of net.elements) {
    switch (e.kind) {
      case "widerstand": { const r = num(e, "r_ohm"); if (r !== null && r > 0) two(e, "a", "b", r); else findings.push({ level: "fail", elementId: e.id, text: `${nm(e)}: Widerstand fehlt` }); break; }
      case "lampe": { const u = num(e, "u_nenn_V"), p = num(e, "p_nenn_W"); if (u && p) two(e, "a", "b", (u * u) / p); break; }
      case "potentiometer": {
        const r = num(e, "r_ohm"), x = num(e, "position");
        if (r && x !== null) { const s = e.pins["s"]; if (e.pins["a"] && s) out.push({ a: e.pins["a"], b: s, r: Math.max(x * r, 1e-6), ids: [e.id], name: `${nm(e)} (a–s)` }); if (s && e.pins["b"]) out.push({ a: s, b: e.pins["b"], r: Math.max((1 - x) * r, 1e-6), ids: [e.id], name: `${nm(e)} (s–b)` }); }
        break;
      }
      case "spule": { const r = num(e, "r_ohm") ?? 0; two(e, "a", "b", Math.max(r, 0)); break; }
      case "schalter": if (e.params["geschlossen"] === true) two(e, "a", "b", 0); break;
      case "taster": if (e.params["gedrueckt"] === true) two(e, "a", "b", 0); break;
      case "amperemeter": two(e, "a", "b", 0); break;
      default: break;
    }
  }
  return out;
}

/** EL-E02: Ersatzwiderstand über Testquelle 1 A von a nach b (Bezug b), Knotenpunktanalyse. null = keine Verbindung. */
function viaMna(edges: Edge[], a: string, b: string): number | null {
  const nodes = [...new Set(edges.flatMap((e) => [e.a, e.b]).concat([a, b]))];
  const elements: ElElement[] = [];
  // Kurzschlussmaschen vermeiden: Kurzschlusskante nur, wenn sie zwei noch nicht kurzgeschlossene Gruppen verbindet
  const grp = new Map(nodes.map((n) => [n, n]));
  const find = (x: string): string => { let r = x; while (grp.get(r) !== r) r = grp.get(r)!; return r; };
  edges.forEach((e, k) => {
    if (e.r > 0) { elements.push({ id: `e${k}`, kind: "widerstand", pins: { a: e.a, b: e.b }, params: { r_ohm: e.r } }); return; }
    const ra = find(e.a), rb = find(e.b); if (ra === rb) return; grp.set(rb, ra);
    elements.push({ id: `e${k}`, kind: "schalter", pins: { a: e.a, b: e.b }, params: { geschlossen: true } });
  });
  elements.push({ id: "test", kind: "gleichstromquelle", pins: { plus: a, minus: b }, params: { i_A: 1 } }, { id: "gnd", kind: "masse", pins: { a: b }, params: {} });
  const r = solveDc({ nodes, ground: b, elements });
  if (!r.ok || r.findings.some((f) => f.level === "fail")) return null;
  return (r.nodes[a] ?? 0) - (r.nodes[b] ?? 0);
}

/** Ersatzwiderstand zwischen den Knoten a und b. */
export function equivalentResistance(net: ElNetlist, a: string, b: string): EquivalentResult {
  const findings: ElFinding[] = [];
  const steps: ReductionStep[] = [], tr: CalcStep[] = [];
  if (a === b) return { ok: true, r: 0, reducible: true, rMna: 0, steps, findings: [{ level: "info", text: "Beide Klemmen am selben Knoten: R = 0" }], trace: {} };
  const all = resistiveEdges(net, findings);
  if (findings.some((f) => f.level === "fail")) return { ok: false, r: null, reducible: false, rMna: null, steps, findings, trace: {} };
  // Verbindung a – b prüfen
  const adj = new Map<string, string[]>();
  for (const e of all) { (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push(e.b); (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push(e.a); }
  const seen = new Set([a]), q = [a];
  while (q.length) { const n = q.shift()!; for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); q.push(m); } }
  if (!seen.has(b)) return { ok: true, r: null, reducible: true, rMna: null, steps, findings: [{ level: "info", text: "Keine leitende Verbindung zwischen den Klemmen: R = ∞" }], trace: {} };
  let E: Edge[] = all.filter((e) => seen.has(e.a));
  const keep = (n: string): boolean => n === a || n === b;
  for (let guard = 0; guard < 10000; guard++) {
    let changed = false;
    // Kanten mit beiden Enden am selben Knoten tragen keinen Strom
    const loops = E.filter((e) => e.a === e.b);
    if (loops.length) { E = E.filter((e) => e.a !== e.b); changed = true; }
    // offene Enden
    const deg = new Map<string, number>();
    for (const e of E) { deg.set(e.a, (deg.get(e.a) ?? 0) + 1); deg.set(e.b, (deg.get(e.b) ?? 0) + 1); }
    const dangling = E.findIndex((e) => (!keep(e.a) && deg.get(e.a) === 1) || (!keep(e.b) && deg.get(e.b) === 1));
    if (dangling >= 0) { E.splice(dangling, 1); continue; }
    // parallel: gleiche Knotenpaare
    let done = false;
    for (let i = 0; i < E.length && !done; i++) for (let j = i + 1; j < E.length && !done; j++) {
      const x = E[i]!, y = E[j]!;
      if ((x.a === y.a && x.b === y.b) || (x.a === y.b && x.b === y.a)) {
        const r = par(x.r, y.r), name = `(${x.name} ∥ ${y.name})`;
        steps.push({ kind: "parallel", elementIds: [...x.ids, ...y.ids], label: name, r });
        tr.push(step("EL-E01-P", `Parallelschaltung ${name}`, "R_p = R_1 · R_2 / (R_1 + R_2)", `R_p = ${f6(x.r)} Ω · ${f6(y.r)} Ω / (${f6(x.r)} Ω + ${f6(y.r)} Ω)`, r, "Ω"));
        E.splice(j, 1); E[i] = { a: x.a, b: x.b, r, ids: [...x.ids, ...y.ids], name }; done = true;
      }
    }
    if (done) continue;
    // Reihe: innerer Knoten mit genau zwei Kanten
    for (const [n, d] of deg) {
      if (keep(n) || d !== 2) continue;
      const ks = E.map((e, k) => [e, k] as const).filter(([e]) => e.a === n || e.b === n);
      if (ks.length !== 2) continue;
      const [[x, i], [y, j]] = ks as [readonly [Edge, number], readonly [Edge, number]];
      const xo = x.a === n ? x.b : x.a, yo = y.a === n ? y.b : y.a;
      const r = x.r + y.r, name = `(${x.name} + ${y.name})`;
      steps.push({ kind: "reihe", elementIds: [...x.ids, ...y.ids], label: name, r });
      tr.push(step("EL-E01-S", `Reihenschaltung ${name}`, "R_s = R_1 + R_2", `R_s = ${f6(x.r)} Ω + ${f6(y.r)} Ω`, r, "Ω"));
      E = E.filter((_, k) => k !== i && k !== j); E.push({ a: xo, b: yo, r, ids: [...x.ids, ...y.ids], name }); done = true; break;
    }
    if (done) continue;
    if (!changed) break;
  }
  const reducible = E.length === 1 && keep(E[0]!.a) && keep(E[0]!.b) && E[0]!.a !== E[0]!.b;
  const rRed = reducible ? E[0]!.r : null;
  if (reducible) tr.push(step("EL-E01", "Ersatzwiderstand durch Reihen-/Parallelreduktion", "R_ab = Ergebnis der Reduktion", `R_ab = ${E[0]!.name} = ${f6(rRed!)} Ω`, rRed!, "Ω"));
  const rM = viaMna(all.filter((e) => seen.has(e.a)), a, b);
  if (rM !== null) tr.push(step("EL-E02", "Ersatzwiderstand über Testquelle (Knotenpunktanalyse)", "R_ab = (u_a − u_b) / I_T", `R_ab = (u_a − u_b) / 1 A mit I_T = 1 A von a nach b, Quellen entfernt`, rM, "Ω"));
  if (!reducible) findings.push({ level: "info", text: "Nicht auf Reihen- und Parallelschaltungen zurückführbar (z. B. Brücke): Ergebnis über Testquelle" });
  let ok = rM !== null || rRed !== null;
  if (rRed !== null && rM !== null) {
    const dev = rRed === 0 ? Math.abs(rM) : Math.abs(rRed - rM) / rRed;
    tr.push(step("EL-E03", "Gegenprüfung Reduktion gegen Testquelle", "|R_red − R_MNA| / R_red ≤ 10⁻⁹", `|${f6(rRed)} − ${f6(rM)}| / ${f6(rRed)}`, dev, "1"));
    if (dev > EQ_TOL && !(rRed === 0 && Math.abs(rM) < 1e-9)) { findings.push({ level: "fail", text: `Gegenprüfung Ersatzwiderstand: Abweichung ${fmt(dev)}` }); ok = false; }
  }
  return { ok, r: rRed ?? rM, reducible, rMna: rM, steps, findings, trace: { ersatz: tr } };
}
