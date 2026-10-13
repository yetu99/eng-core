/** Kataloge der Belastungsarten und Lastfälle (Blatt 1). PB = Druckbehälter (eng-core 0.6.0), FQ = Eigenfrequenz (0.6.1). */
import { PRESSURE_CASES } from "./pressure";
import { VIBRATION_CASES } from "./vibration";

export type Kind = "zug" | "druck" | "biegung" | "torsion" | "PB" | "FQ";
export type Support = "fix" | "pin" | "roller" | "free";

export interface BendingCase { label: string; short: string; supports: readonly [Support, Support]; load: "F" | "q" | "F2" | "list"; euler: 1 | 2 | 3 | 4; ref: string }
export interface SimpleCase { label: string; short: string }
export interface BucklingCase extends SimpleCase { beta: number; top: Support; bot: Support }

export const BENDING_CASES = {
  KE: { label: "Kragträger, Einzellast am Ende", short: "Krag · F", supports: ["fix", "free"], load: "F", euler: 1, ref: "Ashby App. A.3; Roark Tab. 8.1 Fall 1a" },
  KQ: { label: "Kragträger, Streckenlast", short: "Krag · q", supports: ["fix", "free"], load: "q", euler: 1, ref: "Ashby App. A.3; Roark Tab. 8.1 Fall 2a" },
  EE: { label: "2-Punkt-Lagerung, Einzellast mittig", short: "2-Punkt · F", supports: ["pin", "roller"], load: "F", euler: 2, ref: "Ashby App. A.3; Roark Tab. 8.1 Fall 1e" },
  EQ: { label: "2-Punkt-Lagerung, Streckenlast", short: "2-Punkt · q", supports: ["pin", "roller"], load: "q", euler: 2, ref: "Ashby App. A.3; Roark Tab. 8.1 Fall 2e" },
  E4: { label: "4-Punkt-Biegung, 2 × F im Abstand a", short: "4-Punkt · 2F", supports: ["pin", "roller"], load: "F2", euler: 2, ref: "Roark Tab. 8.1 Fall 1e, Superposition" },
  BQ: { label: "Beidseitig eingespannt, Streckenlast", short: "Eingesp. · q", supports: ["fix", "fix"], load: "q", euler: 4, ref: "Ashby App. A.3; Roark Tab. 8.1 Fall 2d" },
} as const satisfies Record<string, BendingCase>;
export type BendingCaseId = keyof typeof BENDING_CASES;

export const TENSION_CASES = {
  Z1: { label: "Zugstab, Einzelkraft am Ende", short: "Einzelkraft" },
  Z2: { label: "Hängender Stab, Eigengewicht und Endlast", short: "Eigengewicht + F" },
} as const satisfies Record<string, SimpleCase>;

export const BUCKLING_CASES = {
  K1: { label: "Eulerfall 1: unten eingespannt, oben frei", short: "Fall 1 · β = 2", beta: 2, top: "free", bot: "fix" },
  K2: { label: "Eulerfall 2: beidseitig gelenkig", short: "Fall 2 · β = 1", beta: 1, top: "pin", bot: "pin" },
  K3: { label: "Eulerfall 3: eingespannt, gelenkig", short: "Fall 3 · β = 0,7", beta: 0.699, top: "pin", bot: "fix" },
  K4: { label: "Eulerfall 4: beidseitig eingespannt", short: "Fall 4 · β = 0,5", beta: 0.5, top: "fix", bot: "fix" },
} as const satisfies Record<string, BucklingCase>;
export type BucklingCaseId = keyof typeof BUCKLING_CASES;

export const TORSION_CASES = {
  T1: { label: "Einseitig eingespannt, Moment am freien Ende", short: "Einspannung · T" },
  T2: { label: "Beidseitig eingespannt, Moment mittig", short: "Beidseitig · T mittig" },
} as const satisfies Record<string, SimpleCase>;

export const KINDS: Readonly<Record<Kind, { label: string; cases: Readonly<Record<string, SimpleCase>>; def: string }>> = {
  zug: { label: "Zug", cases: TENSION_CASES, def: "Z1" },
  druck: { label: "Druck / Knicken", cases: BUCKLING_CASES, def: "K2" },
  biegung: { label: "Biegung", cases: BENDING_CASES, def: "EQ" },
  torsion: { label: "Torsion", cases: TORSION_CASES, def: "T1" },
  PB: { label: "Druckbehälter", cases: PRESSURE_CASES, def: "ZG" },
  FQ: { label: "Eigenfrequenz", cases: VIBRATION_CASES, def: "GG" },
};

/** Knicklängenbeiwert β je Eulerfall. Fall 3 mit dem exakten Wert 0,699. */
export const EULER_BETA: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 2, 2: 1, 3: 0.699, 4: 0.5 };

export const OUTLOOK_V2: readonly string[] = ["Kerbwirkung", "Ermüdung", "Durchlaufträger", "Offene Profile (I, U, L)", "Biegedrillknicken", "Schiefe Biegung", "Kontaktspannung (Hertz)", "Schraubenverbindung"];

export function isBendingCase(id: string): id is BendingCaseId { return id in BENDING_CASES; }
export function isBucklingCase(id: string): id is BucklingCaseId { return id in BUCKLING_CASES; }

/** Bezeichnung eines Lastfalls für Überschriften und Bildunterschriften. */
export function caseLabel(mode: "single" | "combined", kind: Kind, sub: string): string {
  if (sub === "LL" && (mode === "combined" || kind === "biegung")) return "Lastliste";
  if (mode === "combined") return sub === "none" ? "Ohne Querlast" : isBendingCase(sub) ? BENDING_CASES[sub].label : "–";
  return KINDS[kind].cases[sub]?.label ?? "–";
}
