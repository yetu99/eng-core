/** Auswertung eines Prüffalls durch den Rechenkern. Gemeinsam genutzt von engine_out.ts (Python-Gegenrechnung) und den Golden-Tests. */
import { computeLine, fdRepo, waterDensity, waterViscosity, saturationPressure, frictionFactor, type LineInput, type LineTask } from "../src/index";
import { computeStrength, designPressureStrength, designSize, sectionProps, multiConstraint, buildIndex, points, ranking, coverage, MAT_CLASSES, type StrengthInput, type SecType, type ConflictBasis, type FunctionName, type ObjectiveName, type FreeVar, type ShapeMode, type PhiSet, type MatClass, type Repo } from "../src/index";

export type Case =
  | { id: string; type: "section"; sec: SecType; dims: Record<string, number> }
  | { id: string; type: "calc"; inp: StrengthInput }
  | { id: string; type: "pressure"; inp: StrengthInput; design?: boolean }
  | { id: string; type: "vibration"; inp: StrengthInput; design?: boolean }
  | { id: string; type: "fatigue"; inp: StrengthInput }
  | { id: string; type: "conflict"; materialId: string; basis: ConflictBasis; alpha: number }
  | { id: string; type: "ashby"; materialId: string; fn: FunctionName; con: string; obj: ObjectiveName; free?: FreeVar; shapeMode: ShapeMode; phiUser: PhiSet | null }
  | { id: string; type: "ashbyset"; fn: FunctionName; con: string; obj: ObjectiveName; free?: FreeVar }
  | { id: string; type: "water"; T: number; p: number }
  | { id: string; type: "psat"; T: number }
  | { id: string; type: "visc"; T: number; rho: number }
  | { id: string; type: "colebrook"; Re: number; eps: number }
  | { id: string; type: "fluid"; inp: LineInput; task: LineTask };

/** Rohrhydraulik (Modul fluid): Kennwerte eines Strangs für Gegenrechnung und Golden-Test. */
function evalFluid(inp: LineInput, task: LineTask): Record<string, number | null> {
  const r = computeLine(fdRepo, inp, task);
  if (r.errors.length) return { errors: r.errors.length };
  const rho = r.fluid.rho, g = inp.g;
  const o: Record<string, number | null> = {
    errors: 0, dpErf: r.dpErf, dpV: r.dpV, dpR: r.dpR, dpZ: r.dpZ, dpGeo: r.dpGeo, pA: r.pAErf, pMin: r.pMin, Q: r.Q, Ph: r.Ph, P: r.P,
    hv: r.dpV / (rho * g), pAh: r.pAErf / (rho * g), dH: r.nodes[0]!.H - r.nodes[r.nodes.length - 1]!.H - r.dpV / (rho * g), pEnd: r.nodes[r.nodes.length - 1]!.p,
  };
  r.elements.forEach((e, i) => {
    if (e.kind === "rohr") Object.assign(o, { [`lam${i}`]: e.lambda, [`Re${i}`]: e.Re, [`v${i}`]: e.v });
    else o[`zeta${i}`] = e.zeta;
  });
  if (task.kind === "B") {
    const a = computeLine(fdRepo, { ...inp, Q: r.Q }, { kind: "A" });
    o["backB"] = a.dpErf / task.dpAvail;
  }
  if (task.kind === "C" && r.design) {
    const elements = inp.elements.map((e) => (e.kind === "rohr" && e.geom.kind === "var" ? { ...e, geom: { kind: "d" as const, d: r.design!.dMin } } : e));
    o["dMin"] = r.design.dMin; o["dGew"] = r.design.pipe?.d ?? null;
    o["backC"] = computeLine(fdRepo, { ...inp, elements }, { kind: "A" }).dpErf / task.dpAllow;
  }
  return o;
}

