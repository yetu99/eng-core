/**
 * Prüf- und Katalogfälle O-Ring (Modul dichtungen, eng-core 0.20.0), Konzept fachtools/konzept_or.md Abschn. 6.
 * Gemeinsam genutzt von scripts/katalog.ts, verification/dichtungen.py (über or_faelle.json, engine_out/eval) und test/oring.test.ts.
 * Literaturfälle mit den Eingaben der Quelle (Toleranzen von Hand, wo die Quelle eigene Werte nutzt), dazu Fälle für alle Einbaufälle,
 * Optionen und Fehler. Einheiten mm, MPa (p), °C.
 */
import type { OringInput, OrDim } from "../src/index";

export const dim = (nom: number, fit: string | null = null, dev: [number, number] | null = null): OrDim => (dev ? { nom, fit, dev } : { nom, fit });
export const orBase = (o: Partial<OringInput>): OringInput => ({
  task: "A", install: "kolben", motion: "statisch", ring: { size: null, d1: null, d2: null, cls: "B", tolD1: null, tolD2: null, sorte: "N" },
  d4: null, d3: null, d9: null, d5: null, d6: null, d10: null, d7: null, d8: null, h: null, b: null, e: 0, depth: "konzentrisch", gap: "worst", gFlange: null,
  backup: 0, pressureBoth: false, dM: null, p: 0, material: null, shore: null, medium: null, Tmin: null, Tmax: null, pulsating: false, temp: null, swell: null, design: null, ...o,
});
const frei = (d1: number, d2: number, cls: "A" | "B" = "A", tolD1: number | null = null, tolD2: number | null = null) => ({ size: null, d1, d2, cls, tolD1, tolD2, sorte: "N" as const });
const norm = (size: string, cls: "A" | "B" = "B", sorte: "N" | "S" | "CS" = "N") => ({ size, d1: null, d2: null, cls, tolD1: null, tolD2: null, sorte });

/** Parker 8.24 (S. 114 bis 116): Kolben Hydraulik dynamisch, d₁ 11,89 ± 0,19, d₂ 1,78 ± 0,08, d₃ 12,20 h9, d₄ 15,00 H8, d₉ 15,00 f7. */
const P1 = (o: Partial<OringInput>) => orBase({ motion: "hydraulik", ring: frei(11.89, 1.78, "A", 0.19, 0.08), d3: dim(12.2, "h9"), d4: dim(15, "H8"), d9: dim(15, "f7"), p: 10, material: "NBR", medium: "HLP", Tmin: -20, Tmax: 80, ...o });

