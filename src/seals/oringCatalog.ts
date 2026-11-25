/**
 * „Nut zum Ring“ (Katalogweg O-Ring, eng-core 0.22.0, Konzept fachtools/konzept_or_katalog.md Abschn. 7): wie ISO 3601-2 Tab. 2 bis 5
 * und Parker Kap. 3 (Tab. 3.2 bis 3.10) wird zu jeder Normgröße der Einbauraum passend gewählt, statt zuerst die Nut über die
 * Ziel-Verpressung festzulegen (Anhang B, designOring).
 *
 * OR-KAT  Bereich des Nutmaßes x (Kolben Nutgrund d₃ mit h9, Stange Nutgrund d₆ mit H9, Flansch Nuttiefe h ± Δh/2 aus Parker Tab. 2.3),
 *         in dem alle ringabhängigen Pflichtnachweise der Ringwahl (OR_WAHL_KEYS: Verpressung, Dehnung, Stauchung, Nutfüllung,
 *         Montage) im Worst Case erfüllt sind. Prüfer ist checkOring (freigegebene Formeln), keine neue Physik. Suche: Raster 0,05 mm
 *         über das Suchfeld, dann Bisektion beider Grenzen auf 0,0001 mm. Suchfeld aus dem Band von Bild 8 mit Nennmaßen
 *         (t = d₂·(1 − C/100), ohne Toleranzen und Querschnittsverringerung), um 0,15·d₂ je Seite erweitert; es dient nur der Eingrenzung.
 * OR-KATN Nennmaß in der Mitte des Bereichs, gerundet auf 0,05 mm (Parker-Tabellen 0,1 mm, ISO 0,01 mm); liegt der gerundete Wert
 *         nicht im Bereich, der nächste Rasterpunkt 0,05 bzw. 0,01 mm im Bereich, sonst die Mitte ungerundet.
 * OR-KATW Auswahl: Ringe mit Bereich sind gültig; innerhalb der Schnurstärke sortiert nach Spielraum (Breite des Bereichs, absteigend),
 *         dann Größe; Empfehlung: größte zugelassene Schnurstärke mit gültigem Ring (Parker S. 9: größter konstruktiv möglicher
 *         Querschnitt), daraus der Ring mit dem größten Spielraum.
 * Vorauswahl der Ringe (nur Rechenzeit, kein Nachweis): Kolben d₁ zwischen x_min/1,10 und x_max, Stange D = d₁ + 2·d₂ zwischen x_min
 * und 1,10·x_max und d₁ ≥ d₅,min/1,10 (der Ring sitzt über die Stauchung, d₁ darf größer als d₅ sein), Flansch innen D = d₁ + 2·d₂ zwischen d₇ und 1,10·d₇, Flansch außen d₁ zwischen d₈/1,10 und d₈ (Grenzen der Nachweise
 * höchstens 8 % Dehnung bzw. 5 % Stauchung).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { csSelectOf, grooveOf, OR_REF_ISO2, OR_REF_PARKER, sizesOfD2, type FdOringSize, type OrRepo } from "./oringData";
import { dimLimits, type OrDim } from "./tolerance";
import { applicationOf, checkOring, compressionLimits, grooveInstall, type OringInput, type OrInstall, type OrMotion } from "./oring";
import { OR_WAHL_KEYS } from "./oringSelect";

export type OrGrooveName = "d₃" | "d₆" | "h";
export interface OrKatRow {
  size: string; d1: number; d2: number;
  /** zulässiger Bereich des Nennmaßes x (null: kein Bereich) und seine Breite */
  lo: number | null; hi: number | null; span: number | null;
  /** gewähltes Nutmaß mit Passung bzw. Abmaßen (OR-KATN) */
  groove: { name: OrGrooveName; dim: OrDim } | null;
  valid: boolean; reason: string;
  Cmin: number | null; Cmax: number | null; Smax: number | null; Umax: number | null; Fmax: number | null; g: number | null;
  /** Eingabe Aufgabe A zum Nachrechnen der Zeile */
  input: OringInput | null;
  steps: CalcStep[];
}
export interface OrKatGroup { d2: number; rows: OrKatRow[]; best: OrKatRow | null; iso: boolean; allowed: boolean; error: string | null }
export interface OrCatalog {
  install: OrInstall; motion: OrMotion; refName: string;
  groups: OrKatGroup[]; isoD2: number | null; rec: OrKatRow | null;
  /** OR-KATW mit der Empfehlung */
  step: CalcStep | null;
  errors: string[];
}

/** Schnurstärken der Hauptreihe (die d₂ von ISO 3601-2 Bild 8, gleich Parker Tab. 3.1, 3.5, 3.8). */
export function orMainD2(r: OrRepo): number[] { return [...new Set(r.compression.map((c) => c.d2_mm))].sort((a, b) => a - b); }

