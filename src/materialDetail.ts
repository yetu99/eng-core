/**
 * Detailansicht eines Werkstoffs aus dem versionierten Datenabzug (data/*.json, gleicher Stand wie die Rechnung).
 * Grundlage für das Werkstoff-Seitenfenster der Werkbank und jede andere App, die Kennwerte mit Quelle zeigt.
 * Keine Rechnung: Werte werden nur gruppiert, als Text formatiert und mit Quelle und Fundstelle versehen.
 * Reihenfolge: Eigenschaften nach properties.sort_order, Kennwertzeilen nach sort_key, Verfahren nach processes.sort_order.
 */
import { fmt } from "./format";
import type { MaterialJson, VariantJson, PropertyValueJson, SourceJson } from "./materials";

export interface PropertyJson {
  id: string; group_name: string; name: string; symbol: string | null; unit: string | null;
  data_type: string | null; test_norm: string | null; sort_order: number; kb_kind: string | null; kb_target: string | null;
}
export interface ProcessJson { name: string; class_mask: string | null; sort_order: number }
export interface ProcessabilityJson {
  material_id: string; process: string; rating: number | null; not_applicable: boolean; note: string | null;
  source_id: string | null; confidence: number | null; status: string | null;
}
export interface DetailData {
  materials: MaterialJson[]; variants: VariantJson[]; propertyValues: PropertyValueJson[]; sources: SourceJson[];
  properties: PropertyJson[]; processes: ProcessJson[]; processability: ProcessabilityJson[];
}

export interface DetailValue {
  rowId: string; propertyId: string; name: string; symbol: string | null; unit: string | null;
  /** Datenbankangabe als Text, z. B. "≥ 260", "360 … 510", "≈ 2,7", "gelistet" */
  text: string;
  value: number | null; min: number | null; max: number | null; operator: string;
  type: string | null; condition: string | null; status: string | null;
  sourceId: string | null; source: string; sourceTitle: string | null; sourceUrl: string | null; locator: string | null;
  confidence: number | null; remark: string | null;
  /** Verweis ins Kompendium (Eintrag oder Formelzeichen), aus wa_properties.kb_kind/kb_target */
  kb: { kind: string; target: string } | null;
}
export interface DetailGroup { name: string; values: DetailValue[] }
export interface DetailProcess { process: string; rating: number | null; notApplicable: boolean; note: string | null; source: string; status: string | null }
export interface MaterialDetail {
  id: string; name: string; designation: string | null; category: string; subclass: string | null;
  aliases: string | null; norms: string | null; applications: string | null; description: string | null;
  advantages: string | null; limitations: string | null; selectionHints: string | null;
  variants: { id: string; code: string | null; description: string | null; isDefault: boolean }[];
  variantId: string;
  groups: DetailGroup[];
  processes: DetailProcess[];
  /** Pfad im Werkstoffatlas, z. B. "/werkstoff/W038" (Origin legt die App fest) */
  atlasPath: string;
}

export const ATLAS_PATH = (id: string): string => `/werkstoff/${encodeURIComponent(id)}`;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** Datenbankangabe einer Kennwertzeile als Text (gleiche Schreibweise wie die Auslegungswert-Tabelle in Blatt 1). */
export function valueText(r: PropertyValueJson): string {
  const op = r.operator ?? "=";
  if (r.value_text && r.value === null && r.value_min === null && r.value_max === null) return r.value_text;
  if (op === "Bereich" && r.value_min !== null && r.value_max !== null) return `${fmt(r.value_min)} … ${fmt(r.value_max)}`;
  if (op === "≥") return `≥ ${fmt(r.value_min ?? r.value)}`;
  if (op === "≤") return `≤ ${fmt(r.value_max ?? r.value)}`;
  const v = r.value ?? r.value_min ?? r.value_max;
  return v === null ? (r.value_text ?? "–") : `${op === "≈" ? "≈ " : ""}${fmt(v)}`;
}

/**
 * Alle Kennwerte einer Variante (Standard: Standardvariante), gruppiert wie im Werkstoffatlas.
 * Liefert null für eine unbekannte Werkstoff-ID oder eine Variante, die nicht zum Werkstoff gehört.
 */
export function materialDetail(data: DetailData, id: string, variantId?: string): MaterialDetail | null {
  const m = data.materials.find((x) => x.id === id);
  if (!m) return null;
  const variants = data.variants.filter((v) => v.material_id === id);
  const vid = variantId ?? variants.find((v) => v.is_default)?.id ?? variants[0]?.id;
  if (!vid || !variants.some((v) => v.id === vid)) return null;
  const props = new Map(data.properties.map((p) => [p.id, p]));
  const srcs = new Map(data.sources.map((s) => [s.id, s]));
  const rows = data.propertyValues
    .filter((r) => r.variant_id === vid && props.has(r.property_id))
    .sort((a, b) => (props.get(a.property_id)!.sort_order - props.get(b.property_id)!.sort_order) || a.sort_key - b.sort_key);
  const groups: DetailGroup[] = [];
  for (const r of rows) {
    const p = props.get(r.property_id)!;
    const s = r.source_id ? srcs.get(r.source_id) : undefined;
    const val: DetailValue = {
      rowId: r.id, propertyId: p.id, name: p.name, symbol: p.symbol, unit: p.unit, text: valueText(r),
      value: r.value, min: r.value_min, max: r.value_max, operator: r.operator ?? "=",
      type: r.value_type, condition: r.condition, status: r.status,
      sourceId: r.source_id, source: s?.short_name ?? r.source_id ?? "–", sourceTitle: s?.title ?? null, sourceUrl: str(s?.["url"]), locator: r.source_locator,
      confidence: r.confidence, remark: r.remark,
      kb: p.kb_kind && p.kb_target ? { kind: p.kb_kind, target: p.kb_target } : null,
    };
    let g = groups.find((x) => x.name === p.group_name);
    if (!g) { g = { name: p.group_name, values: [] }; groups.push(g); }
    g.values.push(val);
  }
  const order = new Map(data.processes.map((p) => [p.name, p.sort_order]));
  const processes: DetailProcess[] = data.processability
    .filter((x) => x.material_id === id)
    .sort((a, b) => (order.get(a.process) ?? 999) - (order.get(b.process) ?? 999) || a.process.localeCompare(b.process, "de"))
    .map((x) => ({ process: x.process, rating: x.rating, notApplicable: x.not_applicable, note: x.note, source: x.source_id ? srcs.get(x.source_id)?.short_name ?? x.source_id : "–", status: x.status }));
  return {
    id: m.id, name: m.name, designation: m.designation, category: m.category, subclass: m.subclass,
    aliases: str(m["aliases"]), norms: str(m["norms"]), applications: str(m["applications"]), description: str(m["description"]),
    advantages: str(m["advantages"]), limitations: str(m["limitations"]), selectionHints: str(m["selection_hints"]),
    variants: variants.map((v) => ({ id: v.id, code: v.code, description: v.description, isDefault: v.is_default })),
    variantId: vid, groups, processes, atlasPath: ATLAS_PATH(m.id),
  };
}
