/**
 * Rechenweg für Blatt 2: Materialindex, Achsenwerte, Form (strukturierte Werkstoffe), Indexwert, relative Güte.
 * Jede Formel hat eine stabile ID und erscheint im Formelkatalog (A-…).
 * Bauart legacy (bis 0.7.0): A-Y-*, A-X-*, A-PHI-*, A-SHIFT-*, A-M. Bauart product (0.8.0): A-Y-E, A-Y-SF, A-K-*, A-GR-*, A-MP.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { AX, FUNCS, OBJS, PHI_MAX, PROP, buildIndex, groupValue, isCompound, phiGroup, requiredProps, type AxisGroup, type FreeVar, type FunctionName, type MaterialIndex, type ObjectiveName, type PropKey } from "./catalog";
import type { Material } from "../materials";
import type { AshbyPoint, AshbyState, RankedPoint } from "./select";

const FN_CODE: Record<FunctionName, string> = {
  Zugstab: "ZS", Balken: "BA", Welle: "WE", "Stütze": "ST", Platte: "PL", Feder: "FE", Gelenk: "GE", "Druckbehälter": "DB",
  "Wärmedämmung": "WD", "Wärmespeicher": "WS", "Präzisionsteil": "PT", Thermoschock: "TS", "Wärmetauscherwand": "WT",
};
const FREE_CODE: Record<FreeVar, string> = { Querschnitt: "", "Höhe": "H", Breite: "B" };
const CON_CODE: Record<string, string> = { Steifigkeit: "S", Festigkeit: "F", Knicken: "K", "Energie speichern": "E", "Biegung ohne Versagen": "F" };
const OBJ_CODE: Record<ObjectiveName, string> = { Masse: "M", Kosten: "K", Bauraum: "V", "CO₂": "C", Leistung: "L", "Dicke vorgegeben": "D", Energie: "E", "je Fläche": "A" };
const X_ID: Record<string, string> = { rho: "A-X-RHO", crho: "A-X-CRHO", E: "A-X-E", Erho: "A-X-ERHO", Ecrho: "A-X-ECRHO" };
const X_FORM: Record<string, string> = { rho: "ρ aus Datenbank", crho: "C_m·ρ = Preis je kg · Dichte", E: "E aus Datenbank", Erho: "E·ρ = E · ρ", Ecrho: "E·C_m·ρ = E · C_m · ρ" };

/** Stabile Formel-ID des Materialindex, z. B. "A-IX-BA-S-M" (Balken, Steifigkeit, Masse), "A-IX-BAH-S-M" (nur Höhe frei). */
export function indexId(ix: MaterialIndex): string {
  if (ix.product) return ix.product.id;
  return `A-IX-${FN_CODE[ix.fn]}${FREE_CODE[ix.free]}-${CON_CODE[ix.con] ?? "X"}-${OBJ_CODE[ix.obj]}`;
}

function verbOf(ix: MaterialIndex): string {
  return ix.product?.verb ?? OBJS[ix.obj]?.verb ?? ix.derivation.find(([k]) => k === "Ziel")?.[1] ?? ix.obj;
}

/** Index und Steigung der Indexlinie. */
export function indexTrace(ix: MaterialIndex): CalcStep[] {
  if (ix.product) {
    const p = ix.product;
    return [step(p.id, `Materialindex ${ix.fn}, ${p.task}`, `M = ${ix.M}`, `${p.rb} · Steigung der Indexlinie −b/a = ${fmt(-p.b, 3)}/${fmt(p.a, 3)}`, ix.slope, "Steigung", p.ref)];
  }
  const c = FUNCS[ix.fn].cons[ix.con];
  const fn = ix.free === "Querschnitt" ? ix.fn : `${ix.fn} nur ${ix.free} frei`;
  const rb = ix.free === "Querschnitt" ? c?.rb ?? "" : c?.free?.[ix.free]?.rb ?? "";
  const ref = ix.free !== "Querschnitt" ? "Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2" : ix.fn === "Gelenk" ? "Ashby (1999) Fallstudie 6.10, S. 117; Anhang B, Tab. B3" : "Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung";
  return [step(indexId(ix), `Materialindex ${fn}, ${ix.con}, ${verbOf(ix)}`, `M = ${ix.M}`, `${rb} · Steigung der Indexlinie k/n = ${ix.k}/${fmt(ix.n, 3)}`, ix.slope, "Steigung", ref)];
}

