import type { ModuleId } from "./modules";

/** Ein nachprüfbarer Rechenschritt: Formel, eingesetzte Werte, Ergebnis, Einheit, Quelle. */
export interface CalcStep {
  /** Stabile Kennung, identisch mit der Formel-ID im FORMELKATALOG.md, z. B. "Q-RH-I". */
  id: string;
  title: string;
  /** Formel in Kurzschreibweise (siehe format.sym). */
  formula: string;
  /** Formel mit eingesetzten Zahlenwerten. */
  subst: string;
  value: number;
  unit: string;
  /** Literaturstelle oder Hinweis. */
  ref?: string;
}

/**
 * Rechenweg-Gruppen je Modul (ab 0.10.0). Jedes Werkzeug ordnet seine Schritte nur in die Gruppen seiner Module ein;
 * Werkbank Blatt 1 nutzt `gemeinsam` und `festigkeit` (Typ `TraceGroup`, unverändert seit 0.9.0), Blatt 2 (Ashby)
 * liefert Schrittlisten ohne Gruppe. Die Gruppen der Fachtools sind vorab festgelegt; neue Gruppen nur hier.
 */
export const TRACE_GROUPS = {
  gemeinsam: ["werkstoff", "querschnitt", "formfaktor"],
  festigkeit: ["belastung", "nachweis", "bemessung", "ermuedung"],
  ashby: [],
  fluid: ["stoffwerte", "geometrie", "reibung", "verluste", "energie", "pumpe", "messung", "druckstoss"],
  verbindungen: ["werkstoff", "passung", "fugendruck", "spannungen", "montage", "nachgiebigkeit", "vorspannung", "betrieb", "nachweis"],
  dichtungen: ["abmessungen", "verpressung", "nut", "extrusion", "nachweis"],
  stabwerke: ["geometrie", "gleichgewicht", "stabkraefte", "verschiebung", "nachweis"],
} as const satisfies Record<ModuleId, readonly string[]>;

/** Gruppen eines Moduls als Typ, z. B. TraceGroupOf<"fluid">. */
export type TraceGroupOf<M extends ModuleId> = (typeof TRACE_GROUPS)[M][number];
/** Gruppen der Werkbank Blatt 1 (werkstoff, querschnitt, belastung, nachweis, formfaktor, bemessung, ermuedung). */
export type TraceGroup = TraceGroupOf<"gemeinsam" | "festigkeit">;
/** Rechenweg nach Gruppen; ohne Typargument der Rechenweg der Werkbank Blatt 1. */
export type Trace<G extends string = TraceGroup> = Partial<Record<G, CalcStep[]>>;

/** Überschriften der Rechenweg-Gruppen für neue Oberflächen (die Werkbank hat eigene Texte). */
export const TRACE_GROUP_TITLES: Readonly<Record<string, string>> = {
  werkstoff: "Werkstoff", querschnitt: "Querschnitt", formfaktor: "Formfaktoren", belastung: "Belastung", nachweis: "Nachweise",
  bemessung: "Bemessen", ermuedung: "Kerbwirkung und Ermüdung", stoffwerte: "Stoffwerte", geometrie: "Geometrie", reibung: "Rohrreibung",
  verluste: "Verluste", energie: "Energiehöhe und Drücke", pumpe: "Pumpe und Anlage", messung: "Durchflussmessung", druckstoss: "Druckstoß",
  passung: "Passung und Übermaß", fugendruck: "Fugendruck", spannungen: "Spannungen", montage: "Montage", nachgiebigkeit: "Nachgiebigkeiten",
  vorspannung: "Vorspannkraft", betrieb: "Betriebskräfte", abmessungen: "Abmessungen", verpressung: "Verpressung", nut: "Nut",
  extrusion: "Spaltextrusion", gleichgewicht: "Gleichgewicht", stabkraefte: "Stabkräfte", verschiebung: "Verschiebungen",
};

/** Gruppen eines Moduls in Anzeigereihenfolge. */
export function traceGroupsOf<M extends ModuleId>(m: M): readonly TraceGroupOf<M>[] {
  return TRACE_GROUPS[m] as readonly TraceGroupOf<M>[];
}

export function step(id: string, title: string, formula: string, subst: string, value: number, unit: string, ref?: string): CalcStep {
  return ref === undefined ? { id, title, formula, subst, value, unit } : { id, title, formula, subst, value, unit, ref };
}
