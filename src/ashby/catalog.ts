/**
 * Indexkatalog nach Ashby (1999), Kap. 5 bis 7 und Anhang B (Tab. B1 bis B6, S. 407 bis 411). Einheiten wie in der Datenbank:
 * E in GPa, σ_f in MPa, ρ in kg/m³, C_m in €/kg, λ in W/(m·K), α in 10⁻⁶/K, c_p in J/(kg·K), K_IC in MPa·m^0,5.
 * Indexwerte sind nur innerhalb einer Auswahl vergleichbar.
 *
 * Zwei Bauarten (0.8.0):
 * - "legacy": M = y^n / x^k mit y ∈ {E, σ_f}. Alle Indizes bis 0.7.0 (IDs, Texte, Werte unverändert) und die neuen
 *   mechanischen Indizes ohne Form (Balken nur Höhe oder nur Breite frei, elastisches Gelenk).
 * - "product": M = Y^a · X^b mit Achsgruppen Y und X als Produkt von Kennwerten (thermische Indizes, Druckbehälter).
 *   Leitlinie im log-log-Diagramm Y über X: Steigung −b/a.
 */
import type { Material } from "../materials";

export type FunctionName =
  | "Zugstab" | "Balken" | "Welle" | "Stütze" | "Platte" | "Feder" | "Gelenk" | "Druckbehälter"
  | "Wärmedämmung" | "Wärmespeicher" | "Präzisionsteil" | "Thermoschock" | "Wärmetauscherwand";
/** Ziele der mechanischen Funktionen mit Massen-, Kosten- oder Bauraumbezug (Chips „Ziel“ bis 0.7.0). */
export type MechObjective = "Masse" | "Kosten" | "Bauraum" | "CO₂";
export type ObjectiveName = MechObjective | "Leistung" | "Dicke vorgegeben" | "Energie" | "je Fläche";
export type FunctionGroup = "Mechanisch" | "Thermisch";
/** Freie Variable beim Balken (Ashby Gl. 5.12, 5.13; Tab. B1, B2). */
export type FreeVar = "Querschnitt" | "Höhe" | "Breite";
export type AxisKey = "rho" | "crho" | "E" | "Erho" | "Ecrho" | "sf";
/** Einzelner Werkstoffkennwert für Produktindizes. */
export type PropKey = "E" | "sf" | "rho" | "cm" | "lam" | "alpha" | "cp" | "kic";

interface ConstraintDef {
  y: "E" | "sf"; n: number; rb: string; fv: "A" | "t" | "h" | "b" | "–";
  spring?: boolean;
  /** feste Abszisse, unabhängig vom Ziel (Gelenk: x = E) */
  fixedX?: AxisKey;
  /** Exponent n je freier Variable (nur Balken) */
  free?: Partial<Record<Exclude<FreeVar, "Querschnitt">, { n: number; rb: string; fv: "h" | "b" }>>;
}
export interface FunctionDef {
  group: FunctionGroup;
  cons: Readonly<Record<string, ConstraintDef>>;
  shape: "B" | "T" | null;
  /** zulässige Ziele (Reihenfolge = Chips) */
  objs: readonly ObjectiveName[];
  /** wählbare freie Variablen, nur Balken */
  free?: readonly FreeVar[];
}

