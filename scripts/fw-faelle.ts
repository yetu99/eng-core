/**
 * Prüf- und Katalogfälle Fachwerk (Modul stabwerke, eng-core 0.23.0), Konzept fachtools/konzept_fw.md Abschn. 5 und 8.
 * Gemeinsam genutzt von scripts/katalog.ts, verification/stabwerke.py (über fw_faelle.json, engine_out/eval) und test/fachwerk.test.ts.
 * Nur Eingaben (Geometrie mit den Maßen der Quelle, Lasten in kN); die Sollwerte der Literatur stehen in verification/stabwerke.py.
 * Einheiten mm, kN, MPa. Fref [N] und uref [mm] sind die Bezugsgrößen der Quelle (Kraft F bzw. F·a/(E·A)).
 */
import { trussPreset, trussChordNodes, type TrussBarInput, type TrussInput } from "../src/index";

export interface FwFall { id: string; label: string; inp: TrussInput; Fref: number; uref: number; dual: boolean }

const EA = (A: number, E = 2e5, extra: Partial<TrussBarInput> = {}) => ({ A, E, ...extra });
const B = (i: number, j: number, name: string, p: Pick<TrussBarInput, "A" | "E"> & Partial<TrussBarInput>): TrussBarInput => ({ i, j, name, ...p });
const S = { A: 100, E: 2e5, Rp: 235, iGyr: 10 };

/** Dreieck aus dem Konzept Abschn. 1 (Festlager, Loslager, F = 10 N): S = 5,000; −7,071; −7,071 N. */
const dreieck = trussPreset("dreieck", S, { F: 0.01 });

/** Gross TM 1 Bsp. 6.1 (S. 144 f.): l = 1000 mm, F = 10 kN am Knoten V. */
const g61 = trussPreset("gross61", S, { height: 1000, F: 10 });

/** Gross TM 1 Bsp. 6.3 (S. 150 bis 152): Pendelstützen A, C senkrecht, B unter 45°; F₁ = 2F nach links an II, F₂ = F an III; a = 1000 mm, F = 1 kN. */
const a = 1000;
const g63: TrussInput = {
  nodes: [[0, 0], [a, a], [2 * a, 0], [3 * a, a], [4 * a, 0], [5 * a, a], [6 * a, 0], [6 * a, a]].map(([x, y], i) => ({ x: x!, y: y!, name: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][i]! })),
  bars: ([[0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5], [4, 6], [5, 6], [5, 7], [6, 7]] as const).map(([i, j], k) => B(i, j, `${k + 1}`, S)),
  supports: [{ node: 0, type: "los", angleDeg: 270 }, { node: 4, type: "los", angleDeg: -45 }, { node: 6, type: "los", angleDeg: 270 }],
  loads: [{ node: 1, Fx: -2, Fy: 0 }, { node: 2, Fx: 0, Fy: -1 }],
};

/** Gross TM 1 Bsp. 6.4 (S. 154 f.): F₁ = 2F an der Spitze, F₂ = F nach links; a = 1000 mm, F = 1 kN. Stabnummern 4, 5, 6 wie Quelle, übrige eigene. */
const g64: TrussInput = {
  nodes: [{ x: 0, y: 0, name: "A" }, { x: 1.5 * a, y: a, name: "L" }, { x: 3 * a, y: 2 * a, name: "I" }, { x: 2 * a, y: 0, name: "U1" }, { x: 4 * a, y: 0, name: "U2" }, { x: 4.5 * a, y: a, name: "R" }, { x: 6 * a, y: 0, name: "B" }],
  bars: [B(0, 1, "1", S), B(0, 3, "2", S), B(1, 3, "3", S), B(3, 4, "4", S), B(3, 2, "5", S), B(1, 2, "6", S), B(4, 2, "7", S), B(4, 5, "8", S), B(5, 2, "9", S), B(4, 6, "10", S), B(5, 6, "11", S)],
  supports: [{ node: 0, type: "fest" }, { node: 6, type: "los", angleDeg: 90 }],
  loads: [{ node: 2, Fx: 0, Fy: -2 }, { node: 5, Fx: -1, Fy: 0 }],
};

