/** Auswertung eines Prüffalls durch den Rechenkern. Gemeinsam genutzt von engine_out.ts (Python-Gegenrechnung) und den Golden-Tests. */
import { computeOrientation, compose, toZYX, toZYZ, toAxisAngle, toQuaternion, fromZYX, fromZYZ, fromAxisAngle, fromQuaternion, maxAbsDiff, type OrientationInput, type Mat3 } from "../src/index";
import { computeFrames, invertT, composeT, transformPoint, se3, type FrameInput, type Transform, type Vec3 } from "../src/index";
import { computeForward, convertDh, forwardRaw, checkTransform, toMat4, type ForwardInput, type Robot } from "../src/index";
import { computeLine, fdRepo, waterDensity, waterViscosity, saturationPressure, frictionFactor, type LineInput, type LineTask } from "../src/index";
import { waterSoundSpeed, walther, computeMeter, computeSurge, fitQuadratic, type WaltherInput, type MeterInput, type SurgeInput } from "../src/index";
import { computePressFit, pvRepo, fitLimits, selectFits, pressFitProfile, SHAFT_FIELDS, type PressFitInput, type FitSpecIso } from "../src/index";
import { computeBoltJoint, svRepo, jointDiagram, threadOf, threadProps, fmZul, gradeOf, tighteningTorque, tighteningTorqueExact, computeBoltUnpreloaded, coneLayers, type BoltJointInput, type PlateLayer } from "../src/index";
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
  | { id: string; type: "fluid"; inp: LineInput; task: LineTask }
  | { id: string; type: "sound"; T: number; p: number }
  | { id: string; type: "walther"; inp: WaltherInput; T: number }
  | { id: string; type: "meter"; inp: MeterInput }
  | { id: string; type: "surge"; inp: SurgeInput }
  | { id: string; type: "pumpfit"; xs: number[]; ys: number[] }
  | { id: string; type: "kin"; inp: OrientationInput; abs?: boolean }
  | { id: string; type: "kincompose"; Rab: Mat3; Rbc: Mat3; abs?: boolean }
  | { id: string; type: "kinbatch"; quats: Array<[number, number, number, number]>; abs?: boolean }
  | { id: string; type: "frames"; inp: FrameInput; abs?: boolean }
  | { id: string; type: "framesbatch"; samples: number[][]; abs?: boolean }
  | { id: string; type: "forward"; inp: ForwardInput; abs?: boolean }
  | { id: string; type: "forwardbatch"; samples: Array<{ robot: Robot; q: number[] }>; abs?: boolean }
  | { id: string; type: "pv"; inp: PressFitInput; module?: string }
  | { id: string; type: "pvfit"; D: number; fit: FitSpecIso; module?: string }
  | { id: string; type: "pvsel"; D: number; Uu: number; Uo: number; module?: string }
  | { id: string; type: "sv"; inp: BoltJointInput; module?: string }
  | { id: string; type: "svthread"; d: number; module?: string }
  | { id: string; type: "svfmzul"; d: number; grade: string; mu: number; nu: number; module?: string }
  | { id: string; type: "svma"; d: number; mu: number; DKm: number; module?: string }
  | { id: string; type: "svnv"; F: number; grade: string; underLoad: boolean; module?: string }
  | { id: string; type: "svcone"; layers: PlateLayer[]; dW: number; dh: number; DA: number; w: 1 | 2; t: number; module?: string };

const IJ = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] as const;
const matKeys = (p: string, m: Mat3): Record<string, number> => Object.fromEntries(IJ.map(([i, j]) => [`${p}${i + 1}${j + 1}`, m[i][j]]));

