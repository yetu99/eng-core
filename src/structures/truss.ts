/**
 * Ebenes Fachwerk (Modul stabwerke, eng-core 0.23.0), Konzept fachtools/konzept_fw.md Abschn. 1 bis 3.
 *
 * Annahmen (Gross TM 1 Abschn. 6.1): ideale reibungsfreie Gelenke, gerade Stäbe, Lasten nur in Knoten, kleine Verformungen,
 * linear elastisch. Einheiten intern N, mm, MPa; Lasten in der Eingabe in kN, Koordinaten in mm.
 *
 * Gleichgewichtsmatrix A (2k × (s + r)), Zug positiv: Spalte von Stab b (Knoten i → j, e = (x_j − x_i, y_j − y_i)/l) hat
 * +e in den Zeilen von i und −e in den Zeilen von j; Spalte einer Lagerkraft hat ihre Richtung n in den Zeilen ihres Knotens.
 * Knotengleichgewicht A·x = −F mit x = (S₁ … S_s, Lagerkräfte). Rang über Zeilenstufenform: n = s + r − rang (statisch
 * unbestimmt), f = 2k − rang (kinematisch verschieblich). Bestimmt: LU mit Spaltenpivot. Unbestimmt bis n = 3:
 * Kraftgrößenverfahren (pdvk.ts). PdvV (pdvv.ts) und PdvK (pdvk.ts) nutzen dieselbe Matrix.
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace, type TraceGroupOf } from "../trace";
import { luFactor, luSolve, pivotColumns, type LuFactor, type Matrix } from "./linalg";

export type FwGroup = TraceGroupOf<"stabwerke">;
export type FwTrace = Trace<FwGroup>;

export const FW_REF_GROSS1 = "Gross, Hauger, Schröder, Wall: Technische Mechanik 1 (15. Aufl. 2024)";
export const FW_REF_GROSS2 = "Gross, Hauger, Schröder, Wall: Technische Mechanik 2 (15. Aufl. 2024)";
export const FW_REF_DUBBEL = "Dubbel 26 Bd. 1 (2020)";

export interface TrussNodeInput {
  /** Koordinaten [mm] */
  x: number; y: number;
  name?: string;
}
export interface TrussBarInput {
  /** Knotenindizes (0-basiert) */
  i: number; j: number;
  /** Querschnittsfläche [mm²] */
  A: number;
  /** E-Modul [MPa] */
  E: number;
  /** Streckgrenze (Auslegungswert) [MPa], optional für den Stabnachweis */
  Rp?: number | null;
  /** Trägheitsradius i = √(I_min/A) [mm], optional für Knicken */
  iGyr?: number | null;
  name?: string;
}
/** Festlager (zwei Lagerkräfte in x und y) oder Loslager (eine Lagerkraft in Richtung angleDeg, gegen die x-Achse gemessen). */
export type TrussSupportInput = { node: number; type: "fest" } | { node: number; type: "los"; angleDeg: number };
export interface TrussLoadInput {
  node: number;
  /** Kraftkomponenten [kN] */
  Fx: number; Fy: number;
}
/** Bindung: Stab (Index) oder Lagerkraft (Index in der Liste der Lagerkräfte, Festlager zählt x vor y). */
export type TrussBond = { kind: "bar"; index: number } | { kind: "support"; index: number };

export interface TrussInput {
  nodes: TrussNodeInput[];
  bars: TrussBarInput[];
  supports: TrussSupportInput[];
  loads: TrussLoadInput[];
  /** Überzählige für das Kraftgrößenverfahren (n = 1 bis 3); fehlt: Vorschlag des Programms */
  redundants?: TrussBond[] | null;
  /** PdvV: gesuchte Stab- oder Lagerkraft (nur statisch bestimmt) */
  pdvv?: TrussBond | null;
  /** Einflusslinie: Bindung, Knoten der Wanderlast (z. B. Obergurt), Richtung der Last F = 1 (Standard nach unten) */
  influence?: { bond: TrussBond; nodes: number[]; dir?: [number, number] } | null;
  /** Knoten, dessen Verschiebung im Rechenweg mit Einheitslast-Stabkräften gezeigt wird (PdvK) */
  deflection?: { node: number } | null;
  /** erforderliche Sicherheiten (Standard wie Werkbank: S_F 1,5, S_K 3) */
  SFreq?: number; SKreq?: number;
}

