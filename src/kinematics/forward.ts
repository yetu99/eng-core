/**
 * Vorwärtskinematik offener Ketten (Modul kinematik, Blatt K3, ab 0.16.0): Einstieg computeForward.
 * Rechenschritte G-24 (Kette der Gliedmatrizen über G-16-N), G-24-W (mit Basis und Werkzeug), G-25-P und G-25-S
 * (Kontrolle mit geschlossener Form); Gliedmatrizen, Gelenkwerte, Prüfung und Umrechnung aus dh.ts.
 * Konzept handhabung/konzept_k3_dh_vorwaertskinematik.md (freigegeben 08.11.2026).
 *
 * Quellen: Weber/Koch Gl. (2.35), (3.2), (3.8), (3.10), S. 46 (konstante Werkzeugmatrix); Lynch/Park Gl. (4.1) bis (4.3),
 * Anhang C (C.1). Einheiten m und rad.
 *
 * Rahmen: {W} Welt, {0} Basis der DH-Kette, {1} … {n} Gliedrahmen, {t} Werkzeug. Ohne Basis ist {W} = {0}, ohne
 * Werkzeug ist {t} = {n}. Rechenweg-Gruppen gelenke, vorwaerts, kontrolle.
 */
import { fmt } from "../format";
import type { CalcStep, Trace, TraceGroupOf } from "../trace";
import { deg, rotZ, type Vec3 } from "./so3";
import { KinematicsError } from "./orientation";
import { IDENTITY, chainT, composeT, fromPose, se3, tName, tStr, toMat4, toPose, transformPoint, type Pose, type Transform } from "./se3";
import {
  checkChain, checkLimits, convertDh, jointValue, linkFactors, linkMatrix, angTxt, lenTxt, type DhConvention, type DhJoint, type DhSubStep, type JointValue, type Robot,
} from "./dh";

type KinGroup = TraceGroupOf<"kinematik">;

export interface ForwardInput {
  robot: Robot;
  /** Gelenkvariablen q_1 … q_n (rad bzw. m). */
  q: readonly number[];
  /** Punkt, gegeben im Gliedrahmen k (0 … n) oder im Werkzeug "t", in Welt ausdrücken (G-17, Weber/Koch Gl. (3.2) Text). */
  point?: { frame: number | "t"; v: Vec3 } | null;
  /** Tabelle zusätzlich in die andere Konvention umrechnen (G-27) und an q kontrollieren. */
  convert?: boolean;
}

export type SegmentKind = "basis" | "d" | "a" | "werkzeug";
export interface DrawJoint { i: number; type: DhJoint["type"]; origin: Vec3; axis: Vec3 }
export interface DrawSegment { from: Vec3; to: Vec3; kind: SegmentKind; link: number }

export interface ForwardResult {
  errors: string[];
  notes: string[];
  warnings: string[];
  convention: DhConvention | null;
  n: number;
  /** θ_i und d_i nach G-23 */
  values: JointValue[];
  /** Gliedmatrizen A_i = T_(i−1)i */
  links: Transform[];
  /** T_0k für k = 0 … n (T_00 = I) */
  frames: Transform[];
  T0n: Transform | null;
  /** T_Wt = T_W0·T_0n·T_nt (= T_0n ohne Basis und Werkzeug) */
  TWt: Transform | null;
  pose: Pose | null;
  base: Transform;
  tool: Transform;
  /** Lagen in Welt für die Zeichnung: T_Wk (k = 0 … n), Werkzeug T_Wt */
  world: { frames: Transform[]; tool: Transform } | null;
  drawing: { joints: DrawJoint[]; segments: DrawSegment[] } | null;
  limitsViolated: number[];
  closedForm: { kind: "planar" | "scara"; p: Vec3; phi: number; dev: number } | null;
  converted: Robot | null;
  point: Vec3 | null;
  trace: Trace<KinGroup>;
}

/** Abstand zur Kardansperre der Pose, ab dem gewarnt wird (Grad, wie K2). */
const NEAR_LOCK_DEG = 5;
const ne = (x: number): string => fmt(Math.abs(x) < 5e-13 ? 0 : x, 6);
const LP = "Lynch/Park";
const WK = "Weber/Koch";

/** Winkel auf (−π, π] (Vergleich der Kontrollformel). */
const wrap = (a: number): number => { const w = Math.atan2(Math.sin(a), Math.cos(a)); return w === -Math.PI ? Math.PI : w; };
const add3 = (a: Vec3, b: Vec3, f = 1): Vec3 => [a[0] + f * b[0], a[1] + f * b[1], a[2] + f * b[2]];
const col = (T: Transform, j: 0 | 1 | 2): Vec3 => [T.R[0][j], T.R[1][j], T.R[2][j]];

