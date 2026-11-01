/**
 * Orientierung eines starren Körpers (Modul kinematik, Blatt K1, ab 0.12.0): Rechenschritte G-01 bis G-12.
 * Konzept handhabung/konzept_k1_orientierung.md (Entscheidungen K1-E1 bis E4 vom 01.11.2026).
 *
 * Quellen (eigene Umsetzung, keine Normtexte):
 * - Lynch, Park: Modern Robotics, Cambridge 2017, Kap. 3.2 (S. 59 bis 75) und Anhang B (S. 497 bis 505)
 * - Weber, Koch: Industrieroboter, Hanser, Kap. 2.1.8 bis 2.1.10 (S. 28 bis 35)
 * - ISO 9787:2013, 4.1 (rechtshändig) und 4.3 (Drehrichtung)
 *
 * Einheiten: Winkel in rad, Vektoren in m. Anzeige im Rechenweg in Grad bzw. mm.
 * Bezeichnungen Z-Y-X: A um z, B um y′, C um x″ (KUKA). Achtung: ISO 9787 nennt die Drehungen um x, y, z A, B, C,
 * also in umgekehrter Zuordnung; mathematisch ist R = R_z(A)·R_y(B)·R_x(C) dieselbe Matrix wie RPY fest um x, y, z.
 * Lynch/Park Anhang B schreibt dieselbe Folge als (α, β, γ) = (A, B, C).
 */
import { fmt } from "../format";
import type { CalcStep } from "../trace";
import { I3, add, det, deg, dot, frob, mul, mulVec, norm, rotAxis, scaleVec, skew, trace, transpose, veeAnti, type AxisName, type Mat3, type Vec3 } from "./so3";

/** Z-Y-X-Winkel in rad: R = R_z(A)·R_y(B)·R_x(C). */
export interface EulerZYX { A: number; B: number; C: number }
/** Z-Y-Z-Winkel in rad: R = R_z(φ)·R_y(θ)·R_z(ψ). */
export interface EulerZYZ { phi: number; theta: number; psi: number }
/** Achse und Winkel: Drehung um die Einheitsachse axis um theta (rad). */
export interface AxisAngle { axis: Vec3; theta: number }
/** Einheitsquaternion (w, x, y, z), w = cos(θ/2), (x, y, z) = ω̂·sin(θ/2). */
export interface Quaternion { w: number; x: number; y: number; z: number }

/** Ergebnis eines Rechenschritts mit Rechenweg. */
export interface Calc<T> { value: T; steps: CalcStep[]; notes: string[] }

/** Kardansperre bzw. Sonderfall θ = 0, 180°: cos B bzw. sin θ höchstens so groß (entspricht 6·10⁻⁸° Abstand). */
export const LOCK_TOL = 1e-9;
/** Prüfung der Rotationsmatrix: ‖RᵀR − I‖_F und |det R − 1| höchstens so groß. */
export const ROT_TOL = 1e-9;
/** Achse-Winkel: θ unterhalb dieser Grenze gilt als 0 (Achse unbestimmt). */
export const ZERO_ANGLE_TOL = 1e-12;
/** Quaternion: |w| unterhalb dieser Grenze entscheidet die Vektorregel über das Vorzeichen. */
export const QUAT_W_TOL = 1e-12;

export class KinematicsError extends Error {}

const SIG = 6;
const n = (x: number): string => fmt(x, SIG);
/** Anzeige von Matrix- und Vektorelementen: Rundungsreste |x| < 5·10⁻¹³ als 0 (nur Text, Werte unverändert). */
const ne = (x: number): string => fmt(Math.abs(x) < 5e-13 ? 0 : x, SIG);
const dg = (a: number): string => `${ne(deg(a))}°`;
const mStr = (m: Mat3): string => `[${m.map((r) => r.map(ne).join("  ")).join("; ")}]`;
const vStr = (v: readonly number[]): string => `(${v.map(ne).join("; ")})`;
/** Zahl nach Rechenzeichen, negativ in Klammern. */
const np = (x: number): string => (x < 0 && Math.abs(x) >= 5e-13 ? `(${ne(x)})` : ne(x));
const rows = (m: Mat3): number[][] => m.map((r) => [...r]);

