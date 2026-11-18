/**
 * Auslegung O-Ring (Aufgabe B) und Datenblatt (Modul dichtungen, eng-core 0.20.0), Konzept fachtools/konzept_or.md Abschn. 4.8
 * (OR-AD2, OR-ATX, OR-ANG, OR-AD1, OR-AAX, OR-WAHL) und 7a (/normteile). Auslegung nach ISO 3601-2 Anhang B (Kolben B.2, Stange B.3),
 * Flansch nach Parker 2.2.2 mit h aus Tab. 2.3; danach werden alle Normringe der Schnurstärke mit Aufgabe A nachgerechnet (O7).
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace } from "../trace";
import { csSelectOf, grooveOf, OR_EPS, OR_REF_ISO1, OR_REF_ISO2, OR_REF_PARKER, sizeByDims, sizeOf, sizesOfD2, surfacesOf, type FdOringGroove, type FdOringSize, type FdOringSurface, type OrRepo } from "./oringData";
import { dimLimits, ringTolerances, type OrDim } from "./tolerance";
import { applicationOf, checkOring, compressionLimits, grooveInstall, oringDesignation, type OrGroup, type OringInput, type OringResult, type OrInstall, type OrMotion, type OrSorte } from "./oring";

export interface OrCandidate {
  size: string; d1: number; d2: number; valid: boolean; status: "gültig" | "ungültig" | "nicht bewertbar"; reason: string;
  Cmin: number | null; Cmax: number | null; Smax: number | null; Umax: number | null; Fmax: number | null; g: number | null; score: number | null;
}
export interface OrDesign {
  d2: number; C: number; tx: number;
  /** Nennmaß des berechneten Einbauraums (Kolben d₃, Stange d₆, Flansch h) mit Passung */
  groove: { name: "d₃" | "d₆" | "h"; dim: OrDim };
  /** d₁,max (Kolben, Stange) bzw. Ziel-d₁ (Flansch) */
  d1Ref: number;
  candidates: OrCandidate[]; best: OrCandidate | null;
  /** Eingabe für Aufgabe A mit dem besten Normring (Übernahme „als Ring nachrechnen“) */
  bestInput: OringInput | null;
}

/** Pflichtnachweise der Ringwahl (vom Ring abhängig, U-or6); Spalt und Stützring gelten für den Einbauraum und stehen im Ergebnis. */
export const OR_WAHL_KEYS: readonly string[] = ["verpressung", "dehnung", "stauchung", "fuellung", "montage"];

/** Eingabe Aufgabe A aus der Auslegung: berechneter Einbauraum und gewählter Normring. */
function aInput(inp: OringInput, g: { name: "d₃" | "d₆" | "h"; dim: OrDim }, size: FdOringSize): OringInput {
  const ring = { ...inp.ring, size: size.size_code, d1: null, d2: null, tolD1: null, tolD2: null };
  return { ...inp, task: "A", ring, ...(g.name === "d₃" ? { d3: g.dim } : g.name === "d₆" ? { d6: g.dim } : { h: g.dim }), design: null };
}

/**
 * Aufgabe B Auslegen: d₂ nach Tab. B.1/B.2 (Flansch von Hand), t_x aus der Ziel-Verpressung, Nutgrund, d₁,max, dann alle Normringe der
 * Schnurstärke (fd_oring_sizes) nachrechnen; gültig, wenn alle Pflichtnachweise erfüllt sind; sortiert nach Abstand der Verpressungsmitte
 * zur Bandmitte, dann S_max (Flansch: Abstand d₁ zum Ziel-d₁).
 */
