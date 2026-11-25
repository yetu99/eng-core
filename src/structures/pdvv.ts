/**
 * Prinzip der virtuellen Verschiebungen am starren Fachwerk (Modul stabwerke, eng-core 0.23.0), Konzept Abschn. 1:
 * Bindung i (Stab oder Lagerkraft) gibt um 1 in Richtung ihrer positiven Kraft nach (Stab: Verkürzung um 1, Zugkraft
 * zieht die Knoten zusammen; Lager: Knoten um 1 in Lagerrichtung), alle anderen Stäbe bleiben starr und Lager fest.
 * Verträglichkeit Aᵀ·δu = e_i (FW-VV), Arbeitssatz δW = Σ F_j·δu_j + X_i·1 = 0 liefert X_i = −Σ F_j·δu_j (FW-VS).
 * Dieselbe Matrix wie das Gleichgewicht, transponiert (Dualität). Einflusslinie η = −d·δu (FW-EL): Wanderlast F = 1 in
 * Richtung d am Knoten. Nur statisch und kinematisch bestimmte Fachwerke. Gross TM 1 Abschn. 8.2, 8.4, Bsp. 8.6;
 * Dubbel Abschn. 12.4.3, 12.8.1, Abb. 12.25e.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { luFactor, luSolveT } from "./linalg";
import { barName, bondColumn, bondName, FW_REF_DUBBEL, FW_REF_GROSS1, nodeName, type FwGroup, type TrussBond, type TrussInput, type TrussModel } from "./truss";

export interface VirtualWorkTerm { node: number; Fx: number; Fy: number; dux: number; duy: number; W: number }
export interface PdvvResult {
  bond: TrussBond; name: string;
  /** virtuelle Verschiebungsfigur je Knoten [mm je mm Nachgeben] */
  du: Array<{ ux: number; uy: number }>;
  /** Restfehler der Verträglichkeit max|Aᵀ·δu − e_i| */
  compatResidual: number;
  /** Beiträge der Lasten −F_j·δu_j [N] */
  terms: VirtualWorkTerm[];
  /** gesuchte Kraft aus dem Arbeitssatz [N] */
  value: number;
}
export interface InfluenceResult { bond: TrussBond; name: string; dir: [number, number]; points: Array<{ node: number; x: number; y: number; eta: number }>; etaMin: number; etaMax: number }

function compatibility(m: TrussModel, bond: TrussBond): { du: number[]; res: number } | string {
  if (m.kind !== "bestimmt") return "PdvV nur für statisch und kinematisch bestimmte Fachwerke";
  const c = bondColumn(m, bond);
  if (!(Number.isInteger(c) && c >= 0 && c < m.s + m.r)) return "PdvV: Stab oder Lagerkraft nicht vorhanden";
  const lu = luFactor(m.A);
  if (!lu) return "PdvV: Gleichgewichtsmatrix singulär";
  const ei = new Array<number>(m.s + m.r).fill(0); ei[c] = 1;
  const du = luSolveT(lu, ei);
  let res = 0;
  for (let col = 0; col < m.s + m.r; col++) { let s = -ei[col]!; for (let row = 0; row < 2 * m.k; row++) s += m.A[row]![col]! * du[row]!; res = Math.max(res, Math.abs(s)); }
  return { du, res };
}

