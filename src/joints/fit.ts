/**
 * ISO-Passung im Einheitsbohrungssystem für den Pressverband (Modul verbindungen, eng-core 0.17.0, P4, P5, Abschn. 7a).
 * Bohrung H: EI = 0, ES = IT (ISO 286-1 Tab. 1, 2); Welle p bis z: ei = Grundabmaß (Tab. 5), es = ei + IT.
 * Höchstübermaß U_g = A_oI − A_uA, Mindestübermaß U_k = A_uI − A_oA (DIN 7190-1 Gl. (4), (5)).
 * Grenzen: Nennmaß 0 < D ≤ 500 mm, Grad 1 bis 11, keine Δ-Werte, keine anderen Felder. Abmaße intern in mm, Daten in µm.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { SHAFT_FIELDS, itRow, itUm, shaftDevRow, type PvRepo, type ShaftField } from "./pvData";

export const REF_ISO = "ISO 286-1:2019 (Q236)";
export const REF_DIN = "DIN 7190-1:2017 (Q235)";
export const REF_ROLOFF = "Roloff/Matek 27 (Q219)";
/** Bohrungsgrade und Wellengrade des Passungsvorschlags (P5). */
export const SELECT_HOLE_GRADES = [6, 7, 8] as const;
export const SELECT_SHAFT_GRADES = [5, 6, 7, 8] as const;
/** Bevorzugte ISO-Paarungen Bohrung/Welle (Roloff S. 446): H6/5, H7/6, H8/7, H8/8. */
export const ISO_PAIRS: ReadonlyArray<readonly [number, number]> = [[6, 5], [7, 6], [8, 7], [8, 8]];
/** Relative Toleranz der Grenzvergleiche (O-pv2, Befund B3). */
export const PV_REL_TOL = 1e-9;

export interface FitSpecIso { kind: "iso"; hole: number; field: ShaftField; grade: number }
export interface FitLimits { label: string; EI: number; ES: number; ei: number; es: number; Uk: number; Ug: number }

/** Kurzzeichen wie „H7/s6“. */
export const fitLabel = (f: { hole: number; field: string; grade: number }): string => `H${f.hole}/${f.field}${f.grade}`;

/** Grenzabmaße und Übermaße einer ISO-Passung in mm oder eine Fehlermeldung. */
export function fitLimits(fd: PvRepo, D: number, f: FitSpecIso): FitLimits | string {
  if (!(D > 0 && D <= 500)) return `ISO-Passung nur für 0 < D_F ≤ 500 mm (D_F = ${fmt(D)} mm); Übermaß von Hand eingeben.`;
  const ith = itUm(fd, D, f.hole), its = itUm(fd, D, f.grade), row = shaftDevRow(fd, D);
  if (ith === null || its === null) return `Toleranzgrad außerhalb IT1 bis IT11 (H${f.hole}, ${f.field}${f.grade}).`;
  if (!row) return "Grundabmaße fehlen in den Fachdaten (fd 1.2).";
  const ei = row[f.field];
  if (ei === null) return `Grundabmaß ${f.field} ist für ${fmt(row.d_over_mm)} < D ≤ ${fmt(row.d_to_mm)} mm nicht definiert (ISO 286-1 Tab. 5).`;
  const ES = ith / 1e3, eim = ei / 1e3, es = (ei + its) / 1e3;
  return { label: fitLabel(f), EI: 0, ES, ei: eim, es, Uk: eim - ES, Ug: es };
}

/** Rechenschritte PV-FIT-H, PV-FIT-W, PV-UG, PV-UK einer ISO-Passung (Abmaße in µm im Text, Werte in mm). */
export function fitSteps(fd: PvRepo, D: number, f: FitSpecIso, L: FitLimits): CalcStep[] {
  const r = itRow(fd, D)!, rng = `${fmt(r.d_over_mm)} < D ≤ ${fmt(r.d_to_mm)} mm`, um = (x: number) => fmt(x * 1e3);
  return [
    step("PV-FIT-H", `Grenzabmaße Bohrung H${f.hole}`, "EI = 0, ES = IT(D_F, Grad)", `EI = 0; ES = IT${f.hole}(${rng}) = ${um(L.ES)} µm`, L.ES, "mm", `${REF_ISO} Tab. 1, 2`),
    step("PV-FIT-W", `Grenzabmaße Welle ${f.field}${f.grade}`, "ei = Grundabmaß(D_F, Feld); es = ei + IT(D_F, Grad)", `ei = ${um(L.ei)} µm (${f.field}); es = ${um(L.ei)} + IT${f.grade} ${um(L.es - L.ei)} = ${um(L.es)} µm`, L.ei, "mm", `${REF_ISO} Tab. 1, 5`),
    step("PV-UG", "Höchstübermaß", "U_g = A_oI − A_uA", `U_g = ${um(L.es)} − ${um(L.EI)} = ${um(L.Ug)} µm`, L.Ug, "mm", `${REF_DIN} Gl. (4)`),
    step("PV-UK", "Mindestübermaß", "U_k = A_uI − A_oA", `U_k = ${um(L.ei)} − ${um(L.ES)} = ${um(L.Uk)} µm`, L.Uk, "mm", `${REF_DIN} Gl. (5)`),
  ];
}

export interface FitCandidate extends FitSpecIso { label: string; Uk: number; Ug: number; /** Abstand der Mitten in mm */ dist: number; iso: boolean }

/**
 * Passungsvorschlag (PV-FIT-SEL, P5): alle H6 bis H8 × p bis z × Grad 5 bis 8 mit U_k ≥ Ü_u und U_g ≤ Ü_o (relative
 * Toleranz 10⁻⁹), sortiert nach dem Abstand der Mitten (U_k + U_g)/2 zu (Ü_u + Ü_o)/2, bei Gleichstand nach Bohrung,
 * Feld, Grad. Werte in mm.
 */
