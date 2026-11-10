/**
 * Fachdaten fd 1.3 für die Schraubenverbindung (Modul verbindungen, eng-core 0.18.0), Abzug data/fd/*.json aus Supabase fd_*.
 * Konzept fachtools/konzept_sv.md Abschn. 5, 14a, 16, 17. Einheiten wie in der Datenbank: Längen in mm, Festigkeiten in N/mm²,
 * Setzbeträge in µm. Nur Zugriff und Auswahl (Normteil nach Norm, d, Länge mit Produktklasse A/B, B-sv12), keine Rechenwerte.
 */
import threadsJson from "../../data/fd/threads.json";
import gradesJson from "../../data/fd/bolt_grades.json";
import geometryJson from "../../data/fd/bolt_geometry.json";
import holesJson from "../../data/fd/clearance_holes.json";
import counterboreJson from "../../data/fd/counterbore.json";
import frictionJson from "../../data/fd/sv_friction.json";
import muTJson from "../../data/fd/sv_mu_t.json";
import tighteningJson from "../../data/fd/sv_tightening.json";
import embedJson from "../../data/fd/sv_embed.json";
import pgJson from "../../data/fd/sv_pg.json";
import kefJson from "../../data/fd/sv_kef.json";
import shearJson from "../../data/fd/sv_shear.json";
import engagementJson from "../../data/fd/sv_engagement.json";

interface Src { id: string; remark: string | null; source_id: string; source_locator: string }
/** DIN 13-1 (Regel) und Roloff TB 8-2 (Fein): Maße in mm, Querschnitte in mm². */
export interface FdThread extends Src { series: "regel" | "fein"; d_mm: number; p_mm: number; d2_mm: number; d3_mm: number; d1_mm: number; h3_mm: number; h1_mm: number; as_mm2: number; a3_mm2: number; reihe: number | null }
/** ISO 898-1 Tab. 3 und ISO 3506-1: R_m und Streckgrenze (ReL, Rp0,2 oder Rpf) je Größenbereich über d_over bis d_to. */
export interface FdBoltGrade extends Src { grade: string; standard: string; d_over_mm: number; d_to_mm: number; rm_nom_mpa: number; rm_min_mpa: number; yield_nom_mpa: number; yield_min_mpa: number; yield_kind: string; a_min_pct: number | null; af_min_d: number | null }
export type SvNorm = "ISO 4014" | "ISO 4017" | "ISO 4762" | "ISO 4032" | "ISO 7089";
/** Normteile (Schraube, Mutter, Scheibe) nach Norm 2022/2023 als Erstquelle (F1), Produktklasse A/B (B-sv12). */
export interface FdBoltGeometry extends Src {
  norm: SvNorm; d_mm: number; product_class: "A" | "B"; s_mm: number | null; e_min_mm: number | null; k_mm: number | null; dw_min_mm: number | null;
  dk_max_mm: number | null; t_min_mm: number | null; b1_mm: number | null; b2_mm: number | null; b3_mm: number | null; m_max_mm: number | null;
  d1_min_mm: number | null; d2_max_mm: number | null; h_mm: number | null; l_min_mm: number | null; l_max_mm: number | null; l_series: number[];
}
export interface FdClearanceHole extends Src { d_mm: number; fine_mm: number; medium_mm: number; coarse_mm: number }
export interface FdCounterbore extends Src { kind: "sechskant" | "zylinder"; d_mm: number; dc_r1_mm: number | null; dc_r2_mm: number | null; dc_r3_mm: number | null; dc_r4_mm: number | null; t_bolt_mm: number | null; t_nut_mm: number | null; t_add_mm: number | null }
export interface FdSvFriction extends Src { kind: "klasse" | "gesamt"; friction_class: string | null; description: string; mu_min: number; mu_max: number | null }
export interface FdSvMuT extends Src { part_a: string; part_b: string; condition: string; dry_min: number | null; dry_max: number | null; lub_min: number | null; lub_max: number | null }
export interface FdSvTightening extends Src { method: string; alpha_min: number; alpha_max: number; scatter_min_pct: number; scatter_max_pct: number; nu_default: number; torsion: boolean; fm_basis: "FMmax" | "FMmin"; d_from_mm: number | null; friction_class: string | null }
export interface FdSvEmbed extends Src { rz_over_um: number; rz_to_um: number; load: "axial" | "schub"; f_thread_um: number; f_bearing_um: number; f_interface_um: number }
export interface FdSvPg extends Src { material_group: string; material: string; rm_mpa: number; p_g_mpa: number; tau_b_mpa: number | null; tau_b_source_id: string | null; tau_b_locator: string | null; wdb_id: string | null; wdb_subclass: string | null }
export interface FdSvKef extends Src { sv_type: number; la_h: number; ak_h: number; n: number; la_h_ge: boolean; ak_h_ge: boolean }
export interface FdSvShear extends Src { grade: string; standard: string; tau_rm: number }
export interface FdSvEngagement extends Src { material_group: string; rm_over_mpa: number; grade: string; thread: "regel" | "fein"; le_d_min: number; le_d_max: number; le_d_print_min: number; le_d_print_max: number }