const MECH: readonly ObjectiveName[] = ["Masse", "Kosten", "Bauraum", "CO₂"];
/** Randbedingung einer Funktion mit Produktindizes: nur Name und Chip, der Index steht in PRODUCT. */
const PRODUCT_CON: ConstraintDef = { y: "sf", n: 1, rb: "siehe Produktindex", fv: "–" };
export const FUNCS: Readonly<Record<FunctionName, FunctionDef>> = {
  Zugstab: { group: "Mechanisch", cons: { Steifigkeit: { y: "E", n: 1, rb: "S = E·A / L", fv: "A" }, Festigkeit: { y: "sf", n: 1, rb: "F / A ≤ σ_f", fv: "A" } }, shape: null, objs: MECH },
  Balken: {
    group: "Mechanisch",
    cons: {
      Steifigkeit: { y: "E", n: 1 / 2, rb: "S = C₁·E·I / L³,  I = φ·A²/(4π)", fv: "A", free: { "Höhe": { n: 1 / 3, rb: "S = C₁·E·b·h³ / (12·L³),  Breite b fest", fv: "h" }, Breite: { n: 1, rb: "S = C₁·E·b·h³ / (12·L³),  Höhe h fest", fv: "b" } } },
      Festigkeit: { y: "sf", n: 2 / 3, rb: "M_f = W·σ_f,  W = φ·A^1,5/(4√π)", fv: "A", free: { "Höhe": { n: 1 / 2, rb: "M_f = b·h²·σ_f / 6,  Breite b fest", fv: "h" }, Breite: { n: 1, rb: "M_f = b·h²·σ_f / 6,  Höhe h fest", fv: "b" } } },
    },
    shape: "B", objs: MECH, free: ["Querschnitt", "Höhe", "Breite"],
  },
  Welle: { group: "Mechanisch", cons: { Steifigkeit: { y: "E", n: 1 / 2, rb: "S_T = G·Iₜ / L,  G ≈ 3/8·E", fv: "A" }, Festigkeit: { y: "sf", n: 2 / 3, rb: "T_f = Wₜ·σ_f / 2", fv: "A" } }, shape: "T", objs: MECH },
  "Stütze": { group: "Mechanisch", cons: { Knicken: { y: "E", n: 1 / 2, rb: "F_k = π²·E·I / L²", fv: "A" } }, shape: "B", objs: MECH },
  Platte: { group: "Mechanisch", cons: { Steifigkeit: { y: "E", n: 1 / 3, rb: "S = C·E·b·t³ / L³", fv: "t" }, Festigkeit: { y: "sf", n: 1 / 2, rb: "M_f = b·t²·σ_f / 6", fv: "t" } }, shape: null, objs: MECH },
  Feder: { group: "Mechanisch", cons: { "Energie speichern": { y: "sf", n: 2, rb: "W = σ_f² / (2E) je Volumen", fv: "–", spring: true } }, shape: null, objs: MECH },
  Gelenk: { group: "Mechanisch", cons: { "Biegung ohne Versagen": { y: "sf", n: 1, rb: "R ≥ (t/2)·E / σ_f  (Ashby Gl. 6.30)", fv: "–", fixedX: "E" } }, shape: null, objs: ["Leistung"] },
  "Druckbehälter": { group: "Mechanisch", cons: { "Fließen vor Bruch": PRODUCT_CON, "Leck vor Bruch": PRODUCT_CON }, shape: null, objs: ["Leistung"] },
  "Wärmedämmung": { group: "Thermisch", cons: { "Wärmestrom": PRODUCT_CON, Zyklus: PRODUCT_CON }, shape: null, objs: ["Dicke vorgegeben", "Kosten", "Energie"] },
  "Wärmespeicher": { group: "Thermisch", cons: { Energie: PRODUCT_CON }, shape: null, objs: ["Kosten"] },
  "Präzisionsteil": { group: "Thermisch", cons: { Verzerrung: PRODUCT_CON }, shape: null, objs: ["Leistung"] },
  Thermoschock: { group: "Thermisch", cons: { Temperatursprung: PRODUCT_CON }, shape: null, objs: ["Leistung"] },
  "Wärmetauscherwand": { group: "Thermisch", cons: { Druck: PRODUCT_CON }, shape: null, objs: ["je Fläche", "Masse"] },
};

/** Funktionen je Gruppe in Kachelreihenfolge. */
export const FUNC_GROUPS: Readonly<Record<FunctionGroup, readonly FunctionName[]>> = {
  Mechanisch: ["Zugstab", "Balken", "Welle", "Stütze", "Platte", "Feder", "Gelenk", "Druckbehälter"],
  Thermisch: ["Wärmedämmung", "Wärmespeicher", "Präzisionsteil", "Thermoschock", "Wärmetauscherwand"],
};