/** Vorwärtskinematik mit Rechenweg: Prüfung, Gelenkwerte, Gliedmatrizen, Kette, Basis und Werkzeug, Kontrolle. */
export function computeForward(inp: ForwardInput): ForwardResult {
  const trace: Trace<KinGroup> = {};
  const add = (g: KinGroup, steps: CalcStep[]): void => { (trace[g] ??= []).push(...steps); };
  const res: ForwardResult = {
    errors: [], notes: [], warnings: [], convention: null, n: 0, values: [], links: [], frames: [], T0n: null, TWt: null, pose: null,
    base: IDENTITY, tool: IDENTITY, world: null, drawing: null, limitsViolated: [], closedForm: null, converted: null, point: null, trace,
  };
  const fail = (e: unknown): void => { res.errors.push(e instanceof KinematicsError ? e.message : String(e)); };
  const { robot, q } = inp;
  try {
    add("gelenke", checkChain(robot).steps);
    const n = robot.joints.length;
    if (q.length !== n) throw new KinematicsError(`Gelenkvariablen: ${q.length} Werte für ${n} Gelenke`);
    res.convention = robot.convention; res.n = n;

    // ---------------- Gelenkwerte und Grenzen (G-23)
    robot.joints.forEach((j, k) => {
      const v = jointValue(j, q[k]!, k + 1);
      add("gelenke", v.steps); res.values.push(v.value);
    });
    const lim = checkLimits(robot, q);
    add("gelenke", lim.steps);
    res.limitsViolated = lim.value.violated;
    if (lim.value.violated.length) res.warnings.push(`Gelenkgrenze verletzt bei Gelenk ${lim.value.violated.join(", ")}: Ergebnis gilt nur rechnerisch.`);

    // ---------------- Gliedmatrizen (G-21 bzw. G-22) und Kette (G-16-N, G-24)
    robot.joints.forEach((j, k) => {
      const m = linkMatrix(robot.convention, j, res.values[k]!, k + 1);
      add("gelenke", m.steps); res.links.push(m.value);
    });
    const names = Array.from({ length: n + 1 }, (_, k) => String(k));
    const c = chainT(res.links, names);
    if (n > 1) add("vorwaerts", c.steps);
    res.frames = c.partial; res.T0n = c.value;
    const prod = res.links.map((_, k) => `A_${k + 1}`).join("·");
    add("vorwaerts", [{
      id: "G-24", title: "Vorwärtskinematik (Kette der Gliedmatrizen)", formula: "T_0n(q) = A_1(q_1)·A_2(q_2)·…·A_n(q_n), Zwischenrahmen T_0k = A_1·…·A_k",
      subst: `${tName("0", String(n))} = ${prod} = ${tStr(c.value)}`, value: Math.hypot(...c.value.p), unit: "m",
      ref: `${WK} Gl. (2.35), (3.2); ${LP} Anhang C, Gl. (C.1)`, matrix: toMat4(c.value),
    }]);

    // ---------------- Basis und Werkzeug (G-13-P, G-16, G-24-W), Pose (G-13-X)
    let TWt = c.value;
    const nn = String(n);
    if (robot.base || robot.tool) {
      const b = robot.base ? fromPose(robot.base, "W", "0") : null;
      const t = robot.tool ? fromPose(robot.tool, nn, "t") : null;
      if (b) { add("vorwaerts", b.steps); res.base = b.value; }
      if (t) { add("vorwaerts", t.steps); res.tool = t.value; }
      const c1 = composeT(res.base, c.value, "W", "0", nn, false), c2 = composeT(c1.value, res.tool, "W", nn, "t", false);
      add("vorwaerts", [...c1.steps, ...c2.steps]);
      TWt = c2.value;
      add("vorwaerts", [{
        id: "G-24-W", title: "Vorwärtskinematik mit Basis und Werkzeug", formula: "T_Wt = T_W0·T_0n(q)·T_nt (wie G-20-K mit T_01 = T_W0, T_1m = T_0n, T_mt = T_nt)",
        subst: `T_Wt = ${tName("W", "0")}·${tName("0", nn)}·${tName(nn, "t")} = ${tStr(TWt)}`, value: Math.hypot(...TWt.p), unit: "m",
        ref: `${WK} S. 46 (konstante Werkzeugmatrix am letzten Gliedsystem); ISO 9787:2013, 5.1 bis 5.4`, matrix: toMat4(TWt),
      }]);
    }
    res.TWt = TWt;
    const ps = toPose(TWt, robot.base || robot.tool ? "W" : "0", robot.base || robot.tool ? "t" : nn);
    add("vorwaerts", ps.steps); res.notes.push(...ps.notes);
    res.pose = ps.value;
    const bDeg = deg(ps.value.B);
    if (Math.abs(ps.value.B) !== Math.PI / 2 && 90 - Math.abs(bDeg) < NEAR_LOCK_DEG)
      res.warnings.push(`Kardansperre nah (B = ${bDeg.toFixed(2).replace(".", ",")}°): A und C der Pose ändern sich bei kleinen Änderungen stark.`);

    // ---------------- Zeichnung in Welt
    const Wk = res.frames.map((T) => se3.compose(res.base, T));
    const Wt = se3.compose(Wk[n]!, res.tool);
    res.world = { frames: Wk, tool: Wt };
    res.drawing = drawing(robot, res.values, Wk, Wt);

    // ---------------- Punkt (G-17)
    if (inp.point) {
      const { frame, v } = inp.point;
      const T = frame === "t" ? Wt : Number.isInteger(frame) && frame >= 0 && frame <= n ? Wk[frame]! : null;
      if (!T) throw new KinematicsError(`Punkt: Rahmen {${String(frame)}} gibt es nicht (0 bis ${n} oder t)`);
      const pt = transformPoint(T, v, robot.base ? "W" : "0", String(frame));
      add("vorwaerts", pt.steps); res.point = pt.value;
    }

    // ---------------- Kontrolle geschlossene Form (G-25-P, G-25-S)
    const cf = closedForm(robot, res.values, c.value);
    if (cf) { add("kontrolle", [cf.step]); res.closedForm = cf.value; }

    // ---------------- Umrechnung (G-27)
    if (inp.convert) {
      const cv = convertDh(robot, q);
      add("kontrolle", cv.steps); res.converted = cv.value;
    }
  } catch (e) { fail(e); }
  return res;
}