/** Kinematik K1 (Modul kinematik): alle Darstellungen, Prüfung und Rundläufe R → Darstellung → R (Fehler elementweise). */
function evalKin(inp: OrientationInput): Record<string, number | null> {
  const r = computeOrientation(inp);
  if (r.errors.length || !r.R || !r.check) return { errors: r.errors.length, valid: r.check ? Number(r.check.valid) : null };
  const R = r.R;
  const o: Record<string, number | null> = { errors: 0, ...matKeys("r", R), orth: r.check.orthErr, det: r.check.det, valid: Number(r.check.valid) };
  if (r.zyx && r.zyz && r.axis && r.quat) {
    Object.assign(o, { A: r.zyx.A, B: r.zyx.B, C: r.zyx.C, phi: r.zyz.phi, theta: r.zyz.theta, psi: r.zyz.psi,
      wx: r.axis.axis[0], wy: r.axis.axis[1], wz: r.axis.axis[2], th: r.axis.theta, ex: r.axis.axis[0] * r.axis.theta, ey: r.axis.axis[1] * r.axis.theta, ez: r.axis.axis[2] * r.axis.theta,
      qw: r.quat.w, qx: r.quat.x, qy: r.quat.y, qz: r.quat.z,
      rtZYX: maxAbsDiff(R, fromZYX(r.zyx).value), rtZYZ: maxAbsDiff(R, fromZYZ(r.zyz).value), rtAX: maxAbsDiff(R, fromAxisAngle(r.axis).value), rtQ: maxAbsDiff(R, fromQuaternion(r.quat).value) });
  }
  if (r.pa) Object.assign(o, { pax: r.pa[0], pay: r.pa[1], paz: r.pa[2] });
  if (r.Rextra) Object.assign(o, matKeys("e", r.Rextra));
  if (r.Rinv) Object.assign(o, matKeys("i", r.Rinv), { invErr: maxAbsDiff(compose(R, r.Rinv).value, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) });
  return o;
}

/**
 * 1000 Orientierungen (Quaternionen aus numpy, fester Startwert): größter Rundlauffehler je Darstellung und
 * Quadratsummen der Ausgaben Σx² und Σ(x + 4)² (Vergleich mit scipy, Vorzeichen- und Zuordnungsfehler fallen auf).
 */
function evalKinBatch(quats: ReadonlyArray<readonly [number, number, number, number]>): Record<string, number | null> {
  const o: Record<string, number> = { n: quats.length, rtZYX: 0, rtZYZ: 0, rtAX: 0, rtQ: 0 };
  const acc = (k: string, x: number): void => { o[`s${k}`] = (o[`s${k}`] ?? 0) + x * x; o[`t${k}`] = (o[`t${k}`] ?? 0) + (x + 4) * (x + 4); };
  for (const [w, x, y, z] of quats) {
    const R = fromQuaternion({ w, x, y, z }).value;
    const a = toZYX(R).value, b = toZYZ(R).value, c = toAxisAngle(R).value, d = toQuaternion(R).value;
    o["rtZYX"] = Math.max(o["rtZYX"]!, maxAbsDiff(R, fromZYX(a).value));
    o["rtZYZ"] = Math.max(o["rtZYZ"]!, maxAbsDiff(R, fromZYZ(b).value));
    o["rtAX"] = Math.max(o["rtAX"]!, maxAbsDiff(R, fromAxisAngle(c).value));
    o["rtQ"] = Math.max(o["rtQ"]!, maxAbsDiff(R, fromQuaternion(d).value));
    IJ.forEach(([i, j]) => acc("R", R[i][j]));
    acc("A", a.A); acc("B", a.B); acc("C", a.C); acc("Phi", b.phi); acc("Th", b.theta); acc("Psi", b.psi);
    acc("E", c.axis[0] * c.theta); acc("E", c.axis[1] * c.theta); acc("E", c.axis[2] * c.theta);
    acc("Q", d.w); acc("Q", d.x); acc("Q", d.y); acc("Q", d.z);
  }
  return o;
}

const IJ4 = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3]] as const;
/** T als 12 Werte p11 … p34 (Spalte 4 in m). */
const tKeys = (p: string, T: Transform): Record<string, number> =>
  Object.fromEntries(IJ4.map(([i, j]) => [`${p}${i + 1}${j + 1}`, j === 3 ? T.p[i] : T.R[i][j]]));

