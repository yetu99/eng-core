/**
 * Werkstoff-Repository über den JSON-Export der Werkstoffdatenbank (identisch mit dem Werkstoffatlas).
 * Einheiten wie in der Datenbank: E und G in GPa, ρ in kg/m³, Festigkeiten in MPa, Preis in €/kg.
 *
 * Repräsentativer Wert (Anzeige, Ashby): erste Zeile je (Standardvariante, Eigenschaft) nach sort_key,
 * num = value ?? Mitte(min, max) ?? min ?? max (gleiche Regel wie im Werkstoffatlas).
 * Auslegungswert (Nachweise): siehe designValue, standardmäßig der untere Wert.
 */
import { fmt } from "./format";

export type MatClass = "Metall" | "Polymer" | "Keramik" | "Verbundwerkstoff" | "Naturwerkstoff";
export const MAT_CLASSES: readonly MatClass[] = ["Metall", "Polymer", "Keramik", "Verbundwerkstoff", "Naturwerkstoff"];

export interface MaterialJson { id: string; category: string; subclass: string | null; name: string; designation: string | null; [k: string]: unknown }
export interface VariantJson { id: string; material_id: string; code: string | null; description: string | null; is_default: boolean }
export interface PropertyValueJson {
  id: string; variant_id: string; property_id: string;
  value: number | null; value_min: number | null; value_max: number | null; value_text: string | null;
  operator: string | null; condition: string | null; value_type: string | null; status: string | null;
  source_id: string | null; source_locator: string | null; confidence: number | null; remark: string | null; sort_key: number;
}
export interface SourceJson { id: string; short_name: string | null; title: string | null; [k: string]: unknown }

export interface MaterialData {
  materials: MaterialJson[];
  variants: VariantJson[];
  propertyValues: PropertyValueJson[];
  sources: SourceJson[];
}

export interface Material {
  id: string;
  cls: MatClass;
  name: string;
  designation: string | null;
  subclass: string | null;
  defaultVariantId: string | null;
  elastomer: boolean;
  /** repräsentative Werte, null = nicht belegt */
  E: number | null; rho: number | null; Rp: number | null; Rm: number | null; BB: number | null; price: number | null;
}

export interface Repo {
  materials: Material[];
  byId(id: string): Material | undefined;
  /** erste Kennwertzeile der Standardvariante für eine Eigenschaft */
  row(materialId: string, propertyId: string): PropertyValueJson | null;
  sourceName(id: string | null): string;
}

const DEFAULT_NU: Record<MatClass, number> = { Metall: 0.3, Polymer: 0.38, Keramik: 0.22, Verbundwerkstoff: 0.3, Naturwerkstoff: 0.3 };
/** Querkontraktionszahl als Klassen-Richtwert, wenn die Datenbank keinen Wert hat (Annahme, im Rechenweg markiert). */
export function defaultNu(cls: MatClass): number { return DEFAULT_NU[cls]; }

export function repNum(r: PropertyValueJson | null): number | null {
  if (!r) return null;
  if (r.value !== null) return r.value;
  if (r.value_min !== null && r.value_max !== null) return (r.value_min + r.value_max) / 2;
  return r.value_min ?? r.value_max ?? null;
}

export function createRepo(data: MaterialData): Repo {
  const defVar = new Map<string, string>();
  for (const v of data.variants) if (v.is_default) defVar.set(v.material_id, v.id);
  const rows = new Map<string, PropertyValueJson>();
  const sorted = [...data.propertyValues].sort((a, b) => a.sort_key - b.sort_key);
  for (const r of sorted) { const k = `${r.variant_id}|${r.property_id}`; if (!rows.has(k)) rows.set(k, r); }
  const src = new Map(data.sources.map((s) => [s.id, s.short_name ?? s.id]));
  const row = (mid: string, pid: string): PropertyValueJson | null => {
    const v = defVar.get(mid);
    return v ? rows.get(`${v}|${pid}`) ?? null : null;
  };
  const materials: Material[] = data.materials.map((m) => {
    const cls = (MAT_CLASSES as readonly string[]).includes(m.category) ? (m.category as MatClass) : "Metall";
    return {
      id: m.id, cls, name: m.name, designation: m.designation, subclass: m.subclass, defaultVariantId: defVar.get(m.id) ?? null,
      elastomer: (m.subclass ?? "").toLowerCase().includes("elastomer"),
      E: repNum(row(m.id, "P-E")), rho: repNum(row(m.id, "P-RHO")), Rp: repNum(row(m.id, "P-RE")),
      Rm: repNum(row(m.id, "P-RM")), BB: repNum(row(m.id, "P-BB")), price: repNum(row(m.id, "P-PREIS")),
    };
  });
  const map = new Map(materials.map((m) => [m.id, m]));
  return { materials, byId: (id) => map.get(id), row, sourceName: (id) => (id ? src.get(id) ?? id : "–") };
}