/** Strichmodell: Gelenkachsen und Gliedstrecken d und a in Welt (Reihenfolge der Konvention). */
function drawing(robot: Robot, vals: readonly JointValue[], Wk: readonly Transform[], Wt: Transform): { joints: DrawJoint[]; segments: DrawSegment[] } {
  const joints: DrawJoint[] = [], segments: DrawSegment[] = [];
  const n = robot.joints.length;
  if (Math.hypot(...Wk[0]!.p) > 0) segments.push({ from: [0, 0, 0], to: Wk[0]!.p, kind: "basis", link: 0 });
  robot.joints.forEach((j, k) => {
    const i = k + 1, prev = Wk[k]!, cur = Wk[i]!;
    if (robot.convention === "klassisch") {
      joints.push({ i, type: j.type, origin: prev.p, axis: col(prev, 2) });
      const mid = add3(prev.p, col(prev, 2), vals[k]!.d);
      segments.push({ from: prev.p, to: mid, kind: "d", link: i }, { from: mid, to: cur.p, kind: "a", link: i });
    } else {
      joints.push({ i, type: j.type, origin: cur.p, axis: col(cur, 2) });
      const mid = add3(prev.p, col(prev, 0), j.a);
      segments.push({ from: prev.p, to: mid, kind: "a", link: i }, { from: mid, to: cur.p, kind: "d", link: i });
    }
  });
  if (Math.hypot(Wt.p[0] - Wk[n]!.p[0], Wt.p[1] - Wk[n]!.p[1], Wt.p[2] - Wk[n]!.p[2]) > 0) segments.push({ from: Wk[n]!.p, to: Wt.p, kind: "werkzeug", link: n + 1 });
  return { joints, segments };
}

/**
 * G-25-P: planare Kette (klassisch, nur Drehgelenke, alle α = 0): x = Σ a_k cos(θ_1 + … + θ_k), y = Σ a_k sin(…),
 * z = Σ d_k, φ = Σ θ_k (Lynch/Park Gl. (4.1) bis (4.3) mit L_k = a_k).
 * G-25-S: SCARA (klassisch, Gelenke R R P R, alle α = 0, a_3 = a_4 = 0): Weber/Koch Gl. (3.8), (3.10).
 * Abweichung e = max(|p − p_0n|, |R_0n − Rot_z(φ)|) gegen die Matrixkette.
 */