export interface ObjectiveDef { k: 0 | 1; x: AxisKey; obj: string; verb: string; disabled?: boolean }
/** Ziele mit Massen-, Kosten- oder Bauraumbezug. Für die übrigen Ziele (Leistung, …) liefert der Zugriff undefined. */
export const OBJS: Readonly<Record<MechObjective, ObjectiveDef>> & Readonly<Partial<Record<ObjectiveName, ObjectiveDef>>> = {
  Masse: { k: 1, x: "rho", obj: "m = A·L·ρ", verb: "Masse minimieren" },
  Kosten: { k: 1, x: "crho", obj: "C = A·L·ρ·C_m", verb: "Kosten minimieren" },
  Bauraum: { k: 0, x: "rho", obj: "V = A·L", verb: "Bauraum minimieren" },
  "CO₂": { k: 1, x: "rho", obj: "–", verb: "CO₂-Fußabdruck minimieren", disabled: true },
};
const isMechObj = (o: ObjectiveName): o is MechObjective => Object.prototype.hasOwnProperty.call(OBJS, o);

/** Festigkeitskennwert für Ashby-Diagramme: R_p, sonst R_m, sonst σ_bB (repräsentative Werte). */
export function sf(m: Material): number | null { return m.Rp ?? m.Rm ?? m.BB; }

export const AX: Readonly<Record<AxisKey, { label: string; unit: string; sym: string; f: (m: Material) => number | null }>> = {
  rho: { label: "Dichte ρ", unit: "kg/m³", sym: "ρ", f: (m) => m.rho },
  crho: { label: "Volumenkosten C_m·ρ", unit: "€/m³", sym: "C_m·ρ", f: (m) => (m.price !== null && m.rho !== null ? m.price * m.rho : null) },
  E: { label: "E-Modul E", unit: "GPa", sym: "E", f: (m) => m.E },
  Erho: { label: "E·ρ", unit: "GPa·kg/m³", sym: "E·ρ", f: (m) => (m.E !== null && m.rho !== null ? m.E * m.rho : null) },
  Ecrho: { label: "E·C_m·ρ", unit: "GPa·€/m³", sym: "E·C_m·ρ", f: (m) => (m.E !== null && m.price !== null && m.rho !== null ? m.E * m.price * m.rho : null) },
  sf: { label: "Festigkeit σ_f", unit: "MPa", sym: "σ_f", f: sf },
};
/** Kennwerte, die eine Achse der Bauart „legacy“ braucht (für die Bewertbarkeit). */
export const AX_PROPS: Readonly<Record<AxisKey, readonly PropKey[]>> = { rho: ["rho"], crho: ["cm", "rho"], E: ["E"], Erho: ["E", "rho"], Ecrho: ["E", "cm", "rho"], sf: ["sf"] };

export const PROP: Readonly<Record<PropKey, { label: string; sym: string; unit: string; dbId: string; f: (m: Material) => number | null }>> = {
  E: { label: "E-Modul", sym: "E", unit: "GPa", dbId: "P-E", f: (m) => m.E },
  sf: { label: "Festigkeit", sym: "σ_f", unit: "MPa", dbId: "P-RE | P-RM | P-BB", f: sf },
  rho: { label: "Dichte", sym: "ρ", unit: "kg/m³", dbId: "P-RHO", f: (m) => m.rho },
  cm: { label: "Preis je kg", sym: "C_m", unit: "€/kg", dbId: "P-PREIS", f: (m) => m.price },
  lam: { label: "Wärmeleitfähigkeit", sym: "λ", unit: "W/(m·K)", dbId: "P-LAM", f: (m) => m.lam },
  alpha: { label: "Wärmeausdehnung", sym: "α", unit: "10⁻⁶/K", dbId: "P-ALPHA", f: (m) => m.alpha },
  cp: { label: "spez. Wärmekapazität", sym: "c_p", unit: "J/(kg·K)", dbId: "P-CP", f: (m) => m.cp },
  kic: { label: "Bruchzähigkeit", sym: "K_IC", unit: "MPa·m^0,5", dbId: "P-KIC", f: (m) => m.kic },
};