function matStep(id: string, title: string, formula: string, subst: string, m: Mat3, ref: string): CalcStep {
  return { id, title, formula, subst: `${subst} = ${mStr(m)}`, value: trace(m), unit: "1", ref, matrix: rows(m) };
}
function vecStep(id: string, title: string, formula: string, subst: string, v: readonly number[], unit: string, ref: string): CalcStep {
  return { id, title, formula, subst: `${subst} = ${vStr(v)}`, value: Math.hypot(...v), unit, ref, matrix: [[...v]] };
}
function angStep(id: string, title: string, formula: string, subst: string, a: number, ref: string): CalcStep {
  return { id, title, formula, subst: `${subst} = ${dg(a)}`, value: a, unit: "rad", ref };
}
const finite = (...x: number[]): boolean => x.every(Number.isFinite);
/** atan2 liefert für −0 als ersten Wert −π; Wertebereich der Winkel ist (−π, π]. */
const at2 = (y: number, x: number): number => { const a = Math.atan2(y, x); return a === -Math.PI ? Math.PI : a; };
const r = (m: Mat3, i: 1 | 2 | 3, j: 1 | 2 | 3): number => m[i - 1]![j - 1]!;

const LP = "Lynch/Park";
const WK = "Weber/Koch";

// ---------------------------------------------------------------- G-01 Elementardrehungen
const G01: Record<AxisName, { id: string; formula: string }> = {
  x: { id: "G-01-X", formula: "R_x(θ) = [1 0 0; 0 cos θ −sin θ; 0 sin θ cos θ]" },
  y: { id: "G-01-Y", formula: "R_y(θ) = [cos θ 0 sin θ; 0 1 0; −sin θ 0 cos θ]" },
  z: { id: "G-01-Z", formula: "R_z(θ) = [cos θ −sin θ 0; sin θ cos θ 0; 0 0 1]" },
};

/** G-01: Elementardrehung um eine Koordinatenachse. */
export function elementary(axis: AxisName, angle: number): Calc<Mat3> {
  if (!finite(angle)) throw new KinematicsError("Winkel ist keine Zahl");
  const R = rotAxis(axis, angle);
  const g = G01[axis];
  return { value: R, steps: [matStep(g.id, `Elementardrehung um ${axis}`, g.formula, `R_${axis}(${dg(angle)})`, R, `${LP} S. 62, Rot(${axis}̂, θ); ${WK} Gl. (2.18), (2.21)`)], notes: [] };
}

// ---------------------------------------------------------------- G-02, G-03 Euler-Winkel → R
/** G-02: Z-Y-X-Winkel (KUKA A, B, C) → R = R_z(A)·R_y(B)·R_x(C). */
export function fromZYX(e: EulerZYX): Calc<Mat3> {
  if (!finite(e.A, e.B, e.C)) throw new KinematicsError("Z-Y-X-Winkel sind keine Zahlen");
  const z = elementary("z", e.A), y = elementary("y", e.B), x = elementary("x", e.C);
  const R = mul(mul(z.value, y.value), x.value);
  return {
    value: R,
    steps: [...z.steps, ...y.steps, ...x.steps,
      matStep("G-02", "Rotationsmatrix aus Z-Y-X-Winkeln (A, B, C)", "R = R_z(A)·R_y(B)·R_x(C); mitgedreht um z, y′, x″, gleichwertig fest um x, y, z",
        `R = R_z(${dg(e.A)})·R_y(${dg(e.B)})·R_x(${dg(e.C)})`, R, `${LP} Gl. (B.1), (B.8) mit (α, β, γ) = (A, B, C); ${WK} Gl. (2.21)`)],
    notes: [],
  };
}

/** G-03: Z-Y-Z-Winkel → R = R_z(φ)·R_y(θ)·R_z(ψ). */
export function fromZYZ(e: EulerZYZ): Calc<Mat3> {
  if (!finite(e.phi, e.theta, e.psi)) throw new KinematicsError("Z-Y-Z-Winkel sind keine Zahlen");
  const z1 = elementary("z", e.phi), y = elementary("y", e.theta), z2 = elementary("z", e.psi);
  const R = mul(mul(z1.value, y.value), z2.value);
  return {
    value: R,
    steps: [...z1.steps, ...y.steps, ...z2.steps,
      matStep("G-03", "Rotationsmatrix aus Z-Y-Z-Winkeln (φ, θ, ψ)", "R = R_z(φ)·R_y(θ)·R_z(ψ); mitgedreht um z, y′, z″",
        `R = R_z(${dg(e.phi)})·R_y(${dg(e.theta)})·R_z(${dg(e.psi)})`, R, `${LP} Gl. (B.6) mit (α, β, γ) = (φ, θ, ψ); ${WK} Gl. (2.18) mit (α, β, χ) = (φ, θ, ψ)`)],
    notes: [],
  };
}

