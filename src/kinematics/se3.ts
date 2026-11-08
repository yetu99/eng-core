/**
 * Lage starrer Rahmen (Modul kinematik, Blatt K2, ab 0.14.0): homogene Transformation T = [R p; 0 1],
 * Rechenschritte G-13 bis G-19. Die Rahmenkette (G-20) steht in frames.ts.
 * Konzept handhabung/konzept_k2_homogene_transformation.md (K2-E1 bis E5 freigegeben 06.11.2026, E6 Version 0.14.0 am 07.11.2026).
 *
 * Quellen (eigene Umsetzung, keine Normtexte):
 * - Lynch, Park: Modern Robotics, Cambridge 2017, Kap. 3.3.1 (S. 75 bis 82): Def. 3.13, Gl. (3.62) bis (3.67), Prop. 3.15 bis 3.18
 * - Weber, Koch: Industrieroboter, Hanser, Kap. 2.1.7 (S. 25 bis 27): Gl. (2.12) bis (2.17)
 * - ISO 9787:2013, 4.1 (rechtshändig)
 *
 * Konventionen: T_ab = Lage von {b} in {a}; Spalten von R_ab = Achsen von {b} in {a}, p_ab = Ursprung von {b} in {a}.
 * Indexregel T_ab·T_bc = T_ac, T_ab·x_b = x_a. Einheiten im Kern m und rad; der Rechenweg zeigt mm und Grad.
 * Im Feld `matrix` eines Schritts steht T als 4×4 in m (Spalte 4), `value` ist dann ‖p‖ in m.
 * Die Inverse wird immer geschlossen nach G-15 gebildet (keine allgemeine Matrixinversion).
 */
import { fmt } from "../format";
import type { CalcStep } from "../trace";
import { I3, deg, mul, mulVec, norm, transpose, type AxisName, type Mat3, type Vec3 } from "./so3";
import { KinematicsError, checkRotation, fromAxisAngle, fromZYX, toZYX, type AxisAngle, type Calc } from "./orientation";

/** Homogene Transformation T = (R, p), p in m. */
export interface Transform { readonly R: Mat3; readonly p: Vec3 }
/** 4×4-Matrix zeilenweise (Eingabe und Ausgabe), Spalte 4 in m. */
export type Mat4 = readonly (readonly number[])[];
/** Pose wie an der Steuerung: Position x, y, z in m und Z-Y-X-Winkel A (um z), B (um y′), C (um x″) in rad (G-02, KUKA). */
export interface Pose { x: number; y: number; z: number; A: number; B: number; C: number }

/** Prüfung der letzten Zeile (0, 0, 0, 1) und der Rotationsmatrix (G-10): Toleranz wie K1. */
export const T_TOL = 1e-9;
export const IDENTITY: Transform = { R: I3, p: [0, 0, 0] };

const SIG = 6;
const LP = "Lynch/Park";
const WK = "Weber/Koch";
/** Anzeige: Rundungsreste |x| < 5·10⁻¹³ als 0 (nur Text, Werte unverändert). */
const ne = (x: number): string => fmt(Math.abs(x) < 5e-13 ? 0 : x, SIG);
const mm = (x: number): string => ne(x * 1e3);
const dg = (a: number): string => `${ne(deg(a))}°`;
const vmm = (v: readonly number[]): string => `(${v.map(mm).join("; ")}) mm`;
const finite = (...x: number[]): boolean => x.every(Number.isFinite);

/** Kurzname T_ab bzw. T_{a,b} bei Namen mit mehr als einem Zeichen (Anzeige, sym() setzt den Index). */
export function tName(a: string, b: string, sym = "T"): string {
  return a.length <= 1 && b.length <= 1 ? `${sym}_${a}${b}` : `${sym}_{${a},${b}}`;
}
/** Vektor mit Rahmenindex, z. B. x_a bzw. x_{Kamera}. */
const vName = (v: string, f: string, g = ""): string => (f.length <= 1 && g.length <= 1 ? `${v}_${f}${g}` : `${v}_{${g ? `${f},${g}` : f}}`);

