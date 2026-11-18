/**
 * Fachdaten fd 1.4 für den O-Ring (Modul dichtungen, eng-core 0.20.0), Abzug data/fd/*.json aus Supabase fd_*.
 * Konzept fachtools/konzept_or.md Abschn. 5, konzept_or_fd14.md Abschn. 12. Einheiten wie in der Datenbank: Längen in mm,
 * Toleranzen in mm (±), Verpressung in %, Spalt in mm, Druck in bar, Temperatur in °C, α in 10⁻⁶/K, Rauheit in µm,
 * Grundabmaße f, g in µm. Nur Zugriff und Auswahl, keine Rechenwerte.
 */
import sizesJson from "../../data/fd/oring_sizes.json";
import csTolJson from "../../data/fd/oring_cs_tol.json";
import idTolJson from "../../data/fd/oring_id_tol_a.json";
import groovesJson from "../../data/fd/oring_grooves.json";
import compressionJson from "../../data/fd/oring_compression.json";
import gapJson from "../../data/fd/oring_gap.json";
import surfaceJson from "../../data/fd/oring_surface.json";
import materialsJson from "../../data/fd/oring_materials.json";
import mediaJson from "../../data/fd/oring_media.json";
import csSelectJson from "../../data/fd/oring_cs_select.json";
import fitItJson from "../../data/fd/fit_it.json";
import shaftEsJson from "../../data/fd/fit_shaft_es.json";

import type { FdFitIt } from "../joints/pvData";

interface Src { id: string; remark: string | null; source_id: string; source_locator: string }
/** ISO 3601-1 Tab. 1 bis 6: Größe, d₁, d₂, Toleranzen Klasse A und B (±, mm), Volumen in cm³. */
export interface FdOringSize extends Src { size_code: string; iso_table: number; d1_mm: number; d2_mm: number; tol_a_mm: number; tol_b_mm: number; d2_tol_a_mm: number; d2_tol_b_mm: number; volume_cm3: number }
/** ISO 3601-1 Tab. A.1: Schnurstärketoleranz je Bereich (Klasse A, B oder beide), d₁-Grenze für große d₂. */
export interface FdOringCsTol extends Src { class_scope: "A" | "B" | "AB"; d2_min_mm: number; d2_min_incl: boolean; d2_max_mm: number; tol_mm: number; tol_in: number; d1_max_mm: number | null }
/** ISO 3601-1 Tab. A.2: Innendurchmessertoleranz Klasse A für nicht genormte O-Ringe. */
export interface FdOringIdTolA extends Src { d1_from_mm: number; d1_to_mm: number; tol_mm: number; tol_in: number }
export type OrGrooveInstall = "radial_statisch" | "axial" | "hydr_dyn" | "pneu_dyn" | "pneu_schwimmend";
/** Parker Tab. 2.1, 2.3, 2.7, 2.9, 2.11 und 3.x: Nuttiefe t (axial h), Nutbreite b ohne, b₁ mit einem, b₂ mit zwei Stützringen. */
export interface FdOringGroove extends Src {
  install: OrGrooveInstall; d2_mm: number; t_mm: number; t_tol_mm: number | null; b_mm: number; b_tol_mm: number | null; z_mm: number | null;
  r1_min_mm: number; r1_max_mm: number; r2_min_mm: number; r2_max_mm: number; b1_min_mm: number | null; b1_max_mm: number | null;
  b2_min_mm: number | null; b2_max_mm: number | null; iso_preferred: boolean;
}
export type OrApplication = "a_hydr_dyn" | "b_pneu_dyn" | "c_statisch" | "d_axial";
/** ISO 3601-2 Bild 8: Verpressungsgrenzen je Anwendung und d₂. */
export interface FdOringCompression extends Src { application: OrApplication; d2_mm: number; c_min_pct: number; c_max_pct: number }
/** Roloff TB 19-3: maximales Spaltmaß g je Härte, Druckstufe (bis p_max) und d₂-Spalte. */
export interface FdOringGap extends Src { shore_a: number; p_max_bar: number; d2_col_mm: number; d2_col_to_mm: number; g_mm: number }
export interface FdOringSurface extends Src { install: "radial_statisch" | "axial" | "dynamisch"; surface: "kontakt" | "nutgrund" | "fase"; pulsating: boolean | null; ra_um: number; rmax_um: number }
/** Parker Tab. 6.4, 7.6, 8.1: Elastomerfamilie mit Standard-Werkstoff, Härte, Temperaturgrenzen, α, Spaltfaktor. */
export interface FdOringMaterial extends Src {
  code: string; name: string; parker_compound: string | null; shore_a: number | null; t_min_c: number | null; t_max_static_c: number | null;
  t_max_oil_c: number | null; t_max_water_c: number | null; t_max_air_c: number | null; alpha_1e6: number | null; gap_factor: number; static_only: boolean; wdb_id: string | null;
}
/** Parker Kap. 11.3 (Auswahl 31 Medien): Bewertung 1 beständig bis 4 nicht beständig. */
export interface FdOringMedium extends Src { medium_key: string; medium: string; parker_compound: string | null; material_code: string; rating: 1 | 2 | 3 | 4 }
/** ISO 3601-2 Tab. B.1 (Kolben), B.2 (Stange): Schnurstärke je Durchmesserbereich. */
export interface FdOringCsSelect extends Src { kind: "kolben" | "stange"; d_min_mm: number; d_min_incl: boolean; d_max_mm: number; d2_mm: number }
/** ISO 286-1 Tab. 4 (fd 1.4, B-or25): oberes Grenzabmaß es der Wellen f und g in µm. */
export interface FdFitShaftEs extends Src { d_over_mm: number; d_to_mm: number; f_um: number; g_um: number }

