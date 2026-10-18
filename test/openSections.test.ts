/** Offene Profile (eng-core 0.7.0): Symmetrie, Spiegelung, Skalierung, Grenzfälle, Eingabeprüfung, Hinweise, Einbindung in Blatt 1. */
import { describe, expect, it } from "vitest";
import { computeStrength, designSize, sectionHeight, sectionProps, isOpenSection, SECTIONS, type SecType, type StrengthInput } from "../src/index";
import { repo } from "../src/data";
import { collectCatalog } from "../scripts/katalog";

const OPEN: SecType[] = ["i_profil", "i_profil_z", "u_profil", "u_profil_z", "l_profil", "t_profil"];
const dflt = (t: SecType) => Object.fromEntries(SECTIONS[t].fields.map(([k, , v]) => [k, v]));
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const base: StrengthInput = { mode: "single", kind: "biegung", sub: "EQ", materialId: "W038", secType: "i_profil", dims: dflt("i_profil"), L: 1200, F: 2, q: 2, a: 300, N: 0, T: 0, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null } };

describe("Katalog der Querschnitte", () => {
  it("zwei Gruppen, schwache Lage verweist auf den Grundtyp", () => {
    expect(OPEN.every((t) => isOpenSection(t))).toBe(true);
    expect((Object.keys(SECTIONS) as SecType[]).filter((t) => SECTIONS[t].group === "geschlossen")).toHaveLength(6);
    expect(SECTIONS.i_profil_z.weakOf).toBe("i_profil");
    expect(SECTIONS.u_profil_z.weakOf).toBe("u_profil");
  });
  it("alle Standardwerte gültig, Formfaktoren und Trägheitsradius vorhanden", () => {
    for (const t of OPEN) {
      const s = sectionProps(t, dflt(t));
      expect(s.errors).toEqual([]);
      for (const v of [s.A, s.I, s.Imin, s.W, s.K, s.Wt, s.kappa, s.i, s.phiBe, s.phiBf, s.phiTe, s.phiTf]) expect(Number.isFinite(v) && v > 0).toBe(true);
      expect(s.Imin).toBeLessThanOrEqual(s.I * (1 + 1e-12));
      expect(s.open).toBeDefined();
    }
  });
});

describe("Symmetrie und Hauptachsen", () => {
  it("I und T: Schwerpunkt auf der Symmetrieachse, I_yz = 0", () => {
    for (const t of ["i_profil", "t_profil"] as SecType[]) { const o = sectionProps(t, dflt(t)).open!; expect(o.ys).toBe(0); expect(o.Iyz).toBe(0); expect(o.alpha).toBe(0); }
  });
  it("I, U: I_y = I_z der schwachen Lage, Biegung schwach nutzt I_z", () => {
    for (const [s, w] of [["i_profil", "i_profil_z"], ["u_profil", "u_profil_z"]] as const) {
      const a = sectionProps(s, dflt(s)), b = sectionProps(w, dflt(w));
      expect(a.I).toBe(a.open!.Iy); expect(b.I).toBe(a.open!.Iz); expect(b.A).toBe(a.A); expect(b.K).toBe(a.K);
      expect(sectionHeight(w, dflt(w))).toBe(dflt(w)["b"]);
    }
  });
  it("U schwach: Randabstände y_s und b − y_s", () => {
    const s = sectionProps("u_profil_z", dflt("u_profil_z")), o = s.open!;
    expect(rel(o.eo, o.ys)).toBeLessThan(1e-12); expect(rel(o.eu, 65 - o.ys)).toBeLessThan(1e-12); expect(s.e).toBe(Math.max(o.eo, o.eu));
  });
  it("L gleichschenklig: α = 45°, I₁ + I₂ = I_y + I_z", () => {
    const o = sectionProps("l_profil", dflt("l_profil")).open!;
    expect(o.alpha).toBeCloseTo(45, 12); expect(rel(o.I1 + o.I2, o.Iy + o.Iz)).toBeLessThan(1e-12);
  });
  it("L gespiegelt (h ↔ b): I_y ↔ I_z, y_s ↔ z_s, α → 90° − α", () => {
    const a = sectionProps("l_profil", { h: 80, b: 40, t: 8 }).open!, b = sectionProps("l_profil", { h: 40, b: 80, t: 8 }).open!;
    expect(rel(a.Iy, b.Iz)).toBeLessThan(1e-12); expect(rel(a.Iz, b.Iy)).toBeLessThan(1e-12);
    expect(rel(a.ys, b.zs)).toBeLessThan(1e-12); expect(rel(a.Iyz, b.Iyz)).toBeLessThan(1e-12);
    expect(a.alpha + b.alpha).toBeCloseTo(90, 9);
  });
  it("T: Schwerpunkt im oberen Teil, maßgebender Rand unten", () => {
    const s = sectionProps("t_profil", dflt("t_profil")), o = s.open!;
    expect(o.eu).toBeGreaterThan(o.eo); expect(rel(s.W, s.I / o.eu)).toBeLessThan(1e-12);
  });
});

