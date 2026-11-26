/**
 * Beispielfälle Modul chemie (Werkzeug Chemiewerk) für den Formelkatalog (scripts/katalog.ts) und die Tests.
 * Elementdaten aus test/fixtures/ch_snapshot.json (Abzug Chemiewerk ch-2026-11-25a). Literatur- und Konzeptfälle zuerst;
 * dieselben Fälle rechnet verification/chemie.py unabhängig nach.
 */
import { readFileSync } from "node:fs";
import { chemie as C, type CalcStep } from "../src/index";

interface Snapshot { version: string; elements: Parameters<typeof C.chTable>[0]; isotopes: Array<{ z: number; a: number; symbol: string; mass_u: number; abundance: number | null; half_life_s: number | null }> }
export const CH_SNAPSHOT = JSON.parse(readFileSync(new URL("../test/fixtures/ch_snapshot.json", import.meta.url), "utf8")) as Snapshot;
export const CH_TABLE = C.chTable(CH_SNAPSHOT.elements);
export const iso = (z: number, a: number) => { const r = CH_SNAPSHOT.isotopes.find((i) => i.z === z && i.a === a); if (!r) throw new Error(`Nuklid ${z}/${a} fehlt`); return r; };
export const sp = (l: readonly string[], r: readonly string[]): C.Species[] => [...l.map((f) => ({ formula: f, side: "edukt" as const })), ...r.map((f) => ({ formula: f, side: "produkt" as const }))];

/** Bilanzfälle (Konzept Abschn. 4). */
export const CH_BAL: Array<{ id: string; l: string[]; r: string[]; text: string }> = [
  { id: "CH-PB1", l: ["C3H8", "O2"], r: ["CO2", "H2O"], text: "Propanverbrennung" },
  { id: "CH-PB2", l: ["KMnO4", "HCl"], r: ["KCl", "MnCl2", "Cl2", "H2O"], text: "Kaliumpermanganat und Salzsäure (Mortimer/Müller)" },
  { id: "CH-PB3", l: ["Fe", "Cl2"], r: ["FeCl3"], text: "Eisen(III)-chlorid aus den Elementen" },
  { id: "CH-PB4", l: ["NaOH", "H2SO4"], r: ["Na2SO4", "H2O"], text: "Neutralisation" },
  { id: "CH-PB5", l: ["Fe2O3", "CO"], r: ["Fe", "CO2"], text: "Hochofen, Reduktion von Hämatit" },
  { id: "CH-PB6", l: ["N2", "H2"], r: ["NH3"], text: "Haber-Bosch" },
  { id: "CH-PB7", l: ["CuSO4·5H2O"], r: ["CuSO4", "H2O"], text: "Entwässern von Kupfersulfat-Pentahydrat" },
  { id: "CH-PB8", l: ["MnO4^-", "Fe^2+", "H^+"], r: ["Mn^2+", "Fe^3+", "H2O"], text: "Permanganat und Eisen(II), Ionengleichung" },
  { id: "CH-PB9", l: ["Ca(OH)2", "CO2"], r: ["CaCO3", "H2O"], text: "Kalkwasser und Kohlenstoffdioxid" },
  { id: "CH-FB1", l: ["H2", "O2"], r: ["H2O", "H2O2"], text: "mehrdeutig: Wasser und Wasserstoffperoxid" },
  { id: "CH-FB2", l: ["Fe", "O2"], r: ["FeCl3"], text: "nicht bilanzierbar: Cl fehlt links, O fehlt rechts" },
];
export const CH_REDOX: Array<{ id: string; l: string[]; r: string[]; m: C.RedoxMedium; text: string }> = [
  { id: "CH-PR1", l: ["MnO4^-", "Fe^2+"], r: ["Mn^2+", "Fe^3+"], m: "sauer", text: "Permanganat und Eisen(II), sauer" },
  { id: "CH-PR2", l: ["Cu", "NO3^-"], r: ["Cu^2+", "NO"], m: "sauer", text: "Kupfer in Salpetersäure" },
  { id: "CH-PR3", l: ["MnO4^-", "H2O2"], r: ["Mn^2+", "O2"], m: "sauer", text: "Permanganat und Wasserstoffperoxid (Nullraum mehrdeutig)" },
  { id: "CH-PR4", l: ["Cr2O7^2-", "SO3^2-"], r: ["Cr(OH)3", "SO4^2-"], m: "basisch", text: "Dichromat und Sulfit, basisch" },
  { id: "CH-PR5", l: ["Cl2"], r: ["Cl^-", "ClO^-"], m: "basisch", text: "Disproportionierung von Chlor, basisch" },
  { id: "CH-PR6", l: ["IO3^-", "I^-"], r: ["I2"], m: "sauer", text: "Komproportionierung Iodat und Iodid" },
  { id: "CH-PR7", l: ["H2O2", "Fe^2+"], r: ["Fe^3+"], m: "sauer", text: "Wasserstoffperoxid und Eisen(II), Partner H₂O" },
];
export const CH_OX = ["O2", "Fe^3+", "Fe3O4", "KMnO4", "K2Cr2O7", "H2O2", "NaH", "OF2", "KO2", "S2O3^2-", "NH4^+", "CH4", "C6H12O6", "HClO4", "CuFeS2"];
export const CH_MASS = ["H2O", "CO2", "H2SO4", "Fe3O4", "C6H12O6", "NaCl", "CuSO4·5H2O", "SO4^2-"];
export const CH_COMP: Array<[string, string]> = [["Al", "O"], ["Mg", "N"], ["Na", "Cl"], ["Fe", "O"], ["H", "N"], ["Xe", "F"], ["Fe", "Cu"], ["He", "O"]];
export const CH_NUC: Array<[number, number]> = [[26, 56], [2, 4], [8, 16], [92, 235]];

