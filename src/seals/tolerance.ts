/**
 * Toleranzen und Grenzmaße O-Ring (Modul dichtungen, eng-core 0.20.0), Konzept fachtools/konzept_or.md Abschn. 4.1 (OR-TOLA, OR-TOLB,
 * OR-TOLD2, OR-GM, OR-D2GM, OR-DA). Grenzmaße der Bauteile nach ISO 286-1 aus fd 1.2 (IT1 bis IT11) und fd 1.4 (Grundabmaße f, g),
 * Ring nach ISO 3601-1 (Normzeile hat Vorrang, B-or23; nicht genormt Tab. A.1, A.2, Gl. (A.1)). Worst Case (O6). Längen in mm.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { csTolRow, idTolARow, OR_REF_ISO1, OR_REF_ISO286, type FdOringSize, type OrRepo } from "./oringData";

/** Maß mit Passung (z. B. "H8", "f7", "h9") oder von Hand mit Abmaßen [unteres, oberes] in mm; ohne beides Nennmaß ohne Toleranz. */
export interface OrDim { nom: number; fit: string | null; dev?: readonly [number, number] | null }
export interface OrLimits { nom: number; min: number; max: number; text: string }

const IT_KEYS = ["it1", "it2", "it3", "it4", "it5", "it6", "it7", "it8", "it9", "it10", "it11"] as const;

/** Grundtoleranz IT in mm (ISO 286-1 Tab. 1, Nennmaß über d_over bis d_to); null = außerhalb 0 bis 500 mm bzw. IT1 bis IT11. */
export function itOf(r: OrRepo, grade: number, d: number): number | null {
  const row = r.fitIt.find((x) => d > x.d_over_mm && d <= x.d_to_mm);
  const key = IT_KEYS[grade - 1];
  return row && key ? row[key] / 1000 : null;
}
/** Oberes Grenzabmaß es der Welle f bzw. g in mm (ISO 286-1 Tab. 4, B-or25); null = außerhalb 500 mm. */
export function shaftEs(r: OrRepo, letter: "f" | "g", d: number): number | null {
  const row = r.shaftEs.find((x) => d > x.d_over_mm && d <= x.d_to_mm);
  return row ? (letter === "f" ? row.f_um : row.g_um) / 1000 : null;
}

/**
 * OR-GM Grenzmaße eines Bauteils: Bohrung H [N; N + IT], Welle h [N − IT; N], f und g [N + es − IT; N + es]; von Hand [N + ei; N + es].
 * Fehlertext statt Zahlen, wenn die Passung nicht im Umfang ist (Buchstaben H, h, f, g; IT1 bis IT11; Nennmaß bis 500 mm).
 */
export function dimLimits(r: OrRepo, name: string, d: OrDim): OrLimits | string {
  if (!(d.nom > 0)) return `${name}: Nennmaß muss größer als 0 sein`;
  if (!d.fit) {
    const [lo, hi] = d.dev ?? [0, 0];
    if (lo > hi) return `${name}: unteres Abmaß größer als oberes`;
    return { nom: d.nom, min: d.nom + lo, max: d.nom + hi, text: `${name} ${fmt(d.nom)} (${lo >= 0 ? "+" : ""}${fmt(lo)}/${hi >= 0 ? "+" : ""}${fmt(hi)})` };
  }
  const m = /^([Hhfg])(\d{1,2})$/.exec(d.fit);
  if (!m) return `${name}: Passung ${d.fit} nicht im Umfang (H, h, f, g mit IT1 bis IT11)`;
  const letter = m[1]!, grade = Number(m[2]);
  const IT = itOf(r, grade, d.nom);
  if (IT === null) return `${name}: Passung ${d.fit} für ${fmt(d.nom)} mm nicht in ISO 286-1 Tab. 1 des Abzugs (Nennmaß bis 500 mm, IT1 bis IT11)`;
  if (letter === "H") return { nom: d.nom, min: d.nom, max: d.nom + IT, text: `${name} ${fmt(d.nom)} ${d.fit}` };
  if (letter === "h") return { nom: d.nom, min: d.nom - IT, max: d.nom, text: `${name} ${fmt(d.nom)} ${d.fit}` };
  const es = shaftEs(r, letter as "f" | "g", d.nom);
  if (es === null) return `${name}: Grundabmaß ${letter} für ${fmt(d.nom)} mm nicht im Abzug (bis 500 mm)`;
  return { nom: d.nom, min: d.nom + es - IT, max: d.nom + es, text: `${name} ${fmt(d.nom)} ${d.fit}` };
}

export function limitsStep(name: string, d: OrDim, L: OrLimits, r: OrRepo): CalcStep {
  const how = !d.fit ? `von Hand: ${name},min = ${fmt(L.min, 6)}, ${name},max = ${fmt(L.max, 6)}`
    : d.fit[0] === "H" ? `Bohrung ${d.fit}: [N; N + IT${d.fit.slice(1)}] = [${fmt(L.min, 6)}; ${fmt(L.max, 6)}]`
    : d.fit[0] === "h" ? `Welle ${d.fit}: [N − IT${d.fit.slice(1)}; N] = [${fmt(L.min, 6)}; ${fmt(L.max, 6)}]`
    : `Welle ${d.fit}: es = ${fmt((shaftEs(r, d.fit[0] as "f" | "g", d.nom) ?? NaN) * 1000)} µm, [N + es − IT${d.fit.slice(1)}; N + es] = [${fmt(L.min, 6)}; ${fmt(L.max, 6)}]`;
  return step("OR-GM", `Grenzmaße ${name}`, "Bohrung H: [N; N + IT], Welle h: [N − IT; N], f, g: [N + es − IT; N + es]; von Hand [N + ei; N + es]",
    `${name} = ${fmt(d.nom)} mm, ${how} mm`, L.max - L.min, "mm", `${OR_REF_ISO286} Tab. 1 (fd 1.2), Tab. 4 (fd 1.4, B-or25)`);
}

