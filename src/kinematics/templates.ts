/**
 * Vorlagen für Blatt K2 (Modul kinematik, ab 0.14.0): ISO-Zelle und Literaturbeispiele mit Fundstelle.
 * Dieselben Zahlen prüft verification/kinematik.py (Fälle G-K2-…) gegen die gedruckten Werte; die Oberfläche
 * übernimmt sie unverändert (keine Zahlen in der App).
 *
 * Längen ohne Einheit im Buch werden mit `unit` in m umgerechnet und so angezeigt (Hinweis in `unitNote`).
 */
import { rad, type Vec3 } from "./so3";
import type { FrameDef, FrameInput } from "./frames";
import type { Mat4 } from "./se3";

export interface FrameTemplate {
  id: string;
  title: string;
  source: string;
  /** Länge einer Buch-Einheit in m (1 bei echten Längen). */
  unit: number;
  unitNote: string;
  input: FrameInput;
}

const S = Math.SQRT1_2;
/** 4×4 aus R (zeilenweise) und p in Buch-Einheiten, p skaliert mit u. */
const M = (R: number[][], p: [number, number, number], u: number): Mat4 => [[...R[0]!, p[0] * u], [...R[1]!, p[1] * u], [...R[2]!, p[2] * u], [0, 0, 0, 1]];
const v = (x: Vec3, u: number): Vec3 => [x[0] * u, x[1] * u, x[2] * u];

/** ISO 9787: Welt, Basis, Flansch, Werkzeug, Aufgabe (eigener Fall, Zahlen frei gewählt, gegengerechnet). */
export const ISO_ZELLE: FrameDef[] = [
  { id: "0", name: "Welt", role: "welt", parent: null },
  { id: "1", name: "Basis", role: "basis", parent: "0", pose: { x: 0.8, y: 0.4, z: 0.5, A: rad(90), B: 0, C: 0 } },
  { id: "m", name: "Flansch", role: "flansch", parent: "1", pose: { x: 1.2, y: 0.1, z: 0.9, A: rad(30), B: 0, C: rad(180) } },
  { id: "t", name: "Werkzeug", role: "werkzeug", parent: "m", pose: { x: 0.03, y: 0, z: 0.2, A: 0, B: rad(15), C: 0 } },
  { id: "k", name: "Aufgabe", role: "aufgabe", parent: "0", pose: { x: 2.0, y: 0.6, z: 0.8, A: rad(-90), B: 0, C: 0 } },
];

export function frameTemplates(): FrameTemplate[] {
  const u2 = 0.1; // W/K Bild 2.11 und L/P Abb. 3.14, 3.15: 1 Einheit = 100 mm
  const u3 = 1e-3; // L/P Bsp. 3.19: 1 Einheit = 1 mm
  return [
    {
      id: "iso", title: "ISO-Zelle: Welt, Basis, Flansch, Werkzeug, Aufgabe", source: "ISO 9787:2013, 5.1 bis 5.6 (eigener Fall)", unit: 1, unitNote: "Längen in mm",
      input: { frames: ISO_ZELLE, rel: { of: "t", in: "k" }, point: { frame: "t", v: [0, 0, 0.05], kind: "punkt" },
        tcpTarget: { x: 2.1, y: 0.7, z: 0.85, A: 0, B: 0, C: rad(180) } },
    },
    {
      id: "wk211", title: "Weber/Koch Bild 2.11: Punkt und freier Vektor", source: "Weber/Koch Kap. 2.1.7, Gl. (2.13), (2.14), (2.16), Bild 2.11", unit: u2,
      unitNote: "Buch ohne Einheit, hier 1 Einheit = 100 mm",
      input: {
        frames: [
          { id: "i", name: "K_i", role: "frei", parent: null },
          { id: "k", name: "K_k", role: "frei", parent: "i", matrix: M([[0, 0, -1], [-1, 0, 0], [0, 1, 0]], [0, 4, 2], u2) },
        ],
        rel: { of: "i", in: "k" }, point: { frame: "k", v: v([-2, -1, 0], u2), kind: "punkt" },
      },
    },
    {
      id: "lp314", title: "Lynch/Park Abb. 3.14: drei Rahmen und ein Punkt", source: "Lynch/Park Kap. 3.3.1.2, Abb. 3.14, S. 78", unit: u2,
      unitNote: "Buch ohne Einheit, hier 1 Einheit = 100 mm",
      input: {
        frames: [
          { id: "s", name: "{s} = {a}", role: "frei", parent: null },
          { id: "b", name: "{b}", role: "frei", parent: "s", matrix: M([[0, 0, 1], [0, -1, 0], [1, 0, 0]], [0, -2, 0], u2) },
          { id: "c", name: "{c}", role: "frei", parent: "s", matrix: M([[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [-1, 1, 0], u2) },
        ],
        rel: { of: "c", in: "b" }, point: { frame: "b", v: v([0, 0, 1.5], u2), kind: "punkt" },
      },
    },
    {
      id: "lp315", title: "Lynch/Park Abb. 3.15: Verschieben fest und mitgedreht", source: "Lynch/Park Gl. (3.66), (3.67), Abb. 3.15, S. 79 f.", unit: u2,
      unitNote: "Buch ohne Einheit, hier 1 Einheit = 100 mm",
      input: {
        frames: [
          { id: "s", name: "{s}", role: "frei", parent: null },
          { id: "b", name: "{b}", role: "frei", parent: "s", matrix: M([[0, 0, 1], [0, -1, 0], [1, 0, 0]], [0, -2, 0], u2) },
        ],
        displace: { frame: "b", mode: "fest", axis: [0, 0, 1], theta: rad(90), p: v([0, 2, 0], u2) },
      },
    },
    {
      id: "lp319", title: "Lynch/Park Bsp. 3.19: Kamera, Fahrplattform, Greifer, Objekt", source: "Lynch/Park Bsp. 3.19, Abb. 3.16, S. 80 f.", unit: u3,
      unitNote: "Buch ohne Einheit, hier 1 Einheit = 1 mm",
      input: {
        frames: [
          { id: "a", name: "{a} fest", role: "frei", parent: null },
          { id: "d", name: "{d} Kamera", role: "frei", parent: "a", matrix: M([[0, 0, -1], [0, -1, 0], [-1, 0, 0]], [400, 50, 300], u3) },
          { id: "b", name: "{b} Plattform", role: "frei", parent: "d", matrix: M([[0, 0, -1], [0, -1, 0], [-1, 0, 0]], [250, -150, 200], u3) },
          { id: "c", name: "{c} Greifer", role: "frei", parent: "b", matrix: M([[0, -S, -S], [0, S, -S], [1, 0, 0]], [30, -40, 25], u3) },
          { id: "e", name: "{e} Objekt", role: "frei", parent: "d", matrix: M([[0, 0, -1], [0, -1, 0], [-1, 0, 0]], [300, 100, 120], u3) },
        ],
        rel: { of: "e", in: "c" },
      },
    },
  ];
}