export interface OrRepo {
  sizes: readonly FdOringSize[]; csTol: readonly FdOringCsTol[]; idTolA: readonly FdOringIdTolA[]; grooves: readonly FdOringGroove[];
  compression: readonly FdOringCompression[]; gap: readonly FdOringGap[]; surface: readonly FdOringSurface[]; materials: readonly FdOringMaterial[];
  media: readonly FdOringMedium[]; csSelect: readonly FdOringCsSelect[]; fitIt: readonly FdFitIt[]; shaftEs: readonly FdFitShaftEs[];
}

export function createOrRepo(d: Partial<OrRepo>): OrRepo {
  return { sizes: d.sizes ?? [], csTol: d.csTol ?? [], idTolA: d.idTolA ?? [], grooves: d.grooves ?? [], compression: d.compression ?? [], gap: d.gap ?? [],
    surface: d.surface ?? [], materials: d.materials ?? [], media: d.media ?? [], csSelect: d.csSelect ?? [], fitIt: d.fitIt ?? [], shaftEs: d.shaftEs ?? [] };
}

const bySize = (a: FdOringSize, b: FdOringSize) => a.d2_mm - b.d2_mm || a.d1_mm - b.d1_mm || (a.size_code < b.size_code ? -1 : 1);
/** Fachdaten O-Ring aus dem versionierten Abzug (data/fd, fd 1.4); Größen nach d₂, dann d₁ sortiert. */
export const orRepo: OrRepo = createOrRepo({
  sizes: [...(sizesJson as unknown as FdOringSize[])].sort(bySize), csTol: csTolJson as unknown as FdOringCsTol[], idTolA: idTolJson as unknown as FdOringIdTolA[],
  grooves: groovesJson as unknown as FdOringGroove[], compression: compressionJson as unknown as FdOringCompression[], gap: gapJson as unknown as FdOringGap[],
  surface: surfaceJson as unknown as FdOringSurface[], materials: materialsJson as unknown as FdOringMaterial[], media: mediaJson as unknown as FdOringMedium[],
  csSelect: csSelectJson as unknown as FdOringCsSelect[], fitIt: fitItJson as unknown as FdFitIt[], shaftEs: shaftEsJson as unknown as FdFitShaftEs[],
});

export const OR_REF_ISO1 = "DIN ISO 3601-1:2026-07 (Q250)";
export const OR_REF_ISO2 = "DIN ISO 3601-2:2010-08 (Q251, zurückgezogen, L1)";
export const OR_REF_PARKER = "Parker O-Ring-Handbuch PTD 5705 DE 10/2019 (Q253)";
export const OR_REF_ROLOFF = "Roloff/Matek 27 (Q219)";
export const OR_REF_ISO286 = "ISO 286-1:2019 (Q236)";
/** Gleichheitsschranke für Vergleiche an Tabellengrenzen (mm bzw. %). */
export const OR_EPS = 1e-9;

