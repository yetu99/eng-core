// Kopiert den Rechenkern deterministisch in eine App: src/** → <app>/src/core, data/*.json → <app>/src/data.
// Schreibt <app>/src/core/MANIFEST.json mit SHA-256 jeder Datei (Integritätsprüfung in der App möglich).
// Aufruf: node scripts/sync-to-app.mjs ../fidelity-overlay-app
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const app = process.argv[2];
if (!app || !existsSync(join(app, "package.json"))) { console.error("Pfad zur App fehlt oder ungültig"); process.exit(1); }
const root = new URL("..", import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const walk = (d) => readdirSync(d).sort().flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const manifest = { package: pkg.name, version: pkg.version, files: {} };
const copy = (src, dst, rel) => { const buf = readFileSync(src); mkdirSync(dirname(dst), { recursive: true }); writeFileSync(dst, buf); manifest.files[rel] = createHash("sha256").update(buf).digest("hex"); };

for (const f of walk(join(root, "src"))) { const rel = relative(join(root, "src"), f); copy(f, join(app, "src/core", rel), `core/${rel}`); }
for (const f of walk(join(root, "data")).filter((f) => f.endsWith(".json"))) { const rel = relative(join(root, "data"), f); copy(f, join(app, "src/data", rel), `data/${rel}`); }
writeFileSync(join(app, "src/core/README.md"), `# src/core (eng-core ${pkg.version})\n\nNicht in dieser App bearbeiten. Quelle: Repo eng-core, eingespielt mit scripts/sync-to-app.mjs.\nPrüfsummen: MANIFEST.json. Formeln: FORMELKATALOG.md im Repo eng-core.\n`);
writeFileSync(join(app, "src/data/README.md"), `# src/data (Werkstoffdatenbank v0.3)\n\nJSON-Export der Werkstoffdatenbank, identisch mit dem Werkstoffatlas. Nicht in dieser App bearbeiten.\n`);
writeFileSync(join(app, "src/core/MANIFEST.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log(`eng-core ${pkg.version}: ${Object.keys(manifest.files).length} Dateien nach ${app} kopiert`);
