/**
 * Denavit-Hartenberg-Parameter (Modul kinematik, Blatt K3, ab 0.16.0): Gliedmatrizen klassisch und modifiziert,
 * Gelenkwerte für Dreh- und Schubgelenke, Gelenkgrenzen, Prüfung der Gelenkkette, Umrechnung zwischen den
 * Konventionen. Rechenschritte G-21, G-22, G-23, G-26, G-27; die Vorwärtskinematik (G-24, G-25) steht in forward.ts.
 * Konzept handhabung/konzept_k3_dh_vorwaertskinematik.md (K3-E1 bis E9 freigegeben 08.11.2026, Version 0.16.0).
 *
 * Quellen (eigene Umsetzung):
 * - Weber, Koch: Industrieroboter, Hanser, Kap. 2.2 (S. 39 bis 47): Regeln 2.2.2, Gl. (2.33), (2.34), (2.35);
 *   klassische Konvention A_i = Rot_z(θ_i)·Trans_z(d_i)·Trans_x(a_i)·Rot_x(α_i), Rahmen {i} auf Gelenkachse i+1.
 * - Lynch, Park: Modern Robotics, Cambridge 2017, Anhang C (S. 506 bis 515): modifizierte Konvention (Craig)
 *   A_i = Rot_x(α_{i−1})·Trans_x(a_{i−1})·Trans_z(d_i)·Rot_z(φ_i), Rahmen {i} auf Gelenkachse i.
 *
 * Datenmodell: eine Zeile je Gelenk mit den Feldern theta, d, a, alpha. Klassisch bedeuten sie (θ_i, d_i, a_i, α_i),
 * modifiziert (θ_i, d_i, a_{i−1}, α_{i−1}). Beim Drehgelenk ist theta der Offset θ_i,0 (θ_i = q_i + θ_i,0), beim
 * Schubgelenk ist d der Offset d_i,0 (d_i = q_i + d_i,0). Einheiten im Kern m und rad, ohne Normierung der Winkel;
 * a, d, α, θ sind vorzeichenbehaftet. Der Rechenweg zeigt Winkel in Grad mit rad in Klammern und Längen in mm.
 */
import { fmt } from "../format";
import type { CalcStep } from "../trace";
import { deg, rotX, rotZ, mul, type Mat3 } from "./so3";
import { KinematicsError, type Calc } from "./orientation";
import { IDENTITY, fromPose, se3, tName, tStr, toMat4, toPose, type Pose, type Transform } from "./se3";

export type DhConvention = "klassisch" | "modifiziert";
export type JointType = "R" | "P";

/** Eine Zeile der DH-Tabelle (m, rad). Bedeutung von a und alpha je Konvention, siehe Kopf der Datei. */
export interface DhJoint {
  type: JointType;
  /** Drehgelenk: Offset θ_i,0; Schubgelenk: fester Winkel θ_i. */
  theta: number;
  /** Schubgelenk: Offset d_i,0; Drehgelenk: feste Länge d_i. */
  d: number;
  /** klassisch a_i, modifiziert a_{i−1} */
  a: number;
  /** klassisch α_i, modifiziert α_{i−1} */
  alpha: number;
  /** Grenzen der Gelenkvariable q_i (rad bzw. m), q_min < q_max. */
  qMin: number;
  qMax: number;
  /** Achsbezeichnung, z. B. "A1" (nur Anzeige). */
  label?: string;
}

/** Roboter als offene Kette mit DH-Tabelle, optional Basis T_W0 und Werkzeug T_nt als Pose (m, rad). */
export interface Robot {
  id: string;
  name: string;
  convention: DhConvention;
  joints: readonly DhJoint[];
  base?: Pose | null;
  tool?: Pose | null;
  /** Stellung der Quelle (Zeichenstellung bzw. Beispielstellung), q in rad bzw. m. */
  qSource?: readonly number[];
  /** Fundstelle bzw. Kennzeichnung eigener Fälle. */
  source: string;
}

/** Höchstzahl der Gelenke (K3-Konzept Abschn. 2). */
export const MAX_JOINTS = 8;
/** Toleranz der Grenzprüfung: q darf die Grenze um Rundungsreste überschreiten. */
export const LIMIT_TOL = 1e-12;

