/**
 * eng-core: Rechenkern der Ingenieur-Werkbank.
 * Single Point of Truth für alle Formeln. Änderungen nur über das Repo eng-core mit Tests und Gegenrechnung.
 */
export const CORE_VERSION = "0.3.0";

export * from "./format";
export * from "./trace";
export * from "./sections";
export * from "./materials";
export * from "./mechanics/cases";
export * from "./mechanics/beam";
export { computeStrength, dimsLabel, InputError, G_ACC, type StrengthInput, type StrengthResult, type Check, type Kpi } from "./mechanics/compute";
export * from "./mechanics/design";
export * from "./ashby/catalog";
export * from "./ashby/select";
export * from "./ashby/conflicts";
