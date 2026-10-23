import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DATA_VERSION, repo } from "../src/data";
import { points, buildIndex, type MatClass } from "../src/index";

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

describe("Werttyp Marktpreis (WDB 1.0.2, Entscheidung E6)", () => {
  const pv = JSON.parse(readFileSync(new URL("propertyValues.json", dir), "utf8")) as Array<{ id: string; variant_id: string; property_id: string; value_type: string | null; sort_key: number; value: number | null }>;
  const market = pv.filter((r) => r.value_type === "Marktpreis");
  it("Marktpreis ist nie die repräsentative Zeile (erste nach sort_key je Variante und Eigenschaft)", () => {
    for (const r of market) {
      const first = pv.filter((x) => x.variant_id === r.variant_id && x.property_id === r.property_id).sort((a, b) => a.sort_key - b.sort_key)[0]!;
      expect(first.value_type, r.id).not.toBe("Marktpreis");
    }
  });
  it("Preis im Kern (Ashby, Preisfilter, Zielkonflikte) = repräsentative Schätzung, nicht der Marktpreis", () => {
    for (const r of market) {
      const m = repo.materials.find((x) => x.defaultVariantId === r.variant_id);
      if (!m) continue;
      const rep = repo.row(m.id, "P-PREIS")!;
      expect(rep.value_type, m.id).not.toBe("Marktpreis");
      expect(rep.id, m.id).not.toBe(r.id);
    }
  });
  it("Preisfilter priceMax wertet die repräsentative Zeile (Schwelle zwischen Schätzung und Marktpreis)", () => {
    const all: Record<MatClass, boolean> = { Metall: true, Polymer: true, Keramik: true, Verbundwerkstoff: true, Naturwerkstoff: true };
    const st = (priceMax: number | null) => ({ index: buildIndex("Zugstab", "Steifigkeit", "Kosten")!, classes: all, limits: { Emin: null, rhoMax: null, sfMin: null, priceMax }, shapeMode: "none", phiUser: null }) as never;
    let checked = 0;
    for (const r of market) {
      const m = repo.materials.find((x) => x.defaultVariantId === r.variant_id);
      if (!m || m.price === null || r.value === null || Math.abs(r.value - m.price) < 1e-9) continue;
      const lim = (r.value + m.price) / 2;
      const p = points(repo, st(lim), false).find((q) => q.m.id === m.id);
      if (!p) continue;
      expect(p.pass, `${m.id} Schätzung ${m.price}, Marktpreis ${r.value}, Grenze ${lim}`).toBe(m.price <= lim);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });
});
