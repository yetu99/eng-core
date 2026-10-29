/**
 * Fachdaten fd 1.0 für die Rohrhydraulik (Abzug data/fd/*.json aus Supabase fd_*, `node scripts/pull-data.mjs --fd`).
 * Einheiten wie in der Datenbank: ν in mm²/s, k und Rohrmaße in mm, v in m/s, ρ in kg/m³. Keine Rechenwerte.
 */
import fluidsJson from "../../data/fd/fluids.json";
import fluidValuesJson from "../../data/fd/fluid_values.json";
import roughnessJson from "../../data/fd/roughness.json";
import lossCoeffJson from "../../data/fd/loss_coeff.json";
import pipeSizesJson from "../../data/fd/pipe_sizes.json";
import velocityGuideJson from "../../data/fd/velocity_guide.json";

export interface FdFluid { id: string; name: string; kind: "Wasser (IAPWS im Kern)" | "Flüssigkeit" | "Öl ISO VG"; note: string | null; sort_order: number; source_id: string; source_locator: string }
export interface FdFluidValue {
  id: string; fluid_id: string; t_c: number; rho_kg_m3: number | null; nu_mm2_s: number; nu_min_mm2_s: number | null; nu_max_mm2_s: number | null;
  value_type: "Tabellenwert" | "Vergleichswert" | "Normwert"; confidence: number | null; remark: string | null; source_id: string; source_locator: string;
}
export interface FdRoughness { id: string; pipe_kind: string; state: string; k_min_mm: number; k_max_mm: number; confidence: number | null; remark: string | null; source_id: string; source_locator: string }
export interface FdLossCoeff {
  id: string; grp: string; element: string; param_name: string | null; param_value: number | null; dn_min: number | null; dn_max: number | null;
  zeta: number; zeta_max: number | null; ref_section: "1" | "2" | null; confidence: number | null; remark: string | null; source_id: string; source_locator: string;
}
export interface FdPipeSize { id: string; norm: string; material: string; series: string; d_a_mm: number; walls_mm: number[]; source_id: string; source_locator: string }
export interface FdVelocityGuide { id: string; system: string; case: string; v_min_m_s: number; v_max_m_s: number; remark: string | null; source_id: string; source_locator: string }

export interface FdRepo {
  fluids: readonly FdFluid[];
  fluidValues: readonly FdFluidValue[];
  roughness: readonly FdRoughness[];
  lossCoeff: readonly FdLossCoeff[];
  pipeSizes: readonly FdPipeSize[];
  velocityGuide: readonly FdVelocityGuide[];
  fluid(id: string): FdFluid | undefined;
  fluidValue(id: string): FdFluidValue | undefined;
  rough(id: string): FdRoughness | undefined;
  loss(id: string): FdLossCoeff | undefined;
  pipe(id: string): FdPipeSize | undefined;
  velocity(id: string): FdVelocityGuide | undefined;
}

export function createFdRepo(d: { fluids: FdFluid[]; fluidValues: FdFluidValue[]; roughness: FdRoughness[]; lossCoeff: FdLossCoeff[]; pipeSizes: FdPipeSize[]; velocityGuide: FdVelocityGuide[] }): FdRepo {
  const by = <T extends { id: string }>(a: readonly T[]) => { const m = new Map(a.map((x) => [x.id, x] as const)); return (id: string) => m.get(id); };
  return {
    ...d,
    fluid: by(d.fluids), fluidValue: by(d.fluidValues), rough: by(d.roughness), loss: by(d.lossCoeff), pipe: by(d.pipeSizes), velocity: by(d.velocityGuide),
  };
}

/** Fachdaten aus dem versionierten Abzug (data/fd). */
export const fdRepo: FdRepo = createFdRepo({
  fluids: fluidsJson as unknown as FdFluid[],
  fluidValues: fluidValuesJson as unknown as FdFluidValue[],
  roughness: roughnessJson as unknown as FdRoughness[],
  lossCoeff: lossCoeffJson as unknown as FdLossCoeff[],
  pipeSizes: pipeSizesJson as unknown as FdPipeSize[],
  velocityGuide: velocityGuideJson as unknown as FdVelocityGuide[],
});
