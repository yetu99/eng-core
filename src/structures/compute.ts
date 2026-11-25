/**
 * Fachwerk berechnen (Modul stabwerke, eng-core 0.23.0): Topologie und Bestimmtheit, Stab- und Lagerkräfte (bestimmt:
 * Knotengleichgewicht; unbestimmt bis n = 3: Kraftgrößenverfahren), Gesamtprobe, Nullstäbe, Längenänderungen,
 * Knotenverschiebungen (PdvK), Stabnachweis, optional PdvV für eine Bindung und Einflusslinie. Alle Zahlen der Oberfläche
 * kommen aus computeTruss (AGENTS.md: keine Formeln in der App).
 */
import { fmt } from "../format";
import type { CalcStep } from "../trace";
import { trussBarCheck, type TrussBarCheck } from "./check";
import { FW_MAX_N, proposeRedundants, solveForceMethod, trussDeflection, trussDisplacements, type DeflectionResult } from "./pdvk";
import { trussInfluence, trussPdvv, type InfluenceResult, type PdvvResult } from "./pdvv";
import { pivotRatio } from "./linalg";
import { barName, bondColumn, solveDeterminate, trussInputErrors, trussModel, trussResults, type ForceMethodResult, type FwGroup, type FwTrace, type TrussBarResult, type TrussBond, type TrussInput, type TrussKind, type TrussModel, type TrussReactionResult } from "./truss";

export type TrussBarOut = TrussBarResult & { check: TrussBarCheck };

export interface TrussResult {
  errors: string[]; warnings: string[];
  model: TrussModel | null;
  kind: TrussKind | null;
  bars: TrussBarOut[];
  reactions: TrussReactionResult[];
  probe: { Fx: number; Fy: number; M: number; ref: string; max: number } | null;
  /** Restfehler des Gleichgewichts max|A·x + F| [N] */
  residual: number | null;
  /** Knotenverschiebungen [mm] (PdvK, alle Knoten) */
  displacements: Array<{ ux: number; uy: number }> | null;
  redundants: TrussBond[] | null;
  forceMethod: ForceMethodResult | null;
  pdvv: PdvvResult | null;
  influence: InfluenceResult | null;
  deflection: DeflectionResult | null;
  /** maßgebender Stab (größte Ausnutzung), Ausnutzung */
  governing: number | null; util: number | null;
  trace: FwTrace;
}

/** Hinweise zur Gültigkeit (Konzept Abschn. 2, ausgeschlossen). */
export const FW_LIMITS: readonly string[] = [
  "ebenes Fachwerk, ideale reibungsfreie Gelenke, Lasten nur in Knoten (Eigengewicht nur als Knotenlast)",
  "linear elastisch, kleine Verformungen (Theorie 1. Ordnung)",
  "Knicken nur in der Fachwerkebene (Eulerfall 2, L_k = l); Knicken aus der Ebene nicht erfasst",
  "keine Stahlbau-Nachweise nach EN 1993, keine Biegesteifigkeit der Knoten",
];

/** Schwelle für den Hinweis auf schlechte Kondition (Pivotverhältnis der LU-Zerlegung). */
export const FW_COND_WARN = 1e-8;
/** Schwelle für den Hinweis auf nahezu verschiebliche Geometrie: max|S| > 100·max|F|. */
export const FW_AMP_WARN = 100;

