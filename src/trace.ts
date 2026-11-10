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
  /**
   * Ergebnis als Matrix oder Vektor (ab 0.12.0, Modul kinematik), zeilenweise; ein Vektor als eine Zeile.
   * `value` ist dann ein Kontrollwert (Matrix: Spur, Vektor: Betrag), siehe Formelkatalog.
   */
  matrix?: readonly (readonly number[])[];
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
  fluid: ["stoffwerte", "geometrie", "reibung", "verluste", "energie", "pumpe", "messung", "druckstoss", "nachweis"],
  verbindungen: ["werkstoff", "geometrie", "passung", "fugendruck", "betrieb", "spannungen", "montage", "plastisch", "fliehkraft", "nachgiebigkeit", "kraft", "vorspannung", "festigkeit", "schwingung", "pressung", "gleiten", "anziehen", "vorwahl", "nachweis"],
  dichtungen: ["abmessungen", "verpressung", "nut", "extrusion", "nachweis"],
  stabwerke: ["geometrie", "gleichgewicht", "stabkraefte", "verschiebung", "nachweis"],
  kinematik: ["orientierung", "umrechnung", "pruefung", "lage", "kette", "inverse", "abbildung", "gelenke", "vorwaerts", "kontrolle"],
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
  orientierung: "Orientierung", umrechnung: "Umrechnung der Darstellungen", pruefung: "Prüfung der Rotationsmatrix",
  plastisch: "Elastisch-plastisch (DIN 7190-1 Abschn. 4.3)", fliehkraft: "Fliehkraft (DIN 7190-1 Abschn. 10.2)",
  kraft: "Kraftverhältnis und Betriebskräfte (R3)", festigkeit: "Montage- und Betriebsbeanspruchung (R7, R8)", schwingung: "Dauerhaltbarkeit (R9)", pressung: "Flächenpressung (R10)",
  gleiten: "Gleiten, Abscheren, Einschraubtiefe (R11, R12)", anziehen: "Anziehen und Lösen (R13)", vorwahl: "Vorwahl und Auslegung (R0)",
  lage: "Lage der Rahmen", kette: "Rahmenkette und relative Lage", inverse: "Inverse", abbildung: "Punkt, Richtung und Verschieben",
  gelenke: "Gelenke und DH-Gliedmatrizen", vorwaerts: "Vorwärtskinematik", kontrolle: "Kontrolle und Umrechnung",
};

/** Gruppen eines Moduls in Anzeigereihenfolge. */
export function traceGroupsOf<M extends ModuleId>(m: M): readonly TraceGroupOf<M>[] {
  return TRACE_GROUPS[m] as readonly TraceGroupOf<M>[];
}

export function step(id: string, title: string, formula: string, subst: string, value: number, unit: string, ref?: string): CalcStep {
  return ref === undefined ? { id, title, formula, subst, value, unit } : { id, title, formula, subst, value, unit, ref };
}