/** Achsgruppe eines Produktindex: Produkt der Kennwerte (jeweils Exponent 1). */
/** Achsgruppe eines Produktindex: Produkt der Kennwerte, Exponent je Kennwert (Standard 1, z. B. σ_f² beim Wärmetauscher je Masse). */
export interface AxisGroup { props: readonly PropKey[]; pow: Readonly<Partial<Record<PropKey, number>>>; sym: string; label: string; unit: string }
export type GroupTerm = PropKey | readonly [PropKey, number];
const SUP: Record<number, string> = { 2: "²", 3: "³" };
export function axisGroup(terms: readonly GroupTerm[], label?: string): AxisGroup {
  const props = terms.map((t) => (typeof t === "string" ? t : t[0]));
  const pow: Partial<Record<PropKey, number>> = {};
  for (const t of terms) if (typeof t !== "string") pow[t[0]] = t[1];
  const e = (p: PropKey) => (pow[p] && pow[p] !== 1 ? SUP[pow[p]!] ?? `^${pow[p]}` : "");
  const sym = props.map((p) => PROP[p].sym + e(p)).join("·");
  return { props, pow, sym, label: label ?? (props.length === 1 && !pow[props[0] as PropKey] ? `${PROP[props[0] as PropKey].label} ${sym}` : sym), unit: props.map((p) => (e(p) ? (/[/·]/.test(PROP[p].unit) ? `(${PROP[p].unit})${e(p)}` : `${PROP[p].unit}${e(p)}`) : PROP[p].unit)).join("·") };
}
/** true, wenn die Achsgruppe aus mehr als einem Kennwert besteht oder einen Exponenten ≠ 1 hat (eigener Rechenschritt A-GR-…). */
export function isCompound(g: AxisGroup): boolean { return g.props.length > 1 || Object.values(g.pow).some((v) => v !== 1); }
export function groupValue(g: AxisGroup, m: Material): number | null {
  let v = 1;
  for (const p of g.props) { const x = PROP[p].f(m); if (x === null || !(x > 0)) return null; v *= Math.pow(x, g.pow[p] ?? 1); }
  return v;
}

