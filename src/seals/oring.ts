/**
 * O-Ring-Auslegung (Modul dichtungen, Präfix OR, eng-core 0.20.0), Konzept fachtools/konzept_or.md (freigegeben F-or1 bis F-or17),
 * Fachdaten fd 1.4 (konzept_or_fd14.md Abschn. 12). Rechenweg nach DIN ISO 3601-2:2010 Abschn. 5.6, 6 und Anhang B (Gl. 1 bis 12,
 * B.1 bis B.11; Ausgabe zurückgezogen, L1), Einbaufälle, Radialspiel und Montage nach Parker PTD 5705, Spaltmaß nach Roloff TB 19-3.
 *   Aufgabe A Nachrechnen (checkOring): Ring, Einbauraum, Betrieb → alle Größen und Nachweise im Worst Case (Grenzmaße, O6).
 *   Aufgabe B Auslegen: oringSelect.ts (computeOring), nutzt checkOring je Normring (OR-WAHL).
 * Einbaufälle: Kolben (Nut im Kolben, Nutgrund d₃, Bohrung d₄, Kolben d₉), Stange (Nut im Gehäuse, Stange d₅, Nutgrund d₆,
 * Gehäusebohrung d₁₀), Flansch axial bei Innendruck (Ring liegt außen an d₇) und Außendruck (Ring liegt innen an d₈), Nuttiefe h.
 * Einheiten intern N, mm, MPa; Druck p in MPa (Tabellen in bar), Temperatur in °C, α in 10⁻⁶/K, Verpressung, Dehnung, Füllgrad in %.
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace } from "../trace";
import {
  grooveOf, materialOf, OR_EPS, OR_REF_ISO1, OR_REF_ISO2, OR_REF_PARKER, OR_REF_ROLOFF, sizeByDims, sizeOf, surfacesOf, csSelectOf,
  type FdOringGroove, type FdOringMaterial, type FdOringSize, type OrApplication, type OrGrooveInstall, type OrRepo,
} from "./oringData";
import { dimLimits, limitsStep, ringTolerances, type OrDim, type OrLimits } from "./tolerance";
import { backupNeed, backupStep, gapAllowed, gapAllowedStep, type OrBackup, type OrGapAllowed } from "./extrusion";
import { mediumCheck, mediumStep, suggestMaterials, suggestStep, tempCheck, tempStep, OR_RATING_TEXT, type OrMaterialSuggestion } from "./oringMaterial";

export type OrInstall = "kolben" | "stange" | "flansch_innen" | "flansch_aussen";
export type OrMotion = "statisch" | "hydraulik" | "pneumatik";
export type OrGroup = "toleranz" | "einbauraum" | "dehnung" | "verpressung" | "fuellung" | "spalt" | "werkstoff" | "auslegung" | "nachweis";
export type OrSorte = "N" | "S" | "CS";

export interface OrRingSpec {
  /** Größenbezeichnung ISO 3601-1 (z. B. "211"); null = über d₁, d₂ (passt eine Normzeile, gilt sie) */
  size: string | null; d1: number | null; d2: number | null;
  cls: "A" | "B";
  /** Toleranzen von Hand (±, mm), z. B. Herstellerangabe; null = Norm */
  tolD1: number | null; tolD2: number | null;
  /** Sortenmerkmal ISO 3601-3 für die Bezeichnung */
  sorte: OrSorte;
}
export interface OringInput {
  task: "A" | "B";
  install: OrInstall; motion: OrMotion;
  ring: OrRingSpec;
  /** Kolben: Bohrung d₄, Nutgrund d₃, Kolben d₉ (für Spalt, Radialspiel, Montage) */
  d4: OrDim | null; d3: OrDim | null; d9: OrDim | null;
  /** Stange: Stange d₅, Nutgrund d₆, Gehäusebohrung d₁₀ (für Spalt, Radialspiel) */
  d5: OrDim | null; d6: OrDim | null; d10: OrDim | null;
  /** Flansch: Nutaußendurchmesser d₇ (Innendruck), Nutinnendurchmesser d₈ (Außendruck), Nuttiefe h (null = Parker Tab. 2.3 mit +0,10) */
  d7: OrDim | null; d8: OrDim | null; h: OrDim | null;
  /** Nutbreite (null = Parker Tab. 2.x mit +0,2 mm, mit Stützringen b₁ bzw. b₂) */
  b: OrDim | null;
  /** Exzentrizität e in mm (Parker 8.24 C) */
  e: number;
  /** Nuttiefe konzentrisch (ISO Gl. 11, 12) oder mit Radialspiel und Exzentrizität (Parker 8.24 B, C; U-or1) */
  depth: "konzentrisch" | "radialspiel";
  /** Spalt im Worst Case (volle Exzentrizität, O5) oder geführt (halbes Durchmesserspiel + e) */
  gap: "worst" | "gefuehrt";
  /** Spalt am Flansch von Hand in mm (null = anliegende Flansche, g = 0) */
  gFlange: number | null;
  /** vorgesehene Stützringe 0, 1, 2 (Nutbreite b₁ bzw. b₂) */
  backup: 0 | 1 | 2;
  /** wechselnde Druckrichtung (zwei Stützringe) */
  pressureBoth: boolean;
  /** größter bei der Montage überfahrener Durchmesser in mm (null = d₉,max beim Kolben, sonst keine Montageprüfung) */
  dM: number | null;
  /** Betriebsdruck in MPa (Überdruck) */
  p: number;
  /** Elastomer (fd_oring_materials.code), Härte Shore A (null = Parker-Standardwerkstoff, ohne Werkstoff 70) */
  material: string | null; shore: number | null;
  /** Medium (fd_oring_media.medium_key) und Betriebstemperaturen in °C */
  medium: string | null; Tmin: number | null; Tmax: number | null;
  /** pulsierender Druck (Rauheit Parker Tab. 2.2 bis 2.12) */
  pulsating: boolean;
  /** Option Temperatur: α des Bauteils mit der Nut in 10⁻⁶/K (OR-TD2, OR-TT, OR-CT, OR-FT) */
  temp: { alphaB: number } | null;
  /** Option Quellung ΔV in % (OR-FQ, OR-N-Q) */
  swell: { dV: number } | null;
  /** Auslegung (Aufgabe B): Ziel-Verpressung C in % (null = Bandmitte Bild 8, Stange C_zul,max nach B.8) und d₂ (null = Tab. B.1/B.2) */
  design: { C: number | null; d2: number | null } | null;
}

export type OrCheckKey = "verpressung" | "dehnung" | "stauchung" | "fuellung" | "spalt" | "montage" | "temperatur" | "medium" | "quellung" | "gueltig" | "oberflaeche";
export type OrCheckState = "erfüllt" | "nicht erfüllt" | "nicht bewertbar" | "Hinweis";
export interface OrCheck { key: OrCheckKey; id: string; label: string; ok: boolean | null; /** Pflichtnachweis für die Auslegung (OR-WAHL) */ required: boolean; state: OrCheckState; text: string }