/** Kennwertschritt für Produktindizes. E und σ_f wie bisher (A-Y-E, A-Y-SF), übrige Kennwerte A-K-…. */
function propStep(p: PropKey, m: Material): CalcStep {
  const v = PROP[p].f(m) ?? NaN;
  if (p === "E") return step("A-Y-E", "E-Modul (Datenbank, repräsentativ)", "E aus Datenbank", `${m.name}`, v, AX.E.unit);
  if (p === "sf") return step("A-Y-SF", "Festigkeit für Auswahldiagramme", "σ_f = R_p, sonst R_m, sonst σ_bB (repräsentativ)", `${m.name}: R_p ${m.Rp === null ? "–" : fmt(m.Rp)}, R_m ${m.Rm === null ? "–" : fmt(m.Rm)}, σ_bB ${m.BB === null ? "–" : fmt(m.BB)}`, v, AX.sf.unit, "Ashby (1999) Kap. 3.3");
  const K: Record<Exclude<PropKey, "E" | "sf">, [string, string]> = {
    rho: ["A-K-RHO", "Dichte (Datenbank, repräsentativ)"], cm: ["A-K-CM", "Preis je kg (Datenbank, Richtwert)"],
    lam: ["A-K-LAM", "Wärmeleitfähigkeit (Datenbank, repräsentativ)"], alpha: ["A-K-ALPHA", "Wärmeausdehnungskoeffizient (Datenbank, repräsentativ)"],
    cp: ["A-K-CP", "Spezifische Wärmekapazität (Datenbank, repräsentativ)"], kic: ["A-K-KIC", "Bruchzähigkeit (Datenbank, repräsentativ)"],
  };
  const [id, title] = K[p];
  return step(id, title, `${PROP[p].sym} aus Datenbank`, `${m.name}`, v, PROP[p].unit);
}

/** Rechenweg für einen Werkstoff: Achsenwerte, ggf. Form, Indexwert, ggf. relative Güte. */
export function pointTrace(ix: MaterialIndex, st: AshbyState, p: AshbyPoint | RankedPoint, withShape: boolean): CalcStep[] {
  if (ix.product) return productTrace(ix, p);
  const out: CalcStep[] = [];
  out.push(ix.y === "E"
    ? step("A-Y-E", "E-Modul (Datenbank, repräsentativ)", "E aus Datenbank", `${p.m.name}`, p.y0, AX.E.unit)
    : step("A-Y-SF", "Festigkeit für Auswahldiagramme", "σ_f = R_p, sonst R_m, sonst σ_bB (repräsentativ)", `${p.m.name}: R_p ${p.m.Rp === null ? "–" : fmt(p.m.Rp)}, R_m ${p.m.Rm === null ? "–" : fmt(p.m.Rm)}, σ_bB ${p.m.BB === null ? "–" : fmt(p.m.BB)}`, p.y0, AX.sf.unit, "Ashby (1999) Kap. 3.3"));
  if (ix.k > 0) out.push(step(X_ID[ix.x] ?? "A-X", `Abszisse: ${AX[ix.x].label}`, X_FORM[ix.x] ?? AX[ix.x].sym, ix.x === "crho" ? `${fmt(p.m.price ?? NaN)} €/kg · ${fmt(p.m.rho ?? NaN)} kg/m³` : ix.x === "Erho" ? `${fmt(p.m.E ?? NaN)} · ${fmt(p.m.rho ?? NaN)}` : ix.x === "Ecrho" ? `${fmt(p.m.E ?? NaN)} · ${fmt(p.m.price ?? NaN)} · ${fmt(p.m.rho ?? NaN)}` : `${p.m.name}`, p.x0, AX[ix.x].unit));
  let ys = fmt(p.y0), xs = fmt(p.x0);
  if (withShape && st.shapeMode !== "none" && ix.shape) {
    const typ = `${ix.shape === "T" ? "T" : "B"}${ix.y === "E" ? "e" : "f"}`;
    if (st.shapeMode === "max") {
      const g = phiGroup(p.m), row = PHI_MAX[g];
      out.push(step("A-PHI-MAX", "Formfaktor, obere Grenze je Werkstoffklasse", "φ = φ_max (Tab. 7.3, Zeile nach Werkstoffgruppe, Spalte nach Belastung und Versagensart)", `Zeile ${g}${row ? "" : " (nicht tabelliert)"}, Spalte φ_${typ[0]}^${typ[1]}`, p.phi, "–", "Ashby (1999) Tab. 7.3; Mg, Ti, Cu, Zn wie Al-Legierungen; Keramik φ = 1"));
    } else {
      out.push(step("A-PHI-USER", "Formfaktor aus Blatt 1 (gleiches Profil für alle)", "φ = Formfaktor des Profils aus Blatt 1 (Belastung und Versagensart wie Index)", `${st.phiUser ? "übergeben aus Blatt 1" : "nicht übergeben, φ = 1"}, φ_${typ[0]}^${typ[1]}`, p.phi, "–", "siehe F-BE, F-BF, F-TE, F-TF"));
    }
    if (ix.k > 0 && ix.k !== ix.n) {
      const a = ix.n / (ix.k - ix.n);
      out.push(
        step("A-SHIFT-Y", "Strukturierter Werkstoff, Ordinate", "y* = y / φ^a mit a = n/(k − n)", `${fmt(p.y0)} / ${fmt(p.phi, 3)}^${fmt(a, 3)}`, p.y, AX[ix.y].unit, "Ashby (1999) Kap. 7.7"),
        step("A-SHIFT-X", "Strukturierter Werkstoff, Abszisse", "x* = x / φ^a mit a = n/(k − n)", `${fmt(p.x0)} / ${fmt(p.phi, 3)}^${fmt(a, 3)}`, p.x, AX[ix.x].unit, "Ashby (1999) Kap. 7.7"),
      );
      ys = fmt(p.y); xs = fmt(p.x);
    } else if (ix.k === 0) {
      out.push(step("A-SHIFT-0", "Formwirkung bei Bauraum (k = 0), Ordinate", "y* = φ·y", `${fmt(p.phi, 3)}·${fmt(p.y0)}`, p.y, AX[ix.y].unit, "Ashby (1999) Kap. 7.7"));
      ys = fmt(p.y);
    }
  }
  const pw = ix.n === 1 ? "" : `^${fmt(ix.n, 3)}`;
  out.push(step("A-M", "Indexwert", ix.k === 0 ? "M = y^n" : "M = y^n / x^k", ix.k === 0 ? `${ys}${pw}` : `${ys}${pw} / ${xs}`, p.idx, "–", "Indexwerte nur innerhalb einer Auswahl vergleichbar"));
  if ("rel" in p) out.push(step("A-REL", "Relative Güte (Masse, Kosten oder Bauraum bezogen auf Rang 1)", "rel = M₁ / M", `Rang ${p.rank}`, p.rel, "–"));
  return out;
}

