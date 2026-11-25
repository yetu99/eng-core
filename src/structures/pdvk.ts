/**
 * Prinzip der virtuellen Kräfte (Arbeitssatz mit Einheitslast) für Fachwerke (Modul stabwerke, eng-core 0.23.0):
 * Knotenverschiebung δ = Σ S·S̄·l/(E·A) (FW-VK) und Kraftgrößenverfahren für statisch unbestimmte Fachwerke bis n = 3
 * (FW-D10, FW-D11, FW-X; Überlagerung FW-SUP in truss.ts). Erstquelle Gross TM 2 Abschn. 6.3 bis 6.5, Zweitquelle Dubbel
 * Abschn. 20.4.9, 20.7. Einheitslast-Stabkräfte S̄ im statisch bestimmten System bzw. im Grundsystem (Reduktionssatz).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { luFactor, pivotColumns, solveSmall, type Matrix } from "./linalg";
import { barName, bondColumn, bondName, columnBond, equilibriumResidual, FW_REF_DUBBEL, FW_REF_GROSS2, nodeName, solveBasis, subMatrix, type FwGroup, type TrussBond, type TrussInput, type TrussModel, type TrussSolution } from "./truss";

/** Größter zulässiger Grad der statischen Unbestimmtheit (FW-E2). */
export const FW_MAX_N = 3;

/** Vorschlag Überzählige: Spalten, die nicht Pivotspalte sind (Reihenfolge Stäbe, dann Lager; die zuletzt abhängigen). */
export function proposeRedundants(m: TrussModel): TrussBond[] {
  const piv = new Set(m.pivots);
  const out: TrussBond[] = [];
  for (let c = 0; c < m.s + m.r; c++) if (!piv.has(c)) out.push(columnBond(m, c));
  return out;
}

/** Prüft die Wahl der Überzähligen; Text des Fehlers oder null. */
export function redundantsError(m: TrussModel, red: readonly TrussBond[]): string | null {
  if (red.length !== m.n) return `Es sind genau ${m.n} Überzählige zu wählen (gewählt ${red.length})`;
  const cols = red.map((b) => bondColumn(m, b));
  if (cols.some((c) => !(Number.isInteger(c) && c >= 0 && c < m.s + m.r))) return "Überzählige: Stab oder Lagerkraft nicht vorhanden";
  if (new Set(cols).size !== cols.length) return "Überzählige doppelt gewählt";
  const keep = Array.from({ length: m.s + m.r }, (_, i) => i).filter((c) => !cols.includes(c));
  if (pivotColumns(subMatrix(m.A, keep), keep.length).length !== 2 * m.k) return "Grundsystem ohne die gewählten Überzähligen ist verschieblich; andere Stäbe oder Lager wählen";
  return null;
}

/** Kraftgrößenverfahren (FW-D10, FW-D11, FW-X). Voraussetzung: m.kind = "unbestimmt", 1 ≤ n ≤ 3, gültige Überzählige. */
export function solveForceMethod(inp: TrussInput, m: TrussModel, red: readonly TrussBond[], add: (g: FwGroup, s: CalcStep) => void): TrussSolution | string {
  const err = redundantsError(m, red);
  if (err) return err;
  const rc = red.map((b) => bondColumn(m, b));
  const cols = Array.from({ length: m.s + m.r }, (_, i) => i).filter((c) => !rc.includes(c));
  const lu = luFactor(subMatrix(m.A, cols));
  if (!lu) return "Grundsystem singulär";
  const basis = { cols, lu };
  const x0 = solveBasis(m, basis, m.F.map((v) => -v));
  const xb = rc.map((c) => { const x = solveBasis(m, basis, m.A.map((row) => -row[c]!)); x[c] = 1; return x; });
  const names = inp.bars.map((_, i) => barName(inp, i));
  const nr = red.length;
  const d10 = xb.map((xi) => xi.slice(0, m.s).reduce((a, sb, b) => a + x0[b]! * sb * m.flex[b]!, 0));
  const d11: Matrix = xb.map((xi) => xb.map((xj) => xi.slice(0, m.s).reduce((a, sb, b) => a + sb * xj[b]! * m.flex[b]!, 0)));
  const rn = red.map((b) => bondName(m, b, names));
  const sumTxt = (fa: (b: number) => number, fb: (b: number) => number) => {
    const t = inp.bars.map((_, b) => ({ b, v: fa(b) * fb(b) })).filter((x) => x.v !== 0).map(({ b }) => `${fmt(fa(b))}·${fmt(fb(b))}·${fmt(m.flex[b]!)}`);
    return t.length ? t.join(" + ") : "0";
  };
  for (let i = 0; i < nr; i++) add("gleichgewicht", step("FW-D10", "Verschiebungszahl δ_i0", "δ_i0 = Σ S₀·S̄_i·l / (E·A)", `δ${i + 1}0 (Überzählige ${rn[i]}): ` + sumTxt((b) => x0[b]!, (b) => xb[i]![b]!), d10[i]!, "mm", `${FW_REF_GROSS2} Abschn. 6.5, Gl. (6.46); ${FW_REF_DUBBEL} Abschn. 20.7`));
  for (let i = 0; i < nr; i++) for (let j = i; j < nr; j++) add("gleichgewicht", step("FW-D11", "Verschiebungszahl δ_ij", "δ_ij = Σ S̄_i·S̄_j·l / (E·A)", `δ${i + 1}${j + 1}: ` + sumTxt((b) => xb[i]![b]!, (b) => xb[j]![b]!), d11[i]![j]!, "mm/N", `${FW_REF_GROSS2} Abschn. 6.4, 6.5; ${FW_REF_DUBBEL} Abschn. 20.7`));
  const X = solveSmall(d11, d10.map((v) => -v));
  if (!X) return "Verschiebungszahlen singulär: Überzählige ohne Nachgiebigkeit (z. B. nur Lager gewählt, die nicht in Stäben wirken)";
  X.forEach((Xi, i) => add("gleichgewicht", step("FW-X", "Überzählige", "δ_i0 + Σ δ_ij·X_j = 0", `X${i + 1} = ${rn[i]}: ` + (nr === 1 ? `X = −δ10/δ11 = −(${fmt(d10[0]!)}) / ${fmt(d11[0]![0]!)}` : `${nr}×${nr}-System δ·X = −δ₀ (Gauß)`), Xi, "N", `${FW_REF_GROSS2} Abschn. 6.5; ${FW_REF_DUBBEL} Abschn. 20.7, Abb. 20.41`)));
  const x = x0.map((v, c) => v + X.reduce((a, Xi, i) => a + Xi * xb[i]![c]!, 0));
  return {
    S: x.slice(0, m.s), R: x.slice(m.s), residual: equilibriumResidual(m, x), basis,
    forceMethod: { redundants: [...red], S0: x0.slice(0, m.s), R0: x0.slice(m.s), Sbar: xb.map((v) => v.slice(0, m.s)), Rbar: xb.map((v) => v.slice(m.s)), d10, d11, X },
  };
}