interface ProductDef {
  fn: FunctionName; con: string; obj: ObjectiveName; id: string;
  /** Chip-Text der Aufgabe (eine Chip-Reihe „Ziel“) */
  task: string;
  M: string; y: readonly GroupTerm[]; a: number; x: readonly GroupTerm[]; b: number;
  rb: string; ref: string; verb: string;
}
const B6 = "Ashby (1999) Anhang B, Tab. B6, S. 411";
const PRODUCT: readonly ProductDef[] = [
  { fn: "Wärmedämmung", con: "Wärmestrom", obj: "Dicke vorgegeben", id: "A-IX-WD-Q-D", task: "Wärmestrom minimal, Dicke fest", M: "1 / λ", y: ["lam"], a: -1, x: ["rho"], b: 0, rb: "q = λ·ΔT / t mit t fest: q ∝ λ", ref: B6, verb: "Wärmestrom minimieren" },
  { fn: "Wärmedämmung", con: "Wärmestrom", obj: "Kosten", id: "A-IX-WD-Q-K", task: "billig, Wärmestrom vorgegeben", M: "1 / (λ·C_m·ρ)", y: ["lam"], a: -1, x: ["cm", "rho"], b: -1, rb: "q = λ·ΔT / t vorgegeben: t ∝ λ, C = t·A·ρ·C_m ∝ λ·C_m·ρ", ref: "Ashby (1999) Tab. 5.7, S. 78", verb: "Kosten minimieren" },
  { fn: "Wärmedämmung", con: "Zyklus", obj: "Energie", id: "A-IX-WD-Z-E", task: "Ofenwand: Energie im Zyklus minimal", M: "1 / (λ·ρ·c_p)^½", y: ["lam"], a: -1 / 2, x: ["rho", "cp"], b: -1 / 2, rb: "Q = Leitungsverlust + gespeicherte Wärme, Wanddicke optimal: Q ∝ √(λ·ρ·c_p)", ref: `${B6}; Fallstudie 6.18`, verb: "Energie je Zyklus minimieren" },
  { fn: "Wärmespeicher", con: "Energie", obj: "Kosten", id: "A-IX-WS-E-K", task: "Energie je Werkstoffkosten", M: "c_p / C_m", y: ["cp"], a: 1, x: ["cm"], b: -1, rb: "Q / C = c_p·ΔT / C_m", ref: B6, verb: "gespeicherte Wärme je Euro maximieren" },
  { fn: "Präzisionsteil", con: "Verzerrung", obj: "Leistung", id: "A-IX-PT-V-L", task: "thermische Verzerrung minimal", M: "λ / α", y: ["lam"], a: 1, x: ["alpha"], b: -1, rb: "dε/dx = (α / λ)·q  (Ashby Gl. 6.69)", ref: `${B6}; Fallstudie 6.20, S. 152`, verb: "Verzerrung minimieren" },
  { fn: "Thermoschock", con: "Temperatursprung", obj: "Leistung", id: "A-IX-TS-T-L", task: "größter Temperatursprung ohne Bruch", M: "σ_f / (E·α)", y: ["sf"], a: 1, x: ["E", "alpha"], b: -1, rb: "ΔT = σ_f / (E·α)  (Ashby Kap. 4; Faktor (1 − ν) bei zweiachsiger Behinderung als werkstoffnahe Konstante vernachlässigt)", ref: B6, verb: "zulässigen Temperatursprung maximieren" },
  { fn: "Wärmetauscherwand", con: "Druck", obj: "je Fläche", id: "A-IX-WT-P-A", task: "Wärmestrom je Fläche, Druck Δp", M: "λ·σ_f", y: ["lam"], a: 1, x: ["sf"], b: 1, rb: "Rohrwand, Membranspannung: q = λ·ΔT / t,  t = Δp·r / σ_f: q ∝ λ·σ_f (ebene Wand auf Biegung gäbe λ·σ_f^½, nicht umgesetzt)", ref: B6, verb: "Wärmestrom je Fläche maximieren" },
  { fn: "Wärmetauscherwand", con: "Druck", obj: "Masse", id: "A-IX-WT-P-M", task: "Wärmestrom je Masse, Druck Δp", M: "λ·σ_f² / ρ", y: ["lam", ["sf", 2]], a: 1, x: ["rho"], b: -1, rb: "Rohrwand, Membranspannung: t = Δp·r / σ_f, Q / m = q / (ρ·t) = λ·ΔT / (ρ·t²) ∝ λ·σ_f² / ρ", ref: "Eigene Herleitung wie Tab. B6 Zeile 1 (Ashby nennt λ·σ_f / ρ ohne Herleitung; mit t ∝ 1/σ_f folgt σ_f²)", verb: "Wärmestrom je Masse maximieren" },
  { fn: "Druckbehälter", con: "Fließen vor Bruch", obj: "Leistung", id: "A-IX-DB-Y-L", task: "Fließen vor Bruch", M: "K_IC / σ_f", y: ["kic"], a: 1, x: ["sf"], b: -1, rb: "σ = σ_f bei Risswachstum: π·a_c ≤ C²·(K_IC / σ_f)²  (Ashby Gl. 6.46)", ref: "Ashby (1999) Fallstudie 6.15, S. 134; Anhang B, Tab. B5, S. 411", verb: "kritische Risslänge maximieren" },
  { fn: "Druckbehälter", con: "Leck vor Bruch", obj: "Leistung", id: "A-IX-DB-L-L", task: "Leck vor Bruch", M: "K_IC² / σ_f", y: ["kic"], a: 2, x: ["sf"], b: -1, rb: "Riss durch die Wand bleibt stabil: σ = C·K_IC / √(π·t/2), t ≥ p·R / (2σ_f) mit σ = σ_f: C²·π·p·R / 4 = K_IC² / σ_f  (Ashby Gl. 6.47 bis 6.49)", ref: "Ashby (1999) Fallstudie 6.15, S. 134 (M₂); Anhang B, Tab. B5, S. 411", verb: "zulässigen Druck bei Leck maximieren" },
];