/** Kinematik K2 (Modul kinematik, ab 0.14.0): Rahmenbaum, relative Lage, ISO-Kette, Punkt, Verschieben. */
function evalFrames(inp: FrameInput): Record<string, number | null> {
  const r = computeFrames(inp);
  if (r.errors.length) return { errors: r.errors.length };
  const o: Record<string, number | null> = { errors: 0 };
  for (const id of r.order) Object.assign(o, tKeys(`W${id}_`, r.abs[id]!));
  if (r.rel) Object.assign(o, tKeys("t", r.rel));
  if (r.relPose) Object.assign(o, { X: r.relPose.x, Y: r.relPose.y, Z: r.relPose.z, PA: r.relPose.A, PB: r.relPose.B, PC: r.relPose.C });
  if (r.iso) {
    Object.assign(o, tKeys("o", r.iso.T0t));
    if (r.iso.Tkt) Object.assign(o, tKeys("a", r.iso.Tkt));
    if (r.iso.T1mTarget) Object.assign(o, tKeys("f", r.iso.T1mTarget));
  }
  if (r.points) for (const [id, v] of Object.entries(r.points)) Object.assign(o, { [`P${id}_x`]: v[0], [`P${id}_y`]: v[1], [`P${id}_z`]: v[2] });
  if (r.displaced) Object.assign(o, tKeys("d", r.displaced));
  const k = [...(r.trace.inverse ?? [])].filter((s) => s.id === "G-15-K").map((s) => s.value);
  o["invErr"] = k.length ? Math.max(...k) : 0;
  return o;
}

/**
 * Eigenschaften an Zufallsfällen (Lynch/Park Prop. 3.15 bis 3.18): je Probe drei Transformationen und zwei Punkte
 * (q, p je T aus numpy). Größte Fehler: T·T⁻¹ = I, (T⁻¹)⁻¹ = T, Assoziativität, Abstand und Winkel; Quadratsummen
 * der Elemente von T⁻¹ und T_1·T_2 sowie der Bildpunkte (Vergleich mit numpy.linalg.inv und @).
 */
function evalFramesBatch(samples: readonly number[][]): Record<string, number | null> {
  const o: Record<string, number> = { n: samples.length, eInv: 0, eInvInv: 0, eAssoc: 0, eDist: 0, eAng: 0 };
  const acc = (k: string, x: number): void => { o[`s${k}`] = (o[`s${k}`] ?? 0) + x * x; o[`t${k}`] = (o[`t${k}`] ?? 0) + (x + 4) * (x + 4); };
  const T = (a: readonly number[], k: number): Transform => ({ R: fromQuaternion({ w: a[7 * k]!, x: a[7 * k + 1]!, y: a[7 * k + 2]!, z: a[7 * k + 3]! }).value, p: [a[7 * k + 4]!, a[7 * k + 5]!, a[7 * k + 6]!] });
  const d = (x: Vec3, y: Vec3): number => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  const dot3 = (x: Vec3, y: Vec3, z: Vec3): number => (x[0] - z[0]) * (y[0] - z[0]) + (x[1] - z[1]) * (y[1] - z[1]) + (x[2] - z[2]) * (y[2] - z[2]);
  for (const a of samples) {
    const T1 = T(a, 0), T2 = T(a, 1), T3 = T(a, 2);
    const x: Vec3 = [a[21]!, a[22]!, a[23]!], y: Vec3 = [a[24]!, a[25]!, a[26]!], z: Vec3 = [0, 0, 0];
    const inv = invertT(T1);
    o["eInv"] = Math.max(o["eInv"]!, inv.steps.find((s) => s.id === "G-15-K")!.value);
    o["eInvInv"] = Math.max(o["eInvInv"]!, se3.maxAbsDiff(invertT(inv.value).value, T1));
    const c12 = composeT(T1, T2).value;
    o["eAssoc"] = Math.max(o["eAssoc"]!, se3.maxAbsDiff(composeT(c12, T3).value, composeT(T1, composeT(T2, T3).value).value));
    const px = transformPoint(T1, x).value, py = transformPoint(T1, y).value, pz = transformPoint(T1, z).value;
    o["eDist"] = Math.max(o["eDist"]!, Math.abs(d(px, py) - d(x, y)));
    o["eAng"] = Math.max(o["eAng"]!, Math.abs(dot3(px, py, pz) - dot3(x, y, z)));
    for (const [i, j] of IJ4) { acc("I", j === 3 ? inv.value.p[i] : inv.value.R[i][j]); acc("C", j === 3 ? c12.p[i] : c12.R[i][j]); }
    for (const v of px) acc("X", v);
  }
  return o;
}

