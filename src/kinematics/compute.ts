/**
 * Blatt K1 Orientierung (Modul kinematik): eine Eingabe in einer Darstellung, alle anderen Darstellungen live,
 * Prüfung der Matrix, optional Vektor drehen und Zusatzdrehung um feste oder mitgedrehte Achse.
 * Rechenweg nach Gruppen orientierung, umrechnung, pruefung (TRACE_GROUPS.kinematik).
 * Einheiten: rad, m. Anzeige in Grad und mm übernimmt die Oberfläche (deg, rad aus so3.ts).
 */
import type { CalcStep, Trace, TraceGroupOf } from "../trace";
import { I3, mul, rotAxis, deg, type AxisName, type Mat3, type Vec3 } from "./so3";
import {
  KinematicsError, checkRotation, fromAxisAngle, fromQuaternion, fromZYX, fromZYZ, inverse, rotateBy, rotateVector, toAxisAngle, toQuaternion, toZYX, toZYZ,
  type AxisAngle, type Calc, type EulerZYX, type EulerZYZ, type Quaternion, type RotationCheck,
} from "./orientation";

export type OrientationRep = "zyx" | "zyz" | "axis" | "quat" | "matrix";
export type KinGroup = TraceGroupOf<"kinematik">;

export interface OrientationInput {
  rep: OrientationRep;
  zyx?: EulerZYX;
  zyz?: EulerZYZ;
  axis?: AxisAngle;
  quat?: Quaternion;
  matrix?: Mat3;
  /** Vektor in {b} in m (optional, G-12). */
  pb?: Vec3 | null;
  /** Zusatzdrehung um eine Achse des festen {a} oder des mitgedrehten {b} (optional, G-11-F bzw. G-11-M). */
  extra?: { frame: "fest" | "mitgedreht"; axis: AxisName; angle: number } | null;
}

export interface OrientationResult {
  errors: string[];
  /** Hinweise aus den Rechenschritten (Kardansperre, Normierung, Sonderfälle). */
  notes: string[];
  /** Warnungen ohne Rechenfehler (Kardansperre nah). */
  warnings: string[];
  R: Mat3 | null;
  check: RotationCheck | null;
  zyx: EulerZYX | null;
  zyz: EulerZYZ | null;
  axis: AxisAngle | null;
  quat: Quaternion | null;
  /** R_ba = R_abᵀ */
  Rinv: Mat3 | null;
  pa: Vec3 | null;
  /** R′ bzw. R″ nach der Zusatzdrehung */
  Rextra: Mat3 | null;
  trace: Trace<KinGroup>;
}

/** Abstand zur Kardansperre bzw. zu θ = 0, 180°, ab dem gewarnt wird (Grad). */
export const NEAR_LOCK_DEG = 5;

const REP_LABEL: Record<OrientationRep, string> = { zyx: "Z-Y-X-Winkel", zyz: "Z-Y-Z-Winkel", axis: "Achse und Winkel", quat: "Quaternion", matrix: "Rotationsmatrix" };

function inputMatrix(inp: OrientationInput): Calc<Mat3> {
  switch (inp.rep) {
    case "zyx": if (!inp.zyx) throw new KinematicsError("Z-Y-X-Winkel fehlen"); return fromZYX(inp.zyx);
    case "zyz": if (!inp.zyz) throw new KinematicsError("Z-Y-Z-Winkel fehlen"); return fromZYZ(inp.zyz);
    case "axis": if (!inp.axis) throw new KinematicsError("Achse und Winkel fehlen"); return fromAxisAngle(inp.axis);
    case "quat": if (!inp.quat) throw new KinematicsError("Quaternion fehlt"); return fromQuaternion(inp.quat);
    case "matrix":
      if (!inp.matrix || !inp.matrix.every((row) => row.every(Number.isFinite))) throw new KinematicsError("Rotationsmatrix fehlt oder enthält keine Zahl");
      return { value: inp.matrix, steps: [], notes: [] };
  }
}