export interface MaterialIndex {
  fn: FunctionName; con: string; obj: ObjectiveName;
  /** Bauart: legacy (y^n / x^k, bis 0.7.0) oder product (Y^a · X^b) */
  kind: "legacy" | "product";
  /** freie Variable (Balken), sonst "Querschnitt" */
  free: FreeVar;
  /** Index M = y^n / x^k (nur legacy; bei product y = "sf", n = a, x = "rho", k = 0 als neutrale Platzhalter) */
  y: "E" | "sf"; n: number; x: AxisKey; k: 0 | 1;
  /** Formel als Text, z. B. "E^½ / ρ" */
  M: string;
  /** Herleitung nach Ashby Tab. 5.6 */
  derivation: Array<[string, string]>;
  /** Steigung der Indexlinie im log-log-Diagramm y über x */
  slope: number;
  shape: "B" | "T" | null;
  spring: boolean;
  /** Produktindex: Achsgruppen und Exponenten, M = Y^a · X^b */
  product?: { id: string; task: string; yG: AxisGroup; a: number; xG: AxisGroup; b: number; rb: string; ref: string; verb: string };
}

const POW = (n: number): string => (n === 1 ? "" : n === 0.5 ? "^½" : Math.abs(n - 1 / 3) < 1e-9 ? "^⅓" : Math.abs(n - 2 / 3) < 1e-9 ? "^⅔" : n === 2 ? "²" : `^${n}`);

/** Aufgaben (Ziel-Chips) einer Funktion mit Produktindizes, in Anzeigereihenfolge. */
export function productTasks(fn: FunctionName): Array<{ con: string; obj: ObjectiveName; task: string; id: string }> {
  return PRODUCT.filter((d) => d.fn === fn).map((d) => ({ con: d.con, obj: d.obj, task: d.task, id: d.id }));
}
export function isProductFunction(fn: FunctionName): boolean { return PRODUCT.some((d) => d.fn === fn); }

function buildProduct(d: ProductDef): MaterialIndex {
  const yG = axisGroup(d.y), xG = axisGroup(d.x);
  const derivation: Array<[string, string]> = [
    ["Funktion", d.fn], ["Aufgabe", d.task], ["Ziel", d.verb], ["Randbedingung", d.rb],
    ["Index (maximieren)", `M = ${d.M}`], ["Achsen", `${yG.sym} über ${xG.sym}, M = (${yG.sym})^${d.a} · (${xG.sym})^${d.b}`],
  ];
  return {
    fn: d.fn, con: d.con, obj: d.obj, kind: "product", free: "Querschnitt", y: "sf", n: d.a, x: "rho", k: 0, M: d.M, derivation,
    slope: -d.b / d.a, shape: null, spring: false,
    product: { id: d.id, task: d.task, yG, a: d.a, xG, b: d.b, rb: d.rb, ref: d.ref, verb: d.verb },
  };
}

/**
 * Baut den Materialindex für Funktion, Randbedingung, Ziel und (nur Balken) freie Variable.
 * null, wenn die Kombination nicht existiert oder deaktiviert ist.
 */
