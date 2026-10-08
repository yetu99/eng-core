/**
 * Indexkatalog nach Ashby (1999), Kap. 5 bis 7. Einheiten wie in der Datenbank:
 * E in GPa, σ_f in MPa, ρ in kg/m³, C_m in €/kg. Indexwerte sind nur innerhalb einer Auswahl vergleichbar.
 */
import type { Material } from "../materials";

export type FunctionName = "Zugstab" | "Balken" | "Welle" | "Stütze" | "Platte" | "Feder";
export type ObjectiveName = "Masse" | "Kosten" | "Bauraum" | "CO₂";
export type AxisKey = "rho" | "crho" | "E" | "Erho" | "Ecrho" | "sf";

interface ConstraintDef { y: "E" | "sf"; n: number; rb: string; fv: "A" | "t" | "–"; spring?: boolean }
export const FUNCS: Readonly<Record<FunctionName, { cons: Readonly<Record<string, ConstraintDef>>; shape: "B" | "T" | null }>> = {
  Zugstab: { cons: { Steifigkeit: { y: "E", n: 1, rb: "S = E·A / L", fv: "A" }, Festigkeit: { y: "sf", n: 1, rb: "F / A ≤ σ_f", fv: "A" } }, shape: null },
  Balken: { cons: { Steifigkeit: { y: "E", n: 1 / 2, rb: "S = C₁·E·I / L³,  I = φ·A²/(4π)", fv: "A" }, Festigkeit: { y: "sf", n: 2 / 3, rb: "M_f = W·σ_f,  W = φ·A^1,5/(4√π)", fv: "A" } }, shape: "B" },
  Welle: { cons: { Steifigkeit: { y: "E", n: 1 / 2, rb: "S_T = G·Iₜ / L,  G ≈ 3/8·E", fv: "A" }, Festigkeit: { y: "sf", n: 2 / 3, rb: "T_f = Wₜ·σ_f / 2", fv: "A" } }, shape: "T" },
  "Stütze": { cons: { Knicken: { y: "E", n: 1 / 2, rb: "F_k = π²·E·I / L²", fv: "A" } }, shape: "B" },
  Platte: { cons: { Steifigkeit: { y: "E", n: 1 / 3, rb: "S = C·E·b·t³ / L³", fv: "t" }, Festigkeit: { y: "sf", n: 1 / 2, rb: "M_f = b·t²·σ_f / 6", fv: "t" } }, shape: null },
  Feder: { cons: { "Energie speichern": { y: "sf", n: 2, rb: "W = σ_f² / (2E) je Volumen", fv: "–", spring: true } }, shape: null },
};

export const OBJS: Readonly<Record<ObjectiveName, { k: 0 | 1; x: AxisKey; obj: string; verb: string; disabled?: boolean }>> = {
  Masse: { k: 1, x: "rho", obj: "m = A·L·ρ", verb: "Masse minimieren" },
  Kosten: { k: 1, x: "crho", obj: "C = A·L·ρ·C_m", verb: "Kosten minimieren" },
  Bauraum: { k: 0, x: "rho", obj: "V = A·L", verb: "Bauraum minimieren" },
  "CO₂": { k: 1, x: "rho", obj: "–", verb: "CO₂-Fußabdruck minimieren", disabled: true },
};

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

export interface MaterialIndex {
  fn: FunctionName; con: string; obj: ObjectiveName;
  /** Index M = y^n / x^k */
  y: "E" | "sf"; n: number; x: AxisKey; k: 0 | 1;
  /** Formel als Text, z. B. "E^½ / ρ" */
  M: string;
  /** Herleitung nach Ashby Tab. 5.6 */
  derivation: Array<[string, string]>;
  /** Steigung der Indexlinie im log-log-Diagramm y über x */
  slope: number;
  shape: "B" | "T" | null;
  spring: boolean;
}

const POW = (n: number): string => (n === 1 ? "" : n === 0.5 ? "^½" : Math.abs(n - 1 / 3) < 1e-9 ? "^⅓" : Math.abs(n - 2 / 3) < 1e-9 ? "^⅔" : n === 2 ? "²" : `^${n}`);

/** Baut den Materialindex für Funktion, Randbedingung und Ziel. null, wenn die Kombination nicht existiert oder deaktiviert ist. */
export function buildIndex(fn: FunctionName, con: string, obj: ObjectiveName): MaterialIndex | null {
  const c = FUNCS[fn].cons[con], o = OBJS[obj];
  if (!c || o.disabled) return null;
  let x: AxisKey = o.x, k: 0 | 1 = o.k;
  if (c.spring) { x = obj === "Masse" ? "Erho" : obj === "Kosten" ? "Ecrho" : "E"; k = 1; }
  const yS = AX[c.y].sym + POW(c.n);
  const xS = AX[x].sym;
  const M = k === 0 ? yS : `${yS} / ${xS.includes("·") ? `(${xS})` : xS}`;
  const per = obj === "Masse" ? "Masse" : obj === "Kosten" ? "Euro" : "Volumen";
  const derivation: Array<[string, string]> = [
    ["Funktion", fn],
    ["Ziel", o.verb + (c.spring ? ` (Energie je ${per} maximieren)` : "")],
    ["Zielfunktion", c.spring ? (obj === "Masse" ? "W/m = σ_f²/(2E·ρ)" : obj === "Kosten" ? "W/C = σ_f²/(2E·C_m·ρ)" : "W/V = σ_f²/(2E)") : o.obj],
    ["Randbedingung", c.rb],
    ["Freie Variable", c.fv],
    ["Eliminieren und trennen", "Leistung = f(F) · f(G) · f(M)"],
    ["Index (maximieren)", `M = ${M}`],
  ];
  return { fn, con, obj, y: c.y, n: c.n, x, k, M, derivation, slope: k / c.n, shape: FUNCS[fn].shape, spring: !!c.spring };
}

export function indexValue(ix: MaterialIndex, y: number, x: number): number {
  return Math.pow(y, ix.n) / (ix.k ? Math.pow(x, ix.k) : 1);
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