/** Einheitslast-Stabkräfte S̄ für F = 1 N am Knoten in Richtung d (im bestimmten System bzw. Grundsystem). */
export function unitLoadForces(m: TrussModel, sol: TrussSolution, node: number, d: [number, number]): number[] {
  const rhs = new Array<number>(2 * m.k).fill(0);
  rhs[2 * node] = -d[0]; rhs[2 * node + 1] = -d[1];
  return solveBasis(m, sol.basis, rhs).slice(0, m.s);
}

/** Verschiebung aller Knoten über den Arbeitssatz (FW-VK ohne Rechenweg), [mm]. */
export function trussDisplacements(m: TrussModel, sol: TrussSolution): Array<{ ux: number; uy: number }> {
  const dl = sol.S.map((S, b) => S * m.flex[b]!);
  return Array.from({ length: m.k }, (_, node) => {
    const sx = unitLoadForces(m, sol, node, [1, 0]), sy = unitLoadForces(m, sol, node, [0, 1]);
    return { ux: sx.reduce((a, v, b) => a + v * dl[b]!, 0), uy: sy.reduce((a, v, b) => a + v * dl[b]!, 0) };
  });
}

export interface DeflectionResult {
  node: number; ux: number; uy: number; u: number;
  /** Einheitslast-Stabkräfte für F = 1 in x bzw. y (Zwischentabelle) */
  SbarX: number[]; SbarY: number[];
}

/** Verschiebung eines Knotens mit Rechenweg (FW-VK). */
export function trussDeflection(inp: TrussInput, m: TrussModel, sol: TrussSolution, node: number, add: (g: FwGroup, s: CalcStep) => void): DeflectionResult {
  const SbarX = unitLoadForces(m, sol, node, [1, 0]), SbarY = unitLoadForces(m, sol, node, [0, 1]);
  const red = sol.forceMethod ? `; S̄ im Grundsystem (Reduktionssatz, ${FW_REF_GROSS2} Abschn. 6.5)` : "";
  const one = (Sb: number[], dir: string): number => {
    const v = Sb.reduce((a, sb, b) => a + sol.S[b]! * sb * m.flex[b]!, 0);
    const t = Sb.map((sb, b) => ({ sb, b })).filter((x) => x.sb !== 0 && sol.S[x.b] !== 0).map(({ sb, b }) => `${fmt(sol.S[b]!)}·${fmt(sb)}·${fmt(m.flex[b]!)}`);
    add("verschiebung", step("FW-VK", "Knotenverschiebung (Arbeitssatz mit Einheitslast)", "δ = Σ S·S̄·l / (E·A)", `${nodeName(inp, node)} in ${dir}: ` + (t.length ? t.join(" + ") : "0"), v, "mm", `${FW_REF_GROSS2} Abschn. 6.3, Gl. (6.30), Bsp. 6.3, 6.4; ${FW_REF_DUBBEL} Abschn. 20.4.9${red}`));
    return v;
  };
  const ux = one(SbarX, "x"), uy = one(SbarY, "y");
  return { node, ux, uy, u: Math.hypot(ux, uy), SbarX, SbarY };
}
