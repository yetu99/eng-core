/** Auswertung eines Prüffalls durch den Rechenkern. Gemeinsam genutzt von engine_out.ts (Python-Gegenrechnung) und den Golden-Tests. */
import { computeStrength, designPressureStrength, designSize, sectionProps, multiConstraint, buildIndex, points, MAT_CLASSES, type StrengthInput, type SecType, type ConflictBasis, type FunctionName, type ObjectiveName, type ShapeMode, type PhiSet, type MatClass, type Repo } from "../src/index";

export type Case =
  | { id: string; type: "section"; sec: SecType; dims: Record<string, number> }
  | { id: string; type: "calc"; inp: StrengthInput }
  | { id: string; type: "pressure"; inp: StrengthInput; design?: boolean }
  | { id: string; type: "vibration"; inp: StrengthInput; design?: boolean }
  | { id: string; type: "conflict"; materialId: string; basis: ConflictBasis; alpha: number }
  | { id: string; type: "ashby"; materialId: string; fn: FunctionName; con: string; obj: ObjectiveName; shapeMode: ShapeMode; phiUser: PhiSet | null };

export function evalCase(repo: Repo, c: Case): Record<string, number | null> {
  if (c.type === "section") {
    const s = sectionProps(c.sec, c.dims);
    return { A: s.A, I: s.I, W: s.W, K: s.K, Wt: s.Wt, phiBe: s.phiBe, phiTe: s.phiTe, phiBf: s.phiBf, phiTf: s.phiTf };
  }
  if (c.type === "calc") {
    const r = computeStrength(repo, c.inp);
    const ll = r.bend?.ll ?? null;
    return {
      M: r.bend?.M ?? null, w: r.bend?.w ?? null, sv: r.sigmaV, dL: r.axial?.dL ?? null, sk: r.buck?.sigmaK ?? null, lamT: r.buck?.lambdaT ?? null, theta: r.tors?.theta ?? null, tau: r.tauT, util: r.util,
      Q: r.bend?.Q ?? null, A: ll?.A ?? null, B: ll?.B ?? null, MA: ll?.MA ?? null, MB: ll?.MB ?? null, xM: ll?.Mext.x ?? null, xf: ll?.wext.x ?? null,
      res: ll ? Math.max(Math.abs(ll.resF), Math.abs(ll.resM)) : null,
    };
  }
  if (c.type === "pressure") {
    if (c.design) {
      const d = designPressureStrength(repo, c.inp);
      return d.ok ? { designOk: 1, tErf: d.tErf, tGew: d.tGew, closedForm: d.closedForm ? 1 : 0, util: d.result.util, utilErf: d.trace.find((s) => s.id === "P-NA")?.value ?? null } : { designOk: 0 };
    }
    const r = computeStrength(repo, c.inp), p = r.pressure;
    if (!p || !p.inner || !p.outer || !p.sol) return { errors: r.errors.length };
    const rm = (p.a + p.b) / 2, M = p.sol.at(rm);
    return {
      errors: r.errors.length, a: p.a, b: p.b, srA: p.inner.sr, stA: p.inner.st, sz: p.inner.sz, svA: p.inner.sv, uA: p.inner.u,
      srB: p.outer.sr, stB: p.outer.st, svB: p.outer.sv, uB: p.outer.u, srM: M.sr, stM: M.st, svMax: p.svMax, util: r.util, sigmaZul: p.sigmaZul,
      Fax: p.input.shape === "ZY" ? p.inner.sz * Math.PI * (p.b * p.b - p.a * p.a) : null, tresca: (p.rGov === "a" ? p.inner : p.outer).tresca, kSt: p.kessel?.st ?? null, kSz: p.kessel?.sz ?? null, kDev: p.kessel?.dev ?? null,
    };
  }
  if (c.type === "vibration") {
    if (c.design) {
      const d = designSize(repo, c.inp, "formtreu");
      if (!d.ok) return { designOk: 0 };
      const raw = computeStrength(repo, { ...c.inp, dims: d.raw });
      return { designOk: 1, s: d.s, closedForm: c.inp.vibration?.mz === 0 ? 1 : 0, f1Raw: raw.vibration?.modes[0]?.f ?? null, f1Gew: d.result.vibration?.modes[0]?.f ?? null, util: d.result.util };
    }
    const r = computeStrength(repo, c.inp), v = r.vibration;
    if (!v || !v.modes.length) return { errors: r.errors.length };
    const o: Record<string, number | null> = { errors: r.errors.length, fR: v.rayleigh?.fR ?? null, ratio: v.rayleighRatio, uMin: v.uMin, delta: v.delta, uRes: v.uRes, util: r.util, m: v.m, EI: v.EI };
    for (const md of v.modes) {
      Object.assign(o, { [`betaL${md.n}`]: md.betaL, [`f${md.n}`]: md.f, [`omega${md.n}`]: md.omega, [`xMax${md.n}`]: md.xMax, [`p3_${md.n}`]: md.phi(0.3 * v.L), [`p7_${md.n}`]: md.phi(0.7 * v.L) });
      md.nodes.forEach((x, i) => { o[`node${md.n}_${i + 1}`] = x; });
    }
    return o;
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