// ---------------------------------------------------------------- G-04 Achse-Winkel → R
/** G-04: Achse und Winkel → R (Rodrigues). Die Achse wird normiert (G-04-N); Nullvektor ist unzulässig. */
export function fromAxisAngle(aa: AxisAngle): Calc<Mat3> {
  const w = aa.axis;
  if (!finite(w[0], w[1], w[2], aa.theta)) throw new KinematicsError("Achse oder Winkel sind keine Zahlen");
  const len = norm(w);
  if (len < 1e-12) throw new KinematicsError("Drehachse ist der Nullvektor");
  const notes = Math.abs(len - 1) > ROT_TOL ? [`Drehachse hatte die Länge ${fmt(len, 10)} und wurde normiert.`] : [];
  const u = scaleVec(w, 1 / len);
  const K = skew(u);
  const R = add(add(I3, K, Math.sin(aa.theta)), mul(K, K), 1 - Math.cos(aa.theta));
  return {
    value: R,
    steps: [
      vecStep("G-04-N", "Einheitsachse", "ω̂ = ω/‖ω‖", `ω̂ = ${vStr(w)}/${n(len)}`, u, "1", `${LP} Gl. (3.51), ‖ω̂‖ = 1`),
      matStep("G-04", "Rotationsmatrix aus Achse und Winkel (Rodrigues)", "R = I + sin θ·[ω̂] + (1 − cos θ)·[ω̂]²",
        `R = I + sin(${dg(aa.theta)})·[ω̂] + (1 − cos(${dg(aa.theta)}))·[ω̂]²`, R, `${LP} Gl. (3.51), (3.52); ${WK} Kap. 2.1.10`),
    ],
    notes,
  };
}

// ---------------------------------------------------------------- G-05 Quaternion → R
/** G-05: Quaternion (w, x, y, z) → R. Das Quaternion wird normiert (G-05-N); Nullquaternion ist unzulässig. */
export function fromQuaternion(q: Quaternion): Calc<Mat3> {
  if (!finite(q.w, q.x, q.y, q.z)) throw new KinematicsError("Quaternion enthält keine Zahl");
  const len = Math.hypot(q.w, q.x, q.y, q.z);
  if (len < 1e-12) throw new KinematicsError("Quaternion ist null");
  const notes = Math.abs(len - 1) > ROT_TOL ? [`Quaternion hatte den Betrag ${fmt(len, 10)} und wurde normiert.`] : [];
  const w = q.w / len, x = q.x / len, y = q.y / len, z = q.z / len;
  const R: Mat3 = [
    [w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z],
  ];
  return {
    value: R,
    steps: [
      vecStep("G-05-N", "Einheitsquaternion", "q̂ = q/‖q‖, q = (w, x, y, z)", `q̂ = ${vStr([q.w, q.x, q.y, q.z])}/${n(len)}`, [w, x, y, z], "1", `${LP} Anhang B.3, ‖q‖ = 1`),
      matStep("G-05", "Rotationsmatrix aus Quaternion",
        "R = [w² + x² − y² − z²  2(xy − wz)  2(xz + wy); 2(xy + wz)  w² − x² + y² − z²  2(yz − wx); 2(xz − wy)  2(yz + wx)  w² − x² − y² + z²]",
        `R(${ne(w)}; ${ne(x)}; ${ne(y)}; ${ne(z)})`, R, `${LP} Gl. (B.12) mit (q₀, q₁, q₂, q₃) = (w, x, y, z)`),
    ],
    notes,
  };
}

