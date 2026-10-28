/**
 * Modulregister, Prüfstatus je Modul, Sync nach Modulen und Fachdaten-Abzug (Vorbau 0.10.0, keine neuen Formeln).
 * Leitregel: Für die Werkbank ändert sich nichts (reportMeta(), Fußzeile, Sync-Inhalt).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectCatalog } from "../scripts/katalog";
import { MODULES, MODULE_IDS, RESERVED_PREFIXES, TOOLS, moduleOfId, idPrefix, toolOfTitle, usesFd, TRACE_GROUPS, traceGroupsOf, PRUEFSTATUS, reportMeta, reportFooter, reportVerdict, traceApproval, FD_VERSION, FD_FILES, CORE_VERSION } from "../src/index";

const root = new URL("..", import.meta.url).pathname;
const entries = collectCatalog();

describe("Modulregister src/modules.json", () => {
  it("jedes Präfix gehört genau einem Modul, reservierte Präfixe sind frei", () => {
    const all = MODULE_IDS.flatMap((m) => MODULES[m].prefixes);
    expect(new Set(all).size).toBe(all.length);
    for (const r of RESERVED_PREFIXES) expect(all).not.toContain(r);
  });
  it("Werkzeuge nennen nur bekannte Module; jedes Modul gehört zu seinem Werkzeug", () => {
    for (const t of Object.values(TOOLS)) for (const m of t.modules) expect(MODULE_IDS).toContain(m);
    for (const m of MODULE_IDS) expect(TOOLS[MODULES[m].tool].modules).toContain(m);
    expect(toolOfTitle("Ingenieur-Werkbank")).toBe("werkbank");
    expect(toolOfTitle("Ingenieur-Fachtools")).toBe("fachtools");
    expect(toolOfTitle("anderes")).toBeNull();
  });
  it("Präfix und Modul einer ID", () => {
    expect(idPrefix("Q-RH-I")).toBe("Q");
    expect(moduleOfId("Q-RH-I")).toBe("gemeinsam");
    expect(moduleOfId("RH-LAM")).toBe("fluid");
    expect(moduleOfId("PV-P")).toBe("verbindungen");
    expect(moduleOfId("P-LAME-SR")).toBe("festigkeit");
    expect(moduleOfId("WL-L10")).toBeNull();
    expect(usesFd(TOOLS.werkbank.modules)).toBe(false);
    expect(usesFd(TOOLS.fachtools.modules)).toBe(true);
  });
  it("Rechenweg-Gruppen je Modul: Werkbank unverändert, alle Module belegt", () => {
    expect(Object.keys(TRACE_GROUPS).sort()).toEqual([...MODULE_IDS].sort());
    expect([...traceGroupsOf("gemeinsam"), ...traceGroupsOf("festigkeit")].sort()).toEqual(["belastung", "bemessung", "ermuedung", "formfaktor", "nachweis", "querschnitt", "werkstoff"]);
    for (const m of MODULE_IDS) expect(new Set(traceGroupsOf(m)).size).toBe(traceGroupsOf(m).length);
  });
  it("jede Katalogformel ist einem Modul zugeordnet, heute nur Werkbank-Module", () => {
    for (const e of entries) expect(e.module).toBe(moduleOfId(e.id));
    expect(new Set(entries.map((e) => e.module))).toEqual(new Set(TOOLS.werkbank.modules));
  });
});

describe("Prüfstatus je Modul", () => {
  const ms = Object.values(PRUEFSTATUS.modules);
  const sum = (f: (x: (typeof ms)[number]) => number) => ms.reduce((a, x) => a + f(x), 0);
  it("Summe der Module = Gesamtwerte", () => {
    expect(sum((x) => x.formulas)).toBe(PRUEFSTATUS.formulas);
    expect(sum((x) => x.approved)).toBe(PRUEFSTATUS.approved);
    expect(sum((x) => x.rejected)).toBe(PRUEFSTATUS.rejected);
    expect(sum((x) => x.stale)).toBe(PRUEFSTATUS.stale);
    expect(sum((x) => x.draft)).toBe(PRUEFSTATUS.draft);
    expect(sum((x) => x.verification.passed)).toBe(PRUEFSTATUS.verification.passed);
    expect(sum((x) => x.verification.total)).toBe(PRUEFSTATUS.verification.total);
  });
  it("Formeln je Modul = Katalog", () => {
    for (const m of MODULE_IDS) expect(PRUEFSTATUS.modules[m].formulas, m).toBe(entries.filter((e) => e.module === m).length);
  });
  it("Werkbank: reportMeta() zählt wie bis 0.9.0 (alle Formeln, ganze Gegenrechnung, Abnahme der Werkbank, keine Fachdaten)", () => {
    const meta = reportMeta();
    expect(meta.modules).toEqual(TOOLS.werkbank.modules);
    expect(meta.formulas).toBe(PRUEFSTATUS.formulas);
    expect(meta.approved).toBe(PRUEFSTATUS.approved);
    expect(meta.lastApproval).toBe(PRUEFSTATUS.lastApproval);
    expect(meta.verification).toEqual(PRUEFSTATUS.verification);
    expect(meta.acceptance).toEqual(PRUEFSTATUS.acceptance);
    expect(meta.fd).toBeNull();
    const f = reportFooter(meta, traceApproval([]));
    expect(f).not.toContain("Fachdaten");
    expect(f.split(" · ")).toHaveLength(6);
    expect(reportVerdict(meta, traceApproval([])).lines.at(-1)).not.toContain("Fachdaten");
  });
  it("Fachtools: nur eigene Module, eigene Abnahme (offen), Fachdaten-Stand in Fußzeile und Vermerk", () => {
    const meta = reportMeta("Ingenieur-Fachtools");
    expect(meta.modules).toEqual(TOOLS.fachtools.modules);
    expect(meta.formulas).toBe(TOOLS.fachtools.modules.reduce((a, m) => a + PRUEFSTATUS.modules[m].formulas, 0));
    expect(meta.acceptance.P6.status).toBe(PRUEFSTATUS.acceptanceTools.fachtools?.P6.status ?? "offen");
    expect(meta.fd).toBe(FD_VERSION ?? "–");
    expect(reportFooter(meta, traceApproval([]))).toContain(`Fachdaten ${meta.fd}`);
    expect(reportVerdict(meta, traceApproval([])).level).not.toBe("ok");
  });
  it("Modulauswahl von Hand", () => {
    const a = reportMeta("Werkstoffauswahl", ["ashby"]);
    expect(a.formulas).toBe(PRUEFSTATUS.modules.ashby.formulas);
    expect(a.verification).toEqual(PRUEFSTATUS.modules.ashby.verification);
    expect(reportMeta("Unbekannt").formulas).toBe(PRUEFSTATUS.formulas);
  });
});

describe("Fachdaten-Abzug data/fd (fd_*)", () => {
  const snap = JSON.parse(readFileSync(join(root, "data/fd/snapshot.json"), "utf8"));
  it("Dateien entsprechen den Prüfsummen in data/fd/snapshot.json", () => {
    for (const [file, meta] of Object.entries(snap.files as Record<string, { rows: number; sha256: string }>)) {
      const buf = readFileSync(join(root, `data/fd/${file}.json`));
      expect(createHash("sha256").update(buf).digest("hex"), file).toBe(meta.sha256);
      expect(JSON.parse(buf.toString("utf8")).length, file).toBe(meta.rows);
    }
    expect(FD_VERSION).toBe(snap.release?.version ?? null);
    expect(FD_FILES).toEqual(snap.files);
  });
  it("pull-data --fd aus einer Exportdatei: Spaltenauswahl, Sortierung, gleiche Bytes bei gleichem Stand", () => {
    const run = () => {
      const out = mkdtempSync(join(tmpdir(), "fd-"));
      execFileSync("node", ["scripts/pull-data.mjs", "--fd", "--fd-config", "test/fixtures/fd_tables.json", "--from-file", "test/fixtures/fd_export.json", "--out", out], { cwd: root });
      return out;
    };
    const a = run(), b = run();
    const rows = JSON.parse(readFileSync(join(a, "roughness.json"), "utf8"));
    expect(rows.map((r: { id: string }) => r.id)).toEqual(["R001", "R002"]);
    expect(Object.keys(rows[1])).toEqual(["id", "material", "k_min_mm", "k_max_mm", "source_id"]);
    for (const f of ["roughness.json", "snapshot.json"]) expect(readFileSync(join(a, f), "utf8")).toBe(readFileSync(join(b, f), "utf8"));
    expect(JSON.parse(readFileSync(join(a, "snapshot.json"), "utf8")).release.version).toBe("fd 0.0-test");
  });
  it("pull-data --fd bricht bei zu wenigen Zeilen ab und schreibt nichts", () => {
    const out = mkdtempSync(join(tmpdir(), "fd-"));
    const cfg = join(out, "cfg.json");
    writeFileSync(cfg, JSON.stringify([{ file: "roughness", table: "fd_roughness", min: 3, cols: ["id"], sort: ["id"] }]));
    expect(() => execFileSync("node", ["scripts/pull-data.mjs", "--fd", "--fd-config", cfg, "--from-file", "test/fixtures/fd_export.json", "--out", join(out, "d")], { cwd: root, stdio: "pipe" })).toThrow();
    expect(existsSync(join(out, "d", "snapshot.json"))).toBe(false);
  });
});

describe("sync-to-app nach Modulen", () => {
  const app = () => { const d = mkdtempSync(join(tmpdir(), "app-")); writeFileSync(join(d, "package.json"), "{}"); return d; };
  const sync = (dir: string, ...extra: string[]) => execFileSync("node", ["scripts/sync-to-app.mjs", dir, ...extra], { cwd: root, encoding: "utf8" });
  const manifest = (dir: string) => JSON.parse(readFileSync(join(dir, "src/core/MANIFEST.json"), "utf8")) as { version: string; modules?: string[]; files: Record<string, string> };
  it("--tool werkbank kopiert dieselben Dateien mit denselben Inhalten wie der ganze Kern (außer index.ts-Kopf)", () => {
    const a = app(), b = app();
    sync(a); sync(b, "--tool", "werkbank");
    const ma = manifest(a), mb = manifest(b);
    expect(Object.keys(mb.files)).toEqual(Object.keys(ma.files));
    for (const k of Object.keys(ma.files)) if (k !== "core/index.ts") expect(mb.files[k], k).toBe(ma.files[k]);
    const strip = (s: string) => s.split("\n").filter((l) => !l.includes("Gekürzt von") && l.trim() !== "*").join("\n");
    expect(strip(readFileSync(join(b, "src/core/index.ts"), "utf8"))).toBe(strip(readFileSync(join(a, "src/core/index.ts"), "utf8")));
    expect(mb.modules).toEqual(TOOLS.werkbank.modules);
    expect(mb.version).toBe(CORE_VERSION);
  });
  it("--tool fachtools: keine Werkbank-Module, Hülle vollständig, Index gekürzt, veraltete Dateien entfernt", () => {
    const d = app();
    sync(d);
    const out = sync(d, "--tool", "fachtools");
    const m = manifest(d);
    const files = Object.keys(m.files);
    expect(files.some((f) => f.startsWith("core/ashby/"))).toBe(false);
    expect(files.some((f) => f.startsWith("core/mechanics/"))).toBe(false);
    for (const f of ["core/report.ts", "core/modules.json", "core/fdVersion.ts", "core/data.ts", "data/fd/snapshot.json", "data/materials.json"]) expect(files).toContain(f);
    expect(existsSync(join(d, "src/core/mechanics/compute.ts"))).toBe(false);
    expect(readFileSync(join(d, "src/core/index.ts"), "utf8")).not.toContain("./mechanics/");
    expect(out).toContain("veraltete entfernt");
  });
  it("unbekanntes Modul bricht ab", () => {
    expect(() => execFileSync("node", ["scripts/sync-to-app.mjs", app(), "--modules", "quatsch"], { cwd: root, stdio: "pipe" })).toThrow();
  });
});
