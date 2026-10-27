/**
 * Kerben an Rundstäben: Formzahl α_k und bezogenes Spannungsgefälle G′ (eng-core 0.9.0).
 * Quelle: Roloff/Matek Maschinenelemente 27. Aufl. 2025, TB 3-6 c bis f (Formzahlen, Näherung nach DIN 743-2),
 * TB 3-7a (Spannungsgefälle). Eigene Umsetzung. Längen in mm, G′ in 1/mm.
 *
 * Bezeichnungen: d = Durchmesser im Kerbgrund, D = größerer Durchmesser (Absatz) bzw. Wellendurchmesser (Nut),
 * t = Kerbtiefe = (D − d)/2, r = Kerbradius; Querbohrung: d = Wellendurchmesser, r = Bohrungsradius.
 */
import { fmt } from "../format";

export type LoadComp = "zd" | "b" | "t";
export const COMP_LABEL: Record<LoadComp, string> = { zd: "Zug/Druck", b: "Biegung", t: "Torsion" };
const SUF: Record<LoadComp, string> = { zd: "Z", b: "B", t: "T" };

export type NotchInput =
  | { type: "none" }
  | { type: "absatz"; D: number; r: number }
  | { type: "nut"; t: number; r: number }
  | { type: "bohrung"; dB: number }
  | { type: "alpha"; alpha: Partial<Record<LoadComp, number>>; G?: Partial<Record<LoadComp, number>>; ref?: string }
  | { type: "beta"; beta: Partial<Record<LoadComp, number>>; ref?: string };

/** Geometrie einer Rundkerbe nach Auflösung gegen den Blatt-1-Querschnitt. */
export interface NotchGeom { kind: "absatz" | "nut" | "bohrung"; d: number; D: number; t: number; r: number }

interface AKConst { A: number; B: number; C: number; z: number }
const ABSATZ: Record<LoadComp, AKConst> = { zd: { A: 0.62, B: 3.5, C: 0, z: 0 }, b: { A: 0.62, B: 5.8, C: 0.2, z: 3 }, t: { A: 3.4, B: 19, C: 1, z: 2 } };
const NUT: Record<LoadComp, AKConst> = { zd: { A: 0.22, B: 1.37, C: 0, z: 0 }, b: { A: 0.2, B: 2.75, C: 0, z: 0 }, t: { A: 0.7, B: 10.3, C: 0, z: 0 } };

export interface AlphaResult { alpha: number; id: string; formula: string; subst: string; errors: string[]; ref: string }

const n = (x: number) => fmt(x, 4);