export interface OrFall { id: string; label: string; inp: OringInput }
export const orFaelle: OrFall[] = [
  { id: "P-OR4N", label: "ISO 3601-2 Anhang B.3.8 Nachrechnen: 33 × 3,53 Klasse A, d₅ 34 f7, d₆ 39,48 H9, d₁₀ 34 H8, b 5,0 +0,25, dynamisch Hydraulik, NBR in HLP, −20 bis 80 °C", inp: orBase({ install: "stange", motion: "hydraulik", ring: frei(33, 3.53, "A"), d5: dim(34, "f7"), d6: dim(39.48, "H9"), d10: dim(34, "H8"), b: dim(5, null, [0, 0.25]), p: 10, material: "NBR", medium: "HLP", Tmin: -20, Tmax: 80 }) },
  { id: "P-OR1A", label: "Parker 8.24 A: Kolben Hydraulik dynamisch, d₁ 11,89 ± 0,19, d₂ 1,78 ± 0,08, d₃ 12,20 h9, d₄ 15,00 H8, d₉ 15,00 f7, konzentrisch, NBR in HLP, −20 bis 80 °C, 100 bar", inp: P1({}) },
  { id: "P-OR1B", label: "Parker 8.24 B: wie A mit Radialspiel (Kolben anliegend, Worst Case d₉min, B-or3)", inp: P1({ depth: "radialspiel" }) },
  { id: "P-OR1C", label: "Parker 8.24 C: wie B mit Exzentrizität e = 0,05 mm, Spalt geführt", inp: P1({ depth: "radialspiel", e: 0.05, gap: "gefuehrt" }) },
  { id: "P-OR3", label: "ISO 3601-2 Anhang B.2 Auslegung: Kolben statisch, d₄ 123 H8, d₉ 123 f7, C_nom 20 %, Klasse A", inp: orBase({ task: "B", d4: dim(123, "H8"), d9: dim(123, "f7"), ring: norm("", "A"), design: { C: 20, d2: null } }) },
  { id: "P-OR3N", label: "ISO 3601-2 Anhang B.2.8 Nachrechnen: 111,41 × 5,33 Klasse A, d₃ 114,46 h9 (B-or6), d₄ 123 H8, d₉ 123 f7, b 7,2 +0,25", inp: orBase({ ring: frei(111.41, 5.33, "A"), d3: dim(114.46, "h9"), d4: dim(123, "H8"), d9: dim(123, "f7"), b: dim(7.2, null, [0, 0.25]) }) },
  { id: "P-OR4", label: "ISO 3601-2 Anhang B.3 Auslegung: Stange Ø34 f7, d₁₀ 34 H8, dynamisch Hydraulik, C_max 22 %, Klasse A", inp: orBase({ task: "B", install: "stange", motion: "hydraulik", d5: dim(34, "f7"), d10: dim(34, "H8"), ring: norm("", "A"), design: { C: 22, d2: null }, p: 10, material: "NBR" }) },
  { id: "P-OR9A", label: "Spalt TB 19-3: Kolben Hydraulik Ø50 H8/f7, d₃ 43,9 h9, 42,52 × 3,53 Klasse B, NBR 70 Shore A, 100 bar, Worst Case (Stützring nötig)", inp: orBase({ motion: "hydraulik", ring: frei(42.52, 3.53, "B"), d4: dim(50, "H8"), d9: dim(50, "f7"), d3: dim(43.9, "h9"), p: 10, material: "NBR" }) },
  { id: "P-OR9B", label: "Spalt TB 19-3: wie P-OR9A, geführt mit e = 0", inp: orBase({ motion: "hydraulik", ring: frei(42.52, 3.53, "B"), d4: dim(50, "H8"), d9: dim(50, "f7"), d3: dim(43.9, "h9"), p: 10, material: "NBR", gap: "gefuehrt" }) },
  { id: "P-OR9C", label: "Spalt TB 19-3: wie P-OR9A mit 90 Shore A von Hand", inp: orBase({ motion: "hydraulik", ring: frei(42.52, 3.53, "B"), d4: dim(50, "H8"), d9: dim(50, "f7"), d3: dim(43.9, "h9"), p: 10, material: "NBR", shore: 90 }) },
  { id: "P-OR9D", label: "Spalt TB 19-3: wie P-OR9A statisch mit VMQ 70 Shore A (Spaltfaktor 0,5), wechselnde Druckrichtung", inp: orBase({ ring: frei(42.52, 3.53, "B"), d4: dim(50, "H8"), d9: dim(50, "f7"), d3: dim(43.9, "h9"), p: 10, material: "VMQ", pressureBoth: true }) },
  { id: "P-OR9E", label: "Spalt TB 19-3: wie P-OR9A mit einem Stützring (Nutbreite b₁ aus Parker Tab. 3.5)", inp: orBase({ motion: "hydraulik", ring: frei(42.52, 3.53, "B"), d4: dim(50, "H8"), d9: dim(50, "f7"), d3: dim(43.9, "h9"), p: 10, material: "NBR", backup: 1 }) },
  { id: "P-OR15", label: "Stange statisch mit Radialspiel und Exzentrizität: Normring 211 Klasse B (20,22 × 3,53), d₅ 20,6 f7, d₆ 26,2 H9, d₁₀ 20,6 H8, e 0,02, EPDM, Wasser bis 70 °C, 5 bis 60 °C", inp: orBase({ install: "stange", ring: norm("211", "B", "S"), d5: dim(20.6, "f7"), d6: dim(26.2, "H9"), d10: dim(20.6, "H8"), depth: "radialspiel", e: 0.02, p: 5, material: "EPDM", medium: "WASSER70", Tmin: 5, Tmax: 60 }) },
  { id: "P-OR16", label: "Flansch bei Innendruck, Auslegung: d₇ 59,1 H11, d₂ 3,53, Klasse B, FKM, Mineralöl, −20 bis 150 °C, 50 bar", inp: orBase({ task: "B", install: "flansch_innen", d7: dim(59.1, "H11"), ring: norm("", "B"), design: { C: null, d2: 3.53 }, p: 5, material: "FKM", medium: "MINOEL", Tmin: -20, Tmax: 150 }) },
  { id: "P-OR17", label: "Flansch bei Außendruck: Normring 125 Klasse B (32,99 × 2,62), d₈ 33,8 h11, h 1,9 +0,05, Vakuum außen 1 bar, NBR, Luft 100 °C, Spalt 0,02 mm", inp: orBase({ install: "flansch_aussen", ring: norm("125", "B"), d8: dim(33.8, "h11"), h: dim(1.9, null, [0, 0.05]), p: 0.1, material: "NBR", medium: "LUFT100", Tmin: -10, Tmax: 80, gFlange: 0.02 }) },
  { id: "P-OR18", label: "Optionen: Kolben statisch, Normring 011 Klasse A (7,65 × 1,78), d₄ 10,4 H8, d₃ 7,95 h9, d₉ 10,4 f7, b 2,6 +0,2, NBR in HLP, −20 bis 90 °C, Temperatur α_B 12·10⁻⁶/K, Quellung 8 %, pulsierend", inp: orBase({ ring: norm("011", "A", "S"), d4: dim(10.4, "H8"), d3: dim(7.95, "h9"), d9: dim(10.4, "f7"), b: dim(2.6, null, [0, 0.2]), p: 16, material: "NBR", medium: "HLP", Tmin: -20, Tmax: 90, temp: { alphaB: 12 }, swell: { dV: 8 }, pulsating: true }) },
  { id: "P-OR19", label: "Kolben Pneumatik, Auslegung: d₄ 40 H8, d₉ 40 f7, C 15 %, Klasse B, NBR, Luft, 10 bar, Montage über d₉", inp: orBase({ task: "B", motion: "pneumatik", d4: dim(40, "H8"), d9: dim(40, "f7"), ring: norm("", "B"), design: { C: 15, d2: null }, p: 1, material: "NBR", medium: "LUFT100", Tmin: -10, Tmax: 80 }) },
  { id: "P-OR20", label: "Grenzfall Nutfüllung: wie P-OR18 ohne Optionen mit b 2,515 +0,2 (F_max knapp über 85 %)", inp: orBase({ ring: norm("011", "A", "S"), d4: dim(10.4, "H8"), d3: dim(7.95, "h9"), d9: dim(10.4, "f7"), b: dim(2.515, null, [0, 0.2]), p: 16, material: "NBR", medium: "HLP", Tmin: -20, Tmax: 90 }) },
  { id: "P-OR21", label: "Kleine Schnurstärke: Kolben statisch, 10 × 1,5 Klasse B, d₄ 12,4 H8, d₃ 10,2 h9, d₉ 12,4 f7, 100 bar (TB 19-3 erst ab 1,78 mm: Spalt nicht bewertbar)", inp: orBase({ ring: frei(10, 1.5, "B"), d4: dim(12.4, "H8"), d3: dim(10.2, "h9"), d9: dim(12.4, "f7"), b: dim(2.1, null, [0, 0.2]), p: 10, material: "NBR" }) },
];

