/**
 * Fachdaten fd 1.0 (RH a) und fd 1.1 (RH b) für die Rohrhydraulik (Abzug data/fd/*.json aus Supabase fd_*,
 * `node scripts/pull-data.mjs --fd`). Einheiten wie in der Datenbank: ν in mm²/s, k und Rohrmaße in mm, v und a in m/s,
 * ρ in kg/m³, K in GPa, Re ohne Einheit. Keine Rechenwerte.
 */
import fluidsJson from "../../data/fd/fluids.json";
import fluidValuesJson from "../../data/fd/fluid_values.json";
import roughnessJson from "../../data/fd/roughness.json";
import lossCoeffJson from "../../data/fd/loss_coeff.json";
import pipeSizesJson from "../../data/fd/pipe_sizes.json";
import velocityGuideJson from "../../data/fd/velocity_guide.json";
import flowmeterJson from "../../data/fd/flowmeter.json";
import shapeFactorJson from "../../data/fd/shape_factor.json";
import waveSpeedJson from "../../data/fd/wave_speed.json";
import bulkModulusJson from "../../data/fd/bulk_modulus.json";
import oilGradesJson from "../../data/fd/oil_grades.json";

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
/** Venturirohr nach ISO 5167-4 (fd 1.1): C je Bauart mit Gültigkeit D (mm), β, Re_D (Grenzen einschließlich, re_max null = unbegrenzt). */
export interface FdFlowmeter {
  id: string; kind: "Venturi"; variant: string; c: number; d_min_mm: number; d_max_mm: number; beta_min: number; beta_max: number; re_min: number; re_max: number | null;
  remark: string | null; source_id: string; source_locator: string;
}
/** Formbeiwert φ der laminaren Rohrreibung λ = φ·64/Re für Kreisring (d_a/d_i) und Rechteck (h/b), Dubbel Bd. 1 S. 322 (fd 1.1). */
export interface FdShapeFactor { id: string; section: "Kreisring" | "Rechteck"; param_name: "d_a/d_i" | "h/b"; param_value: number; phi: number; remark: string | null; source_id: string; source_locator: string }
/** Richtwert der Druckwellengeschwindigkeit (Roloff S. 747, fd 1.1). */
export interface FdWaveSpeed { id: string; case: string; a_m_s: number; remark: string | null; source_id: string; source_locator: string }
/** Kompressionsmodul und Dichte von Flüssigkeiten bei Atmosphärendruck (Chaudhry Tab. 2-2, fd 1.1), K in GPa. */
export interface FdBulkModulus { id: string; liquid: string; liquid_source: string; t_c: number; rho_kg_m3: number; k_gpa: number; remark: string | null; source_id: string; source_locator: string }
/** Mindestanforderungen Hydrauliköl HLP (DIN 51524-2 Tab. 2, fd 1.1), ν in mm²/s. */
export interface FdOilGrade {
  id: string; grade: string; iso_vg: number; nu_m20_max_mm2_s: number | null; nu0_max_mm2_s: number; nu40_min_mm2_s: number; nu40_max_mm2_s: number; nu100_min_mm2_s: number;
  remark: string | null; source_id: string; source_locator: string;
}

export interface FdRepo {
  fluids: readonly FdFluid[];
  fluidValues: readonly FdFluidValue[];
  roughness: readonly FdRoughness[];
  lossCoeff: readonly FdLossCoeff[];
  pipeSizes: readonly FdPipeSize[];
  velocityGuide: readonly FdVelocityGuide[];
  flowmeters: readonly FdFlowmeter[];
  shapeFactors: readonly FdShapeFactor[];
  waveSpeeds: readonly FdWaveSpeed[];
  bulkModuli: readonly FdBulkModulus[];
  oilGrades: readonly FdOilGrade[];
  fluid(id: string): FdFluid | undefined;
  fluidValue(id: string): FdFluidValue | undefined;
  rough(id: string): FdRoughness | undefined;
  loss(id: string): FdLossCoeff | undefined;
  pipe(id: string): FdPipeSize | undefined;
  velocity(id: string): FdVelocityGuide | undefined;
  flowmeter(id: string): FdFlowmeter | undefined;
  waveSpeed(id: string): FdWaveSpeed | undefined;
  bulkModulus(id: string): FdBulkModulus | undefined;
  oilGrade(id: string): FdOilGrade | undefined;
}

/** Tabellen fd 1.1 sind optional (leer), damit Abzüge von fd 1.0 weiter laden; RH b meldet dann fehlende Fachdaten. */
export function createFdRepo(d: {
  fluids: FdFluid[]; fluidValues: FdFluidValue[]; roughness: FdRoughness[]; lossCoeff: FdLossCoeff[]; pipeSizes: FdPipeSize[]; velocityGuide: FdVelocityGuide[];
  flowmeters?: FdFlowmeter[]; shapeFactors?: FdShapeFactor[]; waveSpeeds?: FdWaveSpeed[]; bulkModuli?: FdBulkModulus[]; oilGrades?: FdOilGrade[];
}): FdRepo {
  const by = <T extends { id: string }>(a: readonly T[]) => { const m = new Map(a.map((x) => [x.id, x] as const)); return (id: string) => m.get(id); };
  const flowmeters = d.flowmeters ?? [], shapeFactors = d.shapeFactors ?? [], waveSpeeds = d.waveSpeeds ?? [], bulkModuli = d.bulkModuli ?? [], oilGrades = d.oilGrades ?? [];
  return {
    ...d, flowmeters, shapeFactors, waveSpeeds, bulkModuli, oilGrades,
    fluid: by(d.fluids), fluidValue: by(d.fluidValues), rough: by(d.roughness), loss: by(d.lossCoeff), pipe: by(d.pipeSizes), velocity: by(d.velocityGuide),
    flowmeter: by(flowmeters), waveSpeed: by(waveSpeeds), bulkModulus: by(bulkModuli), oilGrade: by(oilGrades),
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
  flowmeters: flowmeterJson as unknown as FdFlowmeter[],
  shapeFactors: shapeFactorJson as unknown as FdShapeFactor[],
  waveSpeeds: waveSpeedJson as unknown as FdWaveSpeed[],
  bulkModuli: bulkModulusJson as unknown as FdBulkModulus[],
  oilGrades: oilGradesJson as unknown as FdOilGrade[],
});
