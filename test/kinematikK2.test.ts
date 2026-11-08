/**
 * Kinematik K2 Homogene Transformation (Modul kinematik, ab 0.14.0): Rahmenbaum, Fehlerfälle, Hinweise, Lernhilfe,
 * Katalog. Literatur- und Gegenrechnungswerte stehen in golden.json (verification/kinematik.py, Fälle G-K2-…).
 */
import { describe, expect, it } from "vitest";
import { kinematikK2Faelle } from "../scripts/kinematik-faelle";
import {
  computeFrames, frameSteps, chainStages, frameTemplates, orderFrames, invertT, composeT, chainT, fromPose, toPose, transformPoint, transformDirection, displace,
  checkTransform, se3, IDENTITY, rad, rotZ, moduleOfId, formulaState, traceGroupsOf, ISO_ZELLE, type FrameDef, type Transform,
} from "../src/index";

const pose0 = { x: 0, y: 0, z: 0, A: 0, B: 0, C: 0 };
const two = (b: Partial<FrameDef>, withPose = true): FrameDef[] =>
  [{ id: "a", name: "a", role: "frei", parent: null }, { id: "b", name: "b", role: "frei", parent: "a", ...(withPose ? { pose: pose0 } : {}), ...b }];

describe("Rahmenbaum und Fehler", () => {
  it("Wurzel, Kurzzeichen, Bezugsrahmen und Zyklen werden geprüft", () => {
    expect(computeFrames({ frames: [] }).errors[0]).toContain("keine Rahmen");
    expect(computeFrames({ frames: [{ id: "a", name: "a", role: "frei", parent: null }, { id: "b", name: "b", role: "frei", parent: null }] }).errors[0]).toContain("Wurzel");
    expect(computeFrames({ frames: two({ id: "a" }) }).errors[0]).toContain("doppelt");
    expect(computeFrames({ frames: two({ id: "b c" }) }).errors[0]).toContain("Buchstaben");
    expect(computeFrames({ frames: two({ parent: "x" }) }).errors[0]).toContain("gibt es nicht");
    const cyc: FrameDef[] = [{ id: "a", name: "a", role: "frei", parent: null }, { id: "b", name: "b", role: "frei", parent: "c", pose: pose0 }, { id: "c", name: "c", role: "frei", parent: "b", pose: pose0 }];
    expect(computeFrames({ frames: cyc }).errors[0]).toContain("Zyklus");
  });
  it("Reihenfolge: Bezugsrahmen vor Kind, Wege von der Wurzel", () => {
    const o = orderFrames(ISO_ZELLE);
    expect(o.root).toBe("0");
    expect(o.order.indexOf("1")).toBeLessThan(o.order.indexOf("m"));
    expect(o.order.indexOf("m")).toBeLessThan(o.order.indexOf("t"));
    expect(o.path["t"]).toEqual(["0", "1", "m", "t"]);
  });
  it("ungültige Matrix, R ohne Rotation, fehlende Lage und keine Zahl ergeben Fehler statt Ausnahme", () => {
    const m = (M: number[][]) => computeFrames({ frames: two({ matrix: M }, false) });
    expect(m([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0.1, 1]]).errors[0]).toContain("keine homogene Transformation");
    expect(m([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, -1, 0], [0, 0, 0, 1]]).errors[0]).toContain("keine homogene Transformation");
    expect(m([[1, 0, 0], [0, 1, 0], [0, 0, 1]]).errors[0]).toContain("4×4");
    expect(computeFrames({ frames: two({ rp: { R: [[2, 0, 0], [0, 1, 0], [0, 0, 1]], p: [0, 0, 0] } }, false) }).errors[0]).toContain("keine Rotationsmatrix");
    expect(computeFrames({ frames: two({}, false) }).errors[0]).toContain("Lage fehlt");
    expect(computeFrames({ frames: two({ pose: { ...pose0, x: Number.NaN } }) }).errors).toHaveLength(1);
    expect(computeFrames({ frames: two({}), rel: { of: "b", in: "x" } }).errors[0]).toContain("gibt es nicht");
    expect(computeFrames({ frames: two({}), point: { frame: "b", v: [Number.NaN, 0, 0], kind: "punkt" } }).errors[0]).toContain("keine Zahl");
  });
  it("Prüfung G-14 meldet die letzte Zeile im Rechenweg", () => {
    const c = checkTransform([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0.1, 1]]);
    expect(c.value.valid).toBe(false);
    expect(c.value.rowErr).toBeCloseTo(0.1, 15);
    expect(c.steps.map((s) => s.id)).toEqual(["G-13-Z", "G-10-O", "G-10-D", "G-14"]);
  });
});

