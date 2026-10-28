/**
 * Formelkatalog als Datei für den Spiegel in Supabase (Projekt Kompendium, Tabellen fk_*).
 * eng-core bleibt Master: Formeln, Tests und Gegenrechnung leben im Repo. Supabase dient anderen Tools
 * (Kompendium, Werkstoffatlas, iPeM, neue Fachtools) zum Lesen von Formeltext, Quelle und Freigabestand.
 *
 * Aufruf: npx tsx scripts/katalog-publish.ts [--check]
 *   schreibt publish/katalog.json (deterministisch, wird committet) und gibt den SQL-Aufruf aus.
 * Modul je Formel aus src/modules.json (Präfix der ID), ab 0.10.0.
 * Einspielen nach dem Push (über das Supabase-MCP, eine Zeile):
 *   select * from public.fk_publish_github('<commit>', '<md5>');
 *   Die Datenbank lädt publish/katalog.json genau dieses Commits von GitHub, prüft die MD5-Summe und
 *   übernimmt den Inhalt mit public.fk_publish (idempotent, Formeln ohne Kern-Eintrag werden retired).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CORE_VERSION } from "../src/index";
import { DATA_VERSION } from "../src/data";
import { collectCatalog, readStatus, effectiveStatus } from "./katalog";

const entries = collectCatalog();
const status = readStatus();

const formulas = entries.map((e, i) => {
  const st = status[e.id];
  const eff = effectiveStatus(e, st);
  const s = eff.stale ? "geaendert" : eff.label === "Entwurf" ? "offen" : eff.label;
  const ok = s === "freigegeben";
  return {
    id: e.id, area: e.groupTitle, module: e.module, quantity: e.title, formula: e.formula,
    unit: e.unit || null, source: e.ref || null, example: e.exSubst || null,
    example_result: Number.isFinite(e.exValue) ? Number(e.exValue.toPrecision(12)) : null, example_case: e.exCase || null,
    status: s, approved_at: ok ? st?.datum ?? null : null, approved_by: ok ? st?.durch ?? null : null,
    comment: st?.kommentar ?? null, sort: (i + 1) * 10,
  };
});
const doc = { core: CORE_VERSION, data: DATA_VERSION, formulas: formulas.length, approved: formulas.filter((f) => f.status === "freigegeben").length, items: formulas };
const text = JSON.stringify(doc, null, 1) + "\n";
const md5 = createHash("md5").update(text, "utf8").digest("hex");
const out = new URL("../publish/katalog.json", import.meta.url);

if (process.argv.includes("--check")) {
  if (!existsSync(out) || readFileSync(out, "utf8") !== text) { console.error("publish/katalog.json ist nicht aktuell. npm run katalog:publish ausführen."); process.exit(1); }
  console.log("publish/katalog.json aktuell");
} else {
  mkdirSync(new URL("../publish/", import.meta.url), { recursive: true });
  writeFileSync(out, text);
  console.log(`publish/katalog.json: ${doc.formulas} Formeln, ${doc.approved} freigegeben, eng-core ${CORE_VERSION}, md5 ${md5}`);
  console.log(`Nach Commit und Push einspielen:\n  select * from public.fk_publish_github('<commit>', '${md5}');`);
}
