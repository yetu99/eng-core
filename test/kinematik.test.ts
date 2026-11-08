/**
 * Kinematik K1 Orientierung (Modul kinematik, ab 0.12.0): Fehlerfälle, Hinweise, Lernhilfe, Katalog, Prüfstatus,
 * Werkzeug Greifwerk. Literatur- und Gegenrechnungswerte stehen in golden.json (verification/kinematik.py).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { kinematikFaelle } from "../scripts/kinematik-faelle";
import {
  computeOrientation, orientationSteps, orientationStages, stageMatrix, rotateBy, fromZYX, toZYX, toZYZ, toAxisAngle, toQuaternion, rad, deg, rotZ, rotX, maxAbsDiff, so3,
  moduleOfId, formulaState, PRUEFSTATUS, reportMeta, reportFooter, reportVerdict, traceApproval, TOOLS, traceGroupsOf, CORE_VERSION,
} from "../src/index";

const root = new URL("..", import.meta.url).pathname;

describe("Eingaben und Fehler", () => {
  it("Nullachse, Nullquaternion, keine Zahl und fehlende Eingabe ergeben Fehler statt Ausnahme", () => {
    expect(computeOrientation({ rep: "axis", axis: { axis: [0, 0, 0], theta: 1 } }).errors[0]).toContain("Nullvektor");
    expect(computeOrientation({ rep: "quat", quat: { w: 0, x: 0, y: 0, z: 0 } }).errors[0]).toContain("null");
    expect(computeOrientation({ rep: "zyx", zyx: { A: Number.NaN, B: 0, C: 0 } }).errors).toHaveLength(1);
    expect(computeOrientation({ rep: "zyz" }).errors[0]).toContain("fehlen");
    expect(computeOrientation({ rep: "matrix", matrix: [[1, 0, 0], [0, 1, 0], [0, 0, Number.POSITIVE_INFINITY]] }).errors).toHaveLength(1);
  });
  it("Spiegelung ist keine Rotationsmatrix: Prüfung im Rechenweg, keine Umrechnung", () => {
    const r = computeOrientation({ rep: "matrix", matrix: [[1, 0, 0], [0, 1, 0], [0, 0, -1]] });
    expect(r.check?.valid).toBe(false);
    expect(r.zyx).toBeNull();
    expect(r.trace.pruefung?.map((s) => s.id)).toEqual(["G-10-O", "G-10-D"]);
    expect(r.trace.umrechnung).toBeUndefined();
  });
  it("nicht normierte Achse und Quaternion werden normiert, mit Hinweis", () => {
    expect(computeOrientation({ rep: "axis", axis: { axis: [0, 0, 2], theta: 1 } }).notes.join(" ")).toContain("normiert");
    expect(computeOrientation({ rep: "quat", quat: { w: 2, x: 0, y: 0, z: 0 } }).notes.join(" ")).toContain("normiert");
    expect(computeOrientation({ rep: "axis", axis: { axis: [0, 0, 1], theta: 1 } }).notes.join(" ")).not.toContain("normiert");
  });
  it("Vektor mit keiner Zahl ergibt Fehler, Orientierung bleibt", () => {
    const r = computeOrientation({ rep: "zyx", zyx: { A: 0, B: 0, C: 0 }, pb: [Number.NaN, 0, 0] });
    expect(r.errors).toHaveLength(1);
    expect(r.R).not.toBeNull();
  });
});

describe("Sonderfälle, Wertebereiche, Hinweise", () => {
  it("Kardansperre: Hinweis, A = 0, Rundlauf exakt", () => {
    for (const B of [90, -90]) {
      const r = computeOrientation({ rep: "zyx", zyx: { A: rad(30), B: rad(B), C: rad(20) } });
      expect(r.zyx!.A).toBe(0);
      expect(r.zyx!.B).toBe((Math.sign(B) * Math.PI) / 2);
      expect(r.notes.join(" ")).toContain("Kardansperre");
      expect(maxAbsDiff(fromZYX(r.zyx!).value, r.R!)).toBeLessThan(1e-12);
    }
  });
  it("Warnung nahe der Kardansperre erst unter 5° Abstand", () => {
    expect(computeOrientation({ rep: "zyx", zyx: { A: 0, B: rad(86), C: 0 } }).warnings[0]).toContain("Kardansperre nah");
    expect(computeOrientation({ rep: "zyx", zyx: { A: 0, B: rad(84), C: 0 } }).warnings).toEqual([]);
    expect(computeOrientation({ rep: "zyz", zyz: { phi: 0, theta: rad(178), psi: 0 } }).warnings.join(" ")).toContain("Sonderfall");
  });
  it("Winkel liegen in (−180°, 180°], θ in [0°, 180°], Quaternion w ≥ 0", () => {
    // R_z(180°) erzeugt −0 in r_21: atan2(−0, −1) wäre −π
    const R = rotZ(Math.PI);
    expect(toZYX(R).value.A).toBe(Math.PI);
    const s = so3;
    for (let k = 0; k < 200; k++) {
      const a = (k * 0.731) % (2 * Math.PI) - Math.PI, b = ((k * 0.377) % Math.PI) - Math.PI / 2, c = (k * 1.913) % (2 * Math.PI) - Math.PI;
      const M = s.mul(s.mul(rotZ(a), s.rotY(b)), rotX(c));
      const e = toZYX(M).value, z = toZYZ(M).value, x = toAxisAngle(M).value, q = toQuaternion(M).value;
      for (const v of [e.A, e.C, z.phi, z.psi]) { expect(v).toBeGreaterThan(-Math.PI); expect(v).toBeLessThanOrEqual(Math.PI); }
      expect(Math.abs(e.B)).toBeLessThanOrEqual(Math.PI / 2);
      expect(z.theta).toBeGreaterThanOrEqual(0); expect(z.theta).toBeLessThanOrEqual(Math.PI);
      expect(x.theta).toBeGreaterThanOrEqual(0); expect(x.theta).toBeLessThanOrEqual(Math.PI);
      expect(q.w).toBeGreaterThanOrEqual(0);
    }
  });
  it("feste und mitgedrehte Achse unterscheiden sich (Lynch/Park Abb. 3.9)", () => {
    const R = fromZYX({ A: rad(90), B: 0, C: rad(90) }).value;
    const f = rotateBy(R, "fest", "z", rad(90)).value, m = rotateBy(R, "mitgedreht", "z", rad(90)).value;
    expect(maxAbsDiff(f, m)).toBeGreaterThan(0.5);
    expect(maxAbsDiff(f, so3.mul(rotZ(rad(90)), R))).toBe(0);
    expect(maxAbsDiff(m, so3.mul(R, rotZ(rad(90))))).toBe(0);
  });
  it("deterministisch: gleiche Eingabe, gleiche Ausgabe bis aufs Bit", () => {
    const inp = { rep: "zyx" as const, zyx: { A: 0.3, B: -0.7, C: 2.1 }, pb: [0.1, 0.2, 0.3] as const, extra: { frame: "fest" as const, axis: "y" as const, angle: 0.4 } };
    expect(JSON.stringify(computeOrientation(inp))).toBe(JSON.stringify(computeOrientation(inp)));
  });
});

describe("Lernhilfe Schritt für Schritt", () => {
  it("Z-Y-X: drei Teildrehungen um mitgedrehte Achsen, Zwischenstände und Ende", () => {
    const inp = { rep: "zyx" as const, zyx: { A: rad(30), B: rad(45), C: rad(60) } };
    const st = orientationStages(inp);
    expect(st.map((s) => s.axisName)).toEqual(["z", "y", "x"]);
    expect(st[1]!.label).toContain("y′");
    expect(st[2]!.label).toContain("x″");
    expect(maxAbsDiff(stageMatrix(st, 0), so3.I3)).toBe(0);
    expect(maxAbsDiff(stageMatrix(st, 1), rotZ(rad(30)))).toBeLessThan(1e-15);
    expect(maxAbsDiff(stageMatrix(st, 3), computeOrientation(inp).R!)).toBeLessThan(1e-15);
    expect(maxAbsDiff(stageMatrix(st, 0.5), rotZ(rad(15)))).toBeLessThan(1e-15);
  });
  it("Achse-Winkel: eine Drehung um ω̂, halber Weg = halber Winkel", () => {
    const inp = { rep: "axis" as const, axis: { axis: [1, 1, 0] as const, theta: rad(120) } };
    const st = orientationStages(inp);
    expect(st).toHaveLength(1);
    const w = computeOrientation(inp).axis!.axis;
    expect(maxAbsDiff(stageMatrix(st, 1, w), computeOrientation(inp).R!)).toBeLessThan(1e-15);
    expect(deg(toAxisAngle(stageMatrix(st, 0.5, w)).value.theta)).toBeCloseTo(60, 12);
  });
});

describe("Katalog, Prüfstatus und Werkzeug Greifwerk", () => {
  it("jeder Rechenschritt der Beispielfälle K1 hat eine Katalog-ID im Modul kinematik, alle 35 Formeln K1 kommen vor (mit K2 ab 0.14.0: 57)", () => {
    const ids = new Set(kinematikFaelle().flatMap((f) => orientationSteps(computeOrientation(f.inp)).map((s) => s.id)));
    ids.add("G-11-V");
    for (const id of ids) {
      expect(moduleOfId(id), id).toBe("kinematik");
      expect(formulaState(id), id).not.toBe("unbekannt");
    }
    expect(ids.size).toBe(35);
    expect(PRUEFSTATUS.modules.kinematik.formulas).toBe(57);
  });
  it("Rechenweg nach den Gruppen des Moduls", () => {
    const r = computeOrientation({ rep: "zyx", zyx: { A: 0.1, B: 0.2, C: 0.3 } });
    expect(Object.keys(r.trace).sort()).toEqual(["orientierung", "pruefung", "umrechnung"]);
    for (const g of Object.keys(r.trace)) expect(traceGroupsOf("kinematik")).toContain(g);
    for (const s of orientationSteps(r)) if (s.matrix) expect(s.matrix.flat().every(Number.isFinite)).toBe(true);
  });
  it("reportMeta Greifwerk: nur Modul kinematik, ohne Werkstoff- und Fachdaten; Werkbank unverändert", () => {
    const g = reportMeta("Greifwerk");
    expect(g.modules).toEqual(["kinematik"]);
    expect(g.wdb).toBe(false);
    expect(g.fd).toBeNull();
    expect(g.formulas).toBe(PRUEFSTATUS.modules.kinematik.formulas);
    const f = reportFooter(g, traceApproval([]));
    expect(f).not.toContain("Werkstoffdaten");
    expect(f.startsWith("Greifwerk · eng-core")).toBe(true);
    expect(reportVerdict(g, traceApproval([])).lines.join(" ")).not.toContain("Werkstoffdaten");
    expect(reportMeta().wdb).toBe(true);
    expect(reportFooter(reportMeta(), traceApproval([]))).toContain("Werkstoffdaten");
    expect(TOOLS.greifwerk.modules).toEqual(["kinematik"]);
  });
  it("sync-to-app --tool greifwerk --core-dir engcore: nur Basis und kinematics, eigene src/core der App bleibt unberührt", () => {
    const d = mkdtempSync(join(tmpdir(), "gw-"));
    writeFileSync(join(d, "package.json"), "{}");
    mkdirSync(join(d, "src/core"), { recursive: true });
    writeFileSync(join(d, "src/core/index.ts"), "export const CORE_VERSION = \"app\";\n");
    const run = (...a: string[]) => execFileSync("node", ["scripts/sync-to-app.mjs", d, "--tool", "greifwerk", ...a], { cwd: root, encoding: "utf8", stdio: "pipe" });
    expect(() => run()).toThrow();   // src/core gehört der App (kein MANIFEST.json)
    run("--core-dir", "engcore");
    expect(readFileSync(join(d, "src/core/index.ts"), "utf8")).toContain("\"app\"");
    const m = JSON.parse(readFileSync(join(d, "src/engcore/MANIFEST.json"), "utf8")) as { version: string; modules: string[]; files: Record<string, string> };
    const files = Object.keys(m.files);
    expect(m.modules).toEqual(["kinematik"]);
    expect(m.version).toBe(CORE_VERSION);
    for (const f of ["engcore/kinematics/so3.ts", "engcore/kinematics/orientation.ts", "engcore/kinematics/compute.ts", "engcore/kinematics/se3.ts", "engcore/kinematics/frames.ts", "engcore/kinematics/templates.ts", "engcore/report.ts"]) expect(files).toContain(f);
    expect(files.some((f) => /^engcore\/(mechanics|fluid|ashby)\//.test(f))).toBe(false);
    const idx = readFileSync(join(d, "src/engcore/index.ts"), "utf8");
    expect(idx).toContain("./kinematics/compute");
    expect(idx).not.toContain("./mechanics/");
    run("--core-dir", "engcore");   // zweiter Lauf: MANIFEST vorhanden, gleiche Dateien
    expect(JSON.parse(readFileSync(join(d, "src/engcore/MANIFEST.json"), "utf8")).files).toEqual(m.files);
  });
});