export type TrussKind = "bestimmt" | "unbestimmt" | "beweglich" | "ausnahme";

export interface TrussReaction { index: number; support: number; node: number; dir: [number, number]; name: string }

/** Topologie und Matrix (ohne Lasten-Lösung), Grundlage für alle Verfahren. */
export interface TrussModel {
  k: number; s: number; r: number;
  l: number[]; e: Array<[number, number]>;
  /** l/(E·A) je Stab [mm/N] */
  flex: number[];
  reactions: TrussReaction[];
  A: Matrix;
  /** Lastvektor F [N], Länge 2k */
  F: number[];
  rank: number; n: number; f: number; abz: number; kind: TrussKind;
  /** Pivotspalten in Reihenfolge Stäbe, Lagerkräfte */
  pivots: number[];
}

export interface TrussBarResult {
  index: number; name: string; i: number; j: number; l: number; e: [number, number]; A: number; E: number;
  /** Stabkraft [N], Zug positiv */
  S: number;
  zero: boolean;
  /** Nullstabregel nach Gross Abb. 6.6 (1, 2, 3), null = nur aus der Rechnung */
  zeroRule: 1 | 2 | 3 | null;
  /** Längenänderung [mm] */
  dl: number;
}
export interface TrussReactionResult extends TrussReaction { R: number }

export interface TrussSolution {
  S: number[]; R: number[];
  /** Restfehler max|A·x + F| [N] */
  residual: number;
  /** Kraftgrößenverfahren, sonst null */
  forceMethod: ForceMethodResult | null;
  /** Zerlegung des (Grund-)Systems für Einheitslasten */
  basis: { cols: number[]; lu: LuFactor };
}
export interface ForceMethodResult {
  redundants: TrussBond[]; S0: number[]; R0: number[]; Sbar: number[][]; Rbar: number[][]; d10: number[]; d11: number[][]; X: number[];
}

export const bondName = (m: Pick<TrussModel, "reactions">, b: TrussBond, names: string[]): string => b.kind === "bar" ? names[b.index] ?? `Stab ${b.index + 1}` : m.reactions[b.index]?.name ?? `Lager ${b.index + 1}`;
export const bondColumn = (m: Pick<TrussModel, "s">, b: TrussBond): number => b.kind === "bar" ? b.index : m.s + b.index;
export const columnBond = (m: Pick<TrussModel, "s">, c: number): TrussBond => c < m.s ? { kind: "bar", index: c } : { kind: "support", index: c - m.s };

export function nodeName(inp: TrussInput, i: number): string { return inp.nodes[i]?.name ?? `K${i + 1}`; }
export function barName(inp: TrussInput, b: number): string { return inp.bars[b]?.name ?? `S${b + 1}`; }