/** T als 4×4-Matrix in m (zeilenweise). Keine Formel-ID. */
export function toMat4(T: Transform): number[][] {
  return [[...T.R[0], T.p[0]], [...T.R[1], T.p[1]], [...T.R[2], T.p[2]], [0, 0, 0, 1]];
}
/** Anzeige von T mit p in mm: [r11 r12 r13 p1; …; 0 0 0 1]. */
export function tStr(T: Transform): string {
  return `[${T.R.map((r, i) => `${r.map(ne).join("  ")}  ${mm(T.p[i]!)}`).join("; ")}; 0  0  0  1] (p in mm)`;
}
function tStep(id: string, title: string, formula: string, subst: string, T: Transform, ref: string): CalcStep {
  return { id, title, formula, subst: `${subst} = ${tStr(T)}`, value: norm(T.p), unit: "m", ref, matrix: toMat4(T) };
}
function vStep(id: string, title: string, formula: string, subst: string, v: Vec3, ref: string): CalcStep {
  return { id, title, formula, subst: `${subst} = ${vmm(v)}`, value: norm(v), unit: "m", ref, matrix: [[...v]] };
}
const r3 = (R: Mat3): string => `[${R.map((r) => r.map(ne).join("  ")).join("; ")}]`;

function checkVec(v: Vec3, what: string): void {
  if (!finite(v[0], v[1], v[2])) throw new KinematicsError(`${what} enthält keine Zahl`);
}

// ---------------------------------------------------------------- G-13 Aufbau, Zerlegung, Pose
/** G-13: T aus R und p. R wird hier nicht geprüft (Prüfung G-14 bzw. G-10 beim Aufrufer). */
export function fromRp(R: Mat3, p: Vec3, a = "a", b = "b"): Calc<Transform> {
  checkVec(p, "Ortsvektor p");
  if (!R.every((row) => row.every(Number.isFinite))) throw new KinematicsError("Rotationsmatrix enthält keine Zahl");
  const T: Transform = { R, p };
  return { value: T, steps: [tStep("G-13", "Homogene Transformation aus R und p", "T = [R p; 0 0 0 1], R = Orientierung, p = Ursprung von {b} in {a}",
    `${tName(a, b)} = [R ${vName("p", a, b)}; 0 1] mit R = ${r3(R)}, p = ${vmm(p)}`, T, `${LP} Def. 3.13, Gl. (3.62); ${WK} Gl. (2.12)`)], notes: [] };
}

/** G-13-Z: 4×4-Matrix in R und p zerlegen (Form 4×4 und endliche Zahlen werden geprüft, Gültigkeit mit G-14). */
export function splitMatrix(M: Mat4, a = "a", b = "b"): Calc<Transform> {
  if (M.length !== 4 || M.some((row) => row.length !== 4)) throw new KinematicsError("Matrix ist nicht 4×4");
  if (!M.every((row) => row.every(Number.isFinite))) throw new KinematicsError("Matrix enthält keine Zahl");
  const R: Mat3 = [[M[0]![0]!, M[0]![1]!, M[0]![2]!], [M[1]![0]!, M[1]![1]!, M[1]![2]!], [M[2]![0]!, M[2]![1]!, M[2]![2]!]];
  const p: Vec3 = [M[0]![3]!, M[1]![3]!, M[2]![3]!];
  return { value: { R, p }, steps: [vStep("G-13-Z", "Zerlegung in R und p", "R = (t_ij), i, j = 1…3; p = (t_14, t_24, t_34)",
    `${tName(a, b)}: R = ${r3(R)}, p`, p, `${LP} Def. 3.13`)], notes: [] };
}