/** Formzahl α_k je Beanspruchung. Gültigkeit Absatz, Nut: r/t ≥ 0,03, d/D ≤ 0,98, α_k ≤ 6; Querbohrung d_B/d ≤ 0,4. */
export function alphaK(g: NotchGeom, c: LoadComp): AlphaResult {
  const errors: string[] = [];
  if (g.kind === "bohrung") {
    const x = 2 * g.r / g.d;
    if (!(x > 0) || x > 0.4) errors.push(`Querbohrung: d_B/d = ${fmt(x, 3)} außerhalb 0 < d_B/d ≤ 0,4 (TB 3-6e)`);
    const f = { zd: "α_k = 3 − d_B/d", b: "α_k = 3 + 1,4·(d_B/d) − 2,8·√(d_B/d)", t: "α_k = 2,023 − 1,125·√(d_B/d)" }[c];
    const a = { zd: 3 - x, b: 3 + 1.4 * x - 2.8 * Math.sqrt(x), t: 2.023 - 1.125 * Math.sqrt(x) }[c];
    return { alpha: a, id: `E-AK-Q${SUF[c]}`, formula: `${f}  (Querbohrung, ${COMP_LABEL[c]})`, subst: `d_B/d = ${n(2 * g.r)} / ${n(g.d)} = ${n(x)}`, errors, ref: "Roloff/Matek 27 TB 3-6e" };
  }
  const k = (g.kind === "absatz" ? ABSATZ : NUT)[c];
  const { d, D, t, r } = g;
  if (!(t > 0) || !(r > 0)) errors.push("Kerbe: t und r müssen größer als 0 sein");
  else {
    if (r / t < 0.03) errors.push(`Kerbe: r/t = ${fmt(r / t, 3)} < 0,03 (TB 3-6)`);
    if (d / D > 0.98) errors.push(`Kerbe: d/D = ${fmt(d / D, 3)} > 0,98 (TB 3-6)`);
  }
  const den = k.A * r / t + 2 * k.B * (r / d) * (1 + 2 * r / d) ** 2 + (k.C ? k.C * (r / t) ** k.z * d / D : 0);
  const a = 1 + 1 / Math.sqrt(den);
  if (a > 6) errors.push(`Formzahl α_k = ${fmt(a, 3)} > 6 (außerhalb TB 3-6)`);
  const cTerm = k.C ? ` + ${String(k.C).replace(".", ",")}·(r/t)^${k.z}·d/D` : "";
  const formula = `α_k = 1 + 1/√(${String(k.A).replace(".", ",")}·r/t + 2·${String(k.B).replace(".", ",")}·(r/d)·(1 + 2r/d)²${cTerm})  (${g.kind === "absatz" ? "Absatz" : "Umlaufnut"}, ${COMP_LABEL[c]})`;
  const subst = `D = ${n(D)}, d = ${n(d)}, t = ${n(t)}, r = ${n(r)} mm`;
  return { alpha: a, id: `E-AK-${g.kind === "absatz" ? "A" : "N"}${SUF[c]}`, formula, subst, errors, ref: g.kind === "absatz" ? "Roloff/Matek 27 TB 3-6d, f" : "Roloff/Matek 27 TB 3-6c" };
}

/** Hilfsgröße φ für das Spannungsgefälle (TB 3-7a): φ = 1/(√(8(D − d)/r) + 2) für (D − d)/d ≤ 0,5, sonst 0. */
export function phiOf(g: NotchGeom): number {
  return (g.D - g.d) / g.d <= 0.5 ? 1 / (Math.sqrt(8 * (g.D - g.d) / g.r) + 2) : 0;
}

export interface GResult { G: number; id: string; formula: string; subst: string }

/** Bezogenes Spannungsgefälle G′ (TB 3-7a, Querbohrung TB 3-6e). */
export function gradientOf(g: NotchGeom, c: LoadComp): GResult {
  const { r, d } = g;
  if (g.kind === "bohrung") {
    const v = { zd: 2.3 / r, b: 2.3 / r + 2 / d, t: 1.15 / r + 2 / d }[c];
    const f = { zd: "G′ = 2,3/r", b: "G′ = 2,3/r + 2/d", t: "G′ = 1,15/r + 2/d" }[c];
    return { G: v, id: `E-GS-Q${SUF[c]}`, formula: `${f}  (Querbohrung)`, subst: `r = ${n(r)}, d = ${n(d)} mm`, };
  }
  const phi = phiOf(g);
  if (g.kind === "absatz") {
    if (c === "t") return { G: 1.15 / r, id: "E-GS-AT", formula: "G′ = 1,15/r  (Absatz, Torsion)", subst: `r = ${n(r)} mm` };
    return { G: 2.3 * (1 + phi) / r, id: "E-GS-AZB", formula: "G′ = 2,3·(1 + φ)/r  (Absatz, Zug/Druck und Biegung)", subst: `φ = ${n(phi)}, r = ${n(r)} mm` };
  }
  if (c === "t") return { G: 1 / r, id: "E-GS-NT", formula: "G′ = 1/r  (Umlaufnut, Torsion)", subst: `r = ${n(r)} mm` };
  return { G: 2 * (1 + phi) / r, id: "E-GS-NZB", formula: "G′ = 2·(1 + φ)/r  (Umlaufnut, Zug/Druck und Biegung)", subst: `φ = ${n(phi)}, r = ${n(r)} mm` };
}