// ---------------------------------------------------------------- G-06 R → Z-Y-X
/** G-06: R → Z-Y-X-Winkel. A, C ∈ (−180°, 180°], B ∈ [−90°, 90°]. Kardansperre: A = 0. */
export function toZYX(R: Mat3): Calc<EulerZYX> {
  const cb = Math.hypot(r(R, 1, 1), r(R, 2, 1));
  const ref = `${LP} Anhang B.1.1, Gl. (B.3) bis (B.5); ${WK} Gl. (2.22)`;
  if (cb <= LOCK_TOL) {
    if (r(R, 3, 1) < 0) {
      const C = at2(r(R, 1, 2), r(R, 2, 2));
      return {
        value: { A: 0, B: Math.PI / 2, C },
        steps: [angStep("G-06-KP", "Kardansperre B = +90°: C bei A = 0", "Kardansperre B = +90° (√(r_11² + r_21²) ≤ 10⁻⁹, r_31 < 0): A = 0, C = atan2(r_12, r_22)",
          `√(r_11² + r_21²) = ${ne(cb)}, r_31 = ${ne(r(R, 3, 1))}: B = 90°, A = 0°, C = atan2(${ne(r(R, 1, 2))}; ${ne(r(R, 2, 2))})`, C,
          `${LP} Anhang B.1.1 (b); ${WK} Gl. (2.23): nur A − C bestimmt`)],
        notes: ["Kardansperre B = +90°: nur A − C ist bestimmt; gesetzt A = 0."],
      };
    }
    const C = at2(-r(R, 1, 2), r(R, 2, 2));
    return {
      value: { A: 0, B: -Math.PI / 2, C },
      steps: [angStep("G-06-KN", "Kardansperre B = −90°: C bei A = 0", "Kardansperre B = −90° (√(r_11² + r_21²) ≤ 10⁻⁹, r_31 > 0): A = 0, C = atan2(−r_12, r_22)",
        `√(r_11² + r_21²) = ${ne(cb)}, r_31 = ${ne(r(R, 3, 1))}: B = −90°, A = 0°, C = atan2(${ne(-r(R, 1, 2))}; ${ne(r(R, 2, 2))})`, C,
        `${LP} Anhang B.1.1 (c); ${WK} Gl. (2.23): nur A + C bestimmt (dort Vorzeichen: richtig A + C = atan2(−r_23, −r_13))`)],
      notes: ["Kardansperre B = −90°: nur A + C ist bestimmt; gesetzt A = 0."],
    };
  }
  const B = at2(-r(R, 3, 1), cb);
  const A = at2(r(R, 2, 1), r(R, 1, 1));
  const C = at2(r(R, 3, 2), r(R, 3, 3));
  return {
    value: { A, B, C },
    steps: [
      angStep("G-06-B", "Winkel B (um y′)", "B = atan2(−r_31, √(r_11² + r_21²))", `B = atan2(${ne(-r(R, 3, 1))}; ${ne(cb)})`, B, ref),
      angStep("G-06-A", "Winkel A (um z)", "A = atan2(r_21, r_11)", `A = atan2(${ne(r(R, 2, 1))}; ${ne(r(R, 1, 1))})`, A, ref),
      angStep("G-06-C", "Winkel C (um x″)", "C = atan2(r_32, r_33)", `C = atan2(${ne(r(R, 3, 2))}; ${ne(r(R, 3, 3))})`, C, ref),
    ],
    notes: [],
  };
}