/** Gross TM 1 Bsp. 8.6 (S. 220 f.): Stäbe 1, 2 Länge b, 3, 4 Länge a, Winkel β; K = 10 kN; Ersatzloslager waagerecht in K gegen die Starrkörperdrehung um A (Reaktion 0 bei symmetrischer Last). */
export function g86(beta: number, la = 1000, lb = 2000, K = 10): TrussInput {
  const t = beta * Math.PI / 180, H = Math.sqrt(lb * lb - la * la * Math.sin(t) ** 2), xs = la * Math.sin(t), yK = -(H - la * Math.cos(t));
  return {
    nodes: [{ x: 0, y: 0, name: "A" }, { x: 0, y: yK, name: "K" }, { x: xs, y: -H, name: "I" }, { x: -xs, y: -H, name: "II" }],
    bars: [B(0, 3, "1", S), B(0, 2, "2", S), B(1, 3, "3", S), B(1, 2, "4", S), B(3, 2, "5", S)],
    supports: [{ node: 0, type: "fest" }, { node: 1, type: "los", angleDeg: 0 }],
    loads: [{ node: 1, Fx: 0, Fy: -K }],
    pdvv: { kind: "bar", index: 4 },
  };
}

/** Dubbel 26 Bd. 1 Abb. 12.25 (S. 246): Kragausleger, Einflusslinie für F_S6 längs des Obergurts. */
const dub = trussPreset("kragausleger", S);

/** Gross TM 2 Bsp. 1.6 (S. 25 f.): drei Stahlstäbe, F = 20 kN, l = 1000 mm, σ_zul = 150 MPa, A₁ = A₂ = |S₁|/σ_zul, A₃ = 100 mm². */
const A12 = Math.SQRT1_2 * 20000 / 150;
const t16: TrussInput = {
  nodes: [{ x: 0, y: 0, name: "A" }, { x: 2000, y: 0, name: "B" }, { x: 1000, y: 1000, name: "C" }],
  bars: [B(0, 2, "1", { A: A12, E: 2e5, Rp: 150 }), B(2, 1, "2", { A: A12, E: 2e5, Rp: 150 }), B(0, 1, "3", { A: 100, E: 2e5, Rp: 150 })],
  supports: [{ node: 0, type: "fest" }, { node: 1, type: "los", angleDeg: 90 }],
  loads: [{ node: 2, Fx: 0, Fy: -20 }],
};

/** Gross TM 2 Bsp. 1.7a (S. 29 f.): starrer Balken an drei senkrechten Stäben (EA), Kraft F bei a/2, Querlager links; starrer Balken als Fachwerk mit E·A·10⁹ (Näherung). */
const RIG = { A: 1e8, E: 2e8 };
const t17: TrussInput = {
  nodes: [{ x: 0, y: 0, name: "P0" }, { x: a / 2, y: 0, name: "P1" }, { x: a, y: 0, name: "P2" }, { x: 2 * a, y: 0, name: "P3" }, { x: a, y: -a, name: "H" }, { x: 0, y: a, name: "T1" }, { x: a, y: a, name: "T2" }, { x: 2 * a, y: a, name: "T3" }],
  bars: [B(0, 5, "1", EA(100)), B(2, 6, "2", EA(100)), B(3, 7, "3", EA(100)), B(0, 1, "b1", RIG), B(1, 2, "b2", RIG), B(2, 3, "b3", RIG), B(4, 0, "h0", RIG), B(4, 1, "h1", RIG), B(4, 2, "h2", RIG), B(4, 3, "h3", RIG)],
  supports: [{ node: 5, type: "fest" }, { node: 6, type: "fest" }, { node: 7, type: "fest" }, { node: 0, type: "los", angleDeg: 0 }],
  loads: [{ node: 1, Fx: 0, Fy: -12 }],
};

