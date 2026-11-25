/**
 * Schreibt die Fälle Fachwerk (scripts/fw-faelle.ts: fwFaelle, fwFehler) als JSON für die Python-Gegenrechnung
 * (verification/stabwerke.py). Aufruf: npx tsx scripts/fw-json.ts. Vitest prüft, dass die Datei aktuell ist.
 */
import { writeFileSync } from "node:fs";
import { fwFaelle, fwFehler } from "./fw-faelle";

export const fwJson = (): string => JSON.stringify({ faelle: fwFaelle, fehler: fwFehler }, null, 1) + "\n";
if (process.argv[1]?.endsWith("fw-json.ts")) {
  writeFileSync(new URL("../verification/fw_faelle.json", import.meta.url), fwJson());
  console.log("verification/fw_faelle.json geschrieben");
}