export function selectFits(fd: PvRepo, D: number, Uu: number, Uo: number): FitCandidate[] {
  const out: FitCandidate[] = [], mid = (Uu + Uo) / 2, tol = PV_REL_TOL * Math.max(Math.abs(Uu), Math.abs(Uo), 1e-12);
  if (!(D > 0 && D <= 500) || !(Uo > Uu)) return out;
  for (const hole of SELECT_HOLE_GRADES) for (const field of SHAFT_FIELDS) for (const grade of SELECT_SHAFT_GRADES) {
    const L = fitLimits(fd, D, { kind: "iso", hole, field, grade });
    if (typeof L === "string") continue;
    if (L.Uk >= Uu - tol && L.Ug <= Uo + tol)
      out.push({ kind: "iso", hole, field, grade, label: L.label, Uk: L.Uk, Ug: L.Ug, dist: Math.abs((L.Uk + L.Ug) / 2 - mid), iso: ISO_PAIRS.some(([h, s]) => h === hole && s === grade) });
  }
  const fo = (f: string) => SHAFT_FIELDS.indexOf(f as ShaftField);
  return out.sort((a, b) => a.dist - b.dist || a.hole - b.hole || fo(a.field) - fo(b.field) || a.grade - b.grade);
}

export function fitSelectStep(D: number, Uu: number, Uo: number, list: readonly FitCandidate[]): CalcStep {
  const um = (x: number) => fmt(x * 1e3);
  const top = list.slice(0, 3).map((c) => `${c.label}${c.iso ? " (ISO-Paarung)" : ""} ${um(c.Uk)} bis ${um(c.Ug)} µm`).join("; ");
  return step("PV-FIT-SEL", "Zulässige Passungen", "H6 bis H8 × p bis z × IT5 bis IT8 mit U_k ≥ Ü_u und U_g ≤ Ü_o, sortiert nach |(U_k + U_g)/2 − (Ü_u + Ü_o)/2|",
    `D_F ${fmt(D)} mm, Ü_u ${um(Uu)} µm, Ü_o ${um(Uo)} µm: ${list.length} Passungen${top ? `; ${top}` : ""}`, list.length, "1", `${REF_ROLOFF} S. 446, Bild 12.17; Verfahren`);
}

// ---------------------------------------------------------------- Passungstafel (Abschn. 7a, nur Zahlen, Zeichnung in src/viz der App)
export const HOLE_ORDER = ["A", "B", "C", "CD", "D", "E", "EF", "F", "FG", "G", "H", "JS", "J", "K", "M", "N", "P", "R", "S", "T", "U", "V", "X", "Y", "Z", "ZA", "ZB", "ZC"] as const;
export const SHAFT_ORDER = HOLE_ORDER.map((h) => h.toLowerCase());
export interface Passungstafel {
  D: number;
  /** Nennmaßbereich der IT-Zeile in mm, null ohne Daten */
  range: [number, number] | null;
  /** T1: IT1 bis IT11 in µm, gewählte Grade markiert */
  it: Array<{ grade: number; um: number; hole: boolean; shaft: boolean }>;
  /** T2: schematisches Lagebild (ISO 286-1 Bild 8, 9), nutzbar nur H und p bis z */
  lage: { holes: Array<{ name: string; usable: boolean }>; shafts: Array<{ name: string; usable: boolean }> };
  /** T3: Felder in µm über der Nulllinie, U_k und U_g, Band Ü_u bis Ü_o und zulässige Passungen (Aufgabe B) */
  fit: { label: string; hole: [number, number]; shaft: [number, number]; Uk: number; Ug: number } | null;
  band: [number, number] | null;
  candidates: Array<{ label: string; Uk: number; Ug: number; iso: boolean }>;
}

/** Zahlen der Passungstafel (Werte in µm); Rechnung bleibt im Kern, die App zeichnet nur. */
export function passungstafel(fd: PvRepo, D: number, sel: FitSpecIso | null, band: { Uu: number; Uo: number } | null = null, candidates: readonly FitCandidate[] = []): Passungstafel {
  const row = itRow(fd, D);
  const it = row ? Array.from({ length: 11 }, (_, i) => ({ grade: i + 1, um: itUm(fd, D, i + 1)!, hole: sel?.hole === i + 1, shaft: sel?.grade === i + 1 })) : [];
  const L = sel ? fitLimits(fd, D, sel) : null;
  const u = (x: number) => x * 1e3;
  // µm direkt aus den Fachdaten (ganze bzw. gedruckte Zahlen ohne Rundungsrest)
  const dev = sel ? shaftDevRow(fd, D)?.[sel.field] ?? null : null, ih = sel ? itUm(fd, D, sel.hole) : null, is = sel ? itUm(fd, D, sel.grade) : null;
  return {
    D, range: row ? [row.d_over_mm, row.d_to_mm] : null, it,
    lage: { holes: HOLE_ORDER.map((n) => ({ name: n, usable: n === "H" })), shafts: SHAFT_ORDER.map((n) => ({ name: n, usable: (SHAFT_FIELDS as readonly string[]).includes(n) })) },
    fit: L && typeof L !== "string" && dev !== null && ih !== null && is !== null ? { label: L.label, hole: [0, ih], shaft: [dev, dev + is], Uk: dev - ih, Ug: dev + is } : null,
    band: band ? [u(band.Uu), u(band.Uo)] : null,
    candidates: candidates.map((c) => ({ label: c.label, Uk: u(c.Uk), Ug: u(c.Ug), iso: c.iso })),
  };
}
