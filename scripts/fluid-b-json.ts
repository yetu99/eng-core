/**
 * Schreibt die Beispielfälle RH b (scripts/fluid-faelle.ts: fluidFaelleB, messFaelle, stossFaelle) als JSON für die
 * Python-Gegenrechnung (verification/fluid.py). Aufruf: npx tsx scripts/fluid-b-json.ts. Vitest prüft, dass die Datei aktuell ist.
 */
import { writeFileSync } from "node:fs";
import { fluidFaelleB, messFaelle, stossFaelle } from "./fluid-faelle";

export const fluidBJson = (): string => JSON.stringify({ lines: fluidFaelleB(), mess: messFaelle(), stoss: stossFaelle() }, null, 1) + "\n";
if (process.argv[1]?.endsWith("fluid-b-json.ts")) {
  writeFileSync(new URL("../verification/fluid_b_faelle.json", import.meta.url), fluidBJson());
  console.log("verification/fluid_b_faelle.json geschrieben");
}
