/**
 * eng-core: Rechenkern der Ingenieur-Werkbank.
 * Single Point of Truth für alle Formeln. Änderungen nur über das Repo eng-core mit Tests und Gegenrechnung.
 */
export { CORE_VERSION } from "./version";
export { DATA_VERSION, DATA_RELEASED_AT, DATA_TITLE } from "./dataVersion";

export * from "./format";
export * from "./trace";
export * from "./sections";
export * from "./materials";
export * from "./mechanics/cases";
export * from "./mechanics/beam";
export * from "./mechanics/loadlist";
export * from "./mechanics/pressure";
export { computeStrength, dimsLabel, InputError, G_ACC, type StrengthInput, type StrengthResult, type Check, type Kpi } from "./mechanics/compute";
export * from "./mechanics/design";
export * from "./ashby/catalog";
export * from "./ashby/select";
export * from "./ashby/conflicts";
export * from "./ashby/trace";
export * from "./ashby/recommend";
export * from "./report";
export { materialDetail, valueText, ATLAS_PATH, type MaterialDetail, type DetailValue, type DetailGroup, type DetailProcess, type DetailData } from "./materialDetail";
