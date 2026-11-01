/**
 * Beispielfälle Kinematik K1 Orientierung (Modul kinematik) für den Formelkatalog (scripts/katalog.ts).
 * Jeder Fall erzeugt seine Formeln einmal mit nachrechenbarem Beispiel. Literaturfälle zuerst; dieselben Zahlen
 * prüft verification/kinematik.py (Fälle G-L1 bis G-L6) gegen die gedruckten Werte.
 */
import { rad, rotZ, rotY, so3, type Mat3, type OrientationInput } from "../src/index";

const { mul, transpose } = so3;

export interface KinematikFall { id: string; text: string; inp: OrientationInput }

const S3 = Math.sqrt(3) / 2;
/** Weber/Koch Bild 2.12: x_W = z_0, z_W 30° über x_0 in der x_0-y_0-Ebene (Spalten = Achsen von K_W in K_0). */
export const WK_BILD_2_12: Mat3 = [[0, 0.5, S3], [0, -S3, 0.5], [1, 0, 0]];
/** Lynch/Park Abb. 3.7: R_b = Rot(ẑ, 90°), R_c = R_b·Rot(ŷ, −90°). */
export const LP_ABB_3_7 = { Rb: rotZ(Math.PI / 2), Rc: mul(rotZ(Math.PI / 2), rotY(-Math.PI / 2)) };

export function kinematikFaelle(): KinematikFall[] {
  return [
    { id: "G-L1", text: "Weber/Koch Bild 2.12: Rotationsmatrix des Werkzeugsystems (B = −90°, Kardansperre)", inp: { rep: "matrix", matrix: WK_BILD_2_12 } },
    { id: "G-L2", text: "Weber/Koch Bild 2.12: Z-Y-X A = −60°, B = −90°, C = −90°", inp: { rep: "zyx", zyx: { A: rad(-60), B: rad(-90), C: rad(-90) } } },
    { id: "G-L3", text: "Weber/Koch Bild 2.12: Z-Y-Z φ = 30°, θ = 90°, ψ = 180°", inp: { rep: "zyz", zyz: { phi: rad(30), theta: rad(90), psi: rad(180) } } },
    { id: "G-L4", text: "Lynch/Park Bsp. 3.12: ω̂ = (0; 0,866; 0,5), θ = 30°", inp: { rep: "axis", axis: { axis: [0, S3, 0.5], theta: rad(30) } } },
    { id: "G-L5", text: "Lynch/Park Abb. 3.7: R_b = Rot(z, 90°), p_b = (1; −1; 0) m, danach Drehung um y_b um −90° (ergibt R_c)",
      inp: { rep: "zyx", zyx: { A: rad(90), B: 0, C: 0 }, pb: [1, -1, 0], extra: { frame: "mitgedreht", axis: "y", angle: rad(-90) } } },
    { id: "G-L6", text: "Weber/Koch Bild 2.16 b: Drehung um z um α = 30° als Quaternion (cos 15°, 0, 0, sin 15°)", inp: { rep: "quat", quat: { w: Math.cos(rad(15)), x: 0, y: 0, z: Math.sin(rad(15)) } } },
    { id: "G-S1", text: "Kardansperre B = +90°: A = 30°, B = 90°, C = 20°", inp: { rep: "zyx", zyx: { A: rad(30), B: rad(90), C: rad(20) } } },
    { id: "G-S2", text: "Z-Y-Z Sonderfall θ = 0: φ = 40°, θ = 0°, ψ = 25°", inp: { rep: "zyz", zyz: { phi: rad(40), theta: 0, psi: rad(25) } } },
    { id: "G-S3", text: "Z-Y-Z Sonderfall θ = 180°: φ = 40°, θ = 180°, ψ = 25°", inp: { rep: "zyz", zyz: { phi: rad(40), theta: rad(180), psi: rad(25) } } },
    { id: "G-S4", text: "Keine Drehung: A = B = C = 0", inp: { rep: "zyx", zyx: { A: 0, B: 0, C: 0 } } },
    { id: "G-S5", text: "Achse y, θ = 170° (Quaternion-Zweig r_22)", inp: { rep: "axis", axis: { axis: [0, 1, 0], theta: rad(170) } } },
    { id: "G-S6", text: "Achse z, θ = 170° (Quaternion-Zweig r_33), danach Drehung um x_a um 45° (feste Achse)",
      inp: { rep: "axis", axis: { axis: [0, 0, 1], theta: rad(170) }, extra: { frame: "fest", axis: "x", angle: rad(45) } } },
  ];
}

/** Verkettung Lynch/Park Abb. 3.7: R_ac = R_ab·R_bc mit R_ab = R_b, R_bc = R_bᵀ·R_c. */
export function kinematikVerkettung(): { text: string; Rab: Mat3; Rbc: Mat3 } {
  return { text: "Lynch/Park Abb. 3.7: R_ab = Rot(z, 90°), R_bc = Rot(y, −90°), R_ac = R_ab·R_bc", Rab: LP_ABB_3_7.Rb, Rbc: mul(transpose(LP_ABB_3_7.Rb), LP_ABB_3_7.Rc) };
}