/** Kennwerte eines Rechenlaufs (mm, %, mm², bar, °C); null = nicht berechnet bzw. nicht zutreffend. */
export interface OrValues {
  d1: number; d2: number; tol1: number; tol2: number; d1min: number; d1max: number; d2min: number; d2max: number; Dmin: number; Dmax: number;
  tnom: number; tmin: number; tmax: number; bmin: number; bmax: number;
  Snom: number | null; Smin: number | null; Smax: number | null; Unom: number | null; Umin: number | null; Umax: number | null; SM: number | null;
  Rmin: number; Rmax: number; d2smin: number; d2smax: number; Cmin: number; Cmax: number; Cnom: number; dmin: number; dmax: number; Czmin: number; Czmax: number;
  AORmin: number; AORmax: number; ANmin: number; ANmax: number; Fmin: number; Fmax: number; FQ: number | null; FTmax: number | null; FTmin: number | null;
  g: number | null; gZul: number | null; etaG: number | null; backupNeeded: number;
  rating: number | null; TminW: number | null; TmaxW: number | null; CTminLow: number | null; CTmaxLow: number | null; CTminHigh: number | null; CTmaxHigh: number | null;
  pBar: number; shore: number;
}
export interface OringResult {
  task: "A" | "B"; install: OrInstall; motion: OrMotion; application: OrApplication;
  size: FdOringSize | null; designation: string | null; groove: FdOringGroove | null; material: FdOringMaterial | null;
  values: OrValues | null; checks: OrCheck[]; ok: boolean | null; materials: OrMaterialSuggestion[];
  gapAllowed: OrGapAllowed | null; backup: OrBackup | null;
  /** Grenzmaße der Bauteile (Name ohne Index-Zeichen, z. B. d4, d3, b, h) in mm */
  dims: Record<string, { nom: number; min: number; max: number }>;
  trace: Trace<OrGroup>; errors: string[]; warnings: string[];
  /** Aufgabe B (oringSelect.ts) */
  design?: import("./oringSelect").OrDesign;
}

/** Bezug der Temperaturrechnung (Parker Tab. 8.1, ISO 3601-2 6.4): 24 °C. */
export const OR_T_REF = 24;
/** Nutfüllung höchstens 85 % (ISO 3601-2 6.3). */
export const OR_F_MAX = 85;

/** Einbauart der Nutmaßtabelle (fd_oring_grooves) zum Einbaufall. */
export function grooveInstall(install: OrInstall, motion: OrMotion): OrGrooveInstall {
  if (install === "flansch_innen" || install === "flansch_aussen") return "axial";
  return motion === "hydraulik" ? "hydr_dyn" : motion === "pneumatik" ? "pneu_dyn" : "radial_statisch";
}
/** Anwendung in ISO 3601-2 Bild 8: a dynamisch Hydraulik, b dynamisch Pneumatik, c statisch radial, d axial. */
export function applicationOf(install: OrInstall, motion: OrMotion): OrApplication {
  if (install === "flansch_innen" || install === "flansch_aussen") return "d_axial";
  return motion === "hydraulik" ? "a_hydr_dyn" : motion === "pneumatik" ? "b_pneu_dyn" : "c_statisch";
}
const APP_TEXT: Record<OrApplication, string> = { a_hydr_dyn: "a dynamisch Hydraulik", b_pneu_dyn: "b dynamisch Pneumatik", c_statisch: "c statisch radial", d_axial: "d axial" };

/** OR-R: Querschnittsverringerung R in % aus der Dehnung S in % (ISO 3601-2 Gl. 5, 6); S ≤ 0: R = 0 (B-or18); S ≥ 25 % außerhalb. */
export function crossSectionReduction(S: number): number {
  if (S <= 0) return 0;
  if (S <= 3) return 0.01 + 1.06 * S - 0.1 * S * S;
  return 0.56 + 0.59 * S - 0.0046 * S * S;
}
/** OR-CZUL: zulässige Verpressung aus Bild 8, linear in d₂, außerhalb 1,78 bis 6,99 der nächste Wert. */
export function compressionLimits(r: OrRepo, app: OrApplication, d2: number): { min: number; max: number; outside: boolean; text: string } {
  const pts = r.compression.filter((c) => c.application === app).sort((a, b) => a.d2_mm - b.d2_mm);
  const first = pts[0]!, last = pts[pts.length - 1]!;
  if (d2 <= first.d2_mm + OR_EPS) return { min: first.c_min_pct, max: first.c_max_pct, outside: d2 < first.d2_mm - OR_EPS, text: `d₂ ${d2 < first.d2_mm - OR_EPS ? "unter" : "="} ${fmt(first.d2_mm)} mm: ${fmt(first.c_min_pct)} bis ${fmt(first.c_max_pct)} %` };
  if (d2 >= last.d2_mm - OR_EPS) return { min: last.c_min_pct, max: last.c_max_pct, outside: d2 > last.d2_mm + OR_EPS, text: `d₂ ${d2 > last.d2_mm + OR_EPS ? "über" : "="} ${fmt(last.d2_mm)} mm: ${fmt(last.c_min_pct)} bis ${fmt(last.c_max_pct)} %` };
  const i = pts.findIndex((p) => p.d2_mm >= d2 - OR_EPS);
  const b = pts[i]!, a = pts[i - 1]!;
  if (Math.abs(b.d2_mm - d2) < OR_EPS) return { min: b.c_min_pct, max: b.c_max_pct, outside: false, text: `d₂ = ${fmt(d2)} mm: ${fmt(b.c_min_pct)} bis ${fmt(b.c_max_pct)} %` };
  const w = (d2 - a.d2_mm) / (b.d2_mm - a.d2_mm);
  const min = a.c_min_pct + w * (b.c_min_pct - a.c_min_pct), max = a.c_max_pct + w * (b.c_max_pct - a.c_max_pct);
  return { min, max, outside: false, text: `linear zwischen ${fmt(a.d2_mm)} mm (${fmt(a.c_min_pct)} bis ${fmt(a.c_max_pct)} %) und ${fmt(b.d2_mm)} mm (${fmt(b.c_min_pct)} bis ${fmt(b.c_max_pct)} %): ${fmt(min)} bis ${fmt(max)} %` };
}
/** Bezeichnung nach ISO 3601-1 Abschn. 7.1, z. B. „O-Ring-ISO3601-1-211B-20,22×3,53-S“; nur für Normgrößen. */
export function oringDesignation(size: FdOringSize, cls: "A" | "B", sorte: OrSorte): string {
  const f = (x: number) => x.toFixed(2).replace(".", ",");
  return `O-Ring-ISO3601-1-${size.size_code}${cls}-${f(size.d1_mm)}×${f(size.d2_mm)}-${sorte}`;
}

const pct = (x: number | null) => fmt(x, 4);