/** Normgröße nach Größenbezeichnung (z. B. "211") oder Zeilen-ID. */
export function sizeOf(r: OrRepo, code: string): FdOringSize | null {
  return r.sizes.find((s) => s.size_code === code || s.id === code) ?? null;
}
/** Normgröße mit genau diesen Nennmaßen (d₁, d₂), sonst null. */
export function sizeByDims(r: OrRepo, d1: number, d2: number): FdOringSize | null {
  return r.sizes.find((s) => Math.abs(s.d1_mm - d1) < 1e-6 && Math.abs(s.d2_mm - d2) < 1e-6) ?? null;
}
/** Alle Normgrößen einer Schnurstärke, nach d₁ steigend. */
export function sizesOfD2(r: OrRepo, d2: number): FdOringSize[] {
  return r.sizes.filter((s) => Math.abs(s.d2_mm - d2) < 1e-6);
}
/** Tab. A.1: Schnurstärketoleranz für Klasse A bzw. B (null = außerhalb der Tabelle). */
export function csTolRow(r: OrRepo, d2: number, cls: "A" | "B", d1: number): FdOringCsTol | null {
  return r.csTol.find((t) => (t.class_scope === cls || t.class_scope === "AB") && (t.d2_min_incl ? d2 >= t.d2_min_mm - OR_EPS : d2 > t.d2_min_mm + OR_EPS)
    && d2 <= t.d2_max_mm + OR_EPS && (t.d1_max_mm === null || d1 <= t.d1_max_mm + OR_EPS)) ?? null;
}
/** Tab. A.2: Innendurchmessertoleranz Klasse A (null = außerhalb 0,68 bis 1 320,80 mm). */
export function idTolARow(r: OrRepo, d1: number): FdOringIdTolA | null {
  return r.idTolA.find((t) => d1 >= t.d1_from_mm - 0.005 && d1 <= t.d1_to_mm + 0.005) ?? null;
}
/** Nutmaße je Einbauart und d₂ (Parker Tab. 2.x, 3.x). */
export function grooveOf(r: OrRepo, install: OrGrooveInstall, d2: number): FdOringGroove | null {
  return r.grooves.find((g) => g.install === install && Math.abs(g.d2_mm - d2) < 1e-6) ?? null;
}
export function materialOf(r: OrRepo, code: string): FdOringMaterial | null {
  return r.materials.find((m) => m.code === code) ?? null;
}
/** Medienbewertung (null = keine Angabe in der Auswahl). */
export function mediumRating(r: OrRepo, medium: string, code: string): FdOringMedium | null {
  return r.media.find((m) => m.medium_key === medium && m.material_code === code) ?? null;
}
/** Medienliste (Schlüssel, Name) in Tabellenreihenfolge. */
export function mediaList(r: OrRepo): { key: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const m of r.media) if (!seen.has(m.medium_key)) seen.set(m.medium_key, m.medium);
  return [...seen].map(([key, name]) => ({ key, name })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
/** Tab. B.1/B.2: Schnurstärke für Kolben (d₄) bzw. Stange (d₅); null = außerhalb. */
export function csSelectOf(r: OrRepo, kind: "kolben" | "stange", d: number): FdOringCsSelect | null {
  return r.csSelect.find((c) => c.kind === kind && (c.d_min_incl ? d >= c.d_min_mm - OR_EPS : d > c.d_min_mm + OR_EPS) && d <= c.d_max_mm + OR_EPS) ?? null;
}
export function surfacesOf(r: OrRepo, install: FdOringSurface["install"], pulsating: boolean): FdOringSurface[] {
  return r.surface.filter((s) => s.install === install && (s.pulsating === null || s.pulsating === pulsating))
    .sort((a, b) => ["kontakt", "nutgrund", "fase"].indexOf(a.surface) - ["kontakt", "nutgrund", "fase"].indexOf(b.surface));
}

/**
 * Medienklasse für die Temperaturgrenze nach Parker Tab. 7.6 (Spalten Öl, Wasser, Luft); Medien ohne Zuordnung nutzen
 * die statische Grenze aus Tab. 6.4. Feste Zuordnung (eigene Festlegung, Konzept OR-TB, Umsetzungsentscheidung U-or7).
 */
export const OR_MEDIUM_CLASS: Readonly<Record<string, "oel" | "wasser" | "luft">> = {
  HLP: "oel", MINOEL: "oel", DIESEL: "oel", BENZIN: "oel", SILIKONOEL: "oel", HFDR: "oel",
  WASSER70: "wasser", WASSER100: "wasser", DAMPF150: "wasser", DAMPF150P: "wasser", HFC: "wasser", WASSERGLYKOL: "wasser", GLYKOL: "wasser", ADBLUE: "wasser",
  LUFT100: "luft", LUFT150: "luft", N2GAS: "luft", O2KALT: "luft", OZON: "luft", CO2TROCKEN: "luft",
};