export function designOring(r: OrRepo, inp: OringInput): OringResult {
  const errors: string[] = [];
  const trace: Trace<OrGroup> = {};
  const add = (s: CalcStep) => { (trace.auslegung ??= []).push(s); };
  const app = applicationOf(inp.install, inp.motion);
  const fail = (): OringResult => ({ task: "B", install: inp.install, motion: inp.motion, application: app, size: null, designation: null, groove: null, material: null, values: null, checks: [], ok: null, materials: [], gapAllowed: null, backup: null, dims: {}, trace, errors, warnings: [] });
  const flange = inp.install === "flansch_innen" || inp.install === "flansch_aussen";
  if (flange && inp.motion !== "statisch") { errors.push("Flansch (axial) nur statisch"); return fail(); }
  const refName = inp.install === "kolben" ? "d₄" : inp.install === "stange" ? "d₅" : inp.install === "flansch_innen" ? "d₇" : "d₈";
  const refDim = inp.install === "kolben" ? inp.d4 : inp.install === "stange" ? inp.d5 : inp.install === "flansch_innen" ? inp.d7 : inp.d8;
  if (!refDim) { errors.push(`${refName} fehlt`); return fail(); }
  const L = dimLimits(r, refName, refDim);
  if (typeof L === "string") { errors.push(L); return fail(); }

  // OR-AD2
  let d2: number;
  if (inp.design?.d2) { d2 = inp.design.d2; add(step("OR-AD2", "Schnurstärke", "aus d₄ (Kolben) bzw. d₅ (Stange) nach Tab. B.1, B.2", `von Hand d₂ = ${fmt(d2)} mm`, d2, "mm", `${OR_REF_ISO2} Tab. B.1, B.2`)); }
  else if (flange) { errors.push("Flansch: Schnurstärke d₂ angeben"); return fail(); }
  else {
    const cs = csSelectOf(r, inp.install as "kolben" | "stange", L.nom);
    if (!cs) { errors.push(`${refName} = ${fmt(L.nom)} mm außerhalb Tab. B.${inp.install === "kolben" ? 1 : 2}: Schnurstärke von Hand angeben`); return fail(); }
    d2 = cs.d2_mm;
    add(step("OR-AD2", "Schnurstärke", "aus d₄ (Kolben) bzw. d₅ (Stange) nach Tab. B.1, B.2", `${refName} = ${fmt(L.nom)} mm im Bereich ${cs.d_min_incl ? "" : "über "}${fmt(cs.d_min_mm)} bis ${fmt(cs.d_max_mm)} mm: d₂ = ${fmt(d2)} mm`, d2, "mm", `${OR_REF_ISO2} Tab. B.${inp.install === "kolben" ? 1 : 2}`));
  }
  const cz = compressionLimits(r, app, d2);
  const C = inp.design?.C ?? (cz.min + cz.max) / 2;
  const cText = inp.design?.C !== null && inp.design?.C !== undefined ? `von Hand C = ${fmt(C)} %` : `Bandmitte Bild 8 (${fmt(cz.min)} + ${fmt(cz.max)})/2 = ${fmt(C)} % (U-or8)`;
  let tx: number;
  let g: { name: "d₃" | "d₆" | "h"; dim: OrDim }, d1Ref: number;
  const groove: FdOringGroove | null = grooveOf(r, grooveInstall(inp.install, inp.motion), d2);
  tx = d2 - C * d2 / 100;
  add(step("OR-ATX", "Einbauraumtiefe", "t_x = d₂ − C·d₂/100; C von Hand (ISO B.2 mit C_nom, B.3 mit C_max), ohne Vorgabe Bandmitte Bild 8", `${cText}: t_x = ${fmt(d2)} − ${fmt(C)}·${fmt(d2)}/100 = ${fmt(tx, 6)} mm (ohne Rundung, B-or5)`, tx, "mm", `${OR_REF_ISO2} Gl. (B.4), (B.8)`));
  if (!flange) {
    if (inp.install === "kolben") {
      const d3 = L.nom - 2 * tx; g = { name: "d₃", dim: { nom: d3, fit: "h9" } };
      add(step("OR-ANG", "Nutgrund", "d₃ = d₄ − 2·t_x bzw. d₆ = d₅max + 2·t_x", `d₃ = ${fmt(L.nom)} − 2·${fmt(tx, 6)} = ${fmt(d3, 6)} mm, Passung h9`, d3, "mm", `${OR_REF_ISO2} Gl. (B.5)`));
      d1Ref = 0.98 * d3;
      add(step("OR-AD1", "Innendurchmesser", "d₁,max = 0,98·d₃ bzw. 0,98·d₅max", `d₁,max = 0,98·${fmt(d3, 6)} = ${fmt(d1Ref, 6)} mm`, d1Ref, "mm", `${OR_REF_ISO2} Gl. (B.6)`));
    } else {
      const d6 = L.max + 2 * tx; g = { name: "d₆", dim: { nom: d6, fit: "H9" } };
      add(step("OR-ANG", "Nutgrund", "d₃ = d₄ − 2·t_x bzw. d₆ = d₅max + 2·t_x", `d₆ = ${fmt(L.max, 6)} + 2·${fmt(tx, 6)} = ${fmt(d6, 6)} mm, Passung H9`, d6, "mm", `${OR_REF_ISO2} Gl. (B.9)`));
      d1Ref = 0.98 * L.max;
      add(step("OR-AD1", "Innendurchmesser", "d₁,max = 0,98·d₃ bzw. 0,98·d₅max", `d₁,max = 0,98·${fmt(L.max, 6)} = ${fmt(d1Ref, 6)} mm`, d1Ref, "mm", `${OR_REF_ISO2} Gl. (B.10)`));
    }
  } else {
    const htol = groove?.t_tol_mm ?? 0.1;
    g = { name: "h", dim: { nom: tx, fit: null, dev: [-htol / 2, htol / 2] } };
    d1Ref = inp.install === "flansch_innen" ? L.nom / (1 - 0.02) - 2 * d2 : L.nom / 1.03;
    add(step("OR-AAX", "Flansch", "Innendruck: d₇ so, dass U im Bereich 1 bis 3 % (Ziel 2 %): d₁ = d₇/(1 − 0,02) − 2·d₂; Außendruck: S ≤ 6 % (Ziel 3 %): d₁ = d₈/1,03; h = t_x mittig im Toleranzfeld aus Tab. 2.3 (±Δh/2, eigene Festlegung U-or8)",
      `h = t_x = ${fmt(tx, 6)} mm ± ${fmt(htol / 2)} mm (Parker Tab. 2.3: ${groove ? fmt(groove.t_mm) : "–"} mm, U-or8); ${inp.install === "flansch_innen" ? `d₁ = ${fmt(L.nom)}/0,98 − 2·${fmt(d2)}` : `d₁ = ${fmt(L.nom)}/1,03`} = ${fmt(d1Ref, 6)} mm (Ziel)`, d1Ref, "mm", `${OR_REF_PARKER} 2.2.2, Tab. 2.3; ${OR_REF_ISO2} Tab. 7`));
  }

  // OR-WAHL: alle Normringe der Schnurstärke nachrechnen
  const czMid = (cz.min + cz.max) / 2;
  const candidates: OrCandidate[] = [];
  for (const s of sizesOfD2(r, d2)) {
    const a = checkOring(r, aInput(inp, g, s));
    if (a.errors.length || !a.values) { candidates.push({ size: s.size_code, d1: s.d1_mm, d2: s.d2_mm, valid: false, status: "ungültig", reason: a.errors.join("; "), Cmin: null, Cmax: null, Smax: null, Umax: null, Fmax: null, g: null, score: null }); continue; }
    const req = a.checks.filter((c) => OR_WAHL_KEYS.includes(c.key));
    const bad = req.filter((c) => c.ok === false), open = req.filter((c) => c.ok === null);
    const v = a.values;
    const score = flange ? Math.abs(s.d1_mm - d1Ref) : Math.abs((v.Cmin + v.Cmax) / 2 - czMid);
    candidates.push({ size: s.size_code, d1: s.d1_mm, d2: s.d2_mm, valid: !bad.length && !open.length, status: bad.length ? "ungültig" : open.length ? "nicht bewertbar" : "gültig",
      reason: bad.length ? bad.map((c) => c.label).join(", ") : open.length ? `nicht bewertbar: ${open.map((c) => c.label).join(", ")}` : "alle Pflichtnachweise erfüllt",
      Cmin: v.Cmin, Cmax: v.Cmax, Smax: v.Smax, Umax: v.Umax, Fmax: v.Fmax, g: v.g, score });
  }
  const key2 = (c: OrCandidate) => flange ? c.d1 : c.Smax ?? 0;
  const ok = candidates.filter((c) => c.valid).sort((a, b) => a.score! - b.score! || key2(a) - key2(b) || (a.size < b.size ? -1 : 1));
  const best = ok[0] ?? null;
  add(step("OR-WAHL", "Normring-Auswahl", "alle Ringe der Reihe d₂ aus fd_oring_sizes nachrechnen, gültig wenn die Pflichtnachweise der Ringwahl erfüllt sind (Verpressung, Dehnung, Stauchung, Nutfüllung, Montage; Spalt gilt für den Einbauraum), sortiert nach |C_Mitte − C_zul,Mitte|, dann S_max (Flansch: |d₁ − d₁,Ziel|)",
    `d₂ = ${fmt(d2)} mm: ${ok.length} von ${candidates.length} gültig${best ? `; bester ${best.size} (${fmt(best.d1)} × ${fmt(best.d2)})` : ""}${ok.length ? `; alle gültigen: ${ok.map((c) => c.size).join(", ")}` : ""}`, ok.length, "", "Verfahren (O7)"));
  const ordered = [...ok, ...candidates.filter((c) => !c.valid)];
  const bestSize = best ? sizeOf(r, best.size)! : null;
  const bestInput = bestSize ? aInput(inp, g, bestSize) : null;
  const design: OrDesign = { d2, C, tx, groove: g, d1Ref, candidates: ordered, best, bestInput };
  if (!bestInput) return { ...fail(), design, warnings: ["kein Normring der Schnurstärke erfüllt alle Pflichtnachweise"] };
  const a = checkOring(r, bestInput);
  const merged: Trace<OrGroup> = { auslegung: trace.auslegung!, ...a.trace };
  return { ...a, task: "B", trace: merged, design };
}