/** Kinematik K3 (Modul kinematik, ab 0.16.0): Vorwärtskinematik, Zwischenrahmen, Pose, Kontrolle, Umrechnung, Punkt. */
function evalForward(inp: ForwardInput): Record<string, number | null> {
  const r = computeForward(inp);
  if (r.errors.length) return { errors: r.errors.length };
  const o: Record<string, number | null> = { errors: 0, lim: r.limitsViolated.length };
  Object.assign(o, tKeys("n", r.T0n!), tKeys("w", r.TWt!));
  r.frames.forEach((T, k) => Object.assign(o, tKeys(`F${k}_`, T)));
  const p = r.pose!;
  Object.assign(o, { X: p.x, Y: p.y, Z: p.z, PA: p.A, PB: p.B, PC: p.C });
  r.values.forEach((v, k) => Object.assign(o, { [`th${k + 1}`]: v.theta, [`d${k + 1}`]: v.d }));
  if (r.closedForm) Object.assign(o, { cfDev: r.closedForm.dev, cfX: r.closedForm.p[0], cfY: r.closedForm.p[1], cfZ: r.closedForm.p[2], cfPhi: r.closedForm.phi });
  if (r.converted) {
    const cv = r.trace.kontrolle!.at(-1)!;
    o["convDev"] = cv.value;
    r.converted.joints.forEach((j, k) => Object.assign(o, { [`c${k + 1}_th`]: j.theta, [`c${k + 1}_d`]: j.d, [`c${k + 1}_a`]: j.a, [`c${k + 1}_al`]: j.alpha }));
  }
  if (r.point) Object.assign(o, { Px: r.point[0], Py: r.point[1], Pz: r.point[2] });
  return o;
}

/**
 * Zufallsketten (Klassisch und modifiziert, n = 1 bis 8, Dreh- und Schubgelenke): Quadratsummen der Elemente von T_Wt
 * (Vergleich mit der Python-Umsetzung), dazu Eigenschaften im Kern: T_Wt gültig (G-14), Teilketten T_0k·T_kn = T_0n,
 * Umrechnung G-27 hin und zurück erhält T_Wt, Gelenk i ändert nur Rahmen k ≥ i.
 */
function evalForwardBatch(samples: ReadonlyArray<{ robot: Robot; q: number[] }>): Record<string, number | null> {
  const o: Record<string, number> = { n: samples.length, eValid: 0, eSub: 0, eConv: 0, eLocal: 0, errors: 0 };
  const acc = (k: string, x: number): void => { o[`s${k}`] = (o[`s${k}`] ?? 0) + x * x; o[`t${k}`] = (o[`t${k}`] ?? 0) + (x + 4) * (x + 4); };
  for (const { robot, q } of samples) {
    const r = computeForward({ robot, q });
    if (r.errors.length) { o["errors"]! += 1; continue; }
    const T = r.TWt!;
    for (const [i, j] of IJ4) acc("W", j === 3 ? T.p[i] : T.R[i][j]);
    const c = checkTransform(toMat4(T)).value;
    o["eValid"] = Math.max(o["eValid"]!, c.orthErr, Math.abs(c.det - 1), c.rowErr);
    const n = r.n;
    for (let k = 0; k <= n; k++) {
      let Tk = r.frames[k]!;
      for (let m = k; m < n; m++) Tk = se3.compose(Tk, r.links[m]!);
      o["eSub"] = Math.max(o["eSub"]!, se3.maxAbsDiff(Tk, r.T0n!));
    }
    const back = convertDh(convertDh(robot, q).value, q).value;
    o["eConv"] = Math.max(o["eConv"]!, se3.maxAbsDiff(forwardRaw(robot, q), forwardRaw(convertDh(robot, q).value, q)), se3.maxAbsDiff(forwardRaw(robot, q), forwardRaw(back, q)));
    // Gelenk i verstellen: Rahmen k < i (klassisch) bzw. k < i (modifiziert, Rahmen i liegt auf Achse i) bleiben gleich
    const i = Math.floor(n / 2) + 1, q2 = q.map((x, k) => (k === i - 1 ? x + 0.3 : x));
    const r2 = computeForward({ robot: { ...robot, joints: robot.joints.map((j) => ({ ...j, qMin: -1e9, qMax: 1e9 })) }, q: q2 });
    for (let k = 0; k < i; k++) o["eLocal"] = Math.max(o["eLocal"]!, se3.maxAbsDiff(r2.frames[k]!, r.frames[k]!));
  }
  return o;
}

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
  if (task.kind === "D" && r.pump) {
    const u = r.pump;
    Object.assign(o, { Qop: u.Q, Hop: u.H, r: u.r, n: u.n, etaB: u.eta, Ppump: u.P, Pu: u.Pu, nq: u.nq, npshA: u.npshA, npshR: u.npshR, reserve: u.reserve, HA: r.dpErf / (rho * g), pStart: r.nodes[0]!.p });
    // Rückeinsetzen: Förderhöhe der Pumpe = Förderhöhe der Anlage im Betriebspunkt (Verhältnis 1)
    o["backD"] = u.H / (r.dpErf / (rho * g));
  }
  r.nodes.forEach((nd) => { o[`hpe${nd.index}`] = nd.hpe; });
  if (task.kind === "C" && r.design) {
    const elements = inp.elements.map((e) => (e.kind === "rohr" && e.geom.kind === "var" ? { ...e, geom: { kind: "d" as const, d: r.design!.dMin } } : e));
    o["dMin"] = r.design.dMin; o["dGew"] = r.design.pipe?.d ?? null;
    o["backC"] = computeLine(fdRepo, { ...inp, elements }, { kind: "A" }).dpErf / task.dpAllow;
  }
  return o;
}