/** Orientierung aus einer Darstellung: R, Prüfung, alle Darstellungen, Umkehrung, optional p_a und Zusatzdrehung. */
export function computeOrientation(inp: OrientationInput): OrientationResult {
  const trace: Trace<KinGroup> = {};
  const add = (g: KinGroup, steps: CalcStep[]): void => { (trace[g] ??= []).push(...steps); };
  const res: OrientationResult = { errors: [], notes: [], warnings: [], R: null, check: null, zyx: null, zyz: null, axis: null, quat: null, Rinv: null, pa: null, Rextra: null, trace };
  let R: Mat3;
  try {
    const m = inputMatrix(inp);
    R = m.value; add("orientierung", m.steps); res.notes.push(...m.notes);
  } catch (e) {
    res.errors.push(e instanceof KinematicsError ? `${REP_LABEL[inp.rep]}: ${e.message}` : String(e));
    return res;
  }
  res.R = R;
  const chk = checkRotation(R);
  add("pruefung", chk.steps); res.check = chk.value; res.notes.push(...chk.notes);
  if (!chk.value.valid) {
    res.errors.push("Die Matrix ist keine Rotationsmatrix (‖RᵀR − I‖ oder det R außerhalb 10⁻⁹); keine Umrechnung.");
    return res;
  }
  const a = toZYX(R), b = toZYZ(R), c = toAxisAngle(R), d = toQuaternion(R);
  for (const x of [a, b, c, d]) { add("umrechnung", x.steps); res.notes.push(...x.notes); }
  res.zyx = a.value; res.zyz = b.value; res.axis = c.value; res.quat = d.value;
  const lim = NEAR_LOCK_DEG;
  const bDeg = deg(a.value.B), tDeg = deg(b.value.theta);
  if (Math.abs(a.value.B) !== Math.PI / 2 && 90 - Math.abs(bDeg) < lim)
    res.warnings.push(`Kardansperre nah (B = ${bDeg.toFixed(2).replace(".", ",")}°): A und C ändern sich bei kleinen Änderungen der Orientierung stark.`);
  if (b.value.theta !== 0 && b.value.theta !== Math.PI && (tDeg < lim || 180 - tDeg < lim))
    res.warnings.push(`Z-Y-Z nahe am Sonderfall (θ = ${tDeg.toFixed(2).replace(".", ",")}°): φ und ψ ändern sich bei kleinen Änderungen stark.`);
  const inv = inverse(R);
  add("orientierung", inv.steps); res.Rinv = inv.value;
  try {
    if (inp.pb) { const p = rotateVector(R, inp.pb); add("orientierung", p.steps); res.pa = p.value; }
    if (inp.extra) { const x = rotateBy(R, inp.extra.frame, inp.extra.axis, inp.extra.angle); add("orientierung", x.steps); res.Rextra = x.value; }
  } catch (e) {
    res.errors.push(e instanceof KinematicsError ? e.message : String(e));
  }
  return res;
}

/** Alle Schritte eines Ergebnisses in Anzeigereihenfolge. */
export function orientationSteps(r: OrientationResult): CalcStep[] {
  return [...(r.trace.orientierung ?? []), ...(r.trace.pruefung ?? []), ...(r.trace.umrechnung ?? [])];
}

// ---------------------------------------------------------------- Schritt für Schritt (Lernhilfe, keine Formel-ID)

export interface OrientationStage {
  /** z. B. "1. Drehung um z um A = 30°" */
  label: string;
  /** Achse der Teildrehung im mitgedrehten System bzw. Einheitsachse bei Achse-Winkel */
  axisName: AxisName | "ω";
  angle: number;
  /** Orientierung vor und nach der Teildrehung */
  before: Mat3;
  after: Mat3;
}

/**
 * Teildrehungen für die Darstellung „Schritt für Schritt“: Z-Y-X und Z-Y-Z als drei Drehungen um mitgedrehte Achsen,
 * Achse-Winkel und Quaternion als eine Drehung um ω̂. Gleiche Formeln wie G-01 bis G-05 (ohne Rechenweg).
 */
export function orientationStages(inp: OrientationInput): OrientationStage[] {
  const fmtDeg = (x: number): string => `${(Math.round(deg(x) * 100) / 100).toString().replace(".", ",")}°`;
  const chain = (parts: Array<[AxisName, number, string]>): OrientationStage[] => {
    let cur = I3;
    return parts.map(([ax, ang, name], i) => {
      const next = mul(cur, rotAxis(ax, ang));
      const st: OrientationStage = { label: `${i + 1}. Drehung um ${ax}${["", "′", "″"][i] ?? ""} um ${name} = ${fmtDeg(ang)}`, axisName: ax, angle: ang, before: cur, after: next };
      cur = next;
      return st;
    });
  };
  if (inp.rep === "zyx" && inp.zyx) return chain([["z", inp.zyx.A, "A"], ["y", inp.zyx.B, "B"], ["x", inp.zyx.C, "C"]]);
  if (inp.rep === "zyz" && inp.zyz) return chain([["z", inp.zyz.phi, "φ"], ["y", inp.zyz.theta, "θ"], ["z", inp.zyz.psi, "ψ"]]);
  const r = computeOrientation({ rep: inp.rep, ...(inp.axis ? { axis: inp.axis } : {}), ...(inp.quat ? { quat: inp.quat } : {}), ...(inp.matrix ? { matrix: inp.matrix } : {}) });
  if (!r.R || !r.axis) return [];
  return [{ label: `Drehung um ω̂ um θ = ${fmtDeg(r.axis.theta)}`, axisName: "ω", angle: r.axis.theta, before: I3, after: r.R }];
}

/**
 * Orientierung im Verlauf: t ∈ [0, Anzahl Teildrehungen]; ganzzahlige t sind die Zwischenstände, dazwischen läuft
 * die jeweilige Teildrehung linear im Winkel. Bei Achse-Winkel Drehung um ω̂ um t·θ.
 */
export function stageMatrix(stages: readonly OrientationStage[], t: number, axisOmega?: Vec3): Mat3 {
  if (stages.length === 0) return I3;
  const tt = Math.min(Math.max(t, 0), stages.length);
  const i = Math.min(Math.floor(tt), stages.length - 1);
  const f = tt - i;
  const s = stages[i]!;
  if (s.axisName === "ω") return axisOmega ? fromAxisAngle({ axis: axisOmega, theta: f * s.angle }).value : f >= 1 ? s.after : s.before;
  return mul(s.before, rotAxis(s.axisName, f * s.angle));
}
