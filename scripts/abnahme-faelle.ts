/**
 * Sollwerte der Abnahme P5 (Abgleich mit unabhängiger FEM, z. B. Creo Simulate) aus dem Rechenkern.
 * Deterministisch, keine Rechnung außerhalb von eng-core. Grundlage für scripts/abnahme.py (Excel export und import).
 * Aufruf: npx tsx scripts/abnahme-faelle.ts --json
 */
import { computeStrength, CORE_VERSION, type StrengthInput } from "../src/index";
import { repo, DATA_VERSION } from "../src/data";

export interface P5Row { fall: string; titel: string; groesse: string; key: string; einheit: string; soll: number; tol: number; vergleich: "wert" | "betrag" }
const base: StrengthInput = { mode: "single", kind: "biegung", sub: "EQ", materialId: "W038", secType: "rund_hohl", dims: { D: 60, t: 4 }, L: 1200, F: 2, q: 2, a: 300, N: 0, T: 0, fDiv: 300, SFreq: 1.5, SBreq: 2, SKreq: 3, dvChoice: { RE: "lower", RM: "lower" }, dvManual: { RE: null, RM: null } };
const rows: P5Row[] = [];
const add = (fall: string, titel: string, groesse: string, key: string, einheit: string, soll: number, tol: number, vergleich: "wert" | "betrag" = "wert") => rows.push({ fall, titel, groesse, key, einheit, soll: Number(soll.toPrecision(6)), tol, vergleich });

// D1 Dickwandrohr, Zylinder geschlossen (Lamé), a = 50, b = 55 mm, p_i = 10 MPa
const d1 = computeStrength(repo, { ...base, kind: "PB", sub: "ZG", pressure: { dim: "inner", d: 100, t: 5, pi: 10, pa: 0 } }).pressure!;
const tD = "Dickwandrohr geschlossen, a = 50 mm, b = 55 mm, p_i = 10 MPa";
add("D1", tD, "Umfangsspannung innen σ_θ(a)", "stA", "MPa", d1.inner!.st, 0.02);
add("D1", tD, "Umfangsspannung außen σ_θ(b)", "stB", "MPa", d1.outer!.st, 0.02);
add("D1", tD, "Radialspannung innen σ_r(a)", "srA", "MPa", d1.inner!.sr, 0.05);
add("D1", tD, "Axialspannung σ_z", "sz", "MPa", d1.inner!.sz, 0.02);
add("D1", tD, "Vergleichsspannung innen σ_v(a) (von Mises)", "svA", "MPa", d1.inner!.sv, 0.02);
add("D1", tD, "Radiale Aufweitung innen u(a)", "uA", "mm", d1.inner!.u, 0.02);

// F1 bis F4 Eigenfrequenzen, Rund hohl 60 × 4, L = 1200 mm
const lab: Record<string, string> = { KR: "Kragträger, links eingespannt", GG: "gelenkig gelagert", EG: "links eingespannt, rechts gelenkig", EE: "beidseitig eingespannt" };
(["KR", "GG", "EG", "EE"] as const).forEach((s, i) => {
  const v = computeStrength(repo, { ...base, kind: "FQ", sub: s, vibration: { mz: 0, fmin: null, ferr: null, dmin: 20 } }).vibration!;
  v.modes.forEach((m) => add(`F${i + 1}`, `Eigenfrequenzen ${lab[s]}, Rund hohl 60 × 4, L = 1200 mm`, `Biegeeigenfrequenz f_${m.n}`, `f${m.n}`, "Hz", m.f, 0.01));
});

// Lastliste T7, T10, T12 (statisch, Balken)
const ll = (support: "GG" | "EE", loads: NonNullable<StrengthInput["loadList"]>["loads"]) => computeStrength(repo, { ...base, sub: "LL", loadList: { support, loads, selfWeight: false } }).bend!.ll!;
const t7 = ll("GG", [{ kind: "F", x: 400, F: 3 }]);
add("T7", "Lastliste gelenkig, F = 3 kN bei x = 400 mm", "Lagerkraft links A", "A", "kN", t7.A / 1000, 0.01);
add("T7", "Lastliste gelenkig, F = 3 kN bei x = 400 mm", "größtes Biegemoment |M|max", "Mmax", "N·m", Math.abs(t7.Mext.value) / 1000, 0.01);
add("T7", "Lastliste gelenkig, F = 3 kN bei x = 400 mm", "größte Durchbiegung f", "f", "mm", Math.abs(t7.wext.value), 0.01);
const t10 = ll("EE", [{ kind: "F", x: 400, F: 3 }]);
add("T10", "Lastliste beidseitig eingespannt, F = 3 kN bei x = 400 mm", "Einspannmoment links |M_A|", "MA", "N·m", Math.abs(t10.MA) / 1000, 0.01, "betrag");
add("T10", "Lastliste beidseitig eingespannt, F = 3 kN bei x = 400 mm", "Einspannmoment rechts |M_B|", "MB", "N·m", Math.abs(t10.MB) / 1000, 0.01, "betrag");
add("T10", "Lastliste beidseitig eingespannt, F = 3 kN bei x = 400 mm", "größte Durchbiegung f", "f", "mm", Math.abs(t10.wext.value), 0.01);
const t12 = ll("GG", [{ kind: "F", x: 300, F: 2 }, { kind: "F", x: 900, F: 1.5 }, { kind: "q", x1: 600, x2: 1200, q1: 1, q2: 1 }, { kind: "M", x: 1000, M: 150 }]);
const tT = "Lastliste gelenkig gemischt: F 2 kN bei 300, F 1,5 kN bei 900, q 1 kN/m auf 600 bis 1200, M 150 N·m bei 1000";
add("T12", tT, "Lagerkraft links A", "A", "kN", t12.A / 1000, 0.01);
add("T12", tT, "größtes Biegemoment |M|max", "Mmax", "N·m", Math.abs(t12.Mext.value) / 1000, 0.01);
add("T12", tT, "größte Durchbiegung f", "f", "mm", Math.abs(t12.wext.value), 0.01);

if (process.argv.includes("--json")) process.stdout.write(JSON.stringify({ core: CORE_VERSION, data: DATA_VERSION, rows }));