/** Aufgabe A: Nachrechnen einer O-Ring-Dichtstelle mit allen Nachweisen (Worst Case über Grenzmaße). */
export function checkOring(r: OrRepo, inp: OringInput): OringResult {
  const errors: string[] = [], warnings: string[] = [];
  const trace: Trace<OrGroup> = {};
  const add = (g: OrGroup, s: CalcStep) => { (trace[g] ??= []).push(s); };
  const app = applicationOf(inp.install, inp.motion);
  const flange = inp.install === "flansch_innen" || inp.install === "flansch_aussen";
  const dynamic = inp.motion !== "statisch";
  const dims: Record<string, { nom: number; min: number; max: number }> = {};
  const empty = (): OringResult => ({ task: inp.task, install: inp.install, motion: inp.motion, application: app, size: null, designation: null, groove: null, material: null, values: null, checks: [], ok: null, materials: [], gapAllowed: null, backup: null, dims, trace, errors, warnings });

  // ---------------------------------------------------------------- Eingaben prüfen
  if (flange && dynamic) errors.push("Flansch (axial) nur statisch");
  if (!(inp.p >= 0)) errors.push("Druck muss ≥ 0 sein");
  if (!(inp.e >= 0)) errors.push("Exzentrizität e muss ≥ 0 sein");
  if (inp.Tmin !== null && inp.Tmax !== null && inp.Tmin > inp.Tmax) errors.push("T_min größer als T_max");
  const mat = inp.material ? materialOf(r, inp.material) : null;
  if (inp.material && !mat) errors.push(`Elastomer ${inp.material} nicht in fd_oring_materials`);
  if (inp.medium && !r.media.some((m) => m.medium_key === inp.medium)) errors.push(`Medium ${inp.medium} nicht in der Medienauswahl`);
  if (inp.swell && !Number.isFinite(inp.swell.dV)) errors.push("Quellung ΔV muss eine Zahl sein");
  let size: FdOringSize | null = null, d1: number, d2: number;
  if (inp.ring.size) {
    size = sizeOf(r, inp.ring.size);
    if (!size) { errors.push(`Größe ${inp.ring.size} nicht in ISO 3601-1 Tab. 1 bis 6`); return empty(); }
    d1 = size.d1_mm; d2 = size.d2_mm;
  } else {
    d1 = inp.ring.d1 ?? NaN; d2 = inp.ring.d2 ?? NaN;
    if (!(d1 > 0)) errors.push("d₁ muss größer als 0 sein");
    if (!(d2 > 0)) errors.push("d₂ muss größer als 0 sein");
    if (d1 > 0 && d2 > 0) size = sizeByDims(r, d1, d2);
  }
  if (errors.length) return empty();

  // ---------------------------------------------------------------- Toleranzen und Grenzmaße (4.1)
  const rt = ringTolerances(r, d1, d2, inp.ring.cls, size, inp.ring.tolD1, inp.ring.tolD2);
  rt.steps.forEach((s) => add("toleranz", s));
  if (rt.error) { errors.push(rt.error); return empty(); }
  const tol1 = rt.tol1, tol2 = rt.tol2;
  const d1min = d1 - tol1, d1max = d1 + tol1, d2min = d2 - tol2, d2max = d2 + tol2;
  add("toleranz", step("OR-D2GM", "Grenzmaße O-Ring", "d₁ ± Δd₁, d₂ ± Δd₂",
    `d₁ = ${fmt(d1)} ± ${fmt(tol1)}: ${fmt(d1min, 6)} bis ${fmt(d1max, 6)} mm; d₂ = ${fmt(d2)} ± ${fmt(tol2)}: ${fmt(d2min, 6)} bis ${fmt(d2max, 6)} mm`, d2min, "mm", `${OR_REF_ISO1} Abschn. 6`));
  const Dmin = d1min + 2 * d2min, Dmax = d1max + 2 * d2max;
  add("toleranz", step("OR-DA", "Außendurchmesser O-Ring", "D = d₁ + 2·d₂ (min, max)", `D_min = ${fmt(d1min, 6)} + 2·${fmt(d2min, 6)} = ${fmt(Dmin, 6)} mm; D_max = ${fmt(d1max, 6)} + 2·${fmt(d2max, 6)} = ${fmt(Dmax, 6)} mm`, Dmin, "mm", `${OR_REF_ISO2} 6.1.2.1; ${OR_REF_ROLOFF} TB 19-2b`));

  const gInst = grooveInstall(inp.install, inp.motion);
  const groove = grooveOf(r, gInst, d2);
  const lim = (name: string, d: OrDim | null, need: boolean): OrLimits | null => {
    if (!d) { if (need) errors.push(`${name} fehlt`); return null; }
    const L = dimLimits(r, name, d);
    if (typeof L === "string") { errors.push(L); return null; }
    add("toleranz", limitsStep(name, d, L, r));
    dims[name.replace("₁₀", "10").replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))] = { nom: L.nom, min: L.min, max: L.max };
    return L;
  };
  let D4: OrLimits | null = null, D3: OrLimits | null = null, D9: OrLimits | null = null, D5: OrLimits | null = null, D6: OrLimits | null = null, D10: OrLimits | null = null, D7: OrLimits | null = null, D8: OrLimits | null = null, H: OrLimits | null = null;
  if (inp.install === "kolben") { D4 = lim("d₄", inp.d4, true); D3 = lim("d₃", inp.d3, true); D9 = lim("d₉", inp.d9, false); }
  else if (inp.install === "stange") { D5 = lim("d₅", inp.d5, true); D6 = lim("d₆", inp.d6, true); D10 = lim("d₁₀", inp.d10, false); }
  else {
    if (inp.install === "flansch_innen") D7 = lim("d₇", inp.d7, true); else D8 = lim("d₈", inp.d8, true);
    const hDim: OrDim | null = inp.h ?? (groove ? { nom: groove.t_mm, fit: null, dev: [0, groove.t_tol_mm ?? 0] } : null);
    if (!hDim) errors.push(`Nuttiefe h fehlt (keine Zeile in Parker Tab. 2.3 für d₂ = ${fmt(d2)} mm)`);
    else H = lim("h", hDim, true);
  }
  let bDim: OrDim | null = inp.b;
  if (!bDim && groove) {
    const b1: [number | null, number | null] = inp.backup === 1 ? [groove.b1_min_mm, groove.b1_max_mm] : inp.backup === 2 ? [groove.b2_min_mm, groove.b2_max_mm] : [groove.b_mm, groove.b_mm + (groove.b_tol_mm ?? 0)];
    if (b1[0] !== null && b1[1] !== null) bDim = { nom: b1[0], fit: null, dev: [0, b1[1] - b1[0]] };
    else errors.push(`Nutbreite mit ${inp.backup} Stützring${inp.backup === 1 ? "" : "en"} nicht in Parker Tab. 3.x für d₂ = ${fmt(d2)} mm: Nutbreite von Hand eingeben`);
  }
  if (!bDim && !errors.length) errors.push(`Nutbreite b fehlt (keine Zeile in Parker Tab. 2.x für ${gInst}, d₂ = ${fmt(d2)} mm)`);
  const B = bDim ? lim("b", bDim, true) : null;
  if (errors.length) return empty();

  // ---------------------------------------------------------------- Einbauraum (4.2)
  let tnom: number, tmin: number, tmax: number;
  if (inp.install === "kolben") {
    tnom = (D4!.nom - D3!.nom) / 2; tmin = (D4!.min - D3!.max) / 2; tmax = (D4!.max - D3!.min) / 2;
    add("einbauraum", step("OR-TK", "Nuttiefe Kolben", "t = (d₄ − d₃)/2, t_min = (d₄min − d₃max)/2, t_max = (d₄max − d₃min)/2",
      `t = (${fmt(D4!.nom)} − ${fmt(D3!.nom)})/2 = ${fmt(tnom, 6)}; t_min = (${fmt(D4!.min, 6)} − ${fmt(D3!.max, 6)})/2 = ${fmt(tmin, 6)}; t_max = (${fmt(D4!.max, 6)} − ${fmt(D3!.min, 6)})/2 = ${fmt(tmax, 6)} mm`, tmax, "mm", `${OR_REF_ISO2} Gl. (11); ${OR_REF_PARKER} 8.24 A`));
    if (inp.depth === "radialspiel") {
      if (!D9) { errors.push("Radialspiel: Kolbendurchmesser d₉ fehlt"); return empty(); }
      tmax = D4!.max - (D9.min + D3!.min) / 2 + inp.e; tmin = (D9.min - D3!.max) / 2 - inp.e;
      add("einbauraum", step("OR-TEXK", "Nuttiefe Kolben mit Radialspiel und Exzentrizität", "t_max = d₄max − (d₉min + d₃min)/2 + e, t_min = (d₉min − d₃max)/2 − e",
        `t_max = ${fmt(D4!.max, 6)} − (${fmt(D9.min, 6)} + ${fmt(D3!.min, 6)})/2 + ${fmt(inp.e)} = ${fmt(tmax, 6)}; t_min = (${fmt(D9.min, 6)} − ${fmt(D3!.max, 6)})/2 − ${fmt(inp.e)} = ${fmt(tmin, 6)} mm (Größtwert bei d₉min, B-or3)`, tmax, "mm", `${OR_REF_PARKER} 8.24 B, C (B-or3)`));
    }
  } else if (inp.install === "stange") {
    tnom = (D6!.nom - D5!.nom) / 2; tmin = (D6!.min - D5!.max) / 2; tmax = (D6!.max - D5!.min) / 2;
    add("einbauraum", step("OR-TS", "Nuttiefe Stange", "t = (d₆ − d₅)/2, t_min = (d₆min − d₅max)/2, t_max = (d₆max − d₅min)/2",
      `t = (${fmt(D6!.nom)} − ${fmt(D5!.nom)})/2 = ${fmt(tnom, 6)}; t_min = (${fmt(D6!.min, 6)} − ${fmt(D5!.max, 6)})/2 = ${fmt(tmin, 6)}; t_max = (${fmt(D6!.max, 6)} − ${fmt(D5!.min, 6)})/2 = ${fmt(tmax, 6)} mm`, tmax, "mm", `${OR_REF_ISO2} Gl. (12)`));
    if (inp.depth === "radialspiel") {
      if (!D10) { errors.push("Radialspiel: Gehäusebohrung d₁₀ fehlt"); return empty(); }
      tmax = (D6!.max + D10.max) / 2 - D5!.min + inp.e; tmin = (D6!.min - D10.max) / 2 - inp.e;
      add("einbauraum", step("OR-TEXS", "Nuttiefe Stange mit Radialspiel und Exzentrizität", "t_max = (d₆max + d₁₀max)/2 − d₅min + e, t_min = (d₆min − d₁₀max)/2 − e",
        `t_max = (${fmt(D6!.max, 6)} + ${fmt(D10.max, 6)})/2 − ${fmt(D5!.min, 6)} + ${fmt(inp.e)} = ${fmt(tmax, 6)}; t_min = (${fmt(D6!.min, 6)} − ${fmt(D10.max, 6)})/2 − ${fmt(inp.e)} = ${fmt(tmin, 6)} mm (Stange anliegend, unabhängig von d₅; U-or2)`, tmax, "mm", `${OR_REF_PARKER} 8.24 übertragen (Hinweis)`));
    }
  } else {
    tnom = H!.nom; tmin = H!.min; tmax = H!.max;
    add("einbauraum", step("OR-TA", "Nuttiefe axial", "h mit Toleranz (Parker +0,10)", `h = ${fmt(tnom)} mm, h_min = ${fmt(tmin, 6)}, h_max = ${fmt(tmax, 6)} mm`, tmax, "mm", `${OR_REF_PARKER} Tab. 2.3; ${OR_REF_ISO2} Tab. 6`));
  }
  if (!(tmin > 0)) { errors.push(`Nuttiefe t_min = ${fmt(tmin, 4)} mm ≤ 0`); return empty(); }
  if (tnom >= d2 - OR_EPS) { errors.push(`Nuttiefe t = ${fmt(tnom, 4)} mm ≥ d₂ = ${fmt(d2)} mm: keine Verpressung`); return empty(); }
  const bmin = B!.min, bmax = B!.max;
  if (bmin <= d2max + OR_EPS) warnings.push(`Nutbreite b_min = ${fmt(bmin, 4)} mm ≤ d₂,max = ${fmt(d2max, 4)} mm: Nut zu schmal`);

  // Spalt (OR-G)
  let g: number | null = null, gText: string;
  if (inp.install === "kolben") {
    if (D9) { const full = D4!.max - D9.min; g = inp.gap === "worst" ? full : full / 2 + inp.e; gText = inp.gap === "worst" ? `Kolben, Worst Case: g = d₄max − d₉min = ${fmt(D4!.max, 6)} − ${fmt(D9.min, 6)} = ${fmt(g, 6)} mm` : `Kolben, geführt: g = (d₄max − d₉min)/2 + e = ${fmt(full, 6)}/2 + ${fmt(inp.e)} = ${fmt(g, 6)} mm`; }
    else gText = "Kolben ohne d₉: Spalt nicht bewertbar";
  } else if (inp.install === "stange") {
    if (D10) { const full = D10.max - D5!.min; g = inp.gap === "worst" ? full : full / 2 + inp.e; gText = inp.gap === "worst" ? `Stange, Worst Case: g = d₁₀max − d₅min = ${fmt(D10.max, 6)} − ${fmt(D5!.min, 6)} = ${fmt(g, 6)} mm` : `Stange, geführt: g = (d₁₀max − d₅min)/2 + e = ${fmt(full, 6)}/2 + ${fmt(inp.e)} = ${fmt(g, 6)} mm`; }
    else gText = "Stange ohne d₁₀: Spalt nicht bewertbar";
  } else { g = inp.gFlange ?? 0; gText = inp.gFlange === null ? "Flansch: anliegende Flanschflächen, g = 0 mm (von Hand änderbar)" : `Flansch: g = ${fmt(g)} mm von Hand`; }
  if (g !== null && g < 0) { errors.push(`Spalt g = ${fmt(g, 4)} mm < 0 (Bauteile überdecken sich)`); return empty(); }
  add("einbauraum", step("OR-G", "Spaltmaß", "Kolben g = d₄max − d₉min (Worst Case) bzw. (d₄max − d₉min)/2 + e (geführt); Stange g = d₁₀max − d₅min bzw. Hälfte + e; Flansch g von Hand", gText, g ?? NaN, "mm", `${OR_REF_PARKER} 2.3, 8.24; ${OR_REF_ROLOFF} TB 19-3 (O5)`));
  const ANmin = tmin * bmin, ANmax = tmax * bmax;
  add("einbauraum", step("OR-AN", "Nutquerschnitt", "A_N = t·b, A_N,min = t_min·b_min, A_N,max = t_max·b_max",
    `A_N = ${fmt(tnom, 6)}·${fmt(B!.nom)} = ${fmt(tnom * B!.nom, 6)}; A_N,min = ${fmt(tmin, 6)}·${fmt(bmin, 6)} = ${fmt(ANmin, 6)}; A_N,max = ${fmt(tmax, 6)}·${fmt(bmax, 6)} = ${fmt(ANmax, 6)} mm²`, ANmin, "mm²", `${OR_REF_ISO2} Gl. (B.2)`));

  // ---------------------------------------------------------------- Dehnung und Stauchung (4.3)
  let Snom: number | null = null, Smin: number | null = null, Smax: number | null = null, Unom: number | null = null, Umin: number | null = null, Umax: number | null = null;
  if (inp.install === "kolben" || inp.install === "stange" || inp.install === "flansch_aussen") {
    const L = inp.install === "kolben" ? D3! : inp.install === "stange" ? D5! : D8!;
    const nm = inp.install === "kolben" ? "d₃" : inp.install === "stange" ? "d₅" : "d₈";
    Snom = (L.nom - d1) / d1 * 100; Smin = (L.min - d1max) / d1max * 100; Smax = (L.max - d1min) / d1min * 100;
    const id = inp.install === "kolben" ? "OR-SK" : inp.install === "stange" ? "OR-SS" : "OR-SA";
    const title = inp.install === "kolben" ? "Dehnung Kolben" : inp.install === "stange" ? "Dehnung Stange" : "Dehnung Flansch bei Außendruck";
    add("dehnung", step(id, title, `S_min = (${nm}min − d₁max)/d₁max·100, S_max = (${nm}max − d₁min)/d₁min·100`,
      `S = (${fmt(L.nom)} − ${fmt(d1)})/${fmt(d1)}·100 = ${pct(Snom)}; S_min = (${fmt(L.min, 6)} − ${fmt(d1max, 6)})/${fmt(d1max, 6)}·100 = ${pct(Smin)}; S_max = (${fmt(L.max, 6)} − ${fmt(d1min, 6)})/${fmt(d1min, 6)}·100 = ${pct(Smax)} %`, Smax, "%",
      inp.install === "kolben" ? `${OR_REF_ISO2} Gl. (1), (2)` : inp.install === "stange" ? `${OR_REF_ISO2} Gl. (3), (4)` : `${OR_REF_PARKER} 2.2.2; ${OR_REF_ISO2} 6.1.3.1`));
  }
  if (inp.install === "stange" || inp.install === "flansch_innen") {
    const L = inp.install === "stange" ? D6! : D7!, nm = inp.install === "stange" ? "d₆" : "d₇";
    const Dn = d1 + 2 * d2;
    Unom = (Dn - L.nom) / Dn * 100; Umin = (Dmin - L.max) / Dmin * 100; Umax = (Dmax - L.min) / Dmax * 100;
    add("dehnung", step(inp.install === "stange" ? "OR-US" : "OR-UA", inp.install === "stange" ? "Stauchung Stange" : "Stauchung Flansch bei Innendruck",
      `U = (D − ${nm})/D·100, U_min mit D_min und ${nm}max, U_max mit D_max und ${nm}min`,
      `U = (${fmt(Dn, 6)} − ${fmt(L.nom)})/${fmt(Dn, 6)}·100 = ${pct(Unom)}; U_min = (${fmt(Dmin, 6)} − ${fmt(L.max, 6)})/${fmt(Dmin, 6)}·100 = ${pct(Umin)}; U_max = (${fmt(Dmax, 6)} − ${fmt(L.min, 6)})/${fmt(Dmax, 6)}·100 = ${pct(Umax)} %`, Umax, "%",
      inp.install === "stange" ? `${OR_REF_ISO2} 6.1.2.1, Anhang B.3.8` : `${OR_REF_PARKER} 2.2.2; ${OR_REF_ISO2} 6.1.3.1`));
  }
  if (Smax !== null && Smax >= 25 - OR_EPS) { errors.push(`Dehnung S_max = ${fmt(Smax, 4)} % ≥ 25 %: außerhalb ISO 3601-2 Gl. (6)`); return empty(); }
  let SM: number | null = null;
  const dM = inp.dM ?? (inp.install === "kolben" && D9 ? D9.max : null);
  if (dM !== null) {
    SM = (dM - d1min) / d1min * 100;
    add("dehnung", step("OR-SM", "Montagedehnung", "S_M = (d_M − d₁min)/d₁min·100, d_M = d₉max (Kolben) bzw. größter überfahrener Durchmesser",
      `d_M = ${fmt(dM, 6)} mm${inp.dM === null ? " (d₉max)" : " (von Hand)"}: S_M = (${fmt(dM, 6)} − ${fmt(d1min, 6)})/${fmt(d1min, 6)}·100 = ${pct(SM)} %`, SM, "%", `${OR_REF_PARKER} 2.5.4`));
  }

  // ---------------------------------------------------------------- Verpressung (4.4)
  const sLo = Smin ?? 0, sHi = Smax ?? 0;
  const Rmin = crossSectionReduction(sLo), Rmax = crossSectionReduction(sHi);
  const rTxt = (S: number, R: number) => S <= 0 ? `S = ${pct(S)} % ≤ 0: R = 0 (B-or18)` : S <= 3 ? `S = ${pct(S)} % ≤ 3: R = 0,01 + 1,06·${pct(S)} − 0,1·${pct(S)}² = ${pct(R)} %` : `S = ${pct(S)} % > 3: R = 0,56 + 0,59·${pct(S)} − 0,0046·${pct(S)}² = ${pct(R)} %`;
  const rForm = "0 ≤ S ≤ 3: R = 0,01 + 1,06·S − 0,1·S²; 3 < S < 25: R = 0,56 + 0,59·S − 0,0046·S²; S ≤ 0: R = 0; S ≥ 25 % außerhalb (Fehler)";
  const rRef = `${OR_REF_ISO2} Gl. (5), (6); ${OR_REF_PARKER} Bild 8.13`;
  add("verpressung", step("OR-R", "Querschnittsverringerung bei S_max", rForm, `${Smax === null ? "keine Dehnung (Flansch bei Innendruck)" : rTxt(sHi, Rmax)}`, Rmax, "%", rRef));
  if (Smin !== null && Math.abs(sLo - sHi) > 1e-12) add("verpressung", step("OR-R", "Querschnittsverringerung bei S_min", rForm, rTxt(sLo, Rmin), Rmin, "%", rRef));
  const d2smin = d2min * (1 - Rmax / 100), d2smax = d2max * (1 - Rmin / 100);
  add("verpressung", step("OR-D2E", "effektiver Querschnitt", "d₂*min = d₂min·(1 − R(S_max)/100), d₂*max = d₂max·(1 − R(S_min)/100)",
    `d₂*min = ${fmt(d2min, 6)}·(1 − ${pct(Rmax)}/100) = ${fmt(d2smin, 6)}; d₂*max = ${fmt(d2max, 6)}·(1 − ${pct(Rmin)}/100) = ${fmt(d2smax, 6)} mm`, d2smin, "mm", `${OR_REF_ISO2} Gl. (7), (8)`));
  const Cmin = (d2smin - tmax) / d2smin * 100, Cmax = (d2smax - tmin) / d2smax * 100;
  add("verpressung", step("OR-C", "Verpressung", "C_min = (d₂*min − t_max)/d₂*min·100, C_max = (d₂*max − t_min)/d₂*max·100; axial mit h statt t",
    `C_min = (${fmt(d2smin, 6)} − ${fmt(tmax, 6)})/${fmt(d2smin, 6)}·100 = ${pct(Cmin)}; C_max = (${fmt(d2smax, 6)} − ${fmt(tmin, 6)})/${fmt(d2smax, 6)}·100 = ${pct(Cmax)} %`, Cmin, "%", `${OR_REF_ISO2} Gl. (9), (10)`));
  const dmin = d2smin - tmax, dmax = d2smax - tmin;
  add("verpressung", step("OR-CMM", "Verformung", "Δ_min = d₂*min − t_max, Δ_max = d₂*max − t_min", `Δ_min = ${fmt(dmin, 6)} mm, Δ_max = ${fmt(dmax, 6)} mm`, dmin, "mm", `${OR_REF_PARKER} Tab. 3.1, 3.5, 3.8`));
  const Cnom = (d2 - tnom) / d2 * 100;
  add("verpressung", step("OR-CNOM", "Verpressung nominal", "C_nom = (d₂ − t)/d₂·100 mit Nennmaßen", `C_nom = (${fmt(d2)} − ${fmt(tnom, 6)})/${fmt(d2)}·100 = ${pct(Cnom)} %`, Cnom, "%", `${OR_REF_ISO2} Gl. (B.4) umgestellt; ${OR_REF_ROLOFF} TB 19-2b`));
  const cz = compressionLimits(r, app, d2);
  add("verpressung", step("OR-CZUL", "zulässiger Verpressungsbereich", "C_zul,min, C_zul,max aus Bild 8 je Anwendung, linear in d₂", `Anwendung ${APP_TEXT[app]}, ${cz.text}`, cz.min, "%", `${OR_REF_ISO2} Bild 8 (O3)`));

  // ---------------------------------------------------------------- Nutfüllung (4.5)
  const AORmin = Math.PI * (d2smin / 2) ** 2, AORmax = Math.PI * (d2smax / 2) ** 2;
  add("fuellung", step("OR-AOR", "Querschnittsfläche O-Ring", "A_OR = π·(d₂*/2)² (min, max)", `A_OR,min = π·(${fmt(d2smin, 6)}/2)² = ${fmt(AORmin, 6)}; A_OR,max = π·(${fmt(d2smax, 6)}/2)² = ${fmt(AORmax, 6)} mm²`, AORmax, "mm²", `${OR_REF_ISO2} Gl. (B.1)`));
  const Fmax = AORmax / ANmin * 100, Fmin = AORmin / ANmax * 100;
  add("fuellung", step("OR-F", "Füllgrad", "F_max = A_OR,max/A_N,min·100, F_min = A_OR,min/A_N,max·100", `F_max = ${fmt(AORmax, 6)}/${fmt(ANmin, 6)}·100 = ${pct(Fmax)}; F_min = ${fmt(AORmin, 6)}/${fmt(ANmax, 6)}·100 = ${pct(Fmin)} %`, Fmax, "%", `${OR_REF_ISO2} Gl. (B.1) bis (B.3) (B-or13)`));
  let FQ: number | null = null;
  if (inp.swell) {
    FQ = Fmax * (1 + inp.swell.dV / 100);
    add("fuellung", step("OR-FQ", "Füllgrad mit Quellung (Option)", "F_Q = F_max·(1 + ΔV/100)", `F_Q = ${pct(Fmax)}·(1 + ${fmt(inp.swell.dV)}/100) = ${pct(FQ)} %`, FQ, "%", `${OR_REF_PARKER} S. 81; ${OR_REF_ISO2} 6.3 (Übertragung, Hinweis)`));
  }

  // ---------------------------------------------------------------- Werkstoff, Temperatur (4.7) und Option Temperatur
  const alphaE = mat?.alpha_1e6 ?? null;
  let FTmax: number | null = null, FTmin: number | null = null, CTminLow: number | null = null, CTmaxLow: number | null = null, CTminHigh: number | null = null, CTmaxHigh: number | null = null;
  if (inp.temp) {
    if (alphaE === null || inp.Tmin === null || inp.Tmax === null) warnings.push(`Option Temperatur nicht bewertbar: ${alphaE === null ? `α des Elastomers ${mat ? mat.code : "(kein Werkstoff)"} nicht in Parker Tab. 8.1` : "Betriebstemperaturen fehlen"}`);
    else {
      const aE = alphaE * 1e-6, aB = inp.temp.alphaB * 1e-6;
      for (const [T, low] of [[inp.Tmin, true], [inp.Tmax, false]] as const) {
        const dT = T - OR_T_REF, dTs = dT < 0 ? `(${fmt(dT)})` : fmt(dT);
        const s2min = d2smin * (1 + aE * dT), s2max = d2smax * (1 + aE * dT), ttmax = tmax * (1 + aB * dT), ttmin = tmin * (1 + aB * dT);
        add("werkstoff", step("OR-TD2", `Querschnitt bei ${fmt(T)} °C (Option)`, "d₂*(T) = d₂*·(1 + α_E·(T − 24 °C))", `α_E = ${fmt(alphaE)}·10⁻⁶/K, ΔT = ${fmt(dT)} K: d₂*min = ${fmt(s2min, 6)}, d₂*max = ${fmt(s2max, 6)} mm`, s2min, "mm", `${OR_REF_PARKER} Tab. 8.1; ${OR_REF_ISO2} 6.4 (Bezug 24 °C)`));
        add("werkstoff", step("OR-TT", `Nuttiefe bei ${fmt(T)} °C (Option)`, "t(T) = t·(1 + α_B·(T − 24 °C))", `α_B = ${fmt(inp.temp.alphaB)}·10⁻⁶/K: t_min = ${fmt(ttmin, 6)}, t_max = ${fmt(ttmax, 6)} mm`, ttmax, "mm", "α des Bauteils (WDB bzw. von Hand)"));
        const cmn = (s2min - ttmax) / s2min * 100, cmx = (s2max - ttmin) / s2max * 100;
        add("werkstoff", step("OR-CT", `Verpressung bei ${fmt(T)} °C (Option)`, "C(T) wie OR-C mit d₂*(T), t(T)", `C_min = ${pct(cmn)} %, C_max = ${pct(cmx)} %`, cmn, "%", "Übertragung von ISO 3601-2 Gl. (9), (10), Hinweis"));
        const ft = Fmax * (1 + aE * dT) ** 2 / (1 + aB * dT) ** 2;
        add("fuellung", step("OR-FT", `Füllgrad bei ${fmt(T)} °C (Option)`, "F_T = F_max·(1 + α_E·ΔT)²/(1 + α_B·ΔT)²", `F_T = ${pct(Fmax)}·(1 + ${fmt(alphaE)}·10⁻⁶·${dTs})²/(1 + ${fmt(inp.temp.alphaB)}·10⁻⁶·${dTs})² = ${pct(ft)} %`, ft, "%", `${OR_REF_PARKER} 8.5, Tab. 8.1; ${OR_REF_ISO2} 6.4 (Übertragung, Hinweis)`));
        if (low) { CTminLow = cmn; CTmaxLow = cmx; FTmin = ft; } else { CTminHigh = cmn; CTmaxHigh = cmx; FTmax = ft; }
      }
    }
  }
  const tc = mat ? tempCheck(mat, inp.medium, inp.Tmin, inp.Tmax) : null;
  if (tc) add("werkstoff", tempStep(tc));
  const mc = mat ? mediumCheck(r, mat.code, inp.medium) : null;
  if (mc) add("werkstoff", mediumStep(mc));
  const sugg = inp.Tmin !== null && inp.Tmax !== null ? suggestMaterials(r, inp.medium, inp.Tmin, inp.Tmax, dynamic) : [];
  if (inp.Tmin !== null && inp.Tmax !== null) add("werkstoff", suggestStep(sugg, inp.medium));

  // ---------------------------------------------------------------- Spalt und Extrusion (4.6)
  const pBar = inp.p * 10;
  const shore = inp.shore ?? mat?.shore_a ?? 70;
  const factor = mat?.gap_factor ?? 1;
  const ga = gapAllowed(r, shore, pBar, d2, factor);
  add("spalt", gapAllowedStep(ga, shore, pBar, d2));
  const etaG = g !== null && ga.gZul !== null ? g / ga.gZul : null;
  if (etaG !== null) add("spalt", step("OR-GA", "Ausnutzung Spalt", "η_g = g/g_zul", `η_g = ${fmt(g, 6)}/${fmt(ga.gZul, 6)} = ${fmt(etaG, 4)}`, etaG, "1", "eigene Kennzahl"));
  const bk = backupNeed(g, ga.gZul, inp.pressureBoth, groove, pBar, ga.belowTable);
  add("spalt", backupStep(bk));

  // ---------------------------------------------------------------- Nachweise (4.9)
  const checks: OrCheck[] = [];
  const N = (c: OrCheck, s: CalcStep) => { checks.push(c); add("nachweis", s); };
  const st = (ok: boolean | null): OrCheckState => ok === null ? "nicht bewertbar" : ok ? "erfüllt" : "nicht erfüllt";
  // Verpressung
  { const ok = Cmin >= cz.min - OR_EPS && Cmax <= cz.max + OR_EPS; const pmin = inp.motion === "pneumatik" ? 4 : 8;
    const txt = `C_min ${pct(Cmin)} % ${Cmin >= cz.min - OR_EPS ? "≥" : "<"} ${pct(cz.min)} %, C_max ${pct(Cmax)} % ${Cmax <= cz.max + OR_EPS ? "≤" : ">"} ${pct(cz.max)} % (Bild 8 ${APP_TEXT[app]}); Parker-Mindestwert ${pmin} %: ${Cmin >= pmin - OR_EPS ? "erfüllt" : "nicht erfüllt"} (Anzeige)`;
    N({ key: "verpressung", id: "OR-N-C", label: "Verpressung", ok, required: true, state: st(ok), text: txt },
      step("OR-N-C", "Nachweis Verpressung", "C_zul,min ≤ C_min und C_max ≤ C_zul,max; Anzeige Parker-Mindestwert 8 % bzw. 4 %", txt, Cmin, "%", `${OR_REF_ISO2} Bild 8; ${OR_REF_PARKER} S. 13 f.`)); }
  // Dehnung
  { let ok: boolean | null = null, txt: string;
    if (inp.install === "kolben") { const lim = dynamic ? 5 : 8; ok = Smin! >= -OR_EPS && Smax! <= lim + OR_EPS; txt = `S_min ${pct(Smin)} % ${Smin! >= -OR_EPS ? "≥" : "<"} 0, S_max ${pct(Smax)} % ${Smax! <= lim + OR_EPS ? "≤" : ">"} ${lim} % (${dynamic ? "dynamisch" : "statisch"}); Parker ≤ 6 %: ${Smax! <= 6 + OR_EPS ? "eingehalten" : "überschritten"} (Hinweis)`; }
    else if (inp.install === "stange") { const lim = dynamic ? 5 : 8; ok = Smax! <= lim + OR_EPS; txt = `S_max ${pct(Smax)} % ${ok ? "≤" : ">"} ${lim} % (${dynamic ? "dynamisch" : "statisch"}); S_min ${pct(Smin)} % (Ring sitzt über die Stauchung, U-or4)`; }
    else if (inp.install === "flansch_aussen") { ok = Smin! >= -OR_EPS && Smax! <= 6 + OR_EPS; txt = `S_min ${pct(Smin)} % ${Smin! >= -OR_EPS ? "≥" : "<"} 0, S_max ${pct(Smax)} % ${Smax! <= 6 + OR_EPS ? "≤" : ">"} 6 % (Flansch bei Außendruck)`; }
    else { ok = true; txt = "Flansch bei Innendruck: Ring liegt außen an, keine Dehnung (Nachweis über Stauchung)"; }
    N({ key: "dehnung", id: "OR-N-S", label: "Dehnung", ok, required: true, state: st(ok), text: txt },
      step("OR-N-S", "Nachweis Dehnung", "Kolben statisch S_max ≤ 8 %, dynamisch ≤ 5 %, S_min ≥ 0; Stange S_max ≤ 8 % bzw. 5 %; Parker ≤ 6 % als Hinweis; Flansch außen 0 ≤ S ≤ 6 %", txt, Smax ?? 0, "%", `${OR_REF_ISO2} 6.1.1.1; ${OR_REF_PARKER} 2.1, 2.2.2`)); }
  // Stauchung
  { let ok: boolean | null = true, txt = "keine Stauchung (Ring auf Dehnung eingebaut)";
    if (inp.install === "stange" || inp.install === "flansch_innen") {
      const lim = d1 < 250 ? 5 : 3;
      ok = Umin! >= -OR_EPS && Umax! <= lim + OR_EPS;
      txt = `U_min ${pct(Umin)} % ${Umin! >= -OR_EPS ? "≥" : "<"} 0, U_max ${pct(Umax)} % ${Umax! <= lim + OR_EPS ? "≤" : ">"} ${lim} % (d₁ ${d1 < 250 ? "<" : "≥"} 250 mm)`;
      if (inp.install === "flansch_innen") txt += `; nominal U ${pct(Unom)} % ${Unom! >= 1 - OR_EPS && Unom! <= 3 + OR_EPS ? "im" : "außerhalb des"} Parker-Bereichs 1 bis 3 % (Hinweis, U-or4)`;
    }
    N({ key: "stauchung", id: "OR-N-U", label: "Stauchung", ok, required: true, state: st(ok), text: txt },
      step("OR-N-U", "Nachweis Stauchung", "Stange und Flansch innen: U_min ≥ 0, U_max ≤ 5 % (d₁ < 250 mm) bzw. 3 %; Flansch innen nominal 1 bis 3 % als Hinweis", txt, Umax ?? 0, "%", `${OR_REF_ISO2} 6.1.2.1; ${OR_REF_PARKER} 2.2.2`)); }
  // Nutfüllung
  { const parts = [`F_max ${pct(Fmax)} %`]; let worst = Fmax;
    if (FQ !== null) { parts.push(`mit Quellung ${pct(FQ)} %`); worst = Math.max(worst, FQ); }
    if (FTmax !== null) { parts.push(`bei T_max ${pct(FTmax)} %`); worst = Math.max(worst, FTmax); }
    if (FTmin !== null) { worst = Math.max(worst, FTmin); }
    const ok = worst <= OR_F_MAX + OR_EPS;
    const txt = `${parts.join(", ")} ${ok ? "≤" : ">"} ${OR_F_MAX} %`;
    N({ key: "fuellung", id: "OR-N-F", label: "Nutfüllung", ok, required: true, state: st(ok), text: txt },
      step("OR-N-F", "Nachweis Nutfüllung", "F_max ≤ 85 % (mit Optionen F_Q, F_T)", txt, worst, "%", `${OR_REF_ISO2} 6.3`)); }
  // Spalt
  { let ok: boolean | null, txt: string;
    if (g === null) { ok = null; txt = gText; }
    else if (pBar <= 0) { ok = true; txt = `drucklos (p = 0): keine Spaltextrusion, g = ${fmt(g, 4)} mm`; }
    else if (ga.belowTable) { ok = null; txt = `d₂ = ${fmt(d2)} mm unter 1,78 mm: kein Wert in TB 19-3, Spaltnachweis nicht bewertbar (g = ${fmt(g, 4)} mm)`; }
    else if (ga.gZul === null || g > ga.gZul + OR_EPS) {
      if (inp.backup > 0) { ok = null; txt = `${ga.gZul === null ? "Druck über TB 19-3" : `g = ${fmt(g, 4)} mm > g_zul = ${fmt(ga.gZul, 4)} mm`}; ${inp.backup} Stützring${inp.backup === 1 ? "" : "e"} vorgesehen: zulässiger Spalt mit Stützring nach Hersteller (ISO 3601-4 nicht im Umfang, U-or5)`; }
      else { ok = false; txt = bk.text; }
    } else { ok = true; txt = `g = ${fmt(g, 4)} mm ≤ g_zul = ${fmt(ga.gZul, 4)} mm (η_g ${fmt(etaG, 3)})`; }
    N({ key: "spalt", id: "OR-N-G", label: "Spalt und Extrusion", ok, required: true, state: st(ok), text: txt },
      step("OR-N-G", "Nachweis Extrusion", "g ≤ g_zul, sonst Stützring bzw. härterer Werkstoff; drucklos erfüllt; d₂ unter 1,78 mm nicht bewertbar", txt, etaG ?? NaN, "1", `${OR_REF_ROLOFF} TB 19-3`)); }
  // Montage
  { const ok = SM === null ? true : SM <= 50 + OR_EPS;
    const txt = SM === null ? "keine Montagedehnung angegeben (nicht zutreffend)" : `S_M ${pct(SM)} % ${ok ? "≤" : ">"} 50 %`;
    N({ key: "montage", id: "OR-N-M", label: "Montage", ok, required: true, state: SM === null ? "Hinweis" : st(ok), text: txt },
      step("OR-N-M", "Nachweis Montage", "S_M ≤ 50 %", txt, SM ?? 0, "%", `${OR_REF_PARKER} 2.5.4`)); }
  // Temperatur
  { let ok: boolean | null = tc ? tc.ok : null; let txt = tc ? tc.text : "kein Elastomer gewählt";
    if (CTminLow !== null) { const okL = CTminLow >= cz.min - OR_EPS; txt += `; Option Temperatur: C_min bei T_min ${pct(CTminLow)} % ${okL ? "≥" : "<"} ${pct(cz.min)} %`; ok = ok === null ? okL : ok && okL;
      if (CTmaxHigh !== null) txt += `; C_max bei T_max ${pct(CTmaxHigh)} % ${CTmaxHigh <= cz.max + OR_EPS ? "≤" : "> (Hinweis)"} ${pct(cz.max)} %`; }
    N({ key: "temperatur", id: "OR-N-T", label: "Temperatur", ok, required: false, state: st(ok), text: txt },
      step("OR-N-T", "Nachweis Temperatur", "OR-TB erfüllt; mit Option C(T_min) ≥ C_zul,min, dazu C(T_max) ≤ C_zul,max als Hinweis", txt, tc?.margin ?? NaN, "K", `${OR_REF_PARKER} Tab. 6.4, 7.6`)); }
  // Medium
  { const rt2 = mc?.rating ?? null; const ok = rt2 === null ? null : rt2 <= 2 ? true : rt2 === 3 ? true : false;
    const state: OrCheckState = rt2 === null ? "nicht bewertbar" : rt2 <= 2 ? "erfüllt" : rt2 === 3 ? "Hinweis" : "nicht erfüllt";
    const txt = mc ? `${mc.text}${rt2 === 3 ? ": nur bedingt geeignet, Rücksprache mit dem Hersteller" : ""}` : "kein Elastomer gewählt";
    N({ key: "medium", id: "OR-N-MED", label: "Medium", ok, required: false, state, text: txt },
      step("OR-N-MED", "Nachweis Medium", "Bewertung ≤ 2 erfüllt, 3 Hinweis, 4 nicht erfüllt, ohne Angabe nicht bewertbar", txt, rt2 ?? NaN, "", `${OR_REF_PARKER} Kap. 11.3`)); }
  // Quellung (Option)
  if (inp.swell) {
    const lim = dynamic ? 10 : 25, dV = inp.swell.dV; const ok = dV <= lim + OR_EPS;
    const txt = `ΔV ${fmt(dV)} % ${ok ? "≤" : ">"} ${lim} % (${dynamic ? "dynamisch" : "statisch"})${dV < 0 ? "; Schrumpf: Verpressung nimmt ab (Warnung)" : ""}`;
    N({ key: "quellung", id: "OR-N-Q", label: "Quellung", ok, required: false, state: st(ok), text: txt },
      step("OR-N-Q", "Nachweis Quellung (Option)", "ΔV ≤ 25 % statisch, ≤ 10 % dynamisch, Schrumpf < 0 Warnung", txt, dV, "%", `${OR_REF_PARKER} S. 81`));
  }
  // Gültigkeit
  { const notes: string[] = [];
    if (cz.outside) notes.push(`d₂ = ${fmt(d2)} mm außerhalb 1,78 bis 6,99 mm (Bild 8): nächster Wert`);
    if (dynamic && d1 > 250) notes.push(`dynamisch mit d₁ = ${fmt(d1)} mm > 250 mm (Parker S. 34)`);
    if (pBar > 350) notes.push(`Druck ${fmt(pBar)} bar > 350 bar`);
    notes.push(...ga.notes.filter((n) => !n.startsWith("Spaltfaktor")));
    if (inp.install === "kolben" || inp.install === "stange") {
      const ref = inp.install === "kolben" ? D4!.nom : D5!.nom;
      const cs = csSelectOf(r, inp.install, ref);
      if (cs && Math.abs(cs.d2_mm - d2) > 1e-6) notes.push(`Tab. B.${inp.install === "kolben" ? 1 : 2} empfiehlt für ${inp.install === "kolben" ? "d₄" : "d₅"} = ${fmt(ref)} mm d₂ = ${fmt(cs.d2_mm)} mm (Empfehlung)`);
    }
    if (bmin <= d2max + OR_EPS) notes.push(`Nutbreite b_min ${fmt(bmin, 4)} mm ≤ d₂,max: Nut zu schmal`);
    if (mat?.static_only && dynamic) notes.push(`${mat.code} nur für statische Dichtungen (Parker Tab. 6.4)`);
    const txt = notes.length ? notes.join("; ") : "innerhalb der Gültigkeit (d₂ 1,78 bis 6,99 mm, dynamisch d₁ ≤ 250 mm, p ≤ 350 bar)";
    N({ key: "gueltig", id: "OR-N-GUELT", label: "Gültigkeit", ok: notes.length ? null : true, required: false, state: notes.length ? "Hinweis" : "erfüllt", text: txt },
      step("OR-N-GUELT", "Gültigkeit", "d₂ 1,78 bis 6,99 für Bild 8 (sonst nächster Wert), dynamisch d₁ ≤ 250 mm, Druck ≤ 350 bar, d₂ nach Tab. B.1/B.2 als Empfehlung", txt, notes.length, "", `${OR_REF_ISO2} Bild 8, Tab. B.1, B.2; ${OR_REF_PARKER} S. 34`)); }
  // Oberfläche
  { const sInst = flange ? "axial" : dynamic ? "dynamisch" : "radial_statisch";
    const sf = surfacesOf(r, sInst, inp.pulsating);
    const name = { kontakt: "Kontaktfläche", nutgrund: "Nutgrund", fase: "Fase" } as const;
    const txt = `${sInst}${inp.pulsating ? ", pulsierend" : ""}: ` + sf.map((s) => `${name[s.surface]} Ra ${fmt(s.ra_um)} µm, Rmax ${fmt(s.rmax_um)} µm`).join("; ");
    N({ key: "oberflaeche", id: "OR-N-OBF", label: "Oberflächen", ok: null, required: false, state: "Hinweis", text: txt },
      step("OR-N-OBF", "Oberflächen (Anzeige)", "Ra und Rmax der Kontaktfläche, des Nutgrunds und der Fase je Einbaufall", txt, sf.find((s) => s.surface === "kontakt")?.ra_um ?? NaN, "µm", `${OR_REF_PARKER} Tab. 2.2 bis 2.12 (B-or22); ${OR_REF_ISO2} Tab. 1`)); }

  const req = checks.filter((c) => c.required);
  const ok = req.some((c) => c.ok === false) ? false : req.some((c) => c.ok === null) ? null : true;
  const values: OrValues = {
    d1, d2, tol1, tol2, d1min, d1max, d2min, d2max, Dmin, Dmax, tnom, tmin, tmax, bmin, bmax, Snom, Smin, Smax, Unom, Umin, Umax, SM,
    Rmin, Rmax, d2smin, d2smax, Cmin, Cmax, Cnom, dmin, dmax, Czmin: cz.min, Czmax: cz.max, AORmin, AORmax, ANmin, ANmax, Fmin, Fmax, FQ, FTmax, FTmin,
    g, gZul: ga.gZul, etaG, backupNeeded: bk.needed, rating: mc?.rating ?? null, TminW: tc?.limits.tMin ?? null, TmaxW: tc?.limits.tMax ?? null,
    CTminLow, CTmaxLow, CTminHigh, CTmaxHigh, pBar, shore,
  };
  return {
    task: inp.task, install: inp.install, motion: inp.motion, application: app, size, designation: size ? oringDesignation(size, inp.ring.cls, inp.ring.sorte) : null,
    groove, material: mat, values, checks, ok, materials: sugg, gapAllowed: ga, backup: bk, dims, trace, errors, warnings,
  };
}

