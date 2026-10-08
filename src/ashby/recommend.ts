/**
 * Empfehlung für Blatt 2 und Startlage der Indexlinie.
 * Reihenfolge der Entscheidung: Schritt 6 (Masse + Kosten, falls berechnet) vor Schritt 5 (mit Form) vor Schritt 4 (Index).
 */
import { fmt } from "../format";
import type { Material } from "../materials";
import type { RankedPoint } from "./select";
import { byScore, type ConflictResult } from "./conflicts";

export interface Recommendation {
  m: Material;
  step: 4 | 5 | 6;
  /** Begründung in einem Satz */
  why: string;
  /** nächstbeste Werkstoffe (bis 3) */
  alternatives: Material[];
  /** Sieger je Schritt, für die Leiste "4 Index · 5 mit Form · 6 Masse + Kosten" */
  path: Array<{ step: 4 | 5 | 6; label: string; m: Material | null }>;
}

/**
 * @param r4 Rangliste ohne Form (Schritt 4)
 * @param r5 Rangliste mit Form (Schritt 5) oder null, wenn Form nicht wirkt oder "ohne Form" gewählt ist
 * @param mc Ergebnis Schritt 6 oder null, wenn nicht berechnet
 * @param alpha Austauschkonstante in €/kg (nur für den Begründungstext)
 */
export function recommend(r4: RankedPoint[], r5: RankedPoint[] | null, mc: ConflictResult | null, alpha: number): Recommendation | null {
  const z = mc ? byScore(mc.rows) : [];
  const path: Recommendation["path"] = [
    { step: 4, label: "Index", m: r4[0]?.m ?? null },
    { step: 5, label: "mit Form", m: r5?.[0]?.m ?? null },
    { step: 6, label: "Masse + Kosten", m: z[0]?.m ?? null },
  ];
  if (z[0]) return { m: z[0].m, step: 6, why: `kleinste Gesamtwertung Z = α·m + C bei α = ${fmt(alpha)} €/kg, maßgebend ${z[0].active}`, alternatives: z.slice(1, 4).map((r) => r.m), path };
  if (r5?.[0]) return { m: r5[0].m, step: 5, why: "höchster Materialindex mit Form", alternatives: r5.slice(1, 4).map((p) => p.m), path };
  if (r4[0]) return { m: r4[0].m, step: 4, why: "höchster Materialindex", alternatives: r4.slice(1, 4).map((p) => p.m), path };
  return null;
}

/** Startlage der Indexlinie: durch den Werkstoff auf Rang 7 (so liegen die besten sechs oberhalb). */
export function defaultIndexLine(ranked: RankedPoint[]): number {
  return ranked.length > 6 ? (ranked[6] as RankedPoint).idx : ranked[ranked.length - 1]?.idx ?? 1e-3;
}
