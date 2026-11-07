/**
 * Druckstoß beim Schließen einer Armatur (Modul fluid, RH b, eng-core 0.13.0, Entscheidungen R22, R23, Gate G1 erfüllt 06.11.2026).
 *
 * Wellengeschwindigkeit a (Stufen nach R22):
 *   starr: a = √(K/ρ) (Chaudhry Gl. (2-65) mit ψ = 0, Gl. (2-66)); Wasser mit K = ρ·w², w nach IF97 Tab. 3 (obere Schranke);
 *   Richtwert Roloff S. 747 (fd_wave_speed); von Hand;
 *   elastische Rohrwand: a = √(K/(ρ·[1 + (K/E)·ψ])) (Chaudhry Gl. (2-65), S. 50) mit ψ dünnwandig Gl. (2-70) bis (2-72) bzw.
 *   dickwandig Gl. (2-67), (2-69) (S. 51 f.); E und ν der Wand aus der WDB oder von Hand. Dickwandig bei Verankerung am oberen
 *   Ende (Gl. (2-68)) nicht angeboten: Gl. (2-68) geht für dünne Wände nicht in Gl. (2-71) über (Befund, Konzept O-b6).
 * Druckstoß (Roloff 27 Abschn. 18.4 Nr. 4, S. 746 f.): t_R = 2·l/a (18.20); t_S ≤ t_R: Δp = ρ·a·Δv (Joukowsky, 18.21);
 *   t_S > t_R: Δp = ρ·a·Δv·t_R/t_S (18.22, lineares Schließgesetz; die Bedingung l < a·t_S/2 ist gleichbedeutend mit t_S > t_R).
 *   p_max = p + Δp, p_min = p − Δp; Warnung p_min < p_s (Unterdruck, Kavitation). Beide Gleichungen sind Näherungen (Roloff).
 * Nicht im Umfang: zeitlicher Verlauf (Charakteristikenverfahren), Reibungsdämpfung, Wasserschloss, verzweigte Leitungen.
 * Einheiten SI.
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace } from "../trace";
import type { FdRepo } from "./fdData";
import type { FluidCheck, FluidKpi } from "./line";
import { saturationPressure, waterSound } from "./water";

export type SurgeFluid =
  | { kind: "wasser"; T: number; p: number }
  /** Zeile aus fd_bulk_modulus (ρ und K bei Atmosphärendruck). */
  | { kind: "tabelle"; id: string }
  | { kind: "hand"; rho: number; K: number | null };
export type WallAnchor = "a" | "b" | "c";
export type WaveSpec =
  | { kind: "starr" }
  | { kind: "richtwert"; id: string }
  | { kind: "hand"; a: number }
  /** Elastische Wand: Innendurchmesser D und Wanddicke e in m, E in Pa, ν; Verankerung a (ganze Länge), b (oberes Ende), c (Dehnfugen). */
  | { kind: "wand"; D: number; e: number; E: number; nu: number; anchor: WallAnchor; wall: "duenn" | "dick"; material?: string };
export interface SurgeInput {
  label?: string;
  fluid: SurgeFluid;
  wave: WaveSpec;
  /** Länge des Rohrabschnitts bis zur Reflexionsstelle in m. */
  L: number;
  /** Geschwindigkeitsänderung in m/s (Betrag). */
  dv: number;
  /** Schließzeit in s (≥ 0). */
  tS: number;
  /** Absoluter Druck an der Armatur vor dem Schließen in Pa. */
  p: number;
  /** Sättigungsdruck in Pa (Wasser aus IF97, sonst von Hand oder null). */
  ps: number | null;
}
export type SurgeGroup = "stoffwerte" | "druckstoss" | "nachweis";
export interface SurgeResult {
  rho: number; K: number | null; a: number; psi: number | null; tR: number; fast: boolean; dp: number; pMax: number; pMin: number;
  checks: FluidCheck[]; kpis: FluidKpi[]; trace: Trace<SurgeGroup>; errors: string[]; warnings: string[];
}

const REF_CH = "Chaudhry 2014 (Q234)", REF_RO = "Roloff 27 Abschn. 18.4 Nr. 4";
export const ANCHOR_TXT: Record<WallAnchor, string> = { a: "auf ganzer Länge längs verankert", b: "nur am oberen Ende verankert", c: "mit Dehnfugen" };

