/**
 * Bilanzieren über den Nullraum der Elementmatrix (Modul chemie, CH-B01 bis CH-B07, Modus A).
 * Exakte Gauß-Jordan-Elimination mit BigInt-Brüchen, kleinste ganze Koeffizienten.
 * Quelle: Smith, Missen: Chemical Reaction Equilibrium Analysis, Kap. 2 (Formelmatrix, Rang, Nullraum).
 */
import { step, type CalcStep } from "../trace";
import { CH_LIMITS } from "./constants";
import { parseFormula, type ParsedFormula } from "./formula";
import { Q, gcdB, lcmB } from "./rational";

export type Side = "edukt" | "produkt";
export interface Species { formula: string; side: Side }
export type BalanceStatus = "eindeutig" | "nicht_bilanzierbar" | "mehrdeutig" | "fehler";

export interface BalanceResult {
  status: BalanceStatus;
  /** Kleinste ganze Koeffizienten (nur eindeutig), Reihenfolge wie Eingabe. */
  coefficients: number[];
  equation: string;
  parsed: ParsedFormula[];
  /** Elementmatrix: Zeilen (Elemente, ggf. "Ladung"), Spalten (Spezies), Produkte negativ. */
  matrix: { rows: string[]; cols: string[]; values: number[][] };
  /** Basis des Nullraums als Brüche (Text), für den Rechenweg. */
  basis: string[][];
  check: Array<{ key: string; left: number; right: number }>;
  message: string | null;
  steps: CalcStep[];
}

/** Stoffe einer Seite mit Koeffizienten, Koeffizient 1 nicht geschrieben (CH-B05, Ausgabe). */
export function equationText(parsed: readonly ParsedFormula[], sides: readonly Side[], coeff: readonly (number | null)[]): string {
  const part = (s: Side) => parsed.map((p, i) => ({ p, i })).filter((x) => sides[x.i] === s).map(({ p, i }) => `${coeff[i] && coeff[i] !== 1 ? `${coeff[i]} ` : ""}${p.display}`).join(" + ");
  return `${part("edukt")} → ${part("produkt")}`;
}

/** Elementmatrix (CH-B01) aus geparsten Spezies. */
export function elementMatrix(parsed: readonly ParsedFormula[], sides: readonly Side[]): { rows: string[]; values: number[][] } {
  const els = [...new Set(parsed.flatMap((p) => Object.keys(p.composition)))].sort();
  const sg = (j: number) => (sides[j] === "edukt" ? 1 : -1);
  const values = els.map((e) => parsed.map((p, j) => (p.composition[e] ?? 0) * sg(j)));
  const rows = [...els];
  if (parsed.some((p) => p.charge !== 0)) { rows.push("Ladung"); values.push(parsed.map((p, j) => p.charge * sg(j))); }
  return { rows, values };
}

/** CH-B02 Nullraumbasis durch Gauß-Jordan bis zur reduzierten Stufenform (exakt). */
export function nullspace(A: readonly (readonly number[])[], nCols: number): { basis: Q[][]; rank: number } {
  const M = A.map((r) => r.map((x) => Q.of(x)));
  const m = M.length, pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < nCols && r < m; c++) {
    let p = -1;
    for (let i = r; i < m; i++) if (!M[i]![c]!.isZero()) { p = i; break; }
    if (p < 0) continue;
    [M[r], M[p]] = [M[p]!, M[r]!];
    const pv = M[r]![c]!; M[r] = M[r]!.map((x) => x.div(pv));
    for (let i = 0; i < m; i++) if (i !== r && !M[i]![c]!.isZero()) { const f = M[i]![c]!; M[i] = M[i]!.map((x, k) => x.sub(f.mul(M[r]![k]!))); }
    pivots.push(c); r++;
  }
  const free = [...Array(nCols).keys()].filter((c) => !pivots.includes(c));
  const basis = free.map((f) => { const v = Array.from({ length: nCols }, () => Q.ZERO); v[f] = Q.ONE; pivots.forEach((pc, i) => { v[pc] = M[i]![f]!.neg(); }); return v; });
  return { basis, rank: pivots.length };
}

/** CH-B05 kleinste ganze Zahlen mit positivem Vorzeichen. */
export function smallestIntegers(v: readonly Q[]): bigint[] {
  const L = v.reduce((a, x) => lcmB(a, x.d), 1n);
  let ints = v.map((x) => x.n * (L / x.d));
  const g = ints.reduce((a, x) => gcdB(a, x), 0n) || 1n;
  ints = ints.map((x) => x / g);
  if ((ints.find((x) => x !== 0n) ?? 1n) < 0n) ints = ints.map((x) => -x);
  return ints;
}

function base(parsed: ParsedFormula[], sides: Side[], status: BalanceStatus, message: string, steps: CalcStep[], mat: BalanceResult["matrix"] = { rows: [], cols: [], values: [] }, basis: string[][] = []): BalanceResult {
  return { status, coefficients: [], equation: equationText(parsed, sides, parsed.map(() => null)), parsed, matrix: mat, basis, check: [], message, steps };
}

