/**
 * Bemessen: kleinster Skalierungsfaktor s der Startmaße, für den alle Nachweise erfüllt sind (Ausnutzung ≤ 1).
 *
 * Verfahren (deterministisch): Bisektion im log-Raum mit fester Schrittzahl auf s ∈ [0,02; 50],
 * vorher Begrenzung auf geometrisch gültige Maße. Danach Aufrunden auf Fertigungsraster
 * (Wandstärke 0,5 mm, sonst 1 mm) und Nachrechnung mit den gewählten Maßen.
 * Voraussetzung: Ausnutzung fällt monoton mit wachsendem Maß (gilt für alle Fälle in Blatt 1).
 */
import { fmt } from "../format";
import { sectionProps, type Dims } from "../sections";
import { step, type CalcStep } from "../trace";
import { strengthDesign, type Repo } from "../materials";
import { computeStrength, pressureMaterial, type StrengthInput, type StrengthResult } from "./compute";
import { designPressure, isPressureCase, PRESSURE_CASES } from "./pressure";

export const DESIGN_STEPS = 60;
export const DESIGN_RANGE: readonly [number, number] = [0.02, 50];

export type DesignResult =
  | { ok: true; s: number; raw: Dims; dims: Dims; result: StrengthResult; trace: CalcStep[] }
  | { ok: false; message: string; trace: CalcStep[] };

/** @param dimKey "formtreu" (alle Maße proportional) oder Schlüssel eines einzelnen Maßes */
export function designSize(repo: Repo, inp: StrengthInput, dimKey: string): DesignResult {
  if (inp.mode === "single" && inp.kind === "FQ") return designFrequency(repo, inp, dimKey);
  const base: Dims = { ...inp.dims };
  const proportional = dimKey === "formtreu";
  if (!proportional && !(dimKey in base)) return { ok: false, message: `Unbekanntes Maß ${dimKey}`, trace: [] };
  const dimsAt = (s: number): Dims => proportional
    ? Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v * s]))
    : { ...base, [dimKey]: (base[dimKey] ?? NaN) * s };
  const valid = (s: number) => sectionProps(inp.secType, dimsAt(s)).errors.length === 0;
  const util = (s: number) => { const r = computeStrength(repo, { ...inp, dims: dimsAt(s) }); return r.errors.length ? Infinity : r.util; };

  let lo = Math.log(DESIGN_RANGE[0]), hi = Math.log(DESIGN_RANGE[1]);
  const T: CalcStep[] = [];
  if (!valid(Math.exp(hi))) { let a = lo, b = hi; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (valid(Math.exp(m))) a = m; else b = m; } hi = a; }
  if (!valid(Math.exp(lo))) { let a = lo, b = hi; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (valid(Math.exp(m))) b = m; else a = m; } lo = b; }
  if (!(util(Math.exp(hi)) <= 1)) {
    return { ok: false, trace: T, message: proportional ? "Keine Lösung bis zum 50-fachen Ausgangsmaß" : `Auch mit dem größten geometrisch möglichen ${dimKey} nicht erfüllt. Anderes Maß oder formtreu bemessen.` };
  }
  if (util(Math.exp(lo)) <= 1) hi = lo;
  else for (let i = 0; i < DESIGN_STEPS; i++) { const m = (lo + hi) / 2; if (util(Math.exp(m)) > 1) lo = m; else hi = m; }
  const s = Math.exp(hi);
  const raw = dimsAt(s);
  const grid = (k: string) => (k === "t" ? 0.5 : 1);
  const varies = (k: string) => proportional || k === dimKey;
  const dims: Dims = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, varies(k) ? Math.ceil(v / grid(k) - 1e-9) * grid(k) : v]));
  const result = computeStrength(repo, { ...inp, dims });
  T.push(step("D-BIS", "Lösungsverfahren", "max. Ausnutzung u(s) = 1, Bisektion im log-Raum", `s ∈ [${fmt(DESIGN_RANGE[0])}; ${fmt(DESIGN_RANGE[1])}], ${DESIGN_STEPS} Schritte, ${proportional ? "alle Maße proportional" : "nur " + dimKey + " variabel"}`, s, "–", "deterministisch, feste Schrittzahl"));
  for (const [k, v] of Object.entries(raw)) if (varies(k)) T.push(step(`D-ERF-${k}`, `Erforderliches Maß ${k}`, `${k}_erf = ${k}₀·s`, `${fmt(base[k] ?? NaN)}·${fmt(s)}`, v, "mm"));
  for (const [k, v] of Object.entries(dims)) if (varies(k)) T.push(step(`D-GEW-${k}`, `Gewähltes Maß ${k}`, `${k} aufgerundet auf ${grid(k) === 1 ? "1" : "0,5"} mm`, `${fmt(raw[k] ?? NaN)} → ${fmt(v)}`, v, "mm", "Fertigungsraster"));
  T.push(step("D-U", "Ausnutzung mit gewählten Maßen", "u = max(S_erf / S)", result.governing ? `maßgebend: ${result.governing}` : "", result.util * 100, "%"));
  return { ok: true, s, raw, dims, result, trace: T };
}