export function evalCase(repo: Repo, c: Case): Record<string, number | null> {
  if (c.type === "water") { const rho = waterDensity(c.T, c.p); const eta = waterViscosity(c.T, rho); return { v: 1 / rho, rho, eta, nu: eta / rho }; }
  if (c.type === "psat") return { ps: saturationPressure(c.T) };
  if (c.type === "visc") return { mu: waterViscosity(c.T, c.rho) };
  if (c.type === "colebrook") { const f = frictionFactor(c.Re, c.eps); return { lam: f.lambda, iterations: f.iterations, res: Math.abs(f.residual) }; }
  if (c.type === "fluid") return evalFluid(c.inp, c.task);
  if (c.type === "section") {
    const s = sectionProps(c.sec, c.dims);
    const o = s.open;
    return {
      A: s.A, I: s.I, W: s.W, K: s.K, Wt: s.Wt, phiBe: s.phiBe, phiTe: s.phiTe, phiBf: s.phiBf, phiTf: s.phiTf, Imin: s.Imin, kappa: s.kappa, e: s.e, errors: s.errors.length,
      ...(o ? { Iy: o.Iy, Iz: o.Iz, Iyz: o.Iyz, I1: o.I1, I2: o.I2, alpha: o.alpha, ys: o.ys, zs: o.zs, eo: o.eo, eu: o.eu, eM: o.eM } : {}),
    };
  }
  if (c.type === "calc") {
    const r = computeStrength(repo, c.inp);
    const ll = r.bend?.ll ?? null;
    return {
      M: r.bend?.M ?? null, w: r.bend?.w ?? null, sv: r.sigmaV, dL: r.axial?.dL ?? null, sk: r.buck?.sigmaK ?? null, lamT: r.buck?.lambdaT ?? null, theta: r.tors?.theta ?? null, tau: r.tauT, util: r.util,
      Q: r.bend?.Q ?? null, A: ll?.A ?? null, B: ll?.B ?? null, MA: ll?.MA ?? null, MB: ll?.MB ?? null, xM: ll?.Mext.x ?? null, xf: ll?.wext.x ?? null,
      res: ll ? Math.max(Math.abs(ll.resF), Math.abs(ll.resM)) : null,
      sigO: r.kpis.find((k) => k.key === "sigO")?.value ?? null, sigU: r.kpis.find((k) => k.key === "sigU")?.value ?? null,
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
  if (c.type === "fatigue") {
    const r = computeStrength(repo, c.inp), f = r.fatigue;
    if (!f) return { fat: null };
    const o: Record<string, number | null> = { errors: f.errors.length, SD: f.SD, SZ: f.SZ, Nlife: f.Nlife !== null && Number.isFinite(f.Nlife) ? f.Nlife : f.Nlife === null ? null : -1, Kt: f.Kt, Ktp: f.Ktp, Rm: f.Rm, Rp: f.Rp, dEff: f.dEff, smv: f.smv, SDreq: f.SDreq, util: r.util };
    for (const k of f.comps) {
      Object.assign(o, { [`sa_${k.c}`]: k.sa, [`sm_${k.c}`]: k.sm, [`alpha_${k.c}`]: k.alpha, [`G_${k.c}`]: k.G, [`n_${k.c}`]: k.n, [`beta_${k.c}`]: k.beta, [`Kg_${k.c}`]: k.Kg, [`KR_${k.c}`]: k.KR, [`KD_${k.c}`]: k.KD, [`WN_${k.c}`]: k.WN, [`GW_${k.c}`]: k.GW, [`psi_${k.c}`]: k.psi, [`GA_${k.c}`]: k.GA, [`S_${k.c}`]: k.S, [`AK_${k.c}`]: k.AK });
    }
    return o;
  }
  if (c.type === "conflict") {
    const m = repo.byId(c.materialId);
    const row = m ? multiConstraint(repo, [m], c.basis, c.alpha).rows[0] : undefined;
    return { mStiff: row?.mStiff ?? null, mStrength: row?.mStrength ?? null, mass: row?.mass ?? null, sigmaZul: row?.sigmaZul ?? null, cost: row?.cost ?? null, Z: row?.Z ?? null };
  }
  const index = buildIndex(c.fn, c.con, c.obj, c.free ?? "Querschnitt");
  if (!index) return { idx: null };
  const classes = Object.fromEntries(MAT_CLASSES.map((k) => [k, true])) as Record<MatClass, boolean>;
  if (c.type === "ashbyset") {
    // alle 100 Werkstoffe: Bewertbarkeit, Summe ln M (empfindlich auf jeden Einzelwert), Extremwerte, Rang fester Werkstoffe
    const st = { index, classes, limits: { Emin: null, rhoMax: null, sfMin: null, priceMax: null }, shapeMode: "none" as const, phiUser: null };
    const pts = points(repo, st, false), r = ranking(repo, st, false), cov = coverage(repo, st);
    const rk = (id: string) => r.find((q) => q.m.id === id)?.rank ?? 0;
    return { n: pts.length, nCov: cov.n, slog: pts.reduce((s, p) => s + Math.log(p.idx), 0), max: r[0]?.idx ?? null, min: r[r.length - 1]?.idx ?? null, rankW001: rk("W001"), rankW038: rk("W038"), slope: index.slope };
  }
  const p = points(repo, { index, classes, limits: { Emin: null, rhoMax: null, sfMin: null, priceMax: null }, shapeMode: c.shapeMode, phiUser: c.phiUser }, c.shapeMode !== "none").find((q) => q.m.id === c.materialId);
  return { idx: p?.idx ?? null, x: p?.x ?? null, y: p?.y ?? null };
}