/** Modus A: Gleichung bilanzieren (CH-B01 bis CH-B07). */
export function balance(species: readonly Species[]): BalanceResult {
  const parsed = species.map((s) => parseFormula(s.formula)), sides = species.map((s) => s.side);
  const steps: CalcStep[] = [];
  const bad = parsed.find((p) => !p.ok);
  if (bad) return base(parsed, sides, "fehler", `${bad.input}: ${bad.error}`, [...bad.steps]);
  if (!sides.includes("edukt") || !sides.includes("produkt")) return base(parsed, sides, "fehler", "Edukte und Produkte angeben", steps);
  if (species.length > CH_LIMITS.species) return base(parsed, sides, "fehler", `mehr als ${CH_LIMITS.species} Stoffe: bitte aufteilen`, steps);
  const { rows, values } = elementMatrix(parsed, sides);
  if (rows.filter((r) => r !== "Ladung").length > CH_LIMITS.elements) return base(parsed, sides, "fehler", `mehr als ${CH_LIMITS.elements} Elemente`, steps);
  const cols = parsed.map((p) => p.display);
  const mat = { rows, cols, values };
  steps.push({ ...step("CH-B01", "Elementmatrix", "a_ej = Anzahl Atome von Element e in Stoff j, Edukte positiv, Produkte negativ; bei Ionen Zeile Ladung a_zj = ± z_j", `Zeilen ${rows.join(", ")}; Spalten ${cols.join(", ")}`, rows.length, "1"), matrix: values });
  const { basis, rank } = nullspace(values, parsed.length);
  const dim = basis.length;
  const basisTxt = basis.map((v) => v.map((x) => x.toString()));
  steps.push(step("CH-B02", "Nullraum (exakt)", "A · ν = 0, Gauß-Jordan mit Brüchen, dim = n − Rang", `n = ${parsed.length}, Rang = ${rank}, dim = ${dim}`, dim, "1"));
  steps.push(step("CH-B03", "Fallunterscheidung", "dim 0: nicht bilanzierbar; dim 1: eindeutig; dim > 1: mehrdeutig", `dim = ${dim} → ${dim === 0 ? "nicht bilanzierbar" : dim === 1 ? "eindeutig" : "mehrdeutig"}`, dim, "1"));
  if (dim === 0) {
    const left = new Set(parsed.filter((_, j) => sides[j] === "edukt").flatMap((p) => Object.keys(p.composition)));
    const right = new Set(parsed.filter((_, j) => sides[j] === "produkt").flatMap((p) => Object.keys(p.composition)));
    const onlyL = [...left].filter((e) => !right.has(e)).sort(), onlyR = [...right].filter((e) => !left.has(e)).sort();
    const parts = [...(onlyR.length ? [`Element ${onlyR.join(", ")} fehlt auf der Eduktseite`] : []), ...(onlyL.length ? [`Element ${onlyL.join(", ")} fehlt auf der Produktseite`] : [])];
    const msg = parts.length ? parts.join("; ") : "Atome und Ladung nicht gleichzeitig ausgleichbar";
    steps.push(step("CH-B07", "Ursache", "Elemente nur auf einer Seite → Meldung mit allen solchen Elementen je Seite; sonst Atome und Ladung nicht ausgleichbar", msg, onlyL.length + onlyR.length, "1"));
    return base(parsed, sides, "nicht_bilanzierbar", msg, steps, mat, basisTxt);
  }
  if (dim > 1) return base(parsed, sides, "mehrdeutig", "mehrere unabhängige Reaktionen: Stoff ergänzen oder entfernen", steps, mat, basisTxt);
  const v = basis[0]!;
  const ints = smallestIntegers(v);
  const zero = ints.map((x, j) => (x === 0n ? j : -1)).filter((j) => j >= 0);
  const neg = ints.map((x, j) => (x < 0n ? j : -1)).filter((j) => j >= 0);
  steps.push(step("CH-B04", "Vorzeichenprüfung", "alle ν_j gleiches Vorzeichen und ≠ 0", `ν = (${ints.join("; ")})`, zero.length + neg.length, "1"));
  if (zero.length) return base(parsed, sides, "nicht_bilanzierbar", `Stoff ${zero.map((j) => parsed[j]!.display).join(", ")} nimmt nicht teil`, steps, mat, basisTxt);
  if (neg.length) return base(parsed, sides, "nicht_bilanzierbar", `Stoff ${neg.map((j) => parsed[j]!.display).join(", ")} gehört auf die andere Seite`, steps, mat, basisTxt);
  if (ints.some((x) => x > BigInt(CH_LIMITS.coefficient))) return base(parsed, sides, "fehler", `Koeffizient über ${CH_LIMITS.coefficient}`, steps, mat, basisTxt);
  const coefficients = ints.map((x) => Number(x));
  const sum = coefficients.reduce((s, x) => s + x, 0);
  steps.push({ ...step("CH-B05", "Kleinste ganze Koeffizienten", "ν = v · kgV(Nenner von v), danach ÷ ggT aller Komponenten, Vorzeichen positiv", `Basis (${basisTxt[0]!.join("; ")}) → ν = (${coefficients.join("; ")})`, sum, "1"), matrix: [coefficients] });
  const check = rows.map((key, i) => {
    let left = 0, right = 0;
    values[i]!.forEach((a, j) => { const t = a * coefficients[j]!; if (sides[j] === "edukt") left += t; else right -= t; });
    return { key, left, right };
  });
  const maxRes = Math.max(...check.map((c) => Math.abs(c.left - c.right)));
  steps.push(step("CH-B06", "Probe", "Σ links = Σ rechts je Element und Ladung", check.map((c) => `${c.key}: ${c.left} = ${c.right}`).join("; "), maxRes, "1"));
  return { status: "eindeutig", coefficients, equation: equationText(parsed, sides, coefficients), parsed, matrix: mat, basis: basisTxt, check, message: null, steps };
}