// ---------------------------------------------------------------- G-07 R → Z-Y-Z
/** G-07: R → Z-Y-Z-Winkel. φ, ψ ∈ (−180°, 180°], θ ∈ [0°, 180°]. Sonderfall θ = 0 oder 180°: φ = 0. */
export function toZYZ(R: Mat3): Calc<EulerZYZ> {
  const st = Math.hypot(r(R, 3, 1), r(R, 3, 2));
  const ref = `${LP} Gl. (B.6), Lösung analog B.1.1; ${WK} Gl. (2.19) (dort χ ohne Minus: richtig χ = atan2(r_32, −r_31))`;
  if (st <= LOCK_TOL) {
    if (r(R, 3, 3) > 0) {
      const psi = at2(r(R, 2, 1), r(R, 1, 1));
      return {
        value: { phi: 0, theta: 0, psi },
        steps: [angStep("G-07-K0", "Sonderfall θ = 0: ψ bei φ = 0", "Sonderfall θ = 0 (√(r_31² + r_32²) ≤ 10⁻⁹, r_33 > 0): φ = 0, ψ = atan2(r_21, r_11)",
          `√(r_31² + r_32²) = ${ne(st)}, r_33 = ${ne(r(R, 3, 3))}: θ = 0°, φ = 0°, ψ = atan2(${ne(r(R, 2, 1))}; ${ne(r(R, 1, 1))})`, psi, `${WK} Gl. (2.20): nur φ + ψ bestimmt`)],
        notes: ["Sonderfall θ = 0: beide z-Drehungen fallen zusammen, nur φ + ψ ist bestimmt; gesetzt φ = 0."],
      };
    }
    const psi = at2(r(R, 2, 1), r(R, 2, 2));
    return {
      value: { phi: 0, theta: Math.PI, psi },
      steps: [angStep("G-07-K180", "Sonderfall θ = 180°: ψ bei φ = 0", "Sonderfall θ = 180° (√(r_31² + r_32²) ≤ 10⁻⁹, r_33 < 0): φ = 0, ψ = atan2(r_21, r_22)",
        `√(r_31² + r_32²) = ${ne(st)}, r_33 = ${ne(r(R, 3, 3))}: θ = 180°, φ = 0°, ψ = atan2(${ne(r(R, 2, 1))}; ${ne(r(R, 2, 2))})`, psi, `${LP} Gl. (B.6) mit β = 180°: nur φ − ψ bestimmt`)],
      notes: ["Sonderfall θ = 180°: nur φ − ψ ist bestimmt; gesetzt φ = 0."],
    };
  }
  const theta = at2(st, r(R, 3, 3));
  const phi = at2(r(R, 2, 3), r(R, 1, 3));
  const psi = at2(r(R, 3, 2), -r(R, 3, 1));
  return {
    value: { phi, theta, psi },
    steps: [
      angStep("G-07-T", "Winkel θ (um y′)", "θ = atan2(√(r_31² + r_32²), r_33)", `θ = atan2(${ne(st)}; ${ne(r(R, 3, 3))})`, theta, ref),
      angStep("G-07-P", "Winkel φ (um z)", "φ = atan2(r_23, r_13)", `φ = atan2(${ne(r(R, 2, 3))}; ${ne(r(R, 1, 3))})`, phi, ref),
      angStep("G-07-S", "Winkel ψ (um z″)", "ψ = atan2(r_32, −r_31)", `ψ = atan2(${ne(r(R, 3, 2))}; ${ne(-r(R, 3, 1))})`, psi, ref),
    ],
    notes: [],
  };
}

// ---------------------------------------------------------------- Vorzeichenregel (G-08-S, G-09-V)
/** Erste von 0 verschiedene Komponente in der Reihenfolge x, y, z positiv (Vorzeichen bei θ = 180°). */
function firstPositive(v: Vec3, tol: number): Vec3 {
  for (const c of v) if (Math.abs(c) > tol) return c < 0 ? scaleVec(v, -1) : v;
  return v;
}

