/**
 * Rechenweg für Blatt 2: Materialindex, Achsenwerte, Form (strukturierte Werkstoffe), Indexwert, relative Güte.
 * Jede Formel hat eine stabile ID und erscheint im Formelkatalog (A-…).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { AX, FUNCS, OBJS, PHI_MAX, phiGroup, type FunctionName, type MaterialIndex, type ObjectiveName } from "./catalog";
import type { AshbyPoint, AshbyState, RankedPoint } from "./select";

const FN_CODE: Record<FunctionName, string> = { Zugstab: "ZS", Balken: "BA", Welle: "WE", "Stütze": "ST", Platte: "PL", Feder: "FE" };
const CON_CODE: Record<string, string> = { Steifigkeit: "S", Festigkeit: "F", Knicken: "K", "Energie speichern": "E" };
const OBJ_CODE: Record<ObjectiveName, string> = { Masse: "M", Kosten: "K", Bauraum: "V", "CO₂": "C" };
const X_ID: Record<string, string> = { rho: "A-X-RHO", crho: "A-X-CRHO", E: "A-X-E", Erho: "A-X-ERHO", Ecrho: "A-X-ECRHO" };
const X_FORM: Record<string, string> = { rho: "ρ aus Datenbank", crho: "C_m·ρ = Preis je kg · Dichte", E: "E aus Datenbank", Erho: "E·ρ = E · ρ", Ecrho: "E·C_m·ρ = E · C_m · ρ" };

/** Stabile Formel-ID des Materialindex, z. B. "A-IX-BA-S-M" (Balken, Steifigkeit, Masse). */
export function indexId(ix: MaterialIndex): string { return `A-IX-${FN_CODE[ix.fn]}-${CON_CODE[ix.con] ?? "X"}-${OBJ_CODE[ix.obj]}`; }

/** Index und Steigung der Indexlinie. */
export function indexTrace(ix: MaterialIndex): CalcStep[] {
  const c = FUNCS[ix.fn].cons[ix.con];
  return [step(indexId(ix), `Materialindex ${ix.fn}, ${ix.con}, ${OBJS[ix.obj].verb}`, `M = ${ix.M}`, `${c?.rb ?? ""} · Steigung der Indexlinie k/n = ${ix.k}/${fmt(ix.n, 3)}`, ix.slope, "Steigung", "Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung")];
}

/** Rechenweg für einen Werkstoff: Achsenwerte, ggf. Form, Indexwert, ggf. relative Güte. */
export function pointTrace(ix: MaterialIndex, st: AshbyState, p: AshbyPoint | RankedPoint, withShape: boolean): CalcStep[] {
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

/** Alle Kombinationen aus Funktion, Randbedingung und Ziel (für Katalog und Tests). */
export function allIndexKeys(): Array<[FunctionName, string, ObjectiveName]> {
  const out: Array<[FunctionName, string, ObjectiveName]> = [];
  for (const fn of Object.keys(FUNCS) as FunctionName[]) for (const con of Object.keys(FUNCS[fn].cons)) for (const obj of Object.keys(OBJS) as ObjectiveName[]) if (!OBJS[obj].disabled) out.push([fn, con, obj]);
  return out;
}