export interface SvRepo {
  threads: readonly FdThread[]; grades: readonly FdBoltGrade[]; geometry: readonly FdBoltGeometry[]; holes: readonly FdClearanceHole[];
  counterbore: readonly FdCounterbore[]; friction: readonly FdSvFriction[]; muT: readonly FdSvMuT[]; tightening: readonly FdSvTightening[];
  embed: readonly FdSvEmbed[]; pg: readonly FdSvPg[]; kef: readonly FdSvKef[]; shear: readonly FdSvShear[]; engagement: readonly FdSvEngagement[];
}

export function createSvRepo(d: Partial<SvRepo>): SvRepo {
  return { threads: d.threads ?? [], grades: d.grades ?? [], geometry: d.geometry ?? [], holes: d.holes ?? [], counterbore: d.counterbore ?? [], friction: d.friction ?? [],
    muT: d.muT ?? [], tightening: d.tightening ?? [], embed: d.embed ?? [], pg: d.pg ?? [], kef: d.kef ?? [], shear: d.shear ?? [], engagement: d.engagement ?? [] };
}

/** Fachdaten Schraubenverbindung aus dem versionierten Abzug (data/fd, fd 1.3). */
export const svRepo: SvRepo = createSvRepo({
  threads: threadsJson as unknown as FdThread[], grades: gradesJson as unknown as FdBoltGrade[], geometry: geometryJson as unknown as FdBoltGeometry[],
  holes: holesJson as unknown as FdClearanceHole[], counterbore: counterboreJson as unknown as FdCounterbore[], friction: frictionJson as unknown as FdSvFriction[],
  muT: muTJson as unknown as FdSvMuT[], tightening: tighteningJson as unknown as FdSvTightening[], embed: embedJson as unknown as FdSvEmbed[],
  pg: pgJson as unknown as FdSvPg[], kef: kefJson as unknown as FdSvKef[], shear: shearJson as unknown as FdSvShear[], engagement: engagementJson as unknown as FdSvEngagement[],
});

/** Regelgewinde M4 bis M39 (DIN 13-1, Reihe 1 und 2) aufsteigend. */
export const svRegularSizes = (fd: SvRepo): number[] => fd.threads.filter((t) => t.series === "regel").map((t) => t.d_mm).sort((a, b) => a - b);
/** Gewinde: Regelgewinde zu d oder eine Zeile per ID (Feingewinde „GF16x1,5“, Option). */
export function threadOf(fd: SvRepo, d: number, id: string | null = null): FdThread | null {
  return id ? fd.threads.find((t) => t.id === id) ?? null : fd.threads.find((t) => t.series === "regel" && t.d_mm === d) ?? null;
}
/** Festigkeitsklasse zu d (Bereich über d_over bis d_to, d_over = 0 einschließlich). */
export function gradeOf(fd: SvRepo, grade: string, d: number): FdBoltGrade | null {
  return fd.grades.find((g) => g.grade === grade && (d > g.d_over_mm || (g.d_over_mm === 0 && d >= 0)) && d <= g.d_to_mm) ?? null;
}
/** Nachweis nach VDI 2230 gilt für Stahlschrauben 8.8 bis 12.9 (SV-N-GUELT). */
export const SV_GRADES_VDI = ["8.8", "9.8", "10.9", "12.9"] as const;
export const SV_GRADES_SELECT = ["8.8", "10.9", "12.9"] as const;
export const isStainless = (grade: string): boolean => /^A[24]-/.test(grade);