/** Pressverband (Modul verbindungen, ab 0.17.0): alle Kennwerte eines Rechenlaufs (Übermaße in mm, Momente in N·mm). */
function evalPv(inp: PressFitInput): Record<string, number | null> {
  const r = computePressFit(pvRepo, inp);
  if (r.errors.length) return { errors: r.errors.length };
  const o: Record<string, number | null> = { errors: 0, QA: r.QA, QI: r.QI, AF: r.AF, K: r.K, G: r.G, pzulA: r.pzulA, pzulI: r.pzulI, FR: r.FR, perf: r.perf, Uu: r.Uu, Uo: r.Uo, PT: r.PT, nCand: r.candidates.length };
  const c0 = r.candidates[0];
  if (c0) Object.assign(o, { c0: c0.hole * 1000 + SHAFT_FIELDS.indexOf(c0.field) * 10 + c0.grade, c0Uk: c0.Uk, c0Ug: c0.Ug });
  if (r.fit) Object.assign(o, { Uk: r.fit.Uk, Ug: r.fit.Ug });
  for (const [k, s] of [["min", r.min], ["max", r.max]] as const) if (s) Object.assign(o, { [`Uw_${k}`]: s.Uw, [`xi_${k}`]: s.xi, [`p_${k}`]: s.p, [`ep_${k}`]: s.state === "elastisch-plastisch" ? 1 : s.state === "elastisch" ? 0 : -1, [`zeta_${k}`]: s.zeta, [`q_${k}`]: s.qPA });
  Object.assign(o, { T: r.T, Faxt: r.Faxt, SrIst: r.SrIst, SPA: r.SPAist, SPI: r.SPIist, dDaA: r.dDaA });
  if (r.stress) Object.assign(o, { tAi: r.stress.tAi, tAa: r.stress.tAa, tIi: r.stress.tIi, tIa: r.stress.tIa, vA: r.stress.vA, vI: r.stress.vI });
  if (r.join) Object.assign(o, { Fe: r.join.Fe, le: r.join.le, Us: r.join.Us, UF: r.join.UF, thetaA: r.join.thetaA, Umax: r.join.Umax });
  if (r.plastic) Object.assign(o, { pPA: r.plastic.pPA, pPI: r.plastic.pPI, zetaZul: r.plastic.zetaZul, xiZul: r.plastic.xiZul });
  if (r.spin) Object.assign(o, { u: r.spin.u, uab: r.spin.uab, pn: r.spin.pn, ng: r.spin.ng, Tn: r.spin.Tn, lim54: r.spin.lim54, lim55: r.spin.lim55, ratio10: r.spin.ratio10 });
  // Lamé-Verlauf (lame() aus mechanics/pressure) an D_F/2, D_aA/2 und Wellenrand gegen die geschlossenen Formeln (P-PV10)
  if (r.max && r.stress) {
    const pr = pressFitProfile(inp, r.max.p, 4);
    o["lameErr"] = Math.max(Math.abs(pr.hub[0]!.st - r.stress.tAi), Math.abs(pr.hub[4]!.st - r.stress.tAa), Math.abs(pr.hub[0]!.sr + r.max.p), Math.abs(pr.shaft[4]!.st - r.stress.tIa), Math.abs(pr.shaft[0]!.st - r.stress.tIi)) / r.max.p;
    o["uLameErr"] = Math.abs(2 * pr.hub[4]!.u - r.dDaA!) / r.dDaA!;   // ΔD_aA = 2·u(b) (P-ZY-U, P-PV14)
  }
  return o;
}

