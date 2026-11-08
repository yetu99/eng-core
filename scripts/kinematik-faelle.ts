/**
 * Beispielfälle Kinematik K1 Orientierung (Modul kinematik) für den Formelkatalog (scripts/katalog.ts).
 * Jeder Fall erzeugt seine Formeln einmal mit nachrechenbarem Beispiel. Literaturfälle zuerst; dieselben Zahlen
 * prüft verification/kinematik.py (Fälle G-L1 bis G-L6) gegen die gedruckten Werte.
 */
import { rad, rotZ, rotY, so3, frameTemplates, robotTemplates, type Mat3, type OrientationInput, type FrameInput, type ForwardInput } from "../src/index";

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

// ---------------------------------------------------------------- K2 Homogene Transformation (0.14.0)
export interface KinematikK2Fall { id: string; text: string; inp: FrameInput }

/**
 * Beispielfälle Kinematik K2 für den Formelkatalog: Vorlagen aus src/kinematics/templates.ts (Literatur zuerst),
 * dazu freier Vektor, mitgedrehtes Verschieben und ein Rahmen aus R und p, damit alle 22 Formeln G-13 bis G-20
 * mit Beispiel vorkommen. Dieselben Zahlen prüft verification/kinematik.py (Fälle G-K2-…).
 */
export function kinematikK2Faelle(): KinematikK2Fall[] {
  const t = Object.fromEntries(frameTemplates().map((x) => [x.id, x]));
  const wk = t["wk211"]!, lp314 = t["lp314"]!, lp315 = t["lp315"]!, lp319 = t["lp319"]!, iso = t["iso"]!;
  return [
    { id: "G-K2-L1", text: `${wk.title}: Ortsvektor u_kP = (−2, −1, 0) in K_k, Lage von K_i in K_k (${wk.unitNote})`, inp: wk.input },
    { id: "G-K2-L2", text: `${lp314.title}: T_bc und v_b = (0, 0, 1,5) (${lp314.unitNote})`, inp: lp314.input },
    { id: "G-K2-L3", text: `${lp315.title}: Rot(ẑ, 90°), p = (0, 2, 0), fest (${lp315.unitNote})`, inp: lp315.input },
    { id: "G-K2-L4", text: `${lp315.title}: mitgedreht (${lp315.unitNote})`, inp: { ...lp315.input, displace: { ...lp315.input.displace!, mode: "mitgedreht" } } },
    { id: "G-K2-L5", text: `${lp319.title}: T_ce (${lp319.unitNote})`, inp: lp319.input },
    { id: "G-K2-L6", text: `Weber/Koch Bild 2.11: freier Vektor a_k = (1, 2, 0) (${wk.unitNote})`, inp: { frames: wk.input.frames, point: { frame: "k", v: [0.1, 0.2, 0], kind: "richtung" } } },
    { id: "G-K2-S1", text: `${iso.title}: T_0t, Werkzeug in Aufgabe, Flansch-Soll für TCP-Soll (2100; 700; 850) mm, C = 180°`, inp: iso.input },
    { id: "G-K2-S2", text: "Rahmen aus R (Weber/Koch Bild 2.12, Blatt K1) und p = (100; 200; 300) mm", inp: {
      frames: [{ id: "0", name: "K_0", role: "welt", parent: null }, { id: "W", name: "K_W", role: "frei", parent: "0", rp: { R: WK_BILD_2_12, p: [0.1, 0.2, 0.3] } }],
      rel: { of: "0", in: "W" } } },
  ];
}

// ---------------------------------------------------------------- K3 DH-Parameter und Vorwärtskinematik (0.16.0)
export interface KinematikK3Fall { id: string; text: string; inp: ForwardInput }

/**
 * Beispielfälle Kinematik K3 für den Formelkatalog: Vorlagen aus src/kinematics/robots.ts in der Stellung der Quelle,
 * Literatur zuerst, mit Umrechnung (G-27), damit alle 14 Formeln G-21 bis G-27 mit Beispiel vorkommen.
 * Dieselben Zahlen prüft verification/kinematik.py (Fälle G-K3-…).
 */
export function kinematikK3Faelle(): KinematikK3Fall[] {
  const t = Object.fromEntries(robotTemplates().map((x) => [x.robot.id, x]));
  const f = (id: string, key: string, text: string, extra: Partial<ForwardInput> = {}): KinematikK3Fall => {
    const r = t[key]!.robot;
    return { id, text: `${r.name}: ${text} (${r.source})`, inp: { robot: r, q: [...r.qSource!], convert: true, ...extra } };
  };
  return [
    f("G-K3-L1", "r612", "Zeichenstellung θ₁ = 0°, θ₂ = −90°, l₁₁ = 300 mm, l₂ = 500 mm gewählt"),
    f("G-K3-L2", "scara", "q = (30°, 45°, 120 mm, −60°), l₁ = 350 mm, l₂ = 250 mm gewählt"),
    f("G-K3-L5", "ur5", "θ = (0, −90°, 0, 0, 90°, 0), Längen aus dem Buch"),
    f("G-K3-L7", "rrt", "θ₁ = 90°, θ₂ = 0°, d₃ = 500 mm, Punkt p_H = (−500; 250; −400) mm in K₃ (Aufgabe 2.3.5)", { q: [Math.PI / 2, 0, 0.5], point: { frame: 3, v: [-0.5, 0.25, -0.4] } }),
    f("G-K3-P1", "2r", "θ₁ = −45°, θ₂ = 135°, l₁ = 500 mm, l₂ = 400 mm gewählt"),
    f("G-K3-E1", "kartesisch", "q = (400; 300; 200) mm, Basis Rot_y(90°)"),
    f("G-K3-E2", "rv6", "Zeichenstellung, Längen gewählt"),
    f("G-K3-L4", "lp-c1", "Nullstellung, L₁ = 400 mm, L₂ = 300 mm gewählt"),
    f("G-K3-P2", "lp-c2", "q = (0, 0, 0, 200 mm), L₂ = 400 mm gewählt"),
  ];
}