/** Eingabeprüfung; leere Liste = gültig. */
export function trussInputErrors(inp: TrussInput): string[] {
  const err: string[] = [], k = inp.nodes.length;
  if (k < 2) err.push("Mindestens zwei Knoten erforderlich");
  inp.nodes.forEach((p, i) => { if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) err.push(`Knoten ${nodeName(inp, i)}: Koordinaten ungültig`); });
  for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) if (inp.nodes[a]!.x === inp.nodes[b]!.x && inp.nodes[a]!.y === inp.nodes[b]!.y) err.push(`Knoten ${nodeName(inp, a)} und ${nodeName(inp, b)} liegen aufeinander`);
  if (!inp.bars.length) err.push("Mindestens ein Stab erforderlich");
  const seen = new Set<string>();
  inp.bars.forEach((b, i) => {
    const nm = barName(inp, i);
    if (!(Number.isInteger(b.i) && Number.isInteger(b.j) && b.i >= 0 && b.j >= 0 && b.i < k && b.j < k)) { err.push(`Stab ${nm}: Knoten nicht vorhanden`); return; }
    if (b.i === b.j) err.push(`Stab ${nm}: Anfangs- und Endknoten gleich`);
    const key = b.i < b.j ? `${b.i}-${b.j}` : `${b.j}-${b.i}`;
    if (seen.has(key)) err.push(`Stab ${nm}: doppelt (gleiche Knoten wie ein anderer Stab)`); seen.add(key);
    if (!(b.A > 0)) err.push(`Stab ${nm}: Fläche A muss größer als 0 sein`);
    if (!(b.E > 0)) err.push(`Stab ${nm}: E-Modul muss größer als 0 sein`);
    if (b.Rp != null && !(b.Rp > 0)) err.push(`Stab ${nm}: R_p muss größer als 0 sein`);
    if (b.iGyr != null && !(b.iGyr > 0)) err.push(`Stab ${nm}: Trägheitsradius muss größer als 0 sein`);
  });
  if (!inp.supports.length) err.push("Mindestens ein Lager erforderlich");
  inp.supports.forEach((s, i) => {
    if (!(Number.isInteger(s.node) && s.node >= 0 && s.node < k)) err.push(`Lager ${i + 1}: Knoten nicht vorhanden`);
    if (s.type === "los" && !Number.isFinite(s.angleDeg)) err.push(`Lager ${i + 1}: Richtung ungültig`);
  });
  inp.loads.forEach((l, i) => {
    if (!(Number.isInteger(l.node) && l.node >= 0 && l.node < k)) err.push(`Last ${i + 1}: Knoten nicht vorhanden`);
    if (!Number.isFinite(l.Fx) || !Number.isFinite(l.Fy)) err.push(`Last ${i + 1}: Kraft ungültig`);
  });
  for (const [v, nm] of [[inp.SFreq, "S_F,erf"], [inp.SKreq, "S_K,erf"]] as const) if (v != null && !(v > 0)) err.push(`${nm} muss größer als 0 sein`);
  return err;
}

/** Richtungsvektor einer Loslager-Kraft; Vielfache von 90° exakt. */
export function supportDir(angleDeg: number): [number, number] {
  const a = ((angleDeg % 360) + 360) % 360;
  if (a === 0) return [1, 0]; if (a === 90) return [0, 1]; if (a === 180) return [-1, 0]; if (a === 270) return [0, -1];
  const t = a * Math.PI / 180;
  return [Math.cos(t), Math.sin(t)];
}

