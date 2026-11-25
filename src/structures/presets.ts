/**
 * Vorlagen für das Blatt Fachwerk (Modul stabwerke, eng-core 0.23.0), Konzept Abschn. 4: Pratt, Howe, Warren (Feldzahl
 * wählbar), Kragausleger nach Dubbel Abb. 12.25, Gross TM 1 Bsp. 6.1, Dreieck, Durchlaufträger auf drei Lagern (n = 1).
 * Nur Geometrie, Lager, Lasten; Stabwerte kommen aus dem Argument bar (Standard der App aus trussBarProps).
 */
import type { TrussBarInput, TrussInput, TrussNodeInput } from "./truss";

export type TrussBarDefaults = Pick<TrussBarInput, "A" | "E" | "Rp" | "iGyr">;
export type TrussPresetId = "pratt" | "howe" | "warren" | "kragausleger" | "gross61" | "dreieck" | "durchlauf";

export const TRUSS_PRESETS: Readonly<Record<TrussPresetId, { label: string; source: string; panels: boolean }>> = {
  pratt: { label: "Fachwerkträger Pratt (Diagonalen fallen zur Mitte)", source: "Ständerfachwerk, Diagonalen auf Zug", panels: true },
  howe: { label: "Fachwerkträger Howe (Diagonalen steigen zur Mitte)", source: "Ständerfachwerk, Diagonalen auf Druck", panels: true },
  warren: { label: "Fachwerkträger Warren (Strebenfachwerk)", source: "ohne Pfosten", panels: true },
  kragausleger: { label: "Kragausleger (Dubbel Abb. 12.25)", source: "Dubbel 26 Bd. 1 Abschn. 12.8.1", panels: false },
  gross61: { label: "Fachwerk Gross TM 1 Bsp. 6.1", source: "Gross TM 1 Bsp. 6.1", panels: false },
  dreieck: { label: "Dreieck", source: "einfachstes bestimmtes Fachwerk", panels: false },
  durchlauf: { label: "Durchlaufträger auf drei Lagern (1-fach unbestimmt)", source: "Pratt auf drei Lagern", panels: true },
};

export interface TrussPresetOptions {
  /** Feldzahl (gerade, 2 bis 12) für Pratt, Howe, Warren, Durchlauf */
  panels?: number;
  /** Spannweite [mm] und Höhe [mm] */
  span?: number; height?: number;
  /** Knotenlast je Untergurtknoten bzw. Last der Vorlage [kN] */
  F?: number;
}

const bar = (i: number, j: number, d: TrussBarDefaults): TrussBarInput => ({ i, j, ...d });
const nm = (n: TrussNodeInput[]) => n.map((p, i) => ({ ...p, name: p.name ?? `K${i + 1}` }));