/** Gross TM 2 Bsp. 6.3 (S. 209 f.): Absenkung f_V des Knotens V, alle Stäbe EA; a = 1000 mm, F = 10 kN. */
const t63: TrussInput = (() => {
  const nodes = [...Array.from({ length: 5 }, (_, i) => ({ x: i * a, y: 0, name: i === 2 ? "V" : `U${i}` })), ...Array.from({ length: 5 }, (_, i) => ({ x: i * a, y: a, name: `O${i}` }))];
  const U = (i: number) => i, O = (i: number) => 5 + i, bars: TrussBarInput[] = [];
  const diag = [[U(0), O(1)], [O(1), U(2)], [U(2), O(3)], [O(3), U(4)]];
  for (let p = 0; p < 4; p++) {
    bars.push(B(U(p), O(p), `${4 * p + 1}`, EA(100)), B(O(p), O(p + 1), `${4 * p + 2}`, EA(100)), B(diag[p]![0]!, diag[p]![1]!, `${4 * p + 3}`, EA(100)), B(U(p), U(p + 1), `${4 * p + 4}`, EA(100)));
  }
  bars.push(B(U(4), O(4), "17", EA(100)));
  return { nodes, bars, supports: [{ node: 0, type: "fest" }, { node: 4, type: "los", angleDeg: 90 }], loads: [{ node: 1, Fx: 0, Fy: -10 }, { node: 3, Fx: 0, Fy: -10 }], deflection: { node: 2 } };
})();

/** Gross TM 2 Bsp. 6.4 (S. 211 f.): Verschiebung des Knotens B, Stäbe 1 bis 3 EA, Stab 4 2EA; l = 1000 mm, F = 10 kN unter 45°. */
const t64: TrussInput = {
  nodes: [{ x: 0, y: 0, name: "W1" }, { x: 0, y: 2 * a, name: "W2" }, { x: a, y: 0, name: "D" }, { x: a, y: a, name: "B" }],
  bars: [B(0, 2, "1", EA(100)), B(0, 3, "2", EA(100)), B(2, 3, "3", EA(100)), B(1, 3, "4", EA(200))],
  supports: [{ node: 0, type: "fest" }, { node: 1, type: "fest" }],
  loads: [{ node: 2, Fx: 10 * Math.SQRT1_2, Fy: -10 * Math.SQRT1_2 }],
  deflection: { node: 3 },
};

/** Gross TM 2 Bsp. 6.9 (S. 229 f.): innerlich 1-fach unbestimmt, alle Stäbe EA; a = 1000 mm, F = 10 kN; Überzählige Stab 5 wie Quelle. */
const t69 = (red: boolean): TrussInput => ({
  nodes: [{ x: 0, y: 0, name: "BL" }, { x: a, y: 0, name: "BR" }, { x: 0, y: a, name: "TL" }, { x: a, y: a, name: "TR" }],
  bars: [B(0, 1, "1", EA(100)), B(0, 2, "2", EA(100)), B(2, 3, "3", EA(100)), B(1, 3, "4", EA(100)), B(0, 3, "5", EA(100)), B(2, 1, "6", EA(100))],
  supports: [{ node: 0, type: "fest" }, { node: 1, type: "los", angleDeg: 90 }],
  loads: [{ node: 3, Fx: 10, Fy: 0 }],
  redundants: red ? [{ kind: "bar", index: 4 }] : null,
  deflection: { node: 3 },
});

/** Zweischlag mit geschlossener Lösung: S = F/(2 sin α), v = F·l/(2·E·A·sin²α); b = 1000 mm, h = 750 mm (sin α = 0,6), F = 10 kN. */
const zw: TrussInput = {
  nodes: [{ x: -1000, y: 0, name: "L" }, { x: 1000, y: 0, name: "R" }, { x: 0, y: -750, name: "K" }],
  bars: [B(0, 2, "1", EA(100)), B(1, 2, "2", EA(100))],
  supports: [{ node: 0, type: "fest" }, { node: 1, type: "fest" }],
  loads: [{ node: 2, Fx: 0, Fy: -10 }],
  deflection: { node: 2 },
};

const Fd = (F: number) => F * 1000;
const ufac = (F: number, l: number, EAv: number) => F * 1000 * l / EAv;