/** Toleranzklasse B nach Gl. (A.1): Δd₁ = d₁^0,95·0,009 + 0,11, gerundet auf 0,01 mm wie die Normzeilen (U-or3). */
export function tolClassB(d1: number): number {
  return Math.round((Math.pow(d1, 0.95) * 0.009 + 0.11) * 100) / 100;
}

export interface OrRingTol { d1: number; d2: number; tol1: number; tol2: number; size: FdOringSize | null; steps: CalcStep[]; error: string | null }

/**
 * Toleranzen des Rings: Normzeile hat Vorrang (B-or23), sonst Klasse A nach Tab. A.2 bzw. Klasse B nach Gl. (A.1), d₂ nach Tab. A.1.
 * Von Hand gesetzte Toleranzen (z. B. Herstellerangabe Parker 8.24) ersetzen den Normwert und stehen im Rechenweg.
 */
export function ringTolerances(r: OrRepo, d1: number, d2: number, cls: "A" | "B", size: FdOringSize | null, tolD1: number | null, tolD2: number | null): OrRingTol {
  const steps: CalcStep[] = [];
  const name = size ? `Größe ${size.size_code} (ISO 3601-1 Tab. ${size.iso_table})` : "nicht genormt";
  let tol1: number | null, txt1: string;
  if (cls === "B") {
    const g = tolClassB(d1);
    tol1 = size ? size.tol_b_mm : g;
    txt1 = size ? `Normzeile ${name}: ±${fmt(size.tol_b_mm)} mm (Gl. (A.1): ±${fmt(g)} mm)` : `Gl. (A.1): ${fmt(d1)}^0,95·0,009 + 0,11 = ±${fmt(g)} mm`;
  } else {
    const row = idTolARow(r, d1);
    tol1 = size ? size.tol_a_mm : row ? row.tol_mm : null;
    txt1 = size ? `Normzeile ${name}: ±${fmt(size.tol_a_mm)} mm${row ? ` (Tab. A.2: ±${fmt(row.tol_mm)} mm)` : ""}` : row ? `Tab. A.2 (${fmt(row.d1_from_mm)} bis ${fmt(row.d1_to_mm)} mm): ±${fmt(row.tol_mm)} mm` : "Tab. A.2: keine Zeile";
  }
  if (tolD1 !== null) { txt1 = `von Hand ±${fmt(tolD1)} mm (Norm: ${txt1})`; tol1 = tolD1; }
  if (tol1 === null) return { d1, d2, tol1: NaN, tol2: NaN, size, steps, error: `Klasse A ohne Normzeile: d₁ = ${fmt(d1)} mm außerhalb ISO 3601-1 Tab. A.2 (0,68 bis 1 320,80 mm); Toleranz von Hand eingeben` };
  steps.push(cls === "B"
    ? step("OR-TOLB", "Toleranz d₁ Klasse B", "Δd₁ = ±(d₁^0,95·0,009 + 0,11), nicht genormt auf 0,01 mm gerundet, Normzeile hat Vorrang", `d₁ = ${fmt(d1)} mm: ${txt1}`, tol1, "mm", `${OR_REF_ISO1} Gl. (A.1), Tab. 1 bis 6`)
    : step("OR-TOLA", "Toleranz d₁ Klasse A", "Normzeile Tab. 1 bis 6, sonst Tab. A.2", `d₁ = ${fmt(d1)} mm: ${txt1}`, tol1, "mm", `${OR_REF_ISO1} Tab. A.2, Tab. 1 bis 6 (B-or23)`));
  const row2 = csTolRow(r, d2, cls, d1);
  let tol2: number | null = size ? (cls === "A" ? size.d2_tol_a_mm : size.d2_tol_b_mm) : row2 ? row2.tol_mm : null;
  let txt2 = size ? `Normzeile: ±${fmt(tol2)} mm` : row2 ? `Tab. A.1 (${row2.d2_min_incl ? "" : "über "}${fmt(row2.d2_min_mm)} bis ${fmt(row2.d2_max_mm)} mm, Klasse ${cls}): ±${fmt(row2.tol_mm)} mm` : "Tab. A.1: keine Zeile";
  if (tolD2 !== null) { txt2 = `von Hand ±${fmt(tolD2)} mm (Norm: ${txt2})`; tol2 = tolD2; }
  if (tol2 === null) return { d1, d2, tol1, tol2: NaN, size, steps, error: `d₂ = ${fmt(d2)} mm außerhalb ISO 3601-1 Tab. A.1 (0,80 bis 14 mm, d₁ bis 660 mm ab 8,4 mm); Toleranz von Hand eingeben` };
  steps.push(step("OR-TOLD2", "Toleranz d₂", "Normzeile, sonst Tab. A.1 (Klasse A bzw. B)", `d₂ = ${fmt(d2)} mm: ${txt2}`, tol2, "mm", `${OR_REF_ISO1} Tab. A.1, Tab. 1 bis 6`));
  return { d1, d2, tol1, tol2, size, steps, error: null };
}