// ---------------- Auslegungswerte ----------------
export type DvChoice = "lower" | "mid" | "upper" | "manual";
export type StrengthProp = "P-RE" | "P-RM" | "P-BB";
export const DV_SYMBOL: Record<StrengthProp, string> = { "P-RE": "R_p", "P-RM": "R_m", "P-BB": "σ_bB" };

export interface DesignValue {
  prop: StrengthProp;
  /** Wert in der Rechnung (MPa) oder null, wenn kein zulässiger Wert existiert */
  v: number | null;
  basis: string;
  /** Datenbankangabe als Text, z. B. "360 … 510" */
  db: string;
  type: string;
  cond: string;
  src: string;
  /** Warnhinweis (nicht konservativ, Typwert, kein Mindestwert, manuell) */
  warn: string;
  choice: DvChoice;
  lower: number | null; mid: number | null; upper: number | null;
}

/**
 * Auslegungswert aus einer Kennwertzeile.
 * Regeln: Bereich → unterer Wert; "≥" → Mindestwert; "≤" → kein Mindestwert (null, Warnung);
 * Einzelwert "=" / "≈" → Wert, bei Werttyp "Typisch"/"Datenblatt" mit Hinweis "Typwert".
 * Abweichungen (Mitte, oberer Wert, manuell) werden als nicht konservativ markiert.
 */
export function designValue(repo: Repo, mat: Material, prop: StrengthProp, choice: DvChoice = "lower", manual: number | null = null): DesignValue | null {
  const r = repo.row(mat.id, prop);
  if (!r) return null;
  const op = r.operator ?? "=";
  let lower: number | null = null, mid: number | null = null, upper: number | null = null, db: string;
  if (op === "Bereich" && r.value_min !== null && r.value_max !== null) { lower = r.value_min; upper = r.value_max; mid = (lower + upper) / 2; db = `${fmt(lower)} … ${fmt(upper)}`; }
  else if (op === "≥") { lower = r.value_min ?? r.value; db = `≥ ${fmt(lower)}`; }
  else if (op === "≤") { upper = r.value_max ?? r.value; db = `≤ ${fmt(upper)}`; }
  else { lower = mid = upper = repNum(r); db = (op === "≈" ? "≈ " : "") + fmt(lower); }
  const type = r.value_type ?? "", cond = r.condition ?? "", src = repo.sourceName(r.source_id);
  let v: number | null = null, basis = "", warn = "";
  if (choice === "manual" && manual !== null && manual > 0) { v = manual; basis = "manuell"; warn = "manuell gesetzt"; }
  else if (choice === "mid") { v = mid ?? lower ?? upper; basis = "Mitte"; if (v !== lower) warn = "nicht konservativ"; }
  else if (choice === "upper") { v = upper ?? lower; basis = "oberer Wert"; if (v !== lower) warn = "nicht konservativ"; }
  else {
    if (lower !== null) { v = lower; basis = op === "Bereich" || op === "≥" ? "unterer Wert" : "Einzelwert"; }
    else { v = null; basis = "kein Mindestwert"; warn = "Norm nennt nur einen Höchstwert"; }
    if (v !== null && (type === "Typisch" || type === "Datenblatt") && op !== "≥") warn = "Typwert, kein garantierter Mindestwert";
  }
  return { prop, v, basis, db, type, cond, src, warn, choice, lower, mid, upper };
}

/** Spröde Werkstoffe: nur Bruchnachweis (Keramik, Verbund, Naturwerkstoffe, Grauguss). */
export function isBrittle(mat: Material): boolean {
  return mat.cls === "Keramik" || mat.cls === "Verbundwerkstoff" || mat.cls === "Naturwerkstoff" || mat.name.startsWith("EN-GJL");
}

export interface StrengthDesign { brittle: boolean; Rp: DesignValue | null; Rm: DesignValue | null }

/**
 * Festigkeitswerte für den Nachweis. Duktil: R_p (Fließen) und R_m (Bruch).
 * Spröde: nur Bruch, bei Biegung bevorzugt σ_bB, sonst R_m.
 */
export function strengthDesign(repo: Repo, mat: Material, bending: boolean, choice: { RE: DvChoice; RM: DvChoice }, manual: { RE: number | null; RM: number | null }): StrengthDesign {
  const brittle = isBrittle(mat);
  const Rp = brittle ? null : designValue(repo, mat, "P-RE", choice.RE, manual.RE);
  const Rm = brittle && bending
    ? designValue(repo, mat, "P-BB", choice.RM, manual.RM) ?? designValue(repo, mat, "P-RM", choice.RM, manual.RM)
    : designValue(repo, mat, "P-RM", choice.RM, manual.RM) ?? designValue(repo, mat, "P-BB", choice.RM, manual.RM);
  return { brittle, Rp, Rm };
}