/** Literaturstelle je Gruppe für Katalog und Freigabe-Excel, wenn der Schritt keine eigene Quelle trägt (Konzept chemie Abschn. Quellen). */
export const CH_REF: Readonly<Record<string, string>> = {
  P: "IUPAC Red Book 2005 IR-4 (Formeln, Ladung), Hill-System",
  M: "IUPAC CIAAW 2021 (Atomgewichte), IUPAC Green Book 3. Aufl.",
  B: "Smith, Missen: Chemical Reaction Equilibrium Analysis Kap. 2 (Formelmatrix, Nullraum)",
  S: "Mortimer, Müller: Chemie (Stöchiometrie), DIN 1343, CODATA 2022",
  O: "IUPAC Red Book 2005 IR-9.1; Riedel, Janiak: Anorganische Chemie",
  R: "Mortimer, Müller: Chemie (Redoxreaktionen, Ionen-Elektronen-Methode)",
  V: "IUPAC Red Book 2005 IR-4.4; Pauling-Elektronegativität (Abzug ch_elements)",
  K: "AME2020, NUBASE2020, CODATA 2022",
};
const withRef = (s: CalcStep): CalcStep => s.ref !== undefined || !s.id.startsWith("CH-") ? s : { ...s, ref: CH_REF[s.id.charAt(3)] ?? "" };