/** Fehlerfälle P-OR14: jeder Fall muss mindestens einen Fehlertext liefern (Hinweisfall b ≤ d₂ nur als Warnung). */
export const orFehlerfaelle: OrFall[] = [
  { id: "P-OR14a", label: "d₂ ≤ 0", inp: orBase({ ring: frei(20, 0), d4: dim(26, "H8"), d3: dim(21, "h9") }) },
  { id: "P-OR14b", label: "d₁ ≤ 0", inp: orBase({ ring: frei(0, 3.53), d4: dim(26, "H8"), d3: dim(21, "h9") }) },
  { id: "P-OR14c", label: "t ≥ d₂ (keine Verpressung)", inp: orBase({ ring: frei(20, 2.62), d4: dim(26, "H8"), d3: dim(20.5, "h9") }) },
  { id: "P-OR14d", label: "t ≤ 0", inp: orBase({ ring: frei(20, 2.62), d4: dim(26, "H8"), d3: dim(26, "h9") }) },
  { id: "P-OR14e", label: "S ≥ 25 %", inp: orBase({ ring: frei(16, 3.53), d4: dim(27.6, "H8"), d3: dim(21.6, "h9") }) },
  { id: "P-OR14f", label: "Druck < 0", inp: orBase({ ring: frei(20.22, 3.53), d4: dim(26, "H8"), d3: dim(20.4, "h9"), p: -1 }) },
  { id: "P-OR14g", label: "T_min > T_max", inp: orBase({ ring: frei(20.22, 3.53), d4: dim(26, "H8"), d3: dim(20.4, "h9"), Tmin: 80, Tmax: 20 }) },
  { id: "P-OR14h", label: "unbekanntes Medium", inp: orBase({ ring: frei(20.22, 3.53), d4: dim(26, "H8"), d3: dim(20.4, "h9"), medium: "XYZ" }) },
  { id: "P-OR14i", label: "Passung außerhalb 500 mm", inp: orBase({ ring: frei(590, 6.99), d4: dim(605, "H8"), d3: dim(593, "h9") }) },
  { id: "P-OR14j", label: "Klasse A ohne Normzeile über 1 320,80 mm", inp: orBase({ ring: frei(1400, 6.99, "A"), d4: dim(1412, null), d3: dim(1402, null) }) },
  { id: "P-OR14k", label: "b ≤ d₂ (Nut zu schmal, nur Hinweis)", inp: orBase({ ring: frei(20.22, 3.53), d4: dim(26, "H8"), d3: dim(20.4, "h9"), b: dim(3.5) }) },
  { id: "P-OR14l", label: "Flansch dynamisch", inp: orBase({ install: "flansch_innen", motion: "hydraulik", ring: frei(50, 3.53), d7: dim(57, "H11") }) },
  { id: "P-OR14m", label: "unbekanntes Elastomer", inp: orBase({ ring: frei(20.22, 3.53), d4: dim(26, "H8"), d3: dim(20.4, "h9"), material: "XYZ" }) },
];