export const fwFaelle: FwFall[] = [
  { id: "P-FW1", label: "Dreieck Konzept Abschn. 1, F = 10 N, PdvV Stab S2", inp: { ...dreieck, pdvv: { kind: "bar", index: 1 } }, Fref: 10, uref: 1, dual: true },
  { id: "P-FW2", label: "Gross TM 1 Bsp. 6.1, l = 1000 mm, F = 10 kN (Nullstäbe, Lagerkräfte)", inp: { ...g61, pdvv: { kind: "support", index: 0 } }, Fref: Fd(10), uref: 1, dual: true },
  { id: "P-FW3", label: "Gross TM 1 Bsp. 6.3, Pendelstützen, F₁ = 2F, F₂ = F, F = 1 kN", inp: g63, Fref: Fd(1), uref: 1, dual: true },
  { id: "P-FW4", label: "Gross TM 1 Bsp. 6.4, Stab 4 (Ritter), F = 1 kN", inp: { ...g64, pdvv: { kind: "bar", index: 3 } }, Fref: Fd(1), uref: 1, dual: true },
  { id: "P-FW5a", label: "Gross TM 1 Bsp. 8.6, PdvV Stab 5, a = 1000, b = 2000 mm, β = 30°, K = 10 kN", inp: g86(30), Fref: Fd(10), uref: 1, dual: true },
  { id: "P-FW5b", label: "Gross TM 1 Bsp. 8.6, β = 60°", inp: g86(60), Fref: Fd(10), uref: 1, dual: true },
  { id: "P-FW5c", label: "Gross TM 1 Bsp. 8.6, β = 120°", inp: g86(120), Fref: Fd(10), uref: 1, dual: true },
  { id: "P-FW6", label: "Dubbel Abb. 12.25 Kragausleger, Einflusslinie F_S6 am Obergurt, PdvV Stab 6", inp: { ...dub, pdvv: { kind: "bar", index: 5 }, influence: { bond: { kind: "bar", index: 5 }, nodes: trussChordNodes(dub, "ober") } }, Fref: Fd(1), uref: 1, dual: true },
  { id: "P-FW7", label: "Gross TM 2 Bsp. 1.6, drei Stahlstäbe, F = 20 kN, σ_zul = 150 MPa", inp: { ...t16, deflection: { node: 1 } }, Fref: Fd(20), uref: 1, dual: true },
  { id: "P-FW9", label: "Gross TM 2 Bsp. 6.3, Absenkung f_V, a = 1000 mm, F = 10 kN, EA = 2·10⁷ N", inp: t63, Fref: Fd(10), uref: ufac(10, a, 2e7), dual: true },
  { id: "P-FW10", label: "Gross TM 2 Bsp. 6.4, Verschiebung B, Stab 4 mit 2EA, l = 1000 mm, F = 10 kN", inp: t64, Fref: Fd(10), uref: ufac(10, a, 2e7), dual: true },
  { id: "P-FW11a", label: "Gross TM 2 Bsp. 6.9, innerlich unbestimmt, Überzählige Stab 5 wie Quelle", inp: t69(true), Fref: Fd(10), uref: ufac(10, a, 2e7), dual: false },
  { id: "P-FW11b", label: "Gross TM 2 Bsp. 6.9, Überzählige vom Programm vorgeschlagen", inp: t69(false), Fref: Fd(10), uref: ufac(10, a, 2e7), dual: false },
  { id: "P-FW8", label: "Gross TM 2 Bsp. 1.7a, starrer Balken an drei Stäben (E·A·10⁹), F = 12 kN", inp: t17, Fref: Fd(12), uref: 1, dual: false },
  { id: "P-FW12", label: "Zweischlag, geschlossene Lösung, sin α = 0,6, F = 10 kN", inp: zw, Fref: Fd(10), uref: ufac(10, 1250, 2e7), dual: true },
  { id: "P-FW13", label: "Vorlage Pratt, 6 Felder, 12 m × 2 m, 10 kN je Untergurtknoten", inp: { ...trussPreset("pratt", S), deflection: { node: 3 } }, Fref: Fd(10), uref: 1, dual: true },
  { id: "P-FW14", label: "Vorlage Howe, 6 Felder", inp: trussPreset("howe", S), Fref: Fd(10), uref: 1, dual: true },
  { id: "P-FW15", label: "Vorlage Warren, 6 Felder", inp: trussPreset("warren", S), Fref: Fd(10), uref: 1, dual: true },
  { id: "P-FW16", label: "Vorlage Durchlaufträger auf drei Lagern (n = 1)", inp: { ...trussPreset("durchlauf", S), deflection: { node: 2 } }, Fref: Fd(10), uref: 1, dual: false },
];