// ---------------------------------------------------------------- G-08 R → Achse-Winkel
/** G-08: R → Achse und Winkel θ ∈ [0, 180°] (Matrixlogarithmus, numerisch stabil über atan2 und symmetrischen Anteil). */
export function toAxisAngle(R: Mat3): Calc<AxisAngle> {
  const v = veeAnti(R);
  const s = norm(v) / 2, c = (trace(R) - 1) / 2;
  const theta = at2(s, c); // s ≥ 0: θ ∈ [0, π]
  const ref = `${LP} Gl. (3.53), (3.54), Algorithmus S. 74 f.`;
  const tStep = angStep("G-08-T", "Drehwinkel θ", "θ = atan2(½·‖v‖, ½·(tr R − 1)), v = (r_32 − r_23, r_13 − r_31, r_21 − r_12)",
    `v = ${vStr(v)}, tr R = ${ne(trace(R))}: θ = atan2(${ne(s)}; ${ne(c)})`, theta, `${ref}; atan2 statt arccos (gleichwertig, genauer nahe 0 und 180°)`);
  if (theta <= ZERO_ANGLE_TOL) {
    const axis: Vec3 = [0, 0, 1];
    return {
      value: { axis, theta: 0 },
      steps: [tStep, vecStep("G-08-0", "Sonderfall θ = 0: Achse unbestimmt", "Sonderfall θ = 0 (θ ≤ 10⁻¹²): ω̂ unbestimmt, gesetzt ω̂ = (0, 0, 1)", `θ = ${n(theta)} rad: ω̂`, axis, "1", `${LP} Algorithmus S. 74 (a)`)],
      notes: ["θ = 0: keine Drehung, die Achse ist unbestimmt; gesetzt ω̂ = (0, 0, 1)."],
    };
  }
  if (c >= 0) {
    const axis = scaleVec(v, 1 / norm(v));
    return {
      value: { axis, theta },
      steps: [tStep, vecStep("G-08-W", "Drehachse ω̂ (θ ≤ 90°)", "ω̂ = v/(2·sin θ) = v/‖v‖", `ω̂ = ${vStr(v)}/${ne(norm(v))}`, axis, "1", `${ref}, Gl. (3.61)`)],
      notes: [],
    };
  }
  // θ > 90°: symmetrischer Anteil (R + Rᵀ)/2 = cos θ·I + (1 − cos θ)·ω̂ω̂ᵀ, Vorzeichen aus v
  const d = [r(R, 1, 1), r(R, 2, 2), r(R, 3, 3)] as const;
  const k = d[0] >= d[1] && d[0] >= d[2] ? 0 : d[1] >= d[2] ? 1 : 2;
  const wk = Math.sqrt((d[k] - c) / (1 - c));
  const S = (i: number, j: number): number => R[i as 0]![j as 0]! + R[j as 0]![i as 0]!;
  const raw = [0, 1, 2].map((j) => (j === k ? wk : S(j, k) / (2 * (1 - c) * wk))) as unknown as Vec3;
  const atPi = norm(v) <= ZERO_ANGLE_TOL;
  const axis = atPi ? firstPositive(raw, ZERO_ANGLE_TOL) : dot(raw, v) < 0 ? scaleVec(raw, -1) : raw;
  const kName = ["11", "22", "33"][k]!;
  return {
    value: { axis, theta },
    steps: [tStep, vecStep("G-08-S", "Drehachse ω̂ (θ > 90°, symmetrischer Anteil)",
      "θ > 90°: ω̂_k = √((r_kk − cos θ)/(1 − cos θ)), k = größtes r_kk; ω̂_j = (r_jk + r_kj)/(2·(1 − cos θ)·ω̂_k); Vorzeichen mit ω̂·v ≥ 0, bei v = 0 (θ = 180°) erste von 0 verschiedene Komponente in x, y, z positiv",
      `k = ${k + 1} (r_${kName} = ${ne(d[k])}), cos θ = ${ne(c)}${atPi ? ", v = 0: Vorzeichenregel x, y, z" : ""}: ω̂`, axis, "1",
      `${LP} Gl. (3.52), (3.55) bis (3.60) verallgemeinert auf θ > 90°`)],
    notes: atPi ? ["θ = 180°: ω̂ und −ω̂ beschreiben dieselbe Drehung; gewählt: erste von 0 verschiedene Komponente (x, y, z) positiv."] : [],
  };
}

