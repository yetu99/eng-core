// Kopiert den Rechenkern deterministisch in eine App: src/** → <app>/src/core, data/**/*.json → <app>/src/data.
// Schreibt <app>/src/core/MANIFEST.json mit SHA-256 jeder Datei (Integritätsprüfung in der App möglich).
//
// Aufruf:
//   node scripts/sync-to-app.mjs ../fidelity-overlay-app                    ganzer Kern (wie bis 0.9.0)
//   node scripts/sync-to-app.mjs <app> --tool werkbank|fachtools            Module des Werkzeugs (src/modules.json)
//   node scripts/sync-to-app.mjs <app> --modules gemeinsam,fluid            nur diese Module
//   Zusatz: --dry-run (nur anzeigen)
//
// Mit --tool/--modules (ab 0.10.0): Basisdateien (modules.json "base") plus die Pfade der Module, ergänzt um alle
// Dateien, die davon über relative Importe erreicht werden (Hülle, z. B. Lamé aus mechanics/pressure.ts für den
// Pressverband). Daten nur, soweit importiert. index.ts wird auf die kopierten Dateien gekürzt. Dateien, die der
// letzte Sync laut MANIFEST.json geschrieben hat und die jetzt fehlen, werden entfernt (nie andere App-Dateien).
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, relative, dirname, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const app = args[0];
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dry = args.includes("--dry-run");
if (!app || app.startsWith("--") || !existsSync(join(app, "package.json"))) { console.error("Pfad zur App fehlt oder ungültig"); process.exit(1); }
const root = new URL("..", import.meta.url).pathname;
const SRC = join(root, "src"), DATA = join(root, "data");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const reg = JSON.parse(readFileSync(join(SRC, "modules.json"), "utf8"));
const walk = (d) => readdirSync(d).sort().flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const posix = (p) => p.split(sep).join("/");

// Modulauswahl
let modules = null;
if (opt("--tool")) {
  const t = reg.tools[opt("--tool")];
  if (!t) { console.error(`Werkzeug ${opt("--tool")} unbekannt (${Object.keys(reg.tools).join(", ")})`); process.exit(1); }
  modules = t.modules;
} else if (opt("--modules")) {
  modules = opt("--modules").split(",").map((s) => s.trim()).filter(Boolean);
  const bad = modules.filter((m) => !reg.modules[m]);
  if (bad.length) { console.error(`Module unbekannt: ${bad.join(", ")} (${Object.keys(reg.modules).join(", ")})`); process.exit(1); }
}

// Dateiliste: ganzer Kern oder Hülle der Module
const IMPORT_RE = /(?:^|\s)(?:import|export)\s[^;]*?from\s+"(\.{1,2}\/[^"]+)"|import\s+"(\.{1,2}\/[^"]+)"/gm;
function resolveImport(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const c of [base, `${base}.ts`, join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c;
  throw new Error(`${posix(relative(root, fromFile))}: Import ${spec} nicht auflösbar`);
}
function closure(start) {
  const seen = new Set(), todo = [...start];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    if (!f.endsWith(".ts")) continue;
    if (f === join(SRC, "index.ts")) continue; // index.ts wird gekürzt, zieht nichts nach
    for (const m of readFileSync(f, "utf8").matchAll(IMPORT_RE)) todo.push(resolveImport(f, m[1] ?? m[2]));
  }
  return [...seen];
}

let srcFiles, dataFiles, missing = [];
if (modules === null) {
  srcFiles = walk(SRC);
  dataFiles = walk(DATA).filter((f) => f.endsWith(".json"));
} else {
  const start = [...reg.base.map((b) => join(SRC, b))];
  for (const m of modules) for (const p of reg.modules[m].paths) {
    const abs = join(SRC, p);
    if (!existsSync(abs)) { missing.push(`${m}: src/${p}`); continue; }
    start.push(...(statSync(abs).isDirectory() ? walk(abs) : [abs]));
  }
  const all = closure(start);
  const outside = all.filter((f) => !f.startsWith(SRC + sep) && !f.startsWith(DATA + sep));
  if (outside.length) throw new Error(`Importe außerhalb von src/ und data/: ${outside.map((f) => posix(relative(root, f))).join(", ")}`);
  srcFiles = all.filter((f) => f.startsWith(SRC + sep)).sort();
  dataFiles = all.filter((f) => f.startsWith(DATA + sep)).sort();
}

// index.ts kürzen: nur Exportzeilen, deren Ziel kopiert wird
function indexText() {
  const txt = readFileSync(join(SRC, "index.ts"), "utf8");
  if (modules === null) return txt;
  const set = new Set(srcFiles);
  const lines = txt.split("\n").filter((l) => {
    const m = /from\s+"(\.\/[^"]+)"/.exec(l);
    return !m || set.has(resolveImport(join(SRC, "index.ts"), m[1]));
  });
  return lines.join("\n").replace(" */\n", ` *\n * Gekürzt von scripts/sync-to-app.mjs auf die Module: ${modules.join(", ")}.\n */\n`);
}

