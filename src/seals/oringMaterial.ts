/**
 * Werkstoff, Temperaturbereich und Medium O-Ring (Modul dichtungen, eng-core 0.20.0), Konzept fachtools/konzept_or.md Abschn. 4.7
 * (OR-TB, OR-MED, OR-WW). Elastomere aus fd_oring_materials (Parker Tab. 6.4, 7.6, 8.1), Medienbewertung aus fd_oring_media
 * (Parker Kap. 11.3, Auswahl von 31 Medien, F-or6). Temperaturen in °C.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { materialOf, mediumRating, OR_MEDIUM_CLASS, OR_REF_PARKER, type FdOringMaterial, type OrRepo } from "./oringData";

export const OR_RATING_TEXT: Readonly<Record<number, string>> = { 1: "beständig", 2: "eingeschränkt beständig", 3: "bedingt beständig", 4: "nicht beständig" };

export interface OrTempLimits { tMin: number | null; tMax: number | null; column: "Öl" | "Wasser" | "Luft" | "statisch"; text: string }
/** Temperaturgrenzen des Elastomers für das Medium (Parker Tab. 7.6 je Medienklasse, sonst statisch Tab. 6.4). */
export function tempLimits(m: FdOringMaterial, medium: string | null): OrTempLimits {
  const cls = medium ? OR_MEDIUM_CLASS[medium] : undefined;
  const column = cls === "oel" ? "Öl" : cls === "wasser" ? "Wasser" : cls === "luft" ? "Luft" : "statisch";
  const tMax = cls === "oel" ? m.t_max_oil_c : cls === "wasser" ? m.t_max_water_c : cls === "luft" ? m.t_max_air_c : m.t_max_static_c;
  return { tMin: m.t_min_c, tMax, column, text: `${m.code}: T_min,W = ${fmt(m.t_min_c)} °C, T_max,W (${column}) = ${fmt(tMax)} °C` };
}

export interface OrTempCheck { ok: boolean | null; limits: OrTempLimits; margin: number | null; text: string }
/** OR-TB: T_min,W ≤ T_min und T_max ≤ T_max,W(Medium); margin = kleinerer Abstand zur Grenze in K. */
export function tempCheck(m: FdOringMaterial, medium: string | null, Tmin: number | null, Tmax: number | null): OrTempCheck {
  const L = tempLimits(m, medium);
  if (Tmin === null || Tmax === null) return { ok: null, limits: L, margin: null, text: `${L.text}; Betriebstemperaturen nicht angegeben` };
  if (L.tMin === null || L.tMax === null) return { ok: null, limits: L, margin: null, text: `${L.text}: Grenze nicht in Parker Tab. 6.4 bzw. 7.6` };
  const margin = Math.min(Tmin - L.tMin, L.tMax - Tmax);
  const ok = margin >= 0;
  return { ok, limits: L, margin, text: `${L.text}; Betrieb ${fmt(Tmin)} bis ${fmt(Tmax)} °C: ${ok ? "innerhalb" : "außerhalb"} (Abstand ${fmt(margin)} K)` };
}
export function tempStep(c: OrTempCheck): CalcStep {
  return step("OR-TB", "Temperaturbereich", "T_min,W ≤ T_min und T_max ≤ T_max,W(Medium)", c.text, c.margin ?? NaN, "K", `${OR_REF_PARKER} Tab. 6.4, 7.6; Medienklasse eigene Zuordnung (U-or7)`);
}

export interface OrMediumCheck { rating: number | null; text: string }
/** OR-MED: Bewertung 1 beständig, 2 eingeschränkt, 3 bedingt, 4 nicht beständig; ohne Angabe nicht bewertbar. */
export function mediumCheck(r: OrRepo, code: string, medium: string | null): OrMediumCheck {
  if (!medium) return { rating: null, text: "kein Medium gewählt" };
  const row = mediumRating(r, medium, code);
  if (!row) return { rating: null, text: `${code} in ${medium}: keine Angabe in der Medienauswahl (Parker Kap. 11.3)` };
  return { rating: row.rating, text: `${code} in ${row.medium}: ${row.rating} (${OR_RATING_TEXT[row.rating]}), Parker-Werkstoff ${row.parker_compound ?? "–"}` };
}
export function mediumStep(c: OrMediumCheck): CalcStep {
  return step("OR-MED", "Medienbeständigkeit", "Bewertung 1 beständig, 2 eingeschränkt, 3 bedingt, 4 nicht beständig", c.text, c.rating ?? NaN, "", `${OR_REF_PARKER} Kap. 11.3`);
}

export interface OrMaterialSuggestion { code: string; name: string; rating: number | null; margin: number; tMin: number; tMax: number; shore: number | null }
/**
 * OR-WW: alle Elastomere mit erfülltem Temperaturbereich und Bewertung ≤ 2 (ohne Medium nur Temperatur), bei bewegter Dichtung ohne
 * Werkstoffe nur für statische Dichtungen (Silikon, Fluorsilikon); sortiert nach Bewertung, dann größerem Abstand zur Temperaturgrenze.
 */
export function suggestMaterials(r: OrRepo, medium: string | null, Tmin: number | null, Tmax: number | null, dynamic: boolean): OrMaterialSuggestion[] {
  const out: OrMaterialSuggestion[] = [];
  for (const m of r.materials) {
    if (dynamic && m.static_only) continue;
    const t = tempCheck(m, medium, Tmin, Tmax);
    if (t.ok !== true || t.margin === null) continue;
    const rating = medium ? mediumRating(r, medium, m.code)?.rating ?? null : null;
    if (medium && (rating === null || rating > 2)) continue;
    out.push({ code: m.code, name: m.name, rating, margin: t.margin, tMin: t.limits.tMin!, tMax: t.limits.tMax!, shore: m.shore_a });
  }
  return out.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0) || b.margin - a.margin || (a.code < b.code ? -1 : 1));
}
export function suggestStep(list: OrMaterialSuggestion[], medium: string | null): CalcStep {
  return step("OR-WW", "Werkstoffvorschlag", "alle Elastomere mit OR-TB erfüllt und Bewertung ≤ 2, sortiert nach Bewertung, dann Abstand zur T-Grenze",
    list.length ? list.map((s) => `${s.code}${s.rating !== null ? ` (${s.rating})` : ""} Abstand ${fmt(s.margin)} K`).join(", ") : `kein Elastomer erfüllt Temperatur${medium ? " und Medium" : ""}`,
    list.length, "", `${OR_REF_PARKER} Tab. 6.4, 7.6, Kap. 11.3 (Verfahren O8)`);
}

export { materialOf };