// ---------------------------------------------------------------- G-09 R → Quaternion
/** G-09: R → Einheitsquaternion (numerisch stabil nach größtem Glied von tr R, r_11, r_22, r_33), w ≥ 0. */
export function toQuaternion(R: Mat3): Calc<Quaternion> {
  const t = trace(R), r11 = r(R, 1, 1), r22 = r(R, 2, 2), r33 = r(R, 3, 3);
  const ref = `${LP} Gl. (B.10), (B.11); ${WK} Gl. (2.29)`;
  let q: [number, number, number, number];
  let st: CalcStep;
  const show = (qq: readonly number[]): string => vStr(qq);
  if (t >= r11 && t >= r22 && t >= r33) {
    const w = Math.sqrt(1 + t) / 2;
    q = [w, (r(R, 3, 2) - r(R, 2, 3)) / (4 * w), (r(R, 1, 3) - r(R, 3, 1)) / (4 * w), (r(R, 2, 1) - r(R, 1, 2)) / (4 * w)];
    st = vecStep("G-09-W", "Quaternion, Zweig tr R", "tr R größtes Glied: w = ½·√(1 + tr R), x = (r_32 − r_23)/(4w), y = (r_13 − r_31)/(4w), z = (r_21 − r_12)/(4w)",
      `tr R = ${ne(t)}: w = ½·√(1 + ${np(t)}): q`, q, "1", ref);
  } else if (r11 >= r22 && r11 >= r33) {
    const x = Math.sqrt(1 + r11 - r22 - r33) / 2;
    q = [(r(R, 3, 2) - r(R, 2, 3)) / (4 * x), x, (r(R, 1, 2) + r(R, 2, 1)) / (4 * x), (r(R, 1, 3) + r(R, 3, 1)) / (4 * x)];
    st = vecStep("G-09-X", "Quaternion, Zweig r_11", "r_11 größtes Glied: x = ½·√(1 + r_11 − r_22 − r_33), w = (r_32 − r_23)/(4x), y = (r_12 + r_21)/(4x), z = (r_13 + r_31)/(4x)",
      `r_11 = ${ne(r11)}: x = ½·√(1 + ${np(r11)} − ${np(r22)} − ${np(r33)}): q`, q, "1", `${ref}; Zweig nach Shepperd`);
  } else if (r22 >= r33) {
    const y = Math.sqrt(1 - r11 + r22 - r33) / 2;
    q = [(r(R, 1, 3) - r(R, 3, 1)) / (4 * y), (r(R, 1, 2) + r(R, 2, 1)) / (4 * y), y, (r(R, 2, 3) + r(R, 3, 2)) / (4 * y)];
    st = vecStep("G-09-Y", "Quaternion, Zweig r_22", "r_22 größtes Glied: y = ½·√(1 − r_11 + r_22 − r_33), w = (r_13 − r_31)/(4y), x = (r_12 + r_21)/(4y), z = (r_23 + r_32)/(4y)",
      `r_22 = ${ne(r22)}: y = ½·√(1 − ${np(r11)} + ${np(r22)} − ${np(r33)}): q`, q, "1", `${ref}; Zweig nach Shepperd`);
  } else {
    const z = Math.sqrt(1 - r11 - r22 + r33) / 2;
    q = [(r(R, 2, 1) - r(R, 1, 2)) / (4 * z), (r(R, 1, 3) + r(R, 3, 1)) / (4 * z), (r(R, 2, 3) + r(R, 3, 2)) / (4 * z), z];
    st = vecStep("G-09-Z", "Quaternion, Zweig r_33", "r_33 größtes Glied: z = ½·√(1 − r_11 − r_22 + r_33), w = (r_21 − r_12)/(4z), x = (r_13 + r_31)/(4z), y = (r_23 + r_32)/(4z)",
      `r_33 = ${ne(r33)}: z = ½·√(1 − ${np(r11)} − ${np(r22)} + ${np(r33)}): q`, q, "1", `${ref}; Zweig nach Shepperd`);
  }
  const before = show(q);
  let rule: string;
  if (Math.abs(q[0]) <= QUAT_W_TOL) {
    const v = firstPositive([q[1], q[2], q[3]], QUAT_W_TOL);
    const flip = v[0] !== q[1] || v[1] !== q[2] || v[2] !== q[3];
    q = flip ? [-q[0], v[0], v[1], v[2]] : q;
    rule = `|w| ≤ 10⁻¹²: Vektorregel x, y, z${flip ? ", Vorzeichen gewechselt" : ""}`;
  } else if (q[0] < 0) {
    q = [-q[0], -q[1], -q[2], -q[3]];
    rule = "w < 0: Vorzeichen gewechselt";
  } else rule = "w ≥ 0: unverändert";
  const vStep = vecStep("G-09-V", "Quaternion eindeutig (Vorzeichen)",
    "q und −q beschreiben dieselbe Drehung: Vorzeichen so, dass w ≥ 0; bei |w| ≤ 10⁻¹² erste von 0 verschiedene Komponente in x, y, z positiv",
    `${before}, ${rule}: q`, q, "1", `${LP} Anhang B.3 (q und −q); Konzept K1, Abschnitt 2`);
  return { value: { w: q[0], x: q[1], y: q[2], z: q[3] }, steps: [st, vStep], notes: [] };
}

// ---------------------------------------------------------------- G-10 Prüfung
export interface RotationCheck { orthErr: number; det: number; valid: boolean }
/** G-10: Prüfung, ob R eine Rotationsmatrix ist: ‖RᵀR − I‖_F ≤ 10⁻⁹ und |det R − 1| ≤ 10⁻⁹. */
export function checkRotation(R: Mat3): Calc<RotationCheck> {
  const e = frob(add(mul(transpose(R), R), I3, -1));
  const d = det(R);
  const valid = Number.isFinite(e) && Number.isFinite(d) && e <= ROT_TOL && Math.abs(d - 1) <= ROT_TOL;
  return {
    value: { orthErr: e, det: d, valid },
    steps: [
      { id: "G-10-O", title: "Orthogonalität", formula: "e = ‖RᵀR − I‖_F, gültig für e ≤ 10⁻⁹", subst: `e = ‖RᵀR − I‖_F = ${n(e)} (${e <= ROT_TOL ? "erfüllt" : "verletzt"})`, value: e, unit: "1", ref: `${LP} Gl. (3.19)` },
      { id: "G-10-D", title: "Determinante", formula: "det R = +1 (rechtshändig), Toleranz 10⁻⁹", subst: `det R = ${n(d)} (${Math.abs(d - 1) <= ROT_TOL ? "erfüllt" : "verletzt"})`, value: d, unit: "1", ref: `${LP} Gl. (3.21); ISO 9787:2013, 4.1` },
    ],
    notes: valid ? [] : ["R ist keine Rotationsmatrix (Toleranz 10⁻⁹)."],
  };
}