/** Topologie, Gleichgewichtsmatrix, Rang und Bestimmtheit (FW-L, FW-E, FW-ABZ, FW-RANG). */
export function trussModel(inp: TrussInput, trace?: FwTrace): TrussModel {
  const add = (g: FwGroup, s: CalcStep) => { if (trace) (trace[g] ??= []).push(s); };
  const k = inp.nodes.length, s = inp.bars.length;
  const l: number[] = [], e: Array<[number, number]> = [], flex: number[] = [];
  inp.bars.forEach((b, i) => {
    const p = inp.nodes[b.i]!, q = inp.nodes[b.j]!, dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
    l.push(L); e.push([dx / L, dy / L]); flex.push(L / (b.E * b.A));
    const nm = barName(inp, i);
    add("geometrie", step("FW-L", "Stablänge", "l = √(Δx² + Δy²)", `${nm}: √(${fmt(dx)}² + ${fmt(dy)}²)`, L, "mm", "Geometrie"));
    add("geometrie", { ...step("FW-E", "Richtungsvektor", "e = (Δx, Δy) / l", `${nm} (${nodeName(inp, b.i)} → ${nodeName(inp, b.j)}): (${fmt(dx)}, ${fmt(dy)}) / ${fmt(L)} = (${fmt(dx / L)}, ${fmt(dy / L)})`, Math.hypot(dx / L, dy / L), "1", "Geometrie; Wert: Betrag |e| = 1 (Kontrolle)"), matrix: [[dx / L, dy / L]] });
  });
  const reactions: TrussReaction[] = [];
  inp.supports.forEach((sp, si) => {
    const nn = nodeName(inp, sp.node);
    if (sp.type === "fest") {
      reactions.push({ index: reactions.length, support: si, node: sp.node, dir: [1, 0], name: `${nn},x` });
      reactions.push({ index: reactions.length, support: si, node: sp.node, dir: [0, 1], name: `${nn},y` });
    } else reactions.push({ index: reactions.length, support: si, node: sp.node, dir: supportDir(sp.angleDeg), name: `${nn},${fmt(sp.angleDeg)}°` });
  });
  const r = reactions.length, u = s + r;
  const A: Matrix = Array.from({ length: 2 * k }, () => new Array<number>(u).fill(0));
  inp.bars.forEach((b, c) => {
    const [ex, ey] = e[c]!;
    A[2 * b.i]![c] = ex; A[2 * b.i + 1]![c] = ey; A[2 * b.j]![c] = -ex; A[2 * b.j + 1]![c] = -ey;
  });
  reactions.forEach((re, j) => { A[2 * re.node]![s + j] = re.dir[0]; A[2 * re.node + 1]![s + j] = re.dir[1]; });
  const F = new Array<number>(2 * k).fill(0);
  for (const ld of inp.loads) { F[2 * ld.node] = F[2 * ld.node]! + ld.Fx * 1000; F[2 * ld.node + 1] = F[2 * ld.node + 1]! + ld.Fy * 1000; }
  const pivots = pivotColumns(A, u);
  const rank = pivots.length, n = u - rank, f = 2 * k - rank, abz = 2 * k - u;
  const kind: TrussKind = f > 0 ? (abz === 0 ? "ausnahme" : "beweglich") : n > 0 ? "unbestimmt" : "bestimmt";
  const abzTxt = abz === 0 ? "notwendige Bedingung erfüllt" : abz > 0 ? "zu wenig Bindungen: beweglich" : `${-abz} Bindung(en) zu viel: mindestens ${-abz}-fach unbestimmt`;
  add("geometrie", step("FW-ABZ", "Abzählkriterium", "2k − (s + r)", `2·${k} − (${s} + ${r}) = ${abz}: ${abzTxt}`, abz, "1", `${FW_REF_GROSS1} Gl. (6.1)`));
  const kindTxt = { bestimmt: "statisch und kinematisch bestimmt", unbestimmt: `${n}-fach statisch unbestimmt`, beweglich: `kinematisch verschieblich (${f} Freiheitsgrad(e))`, ausnahme: `Ausnahmefachwerk: Abzählkriterium erfüllt, aber verschieblich (${f} Freiheitsgrad(e))` }[kind];
  add("geometrie", step("FW-RANG", "Rang der Gleichgewichtsmatrix", "n = s + r − rang A,  f = 2k − rang A", `rang A = ${rank}: n = ${u} − ${rank} = ${n}, f = ${2 * k} − ${rank} = ${f}; ${kindTxt}`, rank, "1", `${FW_REF_GROSS1} Abschn. 6.1, 6.2; ${FW_REF_DUBBEL} Abschn. 12.8.1`));
  return { k, s, r, l, e, flex, reactions, A, F, rank, n, f, abz, kind, pivots };
}

/** Spalten des Systems ohne die gegebenen Spalten (quadratisch 2k × 2k bei gültiger Wahl). */
export function subMatrix(A: Matrix, cols: number[]): Matrix { return A.map((row) => cols.map((c) => row[c]!)); }

/** Löst das statisch bestimmte System bzw. das Grundsystem mit rechter Seite b: Unbekannte in Reihenfolge Stäbe, Lager. */
export function solveBasis(m: TrussModel, basis: { cols: number[]; lu: LuFactor }, rhs: readonly number[]): number[] {
  const y = luSolve(basis.lu, rhs), x = new Array<number>(m.s + m.r).fill(0);
  basis.cols.forEach((c, i) => { x[c] = y[i]!; });
  return x;
}

/** Restfehler max|A·x + F|. */
export function equilibriumResidual(m: TrussModel, x: readonly number[]): number {
  let res = 0;
  m.A.forEach((row, i) => { let s = m.F[i]!; row.forEach((a, c) => { s += a * x[c]!; }); res = Math.max(res, Math.abs(s)); });
  return res;
}