/**
 * Normteil zu Norm, d und Länge (B-sv12): bei Sechskantschrauben gilt Produktklasse A bis l ≤ 10d bzw. 150 mm, darüber B.
 * Gesucht wird die Zeile, deren Längenbereich l enthält; ohne Länge bzw. außerhalb die Klasse-A-Zeile (sonst die erste).
 */
export function partOf(fd: SvRepo, norm: SvNorm, d: number, l: number | null = null): FdBoltGeometry | null {
  const rows = fd.geometry.filter((g) => g.norm === norm && g.d_mm === d);
  if (!rows.length) return null;
  if (l !== null) { const hit = rows.find((g) => g.l_min_mm !== null && g.l_max_mm !== null && l >= g.l_min_mm && l <= g.l_max_mm); if (hit) return hit; }
  if (l !== null && rows.length > 1) { const b = rows.find((g) => g.product_class === "B"), a = rows.find((g) => g.product_class === "A"); if (a && b && b.l_min_mm !== null && l >= b.l_min_mm) return b; }
  return rows.find((g) => g.product_class === "A") ?? rows[0]!;
}
/** Gewindelänge b der Schraube nach Längenbereich (l ≤ 125, ≤ 200, > 200 mm); null = Ganzgewinde bzw. keine Angabe. */
export function threadLengthB(p: FdBoltGeometry, l: number): number | null {
  if (p.norm === "ISO 4017") return null;
  const b = l <= 125 ? p.b1_mm ?? p.b2_mm : l <= 200 ? p.b2_mm ?? p.b1_mm : p.b3_mm ?? p.b2_mm ?? p.b1_mm;
  return b ?? null;
}
export type SvHoleClass = "fein" | "mittel" | "grob";
/** Durchgangsloch ISO 273 (fein, mittel, grob) zu d oder null. */
export function holeOf(fd: SvRepo, d: number, cls: SvHoleClass): number | null {
  const r = fd.holes.find((h) => h.d_mm === d); if (!r) return null;
  return cls === "fein" ? r.fine_mm : cls === "mittel" ? r.medium_mm : r.coarse_mm;
}
export const counterboreOf = (fd: SvRepo, kind: "sechskant" | "zylinder", d: number): FdCounterbore | null => fd.counterbore.find((c) => c.kind === kind && c.d_mm === d) ?? null;
/** Reibungszahlklasse A bis E (VDI Tab. A5) bzw. Gesamtreibungszahl (Roloff TB 8-12a). */
export const frictionClassOf = (fd: SvRepo, cls: string): FdSvFriction | null => fd.friction.find((f) => f.kind === "klasse" && f.friction_class === cls) ?? null;
export const tighteningOf = (fd: SvRepo, id: string): FdSvTightening | null => fd.tightening.find((t) => t.id === id) ?? null;
export type SvRzClass = "lt10" | "10to40" | "40to160";
/** Richtwerte der Setzbeträge (VDI Tab. 5, Roloff TB 8-10a) nach R_z-Klasse und Belastung. */
export function embedOf(fd: SvRepo, rz: SvRzClass, load: "axial" | "schub"): FdSvEmbed | null {
  const lo = rz === "lt10" ? 0 : rz === "10to40" ? 10 : 40;
  return fd.embed.find((e) => e.rz_over_um === lo && e.load === load) ?? null;
}
/** Grenzflächenpressung p_G und τ_B zu einem WDB-Werkstoff: zuerst Werkstoff-ID, dann Unterklasse (O-sv1, F2), sonst null. */
export function pgOf(fd: SvRepo, materialId: string | null, subclass: string | null): FdSvPg | null {
  return (materialId ? fd.pg.find((p) => p.wdb_id === materialId) : undefined) ?? (subclass ? fd.pg.find((p) => p.wdb_subclass === subclass) ?? null : null);
}
/** τ_B/R_m der Schraube (VDI Tab. 7): Festigkeitsklasse bzw. bei nichtrostend die Zahl nach dem Bindestrich. */
export function shearRatioOf(fd: SvRepo, grade: string): FdSvShear | null {
  const key = isStainless(grade) ? grade.split("-")[1]! : grade;
  return fd.shear.find((s) => s.grade === key) ?? null;
}
/**
 * Mindest-Einschraublänge l_e/d (Roloff TB 8-15, angehobene Werte B-sv13): Werkstoffgruppe, R_m des Innengewindes (größte
 * Zeile mit R_m über), Klasse (bis 8.8 → 8.8, 9.8 und 10.9 → 10.9, 12.9), Regel- oder Feingewinde. null, wenn keine Zeile passt.
 */
