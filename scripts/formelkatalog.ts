/**
 * Erzeugt FORMELKATALOG.md deterministisch aus dem Rechenkern: Alle Rechenschritte aller Belastungsarten,
 * Querschnitte und Bemessungsfälle werden ausgeführt, jede Formel-ID erscheint genau einmal.
 * Freigabestatus wird aus formelstatus.json übernommen (Standard "Entwurf").
 * Aufruf: npx tsx scripts/formelkatalog.ts [--check]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { computeStrength, designSize, SECTIONS, BENDING_CASES, TENSION_CASES, BUCKLING_CASES, TORSION_CASES, CORE_VERSION, type CalcStep, type StrengthInput, type SecType } from "../src/index";
import { repo } from "../src/data";

const base: StrengthInput = { mode: "single", kind: "biegung", sub: "EQ", materialId: "W038", secType: "rund_hohl", dims: { D: 60, t: 4 }, L: 1200, F: 2, q: 2, a: 300, N: 0, T: 200, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null } };
const runs: Array<Partial<StrengthInput>> = [
  ...Object.keys(TENSION_CASES).map((sub) => ({ kind: "zug" as const, sub })),
  ...Object.keys(BUCKLING_CASES).map((sub) => ({ kind: "druck" as const, sub, F: 20 })),
  ...Object.keys(BUCKLING_CASES).map((sub) => ({ kind: "druck" as const, sub, F: 20, L: 300 })),
  ...Object.keys(BENDING_CASES).map((sub) => ({ kind: "biegung" as const, sub })),
  ...Object.keys(TORSION_CASES).map((sub) => ({ kind: "torsion" as const, sub })),
  { mode: "combined", sub: "EQ", N: -10, T: 150 }, { materialId: "W001" }, { materialId: "W096", secType: "rechteck_voll", dims: { b: 60, h: 120 } }, { materialId: "W060" },
];
const groupTitle: Record<string, string> = { Q: "Querschnitte", F: "Formfaktoren (Ashby Kap. 7.2)", W: "Werkstoff und Auslegungswerte", B: "Biegung", Z: "Zug und Druck", K: "Knicken", T: "Torsion", N: "Nachweise", D: "Bemessen" };
const seen = new Map<string, CalcStep>();
const take = (s: CalcStep) => { const id = s.id.replace(/^D-(ERF|GEW)-.*/, "D-$1"); if (!seen.has(id)) seen.set(id, { ...s, id }); };
for (const t of Object.keys(SECTIONS) as SecType[]) { const dims = Object.fromEntries(SECTIONS[t].fields.map(([k, , v]) => [k, v])); runs.push({ secType: t, dims }); }
for (const r of runs) { const res = computeStrength(repo, { ...base, ...r }); Object.values(res.trace).forEach((arr) => arr?.forEach(take)); }
const d = designSize(repo, { ...base, q: 4 }, "formtreu"); d.trace.forEach(take);

const statusFile = new URL("../formelstatus.json", import.meta.url);
const status: Record<string, { status: string; datum?: string; durch?: string }> = existsSync(statusFile) ? JSON.parse(readFileSync(statusFile, "utf8")) : {};
const esc = (s: string) => s.replace(/\|/g, "\\|");
let md = `# Formelkatalog eng-core ${CORE_VERSION}\n\nAutomatisch erzeugt mit \`npx tsx scripts/formelkatalog.ts\`. Nicht von Hand bearbeiten. Freigaben in \`formelstatus.json\` eintragen.\n\nStatus: **Entwurf** = implementiert und gegengerechnet (verification/pruefung.py), **freigegeben** = vom Verantwortlichen geprüft.\n`;
const ids = [...seen.keys()].sort((a, b) => a.localeCompare(b, "de"));
let last = "";
for (const id of ids) {
  const s = seen.get(id)!; const g = id.split("-")[0] ?? "";
  if (g !== last) { md += `\n## ${groupTitle[g] ?? g}\n\n| ID | Größe | Formel | Einheit | Quelle | Status |\n|---|---|---|---|---|---|\n`; last = g; }
  const st = status[id]; md += `| ${id} | ${esc(s.title)} | ${esc(s.formula)} | ${s.unit} | ${esc(s.ref ?? "")} | ${st ? `${st.status}${st.datum ? ` (${st.datum}${st.durch ? `, ${st.durch}` : ""})` : ""}` : "Entwurf"} |\n`;
}
md += `\n## Gültigkeit und Annahmen\n\n- Linear-elastisch, kleine Verformungen, Bernoulli-Balken, statische Last, isotroper Werkstoff.\n- Torsion Hohlprofile nach Bredt (t ≪ Abmessung); Rechteck voll nach Roark Tab. 10.1 (Näherung, < 0,2 % gegen Saint-Venant-Reihe).\n- Vergleichsspannung GEH an der Randfaser; τ_Q separat (Maximum an der Nulllinie).\n- Knicken: Euler für λ ≥ λ_T = π·√(2E/R_p), darunter Johnson-Parabel; keine Imperfektionen, keine Normknickkurven.\n- Auslegungswert standardmäßig unterer Wert der Datenbankzeile; Normhöchstwerte liefern keinen Auslegungswert.\n- Bemessen: Bisektion im log-Raum, 60 Schritte, Raster 1 mm (Wandstärke 0,5 mm).\n`;
const out = new URL("../FORMELKATALOG.md", import.meta.url);
if (process.argv.includes("--check")) { if (!existsSync(out) || readFileSync(out, "utf8") !== md) { console.error("FORMELKATALOG.md ist nicht aktuell. npx tsx scripts/formelkatalog.ts ausführen."); process.exit(1); } console.log("FORMELKATALOG.md aktuell"); }
else { writeFileSync(out, md); console.log(`FORMELKATALOG.md: ${ids.length} Formeln`); }
