/**
 * Kinematik K3 DH-Parameter und Vorwärtskinematik (Modul kinematik, ab 0.16.0): Prüfung der Kette, Fehlerfälle,
 * Gelenkgrenzen, Konventionen, Umrechnung, Kontrollformeln, Zeichnung, Lernhilfe, Katalog.
 * Literatur- und Gegenrechnungswerte stehen in golden.json (verification/kinematik.py, Fälle G-K3-…).
 */
import { describe, expect, it } from "vitest";
import { kinematikK3Faelle } from "../scripts/kinematik-faelle";
import {
  computeForward, forwardSteps, forwardRaw, convertDh, dhStages, linkRaw, linkFactors, dhRot, robotTemplates, jointText, se3, rad, rotX, rotZ, moduleOfId, formulaState,
  traceGroupsOf, MAX_JOINTS, UR5, type DhJoint, type Robot,
} from "../src/index";

const R = (theta: number, d: number, a: number, alpha: number, lim = Math.PI): DhJoint => ({ type: "R", theta, d, a, alpha, qMin: -lim, qMax: lim });
const P = (theta: number, d: number, a: number, alpha: number, qMin = -1, qMax = 1): DhJoint => ({ type: "P", theta, d, a, alpha, qMin, qMax });
const rob = (joints: DhJoint[], convention: Robot["convention"] = "klassisch", extra: Partial<Robot> = {}): Robot => ({ id: "x", name: "x", convention, joints, source: "Test", ...extra });
const tpl = Object.fromEntries(robotTemplates().map((t) => [t.robot.id, t.robot]));

describe("Prüfung der Gelenkkette (G-26) und Fehler", () => {
  it("Anzahl, Typ, Konvention, Zahlen, Grenzen und Länge von q ergeben Fehler statt Ausnahme", () => {
    const one = rob([R(0, 0, 0.1, 0)]);
    expect(computeForward({ robot: rob([]), q: [] }).errors[0]).toContain("1 bis 8");
    expect(computeForward({ robot: rob(Array(MAX_JOINTS + 1).fill(R(0, 0, 0.1, 0))), q: Array(9).fill(0) }).errors[0]).toContain("1 bis 8");
    expect(computeForward({ robot: rob([{ ...R(0, 0, 0.1, 0), type: "X" as "R" }]), q: [0] }).errors[0]).toContain("unbekannt");
    expect(computeForward({ robot: rob([R(0, 0, Number.NaN, 0)]), q: [0] }).errors[0]).toContain("keine Zahl");
    expect(computeForward({ robot: rob([{ ...R(0, 0, 0.1, 0), qMin: 1, qMax: 1 }]), q: [0] }).errors[0]).toContain("kleiner");
    expect(computeForward({ robot: { ...one, convention: "craig" as "klassisch" }, q: [0] }).errors[0]).toContain("Konvention");
    expect(computeForward({ robot: one, q: [0, 0] }).errors[0]).toContain("2 Werte für 1 Gelenke");
    expect(computeForward({ robot: one, q: [Number.NaN] }).errors[0]).toContain("keine Zahl");
    expect(computeForward({ robot: { ...one, tool: { x: 0, y: 0, z: Number.NaN, A: 0, B: 0, C: 0 } }, q: [0] }).errors[0]).toContain("Werkzeug");
    expect(computeForward({ robot: one, q: [0], point: { frame: 5, v: [0, 0, 0] } }).errors[0]).toContain("Punkt");
  });
  it("Rechenweg beginnt mit G-26, dann Gelenkwerte, Grenzen, Gliedmatrizen", () => {
    const r = computeForward({ robot: tpl["scara"]!, q: [...tpl["scara"]!.qSource!] });
    expect(r.trace.gelenke!.map((s) => s.id)).toEqual(["G-26", "G-23-R", "G-23-R", "G-23-P", "G-23-R", "G-23-G", "G-21-R", "G-21", "G-21-R", "G-21", "G-21-R", "G-21", "G-21-R", "G-21"]);
  });
});