/** G-13-P: Pose (x, y, z, A, B, C) → T mit R = R_z(A)·R_y(B)·R_x(C) nach G-02. */
export function fromPose(pose: Pose, a = "a", b = "b"): Calc<Transform> {
  if (!finite(pose.x, pose.y, pose.z)) throw new KinematicsError("Position x, y, z enthält keine Zahl");
  const r = fromZYX({ A: pose.A, B: pose.B, C: pose.C });
  const T: Transform = { R: r.value, p: [pose.x, pose.y, pose.z] };
  return { value: T, steps: [...r.steps, tStep("G-13-P", "Homogene Transformation aus Pose (x, y, z, A, B, C)",
    "T = [R_z(A)·R_y(B)·R_x(C)  (x, y, z)ᵀ; 0 0 0 1], R nach G-02",
    `${tName(a, b)}: (x, y, z) = ${vmm(T.p)}, (A, B, C) = (${dg(pose.A)}; ${dg(pose.B)}; ${dg(pose.C)})`, T,
    `${LP} Gl. (3.62) mit R aus Gl. (B.8); ${WK} Gl. (2.12), (2.21); Pose wie KUKA-Frame (X, Y, Z, A, B, C)`)], notes: [] };
}

/** G-13-X: T → Pose; Winkel nach G-06 (Kardansperre: A = 0). */
export function toPose(T: Transform, a = "a", b = "b"): Calc<Pose> {
  const e = toZYX(T.R);
  const P: Pose = { x: T.p[0], y: T.p[1], z: T.p[2], A: e.value.A, B: e.value.B, C: e.value.C };
  const st: CalcStep = {
    id: "G-13-X", title: "Pose aus homogener Transformation",
    formula: "(x, y, z) = p; (A, B, C) aus R nach G-06; Ergebnis (x, y, z in m; A, B, C in rad)",
    subst: `${tName(a, b)}: (x, y, z) = ${vmm(T.p)}, (A, B, C) = (${dg(P.A)}; ${dg(P.B)}; ${dg(P.C)})`,
    value: norm(T.p), unit: "m", ref: `${LP} Def. 3.13 und Anhang B.1.1; ${WK} Gl. (2.22)`, matrix: [[P.x, P.y, P.z, P.A, P.B, P.C]],
  };
  return { value: P, steps: [...e.steps, st], notes: e.notes };
}

// ---------------------------------------------------------------- G-14 Prüfung
export interface TransformCheck { orthErr: number; det: number; rowErr: number; valid: boolean }
/** G-14: Prüfung einer 4×4-Matrix: R nach G-10-O und G-10-D, letzte Zeile ‖(t_41, t_42, t_43, t_44) − (0, 0, 0, 1)‖ ≤ 10⁻⁹. */
export function checkTransform(M: Mat4, a = "a", b = "b"): Calc<TransformCheck> {
  const s = splitMatrix(M, a, b);
  const rc = checkRotation(s.value.R);
  const last = M[3]!;
  const rowErr = Math.hypot(last[0]!, last[1]!, last[2]!, last[3]! - 1);
  const rowOk = rowErr <= T_TOL;
  const valid = rc.value.valid && rowOk;
  const st: CalcStep = {
    id: "G-14", title: "Letzte Zeile der homogenen Transformation",
    formula: "e_4 = ‖(t_41, t_42, t_43, t_44) − (0, 0, 0, 1)‖, gültig für e_4 ≤ 10⁻⁹ (zusammen mit G-10-O, G-10-D)",
    subst: `${tName(a, b)}: e_4 = ${ne(rowErr)} (${rowOk ? "erfüllt" : "verletzt"})`, value: rowErr, unit: "1", ref: `${LP} Def. 3.13, Gl. (3.62)`,
  };
  const notes = [...rc.notes];
  if (!rowOk) notes.push(`${tName(a, b)}: letzte Zeile ist nicht (0, 0, 0, 1).`);
  return { value: { orthErr: rc.value.orthErr, det: rc.value.det, rowErr, valid }, steps: [...s.steps, ...rc.steps, st], notes };
}

