/**
 * Formelkatalog als Daten: führt alle Belastungsarten, Querschnitte und Bemessungsfälle aus und sammelt
 * jede Formel-ID genau einmal, inklusive eines nachrechenbaren Beispiels (eingesetzte Werte, Ergebnis, Fall).
 * Grundlage für FORMELKATALOG.md (scripts/formelkatalog.ts) und die Freigabe-Excel (scripts/formelfreigabe.py).
 * Aufruf als CLI: npx tsx scripts/katalog.ts --json  → Katalog als JSON auf stdout
 */
import { readFileSync, existsSync } from "node:fs";
import { FATIGUE_DEFAULT, type FatigueInput, LOADLIST_SUPPORTS, PRESSURE_CASES, VIBRATION_CASES, isPressureCase, isVibrationCase, pressureText, vibrationText, designPressureStrength, computeStrength, designSize, dimsLabel, caseLabel, SECTIONS, BENDING_CASES, TENSION_CASES, BUCKLING_CASES, TORSION_CASES, CORE_VERSION, buildIndex, ranking, points, indexTrace, pointTrace, allIndexSpecs, multiConstraint, sectionProps, MAT_CLASSES, type CalcStep, type StrengthInput, type SecType, type AshbyState, type MatClass, type ShapeMode } from "../src/index";
import { repo, DATA_VERSION } from "../src/data";
import { moduleOfId, type ModuleId } from "../src/modules";
import { computeLine, fdRepo, FD_VERSION } from "../src/index";
import { fluidFaelle } from "./fluid-faelle";

export interface CatalogEntry {
  id: string; group: string; groupTitle: string; module: ModuleId; title: string; formula: string; unit: string; ref: string;
  /** Beispiel aus dem ersten Rechenlauf, in dem die Formel vorkommt. */
  exSubst: string; exValue: number; exCase: string;
}
export interface FormulaStatus { status: "freigegeben" | "abgelehnt" | "offen"; datum?: string; durch?: string; kommentar?: string; /** Antwort bzw. Umsetzung durch den Kern-Verantwortlichen */ antwort?: string; /** Formeltext zum Zeitpunkt der Prüfung. */ formel?: string; /** Einwand einer Vorrunde, mit der Freigabe erledigt. */ erledigt?: string }
export type StatusMap = Record<string, FormulaStatus>;

export const GROUP_TITLE: Record<string, string> = { Q: "Querschnitte", F: "Formfaktoren (Ashby Kap. 7.2)", W: "Werkstoff und Auslegungswerte", B: "Biegung", Z: "Zug und Druck", K: "Knicken", T: "Torsion", N: "Nachweise", D: "Bemessen", A: "Werkstoffauswahl (Ashby Kap. 5 bis 7)", C: "Zielkonflikte (Ashby Kap. 9)", P: "Druckbehälter", V: "Eigenfrequenz", E: "Kerbwirkung und Ermüdung (Roloff/Matek Kap. 3, FKM)",
  // Fachtools (ab 0.10.0 registriert, Formeln folgen mit den Modulen)
  FS: "Fluid-Stoffwerte", RH: "Rohrhydraulik", PU: "Pumpe und Anlage", SV: "Schraubenverbindung", PV: "Pressverband", OR: "O-Ring", FW: "Fachwerk" };

const base: StrengthInput = { mode: "single", kind: "biegung", sub: "EQ", materialId: "W038", secType: "rund_hohl", dims: { D: 60, t: 4 }, L: 1200, F: 2, q: 2, a: 300, N: 0, T: 200, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null } };

