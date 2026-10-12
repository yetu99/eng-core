import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CORE_VERSION, computeStrength, designSize, PRUEFSTATUS, catalogId, formulaState, traceApproval, reportMeta, reportFooter, reportVerdict, materialDetail, valueText, ATLAS_PATH, buildIndex, ranking, pointTrace, indexTrace, MAT_CLASSES, type StrengthInput, type CalcStep, type MatClass } from "../src/index";
import { repo, detailData, DATA_VERSION } from "../src/data";

const base: StrengthInput = { mode: "single", kind: "biegung", sub: "EQ", materialId: "W038", secType: "rund_hohl", dims: { D: 60, t: 4 }, L: 1200, F: 2, q: 2, a: 300, N: 0, T: 200, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null } };
const allSteps = (r: ReturnType<typeof computeStrength>): CalcStep[] => Object.values(r.trace).flatMap((a) => a ?? []);

describe("Prüfstatus und Berichtsangaben", () => {
  it("Version: package.json = CORE_VERSION = pruefstatus.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.version).toBe(CORE_VERSION);
    expect(PRUEFSTATUS.core).toBe(CORE_VERSION);
    expect(reportMeta().consistent).toBe(true);
  });
  it("Zähler im Prüfstatus passen zur Statusliste", () => {
    const vals = Object.values(PRUEFSTATUS.status);
    expect(vals.length).toBe(PRUEFSTATUS.formulas);
    expect(vals.filter((v) => v === "freigegeben").length).toBe(PRUEFSTATUS.approved);
    expect(PRUEFSTATUS.approved + PRUEFSTATUS.rejected + PRUEFSTATUS.stale + PRUEFSTATUS.draft).toBe(PRUEFSTATUS.formulas);
  });
  it("Bemessungsschritte werden auf die Katalog-ID abgebildet", () => {
    expect(catalogId("D-ERF-D")).toBe("D-ERF");
    expect(catalogId("D-GEW-t")).toBe("D-GEW");
    expect(catalogId("B-M-EQ")).toBe("B-M-EQ");
    expect(formulaState("gibt-es-nicht")).toBe("unbekannt");
  });
  it("jeder Rechenschritt aller Belastungsarten, der Bemessung und von Blatt 2 hat einen Katalogeintrag", () => {
    const runs: Partial<StrengthInput>[] = [{ kind: "zug", sub: "Z1" }, { kind: "zug", sub: "Z2" }, { kind: "druck", sub: "K2", F: 20 }, { kind: "biegung", sub: "E4" }, { kind: "torsion", sub: "T2" }, { mode: "combined", sub: "EQ", N: -10, T: 150 }];
    const steps = runs.flatMap((r) => allSteps(computeStrength(repo, { ...base, ...r })));
    steps.push(...designSize(repo, { ...base, q: 4 }, "formtreu").trace);
    const ix = buildIndex("Balken", "Steifigkeit", "Masse")!;
    const classes = Object.fromEntries(MAT_CLASSES.map((c) => [c, true])) as Record<MatClass, boolean>;
    const st = { index: ix, classes, limits: { Emin: null, rhoMax: null, sfMin: null, priceMax: null }, shapeMode: "max" as const, phiUser: null };
    steps.push(...indexTrace(ix), ...pointTrace(ix, st, ranking(repo, st, true)[0]!, true));
    const unknown = [...new Set(steps.map((s) => s.id))].filter((id) => formulaState(id) === "unbekannt");
    expect(unknown).toEqual([]);
  });
  it("traceApproval zählt jede Formel einmal (Standardfall Blatt 1)", () => {
    const steps = allSteps(computeStrength(repo, base));
    const u = traceApproval([...steps, ...steps]);
    expect(u.used).toBe(new Set(steps.map((s) => s.id)).size);
    expect(u.approved + u.open.length).toBe(u.used);
  });
  it("Fußzeile und Prüfvermerk nennen Versionen und Prüfstufen", () => {
    const meta = reportMeta();
    const u = traceApproval(allSteps(computeStrength(repo, base)));
    const f = reportFooter(meta, u);
    expect(f).toContain(`eng-core ${CORE_VERSION}`);
    expect(f).toContain(`Werkstoffdaten ${DATA_VERSION}`);
    expect(f).toContain(`Formeln im Blatt ${u.approved}/${u.used} freigegeben`);
    const v = reportVerdict(meta, u);
    expect(v.lines.some((l) => l.startsWith("Abnahme (P6)"))).toBe(true);
    // solange P6 offen ist, darf der Vermerk nie "abgenommen" lauten
    if (meta.acceptance.P6.status !== "bestanden") expect(v.level).not.toBe("ok");
    expect(reportVerdict(meta, { used: 3, approved: 2, open: ["X-1"] }).level).toBe("fail");
  });
});

describe("Werkstoff-Detailansicht (materialDetail)", () => {
  it("EN AW-6082: Standardvariante, Gruppen, R_p mit Quelle und Fundstelle", () => {
    const d = materialDetail(detailData, "W038")!;
    expect(d.name).toBe("EN AW-6082");
    expect(d.variants.filter((v) => v.isDefault).length).toBe(1);
    expect(d.variantId).toBe(repo.byId("W038")!.defaultVariantId);
    expect(d.atlasPath).toBe("/werkstoff/W038");
    const rp = d.groups.flatMap((g) => g.values).find((v) => v.propertyId === "P-RE")!;
    expect(rp.text).toBe("≥ 260");
    expect(rp.source).not.toBe("–");
    expect(d.groups[0]!.name).toBe("Mechanisch");
  });
  it("erste Kennwertzeile je Eigenschaft = Zeile, mit der die Werkbank rechnet", () => {
    for (const m of repo.materials) {
      const d = materialDetail(detailData, m.id)!;
      for (const pid of ["P-E", "P-RHO", "P-RE", "P-RM"]) {
        const first = d.groups.flatMap((g) => g.values).find((v) => v.propertyId === pid);
        expect(first?.rowId ?? null, `${m.id} ${pid}`).toBe(repo.row(m.id, pid)?.id ?? null);
      }
    }
  });
  it("Verarbeitbarkeit in Verfahrensreihenfolge, unbekannte ID und fremde Variante liefern null", () => {
    const d = materialDetail(detailData, "W001")!;
    const own = detailData.processability.filter((x) => x.material_id === "W001");
    expect(d.processes.length).toBe(own.length);
    const order = new Map(detailData.processes.map((p) => [p.name, p.sort_order]));
    const ranks = d.processes.map((p) => order.get(p.process) ?? 999);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(materialDetail(detailData, "W999")).toBeNull();
    expect(materialDetail(detailData, "W001", "W038-1")).toBeNull();
    expect(ATLAS_PATH("W001")).toBe("/werkstoff/W001");
  });
  it("valueText: Bereich, Mindestwert, Höchstwert, Näherung, Text", () => {
    const r = { id: "x", variant_id: "v", property_id: "p", value: null, value_min: null, value_max: null, value_text: null, operator: "=", condition: null, value_type: null, status: null, source_id: null, source_locator: null, confidence: null, remark: null, sort_key: 0 };
    expect(valueText({ ...r, operator: "Bereich", value_min: 360, value_max: 510 })).toBe("360 … 510");
    expect(valueText({ ...r, operator: "≥", value_min: 235 })).toBe("≥ 235");
    expect(valueText({ ...r, operator: "≤", value_max: 280 })).toBe("≤ 280");
    expect(valueText({ ...r, operator: "≈", value: 2.7 })).toBe("≈ 2,7");
    expect(valueText({ ...r, value_text: "gelistet" })).toBe("gelistet");
  });
});
