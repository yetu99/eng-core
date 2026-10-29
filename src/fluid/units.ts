/**
 * Anzeigeeinheiten der Rohrhydraulik (E6): der Kern rechnet in SI, die Oberfläche zeigt bar, mbar, m³/h, L/min, mm, °C.
 * Reine Umrechnungen ohne Formel-ID; nur hier, nie in Komponenten.
 */
export const KELVIN_OFFSET = 273.15;
/** Normatmosphäre 101 325 Pa (ISO 2533), Vorgabe für den Bezugsdruck. */
export const P_ATM = 101325;
export const G_STD = 9.81;

export const units = {
  cToK: (c: number): number => c + KELVIN_OFFSET,
  kToC: (k: number): number => k - KELVIN_OFFSET,
  barToPa: (bar: number): number => bar * 1e5,
  paToBar: (pa: number): number => pa / 1e5,
  paToMbar: (pa: number): number => pa / 100,
  m3hToM3s: (q: number): number => q / 3600,
  m3sToM3h: (q: number): number => q * 3600,
  lminToM3s: (q: number): number => q / 60000,
  m3sToLmin: (q: number): number => q * 60000,
  mmToM: (x: number): number => x / 1000,
  mToMm: (x: number): number => x * 1000,
  mm2sToM2s: (x: number): number => x * 1e-6,
  m2sToMm2s: (x: number): number => x * 1e6,
  wToKw: (x: number): number => x / 1000,
  /** Überdruck in bar → absoluter Druck in Pa mit Umgebungsdruck in bar (Standard 1,01325 bar). */
  barGaugeToPaAbs: (barG: number, ambientBar = P_ATM / 1e5): number => (barG + ambientBar) * 1e5,
  paAbsToBarGauge: (pa: number, ambientBar = P_ATM / 1e5): number => pa / 1e5 - ambientBar,
} as const;
