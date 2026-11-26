/**
 * Modul chemie (Präfix CH, Werkzeug Chemiewerk): Konstanten und unveränderliche Elementfakten.
 * Konstanten CODATA 2022 (NIST SP 961, Mai 2024), m(¹H) aus AME2020. Elementsymbole nach IUPAC (118 Elemente).
 * Veränderliche Elementdaten (Atomgewicht, Elektronegativität, übliche Oxidationszahlen) kommen als Tabelle von außen (ChTable).
 */

/** Avogadro-Konstante [1/mol], exakt (SI 2019). */
export const N_A = 6.02214076e23;
/** Boltzmann-Konstante [J/K], exakt (SI 2019). */
export const K_B = 1.380649e-23;
/** Molare Gaskonstante R = N_A · k [J/(mol·K)], exakt. */
export const R_GAS = N_A * K_B;
/** Molare Massenkonstante M_u [kg/mol], Konvention 1 g/mol (CH-E3; CODATA 2022: 0,999 999 999 65 g/mol). */
export const M_U = 1e-3;
/** Atomare Masseneinheit m_u [kg], CODATA 2022. */
export const M_U_KG = 1.66053906892e-27;
/** Energieäquivalent m_u c² [MeV], CODATA 2022. */
export const MUC2_MEV = 931.49410372;
/** Neutronenmasse [u], CODATA 2022. */
export const M_NEUTRON_U = 1.00866491606;
/** Atommasse ¹H [u], AME2020. */
export const M_H1_U = 1.007825031898;
/** 1 MeV in J (Elementarladung exakt). */
export const MEV_J = 1.602176634e-13;
/** Normzustand DIN 1343. */
export const T_NORM_K = 273.15;
export const P_NORM_PA = 101325;
/** Molares Normvolumen V_m,n = R · T_n / p_n [m³/mol] (CH-E5). */
export const VM_NORM = (R_GAS * T_NORM_K) / P_NORM_PA;
/** Julianisches Jahr [s]. */
export const YEAR_S = 365.25 * 86400;

/** Grenzen (Abschn. 3 Konzept). */
export const CH_LIMITS = { species: 12, elements: 20, coefficient: 1e9, depth: 6 } as const;

/** Elementsymbole nach Ordnungszahl (Index 0 = Z 1). */
export const SYMBOLS: readonly string[] = [
  "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
  "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
  "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd",
  "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
  "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th", "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm",
  "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds", "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og",
];
const Z_OF = new Map(SYMBOLS.map((s, i) => [s, i + 1] as const));
/** Ordnungszahl eines Symbols oder null. */
export function zOf(symbol: string): number | null { return Z_OF.get(symbol) ?? null; }
export function isSymbol(s: string): boolean { return Z_OF.has(s); }

/** Alkalimetalle (Gruppe 1 ohne H) und Erdalkalimetalle (Gruppe 2), Regelrang 2 (CH-O03). */
export const ALKALI: ReadonlySet<string> = new Set(["Li", "Na", "K", "Rb", "Cs", "Fr"]);
export const ALKALINE_EARTH: ReadonlySet<string> = new Set(["Be", "Mg", "Ca", "Sr", "Ba", "Ra"]);
/** Halogene mit Regel −1 (Rang 5), nur wenn elektronegativstes Element der Spezies. */
export const HALOGENS_RULE: ReadonlySet<string> = new Set(["Cl", "Br", "I"]);
/** Nichtmetalle und Halbmetalle (IUPAC-Gebrauch); alle übrigen gelten als Metall (CH-V05). */
export const NON_METALS: ReadonlySet<string> = new Set(["H", "He", "B", "C", "N", "O", "F", "Ne", "Si", "P", "S", "Cl", "Ar", "Ge", "As", "Se", "Br", "Kr", "Sb", "Te", "I", "Xe", "At", "Rn", "Ts", "Og"]);
/** Standardform der Elemente für Bildungsgleichungen (CH-V04); nicht genannt = einatomig. */
export const ELEMENT_FORM: Readonly<Record<string, string>> = { H: "H2", N: "N2", O: "O2", F: "F2", Cl: "Cl2", Br: "Br2", I: "I2", P: "P4", S: "S8" };
/** Hydride, bei denen das Element vor H steht (CH-V03): NH3, CH4, SiH4, PH3, BH3. */
export const HYDRIDE_ELEMENT_FIRST: ReadonlySet<string> = new Set(["B", "C", "Si", "Ge", "N", "P", "As", "Sb"]);

/** Veränderliche Elementdaten (aus dem Abzug ch_elements, Version beim Aufrufer). */
export interface ChElement {
  symbol: string;
  z: number;
  /** Standardatomgewicht bzw. konventioneller Wert [u]; ohne Standardatomgewicht: Masse des langlebigsten Isotops (CH-E4). */
  atomicMass_u: number | null;
  /** Hinweis zum Atomgewicht (Intervall, kein Standardatomgewicht). */
  massNote: string | null;
  /** Pauling, dimensionslos. */
  electronegativity: number | null;
  /** Übliche Oxidationszahlen. */
  oxCommon: readonly number[];
  /** Aggregatzustand bei 298,15 K. */
  state298: "s" | "l" | "g" | null;
}
export type ChTable = ReadonlyMap<string, ChElement>;

/** Tabelle aus Zeilen im Format des Abzugs (ch_elements). */
export function chTable(rows: ReadonlyArray<{ symbol: string; z: number; atomic_mass_u: number | null; atomic_mass_note?: string | null; electronegativity: number | null; oxidation_states_common?: readonly number[] | null; state_298?: string | null }>): ChTable {
  const m = new Map<string, ChElement>();
  for (const r of rows) {
    const st = r.state_298 === "s" || r.state_298 === "l" || r.state_298 === "g" ? r.state_298 : null;
    m.set(r.symbol, { symbol: r.symbol, z: r.z, atomicMass_u: r.atomic_mass_u, massNote: r.atomic_mass_note ?? null, electronegativity: r.electronegativity, oxCommon: [...(r.oxidation_states_common ?? [])], state298: st });
  }
  return m;
}
