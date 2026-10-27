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

export type TraceGroup = "werkstoff" | "querschnitt" | "belastung" | "nachweis" | "formfaktor" | "bemessung" | "ermuedung";
export type Trace = Partial<Record<TraceGroup, CalcStep[]>>;

export function step(id: string, title: string, formula: string, subst: string, value: number, unit: string, ref?: string): CalcStep {
  return ref === undefined ? { id, title, formula, subst, value, unit } : { id, title, formula, subst, value, unit, ref };
}