const GRID = 0.05, TOL = 1e-4, PRE = 1.10, MARGIN = 0.15;

/** Bausteine je Einbaufall: Name, Eingabe mit Nutmaß x, Suchfeld. */
function setup(r: OrRepo, inp: OringInput, d2: number) {
  const flange = inp.install === "flansch_innen" || inp.install === "flansch_aussen";
  const refName = inp.install === "kolben" ? "d₄" : inp.install === "stange" ? "d₅" : inp.install === "flansch_innen" ? "d₇" : "d₈";
  const refDim = inp.install === "kolben" ? inp.d4 : inp.install === "stange" ? inp.d5 : inp.install === "flansch_innen" ? inp.d7 : inp.d8;
  const app = applicationOf(inp.install, inp.motion);
  const cz = compressionLimits(r, app, d2);
  const tLo = d2 * (1 - cz.max / 100) - MARGIN * d2, tHi = d2 * (1 - cz.min / 100) + MARGIN * d2;
  const groove = grooveOf(r, grooveInstall(inp.install, inp.motion), d2);
  const htol = groove?.t_tol_mm ?? 0.1;
  const name: OrGrooveName = inp.install === "kolben" ? "d₃" : inp.install === "stange" ? "d₆" : "h";
  const dimOf = (x: number): OrDim => name === "d₃" ? { nom: x, fit: "h9" } : name === "d₆" ? { nom: x, fit: "H9" } : { nom: x, fit: null, dev: [-htol / 2, htol / 2] };
  const mk = (s: FdOringSize, x: number): OringInput => {
    const ring = { ...inp.ring, size: s.size_code, d1: null, d2: null, tolD1: null, tolD2: null };
    const g = dimOf(x);
    return { ...inp, task: "A", ring, ...(name === "d₃" ? { d3: g } : name === "d₆" ? { d6: g } : { h: g }), design: null };
  };
  return { flange, refName, refDim, cz, tLo: Math.max(tLo, 0.05 * d2), tHi, name, dimOf, mk, htol };
}

/**
 * Katalog: alle Schnurstärken der Hauptreihe, je Normgröße der Bereich des Nutmaßes (OR-KAT), Nennmaß (OR-KATN) und Auswahl (OR-KATW).
 * Eingabe wie Aufgabe B (Bezugsmaß d₄, d₅, d₇ bzw. d₈ mit Passung, Druck, Werkstoff); `d2max` begrenzt die Schnurstärke (Bauraum).
 */
export function oringCatalog(r: OrRepo, inp: OringInput, d2max: number | null = null): OrCatalog {
  const errors: string[] = [];
  const base = { install: inp.install, motion: inp.motion };
  const flange0 = inp.install === "flansch_innen" || inp.install === "flansch_aussen";
  const refName = inp.install === "kolben" ? "d₄" : inp.install === "stange" ? "d₅" : inp.install === "flansch_innen" ? "d₇" : "d₈";
  const empty = (): OrCatalog => ({ ...base, refName, groups: [], isoD2: null, rec: null, step: null, errors });
  if (flange0 && inp.motion !== "statisch") { errors.push("Flansch (axial) nur statisch"); return empty(); }
  const refDim = inp.install === "kolben" ? inp.d4 : inp.install === "stange" ? inp.d5 : inp.install === "flansch_innen" ? inp.d7 : inp.d8;
  if (!refDim) { errors.push(`${refName} fehlt`); return empty(); }
  const L = dimLimits(r, refName, refDim);
  if (typeof L === "string") { errors.push(L); return empty(); }
  const iso = flange0 ? null : csSelectOf(r, inp.install as "kolben" | "stange", L.nom)?.d2_mm ?? null;
  const groups: OrKatGroup[] = orMainD2(r).map((d2) => katGroup(r, inp, d2, L, iso, d2max));
  const allowed = groups.filter((g) => g.allowed && g.best);
  const recG = allowed[allowed.length - 1] ?? null;
  const rec = recG?.best ?? null;
  const nValid = groups.reduce((a, g) => a + g.rows.filter((x) => x.valid).length, 0);
  const st = step("OR-KATW", "Ringwahl im Katalog", "gültig sind Ringe mit Bereich (OR-KAT); je Schnurstärke sortiert nach Spielraum hi − lo (absteigend), dann Größe; Empfehlung: größte zugelassene Schnurstärke mit gültigem Ring (größter konstruktiv möglicher Querschnitt), daraus der Ring mit dem größten Spielraum",
    `${refName} = ${fmt(L.nom)} mm: ${nValid} gültige Ringe in ${groups.filter((g) => g.best).length} Schnurstärken${d2max !== null ? ` (Bauraum d₂ ≤ ${fmt(d2max)} mm)` : ""}${rec ? `; Empfehlung ${rec.size} (${fmt(rec.d1)} × ${fmt(rec.d2)}), ${rec.groove!.name} ${fmt(rec.groove!.dim.nom, 6)} mm, Spielraum ${fmt(rec.span!, 4)} mm` : "; keine Empfehlung"}${iso !== null ? `; ISO 3601-2 Tab. B.${inp.install === "kolben" ? 1 : 2} nennt d₂ = ${fmt(iso)} mm` : ""}`,
    rec ? rec.span! : 0, "mm", `${OR_REF_PARKER} S. 9, Kap. 3; Verfahren (konzept_or_katalog Abschn. 7)`);
  return { ...base, refName, groups, isoD2: iso, rec, step: st, errors };
}