// ---------------------------------------------------------------- G-15 Inverse
/** G-15: T_ba = T_ab⁻¹ = [R_abᵀ  −R_abᵀ·p_ab; 0 1] mit Kontrolle ‖T·T⁻¹ − I‖_F (G-15-K). */
export function invertT(T: Transform, a = "a", b = "b"): Calc<Transform> {
  const Rt = transpose(T.R);
  const q = mulVec(Rt, T.p);
  const p: Vec3 = [-q[0], -q[1], -q[2]];
  const inv: Transform = { R: Rt, p };
  const e = identityErr(composeRaw(T, inv));
  return {
    value: inv,
    steps: [
      vStep("G-15-P", "Ursprung von {a} in {b}", "p_ba = −R_abᵀ·p_ab", `${vName("p", b, a)} = −${tName(a, b, "R")}ᵀ·${vmm(T.p)}`, p, `${WK} Gl. (2.16); ${LP} Gl. (3.64)`),
      tStep("G-15", "Inverse der homogenen Transformation", "T_ba = T_ab⁻¹ = [R_abᵀ  −R_abᵀ·p_ab; 0 0 0 1]", `${tName(b, a)} = ${tName(a, b)}⁻¹`, inv, `${LP} Prop. 3.15, Gl. (3.64); ${WK} Gl. (2.16)`),
      { id: "G-15-K", title: "Kontrolle der Inversen", formula: "e = ‖T·T⁻¹ − I‖_F (4×4), Rundungsfehler im Bereich 10⁻¹⁵", subst: `e = ‖${tName(a, b)}·${tName(b, a)} − I‖_F = ${fmt(e, 3)}`,
        value: e, unit: "1", ref: `${LP} Prop. 3.15` },
    ],
    notes: [],
  };
}

/** Produkt ohne Rechenweg (gleiche Formel wie G-16-R und G-16-P). */
function composeRaw(A: Transform, B: Transform): Transform {
  const p = mulVec(A.R, B.p);
  return { R: mul(A.R, B.R), p: [p[0] + A.p[0], p[1] + A.p[1], p[2] + A.p[2]] };
}
/** ‖T − I‖_F über alle 16 Elemente (letzte Zeile ist bei (R, p) exakt). */
function identityErr(T: Transform): number {
  let s = 0;
  for (const i of [0, 1, 2] as const) { for (const j of [0, 1, 2] as const) { const d = T.R[i][j] - (i === j ? 1 : 0); s += d * d; } s += T.p[i] * T.p[i]; }
  return Math.sqrt(s);
}

// ---------------------------------------------------------------- G-16 Verkettung
/**
 * G-16: T_ac = T_ab·T_bc. Mit detail die Teilschritte G-16-R (R_ac = R_ab·R_bc) und G-16-P (p_ac = R_ab·p_bc + p_ab).
 */
export function composeT(Tab: Transform, Tbc: Transform, a = "a", b = "b", c = "c", detail = true): Calc<Transform> {
  const T = composeRaw(Tab, Tbc);
  const ref = `${LP} S. 78 (T_ab·T_bc = T_ac), Prop. 3.16; ${WK} Gl. (2.17)`;
  const steps: CalcStep[] = [];
  if (detail) {
    steps.push({ id: "G-16-R", title: "Orientierung der Verkettung", formula: "R_ac = R_ab·R_bc", subst: `${tName(a, c, "R")} = ${tName(a, b, "R")}·${tName(b, c, "R")} = ${r3(T.R)}`,
      value: T.R[0][0] + T.R[1][1] + T.R[2][2], unit: "1", ref: `${LP} Gl. (3.62) ausmultipliziert`, matrix: T.R.map((r) => [...r]) });
    steps.push(vStep("G-16-P", "Ursprung der Verkettung", "p_ac = R_ab·p_bc + p_ab", `${vName("p", a, c)} = ${tName(a, b, "R")}·${vmm(Tbc.p)} + ${vmm(Tab.p)}`, T.p, `${LP} Gl. (3.62) ausmultipliziert`));
  }
  steps.push(tStep("G-16", "Verkettung zweier Transformationen", "T_ac = T_ab·T_bc", `${tName(a, c)} = ${tName(a, b)}·${tName(b, c)}`, T, ref));
  return { value: T, steps, notes: [] };
}