const SIG = 6;
const LP = "Lynch/Park";
const WK = "Weber/Koch";
const ne = (x: number): string => fmt(Math.abs(x) < 5e-13 ? 0 : x, SIG);
/** Winkel mit Einheit: Grad und rad (Vormerkung uebergabe_v3 5.6, ERR-04). */
export const angTxt = (a: number): string => `${ne(deg(a))}° (${ne(a)} rad)`;
/** Länge in mm. */
export const lenTxt = (x: number): string => `${ne(x * 1e3)} mm`;
/** Gelenkvariable mit Einheit je Typ. */
export const qTxt = (type: JointType, q: number): string => (type === "R" ? angTxt(q) : lenTxt(q));
const r3 = (R: Mat3): string => `[${R.map((r) => r.map(ne).join("  ")).join("; ")}]`;
const finite = (...x: number[]): boolean => x.every(Number.isFinite);

/** Kennzeichen der Parameter je Konvention (Index als Text, für Rechenweg und Oberfläche). */
export function dhSymbols(conv: DhConvention, i: number): { theta: string; d: string; a: string; alpha: string } {
  return conv === "klassisch"
    ? { theta: `θ_${i}`, d: `d_${i}`, a: `a_${i}`, alpha: `α_${i}` }
    : { theta: `θ_${i}`, d: `d_${i}`, a: `a_${i - 1}`, alpha: `α_${i - 1}` };
}

// ---------------------------------------------------------------- G-26 Prüfung der Gelenkkette
/** G-26: Prüfung der Gelenkkette: 1 ≤ n ≤ 8, Typ R oder P, Konvention gesetzt, alle Werte endlich, q_min < q_max. */
export function checkChain(robot: Robot): Calc<{ n: number }> {
  const conv = robot.convention;
  if (conv !== "klassisch" && conv !== "modifiziert") throw new KinematicsError("DH-Konvention fehlt (klassisch oder modifiziert)");
  const n = robot.joints.length;
  if (n < 1 || n > MAX_JOINTS) throw new KinematicsError(`Gelenkkette: ${n} Gelenke, erlaubt sind 1 bis ${MAX_JOINTS}`);
  robot.joints.forEach((j, k) => {
    const i = k + 1;
    if (j.type !== "R" && j.type !== "P") throw new KinematicsError(`Gelenk ${i}: Typ „${String(j.type)}“ unbekannt (Dreh R oder Schub P)`);
    if (!finite(j.theta, j.d, j.a, j.alpha)) throw new KinematicsError(`Gelenk ${i}: DH-Parameter enthält keine Zahl`);
    if (!finite(j.qMin, j.qMax)) throw new KinematicsError(`Gelenk ${i}: Grenze enthält keine Zahl`);
    if (!(j.qMin < j.qMax)) throw new KinematicsError(`Gelenk ${i}: untere Grenze muss kleiner als obere Grenze sein`);
  });
  for (const [what, p] of [["Basis", robot.base], ["Werkzeug", robot.tool]] as const) {
    if (p && !finite(p.x, p.y, p.z, p.A, p.B, p.C)) throw new KinematicsError(`${what}: Pose enthält keine Zahl`);
  }
  const types = robot.joints.map((j) => j.type).join("");
  const st: CalcStep = {
    id: "G-26", title: "Prüfung der Gelenkkette",
    formula: "1 ≤ n ≤ 8; Typ je Gelenk R (Dreh) oder P (Schub); Konvention klassisch oder modifiziert; alle Werte endlich; q_min < q_max",
    subst: `n = ${n}, Typen ${types}, Konvention ${conv}: erfüllt`, value: n, unit: "1",
    ref: `${WK} Kap. 2.2.2 (S. 40 bis 42); ${LP} Anhang C.1`,
  };
  return { value: { n }, steps: [st], notes: [] };
}

// ---------------------------------------------------------------- G-23 Gelenkwerte und Grenzen
export interface JointValue { theta: number; d: number }
/** G-23-R, G-23-P: DH-Parameter des Gelenks i aus der Gelenkvariable q_i. */
export function jointValue(j: DhJoint, q: number, i: number): Calc<JointValue> {
  if (!finite(q)) throw new KinematicsError(`Gelenk ${i}: Gelenkvariable q_${i} ist keine Zahl`);
  if (j.type === "R") {
    const theta = q + j.theta;
    return { value: { theta, d: j.d }, steps: [{
      id: "G-23-R", title: "Gelenkwert Drehgelenk", formula: "θ_i = q_i + θ_i,0 (d_i fest)",
      subst: `θ_${i} = ${angTxt(q)} + ${angTxt(j.theta)} = ${angTxt(theta)}`, value: theta, unit: "rad",
      ref: `${WK} S. 42 (θ_i Gelenkkoordinate beim Drehgelenk); ${LP} Bsp. C.1 (Offset θ₂ − 90°)`,
    }], notes: [] };
  }
  const d = q + j.d;
  return { value: { theta: j.theta, d }, steps: [{
    id: "G-23-P", title: "Gelenkwert Schubgelenk", formula: "d_i = q_i + d_i,0 (θ_i fest)",
    subst: `d_${i} = ${lenTxt(q)} + ${lenTxt(j.d)} = ${lenTxt(d)}`, value: d, unit: "m",
    ref: `${WK} S. 42 (Schublänge d_i Gelenkkoordinate beim Schubgelenk); ${LP} Anhang C.1, Abb. C.2`,
  }], notes: [] };
}

