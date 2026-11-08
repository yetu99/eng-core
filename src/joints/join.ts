/**
 * Fügen des Pressverbands nach DIN 7190-1:2017 Abschn. 8 (P12; Modul verbindungen, eng-core 0.17.0).
 * Längspress: Einpresskraft mit p_max und ν_ll (Gl. (48)), Fasenlänge Tab. 6 bzw. Gl. (49).
 * Querpress: Fügespiel 0,001·D_F (Gl. (50)) oder U_g/2 (Roloff S. 450), U_F = U_g + U_sϑ (Gl. (51), Befund B5: mit U_g),
 * erforderliche Fügetemperatur (Gl. (52)), größtes fügbares Übermaß (Gl. (53)). Einheiten N, mm, °C, α in 1/K.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { chamferRow, type PvRepo } from "./pvData";
import { REF_DIN, REF_ROLOFF } from "./fit";

export type PvJoining =
  | { kind: "laengs" }
  /** Querpress: Raumtemperatur ϑ_R, Temperatur der Welle ϑ_I (Raum, Trockeneis, Stickstoff), Fügespiel nach DIN oder U_g/2, zulässige Nabentemperatur (Tab. 8) */
  | { kind: "quer"; thetaR: number; thetaI: number; clearance: "din" | "half"; thetaAzul: number | null };

export interface JoinResult { Fe: number | null; le: number | null; leCbrt: number | null; Us: number | null; UF: number | null; thetaA: number | null; Umax: number | null; thetaAzul: number | null }

export function computeLaengs(fd: PvRepo, DF: number, lF: number, nuL: number, pmax: number, S: CalcStep[]): JoinResult {
  const Fe = Math.PI * DF * lF * nuL * pmax, row = chamferRow(fd, DF), cb = Math.cbrt(DF), le = row ? row.le_mm : cb;
  S.push(step("PV-FE", "Einpresskraft", "F_e = π·D_F·l_F·ν_ll·p_max", `F_e = π·${fmt(DF)}·${fmt(lF)}·${fmt(nuL)}·${fmt(pmax)} = ${fmt(Fe / 1e3)} kN`, Fe, "N", `${REF_DIN} Gl. (48); ${REF_ROLOFF} (12.22)`));
  S.push(step("PV-LE", "Fasenlänge", row ? "l_e nach Tab. 6 (Vergleich l_e ≈ ∛D_F)" : "l_e ≈ ∛D_F (D_F ≤ 50 mm, Tab. 6 beginnt über 50 mm)",
    row ? `${fmt(row.d_over_mm)} < D_F ≤ ${row.d_to_mm === null ? "…" : fmt(row.d_to_mm)} mm: l_e = ${fmt(row.le_mm)} mm (∛D_F = ${fmt(cb)} mm)` : `l_e = ∛${fmt(DF)} = ${fmt(cb)} mm`, le, "mm", `${REF_DIN} Tab. 6, Gl. (49)`));
  return { Fe, le, leCbrt: cb, Us: null, UF: null, thetaA: null, Umax: null, thetaAzul: null };
}

/** α der Welle: beim Unterkühlen (ϑ_I < ϑ_R) α_kalt, sonst α_warm. */
export function computeQuer(j: Extract<PvJoining, { kind: "quer" }>, DF: number, Ug: number, alphaA: number, alphaI: number, S: CalcStep[]): JoinResult {
  const Us = j.clearance === "din" ? 0.001 * DF : Ug / 2, UF = Ug + Us;
  const thetaA = j.thetaR + UF / (alphaA * DF) + alphaI / alphaA * (j.thetaI - j.thetaR);
  const um = (x: number) => fmt(x * 1e3), a6 = (x: number) => fmt(x * 1e6);
  S.push(step("PV-US", "Fügespiel", j.clearance === "din" ? "U_sϑ = 0,001·D_F" : "U_sϑ = U_g/2", j.clearance === "din" ? `U_sϑ = 0,001·${fmt(DF)} = ${um(Us)} µm` : `U_sϑ = ${um(Ug)}/2 = ${um(Us)} µm`,
    Us, "mm", j.clearance === "din" ? `${REF_DIN} Gl. (50)` : `${REF_ROLOFF} S. 450`));
  S.push(step("PV-UF", "Übermaß beim Fügen", "U_F = U_g + U_sϑ", `U_F = ${um(Ug)} + ${um(Us)} = ${um(UF)} µm`, UF, "mm", `${REF_DIN} Gl. (51) (mit U_g, Befund B5)`));
  S.push(step("PV-TA", "Erforderliche Fügetemperatur der Nabe", "ϑ_A,erf = ϑ_R + U_F/(α_A·D_F) + α_I/α_A·(ϑ_I − ϑ_R)",
    `ϑ_A,erf = ${fmt(j.thetaR)} + ${um(UF)}·10⁻³/(${a6(alphaA)}·10⁻⁶·${fmt(DF)}) + ${a6(alphaI)}/${a6(alphaA)}·(${fmt(j.thetaI)} − ${fmt(j.thetaR)}) = ${fmt(thetaA)} °C`, thetaA, "°C", `${REF_DIN} Gl. (52); ${REF_ROLOFF} (12.23)`));
  let Umax: number | null = null;
  if (j.thetaAzul !== null) {
    Umax = DF * (alphaA * (j.thetaAzul - j.thetaR) - alphaI * (j.thetaI - j.thetaR)) - Us;
    S.push(step("PV-UMAX", "Größtes fügbares Übermaß", "U_max = D_F·[α_A·(ϑ_A,zul − ϑ_R) − α_I·(ϑ_I − ϑ_R)] − U_sϑ",
      `U_max = ${fmt(DF)}·[${a6(alphaA)}·10⁻⁶·(${fmt(j.thetaAzul)} − ${fmt(j.thetaR)}) − ${a6(alphaI)}·10⁻⁶·(${fmt(j.thetaI)} − ${fmt(j.thetaR)})] − ${um(Us)}·10⁻³ = ${um(Umax)} µm`, Umax, "mm", `${REF_DIN} Gl. (53)`));
  }
  return { Fe: null, le: null, leCbrt: null, Us, UF, thetaA, Umax, thetaAzul: j.thetaAzul };
}