describe("Gelenkwerte und Grenzen (G-23)", () => {
  it("Dreh: θ = q + θ_0, Schub: d = q + d_0", () => {
    const r = computeForward({ robot: rob([R(0.2, 0.3, 0.1, 0), P(0.4, 0.05, 0, 0)]), q: [0.5, 0.25] });
    expect(r.values[0]).toEqual({ theta: 0.7, d: 0.3 });
    expect(r.values[1]).toEqual({ theta: 0.4, d: 0.3 });
  });
  it("Grenze verletzt: Warnung mit Gelenknummer, Ergebnis bleibt; auf der Grenze keine Warnung", () => {
    const s = tpl["scara"]!;
    const a = computeForward({ robot: s, q: [rad(151), 0, 0.25, 0] });
    expect(a.errors).toEqual([]);
    expect(a.limitsViolated).toEqual([1, 3]);
    expect(a.warnings[0]).toContain("Gelenk 1, 3");
    expect(a.TWt).not.toBeNull();
    expect(computeForward({ robot: s, q: [rad(150), rad(-150), 0.2, 0] }).warnings).toEqual([]);
  });
  it("Winkel im Rechenweg in Grad mit rad, Längen in mm (Vormerkung ERR-04)", () => {
    const r = computeForward({ robot: tpl["r612"]!, q: [...tpl["r612"]!.qSource!] });
    const g = r.trace.gelenke!.find((s) => s.id === "G-21")!;
    expect(g.subst).toContain("α_1 = -90° (-1,5708 rad)");
    expect(g.subst).toContain("a_1 = 300 mm");
    expect(r.trace.gelenke!.find((s) => s.id === "G-23-R")!.subst).toContain("° (");
  });
});

describe("Gliedmatrizen (G-21, G-22)", () => {
  it("geschlossene Form gleich dem Produkt der vier Faktoren in beiden Konventionen", () => {
    for (const conv of ["klassisch", "modifiziert"] as const) {
      for (const [th, d, a, al] of [[0.3, 0.2, -0.4, 1.1], [-2.5, -0.1, 0.7, -0.6], [0, 0, 0, rad(90)]] as const) {
        const f = linkFactors(conv, th, d, a, al, 2).map((x) => x.T).reduce((A, B) => se3.compose(A, B));
        expect(se3.maxAbsDiff(f, linkRaw(conv, th, d, a, al)), conv).toBeLessThan(1e-15);
      }
    }
    expect(se3.maxAbsDiff({ R: dhRot("klassisch", 0.3, 1.1), p: [0, 0, 0] }, { R: linkRaw("klassisch", 0.3, 0, 0, 1.1).R, p: [0, 0, 0] })).toBeLessThan(1e-16);
    expect(linkFactors("klassisch", 0, 0, 0, 0, 1).map((x) => x.kind)).toEqual(["rotz", "transz", "transx", "rotx"]);
    expect(linkFactors("modifiziert", 0, 0, 0, 0, 1).map((x) => x.kind)).toEqual(["rotx", "transx", "transz", "rotz"]);
  });
  it("Paare vertauschbar: Rot_z mit Trans_z, Trans_x mit Rot_x (Lynch/Park S. 511)", () => {
    const Tz = { R: rotZ(0), p: [0, 0, 0.3] as const }, Rz = { R: rotZ(0.7), p: [0, 0, 0] as const };
    const Tx = { R: rotZ(0), p: [0.4, 0, 0] as const }, Rx = { R: rotX(-1.2), p: [0, 0, 0] as const };
    expect(se3.maxAbsDiff(se3.compose(Rz, Tz), se3.compose(Tz, Rz))).toBe(0);
    expect(se3.maxAbsDiff(se3.compose(Tx, Rx), se3.compose(Rx, Tx))).toBe(0);
  });
});

