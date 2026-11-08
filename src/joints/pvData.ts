/**
 * Fachdaten fd 1.2 für den Pressverband (Modul verbindungen, eng-core 0.17.0), Abzug data/fd/*.json aus Supabase fd_*.
 * Einheiten wie in der Datenbank: Grundtoleranzen und Grundabmaße in µm, Durchmesser in mm, E in N/mm², α in 10⁻⁶/K,
 * Temperaturen in °C. Dazu die Werkstoffzuordnung WDB → DIN 7190-1 Tab. 7 (O-pv1: zuerst Werkstoff-ID, dann Unterklasse)
 * und die Vorbelegung der Haftbeiwerte (unterer Wert, bei mehreren Zeilen der kleinere). Keine Rechenwerte.
 */
import fitItJson from "../../data/fd/fit_it.json";
import fitShaftDevJson from "../../data/fd/fit_shaft_dev.json";
import frictionJson from "../../data/fd/pv_friction.json";
import groupsJson from "../../data/fd/pv_groups.json";
import joinTempJson from "../../data/fd/pv_join_temp.json";
import coolantsJson from "../../data/fd/pv_coolants.json";
import rzJson from "../../data/fd/pv_rz.json";
import chamferJson from "../../data/fd/pv_chamfer.json";
import { designValue, isBrittle, repNum, type Repo } from "../materials";

/** Wellen-Grundabmaße im Umfang (P4). */
export const SHAFT_FIELDS = ["p", "r", "s", "t", "u", "v", "x", "y", "z"] as const;
export type ShaftField = (typeof SHAFT_FIELDS)[number];
type ItKey = "it1" | "it2" | "it3" | "it4" | "it5" | "it6" | "it7" | "it8" | "it9" | "it10" | "it11";

/** ISO 286-1 Tab. 1: IT1 bis IT11 in µm für Nennmaß über d_over bis einschließlich d_to (fd 1.2). */
export type FdFitIt = { id: string; d_over_mm: number; d_to_mm: number; remark: string | null; source_id: string; source_locator: string } & Record<ItKey, number>;
/** ISO 286-1 Tab. 5: unteres Grenzabmaß ei der Wellen p bis z in µm, null = nicht definiert (fd 1.2). */
export type FdFitShaftDev = { id: string; d_over_mm: number; d_to_mm: number; remark: string | null; source_id: string; source_locator: string } & Record<ShaftField, number | null>;
export type PvHubGroup = "Stahl" | "Stahlguss" | "Gusseisen" | "Gusseisen lamellar" | "Gusseisen globular" | "Aluminium" | "Magnesium" | "Kupfer" | "Titan";
/** Haftbeiwerte DIN 7190-1 Tab. 3 (längs: ν_rl, ν_ll) und Tab. 4 sowie Roloff TB 12-6a (quer: ν_r = ν_rl = ν_ru). */
export interface FdPvFriction {
  id: string; kind: "laengs" | "quer"; pairing: string; hub_group: PvHubGroup; condition: string; lubricated: boolean;
  nu_r_min: number | null; nu_r_max: number | null; nu_l: number | null; remark: string | null; source_id: string; source_locator: string;
}
/** DIN 7190-1 Tab. 7 mit Zuordnung zur WDB. */
export interface FdPvGroup {
  id: string; din_group: string; din_designation: string | null; en_designation: string | null; mu_min: number; mu_max: number;
  e_min_mpa: number; e_max_mpa: number | null; alpha_heat_e6: number; alpha_cool_e6: number; wdb_ids: string[]; wdb_subclasses: string[];
  remark: string | null; source_id: string; source_locator: string;
}
export interface FdPvJoinTemp { id: string; hub_state: string; t_max_c: number; remark: string | null; source_id: string; source_locator: string }
export interface FdPvCoolant { id: string; medium: string; t_c: number; remark: string | null; source_id: string; source_locator: string }
export interface FdPvRz { id: string; ra_um: number; rz_um: number; rz_min_um: number; rz_max_um: number; remark: string | null; source_id: string; source_locator: string }
export interface FdPvChamfer { id: string; d_over_mm: number; d_to_mm: number | null; le_mm: number; remark: string | null; source_id: string; source_locator: string }

export interface PvRepo {
  it: readonly FdFitIt[]; shaftDev: readonly FdFitShaftDev[]; friction: readonly FdPvFriction[]; groups: readonly FdPvGroup[];
  joinTemps: readonly FdPvJoinTemp[]; coolants: readonly FdPvCoolant[]; rz: readonly FdPvRz[]; chamfer: readonly FdPvChamfer[];
}

export function createPvRepo(d: Partial<PvRepo>): PvRepo {
  return { it: d.it ?? [], shaftDev: d.shaftDev ?? [], friction: d.friction ?? [], groups: d.groups ?? [], joinTemps: d.joinTemps ?? [], coolants: d.coolants ?? [], rz: d.rz ?? [], chamfer: d.chamfer ?? [] };
}

