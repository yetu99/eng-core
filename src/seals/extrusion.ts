/**
 * Spaltmaß und Extrusion O-Ring (Modul dichtungen, eng-core 0.20.0), Konzept fachtools/konzept_or.md Abschn. 4.2 (OR-G) und 4.6
 * (OR-GZUL, OR-GA, OR-STR). Zulässiges Spaltmaß nach Roloff TB 19-3 (fd_oring_gap) über Härte, Druckstufe und d₂-Spalte, Silikon
 * und Fluorsilikon mit Spaltfaktor 0,5 (Parker S. 9, Bild 4.10 Anm. 2). Spalt im Worst Case mit voller Exzentrizität (O5, F-or5),
 * Umschalter „geführt“. Längen in mm, Druck in bar (Tabelle).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { OR_EPS, OR_REF_PARKER, OR_REF_ROLOFF, type FdOringGroove, type OrRepo } from "./oringData";

export const OR_GAP_COLUMNS = [1.78, 2.62, 3.53, 5.33] as const;

export interface OrGapAllowed {
  /** zulässiges Spaltmaß nach Tabelle × Spaltfaktor; null = Druck über der Tabelle */
  gZul: number | null; gTab: number | null; shoreTable: 70 | 90; pStage: number | null; column: number; factor: number; notes: string[];
  /** d₂ unter 1,78 mm: kein Tabellenwert (Wert der Spalte 1,78 läge auf der unsicheren Seite), Nachweis nicht bewertbar */
  belowTable: boolean;
}

/** Härtestufe der Tabelle: ab 90 Shore A die 90er-Werte, darunter die 70er-Werte (80 Shore A wie 70, sichere Seite, B-or17). */
export function gapShoreTable(shore: number): 70 | 90 {
  return shore >= 90 - OR_EPS ? 90 : 70;
}
/** d₂-Spalte von TB 19-3: größte Spalte ≤ d₂ (zwischen den Spalten der kleinere Wert), unter 1,78 die erste Spalte mit Hinweis. */
export function gapColumn(d2: number): number {
  let c: number = OR_GAP_COLUMNS[0];
  for (const x of OR_GAP_COLUMNS) if (x <= d2 + OR_EPS) c = x;
  return c;
}

/** OR-GZUL: zulässiges Spaltmaß aus TB 19-3 für Härte, Druck (bar) und d₂, mit Spaltfaktor des Werkstoffs. */
export function gapAllowed(r: OrRepo, shore: number, pBar: number, d2: number, factor: number): OrGapAllowed {
  const shoreTable = gapShoreTable(shore), column = gapColumn(d2), notes: string[] = [];
  if (shoreTable === 70 && shore > 70 + OR_EPS) notes.push(`${fmt(shore)} Shore A mit den Werten für 70 Shore A (sichere Seite, B-or17)`);
  const belowTable = d2 < OR_GAP_COLUMNS[0] - OR_EPS;
  if (belowTable) notes.push(`d₂ = ${fmt(d2)} mm unter der kleinsten Spalte 1,78 mm: kein Tabellenwert, Spaltnachweis nicht bewertbar`);
  if (d2 > 6.99 + OR_EPS) notes.push(`d₂ = ${fmt(d2)} mm über 6,99 mm: Wert der Spalte 5,33/6,99 (außerhalb der Tabelle)`);
  const rows = r.gap.filter((g) => g.shore_a === shoreTable && Math.abs(g.d2_col_mm - column) < 1e-6).sort((a, b) => a.p_max_bar - b.p_max_bar);
  const row = rows.find((g) => Math.max(pBar, 0) <= g.p_max_bar + OR_EPS) ?? null;
  if (!row && !belowTable) notes.push(`Druck ${fmt(pBar)} bar über der Tabelle (${shoreTable} Shore A bis ${fmt(rows[rows.length - 1]?.p_max_bar ?? 0)} bar): Stützring oder härterer Werkstoff`);
  if (factor !== 1) notes.push(`Spaltfaktor ${fmt(factor)} (Silikon, Fluorsilikon: Spaltmaß −50 %)`);
  if (belowTable) return { gZul: null, gTab: null, shoreTable, pStage: row ? row.p_max_bar : null, column, factor, notes, belowTable };
  return { gZul: row ? row.g_mm * factor : null, gTab: row ? row.g_mm : null, shoreTable, pStage: row ? row.p_max_bar : null, column, factor, notes, belowTable };
}