/** Fehler- und Grenzfälle: Ausnahmefachwerke Gross TM 1 Abb. 6.2b, c, verschieblich, n > 3, Eingabefehler. */
const sq = (sup: TrussInput["supports"], diag: boolean): TrussInput => ({ nodes: [{ x: 0, y: 0 }, { x: a, y: 0 }, { x: a, y: a }, { x: 0, y: a }], bars: [B(0, 1, "1", S), B(1, 2, "2", S), B(2, 3, "3", S), B(3, 0, "4", S), ...(diag ? [B(0, 2, "5", S), B(1, 3, "6", S)] : [])], supports: sup, loads: [{ node: 2, Fx: 1, Fy: 0 }] });
export const fwFehler: Array<{ id: string; label: string; inp: TrussInput; kind: string }> = [
  { id: "P-FW20a", label: "Gross TM 1 Abb. 6.2b: Gelenkviereck rechts (beweglich im Großen)", kind: "ausnahme", inp: {
    nodes: [{ x: 0, y: 0, name: "I" }, { x: 0, y: a, name: "II" }, { x: a, y: 0, name: "III" }, { x: a, y: a, name: "IV" }, { x: 2 * a, y: 0, name: "V" }, { x: 2 * a, y: a, name: "VI" }],
    bars: [B(0, 1, "1", S), B(0, 2, "2", S), B(0, 3, "3", S), B(1, 2, "4", S), B(1, 3, "5", S), B(2, 3, "6", S), B(2, 4, "7", S), B(3, 5, "8", S), B(4, 5, "9", S)],
    supports: [{ node: 0, type: "fest" }, { node: 2, type: "los", angleDeg: 90 }], loads: [{ node: 5, Fx: 0, Fy: -1 }] } },
  { id: "P-FW20b", label: "Gross TM 1 Abb. 6.2c: Knoten IV zwischen zwei Stäben auf einer Geraden (beweglich im Kleinen)", kind: "ausnahme", inp: {
    nodes: [{ x: 0, y: 0, name: "I" }, { x: 0, y: a, name: "II" }, { x: a, y: 0.4 * a, name: "III" }, { x: a, y: a, name: "IV" }, { x: 2 * a, y: 0, name: "V" }, { x: 2 * a, y: a, name: "VI" }],
    bars: [B(0, 1, "1", S), B(0, 4, "2", S), B(0, 2, "3", S), B(1, 2, "4", S), B(1, 3, "5", S), B(2, 4, "6", S), B(2, 5, "7", S), B(3, 5, "8", S), B(4, 5, "9", S)],
    supports: [{ node: 0, type: "fest" }, { node: 4, type: "los", angleDeg: 90 }], loads: [{ node: 3, Fx: 0, Fy: -1 }] } },
  { id: "P-FW20c", label: "Viereck ohne Diagonale (verschieblich, Abzählkriterium nicht erfüllt)", kind: "beweglich", inp: sq([{ node: 0, type: "fest" }, { node: 1, type: "los", angleDeg: 90 }], false) },
  { id: "P-FW20d", label: "Viereck mit zwei Diagonalen auf vier Festlagern (n = 6 > 3)", kind: "unbestimmt", inp: sq([{ node: 0, type: "fest" }, { node: 1, type: "fest" }, { node: 2, type: "fest" }, { node: 3, type: "fest" }], true) },
  { id: "P-FW20e", label: "Eingabefehler: Stab doppelt, A ≤ 0", kind: "eingabe", inp: { ...dreieck, bars: [...dreieck.bars, { ...dreieck.bars[0]!, A: 0 }] } },
];