function caseText(inp: StrengthInput): string {
  const mat = repo.byId(inp.materialId);
  if (inp.mode === "single" && inp.kind === "PB" && inp.pressure && isPressureCase(inp.sub)) return `Druckbehälter, ${pressureText(inp.sub, inp.pressure)}; ${mat ? `${mat.name} (${inp.materialId})` : inp.materialId}; S_F ${inp.SFreq}, S_B ${inp.SBreq}`;
  if (inp.mode === "single" && inp.kind === "FQ" && inp.vibration && isVibrationCase(inp.sub)) return `${vibrationText(inp.sub, inp.vibration)}; ${mat ? `${mat.name} (${inp.materialId})` : inp.materialId}; ${dimsLabel(inp.secType, inp.dims)}; L ${inp.L} mm`;
  const load = inp.mode === "combined" ? `Überlagert (${caseLabel("combined", inp.kind, inp.sub)}, N ${inp.N} kN, T ${inp.T} N·m)` : `${caseLabel("single", inp.kind, inp.sub)}`;
  const ll = inp.sub === "LL" && inp.loadList ? ` (${LOADLIST_SUPPORTS[inp.loadList.support].label}: ${inp.loadList.loads.map((l) => l.kind === "F" ? `F ${l.F} kN bei ${l.x} mm` : l.kind === "M" ? `M ${l.M} N·m bei ${l.x} mm` : `q ${l.q1}…${l.q2} kN/m auf ${l.x1}…${l.x2} mm`).join(", ")}${inp.loadList.selfWeight ? ", mit Eigengewicht" : ""})` : "";
  return `${load}${ll}; ${mat ? `${mat.name} (${inp.materialId})` : inp.materialId}; ${dimsLabel(inp.secType, inp.dims)}; L ${inp.L} mm${ll ? "" : `; F ${inp.F} kN; q ${inp.q} kN/m`}`;
}

