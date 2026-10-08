/** Auswertung eines Prüffalls durch den Rechenkern. Gemeinsam genutzt von engine_out.ts (Python-Gegenrechnung) und den Golden-Tests. */
import { computeStrength, sectionProps, multiConstraint, buildIndex, points, MAT_CLASSES, type StrengthInput, type SecType, type ConflictBasis, type FunctionName, type ObjectiveName, type ShapeMode, type PhiSet, type MatClass, type Repo } from "../src/index";

export type Case =
  | { id: string; type: "section"; sec: SecType; dims: Record<string, number> }
  | { id: string; type: "calc"; inp: StrengthInput }
  | { id: string; type: "conflict"; materialId: string; basis: ConflictBasis; alpha: number }
  | { id: string; type: "ashby"; materialId: string; fn: FunctionName; con: string; obj: ObjectiveName; shapeMode: ShapeMode; phiUser: PhiSet | null };

export function evalCase(repo: Repo, c: Case): Record<string, number | null> {
  if (c.type === "section") {
    const s = sectionProps(c.sec, c.dims);
    return { A: s.A, I: s.I, W: s.W, K: s.K, Wt: s.Wt, phiBe: s.phiBe, phiTe: s.phiTe, phiBf: s.phiBf, phiTf: s.phiTf };
  }
  if (c.type === "calc") {
    const r = computeStrength(repo, c.inp);
    return { M: r.bend?.M ?? null, w: r.bend?.w ?? null, sv: r.sigmaV, dL: r.axial?.dL ?? null, sk: r.buck?.sigmaK ?? null, lamT: r.buck?.lambdaT ?? null, theta: r.tors?.theta ?? null, tau: r.tauT, util: r.util };
  }
  if (c.type === "conflict") {
    const m = repo.byId(c.materialId);
    const row = m ? multiConstraint(repo, [m], c.basis, c.alpha).rows[0] : undefined;
    return { mStiff: row?.mStiff ?? null, mStrength: row?.mStrength ?? null, mass: row?.mass ?? null, sigmaZul: row?.sigmaZul ?? null, cost: row?.cost ?? null, Z: row?.Z ?? null };
  }
  const index = buildIndex(c.fn, c.con, c.obj);
  if (!index) return { idx: null };
  const classes = Object.fromEntries(MAT_CLASSES.map((k) => [k, true])) as Record<MatClass, boolean>;
  const p = points(repo, { index, classes, limits: { Emin: null, rhoMax: null, sfMin: null, priceMax: null }, shapeMode: c.shapeMode, phiUser: c.phiUser }, c.shapeMode !== "none").find((q) => q.m.id === c.materialId);
  return { idx: p?.idx ?? null, x: p?.x ?? null, y: p?.y ?? null };
}
