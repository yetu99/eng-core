/**
 * Erzeugt FORMELKATALOG.md deterministisch aus dem Rechenkern (scripts/katalog.ts).
 * Freigabestatus kommt aus formelstatus.json, das aus der Freigabe-Excel importiert wird
 * (python3 scripts/formelfreigabe.py import <datei.xlsx>). Standard: "Entwurf".
 * Aufruf: npx tsx scripts/formelkatalog.ts [--check]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { CORE_VERSION } from "../src/index";
import { collectCatalog, readStatus, effectiveStatus } from "./katalog";

const entries = collectCatalog();
const status = readStatus();
const esc = (s: string) => s.replace(/\|/g, "\\|");
const count = { freigegeben: 0, abgelehnt: 0, stale: 0, entwurf: 0 };
let md = `# Formelkatalog eng-core ${CORE_VERSION}\n\nAutomatisch erzeugt mit \`npx tsx scripts/formelkatalog.ts\`. Nicht von Hand bearbeiten.\nFreigaben laufen über die Excel-Datei: \`python3 scripts/formelfreigabe.py export\` → ausfüllen → \`python3 scripts/formelfreigabe.py import <datei.xlsx>\`.\n\nStatus: **Entwurf** = implementiert und gegengerechnet (verification/pruefung.py), **freigegeben** = vom Verantwortlichen geprüft, **abgelehnt** = Einwand offen (siehe unten), **geändert, neu prüfen** = Formel hat sich seit der Freigabe geändert.\n`;
let body = "", last = "";
for (const e of entries) {
  if (e.group !== last) { body += `\n## ${e.groupTitle}\n\n| ID | Größe | Formel | Einheit | Quelle | Status |\n|---|---|---|---|---|---|\n`; last = e.group; }
  const st = status[e.id]; const eff = effectiveStatus(e, st);
  if (eff.stale) count.stale++; else if (eff.label === "freigegeben") count.freigegeben++; else if (eff.label === "abgelehnt") count.abgelehnt++; else count.entwurf++;
  const meta = st && !eff.stale && eff.label !== "Entwurf" && st.datum ? ` (${st.datum}${st.durch ? `, ${st.durch}` : ""})` : "";
  body += `| ${e.id} | ${esc(e.title)} | ${esc(e.formula)} | ${e.unit} | ${esc(e.ref)} | ${eff.label}${meta} |\n`;
}
md += `\nStand: ${entries.length} Formeln, davon ${count.freigegeben} freigegeben, ${count.abgelehnt} abgelehnt, ${count.stale} neu zu prüfen, ${count.entwurf} Entwurf.\n` + body;
const objections = entries.filter((e) => status[e.id]?.kommentar && effectiveStatus(e, status[e.id]).label !== "freigegeben");
if (objections.length) {
  md += `\n## Einwände und Verbesserungen\n\n| ID | Status | Datum | Prüfer | Kommentar | Antwort |\n|---|---|---|---|---|---|\n`;
  for (const e of objections) { const s = status[e.id]!; md += `| ${e.id} | ${effectiveStatus(e, s).label} | ${s.datum ?? ""} | ${esc(s.durch ?? "")} | ${esc(s.kommentar ?? "")} | ${esc(s.antwort ?? "")} |\n`; }
}
md += `\n## Gültigkeit und Annahmen\n\n- Linear-elastisch, kleine Verformungen, Bernoulli-Balken, statische Last, isotroper Werkstoff.\n- Torsion Hohlprofile nach Bredt (t ≪ Abmessung); Rechteck voll nach Roark Tab. 10.1 (Näherung, < 0,2 % gegen Saint-Venant-Reihe).\n- Vergleichsspannung GEH an der Randfaser; τ_Q separat (Maximum an der Nulllinie).\n- Knicken: Euler für λ ≥ λ_T = π·√(2E/R_p), darunter Johnson-Parabel; keine Imperfektionen, keine Normknickkurven.\n- Auslegungswert standardmäßig unterer Wert der Datenbankzeile; Normhöchstwerte liefern keinen Auslegungswert.\n- Bemessen: Bisektion im log-Raum, 60 Schritte, Raster 1 mm (Wandstärke 0,5 mm).\n`;
const out = new URL("../FORMELKATALOG.md", import.meta.url);
if (process.argv.includes("--check")) {
  if (!existsSync(out) || readFileSync(out, "utf8") !== md) { console.error("FORMELKATALOG.md ist nicht aktuell. npx tsx scripts/formelkatalog.ts ausführen."); process.exit(1); }
  console.log("FORMELKATALOG.md aktuell");
} else { writeFileSync(out, md); console.log(`FORMELKATALOG.md: ${entries.length} Formeln (${count.freigegeben} freigegeben, ${count.abgelehnt} abgelehnt, ${count.stale} neu zu prüfen)`); }