/** Schraubenverbindung (0.18.0): Kennwerte, Nachweise als 1/0, Verspannungsschaubild gegen F_SA, F_PA, F_KR (P-SV9). */
function evalSv(inp: BoltJointInput): Record<string, number | null> {
  const r = computeBoltJoint(svRepo, inp);
  if (r.errors.length) return { errors: r.errors.length };
  const o: Record<string, number | null> = { errors: 0, lK: r.geo!.lK, lGew: r.geo!.lGew, length: r.geo!.length, d0: r.geo!.d0, Ap: r.geo!.Ap, ApNut: r.geo!.ApNut, DKm: r.geo!.DKm,
    dS: r.dS, dP: r.dP, dPK: r.plate!.dPK, dPHZ: r.plate!.dPHZ, Aers: r.plate!.Aers, tanPhi: r.plate!.tanPhi, DAGr: r.plate!.DAGr, PhiK: r.PhiK, PhiN: r.PhiN, kefN: r.kefN,
    FAmax: r.FAmax, FSAmax: r.FSAmax, FSAmin: r.FSAmin, FPAmax: r.FPAmax, FQ: r.FQ, FKQ: r.FKQ, FKerf: r.FKerf, fZ: r.fZ, FZ: r.FZ, dFVth: r.dFVth,
    FMmin: r.FMmin, FMmax: r.FMmax, FMzul: r.FMzul, FVmin: r.FVmin, FKRmin: r.FKRmin, FSmax: r.FSmax, sigZ: r.sigZ, MG: r.MG, WP: r.WP, tau: r.tau, sigRedB: r.sigRedB, SF: r.SF,
    sigA: r.sigA, sigAS: r.sigAS, SD: r.SD, pM: r.pM, pB: r.pB, pMax: r.pMax, SpHead: r.SpHead, SpNut: r.SpNut, SG: r.SG, tauQ: r.tauQ, SA: r.SA, le: r.le, mEff: r.mEff,
    MA: r.MA, MAex: r.MAex?.MA ?? null, ML: r.ML, MLi: r.MLi, AsMin: r.AsMin };
  for (const c of r.checks) if (c.ok !== null) o[`ok_${c.key}`] = c.ok ? 1 : 0;
  if (inp.task === "B") { const v = r.candidates.filter((c) => c.valid); Object.assign(o, { nCand: r.candidates.length, nValid: v.length, nOpen: r.candidates.filter((c) => c.status === "nicht bewertbar").length, c0d: v[0]?.d ?? null, sumFMzul: r.candidates.reduce((a, c) => a + (c.FMzul ?? 0), 0) }); }
  const D = jointDiagram(r);
  if (D) {
    const op = D.operating[0]!;
    // Pfeile aus dem Schaubild (Geradenschnitt der Kennlinien) gegen die Rechenwerte (Abnahme G1)
    const FSAdiag = (op.x - D.states[2]!.fS) / D.dS, FPAdiag = (op.x - D.states[2]!.fS) / D.dPn;
    o["diagErr"] = r.FAmax !== 0 ? Math.max(Math.abs(FSAdiag - r.FSAmax), Math.abs(FPAdiag - r.FPAmax), Math.abs(op.FKR - r.FKRmin)) / Math.abs(r.FAmax) : Math.abs(op.FKR - r.FKRmin) / Math.max(r.FKRmin, 1);
  }
  return o;
}