/**
 * G-16-N: Kette T_0n = T_01·T_12·…·T_(n−1)n. names hat n + 1 Einträge (Rahmen der Kette). Zwischenprodukte als G-16
 * (ohne Teilschritte), Ergebnis als G-16-N; partial[k] = T_0k für k = 0 … n (partial[0] = I).
 */
export function chainT(links: readonly Transform[], names: readonly string[]): Calc<Transform> & { partial: Transform[] } {
  if (names.length !== links.length + 1) throw new KinematicsError("Kette: Anzahl der Namen passt nicht zu den Gliedern");
  const partial: Transform[] = [IDENTITY];
  const steps: CalcStep[] = [];
  let cur = IDENTITY;
  links.forEach((L, k) => {
    if (k === 0) cur = L;
    else {
      steps.push(...composeT(cur, L, names[0]!, names[k]!, names[k + 1]!, false).steps);
      cur = composeRaw(cur, L);
    }
    partial.push(cur);
  });
  const n = links.length, first = names[0]!, last = names[n]!;
  const prod = n === 0 ? "I" : links.map((_, k) => tName(names[k]!, names[k + 1]!)).join("·");
  steps.push(tStep("G-16-N", "Kette aus n Transformationen", "T_0n = T_01·T_12·…·T_(n−1)n (Zwischenprodukte T_0k nacheinander)",
    `${tName(first, last)} = ${prod}`, cur, `${WK} Gl. (2.17); ${LP} S. 78, Bsp. 3.19`));
  return { value: cur, steps, notes: [], partial };
}

// ---------------------------------------------------------------- G-17, G-18 Punkt und Richtung
/** G-17: Punkt (Ortsvektor, 4. Komponente 1): x_a = R_ab·x_b + p_ab. */
export function transformPoint(T: Transform, x: Vec3, a = "a", b = "b"): Calc<Vec3> {
  checkVec(x, "Punkt");
  const y = composeRaw(T, { R: I3, p: x }).p;
  return { value: y, steps: [vStep("G-17", "Punkt in {a} ausdrücken (Ortsvektor)", "[x_a; 1] = T_ab·[x_b; 1], also x_a = R_ab·x_b + p_ab",
    `${vName("x", a)} = ${tName(a, b, "R")}·${vmm(x)} + ${vmm(T.p)}`, y, `${LP} Gl. (3.65); ${WK} Gl. (2.14)`)], notes: [] };
}
/** G-18: Richtung (freier Vektor, 4. Komponente 0): v_a = R_ab·v_b; die Translation wirkt nicht. */
export function transformDirection(T: Transform, v: Vec3, a = "a", b = "b"): Calc<Vec3> {
  checkVec(v, "Richtung");
  const y = mulVec(T.R, v);
  return { value: y, steps: [vStep("G-18", "Richtung in {a} ausdrücken (freier Vektor)", "[v_a; 0] = T_ab·[v_b; 0], also v_a = R_ab·v_b",
    `${vName("v", a)} = ${tName(a, b, "R")}·${vmm(v)}`, y, `${WK} Gl. (2.13); ${LP} S. 77 f.`)], notes: [] };
}