/** G-23-G: Gelenkgrenzen q_min ≤ q_i ≤ q_max; Verletzungen werden gemeldet, das Ergebnis bleibt (Warnung). */
export function checkLimits(robot: Robot, q: readonly number[]): Calc<{ violated: number[] }> {
  const violated: number[] = [];
  const parts = robot.joints.map((j, k) => {
    const x = q[k]!;
    const ok = x >= j.qMin - LIMIT_TOL && x <= j.qMax + LIMIT_TOL;
    if (!ok) violated.push(k + 1);
    return `q_${k + 1} = ${qTxt(j.type, x)} in [${qTxt(j.type, j.qMin)}; ${qTxt(j.type, j.qMax)}]${ok ? "" : " verletzt"}`;
  });
  const st: CalcStep = {
    id: "G-23-G", title: "Gelenkgrenzen", formula: "q_min,i ≤ q_i ≤ q_max,i für alle Gelenke; sonst Warnung, Ergebnis bleibt",
    subst: `${parts.join("; ")}: ${violated.length ? `${violated.length} verletzt` : "erfüllt"}`, value: violated.length, unit: "1",
    ref: "eigene Festlegung (Konzept K3, Abschn. 1)",
  };
  return { value: { violated }, steps: [st], notes: [] };
}

// ---------------------------------------------------------------- G-21, G-22 Gliedmatrizen
/** Gliedmatrix ohne Rechenweg (gleiche Formeln wie G-21 bzw. G-22, geschlossen). */
export function linkRaw(conv: DhConvention, theta: number, d: number, a: number, alpha: number): Transform {
  const ct = Math.cos(theta), st = Math.sin(theta), ca = Math.cos(alpha), sa = Math.sin(alpha);
  if (conv === "klassisch") {
    return { R: [[ct, -st * ca, st * sa], [st, ct * ca, -ct * sa], [0, sa, ca]], p: [a * ct, a * st, d] };
  }
  return { R: [[ct, -st, 0], [st * ca, ct * ca, -sa], [st * sa, ct * sa, ca]], p: [a, -d * sa, d * ca] };
}

/**
 * G-21 bzw. G-22 mit Teilschritt G-21-R bzw. G-22-R: Gliedmatrix A_i = T_(i−1)i aus (θ_i, d_i) nach G-23 und den festen
 * Parametern a, α der Zeile. names: Rahmen davor und danach (Anzeige).
 */