/** Suchfeld des Nennmaßes x aus dem Band von Bild 8 (Nennmaße, um 0,15·d₂ je Seite erweitert). */
function domain(S: ReturnType<typeof setup>, install: OrInstall, L: { nom: number; min: number; max: number }): [number, number] {
  if (install === "kolben") return [L.nom - 2 * S.tHi, L.nom - 2 * S.tLo];
  if (install === "stange") return [L.max + 2 * S.tLo, L.max + 2 * S.tHi];
  return [S.tLo, S.tHi];
}

/** OR-KAT und OR-KATN für eine einzelne Normgröße (z. B. vorhandener Ring oder Zeile einer Tabelle), Eingabe wie Aufgabe B. */
export function oringGrooveForRing(r: OrRepo, inp: OringInput, sizeCode: string): OrKatRow | string {
  const refName = inp.install === "kolben" ? "d₄" : inp.install === "stange" ? "d₅" : inp.install === "flansch_innen" ? "d₇" : "d₈";
  const refDim = inp.install === "kolben" ? inp.d4 : inp.install === "stange" ? inp.d5 : inp.install === "flansch_innen" ? inp.d7 : inp.d8;
  if (!refDim) return `${refName} fehlt`;
  const L = dimLimits(r, refName, refDim);
  if (typeof L === "string") return L;
  const s = r.sizes.find((z) => z.size_code === sizeCode) ?? null;
  if (!s) return `Größe ${sizeCode} nicht in fd_oring_sizes`;
  const S = setup(r, inp, s.d2_mm);
  const [xa, xb] = domain(S, inp.install, L);
  if (!(xb > xa) || xa <= 0) return "Suchfeld leer";
  return katRow(r, S, s, xa, xb);
}

function katGroup(r: OrRepo, inp: OringInput, d2: number, L: { nom: number; min: number; max: number }, iso: number | null, d2max: number | null): OrKatGroup {
  const S = setup(r, inp, d2);
  const allowed = d2max === null || d2 <= d2max + 1e-9;
  const [xa, xb] = domain(S, inp.install, L);
  if (!(xb > xa) || xa <= 0) return { d2, rows: [], best: null, iso: iso === d2, allowed, error: "Suchfeld leer" };
  const pre = (s: FdOringSize) => {
    if (inp.install === "kolben") return s.d1_mm >= xa / PRE && s.d1_mm <= xb;
    if (inp.install === "stange") { const D = s.d1_mm + 2 * s.d2_mm; return D >= xa && D <= xb * PRE && s.d1_mm >= L.min / PRE; }
    if (inp.install === "flansch_innen") { const D = s.d1_mm + 2 * s.d2_mm; return D >= L.min && D <= L.max * PRE; }
    return s.d1_mm >= L.min / PRE && s.d1_mm <= L.max;
  };
  const rows = sizesOfD2(r, d2).filter(pre).map((s) => katRow(r, S, s, xa, xb));
  const valid = rows.filter((x) => x.valid).sort((a, b) => b.span! - a.span! || (a.size < b.size ? -1 : 1));
  const invalid = rows.filter((x) => !x.valid).sort((a, b) => a.d1 - b.d1);
  return { d2, rows: [...valid, ...invalid], best: valid[0] ?? null, iso: iso === d2, allowed, error: null };
}