export function buildIndex(fn: FunctionName, con: string, obj: ObjectiveName, free: FreeVar = "Querschnitt"): MaterialIndex | null {
  const F = FUNCS[fn];
  if (!F) return null;
  const pd = PRODUCT.find((d) => d.fn === fn && d.con === con && d.obj === obj);
  if (pd) return free === "Querschnitt" ? buildProduct(pd) : null;
  if (PRODUCT.some((d) => d.fn === fn)) return null;
  const c0 = F.cons[con];
  if (!c0 || !F.objs.includes(obj)) return null;
  if (free !== "Querschnitt" && !c0.free?.[free]) return null;
  const fv = free !== "Querschnitt" ? c0.free?.[free] : undefined;
  const c = fv ? { ...c0, n: fv.n, rb: fv.rb, fv: fv.fv } : c0;
  let x: AxisKey, k: 0 | 1, verb: string, objText: string;
  if (c.fixedX) { x = c.fixedX; k = 1; verb = "Biegeradius minimieren"; objText = "R = (t/2)·E / σ_f"; }
  else {
    if (!isMechObj(obj)) return null;
    const o = OBJS[obj];
    if (o.disabled) return null;
    x = o.x; k = o.k; verb = o.verb; objText = o.obj;
  }
  if (c.spring) { x = obj === "Masse" ? "Erho" : obj === "Kosten" ? "Ecrho" : "E"; k = 1; }
  const yS = AX[c.y].sym + POW(c.n);
  const xS = AX[x].sym;
  const M = k === 0 ? yS : `${yS} / ${xS.includes("·") ? `(${xS})` : xS}`;
  const per = obj === "Masse" ? "Masse" : obj === "Kosten" ? "Euro" : "Volumen";
  const derivation: Array<[string, string]> = [
    ["Funktion", fv ? `${fn}, nur ${free} frei` : fn],
    ["Ziel", verb + (c.spring ? ` (Energie je ${per} maximieren)` : "")],
    ["Zielfunktion", c.spring ? (obj === "Masse" ? "W/m = σ_f²/(2E·ρ)" : obj === "Kosten" ? "W/C = σ_f²/(2E·C_m·ρ)" : "W/V = σ_f²/(2E)") : objText],
    ["Randbedingung", c.rb],
    ["Freie Variable", c.fv],
    ["Eliminieren und trennen", "Leistung = f(F) · f(G) · f(M)"],
    ["Index (maximieren)", `M = ${M}`],
  ];
  return { fn, con, obj, kind: "legacy", free, y: c.y, n: c.n, x, k, M, derivation, slope: k / c.n, shape: fv ? null : F.shape, spring: !!c.spring };
}

/** Indexwert der Bauart legacy aus Achsenwerten. Für Produktindizes productValue verwenden. */
export function indexValue(ix: MaterialIndex, y: number, x: number): number {
  if (ix.product) return Math.pow(y, ix.product.a) * Math.pow(x, ix.product.b);
  return Math.pow(y, ix.n) / (ix.k ? Math.pow(x, ix.k) : 1);
}

/** Kennwerte, die ein Werkstoff für diesen Index braucht (Bewertbarkeit, Liste „nicht bewertbar“). */
export function requiredProps(ix: MaterialIndex): PropKey[] {
  const out = new Set<PropKey>();
  if (ix.product) { ix.product.yG.props.forEach((p) => out.add(p)); ix.product.xG.props.forEach((p) => out.add(p)); }
  else { out.add(ix.y === "E" ? "E" : "sf"); (ix.k === 0 ? (["rho"] as const) : AX_PROPS[ix.x]).forEach((p) => out.add(p)); }
  return [...out];
}

/** Obere Formfaktoren nach Ashby Tab. 7.3: [φ_B^e, φ_T^e, φ_B^f, φ_T^f]. Keramik: 1 (nicht tabelliert, konservativ). */
export const PHI_MAX: Readonly<Record<string, readonly [number, number, number, number]>> = {
  Stahl: [65, 25, 13, 7], "Al-Legierung": [44, 31, 10, 8], "GFK/CFK": [39, 26, 9, 7], Polymer: [12, 8, 5, 4], Holz: [5, 1, 3, 1], Elastomer: [6, 3, 1, 1], Keramik: [1, 1, 1, 1],
};
/** Zuordnung zur Zeile von Tab. 7.3. Annahme: Mg, Ti, Cu, Zn wie Al-Legierungen. */
export function phiGroup(m: Material): string {
  if (m.cls === "Metall") return /^(EN AW|EN AC|AZ|Ti|Cu|Zn)/.test(m.name) ? "Al-Legierung" : "Stahl";
  if (m.cls === "Polymer") return m.elastomer ? "Elastomer" : "Polymer";
  if (m.cls === "Verbundwerkstoff") return "GFK/CFK";
  if (m.cls === "Naturwerkstoff") return "Holz";
  return "Keramik";
}
