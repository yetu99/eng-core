/**
 * Vorlagen für Blatt K3 (Modul kinematik, ab 0.16.0): Roboter als DH-Tabelle mit Fundstelle. Dieselben Zahlen prüft
 * verification/kinematik.py (Fälle G-K3-…) gegen die gedruckten Werte bzw. gegen eine unabhängige Rechnung; die
 * Oberfläche übernimmt sie unverändert (keine Zahlen in der App).
 *
 * Längen in m, Winkel in rad. Längen, die die Quelle nur als Formelzeichen nennt, sind gewählt und so gekennzeichnet.
 * Tabellen von Weber/Koch werden mit Offset 0 übernommen; die Spalte θ des Buchs ist dann die Stellung der Quelle (qSource).
 */
import { rad } from "./so3";
import type { DhJoint, Robot } from "./dh";

const R180 = rad(180);
/** Drehgelenk mit Offset θ_0, Grenzen in Grad. */
const R = (theta: number, d: number, a: number, alpha: number, lim = 180, label?: string): DhJoint =>
  ({ type: "R", theta, d, a, alpha, qMin: rad(-lim), qMax: rad(lim), ...(label ? { label } : {}) });
/** Schubgelenk mit Offset d_0, Grenzen in m. */
const P = (theta: number, d: number, a: number, alpha: number, qMin: number, qMax: number, label?: string): DhJoint =>
  ({ type: "P", theta, d, a, alpha, qMin, qMax, ...(label ? { label } : {}) });

export interface RobotTemplate {
  robot: Robot;
  /** Gruppe in der Auswahl */
  group: "Bauform" | "Lehrbeispiel";
  /** Kurztext zur Herkunft der Zahlen */
  note: string;
}

/** UR5 nach Lynch/Park Bsp. 4.5 (Längen aus dem Buch, S. 125). */
export const UR5 = { H1: 0.089, L1: 0.425, L2: 0.392, W1: 0.109, H2: 0.095, W2: 0.082 } as const;