/** Nachweistext für Ampeln (Kurzfassung der Medienbewertung). */
export function ratingText(rating: number | null): string {
  return rating === null ? "nicht bewertbar" : `${rating} (${OR_RATING_TEXT[rating]})`;
}

export interface OrCompressionProfile {
  /** Ring im verpressten Zustand als Ellipse mit Flächengleichheit: Höhe = t, Breite w = d₂*²/t (Halbachsen t/2, w/2) */
  states: { key: "Cmin" | "Cmax"; d2s: number; t: number; w: number; C: number }[];
  band: { Cmin: number; Cmax: number; Czmin: number; Czmax: number };
  /** Kurve R(S) für S = 0 bis 24,5 % in 0,5-%-Schritten (Gl. 5, 6) und Betriebspunkte */
  curve: { S: number; R: number }[]; points: { S: number; R: number }[];
}
/** Grafik S2 Verpressung: verformter Ring bei C_min (d₂*min in t_max) und C_max (d₂*max in t_min), Band und R(S). */
export function orCompressionProfile(res: OringResult): OrCompressionProfile | null {
  const v = res.values; if (!v) return null;
  const states = [
    { key: "Cmin" as const, d2s: v.d2smin, t: v.tmax, w: v.d2smin ** 2 / v.tmax, C: v.Cmin },
    { key: "Cmax" as const, d2s: v.d2smax, t: v.tmin, w: v.d2smax ** 2 / v.tmin, C: v.Cmax },
  ];
  const curve = Array.from({ length: 50 }, (_, i) => ({ S: i * 0.5, R: crossSectionReduction(i * 0.5) }));
  const points = v.Smin === null || v.Smax === null ? [] : [{ S: v.Smin, R: v.Rmin }, { S: v.Smax, R: v.Rmax }];
  return { states, band: { Cmin: v.Cmin, Cmax: v.Cmax, Czmin: v.Czmin, Czmax: v.Czmax }, curve, points };
}
