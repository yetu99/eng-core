/**
 * Schreibt die Fälle Schraubenverbindung (scripts/sv-faelle.ts: svFaelle, svFehlerfaelle) als JSON für die Python-Gegenrechnung
 * (verification/verbindungen.py, Abschnitt SV). Aufruf: npx tsx scripts/sv-json.ts. Vitest prüft, dass die Datei aktuell ist.
 */
import { writeFileSync } from "node:fs";
import { svFaelle, svFehlerfaelle } from "./sv-faelle";

export const svJson = (): string => JSON.stringify({ faelle: svFaelle, fehler: svFehlerfaelle }, null, 1) + "\n";
if (process.argv[1]?.endsWith("sv-json.ts")) {
  writeFileSync(new URL("../verification/sv_faelle.json", import.meta.url), svJson());
  console.log("verification/sv_faelle.json geschrieben");
}
