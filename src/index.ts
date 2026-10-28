/**
 * eng-core: Rechenkern der Ingenieur-Werkbank.
 * Single Point of Truth für alle Formeln. Änderungen nur über das Repo eng-core mit Tests und Gegenrechnung.
 */
export { CORE_VERSION } from "./version";
export { DATA_VERSION, DATA_RELEASED_AT, DATA_TITLE } from "./dataVersion";
export { FD_VERSION, FD_RELEASED_AT, FD_FILES } from "./fdVersion";
export * from "./modules";

export * from "./format";
export * from "./trace";
export * from "./sections";
export * from "./materials";
export * from "./mechanics/cases";
export * from "./mechanics/beam";
export * from "./mechanics/loadlist";
export * from "./mechanics/pressure";
export * from "./mechanics/vibration";
export * from "./mechanics/notch";
export * from "./mechanics/fatigueGroups";
export { computeFatigue, woehlerChart, FATIGUE_DEFAULT, pOfCondition, type FatigueInput, type FatigueResult, type FatigueComp, type FatigueContext, type WoehlerChart, type WoehlerSeries } from "./mechanics/fatigue";
export { computeStrength, dimsLabel, InputError, G_ACC, PRIMARY_KPIS, type StrengthInput, type StrengthResult, type Check, type Kpi } from "./mechanics/compute";
export * from "./mechanics/design";
export * from "./ashby/catalog";
export * from "./ashby/select";
export * from "./ashby/conflicts";
export * from "./ashby/trace";
export * from "./ashby/recommend";
export * from "./report";
export { materialDetail, valueText, ATLAS_PATH, type MaterialDetail, type DetailValue, type DetailGroup, type DetailProcess, type DetailData } from "./materialDetail";