/** Eingesetzte Werte für M = Y^a · X^b lesbar: Exponent 1 weglassen, negative Exponenten als Bruch, X^0 entfällt. */
export function powSubst(y: number, a: number, x: number, b: number): string {
  const term = (v: number, e: number) => { const s = fmt(v); const w = s.includes("·") ? `(${s})` : s; return e === 1 ? w : `${w}^${fmt(e, 3)}`; };
  const num = a > 0 ? [term(y, a)] : [], den = a < 0 ? [term(y, -a)] : [];
  if (b > 0) num.push(term(x, b)); else if (b < 0) den.push(term(x, -b));
  const n = num.length ? num.join(" · ") : "1";
  return den.length ? `${n} / ${den.length > 1 ? `(${den.join(" · ")})` : den[0]}` : n;
}

/** Rechenweg eines Produktindex: Kennwerte, Achsgruppen (nur bei Produkten), Indexwert, relative Güte. */
function productTrace(ix: MaterialIndex, p: AshbyPoint | RankedPoint): CalcStep[] {
  const P = ix.product!;
  const out = requiredProps(ix).map((k) => propStep(k, p.m));
  const grp = (id: string, title: string, g: AxisGroup) =>
    step(id, title, "Achsgruppe = Π p_i^e_i (Kennwerte der Achse, Exponent meist 1)", `${g.sym} = ${g.props.map((k) => `${fmt(PROP[k].f(p.m) ?? NaN)}${g.pow[k] && g.pow[k] !== 1 ? `^${fmt(g.pow[k]!)}` : ""}`).join(" · ")}`, groupValue(g, p.m) ?? NaN, g.unit);
  if (isCompound(P.yG)) out.push(grp("A-GR-Y", "Achsgruppe Ordinate", P.yG));
  if (isCompound(P.xG)) out.push(grp("A-GR-X", "Achsgruppe Abszisse", P.xG));
  out.push(step("A-MP", "Indexwert (Produkt von Potenzen)", "M = Y^a · X^b (Y, X Achsgruppen)", powSubst(p.y0, P.a, p.x0, P.b), p.idx, "–", "Indexwerte nur innerhalb einer Auswahl vergleichbar"));
  if ("rel" in p) out.push(step("A-REL", "Relative Güte (Masse, Kosten oder Bauraum bezogen auf Rang 1)", "rel = M₁ / M", `Rang ${p.rank}`, p.rel, "–"));
  return out;
}