export function linkMatrix(conv: DhConvention, j: DhJoint, v: JointValue, i: number, from = String(i - 1), to = String(i)): Calc<Transform> {
  const { theta, d } = v;
  const T = linkRaw(conv, theta, d, j.a, j.alpha);
  const s = dhSymbols(conv, i);
  const vals = `${s.theta} = ${angTxt(theta)}, ${s.d} = ${lenTxt(d)}, ${s.a} = ${lenTxt(j.a)}, ${s.alpha} = ${angTxt(j.alpha)}`;
  const A = tName(from, to);
  if (conv === "klassisch") {
    return { value: T, steps: [
      { id: "G-21-R", title: "Rotation eines Glieds (DH klassisch)", formula: "R = Rot_z(θ_i)·Rot_x(α_i) = [cos θ −sin θ cos α  sin θ sin α; sin θ  cos θ cos α  −cos θ sin α; 0  sin α  cos α]",
        subst: `${tName(from, to, "R")} mit ${s.theta} = ${angTxt(theta)}, ${s.alpha} = ${angTxt(j.alpha)} = ${r3(T.R)}`, value: T.R[0][0] + T.R[1][1] + T.R[2][2], unit: "1",
        ref: `${WK} Gl. (2.33)`, matrix: T.R.map((r) => [...r]) },
      { id: "G-21", title: "Gliedmatrix (DH klassisch)",
        formula: "A_i = Rot_z(θ_i)·Trans_z(d_i)·Trans_x(a_i)·Rot_x(α_i) = [R  (a_i cos θ_i, a_i sin θ_i, d_i)ᵀ; 0 0 0 1]",
        subst: `${A} mit ${vals} = ${tStr(T)}`, value: Math.hypot(...T.p), unit: "m", ref: `${WK} Gl. (2.34), Kap. 2.2.2`, matrix: toMat4(T) },
    ], notes: [] };
  }
  return { value: T, steps: [
    { id: "G-22-R", title: "Rotation eines Glieds (DH modifiziert)", formula: "R = Rot_x(α_{i−1})·Rot_z(θ_i) = [cos θ  −sin θ  0; sin θ cos α  cos θ cos α  −sin α; sin θ sin α  cos θ sin α  cos α]",
      subst: `${tName(from, to, "R")} mit ${s.alpha} = ${angTxt(j.alpha)}, ${s.theta} = ${angTxt(theta)} = ${r3(T.R)}`, value: T.R[0][0] + T.R[1][1] + T.R[2][2], unit: "1",
      ref: `${LP} Anhang C.3, S. 510`, matrix: T.R.map((r) => [...r]) },
    { id: "G-22", title: "Gliedmatrix (DH modifiziert, Craig)",
      formula: "A_i = Rot_x(α_{i−1})·Trans_x(a_{i−1})·Trans_z(d_i)·Rot_z(θ_i) = [R  (a_{i−1}, −d_i sin α_{i−1}, d_i cos α_{i−1})ᵀ; 0 0 0 1]",
      subst: `${A} mit ${vals} = ${tStr(T)}`, value: Math.hypot(...T.p), unit: "m", ref: `${LP} Anhang C.3, S. 510, Gl. (C.2) bis (C.5)`, matrix: toMat4(T) },
  ], notes: [] };
}

/** Die vier Teiltransformationen eines Glieds in Reihenfolge der Konvention (Lernhilfe, gleiche Formeln wie G-19-T, G-19-R). */
export interface DhSubStep { label: string; kind: "rotz" | "transz" | "transx" | "rotx"; value: number; T: Transform }
export function linkFactors(conv: DhConvention, theta: number, d: number, a: number, alpha: number, i: number): DhSubStep[] {
  const s = dhSymbols(conv, i);
  const rz: DhSubStep = { label: `Rot_z(${s.theta} = ${ne(deg(theta))}°)`, kind: "rotz", value: theta, T: { R: rotZ(theta), p: [0, 0, 0] } };
  const tz: DhSubStep = { label: `Trans_z(${s.d} = ${lenTxt(d)})`, kind: "transz", value: d, T: { R: rotZ(0), p: [0, 0, d] } };
  const tx: DhSubStep = { label: `Trans_x(${s.a} = ${lenTxt(a)})`, kind: "transx", value: a, T: { R: rotZ(0), p: [a, 0, 0] } };
  const rx: DhSubStep = { label: `Rot_x(${s.alpha} = ${ne(deg(alpha))}°)`, kind: "rotx", value: alpha, T: { R: rotX(alpha), p: [0, 0, 0] } };
  return conv === "klassisch" ? [rz, tz, tx, rx] : [rx, tx, tz, rz];
}

// ---------------------------------------------------------------- G-27 Umrechnung der Konventionen
/** Elementarfaktoren für Basis- und Werkzeuganteile der Umrechnung (ohne Rechenweg). */
const transX = (a: number): Transform => ({ R: rotZ(0), p: [a, 0, 0] });
const rotXT = (al: number): Transform => ({ R: rotX(al), p: [0, 0, 0] });
const poseT = (p: Pose | null | undefined): Transform => (p ? fromPose(p).value : IDENTITY);
const isIdentity = (T: Transform): boolean => se3.identityErr(T) === 0;

/** Kette T_W0·A_1(q)·…·A_n(q)·T_nt ohne Rechenweg (für Umrechnung, Kontrolle, Tests). */
export function forwardRaw(robot: Robot, q: readonly number[]): Transform {
  let T = poseT(robot.base);
  robot.joints.forEach((j, k) => {
    const x = q[k] ?? 0;
    const th = j.type === "R" ? x + j.theta : j.theta, d = j.type === "P" ? x + j.d : j.d;
    T = se3.compose(T, linkRaw(robot.convention, th, d, j.a, j.alpha));
  });
  return se3.compose(T, poseT(robot.tool));
}