/** Fachdaten Pressverband aus dem versionierten Abzug (data/fd, fd 1.2). */
export const pvRepo: PvRepo = createPvRepo({
  it: fitItJson as unknown as FdFitIt[], shaftDev: fitShaftDevJson as unknown as FdFitShaftDev[], friction: frictionJson as unknown as FdPvFriction[],
  groups: groupsJson as unknown as FdPvGroup[], joinTemps: joinTempJson as unknown as FdPvJoinTemp[], coolants: coolantsJson as unknown as FdPvCoolant[],
  rz: rzJson as unknown as FdPvRz[], chamfer: chamferJson as unknown as FdPvChamfer[],
});

/** Zeile eines Nennmaßbereichs „über a bis einschließlich b“; D = 0 gehört zur ersten Zeile. */
function rangeRow<T extends { d_over_mm: number; d_to_mm: number | null }>(rows: readonly T[], D: number): T | null {
  return rows.find((r, i) => (D > r.d_over_mm || (i === 0 && D >= r.d_over_mm)) && (r.d_to_mm === null || D <= r.d_to_mm)) ?? null;
}
/** IT-Zeile zum Nennmaß oder null (D außerhalb 0 bis 500 mm). */
export const itRow = (fd: PvRepo, D: number): FdFitIt | null => (D > 0 ? rangeRow(fd.it, D) : null);
/** Grundtoleranz in µm (Grad 1 bis 11) oder null. */
export function itUm(fd: PvRepo, D: number, grade: number): number | null {
  const r = itRow(fd, D); if (!r || !Number.isInteger(grade) || grade < 1 || grade > 11) return null;
  return r[`it${grade}` as ItKey];
}
/** Zeile der Grundabmaße zum Nennmaß oder null. */
export const shaftDevRow = (fd: PvRepo, D: number): FdFitShaftDev | null => (D > 0 ? rangeRow(fd.shaftDev, D) : null);
/** Fasenlänge nach Tab. 6 (D_F über 50 mm) oder null. */
export const chamferRow = (fd: PvRepo, D: number): FdPvChamfer | null => (D > (fd.chamfer[0]?.d_over_mm ?? Infinity) ? rangeRow(fd.chamfer, D) : null);
/** Rz zum Ra-Wert der DIN 7190-1 Tab. 1 oder null. */
export const rzOfRa = (fd: PvRepo, Ra: number): FdPvRz | null => fd.rz.find((r) => Math.abs(r.ra_um - Ra) < 1e-12) ?? null;

/** DIN-Tab.-7-Gruppe zu einem WDB-Werkstoff: zuerst Werkstoff-ID, dann Unterklasse (O-pv1), sonst null. */
export function pvGroupOf(fd: PvRepo, materialId: string, subclass: string | null): FdPvGroup | null {
  return fd.groups.find((g) => g.wdb_ids.includes(materialId)) ?? (subclass ? fd.groups.find((g) => g.wdb_subclasses.includes(subclass)) ?? null : null);
}
/** Gruppe der Nabe für die Haftbeiwerte aus der WDB-Unterklasse (Teil vor dem Komma), sonst null. */
export function hubGroupOf(subclass: string | null): PvHubGroup | null {
  const s = subclass ?? "";
  if (s.startsWith("Stahlguss")) return "Stahlguss";
  if (s.startsWith("Stahl")) return "Stahl";
  if (s === "Gusseisen, lamellar") return "Gusseisen lamellar";
  if (s === "Gusseisen, globular") return "Gusseisen globular";
  if (s.startsWith("Aluminium")) return "Aluminium";
  if (s.startsWith("Magnesium")) return "Magnesium";
  if (s.startsWith("Kupfer")) return "Kupfer";
  if (s.startsWith("Titan")) return "Titan";
  return null;
}
const groupMatch = (row: PvHubGroup, g: PvHubGroup): boolean => row === g || g.startsWith(`${row} `) || row.startsWith(`${g} `);

/** Haftbeiwert-Zeilen einer Fügeart und Nabengruppe (für die Auswahl in der Oberfläche). */
export function pvFrictionRows(fd: PvRepo, kind: "laengs" | "quer", g: PvHubGroup): FdPvFriction[] {
  return fd.friction.filter((r) => r.kind === kind && groupMatch(r.hub_group, g));
}
/**
 * Vorbelegung (Entscheidung 08.11.2026): ungeschmierte bzw. trockene Zeilen der Nabengruppe, unterer Wert, bei
 * mehreren Zeilen der kleinere; längs zusätzlich ν_ll (Lösen) für die Einpresskraft. null, wenn keine Zeile passt.
 */