/** Statisch bestimmtes System lösen (FW-GG); null, wenn nicht bestimmt. */
export function solveDeterminate(m: TrussModel): TrussSolution | null {
  if (m.kind !== "bestimmt") return null;
  const cols = Array.from({ length: m.s + m.r }, (_, i) => i);
  const lu = luFactor(m.A);
  if (!lu) return null;
  const basis = { cols, lu };
  const x = solveBasis(m, basis, m.F.map((v) => -v));
  return { S: x.slice(0, m.s), R: x.slice(m.s), residual: equilibriumResidual(m, x), forceMethod: null, basis };
}

/** Nullstabregeln nach Gross TM 1 Abb. 6.6 (ein Durchgang über alle Knoten). Lagerkräfte zählen als äußere Kräfte. */
export function zeroBarRules(inp: TrussInput, m: TrussModel): Array<1 | 2 | 3 | null> {
  const out: Array<1 | 2 | 3 | null> = new Array(m.s).fill(null);
  const par = (a: [number, number], b: [number, number]) => Math.abs(a[0] * b[1] - a[1] * b[0]) <= 1e-12;
  for (let node = 0; node < m.k; node++) {
    const bars = inp.bars.map((b, i) => ({ b, i })).filter((x) => x.b.i === node || x.b.j === node).map((x) => x.i);
    const ext: Array<[number, number]> = [];
    for (const ld of inp.loads) if (ld.node === node && (ld.Fx !== 0 || ld.Fy !== 0)) ext.push([ld.Fx, ld.Fy]);
    let fixed = false;
    for (const sp of inp.supports) if (sp.node === node) { if (sp.type === "fest") fixed = true; else ext.push(supportDir(sp.angleDeg)); }
    if (fixed) continue;
    const ed = bars.map((i) => m.e[i]!);
    if (bars.length === 2 && !par(ed[0]!, ed[1]!)) {
      if (!ext.length) { out[bars[0]!] ??= 1; out[bars[1]!] ??= 1; }
      else for (const [a, b] of [[0, 1], [1, 0]] as const) if (ext.every((v) => par(v, ed[a]!))) out[bars[b]!] ??= 2;
    }
    if (bars.length === 3 && !ext.length) {
      for (const [a, b, c] of [[0, 1, 2], [0, 2, 1], [1, 2, 0]] as const) if (par(ed[a]!, ed[b]!) && !par(ed[a]!, ed[c]!)) out[bars[c]!] ??= 3;
    }
  }
  return out;
}

/** Schwelle Nullstab: |S| ≤ 10⁻⁹·max|F| (FW-NULL). */
export function zeroThreshold(m: TrussModel): number {
  let mx = 0;
  for (let i = 0; i < m.k; i++) mx = Math.max(mx, Math.hypot(m.F[2 * i]!, m.F[2 * i + 1]!));
  return 1e-9 * mx;
}