/** Tabelle als Matrix für den Rechenweg: je Zeile (θ bzw. θ_0, d bzw. d_0, a, α) in m und rad. */
const tableRows = (r: Robot): number[][] => r.joints.map((j) => [j.theta, j.d, j.a, j.alpha]);

/**
 * G-27-KM, G-27-MK: DH-Tabelle in die andere Konvention umrechnen (Umgruppieren der Faktoren, Rot_z mit Trans_z
 * und Trans_x mit Rot_x vertauschbar). Klassisch → modifiziert: Zeile i = (α_{i−1}, a_{i−1}, d_i, θ_i) mit α₀ = a₀ = 0,
 * Trans_x(a_n)·Rot_x(α_n) wandert ins Werkzeug. Modifiziert → klassisch: Rot_x(α₀)·Trans_x(a₀) wandert in die Basis,
 * Zeile i = (θ_i, d_i, a_i, α_i) mit a_i, α_i aus Zeile i+1, letzte Zeile a = α = 0. Kontrolle: T_Wt an q gleich.
 */
export function convertDh(robot: Robot, q?: readonly number[]): Calc<Robot> & { dev: number } {
  checkChain(robot);
  const J = robot.joints, n = J.length;
  const qq = q ?? robot.qSource ?? J.map(() => 0);
  let out: Robot;
  let id: "G-27-KM" | "G-27-MK";
  let formula: string, subst: string;
  if (robot.convention === "klassisch") {
    id = "G-27-KM";
    const joints: DhJoint[] = J.map((j, k) => ({ ...j, a: k === 0 ? 0 : J[k - 1]!.a, alpha: k === 0 ? 0 : J[k - 1]!.alpha }));
    const extra = se3.compose(transX(J[n - 1]!.a), rotXT(J[n - 1]!.alpha));
    const tool = se3.compose(extra, poseT(robot.tool));
    out = { ...robot, id: `${robot.id}-mod`, convention: "modifiziert", joints, tool: isIdentity(tool) ? null : toPose(tool).value };
    formula = "modifiziert: Zeile i = (α_{i−1}, a_{i−1}, d_i, θ_i) mit α_0 = a_0 = 0; T_nt′ = Trans_x(a_n)·Rot_x(α_n)·T_nt";
    subst = `n = ${n}; Trans_x(${lenTxt(J[n - 1]!.a)})·Rot_x(${angTxt(J[n - 1]!.alpha)}) ins Werkzeug`;
  } else {
    id = "G-27-MK";
    const joints: DhJoint[] = J.map((j, k) => ({ ...j, a: k + 1 < n ? J[k + 1]!.a : 0, alpha: k + 1 < n ? J[k + 1]!.alpha : 0 }));
    const base = se3.compose(poseT(robot.base), se3.compose(rotXT(J[0]!.alpha), transX(J[0]!.a)));
    out = { ...robot, id: `${robot.id}-kl`, convention: "klassisch", joints, base: isIdentity(base) ? null : toPose(base).value };
    formula = "klassisch: Zeile i = (θ_i, d_i, a_i, α_i) mit a_i, α_i aus Zeile i+1, a_n = α_n = 0; T_W0′ = T_W0·Rot_x(α_0)·Trans_x(a_0)";
    subst = `n = ${n}; Rot_x(${angTxt(J[0]!.alpha)})·Trans_x(${lenTxt(J[0]!.a)}) in die Basis`;
  }
  const dev = se3.maxAbsDiff(forwardRaw(robot, qq), forwardRaw(out, qq));
  const st: CalcStep = {
    id, title: id === "G-27-KM" ? "Umrechnung klassisch → modifiziert" : "Umrechnung modifiziert → klassisch",
    formula: `${formula}; Kontrolle e = max |T_Wt − T_Wt′| an derselben Stellung q`,
    subst: `${subst}; Tabelle (θ bzw. θ_0, d bzw. d_0, a, α) in m und rad; e = ${fmt(dev, 3)}`, value: dev, unit: "m",
    ref: `${WK} Gl. (2.34); ${LP} Anhang C.3 (Reihenfolge der Faktoren in Paaren vertauschbar, S. 511)`, matrix: tableRows(out),
  };
  return { value: out, steps: [st], notes: [], dev };
}

/** Rotationsanteil ohne Rechenweg (Tests, Oberfläche). */
export const dhRot = (conv: DhConvention, theta: number, alpha: number): Mat3 =>
  conv === "klassisch" ? mul(rotZ(theta), rotX(alpha)) : mul(rotX(alpha), rotZ(theta));
