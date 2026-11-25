/**
 * Schreibt die Fälle O-Ring (scripts/or-faelle.ts: orFaelle, orFehlerfaelle, orKatFaelle) als JSON für die Python-Gegenrechnung
 * (verification/dichtungen.py). Aufruf: npx tsx scripts/or-json.ts. Vitest prüft, dass die Datei aktuell ist.
 */
import { writeFileSync } from "node:fs";
import { orFaelle, orFehlerfaelle, orKatFaelle } from "./or-faelle";

export const orJson = (): string => JSON.stringify({ faelle: orFaelle, fehler: orFehlerfaelle, katalog: orKatFaelle }, null, 1) + "\n";
if (process.argv[1]?.endsWith("or-json.ts")) {
  writeFileSync(new URL("../verification/or_faelle.json", import.meta.url), orJson());
  console.log("verification/or_faelle.json geschrieben");
}