export type PressureDesignResult =
  | { ok: true; tErf: number; tGew: number; closedForm: boolean; result: StrengthResult; trace: CalcStep[] }
  | { ok: false; message: string; trace: CalcStep[] };

/**
 * Bemessen Druckbehälter (kind = "PB"): erforderliche Wandstärke bei festem Innen- oder Außendurchmesser
 * (inp.pressure.dim), geschlossene Lösung oder Bisektion (pressure.ts), Aufrunden auf 0,5 mm, Nachrechnung.
 */
export function designPressureStrength(repo: Repo, inp: StrengthInput): PressureDesignResult {
  const mat = repo.byId(inp.materialId);
  if (!mat) return { ok: false, message: `Unbekannter Werkstoff ${inp.materialId}`, trace: [] };
  if (!isPressureCase(inp.sub) || !inp.pressure) return { ok: false, message: "Druckbehälter: Lastfall, Maße oder Drücke fehlen", trace: [] };
  if (mat.E === null) return { ok: false, message: `${mat.name}: E-Modul nicht belegt`, trace: [] };
  const pc = PRESSURE_CASES[inp.sub];
  const pm = pressureMaterial(repo, inp, mat, strengthDesign(repo, mat, false, inp.dvChoice, inp.dvManual));
  const d = designPressure({ ...inp.pressure, shape: pc.shape, closed: pc.closed }, pm);
  if (!d.ok) return { ok: false, message: d.message, trace: d.steps };
  const result = computeStrength(repo, { ...inp, pressure: { ...inp.pressure, t: d.tGew } });
  const T = [...d.steps, step("D-U", "Ausnutzung mit gewählten Maßen", "u = max(S_erf / S)", result.governing ? `maßgebend: ${result.governing}` : "", result.util * 100, "%")];
  return { ok: true, tErf: d.tErf, tGew: d.tGew, closedForm: d.closedForm, result, trace: T };
}

/**
 * Bemessen Eigenfrequenz (kind = "FQ", Konzept V2-A U9, V-B): kleinster formtreuer Faktor s mit f₁(s) = f_min.
 * Ohne Zusatzmasse geschlossen: E·I ∝ s⁴, m′ ∝ s², also f₁ ∝ s und s = f_min / f₁(1).
 * Mit Zusatzmasse (m_z > 0) kein Potenzgesetz: Bisektion im log-Raum auf [0,02; 50], 60 Schritte (f₁ steigt mit s).
 * Danach Aufrunden auf das Fertigungsraster wie Blatt 1 und Nachrechnung. Nur formtreu: bei einem einzelnen Maß
 * ist f₁ nicht monoton (z. B. sinkt f₁ beim Rohr mit wachsender Wandstärke). Der Resonanzabstand wird nur nachgerechnet.
 */