export function engagementOf(fd: SvRepo, group: string, Rm: number, grade: string, thread: "regel" | "fein"): FdSvEngagement | null {
  const g = grade === "12.9" ? "12.9" : grade === "10.9" || grade === "9.8" ? "10.9" : "8.8";
  const rows = fd.engagement.filter((e) => e.material_group === group && e.grade === g && e.thread === thread && Rm > e.rm_over_mpa - 1e-9);
  return rows.sort((a, b) => b.rm_over_mpa - a.rm_over_mpa)[0] ?? null;
}
export const engagementGroups = (fd: SvRepo): string[] => [...new Set(fd.engagement.map((e) => e.material_group))];

/** Stützstellen VDI Tab. 2: l_A/h 0; 0,1; 0,2; ≥ 0,3 und a_k/h 0; 0,1; 0,3; ≥ 0,5. */
export const KEF_LA = [0, 0.1, 0.2, 0.3] as const;
export const KEF_AK = [0, 0.1, 0.3, 0.5] as const;
/**
 * Vorschlag des Krafteinleitungsfaktors n aus VDI Tab. 2 (S4): bilineare Interpolation in l_A/h und a_k/h je Verbindungstyp
 * SV 1 bis SV 6; Werte über der letzten Stützstelle gelten als „≥“ (Randwert). null bei unbekanntem Typ oder negativen Werten.
 */
export function kefSuggest(fd: SvRepo, svType: number, laH: number, akH: number): number | null {
  if (!(laH >= 0 && akH >= 0)) return null;
  const rows = fd.kef.filter((k) => k.sv_type === svType); if (rows.length !== 16) return null;
  const v = (la: number, ak: number) => rows.find((k) => Math.abs(k.la_h - la) < 1e-12 && Math.abs(k.ak_h - ak) < 1e-12)!.n;
  const seg = (xs: readonly number[], x: number): [number, number, number] => {
    if (x >= xs[xs.length - 1]!) return [xs.length - 2, xs.length - 1, 1];
    for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]!) return [i, i + 1, (x - xs[i]!) / (xs[i + 1]! - xs[i]!)];
    return [0, 1, 0];
  };
  const [i0, i1, tl] = seg(KEF_LA, laH), [j0, j1, ta] = seg(KEF_AK, akH);
  const a = (1 - ta) * v(KEF_LA[i0]!, KEF_AK[j0]!) + ta * v(KEF_LA[i0]!, KEF_AK[j1]!);
  const b = (1 - ta) * v(KEF_LA[i1]!, KEF_AK[j0]!) + ta * v(KEF_LA[i1]!, KEF_AK[j1]!);
  return (1 - tl) * a + tl * b;
}