describe("Vorwärtskinematik (G-24, G-24-W), Pose, Punkt", () => {
  it("Zwischenrahmen T_0k, T_0n = letzte Stufe, T_Wt = T_W0·T_0n·T_nt", () => {
    const u = tpl["ur5"]!;
    const r = computeForward({ robot: u, q: [...u.qSource!] });
    expect(r.frames).toHaveLength(7);
    expect(se3.maxAbsDiff(r.frames[6]!, r.T0n!)).toBe(0);
    expect(se3.maxAbsDiff(se3.compose(se3.compose(r.base, r.T0n!), r.tool), r.TWt!)).toBe(0);
    expect(forwardSteps(r).some((s) => s.id === "G-24-W")).toBe(true);
    expect(r.TWt!.p.map((x) => Math.round(x * 1e6) / 1e6)).toEqual([0.095, 0.109, 0.988]);
  });
  it("ohne Basis und Werkzeug kein G-24-W, T_Wt = T_0n", () => {
    const r = computeForward({ robot: tpl["r612"]!, q: [0, rad(-90)] });
    expect(forwardSteps(r).some((s) => s.id === "G-24-W")).toBe(false);
    expect(r.TWt).toBe(r.T0n);
  });
  it("UR5 klassisch und modifiziert liefern dieselbe Lage, Zwischenrahmen verschieden", () => {
    const q = [0.3, -1.1, 0.8, 0.2, -0.5, 2.0];
    const a = computeForward({ robot: tpl["ur5"]!, q }), b = computeForward({ robot: tpl["ur5-kl"]!, q });
    expect(se3.maxAbsDiff(a.TWt!, b.TWt!)).toBeLessThan(1e-15);
    expect(se3.maxAbsDiff(a.world!.frames[2]!, b.world!.frames[2]!)).toBeGreaterThan(0.01);
    expect(UR5.L1).toBe(0.425);
  });
  it("Portal: p = q, R = I", () => {
    const r = computeForward({ robot: tpl["kartesisch"]!, q: [0.4, 0.3, 0.2] });
    expect(Math.max(...r.TWt!.p.map((x, i) => Math.abs(x - [0.4, 0.3, 0.2][i]!)))).toBeLessThan(1e-15);
    expect(se3.identityErr({ R: r.TWt!.R, p: [0, 0, 0] })).toBeLessThan(1e-15);
  });
  it("Punkt im Gliedrahmen und im Werkzeug (G-17)", () => {
    const r = computeForward({ robot: tpl["rrt"]!, q: [Math.PI / 2, 0, 0.5], point: { frame: 3, v: [-0.5, 0.25, -0.4] } });
    expect(r.point!.map((x) => Math.round(x * 1e12) / 1e12)).toEqual([0.25, -0.5, -1.1]);
    const t = computeForward({ robot: tpl["ur5"]!, q: [0, 0, 0, 0, 0, 0], point: { frame: "t", v: [0, 0, 0] } });
    expect(se3.maxAbsDiff({ R: rotZ(0), p: t.point! }, { R: rotZ(0), p: t.TWt!.p })).toBe(0);
  });
  it("Warnung nahe der Kardansperre der Pose", () => {
    const r = computeForward({ robot: rob([R(0, 0, 0.1, 0)], "klassisch", { base: { x: 0, y: 0, z: 0, A: 0, B: rad(87), C: 0 } }), q: [0] });
    expect(r.warnings.join(" ")).toContain("Kardansperre nah");
  });
});

describe("Kontrolle (G-25) und Umrechnung (G-27)", () => {
  it("planar und SCARA werden erkannt, sonst keine Kontrolle", () => {
    expect(computeForward({ robot: tpl["2r"]!, q: [0.3, 0.4] }).closedForm!.kind).toBe("planar");
    expect(computeForward({ robot: tpl["scara"]!, q: [0.3, 0.4, 0.1, 0.2] }).closedForm!.kind).toBe("scara");
    expect(computeForward({ robot: tpl["rv6"]!, q: [0, 0, 0, 0, 0, 0] }).closedForm).toBeNull();
    expect(computeForward({ robot: tpl["lp-c1"]!, q: [0, 0, 0] }).closedForm).toBeNull();
    const r = computeForward({ robot: tpl["scara"]!, q: [2.9, -2.5, 0.15, 3.1] });
    expect(r.closedForm!.dev).toBeLessThan(1e-15);
  });
  it("Umrechnung hin und zurück erhält T_Wt; Indexverschiebung der Tabelle", () => {
    for (const t of robotTemplates()) {
      const q = t.robot.qSource!;
      const c = convertDh(t.robot, q), back = convertDh(c.value, q);
      expect(c.value.convention).not.toBe(t.robot.convention);
      expect(c.dev, t.robot.id).toBeLessThan(1e-14);
      expect(se3.maxAbsDiff(forwardRaw(back.value, q), forwardRaw(t.robot, q)), t.robot.id).toBeLessThan(1e-14);
    }
    const c = convertDh(tpl["r612"]!);
    expect(c.value.joints.map((j) => [j.a, j.alpha])).toEqual([[0, 0], [0.3, rad(-90)]]);
    expect(c.value.tool!.x).toBeCloseTo(0.5, 15);
    expect(c.steps[0]!.id).toBe("G-27-KM");
  });
});