export interface IndexSpec { fn: FunctionName; con: string; obj: ObjectiveName; free: FreeVar }

/** Alle Kombinationen aus Funktion, Randbedingung und Ziel ohne freie Variable (für Katalog und Tests). */
export function allIndexKeys(): Array<[FunctionName, string, ObjectiveName]> {
  return allIndexSpecs().filter((s) => s.free === "Querschnitt").map((s) => [s.fn, s.con, s.obj]);
}
/** Alle gültigen Indizes einschließlich der freien Variablen beim Balken. */
export function allIndexSpecs(): IndexSpec[] {
  const out: IndexSpec[] = [];
  for (const fn of Object.keys(FUNCS) as FunctionName[]) {
    const F = FUNCS[fn];
    for (const free of F.free ?? (["Querschnitt"] as const))
      for (const con of Object.keys(F.cons))
        for (const obj of F.objs) if (buildIndex(fn, con, obj, free)) out.push({ fn, con, obj, free });
  }
  return out;
}

const STEP_LABEL: Record<string, string> = {
  "A-Y-E": "Kennwert E-Modul E aus der Datenbank",
  "A-Y-SF": "Festigkeit σ_f für Auswahldiagramme: R_p, sonst R_m, sonst σ_bB",
  "A-X-RHO": "Abszisse Dichte ρ", "A-X-CRHO": "Abszisse Volumenkosten C_m·ρ", "A-X-E": "Abszisse E-Modul E", "A-X-ERHO": "Abszisse E·ρ", "A-X-ECRHO": "Abszisse E·C_m·ρ",
  "A-PHI-MAX": "Formfaktor: obere Grenze je Werkstoffklasse (Ashby Tab. 7.3)", "A-PHI-USER": "Formfaktor des Profils aus Blatt 1",
  "A-SHIFT-Y": "Strukturierter Werkstoff: Ordinate um φ verschoben", "A-SHIFT-X": "Strukturierter Werkstoff: Abszisse um φ verschoben", "A-SHIFT-0": "Formwirkung bei Bauraum (k = 0)",
  "A-M": "Indexwert M = y^n / x^k", "A-REL": "Relative Güte bezogen auf Rang 1",
  "A-K-RHO": "Kennwert Dichte ρ aus der Datenbank", "A-K-CM": "Kennwert Preis je kg C_m aus der Datenbank", "A-K-LAM": "Kennwert Wärmeleitfähigkeit λ aus der Datenbank",
  "A-K-ALPHA": "Kennwert Wärmeausdehnung α aus der Datenbank", "A-K-CP": "Kennwert spezifische Wärmekapazität c_p aus der Datenbank", "A-K-KIC": "Kennwert Bruchzähigkeit K_IC aus der Datenbank",
  "A-GR-Y": "Achsgruppe der Ordinate (Produkt der Kennwerte)", "A-GR-X": "Achsgruppe der Abszisse (Produkt der Kennwerte)", "A-MP": "Indexwert als Produkt von Potenzen M = Y^a · X^b",
};
let LABELS: Map<string, string> | null = null;
/**
 * Klartext zu einer Formel-ID der Werkstoffauswahl (Tooltip beim Überfahren, Kürzelliste im PDF).
 * Beispiel: "A-IX-BAH-S-M" → "Materialindex · Balken, nur Höhe frei · Steifigkeit · Masse minimieren". Unbekannte IDs: null.
 */
export function indexLabel(id: string): string | null {
  if (!LABELS) {
    LABELS = new Map(Object.entries(STEP_LABEL));
    for (const s of allIndexSpecs()) {
      const ix = buildIndex(s.fn, s.con, s.obj, s.free)!;
      const fn = s.free === "Querschnitt" ? s.fn : `${s.fn}, nur ${s.free} frei`;
      LABELS.set(indexId(ix), ix.product ? `Materialindex · ${s.fn} · ${ix.product.task}` : `Materialindex · ${fn} · ${s.con} · ${verbOf(ix)}`);
    }
  }
  return LABELS.get(id) ?? null;
}