describe("Skalierung", () => {
  it("alle Maße × k: A × k², I × k⁴, W × k³, Iₜ × k⁴, κ und φ unverändert", () => {
    const k = 1.7;
    for (const t of OPEN) {
      const d = dflt(t), a = sectionProps(t, d), b = sectionProps(t, Object.fromEntries(Object.entries(d).map(([q, v]) => [q, v * k])));
      expect(rel(b.A, a.A * k ** 2)).toBeLessThan(1e-12); expect(rel(b.I, a.I * k ** 4)).toBeLessThan(1e-12); expect(rel(b.W, a.W * k ** 3)).toBeLessThan(1e-12);
      expect(rel(b.K, a.K * k ** 4)).toBeLessThan(1e-12); expect(rel(b.kappa, a.kappa)).toBeLessThan(1e-12); expect(rel(b.phiBe, a.phiBe)).toBeLessThan(1e-12);
    }
  });
});

describe("Eingabeprüfung und Hinweise", () => {
  it("ungültige Geometrie meldet Fehler je Feld", () => {
    expect(sectionProps("i_profil", { h: 20, b: 40, tw: 5, tf: 11 }).errors).toEqual(["Flanschdicke t_f darf höchstens h/2 sein"]);
    expect(sectionProps("t_profil", { h: 20, b: 40, tw: 50, tf: 25 }).errors).toEqual(["Stegdicke t_w darf höchstens b sein", "Flanschdicke t_f darf höchstens h sein"]);
    expect(sectionProps("l_profil", { h: 20, b: 40, t: 30 }).errors).toEqual(["Schenkeldicke t darf höchstens h sein"]);
    expect(sectionProps("u_profil", { h: 0, b: 40, tw: 5, tf: 5 }).errors.length).toBe(1);
  });
  it("Beulhinweis bei schlankem Flansch, Dickwandhinweis bei dicken Teilen", () => {
    expect(sectionProps("i_profil", { h: 200, b: 200, tw: 6, tf: 4 }).notes.some((n) => n.startsWith("Flansch schlank"))).toBe(true);
    expect(sectionProps("i_profil", { h: 60, b: 40, tw: 20, tf: 15 }).notes.some((n) => n.startsWith("Iₜ dünnwandig"))).toBe(true);
    expect(sectionProps("i_profil", dflt("i_profil")).notes).toEqual([]);
  });
  it("Biegung offen: Hinweis Biegedrillknicken; U zusätzlich Schubmittelpunkt; L Hinweis schiefe Biegung", () => {
    const r = computeStrength(repo, base);
    expect(r.warnings.some((w) => w.includes("Biegedrillknicken"))).toBe(true);
    const u = computeStrength(repo, { ...base, secType: "u_profil", dims: dflt("u_profil") });
    expect(u.warnings.some((w) => w.includes("Schubmittelpunkt"))).toBe(true);
    const l = computeStrength(repo, { ...base, secType: "l_profil", dims: dflt("l_profil") });
    expect(l.warnings.some((w) => w.includes("schiefe Biegung"))).toBe(true);
    const c = computeStrength(repo, { ...base, secType: "rund_hohl", dims: { D: 60, t: 4 } });
    expect(c.warnings.some((w) => w.includes("Biegedrillknicken"))).toBe(false);
  });
  it("Torsion offen: Warnung Wölbkrafttorsion, nicht bei Knicken", () => {
    const t = computeStrength(repo, { ...base, kind: "torsion", sub: "T1", T: 50 });
    expect(t.warnings.some((w) => w.includes("Wölbbehinderung"))).toBe(true);
    const k = computeStrength(repo, { ...base, kind: "druck", sub: "K2", F: 5 });
    expect(k.warnings.some((w) => w.includes("Wölbbehinderung") || w.includes("Biegedrillknicken"))).toBe(false);
  });
});