export function pvFrictionDefault(fd: PvRepo, kind: "laengs" | "quer", g: PvHubGroup | null, lubricated = false): { nuR: number | null; nuL: number | null; rows: FdPvFriction[] } {
  const rows = g ? pvFrictionRows(fd, kind, g).filter((r) => r.lubricated === lubricated) : [];
  const min = (xs: (number | null)[]): number | null => { const v = xs.filter((x): x is number => x !== null); return v.length ? Math.min(...v) : null; };
  return { nuR: min(rows.map((r) => r.nu_r_min)), nuL: min(rows.map((r) => r.nu_l)), rows };
}

/** Kennwerte eines Fügeteils in der Rechnung: E in N/mm², R in N/mm², α in 1/K, ρ in kg/m³, A in %. */
export interface PvMaterial {
  label: string;
  E: number; mu: number;
  /** untere Streckgrenze R_eL bzw. R_p0,2 (unterer Wert), null = nicht belegt */
  Re: number | null;
  Rm: number | null;
  /** Bruchdehnung in % (null = nicht belegt) */
  A: number | null;
  /** Längenausdehnungskoeffizient beim Erwärmen und beim Unterkühlen (DIN Tab. 7) in 1/K */
  alphaHeat: number | null; alphaCool: number | null;
  rho: number | null;
  /** spröde: rein elastisch mit R_m (DIN 4.1, O-pv3) */
  brittle: boolean;
}
export type PvOrigin = "WDB" | "DIN Tab. 7" | "fehlt";
export interface PvMaterialFromWdb { mat: PvMaterial; origin: Record<"E" | "mu" | "Re" | "Rm" | "A" | "alphaHeat" | "alphaCool" | "rho", PvOrigin>; group: FdPvGroup | null; hubGroup: PvHubGroup | null; hints: string[] }

/**
 * Fügeteil aus dem WDB-Abzug (Standardvariante, P7): E, ν, R_e und R_m (unterer Wert), A, α, ρ. ν fehlt → DIN Tab. 7
 * (μ unterer Wert), α Unterkühlen immer DIN Tab. 7, E fehlt → DIN Tab. 7 (unterer Wert). Spröde: A < 10 % oder ohne R_e
 * oder Werkstoff spröde nach WDB (Grauguss). Null, wenn der Werkstoff nicht existiert.
 */
export function pvMaterialFromWdb(repo: Repo, fd: PvRepo, materialId: string): PvMaterialFromWdb | null {
  const m = repo.byId(materialId); if (!m) return null;
  const g = pvGroupOf(fd, m.id, m.subclass), hints: string[] = [];
  const nuRow = repNum(repo.row(m.id, "P-NU")), aRow = repo.row(m.id, "P-A");
  const A = aRow ? aRow.value_min ?? aRow.value ?? aRow.value_max : null;
  const Re = designValue(repo, m, "P-RE")?.v ?? null, Rm = designValue(repo, m, "P-RM")?.v ?? null;
  const E = m.E !== null ? m.E * 1e3 : g ? g.e_min_mpa : NaN;
  const mu = nuRow ?? (g ? g.mu_min : NaN);
  if (m.E === null) hints.push(g ? `E fehlt in der WDB, unterer Wert aus DIN 7190-1 Tab. 7 (${g.din_group})` : "E fehlt in WDB und DIN Tab. 7: von Hand eingeben");
  if (nuRow === null) hints.push(g ? `ν fehlt in der WDB, Ersatz aus DIN 7190-1 Tab. 7 (${g.din_group}, μ ${g.mu_min})` : "ν fehlt in WDB und DIN Tab. 7: von Hand eingeben");
  if (!g) hints.push("keine Zeile in DIN 7190-1 Tab. 7: α beim Unterkühlen von Hand eingeben");
  const brittle = isBrittle(m) || (A !== null && A < 10) || Re === null;
  if (brittle) hints.push("spröde (A < 10 % oder ohne R_e): nur rein elastische Auslegung mit R_m (DIN 7190-1 Abschn. 4.1)");
  const o = (wdb: boolean, din: boolean): PvOrigin => (wdb ? "WDB" : din ? "DIN Tab. 7" : "fehlt");
  return {
    mat: { label: `${m.name} (${m.id})`, E, mu, Re, Rm, A, alphaHeat: m.alpha !== null ? m.alpha * 1e-6 : g ? g.alpha_heat_e6 * 1e-6 : null, alphaCool: g ? g.alpha_cool_e6 * 1e-6 : null, rho: m.rho, brittle },
    origin: { E: o(m.E !== null, g !== null), mu: o(nuRow !== null, g !== null), Re: o(Re !== null, false), Rm: o(Rm !== null, false), A: o(A !== null, false),
      alphaHeat: o(m.alpha !== null, g !== null), alphaCool: o(false, g !== null), rho: o(m.rho !== null, false) },
    group: g, hubGroup: hubGroupOf(m.subclass), hints,
  };
}
