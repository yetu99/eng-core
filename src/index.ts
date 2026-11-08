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
export * from "./fluid/water";
export * from "./fluid/friction";
export * from "./fluid/props";
export * from "./fluid/line";
export * from "./fluid/units";
export { fdRepo, createFdRepo, type FdRepo, type FdFluid, type FdFluidValue, type FdRoughness, type FdLossCoeff, type FdPipeSize, type FdVelocityGuide, type FdFlowmeter, type FdShapeFactor, type FdWaveSpeed, type FdBulkModulus, type FdOilGrade } from "./fluid/fdData";
export * from "./fluid/section";
export * from "./fluid/walther";
export * from "./fluid/pump";
export * from "./fluid/meter";
export * from "./fluid/surge";
export { I3, rotX, rotY, rotZ, rotAxis, mulVec, maxAbsDiff, deg, rad, type Vec3, type Mat3, type AxisName } from "./kinematics/so3";
export * as so3 from "./kinematics/so3";
export * from "./kinematics/orientation";
export * from "./kinematics/compute";
export * from "./kinematics/se3";
export * from "./kinematics/frames";
export * from "./kinematics/templates";
export * from "./kinematics/dh";
export * from "./kinematics/forward";
export * from "./kinematics/robots";
export * from "./joints/pvData";
export * from "./joints/fit";
export * from "./joints/plastic";
export * from "./joints/spin";
export * from "./joints/join";
export * from "./joints/pressfit";