describe("Einbindung Blatt 1", () => {
  it("Querkraftschub τ_Q = κ·Q/A, κ aus Jourawski", () => {
    const r = computeStrength(repo, { ...base, sub: "EE", F: 10 });
    expect(rel(r.tauQ, r.section.kappa * 5000 / r.section.A)).toBeLessThan(1e-12);
  });
  it("Knicken L-Profil mit I₂", () => {
    const r = computeStrength(repo, { ...base, kind: "druck", sub: "K2", F: 5, secType: "l_profil", dims: dflt("l_profil") });
    expect(rel(r.buck!.lambda, 1200 / Math.sqrt(r.section.open!.I2 / r.section.A))).toBeLessThan(1e-12);
  });
  it("Eigenfrequenz nutzt I der Lage und die Höhe in Lastrichtung", () => {
    const a = computeStrength(repo, { ...base, kind: "FQ", sub: "GG", vibration: { mz: 0, fmin: 10, ferr: null, dmin: 20 } });
    const b = computeStrength(repo, { ...base, kind: "FQ", sub: "GG", secType: "i_profil_z", vibration: { mz: 0, fmin: 10, ferr: null, dmin: 20 } });
    const ratio = a.vibration!.modes[0]!.f / b.vibration!.modes[0]!.f;
    expect(rel(ratio, Math.sqrt(a.section.I / b.section.I))).toBeLessThan(1e-9);
  });
  it("Bemessen formtreu: t_w und t_f auf 0,5 mm, h und b auf 1 mm", () => {
    const d = designSize(repo, { ...base, q: 20 }, "formtreu");
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.result.util).toBeLessThanOrEqual(1);
      expect(Number.isInteger(d.dims["h"]!) && Number.isInteger(d.dims["b"]!)).toBe(true);
      expect(Number.isInteger(d.dims["tw"]! * 2) && Number.isInteger(d.dims["tf"]! * 2)).toBe(true);
    }
  });
});

describe("Formelkatalog", () => {
  it("enthält alle neuen Formel-IDs mit Beispiel", () => {
    const ids = new Set(collectCatalog().map((e) => e.id));
    const want = ["Q-IP-A", "Q-IP-IY", "Q-IP-IZ", "Q-IP-K", "Q-IP-W", "Q-IP-WZ", "Q-IP-WT", "Q-IP-S", "Q-IP-KA", "Q-IP-SZ", "Q-IP-KAZ",
      "Q-UP-A", "Q-UP-YS", "Q-UP-IY", "Q-UP-IZ", "Q-UP-K", "Q-UP-EM", "Q-UP-W", "Q-UP-WZ", "Q-UP-WT", "Q-UP-S", "Q-UP-KA", "Q-UP-SZ", "Q-UP-KAZ",
      "Q-LP-A", "Q-LP-YS", "Q-LP-ZS", "Q-LP-IY", "Q-LP-IZ", "Q-LP-IYZ", "Q-LP-I1", "Q-LP-I2", "Q-LP-AL", "Q-LP-K", "Q-LP-W", "Q-LP-WT", "Q-LP-S", "Q-LP-KA",
      "Q-TP-A", "Q-TP-ZS", "Q-TP-IY", "Q-TP-IZ", "Q-TP-K", "Q-TP-W", "Q-TP-WT", "Q-TP-S", "Q-TP-KA", "Q-SIGO", "Q-SIGU"];
    for (const id of want) expect(ids.has(id), id).toBe(true);
  });
});
