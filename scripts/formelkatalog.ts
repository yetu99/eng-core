/**
 * Erzeugt FORMELKATALOG.md deterministisch aus dem Rechenkern (scripts/katalog.ts).
 * Freigabestatus kommt aus formelstatus.json, das aus der Freigabe-Excel importiert wird
 * (python3 scripts/formelfreigabe.py import <datei.xlsx>). Standard: "Entwurf".
 * Schreibt zusätzlich src/pruefstatus.json (Prüfstand je Formel, Gegenrechnung, Abnahme) für reportMeta() und den
 * PDF-Prüfvermerk. Eingaben: formelstatus.json, verification/ergebnis.json, verification/abnahme.json.
 * Aufruf: npx tsx scripts/formelkatalog.ts [--check]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { CORE_VERSION } from "../src/index";
import { MODULES, MODULE_IDS, type ModuleId } from "../src/modules";
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
md += `\nStand: ${entries.length} Formeln, davon ${count.freigegeben} freigegeben, ${count.abgelehnt} abgelehnt, ${count.stale} neu zu prüfen, ${count.entwurf} Entwurf.\n`;
// Module (ab 0.10.0): Zuordnung über das Präfix der ID, Register src/modules.json
md += `\n| Modul | Werkzeug | Präfixe | Formeln | freigegeben |\n|---|---|---|---|---|\n`;
for (const m of MODULE_IDS) {
  const es = entries.filter((e) => e.module === m);
  md += `| ${m} | ${MODULES[m].tool} | ${MODULES[m].prefixes.join(", ")} | ${es.length} | ${es.filter((e) => effectiveStatus(e, status[e.id]).label === "freigegeben" && !effectiveStatus(e, status[e.id]).stale).length} |\n`;
}
md += body;
const objections = entries.filter((e) => status[e.id]?.kommentar && effectiveStatus(e, status[e.id]).label !== "freigegeben");
if (objections.length) {
  md += `\n## Einwände und Verbesserungen\n\n| ID | Status | Datum | Prüfer | Kommentar | Antwort |\n|---|---|---|---|---|---|\n`;
  for (const e of objections) { const s = status[e.id]!; md += `| ${e.id} | ${effectiveStatus(e, s).label} | ${s.datum ?? ""} | ${esc(s.durch ?? "")} | ${esc(s.kommentar ?? "")} | ${esc(s.antwort ?? "")} |\n`; }
}
md += `\n## Gültigkeit und Annahmen\n\n- Linear-elastisch, kleine Verformungen, Bernoulli-Balken, statische Last, isotroper Werkstoff.\n- Torsion Hohlprofile nach Bredt (t ≪ Abmessung); Rechteck voll nach Roark Tab. 10.1 (Näherung, < 0,2 % gegen Saint-Venant-Reihe).\n- Vergleichsspannung GEH an der Randfaser; τ_Q separat (Maximum an der Nulllinie).\n- Knicken: Euler für λ ≥ λ_T = π·√(2E/R_p), darunter Johnson-Parabel; keine Imperfektionen, keine Normknickkurven.\n- Auslegungswert standardmäßig unterer Wert der Datenbankzeile; Normhöchstwerte liefern keinen Auslegungswert.\n- Bemessen: Bisektion im log-Raum, 60 Schritte, Raster 1 mm (Wandstärke 0,5 mm).\n- Druckbehälter: Lamé (Zylinder, Kugel), rotationssymmetrisch, ungestörte Wand weit vom Boden, isotherm; keine Böden, Stutzen, Beulen, Wärmespannungen, plastischen Reserven, kein Normnachweis (EN 13445, AD 2000). Bemessen geschlossen bei p_a = 0, sonst Bisektion, Raster 0,5 mm.\n- Eigenfrequenz: Euler-Bernoulli-Balken, E·I und m′ = ρ·A + m_z konstant, Lagerungen KR, GG, EG, EE, starre Lager, keine Axialkraft, keine Dämpfung, Schwingung in der Lastebene; Hinweis bei L/h < 10 (Timoshenko). Wurzeln deterministisch (Einklammerung, Bisektion 80 Schritte), Einheiten N, mm, t, s. Bemessen nur formtreu.\n`;
// Prüfstatus für Berichte (src/pruefstatus.json), deterministisch: Reihenfolge wie Katalog, kein Zeitstempel
const readJson = (rel: string): unknown => { const f = new URL(rel, import.meta.url); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; };
type Ver = { passed: number; total: number };
const erg = (readJson("../verification/ergebnis.json") as (Ver & { modules?: Partial<Record<ModuleId, Ver>> }) | null) ?? { passed: 0, total: 0 };
const ver: Ver = { passed: erg.passed, total: erg.total };
const verMods = erg.modules ?? {};
const verSum = Object.values(verMods).reduce((a, v) => ({ passed: a.passed + (v?.passed ?? 0), total: a.total + (v?.total ?? 0) }), { passed: 0, total: 0 });
if (verSum.passed !== ver.passed || verSum.total !== ver.total) throw new Error(`verification/ergebnis.json: Summe der Module ${verSum.passed}/${verSum.total} ≠ gesamt ${ver.passed}/${ver.total}`);
const acc = (readJson("../verification/abnahme.json") as Record<string, unknown> | null) ?? {};
const stateOf = (e: (typeof entries)[number]): string => { const eff = effectiveStatus(e, status[e.id]); return eff.stale ? "geaendert" : eff.label === "Entwurf" ? "entwurf" : eff.label; };
const dates = entries.map((e) => status[e.id]).filter((s) => s?.status === "freigegeben" && s.datum).map((s) => s!.datum!).sort();
const modStatus = Object.fromEntries(MODULE_IDS.map((m) => {
  const es = entries.filter((e) => e.module === m);
  const st = es.map(stateOf);
  const ds = es.map((e) => status[e.id]).filter((s) => s?.status === "freigegeben" && s.datum).map((s) => s!.datum!).sort(); // wie lastApproval gesamt
  return [m, {
    formulas: es.length, approved: st.filter((x) => x === "freigegeben").length, rejected: st.filter((x) => x === "abgelehnt").length,
    stale: st.filter((x) => x === "geaendert").length, draft: st.filter((x) => x === "entwurf").length,
    lastApproval: ds.length ? ds[ds.length - 1] : null, verification: verMods[m] ?? { passed: 0, total: 0 },
  }];
}));
const ps = {
  core: CORE_VERSION, formulas: entries.length, approved: count.freigegeben, rejected: count.abgelehnt, stale: count.stale, draft: count.entwurf,
  lastApproval: dates.length ? dates[dates.length - 1] : null, verification: { passed: ver.passed, total: ver.total },
  acceptance: { P5: acc["P5"] ?? { status: "offen", text: "" }, P6: acc["P6"] ?? { status: "offen", text: "" } },
  acceptanceTools: acc["tools"] ?? {},
  modules: modStatus,
  status: Object.fromEntries(entries.map((e) => [e.id, stateOf(e)])),
};
const psText = JSON.stringify(ps, null, 1) + "\n";
const out = new URL("../FORMELKATALOG.md", import.meta.url);
const psOut = new URL("../src/pruefstatus.json", import.meta.url);
if (process.argv.includes("--check")) {
  let bad = false;
  if (!existsSync(out) || readFileSync(out, "utf8") !== md) { console.error("FORMELKATALOG.md ist nicht aktuell. npx tsx scripts/formelkatalog.ts ausführen."); bad = true; }
  if (!existsSync(psOut) || readFileSync(psOut, "utf8") !== psText) { console.error("src/pruefstatus.json ist nicht aktuell. npx tsx scripts/formelkatalog.ts ausführen."); bad = true; }
  if (bad) process.exit(1);
  console.log("FORMELKATALOG.md und src/pruefstatus.json aktuell");
} else {
  writeFileSync(out, md); writeFileSync(psOut, psText);
  console.log(`FORMELKATALOG.md: ${entries.length} Formeln (${count.freigegeben} freigegeben, ${count.abgelehnt} abgelehnt, ${count.stale} neu zu prüfen) · src/pruefstatus.json · Gegenrechnung ${ver.passed}/${ver.total}`);
}