function katRow(r: OrRepo, S: ReturnType<typeof setup>, s: FdOringSize, xa: number, xb: number): OrKatRow {
  const run = (x: number) => checkOring(r, S.mk(s, x));
  const okOf = (x: number) => { const a = run(x); if (a.errors.length || !a.values) return false; return a.checks.filter((c) => OR_WAHL_KEYS.includes(c.key)).every((c) => c.ok === true); };
  // Raster über das Suchfeld, längster zusammenhängender Lauf gültiger Punkte
  const n = Math.max(2, Math.ceil((xb - xa) / GRID));
  const xs = Array.from({ length: n + 1 }, (_, i) => xa + (i * (xb - xa)) / n);
  const oks = xs.map(okOf);
  let bi = -1, bl = 0;
  for (let i = 0; i < oks.length; ) { if (!oks[i]) { i++; continue; } let j = i; while (j + 1 < oks.length && oks[j + 1]) j++; if (j - i + 1 > bl) { bl = j - i + 1; bi = i; } i = j + 1; }
  if (bi < 0) {
    const mid = run((xa + xb) / 2);
    const bad = mid.checks.filter((c) => OR_WAHL_KEYS.includes(c.key) && c.ok === false).map((c) => c.label);
    const reason = mid.errors.length ? mid.errors.join("; ") : `kein Nutmaß, bei dem alle Pflichtnachweise erfüllt sind${bad.length ? ` (in der Mitte des Suchfelds: ${bad.join(", ")})` : ""}`;
    return { size: s.size_code, d1: s.d1_mm, d2: s.d2_mm, lo: null, hi: null, span: null, groove: null, valid: false, reason, Cmin: null, Cmax: null, Smax: null, Umax: null, Fmax: null, g: null, input: null, steps: [] };
  }
  const bis = (a: number, b: number, okAtA: boolean) => { // Grenze zwischen a und b, okOf(a) = okAtA, okOf(b) = !okAtA
    while (Math.abs(b - a) > TOL) { const m = (a + b) / 2; if (okOf(m) === okAtA) a = m; else b = m; }
    return okAtA ? a : b;
  };
  const i0 = bi, i1 = bi + bl - 1;
  const lo = i0 > 0 ? bis(xs[i0]!, xs[i0 - 1]!, true) : xs[0]!;
  const hi = i1 < xs.length - 1 ? bis(xs[i1]!, xs[i1 + 1]!, true) : xs[xs.length - 1]!;
  const mid = (lo + hi) / 2;
  const r2 = (v: number) => Math.round(v * 100) / 100; // Rasterpunkte 0,05 bzw. 0,01 mm als Dezimalwert ohne Gleitkommarest
  const pick = (q: number) => { const k0 = Math.round(mid / q); const cand = [k0, k0 - 1, k0 + 1, k0 - 2, k0 + 2].map((k) => r2(k * q)).filter((v) => v >= lo - 1e-12 && v <= hi + 1e-12).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid)); return cand.find(okOf) ?? null; };
  const x = pick(0.05) ?? pick(0.01) ?? mid;
  const rnd = x === mid ? "Mitte ungerundet (Bereich schmaler als das Raster)" : Math.abs(r2(Math.round(x / 0.05) * 0.05) - x) < 1e-9 ? "Raster 0,05 mm" : "Raster 0,01 mm";
  const input = S.mk(s, x);
  const a = checkOring(r, input);
  const v = a.values!;
  const okAll = !a.errors.length && a.checks.filter((c) => OR_WAHL_KEYS.includes(c.key)).every((c) => c.ok === true);
  const unit = "mm";
  const steps = [
    step("OR-KAT", "Nut zum Ring: zulässiger Bereich", `Nutmaß ${S.name} (${S.name === "h" ? `± ${fmt(S.htol / 2)} mm` : S.name === "d₃" ? "h9" : "H9"}) so, dass alle Pflichtnachweise der Ringwahl erfüllt sind (Verpressung, Dehnung, Stauchung, Nutfüllung, Montage); Raster 0,05 mm, Grenzen per Bisektion auf 0,0001 mm, Prüfer checkOring`,
      `${s.size_code} (${fmt(s.d1_mm)} × ${fmt(s.d2_mm)}): ${S.name} von ${fmt(lo, 6)} bis ${fmt(hi, 6)} mm, Spielraum ${fmt(hi - lo, 4)} mm`, hi - lo, unit, `${OR_REF_ISO2} Tab. 2 bis 5; ${OR_REF_PARKER} Kap. 3 Tab. 3.2 bis 3.10`),
    step("OR-KATN", "Nut zum Ring: Nennmaß", "Mitte (lo + hi)/2, gerundet auf 0,05 mm, sonst nächster Rasterpunkt 0,05 bzw. 0,01 mm im Bereich, sonst ungerundet",
      `(${fmt(lo, 6)} + ${fmt(hi, 6)})/2 = ${fmt(mid, 6)} mm → ${S.name} = ${fmt(x, 6)} mm (${rnd})`, x, unit, `${OR_REF_PARKER} Kap. 3 (Raster 0,1 mm); Verfahren`),
  ];
  return { size: s.size_code, d1: s.d1_mm, d2: s.d2_mm, lo, hi, span: hi - lo, groove: { name: S.name, dim: S.dimOf(x) }, valid: okAll,
    reason: okAll ? "alle Pflichtnachweise erfüllt" : "Nennmaß verletzt einen Nachweis",
    Cmin: v.Cmin, Cmax: v.Cmax, Smax: v.Smax, Umax: v.Umax, Fmax: v.Fmax, g: v.g, input: okAll ? input : null, steps };
}
