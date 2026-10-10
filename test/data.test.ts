import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DATA_VERSION } from "../src/data";

const dir = new URL("../data/", import.meta.url);
const snapshot = JSON.parse(readFileSync(new URL("snapshot.json", dir), "utf8"));

describe("Datenabzug (data/)", () => {
  it("Dateien entsprechen den Prüfsummen in snapshot.json (nicht von Hand geändert)", () => {
    for (const [file, meta] of Object.entries(snapshot.files as Record<string, { rows: number; sha256: string }>)) {
      const buf = readFileSync(new URL(`${file}.json`, dir));
      expect(createHash("sha256").update(buf).digest("hex"), file).toBe(meta.sha256);
      expect(JSON.parse(buf.toString("utf8")).length, file).toBe(meta.rows);
    }
  });
  it("Datenstand im Rechenweg = Freigabe des Abzugs", () => {
    expect(DATA_VERSION).toBe(snapshot.release.version);
    expect(DATA_VERSION).toMatch(/^WDB \d+\.\d+(\.\d+)?$/);
  });
});
