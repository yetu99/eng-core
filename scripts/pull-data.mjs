// Werkstoffdaten aus Supabase (Projekt "Kompendium", Tabellen wa_*) als versionierten Abzug nach data/ schreiben.
// Gleiche Dateien und Feldnamen wie bisher (materials.json, variants.json, …) plus data/snapshot.json mit Datenstand
// und SHA-256 je Datei. Gleicher Datenbankstand ergibt byteweise gleiche Dateien.
//
// Aufruf:
//   node scripts/pull-data.mjs                     Abzug nach data/ (Standard)
//   node scripts/pull-data.mjs --out <ordner>      Abzug in einen anderen Ordner (z. B. Werkstoffatlas src/data)
//   node scripts/pull-data.mjs --check             nur prüfen, ob die Datenbank einen neueren Stand hat (Exit 1 = veraltet)
//   node scripts/pull-data.mjs --from-file <json>  offline aus einem Export (tools/export_snapshot.sql) statt über das Netz
//
// Verbindung: WA_SUPABASE_URL / WA_SUPABASE_KEY (Umgebung) oder die öffentlichen Standardwerte unten.
// Der Publishable Key ist öffentlich; Referenzdaten sind für ihn nur lesbar.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const URL_ = process.env.WA_SUPABASE_URL ?? "https://gmymplnnxeljftzehkkb.supabase.co";
const KEY = process.env.WA_SUPABASE_KEY ?? "sb_publishable_zU0uhb26qswNeQ7Lr_Ao2A__JjURGnH";
const root = new URL("..", import.meta.url).pathname;

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const outDir = resolve(opt("--out") ?? join(root, "data"));
const fromFile = opt("--from-file");
const checkOnly = args.includes("--check");

// Tabellen, Spalten (Reihenfolge = Feldreihenfolge in den Dateien) und Mindestzeilen
const TABLES = {
  materials: { table: "wa_materials", min: 100, cols: ["id", "category", "subclass", "name", "designation", "aliases", "norms", "applications", "remark", "description", "advantages", "limitations", "selection_hints", "text_source_id", "text_status"] },
  variants: { table: "wa_variants", min: 146, cols: ["id", "material_id", "code", "description", "is_default"] },
  properties: { table: "wa_properties", min: 41, cols: ["id", "group_name", "name", "symbol", "unit", "class_mask", "data_type", "test_norm", "bar_scale", "filterable", "ashby_axis", "hint", "sort_order", "kb_kind", "kb_target"] },
  propertyValues: { table: "wa_values", min: 1787, cols: ["id", "variant_id", "property_id", "value", "value_min", "value_max", "value_text", "operator", "condition", "value_type", "status", "source_id", "source_locator", "confidence", "remark", "sort_key"] },
  sources: { table: "wa_sources", min: 137, cols: ["id", "kind", "short_name", "title", "publisher", "url", "access", "note", "viewed", "local_file", "kb_source_id"] },
  processes: { table: "wa_processes", min: 16, cols: ["name", "class_mask", "sort_order"] },
  processability: { table: "wa_processability", min: 814, cols: ["material_id", "process", "rating", "not_applicable", "note", "source_id", "confidence", "status"] },
};

// Sortierung nach Codepunkten (wie collate "C"), unabhängig von der Datenbank-Kollation
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const num = (x) => (x ?? Number.MAX_SAFE_INTEGER);

function headers() {
  const h = { apikey: KEY };
  if (KEY.startsWith("eyJ")) h.Authorization = `Bearer ${KEY}`;
  return h;
}