/** Stabergebnisse, Lagerkräfte, Gesamtprobe und Nullstäbe in den Rechenweg (FW-GG bzw. FW-SUP, FW-LAG, FW-PRB, FW-NULL, FW-DL). */
export function trussResults(inp: TrussInput, m: TrussModel, sol: TrussSolution, add: (g: FwGroup, s: CalcStep) => void): { bars: TrussBarResult[]; reactions: TrussReactionResult[]; probe: { Fx: number; Fy: number; M: number; ref: string; max: number } } {
  const thr = zeroThreshold(m), rules = zeroBarRules(inp, m);
  const fm = sol.forceMethod;
  const bars: TrussBarResult[] = inp.bars.map((b, i) => {
    const S = sol.S[i]!, zero = Math.abs(S) <= thr, nm = barName(inp, i);
    if (fm) {
      const terms = fm.X.map((X, r) => `${fmt(X)}·${fmt(fm.Sbar[r]![i]!)}`).join(" + ");
      add("stabkraefte", step("FW-SUP", "Stabkraft (Überlagerung)", "S = S₀ + Σ X_i·S̄_i", `${nm}: ${fmt(fm.S0[i]!)} + ${terms}`, S, "N", `${FW_REF_GROSS2} Abschn. 6.5, Bsp. 6.9; ${FW_REF_DUBBEL} Abschn. 20.7`));
    } else add("stabkraefte", step("FW-GG", "Stabkraft", "A·x = −F (Knotengleichgewicht, Gauß mit Spaltenpivot), Zug positiv", `${nm}: x_${i + 1} aus dem ${2 * m.k}×${m.s + m.r}-System, Restfehler ${fmt(sol.residual, 3)} N`, S, "N", `${FW_REF_GROSS1} Abschn. 6.3.1`));
    if (zero) {
      const rt = rules[i] ? `Regel ${rules[i]} (Gross Abb. 6.6)` : "aus der Rechnung (keine der drei Regeln direkt anwendbar)";
      add("stabkraefte", step("FW-NULL", "Nullstab", "|S| ≤ 10⁻⁹·max|F|", `${nm}: |${fmt(S)}| ≤ ${fmt(thr)}: ${rt}`, Math.abs(S), "N", `${FW_REF_GROSS1} Abschn. 6.3.1, Abb. 6.6`));
    }
    const dl = S * m.flex[i]!;
    add("verschiebung", step("FW-DL", "Längenänderung", "Δl = S·l / (E·A)", `${nm}: ${fmt(S)}·${fmt(m.l[i]!)} / (${fmt(b.E)}·${fmt(b.A)})`, dl, "mm", `${FW_REF_GROSS2} Gl. (1.17); ${FW_REF_DUBBEL} Abschn. 20.1`));
    return { index: i, name: nm, i: b.i, j: b.j, l: m.l[i]!, e: m.e[i]!, A: b.A, E: b.E, S, zero, zeroRule: zero ? rules[i]! : null, dl };
  });
  const reactions: TrussReactionResult[] = m.reactions.map((re, j) => {
    const R = sol.R[j]!;
    add("gleichgewicht", step("FW-LAG", "Lagerkraft", "R = x_(s+j) (Lagerkraft in Lagerrichtung n)", `${re.name}: n = (${fmt(re.dir[0])}, ${fmt(re.dir[1])}): R = ${fmt(R)}`, R, "N", `${FW_REF_GROSS1} Kap. 5, Abschn. 6.3.1`));
    return { ...re, R };
  });
  // Gesamtprobe am ganzen Fachwerk: Lasten und Lagerkräfte, Moment um den ersten Lagerknoten
  const o = inp.nodes[m.reactions[0]?.node ?? 0]!;
  let Fx = 0, Fy = 0, M = 0;
  const force = (node: number, fx: number, fy: number) => { const p = inp.nodes[node]!; Fx += fx; Fy += fy; M += (p.x - o.x) * fy - (p.y - o.y) * fx; };
  for (const ld of inp.loads) force(ld.node, ld.Fx * 1000, ld.Fy * 1000);
  for (const re of reactions) force(re.node, re.R * re.dir[0], re.R * re.dir[1]);
  const ref = nodeName(inp, m.reactions[0]?.node ?? 0);
  const Lmax = Math.max(...inp.nodes.map((p) => Math.hypot(p.x - o.x, p.y - o.y)));
  const max = Math.max(Math.abs(Fx), Math.abs(Fy), Math.abs(M) / Lmax);
  add("gleichgewicht", step("FW-PRB", "Gesamtprobe", "ΣF_x = 0, ΣF_y = 0, ΣM = 0; Restwert max(|ΣF_x|, |ΣF_y|, |ΣM|/L_max)", `ΣF_x = ${fmt(Fx, 3)} N, ΣF_y = ${fmt(Fy, 3)} N, ΣM_${ref} = ${fmt(M, 3)} N·mm, L_max = ${fmt(Lmax)} mm`, max, "N", `${FW_REF_GROSS1} Abschn. 6.3.1 (Probe); L_max größter Knotenabstand vom Bezugspunkt`));
  return { bars, reactions, probe: { Fx, Fy, M, ref, max } };
}