// ---------------------------------------------------------------- G-19 Operatoren, Verschieben
/** G-19-T: Translationsoperator Trans(p) = [I p; 0 1]. */
export function transOp(p: Vec3): Calc<Transform> {
  checkVec(p, "Verschiebung");
  const T: Transform = { R: I3, p };
  return { value: T, steps: [tStep("G-19-T", "Verschiebeoperator Trans(p)", "Trans(p) = [I p; 0 0 0 1]", `Trans(${vmm(p)})`, T, `${LP} S. 79`)], notes: [] };
}
/** G-19-R: Drehoperator Rot(ω̂, θ) = [R 0; 0 1] mit R nach G-04. */
export function rotOp(aa: AxisAngle): Calc<Transform> {
  const r = fromAxisAngle(aa);
  const T: Transform = { R: r.value, p: [0, 0, 0] };
  return { value: T, steps: [...r.steps, tStep("G-19-R", "Drehoperator Rot(ω̂, θ)", "Rot(ω̂, θ) = [R 0; 0 0 0 1], R nach G-04",
    `Rot(ω̂, ${dg(aa.theta)})`, T, `${LP} S. 79`)], notes: r.notes };
}

/** Elementare Achse als Einheitsvektor (Bedienung, keine Formel-ID). */
export const AXIS_UNIT: Record<AxisName, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

/**
 * G-19-F, G-19-M: Rahmen {b} verschieben mit T_op = Trans(p)·Rot(ω̂, θ) (G-19-T, G-19-R, G-16):
 * fest (in {s}): T_sb′ = T_op·T_sb; mitgedreht (in {b}): T_sb″ = T_sb·T_op.
 */
export function displace(Tsb: Transform, op: { axis: Vec3; theta: number; p: Vec3 }, mode: "fest" | "mitgedreht", s = "s", b = "b"): Calc<Transform> & { op: Transform } {
  const t = transOp(op.p), r = rotOp({ axis: op.axis, theta: op.theta });
  const o = composeT(t.value, r.value, "", "", "", false);
  const opStep: CalcStep = { ...o.steps[0]!, subst: `T_op = Trans(p)·Rot(ω̂, θ) = ${tStr(o.value)}` };
  const steps = [...t.steps, ...r.steps, opStep];
  if (mode === "fest") {
    const T = composeRaw(o.value, Tsb);
    steps.push(tStep("G-19-F", "Verschieben im festen Rahmen (links multiplizieren)", "T_sb′ = T_op·T_sb: erst drehen um ω̂ in {s}, dann verschieben um p in {s}",
      `${tName(s, b + "′")} = T_op·${tName(s, b)}`, T, `${LP} Gl. (3.66), Abb. 3.15 links`));
    return { value: T, steps, notes: r.notes, op: o.value };
  }
  const T = composeRaw(Tsb, o.value);
  steps.push(tStep("G-19-M", "Verschieben im mitgedrehten Rahmen (rechts multiplizieren)", "T_sb″ = T_sb·T_op: erst verschieben um p in {b}, dann drehen um ω̂ von {b}",
    `${tName(s, b + "″")} = ${tName(s, b)}·T_op`, T, `${LP} Gl. (3.67), Abb. 3.15 rechts`));
  return { value: T, steps, notes: r.notes, op: o.value };
}

/** Lineare Algebra ohne Rechenweg für Darstellung und Tests (gleiche Formeln wie G-15, G-16, G-17). */
export const se3 = {
  compose: composeRaw,
  invert: (T: Transform): Transform => { const Rt = transpose(T.R); const q = mulVec(Rt, T.p); return { R: Rt, p: [-q[0], -q[1], -q[2]] }; },
  point: (T: Transform, x: Vec3): Vec3 => composeRaw(T, { R: I3, p: x }).p,
  identityErr,
  maxAbsDiff: (A: Transform, B: Transform): number => {
    let m = 0;
    for (const i of [0, 1, 2] as const) { for (const j of [0, 1, 2] as const) m = Math.max(m, Math.abs(A.R[i][j] - B.R[i][j])); m = Math.max(m, Math.abs(A.p[i] - B.p[i])); }
    return m;
  },
};
