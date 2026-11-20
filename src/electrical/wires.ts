/**
 * Leitungsströme (Modul elektrik, EL-N14, ab 0.21.0, E-v11-12): Strom in jedem Draht der Zeichnung für die
 * Stromanimation der App Stromwerk (nur Darstellung).
 *
 * Je Knoten bilden die Anschlüsse (Bauteil, Pin) die Ecken und die Drähte die Kanten eines Graphen. Die Einspeisung an
 * einem Anschluss ist der Klemmenstrom in das Bauteil hinein (s_v). Knotenregel je Ecke: Σ der ankommenden Drahtströme −
 * Σ der abgehenden = s_v, also B · i = s mit der Inzidenzmatrix B (Zeile Ecke, Spalte Draht, +1 am Ziel, −1 am Start).
 * Gelöst mit minimaler Norm: i = Bᵀ · φ mit (B · Bᵀ) · φ = s (Laplace-Matrix, eine Ecke je Teilgraph als Bezug).
 * Für einen Baum ist die Lösung eindeutig; bei Maschen aus Drähten teilen parallele Drähte gleich.
 * Positiv: Strom fließt im Draht vom Anschluss a zum Anschluss b.
 */
import { C0, cx, solveLinear, type Complex } from "./complex";

export interface ElWireEnd { el: string; pin: string }
export interface ElWire { id: string; a: ElWireEnd; b: ElWireEnd }

const key = (x: ElWireEnd): string => `${x.el}\u0000${x.pin}`;

/**
 * Drahtströme in A. pinCurrent(el, pin) liefert den Klemmenstrom in das Bauteil hinein (Knotenpunkte und unbekannte
 * Anschlüsse: 0). Rückgabe auch den größten Rest der Knotenregel je Ecke (Prüfung).
 */
export function wireCurrents(wires: readonly ElWire[], pinCurrent: (el: string, pin: string) => number): { currents: Record<string, number>; residual: number } {
  const ends: string[] = [], idx = new Map<string, number>(), endOf = new Map<string, ElWireEnd>();
  for (const w of wires) for (const e of [w.a, w.b]) { const k = key(e); if (!idx.has(k)) { idx.set(k, ends.length); ends.push(k); endOf.set(k, e); } }
  // Teilgraphen (Union-Find über Drähte)
  const par = ends.map((_, i) => i);
  const find = (x: number): number => { while (par[x] !== x) { par[x] = par[par[x]!]!; x = par[x]!; } return x; };
  for (const w of wires) { const a = find(idx.get(key(w.a))!), b = find(idx.get(key(w.b))!); if (a !== b) par[Math.max(a, b)] = Math.min(a, b); }
  const s = ends.map((k) => { const e = endOf.get(k)!; return pinCurrent(e.el, e.pin); });
  // Laplace-Matrix ohne Bezugsecken (kleinste Ecke je Teilgraph)
  const free = ends.map((_, i) => i).filter((i) => find(i) !== i);
  const pos = new Map(free.map((v, j) => [v, j]));
  const n = free.length;
  const A: Complex[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => C0));
  const z: Complex[] = free.map((v) => cx(s[v]!));
  for (const w of wires) {
    const ia = pos.get(idx.get(key(w.a))!), ib = pos.get(idx.get(key(w.b))!);
    if (ia !== undefined) A[ia]![ia] = cx(A[ia]![ia]!.re + 1);
    if (ib !== undefined) A[ib]![ib] = cx(A[ib]![ib]!.re + 1);
    if (ia !== undefined && ib !== undefined) { A[ia]![ib] = cx(A[ia]![ib]!.re - 1); A[ib]![ia] = cx(A[ib]![ia]!.re - 1); }
  }
  const phi = new Array<number>(ends.length).fill(0);
  if (n) { const x = solveLinear(A, z); if (x) free.forEach((v, j) => { phi[v] = x[j]!.re; }); }
  const currents: Record<string, number> = {};
  // B · Bᵀ · φ = s mit B_vw = +1 am Ziel b, −1 am Start a: i_w = (Bᵀ φ)_w = φ_b − φ_a
  for (const w of wires) currents[w.id] = phi[idx.get(key(w.b))!]! - phi[idx.get(key(w.a))!]!;
  let residual = 0;
  ends.forEach((k, v) => {
    let sum = 0;
    for (const w of wires) { if (key(w.b) === k) sum += currents[w.id]!; if (key(w.a) === k) sum -= currents[w.id]!; }
    residual = Math.max(residual, Math.abs(sum - s[v]!));
  });
  return { currents, residual };
}
