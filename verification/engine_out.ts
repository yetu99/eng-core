/** Gibt die Ergebnisse des Rechenkerns für die Prüffälle aus pruefung.py als JSON aus. Aufruf: npx tsx verification/engine_out.ts <cases.json> */
import { readFileSync } from "node:fs";
import { repo } from "../src/data";
import { evalCase, type Case } from "./eval";

const cases = JSON.parse(readFileSync(process.argv[2] ?? "", "utf8")) as Case[];
const out: Record<string, Record<string, number | null>> = {};
for (const c of cases) out[c.id] = evalCase(repo, c);
process.stdout.write(JSON.stringify(out));