export function evalCase(repo: Repo, c: Case): Record<string, number | null> {
  if (c.type === "pv") return evalPv(c.inp);
  if (c.type === "sv") return evalSv(c.inp);
  if (c.type === "svthread") { const t = threadOf(svRepo, c.d); if (!t) return { errors: 1 }; const T = threadProps(t); return { errors: 0, As: T.As, Ad3: T.Ad3, AN: T.AN, dS: T.dS, phiDeg: T.phiDeg }; }
  if (c.type === "svfmzul") { const t = threadOf(svRepo, c.d)!, T = threadProps(t), g = gradeOf(svRepo, c.grade, c.d)!; return { FMzul: fmZul(T, T.dS, c.nu, g.yield_min_mpa, c.mu) }; }
  if (c.type === "svma") { const T = threadProps(threadOf(svRepo, c.d)!), F = 1e4; return { maRel: tighteningTorque(F, T, c.mu, c.DKm, c.mu) / tighteningTorqueExact(F, T, c.mu, c.DKm, c.mu).MA - 1 }; }
  if (c.type === "svnv") { const r = computeBoltUnpreloaded(svRepo, c.F, c.grade, c.underLoad); return { AsErf: r.AsErf, d: r.d }; }
  if (c.type === "svcone") { const p = coneLayers(c.layers, c.dW, c.dh, c.DA, c.w, c.t); return { dP: p.reduce((a, b) => a + b, 0), n: p.length }; }
  if (c.type === "pvfit") { const L = fitLimits(pvRepo, c.D, c.fit); return typeof L === "string" ? { errors: 1 } : { errors: 0, ES: L.ES, ei: L.ei, es: L.es, Uk: L.Uk, Ug: L.Ug }; }
  if (c.type === "pvsel") { const l = selectFits(pvRepo, c.D, c.Uu, c.Uo); return { n: l.length, sumUk: l.reduce((a, x) => a + x.Uk, 0), sumUg: l.reduce((a, x) => a + x.Ug, 0), c0: l[0] ? l[0].hole * 1000 + SHAFT_FIELDS.indexOf(l[0].field) * 10 + l[0].grade : null, c1: l[1] ? l[1].hole * 1000 + SHAFT_FIELDS.indexOf(l[1].field) * 10 + l[1].grade : null, nIso: l.filter((x) => x.iso).length }; }
  if (c.type === "water") { const rho = waterDensity(c.T, c.p); const eta = waterViscosity(c.T, rho); return { v: 1 / rho, rho, eta, nu: eta / rho }; }
  if (c.type === "psat") return { ps: saturationPressure(c.T) };
  if (c.type === "visc") return { mu: waterViscosity(c.T, c.rho) };
  if (c.type === "colebrook") { const f = frictionFactor(c.Re, c.eps); return { lam: f.lambda, iterations: f.iterations, res: Math.abs(f.residual) }; }
  if (c.type === "fluid") return evalFluid(c.inp, c.task);
  if (c.type === "sound") return { w: waterSoundSpeed(c.T, c.p) };
  if (c.type === "walther") { const w = walther(c.inp, c.T); return { nu: w.nu, K: w.K, m: w.m, errors: w.errors.length }; }
  if (c.type === "meter") { const m = computeMeter(fdRepo, c.inp); return m.errors.length ? { errors: m.errors.length } : { errors: 0, C: m.C, Q: m.Q, dp: m.dp, dw: m.dw, zeta: m.zeta, Re: m.Re, beta: m.beta, ok: m.checks[0]?.ok ? 1 : 0 }; }
  if (c.type === "surge") { const m = computeSurge(fdRepo, c.inp); return m.errors.length ? { errors: m.errors.length } : { errors: 0, a: m.a, psi: m.psi, tR: m.tR, dp: m.dp, pMax: m.pMax, pMin: m.pMin, fast: m.fast ? 1 : 0 }; }
  if (c.type === "pumpfit") { const f = fitQuadratic(c.xs, c.ys); return { c0: f.c[0], c1: f.c[1], c2: f.c[2], r2: f.r2 }; }
  if (c.type === "kin") return evalKin(c.inp);
  if (c.type === "kincompose") return matKeys("c", compose(c.Rab, c.Rbc).value);
  if (c.type === "kinbatch") return evalKinBatch(c.quats);
  if (c.type === "frames") return evalFrames(c.inp);
  if (c.type === "framesbatch") return evalFramesBatch(c.samples);
  if (c.type === "forward") return evalForward(c.inp);
  if (c.type === "forwardbatch") return evalForwardBatch(c.samples);
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