/** Vorlage als Eingabe für computeTruss. */
export function trussPreset(id: TrussPresetId, d: TrussBarDefaults, o: TrussPresetOptions = {}): TrussInput {
  const F = o.F ?? 10;
  if (id === "dreieck") {
    const L = o.span ?? 2000, h = o.height ?? 1000;
    return { nodes: nm([{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L / 2, y: h }]), bars: [bar(0, 1, d), bar(0, 2, d), bar(1, 2, d)], supports: [{ node: 0, type: "fest" }, { node: 1, type: "los", angleDeg: 90 }], loads: [{ node: 2, Fx: 0, Fy: -F }] };
  }
  if (id === "kragausleger") {
    // Dubbel Abb. 12.25: a = 2 m, b = 3 m, h = 2 m, F1 = 5 kN (nach links), F2 = 10 kN, F3 = 20 kN; Wand rechts
    const nodes = nm([{ x: 0, y: 0, name: "E" }, { x: 2000, y: 0, name: "C" }, { x: 5000, y: 0, name: "A" }, { x: 2000, y: -2000, name: "D" }, { x: 5000, y: -2000, name: "B" }]);
    return { nodes, bars: [bar(0, 1, d), bar(0, 3, d), bar(1, 3, d), bar(1, 2, d), bar(3, 2, d), bar(3, 4, d), bar(2, 4, d)].map((b, i) => ({ ...b, name: `${i + 1}` })), supports: [{ node: 2, type: "fest" }, { node: 4, type: "los", angleDeg: 0 }], loads: [{ node: 0, Fx: -5, Fy: -10 }, { node: 1, Fx: 0, Fy: -20 }] };
  }
  if (id === "gross61") {
    const l = o.height ?? 1000, F6 = o.F ?? 10;
    const nodes = nm(["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((name, i) => ({ x: 2 * l * Math.floor(i / 2), y: i % 2 === 0 ? l : 0, name })));
    const pairs: Array<[number, number]> = [[0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5], [4, 6], [4, 7], [5, 7], [6, 7]];
    return { nodes, bars: pairs.map(([i, j], k) => ({ ...bar(i, j, d), name: `${k + 1}` })), supports: [{ node: 1, type: "los", angleDeg: 90 }, { node: 7, type: "fest" }], loads: [{ node: 4, Fx: 0, Fy: -F6 }] };
  }
  // Ständer- und Strebenfachwerke: Untergurt y = 0, Obergurt y = h, Feldbreite L/n
  const n = Math.max(2, Math.min(12, Math.round((o.panels ?? 6) / 2) * 2));
  const L = o.span ?? 12000, h = o.height ?? 2000, w = L / n;
  const nodes: TrussNodeInput[] = [], bars: TrussBarInput[] = [];
  if (id === "warren") {
    for (let i = 0; i <= n; i++) nodes.push({ x: i * w, y: 0, name: `U${i}` });
    for (let i = 0; i < n; i++) nodes.push({ x: (i + 0.5) * w, y: h, name: `O${i + 1}` });
    const U = (i: number) => i, O = (i: number) => n + 1 + i;
    for (let i = 0; i < n; i++) bars.push({ ...bar(U(i), U(i + 1), d), name: `U${i + 1}` });
    for (let i = 0; i + 1 < n; i++) bars.push({ ...bar(O(i), O(i + 1), d), name: `O${i + 1}` });
    for (let i = 0; i < n; i++) { bars.push({ ...bar(U(i), O(i), d), name: `D${2 * i + 1}` }); bars.push({ ...bar(O(i), U(i + 1), d), name: `D${2 * i + 2}` }); }
    return { nodes, bars, supports: [{ node: 0, type: "fest" }, { node: n, type: "los", angleDeg: 90 }], loads: Array.from({ length: n - 1 }, (_, i) => ({ node: i + 1, Fx: 0, Fy: -F })) };
  }
  for (let i = 0; i <= n; i++) nodes.push({ x: i * w, y: 0, name: `U${i}` });
  for (let i = 0; i <= n; i++) nodes.push({ x: i * w, y: h, name: `O${i}` });
  const U = (i: number) => i, O = (i: number) => n + 1 + i;
  for (let i = 0; i < n; i++) bars.push({ ...bar(U(i), U(i + 1), d), name: `U${i + 1}` });
  for (let i = 0; i < n; i++) bars.push({ ...bar(O(i), O(i + 1), d), name: `O${i + 1}` });
  for (let i = 0; i <= n; i++) bars.push({ ...bar(U(i), O(i), d), name: `V${i}` });
  const half = n / 2;
  for (let i = 0; i < n; i++) {
    // Pratt: Diagonale von oben außen nach unten Mitte (Zug unter Schwerlast); Howe gespiegelt
    const left = i < half;
    const pratt = left ? bar(O(i), U(i + 1), d) : bar(U(i), O(i + 1), d);
    const howe = left ? bar(U(i), O(i + 1), d) : bar(O(i), U(i + 1), d);
    bars.push({ ...(id === "howe" ? howe : pratt), name: `D${i + 1}` });
  }
  const supports: TrussInput["supports"] = id === "durchlauf"
    ? [{ node: 0, type: "fest" }, { node: half, type: "los", angleDeg: 90 }, { node: n, type: "los", angleDeg: 90 }]
    : [{ node: 0, type: "fest" }, { node: n, type: "los", angleDeg: 90 }];
  return { nodes, bars, supports, loads: Array.from({ length: n - 1 }, (_, i) => ({ node: i + 1, Fx: 0, Fy: -F })).filter((l) => id !== "durchlauf" || l.node !== half) };
}