export function chemieFaelle(): Array<{ text: string; steps: CalcStep[] }> {
  const out: Array<{ text: string; steps: CalcStep[] }> = [];
  const push = (text: string, steps: CalcStep[]) => out.push({ text, steps: steps.map(withRef) });
  for (const b of CH_BAL) { const r = C.balance(sp(b.l, b.r)); push(`${b.id} Bilanz ${b.text}: ${r.equation}`, r.steps); }
  { const r = C.balance(sp(["KMnO4", "HCl"], ["KCl", "MnCl2", "Cl2", "H2O"])); const e = C.electronTransfer(sp(["KMnO4", "HCl"], ["KCl", "MnCl2", "Cl2", "H2O"]), r.coefficients, CH_TABLE); push(`CH-PB2 Elektronenbilanz ${r.equation}`, e.steps); }
  for (const f of CH_OX) push(`Oxidationszahlen ${f}`, C.oxidationStates(f, CH_TABLE).steps);
  for (const x of CH_REDOX) { const r = C.redox(sp(x.l, x.r), x.m, CH_TABLE); push(`${x.id} Redox ${x.text}`, r.steps); }
  { const r = C.redox(sp(["KMnO4", "HCl"], ["MnCl2", "Cl2"]), "sauer", CH_TABLE); push("CH-FR1 Redox mit Zuschauerionen (KMnO₄, HCl → MnCl₂, Cl₂): Meldung", r.steps); }
  for (const f of CH_MASS) push(`Molare Masse ${f}`, C.molarMass(f, CH_TABLE).steps);
  for (const f of ["Ca(OH)2", "[Cu(NH3)4]^2+", "Fe^3+(aq)"]) push(`Formel ${f}`, C.parseFormula(f).steps);
  for (const f of ["Fe2+", "Xy2", "Ca(OH2"]) push(`Fehlerfall Formel »${f}«`, C.parseFormula(f).steps);
  // Stöchiometrie: 2 H2 + O2 → 2 H2O, 4 g H2 und 40 g O2; Normzustand, ideales Gas 298,15 K / 10⁵ Pa, Ausbeute 0,85
  const M = (f: string) => C.molarMass(f, CH_TABLE).M;
  const st: C.StoichSpecies[] = [{ label: "H₂", side: "edukt", coefficient: 2, M: M("H2"), gas: true }, { label: "O₂", side: "edukt", coefficient: 1, M: M("O2"), gas: true }, { label: "H₂O", side: "produkt", coefficient: 2, M: M("H2O"), gas: false }];
  push("Stöchiometrie 2 H₂ + O₂ → 2 H₂O, Vorgabe 4 g H₂ und 40 g O₂, Normzustand DIN 1343", C.stoichiometry(st, [{ index: 0, kind: "m", value: 0.004 }, { index: 1, kind: "m", value: 0.04 }]).steps);
  push("Stöchiometrie 2 H₂ + O₂ → 2 H₂O, Vorgabe 1 mol H₂, ideales Gas 298,15 K und 10⁵ Pa, Ausbeute 0,85", C.stoichiometry(st, [{ index: 0, kind: "n", value: 1 }], { mode: "frei", T: 298.15, p: 1e5 }, 0.85).steps);
  push("Ausbeute aus 30 g Ist-Masse und 35,744 g theoretischer Masse", [C.yieldOf(0.03, 0.035744).step]);
  push("Teilchenzahl 1 mol", [C.particles(1).step]);
  for (const [a, b] of CH_COMP) push(`Verbindungsvorschlag ${a} + ${b}`, C.suggestCompound(a, b, CH_TABLE).steps);
  for (const [z, a] of CH_NUC) { const i = iso(z, a); push(`Bindungsenergie ${a}${i.symbol}`, C.bindingEnergy(z, a, i.mass_u).steps); }
  push("Zerfall N_0 = 10²⁰, T½ = 1 h, t = 2 h", C.decay(1e20, 3600, 7200).steps);
  { const c = iso(6, 14); const n = C.atomsFromMass(1e-6, c.mass_u); push("¹⁴C: 1 mg, Aktivität zu Beginn", [n.step, ...C.decay(n.N0, c.half_life_s, 0).steps]); }
  push("¹⁴C: Zeit bis 25 % Restanteil", [C.timeToFraction(0.25, iso(6, 14).half_life_s!).step]);
  { const cl = CH_SNAPSHOT.isotopes.filter((i) => i.z === 17 && i.abundance).map((i) => ({ mass_u: i.mass_u, abundance: i.abundance! })); push("Mittlere Atommasse Chlor aus ³⁵Cl und ³⁷Cl", [C.meanAtomicMass(cl, 35.45).step]); }
  return out;
}