describe("Zeichnung und Lernhilfe", () => {
  it("Strichmodell: Gelenkachsen je Konvention, Strecken d und a, Basis und Werkzeug", () => {
    const k = computeForward({ robot: tpl["kartesisch"]!, q: [0.4, 0.3, 0.2] }).drawing!;
    expect(k.joints).toHaveLength(3);
    expect(k.segments.map((s) => s.kind)).toEqual(["d", "a", "d", "a", "d", "a"]);
    const u = computeForward({ robot: tpl["ur5"]!, q: [0, 0, 0, 0, 0, 0] });
    expect(u.drawing!.segments.at(-1)!.kind).toBe("werkzeug");
    expect(u.drawing!.segments[0]!.kind).toBe("a");
    // modifiziert: Gelenkachse i ist z_i im Ursprung von {i}
    expect(u.drawing!.joints[1]!.origin).toEqual(u.world!.frames[2]!.p);
    // klassisch: Gelenkachse i ist z_(i−1) im Ursprung von {i−1}
    const c = computeForward({ robot: tpl["rv6"]!, q: [0, 0, 0, 0, 0, 0] });
    expect(c.drawing!.joints[0]!.axis).toEqual([0, 0, 1]);
    for (const s of c.drawing!.segments) expect([...s.from, ...s.to].every(Number.isFinite)).toBe(true);
  });
  it("Schritt für Schritt: je Glied vier Teilschritte, Ende bei T_Wt", () => {
    for (const t of robotTemplates()) {
      const r = computeForward({ robot: t.robot, q: [...t.robot.qSource!] });
      const st = dhStages(r, t.robot);
      const extra = t.robot.tool ? 1 : 0;
      expect(st).toHaveLength(4 * t.robot.joints.length + extra);
      expect(se3.maxAbsDiff(st.at(-1)!.after, r.TWt!), t.robot.id).toBeLessThan(1e-15);
      for (let k = 1; k < st.length; k++) expect(st[k]!.before).toBe(st[k - 1]!.after);
    }
    expect(dhStages(computeForward({ robot: rob([]), q: [] }), rob([]))).toEqual([]);
  });
  it("Vorlagen: Quelle angegeben, Stellung der Quelle in den Grenzen, Text einer Zeile mit Einheiten", () => {
    for (const t of robotTemplates()) {
      expect(t.robot.source.length, t.robot.id).toBeGreaterThan(5);
      const r = computeForward({ robot: t.robot, q: [...t.robot.qSource!] });
      expect(r.errors, t.robot.id).toEqual([]);
      expect(r.limitsViolated, t.robot.id).toEqual([]);
    }
    expect(jointText("modifiziert", tpl["ur5"]!.joints[1]!, 2)).toBe("Dreh 2: θ_0 = 0° (0 rad), d = 0 mm, a_1 = 0 mm, α_1 = -90° (-1,5708 rad)");
  });
  it("deterministisch: gleiche Eingabe, gleiche Ausgabe bis aufs Bit", () => {
    const inp = { robot: tpl["rv6"]!, q: [0.1, -0.2, 0.3, 0.4, -0.5, 0.6], convert: true };
    expect(JSON.stringify(computeForward(inp))).toBe(JSON.stringify(computeForward(inp)));
  });
});

describe("Katalog und Rechenweg", () => {
  it("alle 14 Formeln G-21 bis G-27 kommen in den Beispielfällen vor, jede im Modul kinematik mit Status", () => {
    const ids = new Set(kinematikK3Faelle().flatMap((f) => forwardSteps(computeForward(f.inp)).map((s) => s.id)));
    const k3 = [...ids].filter((id) => /^G-2[1-7](-|$)/.test(id)).sort();
    expect(k3).toEqual(["G-21", "G-21-R", "G-22", "G-22-R", "G-23-G", "G-23-P", "G-23-R", "G-24", "G-24-W", "G-25-P", "G-25-S", "G-26", "G-27-KM", "G-27-MK"]);
    for (const id of ids) { expect(moduleOfId(id), id).toBe("kinematik"); expect(formulaState(id), id).not.toBe("unbekannt"); }
  });
  it("Rechenweg nur in Gruppen des Moduls, Matrizen endlich, 4×4 mit letzter Zeile (0, 0, 0, 1)", () => {
    for (const f of kinematikK3Faelle()) {
      const r = computeForward(f.inp);
      expect(r.errors, f.id).toEqual([]);
      for (const g of Object.keys(r.trace)) expect(traceGroupsOf("kinematik")).toContain(g);
      for (const s of forwardSteps(r)) {
        if (!s.matrix) continue;
        expect(s.matrix.flat().every(Number.isFinite), s.id).toBe(true);
        if (s.matrix.length === 4 && s.matrix[0]!.length === 4 && s.id !== "G-27-KM" && s.id !== "G-27-MK") expect(s.matrix[3], s.id).toEqual([0, 0, 0, 1]);
      }
    }
  });
});
