/**
 * Formelkatalog als Daten: führt alle Belastungsarten, Querschnitte und Bemessungsfälle aus und sammelt
 * jede Formel-ID genau einmal, inklusive eines nachrechenbaren Beispiels (eingesetzte Werte, Ergebnis, Fall).
 * Grundlage für FORMELKATALOG.md (scripts/formelkatalog.ts) und die Freigabe-Excel (scripts/formelfreigabe.py).
 * Aufruf als CLI: npx tsx scripts/katalog.ts --json  → Katalog als JSON auf stdout
 */
import { readFileSync, existsSync } from "node:fs";
import { computeStrength, designSize, dimsLabel, caseLabel, SECTIONS, BENDING_CASES, TENSION_CASES, BUCKLING_CASES, TORSION_CASES, CORE_VERSION, buildIndex, ranking, points, indexTrace, pointTrace, allIndexKeys, multiConstraint, sectionProps, MAT_CLASSES, type CalcStep, type StrengthInput, type SecType, type AshbyState, type MatClass, type ShapeMode } from "../src/index";
import { repo, DATA_VERSION } from "../src/data";

export interface CatalogEntry {
  id: string; group: string; groupTitle: string; title: string; formula: string; unit: string; ref: string;
  /** Beispiel aus dem ersten Rechenlauf, in dem die Formel vorkommt. */
  exSubst: string; exValue: number; exCase: string;
}
export interface FormulaStatus { status: "freigegeben" | "abgelehnt" | "offen"; datum?: string; durch?: string; kommentar?: string; /** Formeltext zum Zeitpunkt der Prüfung. */ formel?: string }
export type StatusMap = Record<string, FormulaStatus>;

export const GROUP_TITLE: Record<string, string> = { Q: "Querschnitte", F: "Formfaktoren (Ashby Kap. 7.2)", W: "Werkstoff und Auslegungswerte", B: "Biegung", Z: "Zug und Druck", K: "Knicken", T: "Torsion", N: "Nachweise", D: "Bemessen", A: "Werkstoffauswahl (Ashby Kap. 5 bis 7)", C: "Zielkonflikte (Ashby Kap. 9)" };

const base: StrengthInput = { mode: "single", kind: "biegung", sub: "EQ", materialId: "W038", secType: "rund_hohl", dims: { D: 60, t: 4 }, L: 1200, F: 2, q: 2, a: 300, N: 0, T: 200, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null } };

function caseText(inp: StrengthInput): string {
  const mat = repo.byId(inp.materialId);
  const load = inp.mode === "combined" ? `Überlagert (${caseLabel("combined", inp.kind, inp.sub)}, N ${inp.N} kN, T ${inp.T} N·m)` : `${caseLabel("single", inp.kind, inp.sub)}`;
  return `${load}; ${mat ? `${mat.name} (${inp.materialId})` : inp.materialId}; ${dimsLabel(inp.secType, inp.dims)}; L ${inp.L} mm; F ${inp.F} kN; q ${inp.q} kN/m`;
}

export function collectCatalog(): CatalogEntry[] {
  const runs: Array<Partial<StrengthInput>> = [
    ...Object.keys(TENSION_CASES).map((sub) => ({ kind: "zug" as const, sub })),
    ...Object.keys(BUCKLING_CASES).map((sub) => ({ kind: "druck" as const, sub, F: 20 })),
    ...Object.keys(BUCKLING_CASES).map((sub) => ({ kind: "druck" as const, sub, F: 20, L: 300 })),
    ...Object.keys(BENDING_CASES).map((sub) => ({ kind: "biegung" as const, sub })),
    ...Object.keys(TORSION_CASES).map((sub) => ({ kind: "torsion" as const, sub })),
    { mode: "combined", sub: "EQ", N: -10, T: 150 }, { materialId: "W001" }, { materialId: "W096", secType: "rechteck_voll", dims: { b: 60, h: 120 } }, { materialId: "W060" },
  ];
  for (const t of Object.keys(SECTIONS) as SecType[]) { const dims = Object.fromEntries(SECTIONS[t].fields.map(([k, , v]) => [k, v])); runs.push({ secType: t, dims }); }
  const seen = new Map<string, CatalogEntry>();
  const take = (s: CalcStep, fall: string) => {
    const id = s.id.replace(/^D-(ERF|GEW)-.*/, "D-$1");
    if (seen.has(id)) return;
    const group = id.split("-")[0] ?? "";
    seen.set(id, { id, group, groupTitle: GROUP_TITLE[group] ?? group, title: s.title, formula: s.formula, unit: s.unit, ref: s.ref ?? "", exSubst: s.subst, exValue: s.value, exCase: fall });
  };
  for (const r of runs) {
    const inp = { ...base, ...r }; const res = computeStrength(repo, inp); const fall = caseText(inp);
    Object.values(res.trace).forEach((arr) => arr?.forEach((s) => take(s, fall)));
  }
  const dInp = { ...base, q: 4 }; const d = designSize(repo, dInp, "formtreu");
  d.trace.forEach((s) => take(s, `Bemessen formtreu: ${caseText(dInp)}`));

  // Blatt 2: alle Materialindizes, Achsenwerte, Form und Rangliste am Beispiel EN AW-6082
  const classes = Object.fromEntries(MAT_CLASSES.map((c) => [c, true])) as Record<MatClass, boolean>;
  const sec0 = sectionProps(base.secType, base.dims);
  const phiUser = { Be: sec0.phiBe, Bf: sec0.phiBf, Te: sec0.phiTe, Tf: sec0.phiTf };
  for (const [fn, con, obj] of allIndexKeys()) {
    const ix = buildIndex(fn, con, obj); if (!ix) continue;
    const label = `${fn}, ${con}, Ziel ${obj}`;
    indexTrace(ix).forEach((s) => take(s, label));
    for (const shapeMode of ["none", "max", "modul1"] as ShapeMode[]) {
      const st: AshbyState = { index: ix, classes, limits: { Emin: null, rhoMax: null, sfMin: null, priceMax: null }, shapeMode, phiUser };
      const withShape = shapeMode !== "none";
      const p = ranking(repo, st, withShape).find((q) => q.m.id === "W038") ?? points(repo, st, withShape).find((q) => q.m.id === "W038");
      if (p) pointTrace(ix, st, p, withShape).forEach((s) => take(s, `${label}; EN AW-6082 (W038); Form ${shapeMode === "none" ? "ohne" : shapeMode === "max" ? "φ_max Tab. 7.3" : `Profil Blatt 1 ${dimsLabel(base.secType, base.dims)}`}`));
    }
  }
  // Schritt 6: duktil, duktil ohne R_p-Auslegungswert, spröde
  const basis = { secType: base.secType, dims: base.dims, caseId: base.sub, L: base.L, F: base.F, q: base.q, a: base.a, fDiv: base.fDiv, SFreq: base.SFreq, SBreq: base.SBreq };
  const mc = multiConstraint(repo, ["W038", "W004", "W029"].map((id) => repo.byId(id)!), basis, 5);
  const bText = `Schritt 6, Grundlage ${caseText(base)}; α 5 €/kg`;
  mc.basisTrace.forEach((s) => take(s, bText));
  mc.rows.forEach((r) => r.trace.forEach((s) => take(s, `${bText}; ${r.m.name} (${r.m.id})`)));
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
  process.stdout.write(JSON.stringify({ coreVersion: CORE_VERSION, dataVersion: DATA_VERSION, entries: collectCatalog(), status: readStatus() }));
}