async function getAll(table, select) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = `${URL_}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1000&offset=${offset}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function currentRelease() {
  const res = await fetch(`${URL_}/rest/v1/wa_v_current_release?select=version,released_at,title`, { headers: headers() });
  if (!res.ok) throw new Error(`wa_v_current_release: HTTP ${res.status}`);
  const [r] = await res.json();
  if (!r) throw new Error("keine Freigabe in wa_releases");
  return r;
}

function loadFromFile(path) {
  let obj = JSON.parse(readFileSync(path, "utf8"));
  if (obj && typeof obj.result === "string") { // gespeicherte MCP-Antwort
    const inner = obj.result.split(">\n").slice(1).join(">\n");
    obj = JSON.parse(inner.slice(0, inner.lastIndexOf("\n</untrusted")));
  }
  if (Array.isArray(obj)) obj = obj[0];
  if (obj.snapshot) obj = obj.snapshot;
  if (typeof obj === "string") obj = JSON.parse(obj);
  return obj;
}

function shape(data) {
  const out = {};
  for (const [file, t] of Object.entries(TABLES)) {
    const rows = (data[file] ?? []).map((r) => Object.fromEntries(t.cols.map((c) => [c, r[c] ?? null])));
    if (rows.length < t.min) throw new Error(`${file}: nur ${rows.length} Zeilen (erwartet mindestens ${t.min}), nichts geschrieben`);
    out[file] = rows;
  }
  const procOrder = new Map(out.processes.map((p) => [p.name, num(p.sort_order)]));
  out.materials.sort((a, b) => cmp(a.id, b.id));
  out.variants.sort((a, b) => cmp(a.id, b.id));
  out.properties.sort((a, b) => num(a.sort_order) - num(b.sort_order) || cmp(a.id, b.id));
  out.propertyValues.sort((a, b) => cmp(a.id, b.id));
  out.sources.sort((a, b) => cmp(a.id, b.id));
  out.processes.sort((a, b) => num(a.sort_order) - num(b.sort_order) || cmp(a.name, b.name));
  out.processability.sort((a, b) => cmp(a.material_id, b.material_id) || num(procOrder.get(a.process)) - num(procOrder.get(b.process)) || cmp(a.process, b.process));
  return out;
}

const dump = (x) => JSON.stringify(x, null, 1) + "\n";

async function main() {
  if (checkOnly) {
    const rel = await currentRelease();
    const snapFile = join(outDir, "snapshot.json");
    const have = existsSync(snapFile) ? JSON.parse(readFileSync(snapFile, "utf8")).release?.version : null;
    if (have === rel.version) { console.log(`Datenstand aktuell: ${have}`); return; }
    console.log(`Neuer Datenstand in der Datenbank: ${rel.version} (${rel.title ?? ""}), lokal: ${have ?? "keiner"}. Aktualisieren mit: npm run data:pull`);
    process.exitCode = 1;
    return;
  }
  let raw, release;
  if (fromFile) {
    raw = loadFromFile(fromFile);
    release = raw.release;
  } else {
    release = await currentRelease();
    raw = {};
    for (const [file, t] of Object.entries(TABLES)) raw[file] = await getAll(t.table, t.cols.join(","));
    const after = await currentRelease(); // während des Abzugs freigegeben? dann abbrechen
    if (after.version !== release.version) throw new Error(`Freigabe während des Abzugs geändert (${release.version} → ${after.version}), bitte erneut starten`);
  }
  const data = shape(raw);
  const files = {};
  const blobs = {};
  for (const [file, rows] of Object.entries(data)) {
    blobs[file] = dump(rows);
    files[file] = { rows: rows.length, sha256: createHash("sha256").update(blobs[file]).digest("hex") };
  }
  const meta = {
    release: { version: release.version, released_at: release.released_at ?? null, title: release.title ?? null },
    source: "Supabase Kompendium, Tabellen wa_* (eng-core scripts/pull-data.mjs)",
    files,
  };
  mkdirSync(outDir, { recursive: true });
  for (const [file, blob] of Object.entries(blobs)) writeFileSync(join(outDir, `${file}.json`), blob);
  writeFileSync(join(outDir, "snapshot.json"), dump(meta));
  console.log(`${meta.release.version}: ${Object.entries(files).map(([f, v]) => `${f} ${v.rows}`).join(", ")} → ${outDir}`);
}

main().catch((e) => { console.error(`Abbruch: ${e.message}`); process.exit(1); });
