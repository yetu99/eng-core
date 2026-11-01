/**
 * Grundbausteine für Drehungen im Raum (Modul kinematik, ab 0.12.0): 3×3-Matrizen und Vektoren als Tupel,
 * Matrixprodukt, Transponierte, Spur, Determinante, Schiefmatrix. Reine lineare Algebra ohne Formel-ID; die
 * fachlichen Rechenschritte mit ID (G-01 bis G-12) stehen in orientation.ts.
 *
 * Konventionen (Konzept handhabung/konzept_k1_orientierung.md, Abschnitt 2):
 * - rechtshändige Koordinatensysteme (ISO 9787:2013, 4.1)
 * - R_ab = Orientierung von {b} in {a}; die Spalten von R_ab sind die Achsen x_b, y_b, z_b in {a} (Lynch/Park Gl. 3.16)
 * - Matrizen zeilenweise: m[i][j] = r_(i+1)(j+1)
 * - Winkel intern in rad
 */

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [Vec3, Vec3, Vec3];

export const I3: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Elementardrehung um x (Lynch/Park S. 62, Rot(x̂, θ)). */
export function rotX(a: number): Mat3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
}
/** Elementardrehung um y (Lynch/Park S. 62, Rot(ŷ, θ)). */
export function rotY(a: number): Mat3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
}
/** Elementardrehung um z (Lynch/Park S. 62, Rot(ẑ, θ)). */
export function rotZ(a: number): Mat3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}
export type AxisName = "x" | "y" | "z";
export function rotAxis(axis: AxisName, a: number): Mat3 {
  return axis === "x" ? rotX(a) : axis === "y" ? rotY(a) : rotZ(a);
}

export function mul(a: Mat3, b: Mat3): Mat3 {
  const r = (i: 0 | 1 | 2, j: 0 | 1 | 2): number => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  return [[r(0, 0), r(0, 1), r(0, 2)], [r(1, 0), r(1, 1), r(1, 2)], [r(2, 0), r(2, 1), r(2, 2)]];
}
export function mulVec(a: Mat3, v: Vec3): Vec3 {
  return [a[0][0] * v[0] + a[0][1] * v[1] + a[0][2] * v[2], a[1][0] * v[0] + a[1][1] * v[1] + a[1][2] * v[2], a[2][0] * v[0] + a[2][1] * v[1] + a[2][2] * v[2]];
}
export function transpose(a: Mat3): Mat3 {
  return [[a[0][0], a[1][0], a[2][0]], [a[0][1], a[1][1], a[2][1]], [a[0][2], a[1][2], a[2][2]]];
}
export function add(a: Mat3, b: Mat3, f = 1): Mat3 {
  return [
    [a[0][0] + f * b[0][0], a[0][1] + f * b[0][1], a[0][2] + f * b[0][2]],
    [a[1][0] + f * b[1][0], a[1][1] + f * b[1][1], a[1][2] + f * b[1][2]],
    [a[2][0] + f * b[2][0], a[2][1] + f * b[2][1], a[2][2] + f * b[2][2]],
  ];
}
export function scale(a: Mat3, f: number): Mat3 {
  return [[f * a[0][0], f * a[0][1], f * a[0][2]], [f * a[1][0], f * a[1][1], f * a[1][2]], [f * a[2][0], f * a[2][1], f * a[2][2]]];
}
export function trace(a: Mat3): number {
  return a[0][0] + a[1][1] + a[2][2];
}
export function det(a: Mat3): number {
  return a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
}
/** Frobenius-Norm. */
export function frob(a: Mat3): number {
  return Math.sqrt(a.reduce((s, row) => s + row[0] * row[0] + row[1] * row[1] + row[2] * row[2], 0));
}
/** Schiefsymmetrische Matrix [ω] mit [ω]·p = ω × p (Lynch/Park Gl. 3.30). */
export function skew(w: Vec3): Mat3 {
  return [[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]];
}
/** Vektor aus R − Rᵀ: (r32 − r23, r13 − r31, r21 − r12) = 2·sin θ·ω (Lynch/Park S. 73). */
export function veeAnti(r: Mat3): Vec3 {
  return [r[2][1] - r[1][2], r[0][2] - r[2][0], r[1][0] - r[0][1]];
}
export function norm(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function scaleVec(v: Vec3, f: number): Vec3 {
  return [v[0] * f, v[1] * f, v[2] * f];
}
/** Größte Abweichung zweier Matrizen elementweise (für Rundlauf und Tests). */
export function maxAbsDiff(a: Mat3, b: Mat3): number {
  let m = 0;
  for (const i of [0, 1, 2] as const) for (const j of [0, 1, 2] as const) m = Math.max(m, Math.abs(a[i][j] - b[i][j]));
  return m;
}

/** Winkel umrechnen (Anzeige in Grad, Kern in rad). Keine Formel-ID. */
export const deg = (rad: number): number => (rad * 180) / Math.PI;
export const rad = (deg_: number): number => (deg_ * Math.PI) / 180;