function designFrequency(repo: Repo, inp: StrengthInput, dimKey: string): DesignResult {
  const T: CalcStep[] = [];
  if (dimKey !== "formtreu") return { ok: false, trace: T, message: "Eigenfrequenz: nur formtreu bemessen (f₁ ist bei einem einzelnen Maß nicht monoton)" };
  const v = inp.vibration;
  if (!v || v.fmin === null) return { ok: false, trace: T, message: "Bemessen Eigenfrequenz braucht eine Mindestfrequenz f_min" };
  const fmin = v.fmin;
  const base: Dims = { ...inp.dims };
  const dimsAt = (s: number): Dims => Object.fromEntries(Object.entries(base).map(([k, x]) => [k, x * s]));
  const f1At = (s: number): number => { const r = computeStrength(repo, { ...inp, dims: dimsAt(s) }); return r.errors.length || !r.vibration ? NaN : (r.vibration.modes[0]?.f ?? NaN); };
  const f0 = f1At(1);
  if (!Number.isFinite(f0)) { const r = computeStrength(repo, inp); return { ok: false, trace: T, message: r.errors.join("; ") || "Eigenfrequenz nicht berechenbar" }; }
  let s: number;
  if (v.mz === 0) {
    s = fmin / f0;
    T.push(step("V-B", "Formtreuer Faktor für f₁ = f_min", "s = f_min / f₁ (formtreu, m_z = 0: E·I ∝ s⁴, m′ ∝ s², f₁ ∝ s);  mit m_z > 0: f₁(s) = f_min, Bisektion im log-Raum, 60 Schritte",
      `${fmt(fmin)} / ${fmt(f0)} = ${fmt(s, 6)}`, s, "–", "Konzept V2-A U9, wie D-BIS"));
  } else {
    let lo = Math.log(DESIGN_RANGE[0]), hi = Math.log(DESIGN_RANGE[1]);
    if (!(f1At(Math.exp(hi)) >= fmin)) return { ok: false, trace: T, message: "Keine Lösung bis zum 50-fachen Ausgangsmaß (Zusatzmasse zu groß)" };
    if (f1At(Math.exp(lo)) >= fmin) hi = lo;
    else for (let i = 0; i < DESIGN_STEPS; i++) { const m = (lo + hi) / 2; if (f1At(Math.exp(m)) < fmin) lo = m; else hi = m; }
    s = Math.exp(hi);
    T.push(step("V-B", "Formtreuer Faktor für f₁ = f_min", "s = f_min / f₁ (formtreu, m_z = 0: E·I ∝ s⁴, m′ ∝ s², f₁ ∝ s);  mit m_z > 0: f₁(s) = f_min, Bisektion im log-Raum, 60 Schritte",
      `m_z = ${fmt(v.mz)} kg/m > 0: s ∈ [${fmt(DESIGN_RANGE[0])}; ${fmt(DESIGN_RANGE[1])}], ${DESIGN_STEPS} Schritte, f₁(s) = ${fmt(f1At(s), 6)} Hz`, s, "–", "Konzept V2-A U9, deterministisch, feste Schrittzahl"));
  }
  const raw = dimsAt(s);
  const grid = (k: string) => (k === "t" ? 0.5 : 1);
  const dims: Dims = Object.fromEntries(Object.entries(raw).map(([k, x]) => [k, Math.ceil(x / grid(k) - 1e-9) * grid(k)]));
  const result = computeStrength(repo, { ...inp, dims });
  for (const [k, x] of Object.entries(raw)) T.push(step(`D-ERF-${k}`, `Erforderliches Maß ${k}`, `${k}_erf = ${k}₀·s`, `${fmt(base[k] ?? NaN)}·${fmt(s)}`, x, "mm"));
  for (const [k, x] of Object.entries(dims)) T.push(step(`D-GEW-${k}`, `Gewähltes Maß ${k}`, `${k} aufgerundet auf ${grid(k) === 1 ? "1" : "0,5"} mm`, `${fmt(raw[k] ?? NaN)} → ${fmt(x)}`, x, "mm", "Fertigungsraster"));
  T.push(step("D-U", "Ausnutzung mit gewählten Maßen", "u = max(S_erf / S)", result.governing ? `maßgebend: ${result.governing}` : "", result.util * 100, "%"));
  const f1 = result.vibration?.modes[0]?.f ?? NaN;
  if (f1 < fmin * (1 - 1e-12)) result.warnings.push(`Rundung auf das Fertigungsraster senkt f₁ auf ${fmt(f1)} Hz < f_min, Maße von Hand anpassen`);
  return { ok: true, s, raw, dims, result, trace: T };
}