function closedForm(robot: Robot, vals: readonly JointValue[], T: Transform): { step: CalcStep; value: NonNullable<ForwardResult["closedForm"]> } | null {
  const J = robot.joints;
  if (robot.convention !== "klassisch" || !J.every((j) => j.alpha === 0)) return null;
  const types = J.map((j) => j.type).join("");
  const scara = types === "RRPR" && J[2]!.a === 0 && J[3]!.a === 0;
  const planar = J.every((j) => j.type === "R");
  if (!scara && !planar) return null;
  let x = 0, y = 0, z = 0, s = 0;
  vals.forEach((v, k) => { s += v.theta; x += J[k]!.a * Math.cos(s); y += J[k]!.a * Math.sin(s); z += v.d; });
  const phi = s;
  const Rz = rotZ(phi);
  let dev = Math.max(Math.abs(x - T.p[0]), Math.abs(y - T.p[1]), Math.abs(z - T.p[2]));
  for (const i of [0, 1, 2] as const) for (const j of [0, 1, 2] as const) dev = Math.max(dev, Math.abs(Rz[i][j] - T.R[i][j]));
  const p: Vec3 = [x, y, z];
  const pTxt = `(${p.map((v) => ne(v * 1e3)).join("; ")}) mm`;
  const step: CalcStep = scara
    ? { id: "G-25-S", title: "Kontrolle SCARA geschlossen", formula: "p = (a_1 cos θ_1 + a_2 cos(θ_1+θ_2), a_1 sin θ_1 + a_2 sin(θ_1+θ_2), d_1+d_2+d_3+d_4), A = θ_1+θ_2+θ_3+θ_4; e = max(|p − p_04|, |R_04 − R_z(A)|)",
        subst: `p = ${pTxt}, A = ${angTxt(wrap(phi))}; e = ${fmt(dev, 3)}`, value: dev, unit: "m", ref: `${WK} Gl. (3.8), (3.9), (3.10), Bild 3.8`, matrix: [[x, y, z, phi]] }
    : { id: "G-25-P", title: "Kontrolle planare Kette geschlossen", formula: "x = Σ a_k cos(θ_1+…+θ_k), y = Σ a_k sin(θ_1+…+θ_k), z = Σ d_k, φ = Σ θ_k; e = max(|p − p_0n|, |R_0n − R_z(φ)|)",
        subst: `p = ${pTxt}, φ = ${angTxt(wrap(phi))}; e = ${fmt(dev, 3)}`, value: dev, unit: "m", ref: `${LP} Gl. (4.1) bis (4.3); ${WK} Bild 3.5`, matrix: [[x, y, z, phi]] };
  return { step, value: { kind: scara ? "scara" : "planar", p, phi: wrap(phi), dev } };
}

/** Alle Schritte eines Ergebnisses in Anzeigereihenfolge. */
export function forwardSteps(r: ForwardResult): CalcStep[] {
  return [...(r.trace.gelenke ?? []), ...(r.trace.vorwaerts ?? []), ...(r.trace.kontrolle ?? [])];
}

// ---------------------------------------------------------------- Lernhilfe Schritt für Schritt (keine Formel-ID)
export interface DhStage { link: number; label: string; before: Transform; after: Transform; sub: DhSubStep | null }
/**
 * Stufen der Vorwärtskinematik in Welt: je Glied die vier Teiltransformationen in Reihenfolge der Konvention
 * (Rot_z, Trans_z, Trans_x, Rot_x bzw. Rot_x, Trans_x, Trans_z, Rot_z), danach das Werkzeug (falls angegeben). Gleiche Formeln wie G-19,
 * ohne Rechenweg. Die letzte Stufe endet bei T_Wt.
 */
export function dhStages(r: ForwardResult, robot: Robot): DhStage[] {
  if (!r.world || r.errors.length) return [];
  const out: DhStage[] = [];
  let cur = r.world.frames[0]!;
  robot.joints.forEach((j, k) => {
    const v = r.values[k]!;
    for (const sub of linkFactors(robot.convention, v.theta, v.d, j.a, j.alpha, k + 1)) {
      const next = se3.compose(cur, sub.T);
      out.push({ link: k + 1, label: `Glied ${k + 1}: ${sub.label}`, before: cur, after: next, sub });
      cur = next;
    }
  });
  if (robot.tool) out.push({ link: robot.joints.length + 1, label: "Werkzeug: T_nt", before: cur, after: se3.compose(cur, r.tool), sub: null });
  return out;
}

/** Text einer DH-Zeile für Hinweise (Länge mm, Winkel Grad und rad). */
export function jointText(conv: DhConvention, j: DhJoint, i: number): string {
  const a = conv === "klassisch" ? `a_${i}` : `a_${i - 1}`, al = conv === "klassisch" ? `α_${i}` : `α_${i - 1}`;
  return `${j.type === "R" ? "Dreh" : "Schub"} ${i}: θ${j.type === "R" ? "_0" : ""} = ${angTxt(j.theta)}, d${j.type === "P" ? "_0" : ""} = ${lenTxt(j.d)}, ${a} = ${lenTxt(j.a)}, ${al} = ${angTxt(j.alpha)}`;
}