export function gapAllowedStep(a: OrGapAllowed, shore: number, pBar: number, d2: number): CalcStep {
  return step("OR-GZUL", "zulässiges Spaltmaß", "g_zul aus TB 19-3 (70 bzw. 90 Shore A, Druckstufe ≤ 35, 70, 100, 175, 350 bar, Spalte d₂; zwischen den Spalten der kleinere Wert, über 6,99 Spalte 5,33/6,99, unter 1,78 kein Wert) × Spaltfaktor",
    a.gZul === null ? `${fmt(shore)} Shore A (Tabelle ${a.shoreTable}), p = ${fmt(pBar)} bar, d₂ = ${fmt(d2)} mm: ${a.belowTable ? "d₂ unter 1,78 mm, kein Tabellenwert" : "über der Tabelle"}`
      : `${fmt(shore)} Shore A (Tabelle ${a.shoreTable}), p = ${fmt(pBar)} bar (Stufe bis ${fmt(a.pStage)} bar), Spalte ${fmt(a.column)}: g = ${fmt(a.gTab)} mm × ${fmt(a.factor)} = ${fmt(a.gZul)} mm${a.notes.length ? `; ${a.notes.join("; ")}` : ""}`,
    a.gZul ?? NaN, "mm", `${OR_REF_ROLOFF} TB 19-3 (S. 1231); ${OR_REF_PARKER} S. 9, Bild 4.10 Anm. 2`);
}

export interface OrBackup { needed: 0 | 1 | 2; b: [number, number] | null; text: string }
/** OR-STR: Stützring erforderlich, wenn g > g_zul oder Druck über der Tabelle; zwei bei wechselnder Druckrichtung; Nutbreite b₁ bzw. b₂. */
export function backupNeed(g: number | null, gZul: number | null, pressureBoth: boolean, groove: FdOringGroove | null, pBar = 1, belowTable = false): OrBackup {
  if (pBar <= 0) return { needed: 0, b: null, text: "drucklos (p = 0): kein Stützring nötig" };
  if (belowTable) return { needed: 0, b: null, text: "d₂ unter 1,78 mm außerhalb TB 19-3: Stützring nicht bewertbar" };
  const need = gZul === null || (g !== null && g > gZul + OR_EPS);
  if (!need) return { needed: 0, b: null, text: g === null ? "Spalt unbekannt" : `g = ${fmt(g)} mm ≤ g_zul = ${fmt(gZul)} mm: kein Stützring nötig` };
  const n: 1 | 2 = pressureBoth ? 2 : 1;
  const b: [number, number] | null = groove ? (n === 1 ? (groove.b1_min_mm !== null && groove.b1_max_mm !== null ? [groove.b1_min_mm, groove.b1_max_mm] : null)
    : (groove.b2_min_mm !== null && groove.b2_max_mm !== null ? [groove.b2_min_mm, groove.b2_max_mm] : null)) : null;
  return { needed: n, b, text: `${gZul === null ? "Druck über der Tabelle" : `g = ${fmt(g)} mm > g_zul = ${fmt(gZul)} mm`}: ${n === 1 ? "ein Stützring auf der druckabgewandten Seite" : "zwei Stützringe (wechselnde Druckrichtung)"}, Nutbreite ${b ? `${n === 1 ? "b₁" : "b₂"} = ${fmt(b[0])} bis ${fmt(b[1])} mm` : "nicht in Parker Tab. 3.x für diese Einbauart und d₂"} oder härterer Werkstoff` };
}
export function backupStep(bk: OrBackup): CalcStep {
  return step("OR-STR", "Stützring", "erforderlich, wenn p > 0 und g > g_zul oder p über der Tabelle; Nutbreite b₁ (ein Stützring) bzw. b₂ (zwei, wechselnde Druckrichtung)",
    bk.text, bk.needed, "", `${OR_REF_ROLOFF} TB 19-3 Fußnote; ${OR_REF_PARKER} 2.3, Tab. 3.1, 3.5`);
}

export interface OrGapChart {
  d2: number; column: number; factor: number;
  /** Treppenlinien g_zul über p je Härte: Stufen [p_von, p_bis, g] in bar und mm (mit Spaltfaktor) */
  series: { shore: 70 | 90; steps: { p0: number; p1: number; g: number }[] }[];
  point: { p: number; g: number | null; gZul: number | null; shoreTable: 70 | 90 };
}
/** Grafik S4: Treppenbild g_zul über p für 70 und 90 Shore A in der Spalte von d₂, mit Betriebspunkt. */
export function orGapChart(r: OrRepo, d2: number, shore: number, pBar: number, g: number | null, factor: number): OrGapChart {
  const column = gapColumn(d2);
  const series = ([70, 90] as const).map((s) => {
    const rows = r.gap.filter((x) => x.shore_a === s && Math.abs(x.d2_col_mm - column) < 1e-6).sort((a, b) => a.p_max_bar - b.p_max_bar);
    let p0 = 0; const steps: { p0: number; p1: number; g: number }[] = [];
    for (const x of rows) { steps.push({ p0, p1: x.p_max_bar, g: x.g_mm * factor }); p0 = x.p_max_bar; }
    return { shore: s, steps };
  });
  const a = gapAllowed(r, shore, pBar, d2, factor);
  return { d2, column, factor, series, point: { p: pBar, g, gZul: a.gZul, shoreTable: a.shoreTable } };
}