/** Kurvenschar α_k für die Auswahlhilfe (Diagramm in Blatt 3): rechnet nur mit {@link alphaK}, keine eigene Formel. */
export interface AlphaKCurve {
  /** Parameter D/d der Kurve (Querbohrung: 0) */
  ratio: number;
  /** true für die Kurve durch den aktuellen Punkt */
  current: boolean;
  /** Stützstellen; valid = innerhalb der Gültigkeit von TB 3-6 */
  pts: { x: number; alpha: number; valid: boolean }[];
}
export interface AlphaKChart {
  kind: NotchGeom["kind"];
  c: LoadComp;
  /** Abszisse: r/t (Absatz, Nut, logarithmisch) bzw. d_B/d (Querbohrung, linear) */
  xLabel: string;
  log: boolean;
  xMin: number;
  xMax: number;
  curves: AlphaKCurve[];
  /** aktueller Punkt aus der Eingabe (null ohne Geometrie) */
  point: { x: number; ratio: number; alpha: number; valid: boolean } | null;
  ref: string;
}

/** Standardparameter D/d der Kurvenschar. */
export const ALPHAK_RATIOS = [1.05, 1.1, 1.2, 1.5, 2, 3] as const;

/**
 * Kurvenschar α_k(r/t) mit D/d als Parameter (Absatz, Umlaufnut) bzw. α_k(d_B/d) (Querbohrung).
 * Für die Kurven gilt d = 1 (dimensionslos), t = (D − d)/2, r = x·t. Liegt der aktuelle Punkt auf keinem
 * Standardparameter, kommt seine Kurve dazu (current = true).
 */
export function alphaKChart(kind: NotchGeom["kind"], c: LoadComp, geom: NotchGeom | null, nPts = 160): AlphaKChart {
  const ref = kind === "bohrung" ? "Roloff/Matek 27 TB 3-6e" : kind === "absatz" ? "Roloff/Matek 27 TB 3-6d, f" : "Roloff/Matek 27 TB 3-6c";
  const cur = geom && geom.kind === kind ? geom : null;
  if (kind === "bohrung") {
    const xMin = 0.005, xMax = 0.4;
    const pts = Array.from({ length: nPts }, (_, i) => {
      const x = xMin + ((xMax - xMin) * i) / (nPts - 1);
      const a = alphaK({ kind: "bohrung", d: 1, D: 1, t: x / 2, r: x / 2 }, c);
      return { x, alpha: a.alpha, valid: a.errors.length === 0 };
    });
    const point = cur ? (() => { const a = alphaK(cur, c); return { x: (2 * cur.r) / cur.d, ratio: 0, alpha: a.alpha, valid: a.errors.length === 0 }; })() : null;
    return { kind, c, xLabel: "d_B/d", log: false, xMin, xMax, curves: [{ ratio: 0, current: point !== null, pts }], point, ref };
  }
  const xMin = 0.02, xMax = 3;
  const curRatio = cur ? cur.D / cur.d : null;
  const ratios: number[] = [...ALPHAK_RATIOS];
  if (curRatio !== null && !ratios.some((q) => Math.abs(q - curRatio) < 1e-9)) ratios.push(curRatio);
  ratios.sort((a, b) => a - b);
  const curves = ratios.map((q) => {
    const t = (q - 1) / 2;
    const pts = Array.from({ length: nPts }, (_, i) => {
      const x = xMin * (xMax / xMin) ** (i / (nPts - 1));
      const a = alphaK({ kind, d: 1, D: q, t, r: x * t }, c);
      return { x, alpha: a.alpha, valid: a.errors.length === 0 };
    });
    return { ratio: q, current: curRatio !== null && Math.abs(q - curRatio) < 1e-9, pts };
  });
  const point = cur ? (() => { const a = alphaK(cur, c); return { x: cur.r / cur.t, ratio: cur.D / cur.d, alpha: a.alpha, valid: a.errors.length === 0 }; })() : null;
  return { kind, c, xLabel: "r/t", log: true, xMin, xMax, curves, point, ref };
}