/** Rechnung nach Aufgabe: A Nachrechnen (checkOring), B Auslegen (designOring). */
export function computeOring(r: OrRepo, inp: OringInput): OringResult {
  return inp.task === "B" ? designOring(r, inp) : checkOring(r, inp);
}

export interface OringDatasheet {
  size: FdOringSize | null; d1: number; d2: number; cls: "A" | "B"; tol1: number; tol2: number; Dmin: number; Dmax: number; volume: number | null;
  designation: string | null; groove: FdOringGroove | null; surfaces: FdOringSurface[]; refs: string[]; error: string | null;
}
/** Datenblatt O-Ring und Nut (N-or1, N-or2): Maße mit Toleranz, Bezeichnung, Nut nach Einbauart, Rauheit, Herkunft. */
export function oringDatasheet(r: OrRepo, ring: { size: string | null; d1: number | null; d2: number | null; cls: "A" | "B"; sorte: OrSorte }, install: OrInstall, motion: OrMotion, pulsating = false): OringDatasheet {
  const size = ring.size ? sizeOf(r, ring.size) : ring.d1 && ring.d2 ? sizeByDims(r, ring.d1, ring.d2) : null;
  const d1 = size?.d1_mm ?? ring.d1 ?? NaN, d2 = size?.d2_mm ?? ring.d2 ?? NaN;
  const t = ringTolerances(r, d1, d2, ring.cls, size, null, null);
  const flange = install === "flansch_innen" || install === "flansch_aussen";
  const groove = grooveOf(r, grooveInstall(install, motion), d2);
  const surfaces = surfacesOf(r, flange ? "axial" : motion !== "statisch" ? "dynamisch" : "radial_statisch", pulsating);
  const refs = [size ? `${OR_REF_ISO1} ${size.source_locator}` : `${OR_REF_ISO1} Anhang A`, ...(groove ? [`${OR_REF_PARKER} ${groove.source_locator}`] : []), ...surfaces.map((s) => `${OR_REF_PARKER} ${s.source_locator}`)];
  return { size, d1, d2, cls: ring.cls, tol1: t.tol1, tol2: t.tol2, Dmin: d1 - t.tol1 + 2 * (d2 - t.tol2), Dmax: d1 + t.tol1 + 2 * (d2 + t.tol2), volume: size?.volume_cm3 ?? null,
    designation: size ? oringDesignation(size, ring.cls, ring.sorte) : null, groove, surfaces, refs: [...new Set(refs)], error: t.error };
}

/** Größen der Normreihe für /normteile (N-or1): alle 349 Zeilen nach d₂, dann d₁. */
export function oringSizes(r: OrRepo, d2: number | null = null): FdOringSize[] {
  return d2 === null ? [...r.sizes] : sizesOfD2(r, d2);
}
export { OR_EPS };