describe("Rechenregeln (Lynch/Park Prop. 3.15 bis 3.18)", () => {
  const T1 = fromPose({ x: 0.3, y: -0.2, z: 0.5, A: 0.4, B: -0.7, C: 2.1 }).value;
  const T2 = fromPose({ x: -0.1, y: 0.9, z: 0.05, A: -2.2, B: 0.3, C: 0.6 }).value;
  it("Inverse geschlossen: T·T⁻¹ = I, (T⁻¹)⁻¹ = T, Kontrolle G-15-K im Rechenweg", () => {
    const i = invertT(T1);
    expect(se3.identityErr(se3.compose(T1, i.value))).toBeLessThan(1e-15);
    expect(se3.maxAbsDiff(invertT(i.value).value, T1)).toBeLessThan(1e-15);
    expect(i.steps.map((s) => s.id)).toEqual(["G-15-P", "G-15", "G-15-K"]);
    expect(i.steps[2]!.value).toBeLessThan(1e-15);
  });
  it("Verkettung nicht vertauschbar, Kette = Produkt, Zwischenprodukte", () => {
    expect(se3.maxAbsDiff(composeT(T1, T2).value, composeT(T2, T1).value)).toBeGreaterThan(0.1);
    const c = chainT([T1, T2, T1], ["0", "1", "2", "3"]);
    expect(se3.maxAbsDiff(c.value, se3.compose(se3.compose(T1, T2), T1))).toBeLessThan(1e-15);
    expect(c.partial).toHaveLength(4);
    expect(c.steps.map((s) => s.id)).toEqual(["G-16", "G-16", "G-16-N"]);
    expect(composeT(T1, T2).steps.map((s) => s.id)).toEqual(["G-16-R", "G-16-P", "G-16"]);
  });
  it("Punkt wird verschoben, Richtung nicht", () => {
    const T: Transform = { R: rotZ(rad(90)), p: [1, 2, 3] };
    expect(transformPoint(T, [1, 0, 0]).value).toEqual([1, 3, 3]);
    const d = transformDirection(T, [1, 0, 0]).value;
    expect(Math.abs(d[0]) + Math.abs(d[1] - 1) + Math.abs(d[2])).toBeLessThan(1e-15);
  });
  it("Pose → T → Pose rund, Kardansperre mit A = 0", () => {
    const p = { x: 0.1, y: 0.2, z: 0.3, A: 0.5, B: -0.4, C: 1.2 };
    const q = toPose(fromPose(p).value).value;
    for (const k of ["x", "y", "z", "A", "B", "C"] as const) expect(Math.abs(q[k] - p[k])).toBeLessThan(1e-15);
    const l = toPose(fromPose({ ...pose0, A: rad(30), B: rad(90), C: rad(20) }).value);
    expect(l.value.A).toBe(0);
    expect(l.notes.join(" ")).toContain("Kardansperre");
  });
  it("fest und mitgedreht unterscheiden sich, Operator = Trans(p)·Rot(ω̂, θ)", () => {
    const op = { axis: [0, 0, 1] as const, theta: rad(90), p: [0, 0.2, 0] as const };
    const f = displace(T1, op, "fest"), m = displace(T1, op, "mitgedreht");
    expect(se3.maxAbsDiff(f.value, se3.compose(f.op, T1))).toBe(0);
    expect(se3.maxAbsDiff(m.value, se3.compose(T1, m.op))).toBe(0);
    expect(se3.maxAbsDiff(f.value, m.value)).toBeGreaterThan(0.1);
    expect(f.steps.at(-1)!.id).toBe("G-19-F");
    expect(m.steps.at(-1)!.id).toBe("G-19-M");
  });
});