export function computeTruss(inp: TrussInput): TrussResult {
  const trace: FwTrace = {};
  const add = (g: FwGroup, s: CalcStep) => { (trace[g] ??= []).push(s); };
  const res: TrussResult = { errors: trussInputErrors(inp), warnings: [], model: null, kind: null, bars: [], reactions: [], probe: null, residual: null, displacements: null, redundants: null, forceMethod: null, pdvv: null, influence: null, deflection: null, governing: null, util: null, trace };
  if (res.errors.length) return res;
  const m = trussModel(inp, trace);
  res.model = m; res.kind = m.kind;
  if (m.kind === "beweglich" || m.kind === "ausnahme") {
    res.errors.push(m.kind === "ausnahme" ? `Ausnahmefachwerk: 2k = s + r ist erfüllt, aber rang A = ${m.rank} < 2k = ${2 * m.k}; das Fachwerk ist verschieblich` : `Kinematisch verschieblich: ${m.f} Freiheitsgrad(e) (rang A = ${m.rank} < 2k = ${2 * m.k}); Stäbe oder Lager ergänzen`);
    return res;
  }
  if (m.n > FW_MAX_N) { res.errors.push(`${m.n}-fach statisch unbestimmt: Kraftgrößenverfahren nur bis n = ${FW_MAX_N} (FW-E2)`); return res; }
  let sol;
  if (m.kind === "bestimmt") sol = solveDeterminate(m);
  else {
    const red = inp.redundants && inp.redundants.length ? inp.redundants : proposeRedundants(m);
    res.redundants = [...red];
    const fm = solveForceMethod(inp, m, red, add);
    if (typeof fm === "string") { res.errors.push(fm); return res; }
    sol = fm;
  }
  if (!sol) { res.errors.push("Gleichgewichtsmatrix singulär"); return res; }
  res.forceMethod = sol.forceMethod; res.residual = sol.residual;
  // Prüfbefund 25.11.2026: nahezu verschiebliche Fachwerke (Ausnahmefachwerk im Kleinen, fast gerade Stabzüge) sind numerisch bestimmt, liefern aber sehr große Stabkräfte
  const pr = pivotRatio(sol.basis.lu);
  if (pr < FW_COND_WARN) res.warnings.push(`Gleichgewichtsmatrix schlecht konditioniert (kleinster/größter Pivot ${fmt(pr, 2)} < ${fmt(FW_COND_WARN)}): Ergebnis numerisch unzuverlässig; Geometrie prüfen`);
  const Fmax = Math.max(...Array.from({ length: m.k }, (_, i) => Math.hypot(m.F[2 * i]!, m.F[2 * i + 1]!)));
  const Smax = Math.max(...sol.S.map(Math.abs));
  if (Fmax > 0 && Smax > FW_AMP_WARN * Fmax) res.warnings.push(`Stabkräfte bis ${fmt(Smax / Fmax, 3)}-fach der größten Knotenlast: Fachwerk nahezu verschieblich (fast gerade Stabzüge, Gross Abb. 6.2c); Theorie 1. Ordnung und kleine Verformungen fraglich`);
  const { bars, reactions, probe } = trussResults(inp, m, sol, add);
  res.reactions = reactions; res.probe = probe;
  const SFreq = inp.SFreq ?? 1.5, SKreq = inp.SKreq ?? 3;
  res.bars = bars.map((b) => ({ ...b, check: trussBarCheck(inp.bars[b.index]!, b.name, b.S, b.l, SFreq, SKreq, b.zero) }));
  let gov: number | null = null, gu = -Infinity;
  res.bars.forEach((b) => { if (b.check.util !== null && b.check.util > gu) { gu = b.check.util; gov = b.index; } });
  res.governing = gov; res.util = gov === null ? null : gu;
  for (const b of res.bars) b.check.steps.filter((s) => s.id === "FW-SIG" || s.id === "FW-SF").forEach((s) => add("nachweis", s));
  // Knicken: Rechenweg für den Druckstab mit der kleinsten Knicksicherheit
  const buckling = res.bars.filter((b) => b.check.SK !== null).sort((a, b) => a.check.SK! - b.check.SK! || a.index - b.index)[0];
  if (buckling) buckling.check.steps.filter((s) => s.id.startsWith("K-") || s.id === "N-SK").forEach((s) => add("nachweis", { ...s, title: `${s.title} (${buckling.name}, kleinste Knicksicherheit)` }));
  const miss = new Set(res.bars.flatMap((b) => b.check.notes.filter((n) => n !== "Nullstab")));
  miss.forEach((n) => res.warnings.push(`Stabnachweis: ${n}`));
  if (!inp.loads.some((l) => l.Fx !== 0 || l.Fy !== 0)) res.warnings.push("Keine Last: alle Stab- und Lagerkräfte sind null");
  res.displacements = trussDisplacements(m, sol);
  if (inp.deflection) {
    const nd = inp.deflection.node;
    if (Number.isInteger(nd) && nd >= 0 && nd < m.k) res.deflection = trussDeflection(inp, m, sol, nd, add);
    else res.errors.push("Verschiebung: Knoten nicht vorhanden");
  }
  if (inp.pdvv) {
    const c = bondColumn(m, inp.pdvv);
    const ref = c >= 0 && c < m.s ? sol.S[c] : sol.R[c - m.s];
    const p = trussPdvv(inp, m, inp.pdvv, add, ref);
    if (typeof p === "string") res.warnings.push(p); else res.pdvv = p;
  }
  if (inp.influence) {
    const p = trussInfluence(inp, m, inp.influence.bond, inp.influence.nodes, inp.influence.dir ?? [0, -1], add);
    if (typeof p === "string") res.warnings.push(p); else res.influence = p;
  }
  if (res.pdvv && Math.abs(res.pdvv.value - (inp.pdvv!.kind === "bar" ? sol.S[inp.pdvv!.index]! : sol.R[inp.pdvv!.index]!)) > 1e-6 * Math.max(1, ...m.F.map(Math.abs))) res.warnings.push(`PdvV weicht vom Gleichungssystem ab (${fmt(res.pdvv.value)} N)`);
  return res;
}

/** Kurztext der Bestimmtheit für Kopfzeile und PDF. */
export function trussKindText(r: Pick<TrussResult, "model">): string {
  const m = r.model;
  if (!m) return "–";
  return { bestimmt: "statisch bestimmt", unbestimmt: `${m.n}-fach statisch unbestimmt`, beweglich: `verschieblich (f = ${m.f})`, ausnahme: "Ausnahmefachwerk (verschieblich)" }[m.kind];
}

export { barName };