/** ψ der Rohrwand (Chaudhry Gl. (2-67), (2-69) bis (2-72)); dickwandig mit R_i = D/2, R_o = D/2 + e. */
export function wallPsi(D: number, e: number, nu: number, anchor: WallAnchor, wall: "duenn" | "dick"): number {
  if (wall === "duenn") return anchor === "a" ? (D / e) * (1 - nu * nu) : anchor === "b" ? (D / e) * (1 - 0.5 * nu) : D / e;
  const Ri = D / 2, Ro = D / 2 + e, q = Ro * Ro - Ri * Ri;
  if (anchor === "a") return 2 * (1 + nu) * ((Ro * Ro + Ri * Ri) / q - 2 * nu * Ri * Ri / q);
  if (anchor === "c") return 2 * ((Ro * Ro + Ri * Ri) / q + nu);
  return NaN;
}
/** a = √(K/(ρ·[1 + (K/E)·ψ])) (Chaudhry Gl. (2-65)). */
export const waveSpeed = (K: number, rho: number, E: number, psi: number): number => Math.sqrt(K / (rho * (1 + (K / E) * psi)));

export function computeSurge(fd: FdRepo, inp: SurgeInput): SurgeResult {
  const errors: string[] = [], warnings: string[] = [];
  const G: Trace<SurgeGroup> = {}; const add = (g: SurgeGroup, s: CalcStep) => { (G[g] ??= []).push(s); };
  const tag = inp.label?.trim() ? `${inp.label.trim()}: ` : "";
  const fail = (): SurgeResult => ({ rho: NaN, K: null, a: NaN, psi: null, tR: NaN, fast: true, dp: NaN, pMax: NaN, pMin: NaN, checks: [], kpis: [], trace: G, errors, warnings });
  if (!(inp.L > 0)) errors.push("Druckstoß: Länge muss größer als 0 sein.");
  if (!(inp.dv > 0)) errors.push("Druckstoß: Geschwindigkeitsänderung muss größer als 0 sein.");
  if (!(inp.tS >= 0)) errors.push("Druckstoß: Schließzeit muss mindestens 0 sein.");
  if (!(inp.p > 0)) errors.push("Druckstoß: Druck vor dem Schließen ist absolut und muss größer als 0 sein.");
  // Fluid: ρ und K
  let rho = NaN, K: number | null = null, ps = inp.ps;
  const f = inp.fluid;
  if (f.kind === "wasser") {
    const w = waterSound(f.T, f.p);
    if (w.errors.length) errors.push(...w.errors);
    else { rho = w.rho; K = w.K; w.steps.forEach((s) => add("stoffwerte", s)); }
  } else if (f.kind === "tabelle") {
    const r = fd.bulkModulus(f.id);
    if (!r) errors.push(`Kompressionsmodul ${f.id} nicht in den Fachdaten (fd 1.1).`);
    else {
      rho = r.rho_kg_m3; K = r.k_gpa * 1e9;
      add("stoffwerte", step("FS-K-TAB", "Dichte und Kompressionsmodul (Tabellenwert)", "ρ, K aus fd_bulk_modulus", `${r.id} ${r.liquid} (${r.liquid_source}) ${fmt(r.t_c)} °C: ρ = ${fmt(rho, 6)} kg/m³, K = ${fmt(r.k_gpa, 6)} GPa`, K, "Pa", `${r.source_locator} (${r.source_id})`));
    }
  } else {
    if (!(f.rho > 0)) errors.push("Druckstoß: Dichte von Hand muss größer als 0 sein.");
    if (f.K !== null && !(f.K > 0)) errors.push("Druckstoß: Kompressionsmodul von Hand muss größer als 0 sein.");
    rho = f.rho; K = f.K;
    if (!errors.length) {
      add("stoffwerte", step("FS-MAN-RHO", "Dichte (Eingabe)", "ρ = Eingabe", `ρ = ${fmt(rho, 6)} kg/m³`, rho, "kg/m³", "Eingabe"));
      if (K !== null) add("stoffwerte", step("FS-K-MAN", "Kompressionsmodul (Eingabe)", "K = Eingabe", `K = ${fmt(K / 1e9, 6)} GPa`, K, "Pa", "Eingabe"));
    }
  }
  if (errors.length) return fail();
  // Wellengeschwindigkeit
  const wv = inp.wave;
  let a: number, psi: number | null = null;
  if (wv.kind === "starr" || wv.kind === "wand") {
    if (K === null) { errors.push("Druckstoß: für diese Wellengeschwindigkeit wird der Kompressionsmodul K gebraucht."); return fail(); }
    if (wv.kind === "starr") {
      a = Math.sqrt(K / rho);
      add("druckstoss", step("RH-DS-AW", "Wellengeschwindigkeit bei starrer Wand", "a = √(K/ρ) (ψ = 0)", `${tag}a = √(${fmt(K, 6)}/${fmt(rho, 6)})${f.kind === "wasser" ? " = w (IF97)" : ""}`, a, "m/s", `${REF_CH} Gl. (2-65), (2-66), S. 50`));
      warnings.push("Wellengeschwindigkeit bei starrer Wand: obere Schranke, der Druckstoß wird überschätzt (bei Kunststoffrohren stark).");
    } else {
      if (!(wv.D > 0 && wv.e > 0 && wv.E > 0) || !(wv.nu >= 0 && wv.nu < 0.5)) { errors.push("Rohrwand: D, e, E größer als 0 und 0 ≤ ν < 0,5 nötig."); return fail(); }
      if (wv.wall === "dick" && wv.anchor === "b") { errors.push("Rohrwand: dickwandig mit Verankerung am oberen Ende nicht angeboten (Chaudhry Gl. (2-68), Befund O-b6); dünnwandig wählen."); return fail(); }
      psi = wallPsi(wv.D, wv.e, wv.nu, wv.anchor, wv.wall);
      const mat = wv.material ? `${wv.material}, ` : "";
      if (wv.wall === "duenn")
        add("druckstoss", step("RH-DS-PSI-D", "Wandbeiwert dünnwandig", "ψ = (D/e)·(1 − ν²) | (D/e)·(1 − 0,5ν) | D/e (Verankerung ganze Länge | oberes Ende | Dehnfugen)",
          `${tag}${mat}${ANCHOR_TXT[wv.anchor]}: D/e = ${fmt(wv.D, 6)}/${fmt(wv.e, 6)} = ${fmt(wv.D / wv.e, 6)}, ν = ${fmt(wv.nu, 4)}`, psi, "1", `${REF_CH} Gl. (2-70) bis (2-72), S. 52`));
      else
        add("druckstoss", step("RH-DS-PSI-K", "Wandbeiwert dickwandig", "ψ = 2(1 + ν)·[(R_o² + R_i²)/(R_o² − R_i²) − 2νR_i²/(R_o² − R_i²)] | 2·[(R_o² + R_i²)/(R_o² − R_i²) + ν] (Verankerung ganze Länge | Dehnfugen)",
          `${tag}${mat}${ANCHOR_TXT[wv.anchor]}: R_i = ${fmt(wv.D / 2, 6)} m, R_o = ${fmt(wv.D / 2 + wv.e, 6)} m, ν = ${fmt(wv.nu, 4)}`, psi, "1", `${REF_CH} Gl. (2-67), (2-69), S. 51`));
      a = waveSpeed(K, rho, wv.E, psi);
      add("druckstoss", step("RH-DS-AK", "Wellengeschwindigkeit bei elastischer Rohrwand", "a = √(K/(ρ·[1 + (K/E)·ψ]))",
        `${tag}a = √(${fmt(K, 6)}/(${fmt(rho, 6)}·[1 + (${fmt(K, 6)}/${fmt(wv.E, 6)})·${fmt(psi, 6)}]))`, a, "m/s", `${REF_CH} Gl. (2-65), S. 50`));
    }
  } else if (wv.kind === "richtwert") {
    const r = fd.waveSpeed(wv.id);
    if (!r) { errors.push(`Richtwert Wellengeschwindigkeit ${wv.id} nicht in den Fachdaten (fd 1.1).`); return fail(); }
    a = r.a_m_s;
    add("druckstoss", step("RH-DS-AR", "Wellengeschwindigkeit (Richtwert)", "a aus fd_wave_speed", `${tag}${r.id} ${r.case}: a = ${fmt(a)} m/s`, a, "m/s", `${r.source_locator} (${r.source_id})`));
  } else {
    if (!(wv.a > 0)) { errors.push("Wellengeschwindigkeit von Hand muss größer als 0 sein."); return fail(); }
    a = wv.a;
    add("druckstoss", step("RH-DS-AH", "Wellengeschwindigkeit (Eingabe)", "a = Eingabe", `${tag}a = ${fmt(a, 6)} m/s`, a, "m/s", "Eingabe"));
  }
  const tR = 2 * inp.L / a, fast = inp.tS <= tR;
  add("druckstoss", step("RH-DS-TR", "Reflexionszeit", "t_R = 2·l/a", `${tag}t_R = 2·${fmt(inp.L, 6)}/${fmt(a, 6)}`, tR, "s", `${REF_RO} Gl. (18.20)`));
  let dp: number;
  if (fast) {
    dp = rho * a * inp.dv;
    add("druckstoss", step("RH-DS-J", "Druckstoß bei schnellem Schließen (Joukowsky)", "Δp = ρ·a·Δv (t_S ≤ t_R)", `${tag}t_S = ${fmt(inp.tS, 6)} s ≤ t_R = ${fmt(tR, 6)} s: Δp = ${fmt(rho, 6)}·${fmt(a, 6)}·${fmt(inp.dv, 6)}`, dp, "Pa", `${REF_RO} Gl. (18.21)`));
  } else {
    dp = rho * a * inp.dv * tR / inp.tS;
    add("druckstoss", step("RH-DS-L", "Druckstoß bei langsamem Schließen (Stoßabminderung)", "Δp = ρ·a·Δv·t_R/t_S (t_S > t_R, gleichbedeutend mit l < a·t_S/2; lineares Schließgesetz)",
      `${tag}t_S = ${fmt(inp.tS, 6)} s > t_R = ${fmt(tR, 6)} s: Δp = ${fmt(rho, 6)}·${fmt(a, 6)}·${fmt(inp.dv, 6)}·${fmt(tR, 6)}/${fmt(inp.tS, 6)}`, dp, "Pa", `${REF_RO} Gl. (18.22)`));
    warnings.push("Langsames Schließen: Gl. (18.22) setzt ein lineares Schließgesetz voraus; reale Armaturen schließen meist zum Ende hin schneller (Näherung).");
  }
  const pMax = inp.p + dp, pMin = inp.p - dp;
  add("druckstoss", step("RH-DS-P", "Extremdrücke an der Armatur", "p_max = p + Δp; p_min = p − Δp", `${tag}p = ${fmt(inp.p, 6)} Pa: p_max = ${fmt(pMax, 6)} Pa, p_min = ${fmt(pMin, 6)} Pa`, pMax, "Pa", `${REF_RO} S. 747`));
  const checks: FluidCheck[] = [];
  if (f.kind === "wasser" && ps === null) ps = saturationPressure(f.T);
  if (ps !== null) {
    const ok = pMin >= ps;
    checks.push({ key: "druckstoss", label: "Unterdruck beim Druckstoß", ok, text: `p_min = ${fmt(pMin / 1e5, 4)} bar ${ok ? "≥" : "<"} p_s = ${fmt(ps / 1e5, 4)} bar` });
    add("nachweis", step("RH-DS-N", "Unterdruck beim Druckstoß", "p_min ≥ p_s", `${tag}p_min = ${fmt(pMin, 6)} Pa ${ok ? "≥" : "<"} p_s = ${fmt(ps, 6)} Pa: ${ok ? "kein Abreißen der Wassersäule" : "Unterdruck, Kavitation möglich"}`, pMin / ps, "1", `${REF_RO} S. 747; IAPWS-IF97 Gl. (30)`));
    if (!ok) warnings.push("Druckstoß: der Unterdruck erreicht den Dampfdruck (Abreißen der Flüssigkeitssäule möglich); Maßnahmen nach Roloff S. 747 prüfen.");
  } else checks.push({ key: "druckstoss", label: "Unterdruck beim Druckstoß", ok: null, text: "kein Dampfdruck bekannt" });
  warnings.push("Druckstoß nach Roloff Gl. (18.21), (18.22): Näherung ohne zeitlichen Verlauf, Reibung und Reflexionen an Verzweigungen.");
  const kpis: FluidKpi[] = [
    { key: "dp", label: "Druckstoß", sym: "Δp", value: dp, unit: "Pa", primary: true },
    { key: "pMax", label: "Größter Druck", sym: "p_max", value: pMax, unit: "Pa", primary: true },
    { key: "pMin", label: "Kleinster Druck", sym: "p_min", value: pMin, unit: "Pa" },
    { key: "a", label: "Wellengeschwindigkeit", sym: "a", value: a, unit: "m/s", primary: true },
    { key: "tR", label: "Reflexionszeit", sym: "t_R", value: tR, unit: "s" },
  ];
  return { rho, K, a, psi, tR, fast, dp, pMax, pMin, checks, kpis, trace: G, errors, warnings };
}