describe("ISO-Kette, Hinweise, Lernhilfe", () => {
  const iso = frameTemplates().find((t) => t.id === "iso")!;
  it("ISO-Zelle: G-20-K, G-20-A, G-20-F; Rückeinsetzen des Flansch-Solls ergibt den TCP-Soll", () => {
    const r = computeFrames(iso.input);
    expect(r.errors).toEqual([]);
    expect(se3.maxAbsDiff(r.iso!.T0t, r.abs["t"]!)).toBeLessThan(1e-15);
    const Tsoll = fromPose(iso.input.tcpTarget!).value;
    const back = se3.compose(se3.compose(r.local["1"]!, r.iso!.T1mTarget!), r.local["t"]!);
    expect(se3.maxAbsDiff(back, Tsoll)).toBeLessThan(1e-14);
    expect(se3.maxAbsDiff(r.rel!, r.iso!.Tkt!)).toBeLessThan(1e-15);   // rel = Werkzeug in Aufgabe
    const ids = new Set(frameSteps(r).map((s) => s.id));
    for (const id of ["G-13-P", "G-16-N", "G-20-K", "G-20-A", "G-20-F", "G-20-R", "G-13-X", "G-17"]) expect(ids.has(id), id).toBe(true);
  });
  it("ISO-Rollen ohne passende Bezugsrahmen: Warnung, keine G-20-Schritte", () => {
    const f = ISO_ZELLE.map((x) => (x.id === "t" ? { ...x, parent: "1" } : x));
    const r = computeFrames({ frames: f });
    expect(r.iso).toBeNull();
    expect(r.warnings.join(" ")).toContain("ISO-Kette");
  });
  it("Warnung nahe der Kardansperre in der relativen Pose", () => {
    const r = computeFrames({ frames: two({ pose: { ...pose0, B: rad(87) } }), rel: { of: "b", in: "a" } });
    expect(r.warnings[0]).toContain("Kardansperre nah");
    expect(computeFrames({ frames: two({ pose: { ...pose0, B: rad(80) } }), rel: { of: "b", in: "a" } }).warnings).toEqual([]);
  });
  it("Punkt in allen Rahmen, Rücktransformation stimmt", () => {
    const r = computeFrames(iso.input);
    for (const id of r.order) expect(Math.max(...se3.point(r.abs[id]!, r.points![id]!).map((x, i) => Math.abs(x - r.points!["0"]![i]!)))).toBeLessThan(1e-14);
  });
  it("Schritt für Schritt: Kette wächst Glied für Glied bis T_0t", () => {
    const r = computeFrames(iso.input);
    const st = chainStages(r, "t");
    expect(st.map((s) => s.to)).toEqual(["1", "m", "t"]);
    expect(se3.maxAbsDiff(st[0]!.before, IDENTITY)).toBe(0);
    expect(se3.maxAbsDiff(st.at(-1)!.after, r.abs["t"]!)).toBeLessThan(1e-15);
    expect(st[1]!.label).toContain("T_01·T_1m = T_0m");
    expect(chainStages(r, "0")).toEqual([]);
  });
  it("deterministisch: gleiche Eingabe, gleiche Ausgabe bis aufs Bit", () => {
    expect(JSON.stringify(computeFrames(iso.input))).toBe(JSON.stringify(computeFrames(iso.input)));
  });
});

describe("Katalog und Rechenweg", () => {
  it("alle 22 Formeln G-13 bis G-20 kommen in den Beispielfällen vor, jede im Modul kinematik mit Status", () => {
    const ids = new Set(kinematikK2Faelle().flatMap((f) => frameSteps(computeFrames(f.inp)).map((s) => s.id)));
    const k2 = [...ids].filter((id) => /^G-(1[3-9]|20)(-|$)/.test(id)).sort();
    expect(k2).toEqual(["G-13", "G-13-P", "G-13-X", "G-13-Z", "G-14", "G-15", "G-15-K", "G-15-P", "G-16", "G-16-N", "G-16-P", "G-16-R", "G-17", "G-18",
      "G-19-F", "G-19-M", "G-19-R", "G-19-T", "G-20-A", "G-20-F", "G-20-K", "G-20-R"]);
    for (const id of ids) { expect(moduleOfId(id), id).toBe("kinematik"); expect(formulaState(id), id).not.toBe("unbekannt"); }
  });
  it("Rechenweg nur in Gruppen des Moduls, Matrizen endlich, 4×4 mit letzter Zeile (0, 0, 0, 1)", () => {
    for (const f of kinematikK2Faelle()) {
      const r = computeFrames(f.inp);
      expect(r.errors, f.id).toEqual([]);
      for (const g of Object.keys(r.trace)) expect(traceGroupsOf("kinematik")).toContain(g);
      for (const s of frameSteps(r)) {
        if (!s.matrix) continue;
        expect(s.matrix.flat().every(Number.isFinite), s.id).toBe(true);
        if (s.matrix.length === 4) expect(s.matrix[3], s.id).toEqual([0, 0, 0, 1]);
      }
    }
  });
});