export function robotTemplates(): RobotTemplate[] {
  const { H1, L1, L2, W1, H2, W2 } = UR5;
  return [
    {
      group: "Bauform", note: "Struktur Weber/Koch Bild 3.5; Längen l₁ = 500 mm, l₂ = 400 mm gewählt; Stellung aus Aufgabe 2.3.6",
      robot: { id: "2r", name: "2R planar", convention: "klassisch", source: "Weber/Koch Bild 3.5, S. 54; Aufgabe 2.3.6 (θ₁ = −45°, θ₂ = 135°)",
        joints: [R(0, 0, 0.5, 0, 180, "A1"), R(0, 0, 0.4, 0, 180, "A2")], qSource: [rad(-45), rad(135)] },
    },
    {
      group: "Bauform", note: "Tabelle Weber/Koch Bild 3.8 (z₀ zeigt nach unten); Längen l₁ = 350 mm, l₂ = 250 mm und Grenzen gewählt",
      robot: { id: "scara", name: "SCARA", convention: "klassisch", source: "Weber/Koch Bild 3.8, Gl. (3.8), S. 55",
        joints: [R(0, 0, 0.35, 0, 150, "A1"), R(0, 0, 0.25, 0, 150, "A2"), P(0, 0, 0, 0, 0, 0.2, "A3"), R(0, 0, 0, 0, 180, "A4")],
        qSource: [rad(30), rad(45), 0.12, rad(-60)] },
    },
    {
      group: "Bauform", note: "eigene Tabelle (gekennzeichnet): z₀ entlang Achse 1, Basis Rot_y(90°) dreht K₀ in die Welt; Ergebnis p = (q₁, q₂, q₃), R = I",
      robot: { id: "kartesisch", name: "Kartesisch (Portal)", convention: "klassisch", source: "eigener Fall nach den Regeln Weber/Koch Kap. 2.2.2",
        base: { x: 0, y: 0, z: 0, A: 0, B: rad(90), C: 0 },
        joints: [P(0, 0, 0, rad(-90), 0, 1, "X"), P(rad(-90), 0, 0, rad(90), 0, 1, "Y"), P(0, 0, 0, 0, 0, 1, "Z")], qSource: [0.4, 0.3, 0.2] },
    },
    {
      group: "Bauform", note: "Tabelle Weber/Koch Bild 2.26 (RV6); Längen l₁₁ = 150, l₂ = 600, l₄ = 650, l₆ = 100 mm gewählt; Stellung = Zeichenstellung",
      robot: { id: "rv6", name: "6-Achs-Knickarm mit Zentralhand", convention: "klassisch", source: "Weber/Koch Bild 2.26, S. 45",
        joints: [R(0, 0, 0.15, rad(-90), 180, "A1"), R(0, 0, 0.6, 0, 180, "A2"), R(0, 0, 0, rad(90), 180, "A3"),
          R(0, 0.65, 0, rad(90), 180, "A4"), R(0, 0, 0, rad(-90), 180, "A5"), R(0, 0.1, 0, 0, 180, "A6")],
        qSource: [0, rad(-90), R180, R180, 0, rad(-90)] },
    },
    {
      group: "Bauform", note: "Längen aus Lynch/Park Bsp. 4.5; DH-Tabelle eigene Herleitung (gekennzeichnet), gegen die Schraubenachsen des Buchs geprüft",
      robot: { id: "ur5", name: "UR5 (modifiziert)", convention: "modifiziert", source: "Lynch/Park Bsp. 4.5, Abb. 4.6, 4.7, S. 125 f.",
        joints: [R(0, H1, 0, 0, 360, "1"), R(0, 0, 0, rad(-90), 360, "2"), R(0, 0, L1, 0, 360, "3"), R(0, W1, L2, 0, 360, "4"), R(0, H2, 0, rad(-90), 360, "5"), R(0, 0, 0, rad(90), 360, "6")],
        tool: { x: 0, y: 0, z: W2, A: R180, B: 0, C: 0 }, qSource: [0, rad(-90), 0, 0, rad(90), 0] },
    },
    {
      group: "Bauform", note: "Längen aus Lynch/Park Bsp. 4.5; klassische Tabelle mit UR-Struktur (a negativ), Basis Rot_z(180°); gleiche Endlage wie die modifizierte Tabelle",
      robot: { id: "ur5-kl", name: "UR5 (klassisch)", convention: "klassisch", source: "Lynch/Park Bsp. 4.5, Abb. 4.6, 4.7, S. 125 f.",
        base: { x: 0, y: 0, z: 0, A: R180, B: 0, C: 0 },
        joints: [R(0, H1, 0, rad(90), 360, "1"), R(0, 0, -L1, 0, 360, "2"), R(0, 0, -L2, 0, 360, "3"), R(0, W1, 0, rad(90), 360, "4"), R(0, H2, 0, rad(-90), 360, "5"), R(0, W2, 0, 0, 360, "6")],
        qSource: [0, rad(-90), 0, 0, rad(90), 0] },
    },
    {
      group: "Lehrbeispiel", note: "Tabelle Weber/Koch Bild 2.22; Längen l₁₁ = 300 mm, l₂ = 500 mm gewählt; Stellung = Zeichenstellung (S. 47)",
      robot: { id: "r612", name: "Zweigelenkroboter R6-12", convention: "klassisch", source: "Weber/Koch Bild 2.22, S. 43 bis 47",
        joints: [R(0, 0, 0.3, rad(-90)), R(0, 0, 0.5, 0)], qSource: [0, rad(-90)] },
    },
    {
      group: "Lehrbeispiel", note: "Tabelle Weber/Koch Bild 2.24; l₁ = 1000 mm und d₃ = 500 mm aus Aufgabe 2.3.5; Stellung = Zeichenstellung",
      robot: { id: "rrt", name: "RRT-Roboter", convention: "klassisch", source: "Weber/Koch Bild 2.24, S. 44; Aufgabe 2.3.5",
        joints: [R(0, -1, 0, rad(90)), R(0, 0, 0, rad(90)), P(0, 0, 0, 0, 0, 1)], qSource: [R180, rad(-90), 0.5] },
    },
    {
      group: "Lehrbeispiel", note: "Tabelle Lynch/Park Bsp. C.1 (Offset θ₂ − 90°); L₁ = 400 mm, L₂ = 300 mm gewählt; Nullstellung = M aus Bsp. 4.1",
      robot: { id: "lp-c1", name: "3R räumlich", convention: "modifiziert", source: "Lynch/Park Bsp. C.1, Abb. 4.3, S. 511 f.; Bsp. 4.1",
        joints: [R(0, 0, 0, 0), R(rad(-90), 0, 0.4, rad(90)), R(0, 0, 0.3, rad(-90))], qSource: [0, 0, 0] },
    },
    {
      group: "Lehrbeispiel", note: "Tabelle Lynch/Park Abb. C.4 (Offset θ₃ + 90°, Schubgelenk 4); L₂ = 400 mm und Hub 0 bis 500 mm gewählt",
      robot: { id: "lp-c2", name: "RRRP räumlich", convention: "modifiziert", source: "Lynch/Park Bsp. C.2, Abb. C.4, S. 512",
        joints: [R(0, 0, 0, 0), R(0, 0, 0, rad(90)), R(rad(90), 0, 0.4, 0), P(0, 0, 0, rad(90), 0, 0.5)], qSource: [0, 0, 0, 0.2] },
    },
  ];
}
