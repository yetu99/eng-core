/**
 * Stoffwerte des Fluids für die Rohrhydraulik (Entscheidungen R1 bis R3): Wasser nach IAPWS, andere Flüssigkeiten aus
 * fd_fluid_values (nur Tabellentemperaturen, keine Interpolation) oder von Hand. Einheiten SI.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import type { FdRepo } from "./fdData";
import { waterState } from "./water";

export type FluidSpec =
  /** Wasser nach IAPWS-IF97 und R12-08 bei T und Bezugsdruck p. */
  | { kind: "wasser" }
  /** Zeile aus fd_fluid_values; rho von Hand, wenn die Zeile keine Dichte hat (ISO VG). */
  | { kind: "tabelle"; valueId: string; rho?: number | null }
  /** Dichte (kg/m³) und kinematische Viskosität (m²/s) von Hand. */
  | { kind: "hand"; rho: number; nu: number };

export interface FluidInput {
  spec: FluidSpec;
  /** Temperatur in K (nur Wasser). */
  T: number;
  /** Bezugsdruck in Pa absolut (nur Wasser, R2). */
  p: number;
}

export interface FluidProps {
  label: string;
  rho: number;
  nu: number;
  eta: number;
  /** Sättigungsdruck in Pa, nur für Wasser bekannt. */
  ps: number | null;
  steps: CalcStep[];
  errors: string[];
  warnings: string[];
}

const fail = (label: string, errors: string[]): FluidProps => ({ label, rho: NaN, nu: NaN, eta: NaN, ps: null, steps: [], errors, warnings: [] });

export function fluidProps(fd: FdRepo, inp: FluidInput): FluidProps {
  const s = inp.spec;
  if (s.kind === "wasser") {
    const w = waterState(inp.T, inp.p);
    return { label: `Wasser ${fmt(inp.T - 273.15)} °C, ${fmt(inp.p / 1e5)} bar (IAPWS)`, rho: w.rho, nu: w.nu, eta: w.eta, ps: w.ps, steps: w.steps, errors: w.errors, warnings: w.warnings };
  }
  if (s.kind === "hand") {
    const errors: string[] = [];
    if (!(s.rho > 0)) errors.push("Dichte von Hand muss größer als 0 sein.");
    if (!(s.nu > 0)) errors.push("Kinematische Viskosität von Hand muss größer als 0 sein.");
    if (errors.length) return fail("Fluid von Hand", errors);
    return {
      label: "Fluid von Hand", rho: s.rho, nu: s.nu, eta: s.rho * s.nu, ps: null, errors, warnings: ["Fluid von Hand: kein Sättigungsdruck bekannt, Kavitationshinweis entfällt."],
      steps: [
        step("FS-MAN-RHO", "Dichte (Eingabe)", "ρ = Eingabe", `ρ = ${fmt(s.rho, 6)} kg/m³`, s.rho, "kg/m³", "Eingabe"),
        step("FS-MAN-NU", "Kinematische Viskosität (Eingabe)", "ν = Eingabe", `ν = ${fmt(s.nu, 6)} m²/s`, s.nu, "m²/s", "Eingabe"),
      ],
    };
  }
  const v = fd.fluidValue(s.valueId);
  if (!v) return fail("Fluid aus Tabelle", [`Stoffwertzeile ${s.valueId} nicht in den Fachdaten.`]);
  const f = fd.fluid(v.fluid_id);
  const label = `${f?.name ?? v.fluid_id} ${fmt(v.t_c)} °C (${v.source_locator})`;
  const steps: CalcStep[] = [];
  const errors: string[] = [], warnings: string[] = [];
  let rho: number;
  if (v.rho_kg_m3 !== null) {
    rho = v.rho_kg_m3;
    steps.push(step("FS-TAB-RHO", "Dichte (Tabellenwert)", "ρ aus fd_fluid_values", `${v.id}: ρ = ${fmt(rho, 6)} kg/m³ bei ${fmt(v.t_c)} °C`, rho, "kg/m³", `${v.source_locator} (${v.source_id})`));
  } else if (s.rho !== null && s.rho !== undefined && s.rho > 0) {
    rho = s.rho;
    steps.push(step("FS-MAN-RHO", "Dichte (Eingabe)", "ρ = Eingabe", `ρ = ${fmt(rho, 6)} kg/m³ (Tabelle ohne Dichte)`, rho, "kg/m³", "Eingabe"));
  } else return fail(label, [`${f?.name ?? v.fluid_id}: Die Tabelle nennt keine Dichte, bitte von Hand eingeben.`]);
  const nu = v.nu_mm2_s * 1e-6;
  steps.push(step("FS-TAB-NU", "Kinematische Viskosität (Tabellenwert)", "ν aus fd_fluid_values (mm²/s · 10⁻⁶)", `${v.id}: ν = ${fmt(v.nu_mm2_s, 6)} mm²/s = ${fmt(nu, 6)} m²/s`, nu, "m²/s", `${v.source_locator} (${v.source_id})`));
  if (v.value_type === "Vergleichswert") warnings.push("Wasser aus der Tabelle ist nur ein Vergleichswert; für Rechnungen Wasser (IAPWS) wählen.");
  if (v.nu_min_mm2_s !== null && v.nu_max_mm2_s !== null) warnings.push(`ISO-Klasse: ν bei 40 °C zwischen ${fmt(v.nu_min_mm2_s)} und ${fmt(v.nu_max_mm2_s)} mm²/s; gerechnet mit der Klassenmitte.`);
  warnings.push("Fluid aus Tabelle: kein Sättigungsdruck bekannt, Kavitationshinweis entfällt.");
  return { label, rho, nu, eta: rho * nu, ps: null, steps, errors, warnings };
}