/** Kraft einer Bindung über PdvV (FW-VV, FW-VS); Fehlertext, wenn nicht anwendbar. */
export function trussPdvv(inp: TrussInput, m: TrussModel, bond: TrussBond, add: (g: FwGroup, s: CalcStep) => void, compare?: number): PdvvResult | string {
  const cp = compatibility(m, bond);
  if (typeof cp === "string") return cp;
  const names = inp.bars.map((_, i) => barName(inp, i)), name = bondName(m, bond, names);
  const du = Array.from({ length: m.k }, (_, i) => ({ ux: cp.du[2 * i]!, uy: cp.du[2 * i + 1]! }));
  const terms: VirtualWorkTerm[] = [];
  for (let i = 0; i < m.k; i++) {
    const Fx = m.F[2 * i]!, Fy = m.F[2 * i + 1]!;
    if (Fx === 0 && Fy === 0) continue;
    terms.push({ node: i, Fx, Fy, dux: du[i]!.ux, duy: du[i]!.uy, W: -(Fx * du[i]!.ux + Fy * du[i]!.uy) });
  }
  const value = terms.reduce((a, t) => a + t.W, 0);
  const what = bond.kind === "bar" ? `Stab ${name} um 1 verkürzt` : `Lager ${name} um 1 in Lagerrichtung verschoben`;
  const mx = cp.du.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  add("stabkraefte", step("FW-VV", "Virtuelle Verschiebungsfigur", "Aᵀ·δu = e_i (Bindung i gibt um 1 nach, alle anderen starr)", `${what}, übrige Stäbe starr, Lager fest; max|δu| = ${fmt(mx)}, Restfehler ${fmt(cp.res, 2)}`, mx, "1", `${FW_REF_GROSS1} Abschn. 8.4, Bsp. 8.6`));
  const tt = terms.map((t) => `${fmt(t.Fx)}·${fmt(t.dux)} + ${fmt(t.Fy)}·${fmt(t.duy)}`);
  const cmp = compare !== undefined ? `; Gleichungssystem ${fmt(compare)} N, Abweichung ${fmt(value - compare, 2)} N` : "";
  add("stabkraefte", step("FW-VS", "Bindungskraft aus dem Arbeitssatz (PdvV)", "X_i = −Σ F_j·δu_j (δW = 0)", `${name}: −(${tt.length ? tt.join(" + ") : "0"})${cmp}`, value, "N", `${FW_REF_GROSS1} Abschn. 8.2, 8.4`));
  return { bond, name, du, compatResidual: cp.res, terms, value };
}

/** Einflusslinie einer Stab- oder Lagerkraft für die Wanderlast F = 1 in Richtung dir an den gegebenen Knoten (FW-EL). */
export function trussInfluence(inp: TrussInput, m: TrussModel, bond: TrussBond, nodes: readonly number[], dir: [number, number], add: (g: FwGroup, s: CalcStep) => void): InfluenceResult | string {
  if (nodes.some((n) => !(Number.isInteger(n) && n >= 0 && n < m.k))) return "Einflusslinie: Knoten nicht vorhanden";
  const dn = Math.hypot(dir[0], dir[1]);
  if (!(dn > 0)) return "Einflusslinie: Richtung der Wanderlast ungültig";
  const d: [number, number] = [dir[0] / dn, dir[1] / dn];
  const cp = compatibility(m, bond);
  if (typeof cp === "string") return cp;
  const name = bondName(m, bond, inp.bars.map((_, i) => barName(inp, i)));
  const points = [...nodes].sort((a, b) => inp.nodes[a]!.x - inp.nodes[b]!.x || a - b).map((node) => {
    const eta = -(d[0] * cp.du[2 * node]! + d[1] * cp.du[2 * node + 1]!);
    add("stabkraefte", step("FW-EL", "Einflusswert", "η = −d·δu (Wanderlast F = 1 in Richtung d)", `${name}, Last in ${nodeName(inp, node)}: d = (${fmt(d[0])}, ${fmt(d[1])}), δu = (${fmt(cp.du[2 * node]!)}, ${fmt(cp.du[2 * node + 1]!)})`, eta, "1", `${FW_REF_DUBBEL} Abschn. 12.8.1, Abb. 12.25e; ${FW_REF_GROSS1} Abschn. 8.4`));
    return { node, x: inp.nodes[node]!.x, y: inp.nodes[node]!.y, eta };
  });
  const etas = points.map((p) => p.eta);
  return { bond, name, dir: d, points, etaMin: Math.min(...etas), etaMax: Math.max(...etas) };
}

/** Knoten eines Gurts: alle Knoten mit größtem (ober) bzw. kleinstem (unter) y, nach x sortiert. */
export function trussChordNodes(inp: TrussInput, which: "ober" | "unter"): number[] {
  const ys = inp.nodes.map((p) => p.y), yy = which === "ober" ? Math.max(...ys) : Math.min(...ys);
  return inp.nodes.map((p, i) => ({ p, i })).filter((x) => x.p.y === yy).sort((a, b) => a.p.x - b.p.x).map((x) => x.i);
}