// ---------------------------------------------------------------- G-11 Verkettung, Umkehr, feste und mitgedrehte Achse
/** G-11-V: Verkettung R_ac = R_ab·R_bc. */
export function compose(Rab: Mat3, Rbc: Mat3): Calc<Mat3> {
  const R = mul(Rab, Rbc);
  return { value: R, steps: [matStep("G-11-V", "Verkettung", "R_ac = R_ab·R_bc", `R_ac = ${mStr(Rab)}·${mStr(Rbc)}`, R, `${LP} Gl. (3.22)`)], notes: [] };
}
/** G-11-I: Umkehrung R_ba = R_abᵀ. */
export function inverse(Rab: Mat3): Calc<Mat3> {
  const R = transpose(Rab);
  return { value: R, steps: [matStep("G-11-I", "Umkehrung", "R_ba = R_ab⁻¹ = R_abᵀ", "R_ba = R_abᵀ", R, `${LP} Prop. 3.3, S. 61`)], notes: [] };
}
/** G-11-F, G-11-M: Zusatzdrehung Rot um eine Achse des festen Systems {a} (links) oder des mitgedrehten Systems {b} (rechts). */
export function rotateBy(R: Mat3, frame: "fest" | "mitgedreht", axis: AxisName, angle: number): Calc<Mat3> {
  const e = elementary(axis, angle);
  if (frame === "fest") {
    const Rn = mul(e.value, R);
    return { value: Rn, steps: [...e.steps, matStep("G-11-F", "Drehung um feste Achse (links multiplizieren)", "Drehung um feste Achse (in {a}): R′ = Rot·R",
      `R′ = R_${axis}(${dg(angle)})·R`, Rn, `${LP} Gl. (3.23)`)], notes: [] };
  }
  const Rn = mul(R, e.value);
  return { value: Rn, steps: [...e.steps, matStep("G-11-M", "Drehung um mitgedrehte Achse (rechts multiplizieren)", "Drehung um mitgedrehte Achse (in {b}): R″ = R·Rot",
    `R″ = R·R_${axis}(${dg(angle)})`, Rn, `${LP} Gl. (3.24)`)], notes: [] };
}

// ---------------------------------------------------------------- G-12 Vektor drehen
/** G-12: Vektor von {b} nach {a}: p_a = R_ab·p_b (Einheit m, Anzeige mm). */
export function rotateVector(Rab: Mat3, pb: Vec3): Calc<Vec3> {
  if (!finite(pb[0], pb[1], pb[2])) throw new KinematicsError("Vektor enthält keine Zahl");
  const pa = mulVec(Rab, pb);
  const mm = (v: Vec3): string => `(${v.map((x) => fmt(x * 1e3, SIG)).join("; ")}) mm`;
  return {
    value: pa,
    steps: [{ id: "G-12", title: "Vektor in {a} ausdrücken", formula: "p_a = R_ab·p_b", subst: `p_a = R_ab·${mm(pb)} = ${mm(pa)}`, value: norm(pa), unit: "m", ref: `${LP} S. 62 (Rab·pb = pa)`, matrix: [[...pa]] }],
    notes: [],
  };
}

/** Rotationsmatrix ohne Rechenweg für Darstellung und Animation (gleiche Formeln wie G-02 bis G-05). */
export const matrixOf = {
  zyx: (e: EulerZYX): Mat3 => fromZYX(e).value,
  zyz: (e: EulerZYZ): Mat3 => fromZYZ(e).value,
  axis: (a: AxisAngle): Mat3 => fromAxisAngle(a).value,
  quat: (q: Quaternion): Mat3 => fromQuaternion(q).value,
};