export function collectCatalog(): CatalogEntry[] {
  const runs: Array<Partial<StrengthInput>> = [
    ...Object.keys(TENSION_CASES).map((sub) => ({ kind: "zug" as const, sub })),
    ...Object.keys(BUCKLING_CASES).map((sub) => ({ kind: "druck" as const, sub, F: 20 })),
    ...Object.keys(BUCKLING_CASES).map((sub) => ({ kind: "druck" as const, sub, F: 20, L: 300 })),
    ...Object.keys(BENDING_CASES).map((sub) => ({ kind: "biegung" as const, sub })),
    ...Object.keys(TORSION_CASES).map((sub) => ({ kind: "torsion" as const, sub })),
    { mode: "combined", sub: "EQ", N: -10, T: 150 }, { materialId: "W001" },
    // Lastliste (0.5.0): gemischter Fall gelenkig, beidseitig eingespannt, Krag mit Moment, Eigengewicht
    { sub: "LL", loadList: { support: "GG", loads: [{ kind: "F", x: 300, F: 2 }, { kind: "F", x: 900, F: 1.5 }, { kind: "q", x1: 600, x2: 1200, q1: 1, q2: 1 }, { kind: "M", x: 1000, M: 150 }], selfWeight: false } },
    { sub: "LL", loadList: { support: "EE", loads: [{ kind: "F", x: 400, F: 3 }], selfWeight: false } },
    { sub: "LL", loadList: { support: "KR", loads: [{ kind: "M", x: 1200, M: 200 }], selfWeight: true } }, { materialId: "W096", secType: "rechteck_voll", dims: { b: 60, h: 120 } }, { materialId: "W060" },
  ];
  for (const t of Object.keys(SECTIONS) as SecType[]) { const dims = Object.fromEntries(SECTIONS[t].fields.map(([k, , v]) => [k, v])); runs.push({ secType: t, dims }); }
  const seen = new Map<string, CatalogEntry>();
  const take = (s: CalcStep, fall: string) => {
    const id = s.id.replace(/^D-(ERF|GEW)-.*/, "D-$1");
    if (seen.has(id)) return;
    const group = id.split("-")[0] ?? "";
    const module = moduleOfId(id);
    if (module === null) throw new Error(`Formel-ID ${id}: Präfix ${group} ist in src/modules.json keinem Modul zugeordnet`);
    seen.set(id, { id, group, groupTitle: GROUP_TITLE[group] ?? group, module, title: s.title, formula: s.formula, unit: s.unit, ref: s.ref ?? "", exSubst: s.subst, exValue: s.value, exCase: fall });
  };
  for (const r of runs) {
    const inp = { ...base, ...r }; const res = computeStrength(repo, inp); const fall = caseText(inp);
    Object.values(res.trace).forEach((arr) => arr?.forEach((s) => take(s, fall)));
  }
  const dInp = { ...base, q: 4 }; const d = designSize(repo, dInp, "formtreu");
  d.trace.forEach((s) => take(s, `Bemessen formtreu: ${caseText(dInp)}`));

  // Druckbehälter (0.6.0): Beispiele wie Prüffälle D1 bis D7 (EN AW-6082, a = 50 mm, t = 5 mm)
  const pb = (sub: string, pi: number, pa: number, dim: "inner" | "outer" = "inner", d0 = 100, t = 5, over: Partial<StrengthInput> = {}): StrengthInput => ({ ...base, kind: "PB", sub, pressure: { dim, d: d0, t, pi, pa }, ...over });
  for (const sub of Object.keys(PRESSURE_CASES)) { const inp = pb(sub, 10, 0); const r = computeStrength(repo, inp); Object.values(r.trace).forEach((arr) => arr?.forEach((s) => take(s, caseText(inp)))); }
  const dz = { SFreq: 1.3, SBreq: 1.5 };
  for (const [sub, dim, d0, pa] of [["ZG", "outer", 110, 0], ["ZG", "inner", 100, 0], ["KU", "outer", 110, 0], ["KU", "inner", 100, 0], ["ZO", "outer", 110, 0]] as const) {
    const inp = pb(sub, 10, pa, dim, d0, 1, dz); const r = designPressureStrength(repo, inp);
    const txt = `Bemessen Wandstärke: Druckbehälter, ${PRESSURE_CASES[sub].label}; ${dim === "outer" ? "Außendurchmesser" : "Innendurchmesser"} ${d0} mm fest; p_i 10 MPa, p_a ${pa} MPa; EN AW-6082 (W038); S_F ${dz.SFreq}, S_B ${dz.SBreq}`;
    r.trace.forEach((s) => take(s, txt));
  }

  // Eigenfrequenz (0.6.1): Beispiele wie Prüffälle F1 bis F7 (EN AW-6082, Rund hohl 60 × 4, L = 1200 mm)
  for (const sub of Object.keys(VIBRATION_CASES)) {
    const inp: StrengthInput = { ...base, kind: "FQ", sub, vibration: { mz: 0, fmin: 30, ferr: 100, dmin: 20 } };
    const r = computeStrength(repo, inp); Object.values(r.trace).forEach((arr) => arr?.forEach((s) => take(s, caseText(inp))));
  }
  for (const mz of [0, 5]) {
    const inp: StrengthInput = { ...base, kind: "FQ", sub: "KR", vibration: { mz, fmin: 80, ferr: null, dmin: 20 } };
    const d = designSize(repo, inp, "formtreu"); d.trace.forEach((s) => take(s, `Bemessen formtreu: ${caseText(inp)}`));
  }

  // Kerbwirkung und Ermüdung (0.9.0): Beispiele wie Prüffälle E-P2 bis E-P17 (verification/ermuedung.py), Literaturfälle zuerst
  const fat = (o: Partial<FatigueInput>): FatigueInput => ({ ...FATIGUE_DEFAULT, ...o, R: { ...FATIGUE_DEFAULT.R, ...(o.R ?? {}) }, sigmaW: { ...FATIGUE_DEFAULT.sigmaW, ...(o.sigmaW ?? {}) } });
  const fb: StrengthInput = { ...base, sub: "KE", secType: "rund_voll", L: 1000, q: 0, F: 0.3, materialId: "W008", dims: { D: 32 } };
  const fruns: Array<[string, StrengthInput]> = [
    ["Roloff/Matek 27 Bsp. 3.4: Zapfen E335 (R_m 570, R_e 335 manuell), Absatz D 70 / d 60 / r 2, M_b 1300 N·m wechselnd, T 1700 N·m ruhend, R_z 6,3 µm, σ_bWN 290 MPa", { ...fb, mode: "combined", materialId: "W001", dims: { D: 60 }, F: 1.3, T: 1700, N: 0, dvChoice: { RE: "manual", RM: "manual" }, dvManual: { RE: 335, RM: 570 }, fatigue: fat({ notch: { type: "absatz", D: 70, r: 2 }, xK: 0, R: { zd: 0, b: -1, t: 1 }, dEff: 80, sigmaW: { zd: null, b: 290, t: null } }) }],
    ["Roloff/Matek 27 Bsp. 3.3 c: E295 (R_m 470 manuell), d 25, Passfedernut β_kt 1,36, T 160 N·m schwellend, R_z 12,5 µm, τ_tWN 145 MPa", { ...fb, kind: "torsion", sub: "T1", materialId: "W001", dims: { D: 25 }, T: 160, dvChoice: { RE: "manual", RM: "manual" }, dvManual: { RE: 295, RM: 470 }, fatigue: fat({ notch: { type: "beta", beta: { t: 1.36 } }, R: { zd: 0, b: -1, t: 0 }, Rz: 12.5, sigmaW: { zd: null, b: null, t: 145 } }) }],
    ["42CrMo4 (W008), Absatz D 38 / d 32 / r 3, N 20 kN schwellend, M_b 300 N·m wechselnd, T 200 N·m wechselnd", { ...fb, mode: "combined", N: 20, T: 200, fatigue: fat({ notch: { type: "absatz", D: 38, r: 3 }, xK: 0, R: { zd: 0, b: -1, t: -1 } }) }],
    ["42CrMo4 (W008), Absatz 38/32/3, M_b 300 N·m wechselnd, T 400 N·m ruhend, Überlastungsfall 1", { ...fb, mode: "combined", N: 0, T: 400, fatigue: fat({ notch: { type: "absatz", D: 38, r: 3 }, xK: 0, R: { zd: 0, b: -1, t: 1 }, overload: 1 }) }],
    ["42CrMo4 (W008), Absatz 38/32/3, M_b 300 N·m schwellend, T 400 N·m ruhend, Überlastungsfall 3", { ...fb, mode: "combined", N: 0, T: 400, fatigue: fat({ notch: { type: "absatz", D: 38, r: 3 }, xK: 0, R: { zd: 0, b: 0, t: 1 }, overload: 3 }) }],
    ["42CrMo4 (W008), Absatz 38/32/3, M_b 900 N·m wechselnd, N = 10⁵", { ...fb, F: 0.9, fatigue: fat({ notch: { type: "absatz", D: 38, r: 3 }, xK: 0, N: 1e5 }) }],
    ["EN AW-6082 (W038), Rund hohl 40 × 8, Umlaufnut t 2 / r 1, N 5 kN, M_b 150 N·m, T 100 N·m wechselnd, N = 10⁷", { ...fb, mode: "combined", materialId: "W038", secType: "rund_hohl", dims: { D: 40, t: 8 }, F: 0.15, N: 5, T: 100, fatigue: fat({ notch: { type: "nut", t: 2, r: 1 }, xK: 0, R: { zd: 0, b: -1, t: -1 }, N: 1e7 }) }],
    ["EN AW-6082 (W038), Rund 40, Umlaufnut t 2 / r 1, M_b 250 N·m wechselnd (rechnerische Lebensdauer Typ II)", { ...fb, materialId: "W038", dims: { D: 40 }, F: 0.25, fatigue: fat({ notch: { type: "nut", t: 2, r: 1 }, xK: 0 }) }],
    ["S235JR (W001), Rund 30, Querbohrung 6 mm, N 10 kN, M_b 100 N·m wechselnd, T 150 N·m ruhend, N = 2·10⁵", { ...fb, mode: "combined", materialId: "W001", dims: { D: 30 }, F: 0.1, N: 10, T: 150, fatigue: fat({ notch: { type: "bohrung", dB: 6 }, xK: 0, R: { zd: -1, b: -1, t: 0 }, N: 2e5 }) }],
    ["EN-GJS-400-15 (W030), Rund 20 glatt, Zug 20 kN, R = 0,2 (Datenbank P = 50 %, ψ aus σ_zSch)", { ...fb, kind: "zug", sub: "Z1", materialId: "W030", dims: { D: 20 }, F: 20, fatigue: fat({ R: { zd: 0.2, b: -1, t: 0 } }) }],
    ["EN-GJL-250 (W029), Absatz D 90 / d 60 / r 5, M_b 1000 N·m wechselnd, Guss geprüft", { ...fb, materialId: "W029", dims: { D: 60 }, F: 1, fatigue: fat({ notch: { type: "absatz", D: 90, r: 5 }, xK: 0, castTested: true }) }],
    ["16MnCr5 (W011), Absatz D 90 / d 60 / r 15, T 1500 N·m wechselnd, d_eff 120 mm", { ...fb, kind: "torsion", sub: "T1", materialId: "W011", dims: { D: 60 }, T: 1500, fatigue: fat({ notch: { type: "absatz", D: 90, r: 15 }, R: { zd: 0, b: -1, t: -1 }, dEff: 120 }) }],
    ["S235JR (W001), Rechteck 20 × 40, Gleichstreckenlast 2 kN/m, L 1200, Kerbstelle 600 mm, α_k 1,8 und G′ 0,5 1/mm manuell", { ...fb, sub: "EQ", q: 2, L: 1200, materialId: "W001", secType: "rechteck_voll", dims: { b: 20, h: 40 }, fatigue: fat({ notch: { type: "alpha", alpha: { b: 1.8 }, G: { b: 0.5 } }, xK: 600 }) }],
    ["S235JR (W001), Rechteck 20 × 40, Gleichstreckenlast 2 kN/m, α_k 1,8 manuell ohne Spannungsgefälle", { ...fb, sub: "EQ", q: 2, L: 1200, materialId: "W001", secType: "rechteck_voll", dims: { b: 20, h: 40 }, fatigue: fat({ notch: { type: "alpha", alpha: { b: 1.8 } }, xK: 600 }) }],
    ["GX5CrNiMo19-11-2 (W032), Rund 20, Zug 50 kN, R = 0,8, N = 10⁷ (Begrenzung durch Fließen)", { ...fb, kind: "zug", sub: "Z1", materialId: "W032", dims: { D: 20 }, F: 50, fatigue: fat({ R: { zd: 0.8, b: -1, t: 0 }, N: 1e7 }) }],
    ["42CrMo4 (W008), Absatz 38/32/3, K_t manuell 1, σ_bWN manuell 500 MPa", { ...fb, fatigue: fat({ notch: { type: "absatz", D: 38, r: 3 }, xK: 0, Kt: 1, sigmaW: { zd: null, b: 500, t: null } }) }],
    ["AZ91D (W056), Rund 32, M_b 100 N·m wechselnd (nur Datenbankwert)", { ...fb, materialId: "W056", F: 0.1, fatigue: fat({}) }],
  ];
  for (const [txt, inp] of fruns) { const r = computeStrength(repo, inp); (r.trace.ermuedung ?? []).forEach((s) => take(s, `Dauerfestigkeit: ${txt}`)); }

  // Blatt 2: alle Materialindizes, Achsenwerte, Form und Rangliste am Beispiel EN AW-6082
  const classes = Object.fromEntries(MAT_CLASSES.map((c) => [c, true])) as Record<MatClass, boolean>;
  const sec0 = sectionProps(base.secType, base.dims);
  const phiUser = { Be: sec0.phiBe, Bf: sec0.phiBf, Te: sec0.phiTe, Tf: sec0.phiTf };
  for (const { fn, con, obj, free } of allIndexSpecs()) {
    const ix = buildIndex(fn, con, obj, free); if (!ix) continue;
    const label = ix.product ? `${fn}, ${ix.product.task}` : `${fn}${free === "Querschnitt" ? "" : ` nur ${free} frei`}, ${con}, Ziel ${obj}`;
    indexTrace(ix).forEach((s) => take(s, label));
    for (const shapeMode of ["none", "max", "modul1"] as ShapeMode[]) {
      const st: AshbyState = { index: ix, classes, limits: { Emin: null, rhoMax: null, sfMin: null, priceMax: null }, shapeMode, phiUser };
      const withShape = shapeMode !== "none";
      // Beispielwerkstoff EN AW-6082; ist er nicht bewertbar (z. B. K_IC fehlt), der Werkstoff auf Rang 1
      const r = ranking(repo, st, withShape);
      const p = r.find((q) => q.m.id === "W038") ?? points(repo, st, withShape).find((q) => q.m.id === "W038") ?? r[0];
      if (p) pointTrace(ix, st, p, withShape).forEach((s) => take(s, `${label}; ${p.m.name} (${p.m.id}); Form ${shapeMode === "none" ? "ohne" : shapeMode === "max" ? "φ_max Tab. 7.3" : `Profil Blatt 1 ${dimsLabel(base.secType, base.dims)}`}`));
      if (!ix.shape) break; // ohne Formwirkung genügt ein Lauf
    }
  }
  // Schritt 6: duktil, duktil ohne R_p-Auslegungswert, spröde
  const basis = { secType: base.secType, dims: base.dims, caseId: base.sub, L: base.L, F: base.F, q: base.q, a: base.a, fDiv: base.fDiv, SFreq: base.SFreq, SBreq: base.SBreq };
  const mc = multiConstraint(repo, ["W038", "W004", "W029"].map((id) => repo.byId(id)!), basis, 5);
  const bText = `Schritt 6, Grundlage ${caseText(base)}; α 5 €/kg`;
  mc.basisTrace.forEach((s) => take(s, bText));
  mc.rows.forEach((r) => r.trace.forEach((s) => take(s, `${bText}; ${r.m.name} (${r.m.id})`)));
  // Rohrhydraulik (0.11.0, Modul fluid): Beispielfälle aus scripts/fluid-faelle.ts, Literaturfälle zuerst
  for (const f of fluidFaelle()) {
    const r = computeLine(fdRepo, f.inp, f.task);
    if (r.errors.length) throw new Error(`${f.id}: ${r.errors.join("; ")}`);
    Object.values(r.trace).forEach((arr) => arr?.forEach((s) => take(s, `${f.id} ${f.text}`)));
  }
  return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id, "de"));
}

export function readStatus(): StatusMap {
  const f = new URL("../formelstatus.json", import.meta.url);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as StatusMap) : {};
}

/** Effektiver Status: eine Freigabe gilt nur, solange der Formeltext unverändert ist. */
export function effectiveStatus(e: CatalogEntry, st: FormulaStatus | undefined): { label: string; stale: boolean } {
  if (!st || st.status === "offen") return { label: "Entwurf", stale: false };
  if (st.formel !== undefined && st.formel !== e.formula) return { label: "geändert, neu prüfen", stale: true };
  return { label: st.status, stale: false };
}

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify({ coreVersion: CORE_VERSION, dataVersion: DATA_VERSION, fdVersion: FD_VERSION, entries: collectCatalog(), status: readStatus() }));
}