const manifest = { package: pkg.name, version: pkg.version, ...(modules ? { modules } : {}), files: {} };
const writes = [];
const copy = (buf, dst, rel) => { writes.push([dst, buf]); manifest.files[rel] = createHash("sha256").update(buf).digest("hex"); };
for (const f of srcFiles) {
  const rel = posix(relative(SRC, f));
  copy(rel === "index.ts" ? Buffer.from(indexText(), "utf8") : readFileSync(f), join(app, "src/core", rel), `core/${rel}`);
}
for (const f of dataFiles) { const rel = posix(relative(DATA, f)); copy(readFileSync(f), join(app, "src/data", rel), `data/${rel}`); }

// Dateien des letzten Syncs, die nicht mehr dazugehören
const oldManifest = join(app, "src/core/MANIFEST.json");
const stale = existsSync(oldManifest) ? Object.keys(JSON.parse(readFileSync(oldManifest, "utf8")).files ?? {}).filter((k) => !(k in manifest.files)) : [];

const snap = JSON.parse(readFileSync(join(DATA, "snapshot.json"), "utf8"));
const modText = modules ? `\nModule: ${modules.join(", ")} (Hülle über Importe, siehe MANIFEST.json).\n` : "";
if (dry) {
  console.log(`eng-core ${pkg.version}${modules ? ` (Module ${modules.join(", ")})` : ""}: ${Object.keys(manifest.files).length} Dateien, ${stale.length} zu entfernen`);
  for (const k of Object.keys(manifest.files)) console.log(`  ${k}`);
  for (const k of stale) console.log(`  entfernen: ${k}`);
  for (const m of missing) console.log(`  noch leer: ${m}`);
  process.exit(0);
}
for (const [dst, buf] of writes) { mkdirSync(dirname(dst), { recursive: true }); writeFileSync(dst, buf); }
for (const k of stale) { const p = join(app, "src", k); if (existsSync(p)) rmSync(p); }
writeFileSync(join(app, "src/core/README.md"), `# src/core (eng-core ${pkg.version})\n\nNicht in dieser App bearbeiten. Quelle: Repo eng-core, eingespielt mit scripts/sync-to-app.mjs.\nPrüfsummen: MANIFEST.json. Formeln: FORMELKATALOG.md im Repo eng-core.\n${modText}`);
writeFileSync(join(app, "src/data/README.md"), `# src/data (Werkstoffdaten ${snap.release.version})\n\nVersionierter Abzug aus Supabase (Tabellen wa_*), identisch mit dem Werkstoffatlas. Nicht in dieser App bearbeiten; neu erzeugen mit npm run data:pull im Repo eng-core.\n`);
writeFileSync(oldManifest, JSON.stringify(manifest, null, 1) + "\n");
console.log(`eng-core ${pkg.version}${modules ? ` (Module ${modules.join(", ")})` : ""}: ${Object.keys(manifest.files).length} Dateien nach ${app} kopiert${stale.length ? `, ${stale.length} veraltete entfernt` : ""}${missing.length ? `; noch leer: ${missing.join(", ")}` : ""}`);
