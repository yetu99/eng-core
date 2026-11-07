/**
 * Rohrstrang (Modul fluid, RH a, eng-core 0.11.0): Reihenschaltung von Rohren, Formstücken und Armaturen,
 * inkompressibel, stationär, Newton'sches Fluid. Konzept fachtools/konzept_rh_a.md (R1 bis R10). Einheiten SI
 * (m, kg, s, Pa absolut, m³/s); Anzeigeeinheiten nur in der Oberfläche (src/fluid/units.ts).
 *
 * Knoten 0 … n zwischen n Elementen. Energiebilanz je Element (Dubbel Bd. 1 Gl. (17.10)):
 *   p_{i+1} = p_i + ρ/2·(v_i² − v_{i+1}²) + ρ·g·(z_i − z_{i+1}) − Δp_v,i
 * Verlust Rohr Δp_R = λ·(L/d)·ρ·v²/2 (Roloff Gl. 18.5), Element Δp_ζ = n·ζ·ρ·v_B²/2 (Roloff Gl. 18.6, v_B im Bezugsquerschnitt).
 * Erforderliche Druckerhöhung (Pumpe bzw. Überdruck am Anfang):
 *   Δp_erf = (p_E − p_A) + ρ·g·(z_E − z_A) + ρ/2·(v_E² − v_A²) + Σ Δp_v.
 * Knotengeschwindigkeit: Rohr am Knoten (zuerst stromauf), sonst nächstes Rohr stromauf bzw. stromab; Anfang und Ende
 * wahlweise Behälter (v = 0) oder Rohrgeschwindigkeit. Höhen: z_E = z_A + Σ Δz der Rohre.
 * Aufgaben (R7): A Druckverlust bei V̇; B V̇ bei verfügbarer Druckerhöhung (Bisektion 100 Schritte);
 * C kleinster Innendurchmesser der variablen Rohre bei Δp_zul (Bisektion im log-Raum, 100 Schritte), danach Normrohr.
 * Ab 0.13.0 (RH b, konzept_rh_b.md): Aufgabe D Betriebspunkt mit Pumpe (Element `pumpe` teilt den Strang in Saug- und
 * Druckseite, Anlagenkennlinie H_A = Δp_erf/(ρ·g) exakt aus diesem Strang, NPSH_A am Knoten vor der Pumpe; R13 bis R18),
 * nicht kreisförmige Rohre über d_h (R24, src/fluid/section.ts), Überdruckhöhe h_pe = (p − p_L)/(ρ·g) je Knoten (R25).
 * Mit Pumpe beginnt die Drucklinie beim Druck am Anfang; die Pumpe hebt die Energiehöhe um Δp_erf/(ρ·g) (PU-BE).
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace, type TraceGroupOf } from "../trace";
import type { FdLossCoeff, FdPipeSize, FdRepo } from "./fdData";
import { frictionFactor, type Friction } from "./friction";
import { fluidProps, type FluidInput, type FluidProps } from "./props";
import { sectionGeometry, type PipeSection } from "./section";
import { AFFINITY_LIMIT, bestPoint, etaAt, gridBisect, headAt, npshAt, polyAt, pumpCurves, specificSpeed, PUMP_REFS, type PumpCurves, type PumpInput } from "./pump";

export type FluidGroup = TraceGroupOf<"fluid">;
export type FluidTrace = Trace<FluidGroup>;

/** Rohrquerschnitt: Innendurchmesser von Hand, Normrohr mit Wanddicke, oder variabel (Aufgabe C). */
export type PipeGeom =
  | { kind: "d"; d: number }
  | { kind: "norm"; pipeId: string; wall: number }
  | { kind: "var" }
  /** Nicht kreisförmig (ab 0.13.0): Kreisring, Rechteck oder Fläche und Umfang von Hand; gerechnet mit d_h. */
  | { kind: "section"; section: PipeSection };

/** Rauheit: Tabellenzeile (k_min oder k_max) oder von Hand, k in m. */
export type Roughness = { kind: "tab"; id: string; which: "min" | "max" } | { kind: "hand"; k: number };

export type LineElement =
  | { kind: "rohr"; label?: string; L: number; geom: PipeGeom; rough: Roughness; dz: number }
  | { kind: "zeta"; label?: string; lossId: string; count: number }
  | { kind: "bogen"; label?: string; surface: "glatt" | "rauh"; rd: number; count: number }
  | { kind: "erweiterung"; label?: string }
  | { kind: "zetaHand"; label?: string; zeta: number; ref: "1" | "2" | null; count: number }
  /** Kreiselpumpe (ab 0.13.0, nur Aufgabe D, genau eine): Kennlinie in LineTask D. */
  | { kind: "pumpe"; label?: string };

export interface LineEnd { p: number; v0: boolean }

export interface LineInput {
  fluid: FluidInput;
  /** Volumenstrom in m³/s (Aufgabe A und C). */
  Q: number;
  start: LineEnd & { z: number };
  end: LineEnd;
  elements: LineElement[];
  g: number;
  /** Wirkungsgrad der Pumpe (0 < η ≤ 1) für die Antriebsleistung, sonst null. */
  eta: number | null;
  /** Richtwert der Geschwindigkeit (fd_velocity_guide) oder null. */
  velocityGuideId: string | null;
  /** Umgebungsdruck in Pa für die Überdruckhöhe (ab 0.13.0, R25); Standard 101 325 Pa. */
  pAmb?: number;
}

export type LineTask =
  | { kind: "A" }
  | { kind: "B"; dpAvail: number }
  | { kind: "C"; dpAllow: number; select: { norm: string; series: string; minWall: number | null } | null }
  /** Betriebspunkt mit Pumpe (ab 0.13.0). */
  | { kind: "D"; pump: PumpInput };

export interface ElementResult {
  index: number; kind: LineElement["kind"]; label: string;
  d: number | null; A: number | null; v: number | null; Re: number | null; k: number | null; eps: number | null;
  lambda: number | null; regime: Friction["regime"] | null; zeta: number | null; vRef: number | null;
  L: number; dz: number; dp: number; hv: number;
}
/** Knoten: p absolut, H Energiehöhe, hp Druckhöhe absolut, hpe Überdruckhöhe (ab 0.13.0). */
export interface LineNode { index: number; x: number; z: number; v: number; p: number; H: number; hp: number; hpe: number }

/** Ergebnis der Pumpe in Aufgabe D (ab 0.13.0). */
export interface PumpResult {
  curves: PumpCurves; r: number; n: number; Q: number; H: number; eta: number | null; Pu: number; P: number | null;
  nq: number | null; bep: { Q: number; H: number; eta: number } | null;
  npshA: number | null; npshR: number | null; reserve: number | null; margin: number; residual: number; roots: number;
  /** Diagrammwerte: Kennlinie bei n, Anlagenkennlinie, η und NPSH über V̇ (je 41 Punkte). */
  chart: { Q: number[]; H: number[]; HA: number[]; eta: (number | null)[]; npshR: (number | null)[]; H0: number[] };
}
export interface FluidKpi { key: string; label: string; sym: string; value: number; unit: string; primary?: boolean }
export interface FluidCheck { key: "kavitation" | "geschwindigkeit" | "stroemung" | "npsh" | "kennlinie" | "drehzahl" | "messung" | "druckstoss"; label: string; ok: boolean | null; text: string }

export interface LineResult {
  task: LineTask["kind"];
  fluid: FluidProps;
  Q: number;
  elements: ElementResult[];
  nodes: LineNode[];
  dpR: number; dpZ: number; dpV: number; dpGeo: number; dpKin: number; dpErf: number; pAErf: number;
  Ph: number; P: number | null; vMax: number; pMin: number;
  /** Aufgabe B: Restfehler der Bisektion in Pa. */
  flow: { dpAvail: number; residual: number } | null;
  /** Aufgabe C: kleinster Durchmesser und gewähltes Rohr. */
  design: { dpAllow: number; dMin: number; residual: number; pipe: { id: string; label: string; d_a: number; s: number; d: number } | null } | null;
  /** Aufgabe D: Pumpe und Betriebspunkt (ab 0.13.0). */
  pump: PumpResult | null;
  checks: FluidCheck[];
  kpis: FluidKpi[];
  trace: FluidTrace;
  errors: string[];
  warnings: string[];
}

const REF_DUB = "Dubbel 26 Bd. 1 Gl. (17.10)";
const elLabel = (e: LineElement, i: number): string => e.label?.trim() || `${e.kind === "rohr" ? "Rohr" : e.kind === "erweiterung" ? "Erweiterung" : e.kind === "bogen" ? "Bogen" : e.kind === "pumpe" ? "Pumpe" : "Element"} ${i + 1}`;

/** Normrohr: Innendurchmesser aus Außendurchmesser und Wanddicke (Daten in mm, Ergebnis in m). */
export function pipeInnerDiameter(p: FdPipeSize, wall: number): number {
  return (p.d_a_mm - 2 * wall * 1e3) / 1e3;
}

/** ζ für Bogen 90° durch lineare Interpolation über r/d zwischen den Tabellenzeilen (TB 18-7). */
export function bendZeta(fd: FdRepo, surface: "glatt" | "rauh", rd: number): { zeta: number; a: FdLossCoeff; b: FdLossCoeff } | null {
  const rows = fd.lossCoeff.filter((r) => r.element === `Bogen 90°, ${surface}` && r.param_name === "r/d" && r.param_value !== null).sort((x, y) => x.param_value! - y.param_value!);
  if (!rows.length || rd < rows[0]!.param_value! || rd > rows[rows.length - 1]!.param_value!) return null;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]!, b = rows[i + 1]!;
    if (rd >= a.param_value! && rd <= b.param_value!) {
      const t = (rd - a.param_value!) / (b.param_value! - a.param_value!);
      return { zeta: a.zeta + (b.zeta - a.zeta) * t, a, b };
    }
  }
  const last = rows[rows.length - 1]!;
  return { zeta: last.zeta, a: last, b: last };
}

interface Ctx { fd: FdRepo; fluid: FluidProps; inp: LineInput; dVar: number | null }

/** Ein Durchlauf bei gegebenem V̇ (und Durchmesser der variablen Rohre). Ohne Rechenweg, wenn `withSteps` false. */
function evaluate(ctx: Ctx, Q: number, withSteps: boolean) {
  const { fd, fluid, inp } = ctx;
  const rho = fluid.rho, nu = fluid.nu, g = inp.g;
  const G: Partial<Record<FluidGroup, CalcStep[]>> = {};
  const add = (grp: FluidGroup, s: CalcStep) => { if (withSteps) (G[grp] ??= []).push(s); };
  const errors: string[] = [], warnings: string[] = [];
  const els = inp.elements;
  const res: ElementResult[] = [];
  // 1. Rohre: Geometrie, Geschwindigkeit, Reibung
  els.forEach((e, i) => {
    const label = elLabel(e, i);
    const base: ElementResult = { index: i, kind: e.kind, label, d: null, A: null, v: null, Re: null, k: null, eps: null, lambda: null, regime: null, zeta: null, vRef: null, L: 0, dz: 0, dp: 0, hv: 0 };
    if (e.kind !== "rohr") { res.push(base); return; }
    let d: number, Asec: number | null = null, phi: number | null = null;
    if (e.geom.kind === "d") d = e.geom.d;
    else if (e.geom.kind === "section") {
      const sg = sectionGeometry(fd, e.geom.section, label);
      if (sg.errors.length) { errors.push(...sg.errors); res.push(base); return; }
      warnings.push(...sg.warnings);
      sg.steps.forEach((x) => add("geometrie", x));
      d = sg.dh; Asec = sg.A; phi = sg.phi;
    }
    else if (e.geom.kind === "var") {
      if (ctx.dVar === null) { errors.push(`${label}: variabler Durchmesser nur in Aufgabe C.`); res.push(base); return; }
      d = ctx.dVar;
    } else {
      const ps = fd.pipe(e.geom.pipeId);
      const wallMm = e.geom.wall * 1e3;
      if (!ps) { errors.push(`${label}: Rohr ${e.geom.pipeId} nicht in den Fachdaten.`); res.push(base); return; }
      if (!ps.walls_mm.some((w) => Math.abs(w - wallMm) < 1e-9)) { errors.push(`${label}: Wanddicke ${fmt(wallMm)} mm für ${ps.norm} ${ps.series} d_a ${fmt(ps.d_a_mm)} mm nicht genormt.`); res.push(base); return; }
      d = pipeInnerDiameter(ps, e.geom.wall);
      add("geometrie", step("RH-DI", "Innendurchmesser", "d_i = d_a − 2·s", `${label}: d_i = ${fmt(ps.d_a_mm, 6)} − 2·${fmt(wallMm, 6)} = ${fmt(d * 1e3, 6)} mm`, d, "m", `${ps.norm} ${ps.series}, ${ps.source_locator}`));
    }
    if (!(d > 0) || !(e.L >= 0)) { errors.push(`${label}: Durchmesser und Länge müssen größer als 0 sein.`); res.push(base); return; }
    let k: number;
    if (e.rough.kind === "hand") {
      k = e.rough.k;
      add("geometrie", step("RH-K", "Rauheit", "k = Eingabe", `${label}: k = ${fmt(k * 1e3, 6)} mm`, k, "m", "Eingabe"));
    } else {
      const r = fd.rough(e.rough.id);
      if (!r) { errors.push(`${label}: Rauheit ${e.rough.id} nicht in den Fachdaten.`); res.push(base); return; }
      k = (e.rough.which === "min" ? r.k_min_mm : r.k_max_mm) * 1e-3;
      add("geometrie", step("RH-K", "Rauheit", "k = k_min bzw. k_max aus fd_roughness", `${label}: k_${e.rough.which}, ${r.id} ${r.pipe_kind}, ${r.state}: k = ${fmt(k * 1e3, 6)} mm`, k, "m", `${r.source_locator} (${r.source_id})`));
    }
    const A = Asec ?? (Math.PI * d * d) / 4, v = Q / A, Re = (v * d) / nu, eps = k / d;
    const dS = Asec === null ? "d" : "d_h";
    if (Asec === null) add("geometrie", step("RH-A", "Querschnitt", "A = π·d²/4", `${label}: A = π·${fmt(d, 6)}²/4`, A, "m²", "Roloff 27 Gl. 18.3"));
    add("geometrie", step("RH-V", "mittlere Geschwindigkeit", "v = V̇/A", `${label}: v = ${fmt(Q, 6)}/${fmt(A, 6)}`, v, "m/s", "Roloff 27 Gl. 18.3"));
    add("reibung", step("RH-RE", "Reynolds-Zahl", "Re = v·d/ν", `${label}: Re = ${fmt(v, 6)}·${fmt(d, 6)}/${fmt(nu, 6)}${Asec === null ? "" : " (d = d_h)"}`, Re, "1", "Roloff 27 Gl. 18.8; VDI-WA L1.2 Gl. (2)"));
    add("reibung", step("RH-EPS", "relative Rauheit", "ε = k/d", `${label}: ε = ${fmt(k, 6)}/${fmt(d, 6)}${Asec === null ? "" : " (d = d_h)"}`, eps, "1", "VDI-WA L1.2 Gl. (8)"));
    const f = frictionFactor(Re, eps, label, phi);
    errors.push(...f.errors); warnings.push(...f.warnings);
    f.steps.forEach((s) => add("reibung", s));
    const dp = f.lambda * (e.L / d) * rho * v * v / 2;
    add("verluste", step("RH-DP-R", "Reibungsdruckverlust", "Δp_R = λ·(L/d)·ρ·v²/2", `${label}: Δp_R = ${fmt(f.lambda, 6)}·(${fmt(e.L, 6)}/${fmt(d, 6)})·${fmt(rho, 6)}·${fmt(v, 6)}²/2${dS === "d" ? "" : " (d = d_h)"}`, dp, "Pa", "Roloff 27 Gl. 18.5; VDI-WA L1.2 Gl. (1)"));
    res.push({ ...base, d, A, v, Re, k, eps, lambda: f.lambda, regime: f.regime, L: e.L, dz: e.dz, dp, hv: dp / (rho * g) });
  });
  const pipeV = (from: number, dir: -1 | 1): number | null => {
    for (let j = from; j >= 0 && j < res.length; j += dir) if (res[j]!.kind === "rohr" && res[j]!.v !== null) return res[j]!.v;
    return null;
  };
  // 2. Formstücke und Armaturen
  els.forEach((e, i) => {
    if (e.kind === "rohr" || e.kind === "pumpe") return;
    const r = res[i]!;
    let zeta: number, ref: "1" | "2" | null, n = 1;
    if (e.kind === "zeta") {
      const lc = fd.loss(e.lossId);
      if (!lc) { errors.push(`${r.label}: Widerstandszahl ${e.lossId} nicht in den Fachdaten.`); return; }
      zeta = lc.zeta; ref = lc.ref_section; n = e.count;
      const par = lc.param_name ? `, ${lc.param_name} ${lc.param_name === "DN" ? `${lc.dn_min ?? ""}${lc.dn_max !== lc.dn_min ? `…${lc.dn_max ?? ""}` : ""}` : fmt(lc.param_value)}` : "";
      add("verluste", step("RH-Z-TAB", "Widerstandszahl", "ζ aus fd_loss_coeff", `${r.label}: ${lc.id} ${lc.element}${par}: ζ${ref ? `_${ref}` : ""} = ${fmt(zeta, 6)}`, zeta, "1", `${lc.source_locator} (${lc.source_id})`));
      if (lc.remark) warnings.push(`${r.label}: ${lc.remark}`);
    } else if (e.kind === "bogen") {
      const b = bendZeta(fd, e.surface, e.rd);
      if (!b) { errors.push(`${r.label}: r/d = ${fmt(e.rd)} außerhalb der Tabelle (1 bis 10).`); return; }
      zeta = b.zeta; ref = null; n = e.count;
      add("verluste", step("RH-Z-IP", "Widerstandszahl Bogen 90° (Interpolation über r/d)", "ζ = ζ_a + (ζ_b − ζ_a)·(r/d − x_a)/(x_b − x_a)",
        `${r.label} (${e.surface}): ${b.a.id}/${b.b.id}: ζ = ${fmt(b.a.zeta)} + (${fmt(b.b.zeta)} − ${fmt(b.a.zeta)})·(${fmt(e.rd)} − ${fmt(b.a.param_value)})/(${fmt(b.b.param_value)} − ${fmt(b.a.param_value)})`, zeta, "1", "TB 18-7 (Q219), linear zwischen Zeilen"));
    } else if (e.kind === "erweiterung") {
      const v1 = pipeV(i - 1, -1), v2 = pipeV(i + 1, 1);
      const pre = (() => { for (let j = i - 1; j >= 0; j--) if (res[j]!.kind === "rohr") return res[j]!; return null; })();
      const post = (() => { for (let j = i + 1; j < res.length; j++) if (res[j]!.kind === "rohr") return res[j]!; return null; })();
      if (!pre || !post || pre.A === null || post.A === null || v1 === null || v2 === null) { errors.push(`${r.label}: plötzliche Erweiterung braucht ein Rohr davor und danach.`); return; }
      if (post.A <= pre.A) { errors.push(`${r.label}: Querschnitt danach (${fmt(post.d! * 1e3)} mm) nicht größer als davor (${fmt(pre.d! * 1e3)} mm).`); return; }
      zeta = (1 - pre.A / post.A) ** 2; ref = "1";
      add("verluste", step("RH-Z-BC", "plötzliche Erweiterung (Borda-Carnot)", "ζ_1 = (1 − A_1/A_2)²", `${r.label}: ζ_1 = (1 − ${fmt(pre.A, 6)}/${fmt(post.A, 6)})²`, zeta, "1", "VDI-WA L1.3 Gl. (7); TB 18-7; Dubbel 26 Bd. 1 S. 324"));
    } else {
      if (!(e.zeta >= 0)) { errors.push(`${r.label}: ζ von Hand muss ≥ 0 sein.`); return; }
      zeta = e.zeta; ref = e.ref; n = e.count;
      add("verluste", step("RH-Z-MAN", "Widerstandszahl (Eingabe)", "ζ = Eingabe", `${r.label}: ζ${ref ? `_${ref}` : ""} = ${fmt(zeta, 6)}`, zeta, "1", "Eingabe"));
    }
    if (!(n >= 1) || !Number.isInteger(n)) { errors.push(`${r.label}: Anzahl muss eine ganze Zahl ≥ 1 sein.`); return; }
    const vRef = ref === "2" ? pipeV(i + 1, 1) : ref === "1" ? pipeV(i - 1, -1) : (pipeV(i - 1, -1) ?? pipeV(i + 1, 1));
    if (vRef === null) { errors.push(`${r.label}: kein Rohr im Bezugsquerschnitt ${ref ?? "(Element)"}.`); return; }
    const dp = n * zeta * rho * vRef * vRef / 2;
    add("verluste", step("RH-DP-Z", "Druckverlust", "Δp_ζ = n·ζ·ρ·v_B²/2", `${r.label}: Δp_ζ = ${n}·${fmt(zeta, 6)}·${fmt(rho, 6)}·${fmt(vRef, 6)}²/2`, dp, "Pa", "Roloff 27 Gl. 18.6"));
    res[i] = { ...r, zeta: n * zeta, vRef, dp, hv: dp / (rho * g) };
  });
  // 3. Knoten und Energiebilanz
  const n = res.length;
  const vNode: number[] = [];
  for (let i = 0; i <= n; i++) {
    if (i === 0) vNode.push(inp.start.v0 ? 0 : pipeV(0, 1) ?? 0);
    else if (i === n) vNode.push(inp.end.v0 ? 0 : pipeV(n - 1, -1) ?? 0);
    else {
      const a = res[i - 1]!, b = res[i]!;
      vNode.push(a.kind === "rohr" && a.v !== null ? a.v : b.kind === "rohr" && b.v !== null ? b.v : pipeV(i - 1, -1) ?? pipeV(i, 1) ?? 0);
    }
  }
  const zNode = [inp.start.z];
  res.forEach((r) => zNode.push(zNode[zNode.length - 1]! + r.dz));
  const xNode = [0];
  res.forEach((r) => xNode.push(xNode[xNode.length - 1]! + r.L));
  const dpR = res.filter((r) => r.kind === "rohr").reduce((s, r) => s + r.dp, 0);
  const dpZ = res.filter((r) => r.kind !== "rohr").reduce((s, r) => s + r.dp, 0);
  const dpV = dpR + dpZ;
  const vA = vNode[0]!, vE = vNode[n]!, zA = zNode[0]!, zE = zNode[n]!;
  const dpGeo = rho * g * (zE - zA), dpKin = rho / 2 * (vE * vE - vA * vA);
  const dpErf = (inp.end.p - inp.start.p) + dpGeo + dpKin + dpV;
  const pAErf = inp.start.p + dpErf;
  add("energie", step("RH-DP-GEO", "Höhendruck", "Δp_geo = ρ·g·(z_E − z_A)", `Δp_geo = ${fmt(rho, 6)}·${fmt(g, 6)}·(${fmt(zE, 6)} − ${fmt(zA, 6)})`, dpGeo, "Pa", "Roloff 27 Gl. 18.7"));
  add("energie", step("RH-DP-V", "Summe der Verluste", "Δp_v = Σ Δp_R + Σ Δp_ζ", `Δp_v = ${fmt(dpR, 6)} + ${fmt(dpZ, 6)}`, dpV, "Pa", "Roloff 27 Gl. 18.7"));
  add("energie", step("RH-HV", "Verlusthöhe", "h_v = Δp_v/(ρ·g)", `h_v = ${fmt(dpV, 6)}/(${fmt(rho, 6)}·${fmt(g, 6)})`, dpV / (rho * g), "m", "Dubbel 26 Bd. 1 Gl. (17.11b)"));
  add("energie", step("RH-DP-ERF", "Erforderliche Druckerhöhung", "Δp_erf = (p_E − p_A) + Δp_geo + ρ/2·(v_E² − v_A²) + Δp_v",
    `Δp_erf = (${fmt(inp.end.p, 6)} − ${fmt(inp.start.p, 6)}) + ${fmt(dpGeo, 6)} + ${fmt(rho, 6)}/2·(${fmt(vE, 6)}² − ${fmt(vA, 6)}²) + ${fmt(dpV, 6)}`, dpErf, "Pa", REF_DUB));
  const nodes: LineNode[] = [];
  const hasPump = els.some((e) => e.kind === "pumpe");
  const pL = inp.pAmb ?? 101325;
  let p = hasPump ? inp.start.p : pAErf;
  for (let i = 0; i <= n; i++) {
    if (i > 0) {
      const r = res[i - 1]!;
      const pPrev = p;
      if (r.kind === "pumpe") {
        p = pPrev + rho / 2 * (vNode[i - 1]! ** 2 - vNode[i]! ** 2) + dpErf;
        add("pumpe", step("PU-BE", "Druck nach der Pumpe", "p_2 = p_1 + ρ/2·(v_1² − v_2²) + ρ·g·H_A",
          `${r.label}: p = ${fmt(pPrev, 6)} + ${fmt(rho, 6)}/2·(${fmt(vNode[i - 1]!, 6)}² − ${fmt(vNode[i]!, 6)}²) + ${fmt(dpErf, 6)}`, p, "Pa", "Dubbel 26 Bd. 3 Gl. (8.5), (8.6)"));
      } else {
        p = pPrev + rho / 2 * (vNode[i - 1]! ** 2 - vNode[i]! ** 2) + rho * g * (zNode[i - 1]! - zNode[i]!) - r.dp;
        add("energie", step("RH-BE", "Druck nach dem Element", "p_2 = p_1 + ρ/2·(v_1² − v_2²) + ρ·g·(z_1 − z_2) − Δp_v",
          `${r.label}: p = ${fmt(pPrev, 6)} + ${fmt(rho, 6)}/2·(${fmt(vNode[i - 1]!, 6)}² − ${fmt(vNode[i]!, 6)}²) + ${fmt(rho, 6)}·${fmt(g, 6)}·(${fmt(zNode[i - 1]!, 6)} − ${fmt(zNode[i]!, 6)}) − ${fmt(r.dp, 6)}`, p, "Pa", REF_DUB));
      }
    }
    const hp = p / (rho * g), H = hp + vNode[i]! ** 2 / (2 * g) + zNode[i]!, hpe = (p - pL) / (rho * g);
    nodes.push({ index: i, x: xNode[i]!, z: zNode[i]!, v: vNode[i]!, p, H, hp, hpe });
  }
  for (const i of [0, n]) {
    const nd = nodes[i]!, tag = i === 0 ? "Anfang" : "Ende";
    add("energie", step("RH-H-P", "Druckhöhe", "h_p = p/(ρ·g)", `${tag}: h_p = ${fmt(nd.p, 6)}/(${fmt(rho, 6)}·${fmt(g, 6)})`, nd.hp, "m", "Dubbel 26 Bd. 1 S. 325"));
    add("energie", step("RH-H-PG", "Überdruckhöhe", "h_pe = (p − p_L)/(ρ·g)", `${tag}: h_pe = (${fmt(nd.p, 6)} − ${fmt(pL, 6)})/(${fmt(rho, 6)}·${fmt(g, 6)})`, nd.hpe, "m", "Dubbel 26 Bd. 1 Gl. (17.10); Überdruck gegen Umgebung"));
    add("energie", step("RH-H-E", "Energiehöhe", "H = p/(ρ·g) + v²/(2g) + z", `${tag}: H = ${fmt(nd.hp, 6)} + ${fmt(nd.v, 6)}²/(2·${fmt(g, 6)}) + ${fmt(nd.z, 6)}`, nd.H, "m", REF_DUB));
  }
  return { res, nodes, dpR, dpZ, dpV, dpGeo, dpKin, dpErf, pAErf, G, errors, warnings };
}

function validate(inp: LineInput, task: LineTask): string[] {
  const e: string[] = [];
  if (!inp.elements.length) e.push("Der Strang enthält kein Element.");
  if (!inp.elements.some((x) => x.kind === "rohr")) e.push("Der Strang braucht mindestens ein Rohr.");
  if (!(inp.g > 0)) e.push("Fallbeschleunigung g muss größer als 0 sein.");
  if (!(inp.start.p > 0) || !(inp.end.p > 0)) e.push("Drücke am Anfang und Ende sind absolut und müssen größer als 0 sein.");
  if (inp.eta !== null && !(inp.eta > 0 && inp.eta <= 1)) e.push("Wirkungsgrad muss zwischen 0 und 1 liegen.");
  if (task.kind !== "B" && task.kind !== "D" && !(inp.Q > 0)) e.push("Volumenstrom muss größer als 0 sein.");
  if (task.kind === "C" && !inp.elements.some((x) => x.kind === "rohr" && x.geom.kind === "var")) e.push("Aufgabe C: mindestens ein Rohr mit variablem Durchmesser markieren.");
  if (task.kind !== "C" && inp.elements.some((x) => x.kind === "rohr" && x.geom.kind === "var")) e.push("Variabler Durchmesser nur in Aufgabe C.");
  const pumps = inp.elements.filter((x) => x.kind === "pumpe").length;
  if (task.kind === "D" && pumps !== 1) e.push("Aufgabe D: genau ein Element Pumpe in den Strang setzen.");
  if (task.kind !== "D" && pumps > 0) e.push("Pumpe im Strang nur in Aufgabe D (Betriebspunkt).");
  if (inp.pAmb !== undefined && !(inp.pAmb > 0)) e.push("Umgebungsdruck muss größer als 0 sein.");
  return e;
}

/** Rohrstrang rechnen (Aufgaben A, B, C). */
export function computeLine(fd: FdRepo, inp: LineInput, task: LineTask = { kind: "A" }): LineResult {
  const fluid = fluidProps(fd, inp.fluid);
  const errors = [...validate(inp, task), ...fluid.errors];
  const warnings = [...fluid.warnings];
  const empty = (): LineResult => ({ task: task.kind, fluid, Q: NaN, elements: [], nodes: [], dpR: NaN, dpZ: NaN, dpV: NaN, dpGeo: NaN, dpKin: NaN, dpErf: NaN, pAErf: NaN, Ph: NaN, P: null, vMax: NaN, pMin: NaN, flow: null, design: null, pump: null, checks: [], kpis: [], trace: { stoffwerte: fluid.steps }, errors, warnings });
  if (errors.length) return empty();
  const ctx: Ctx = { fd, fluid, inp, dVar: null };
  let Q = inp.Q;
  let flow: LineResult["flow"] = null, design: LineResult["design"] = null;
  const extra: CalcStep[] = [];
  // Suchfunktionen: Re über 10⁸ (zu kleiner Durchmesser bzw. zu großer Volumenstrom) zählt als unendlicher Druckbedarf;
  // andere Fehler (Daten, Eingaben) brechen vor der Suche ab.
  const solveErrors = (q: number, d: number | null): string[] => { ctx.dVar = d; return evaluate(ctx, q, false).errors.filter((x) => !x.includes("über 10⁸")); };
  const dpOf = (q: number): number => { const e = evaluate(ctx, q, false); return e.errors.length ? Infinity : e.dpErf; };
  if (task.kind === "B") {
    const pre = solveErrors(1e-6, null);
    if (pre.length) { errors.push(...pre); return empty(); }
    const f = (q: number) => dpOf(q) - task.dpAvail;
    const f0 = (inp.end.p - inp.start.p) + fluid.rho * inp.g * inp.elements.reduce((s, x) => s + (x.kind === "rohr" ? x.dz : 0), 0) - task.dpAvail;
    if (f0 >= 0) { errors.push(`Aufgabe B: die verfügbare Druckerhöhung ${fmt(task.dpAvail)} Pa reicht nicht für die statische Druck- und Höhendifferenz (${fmt(f0 + task.dpAvail)} Pa), kein Durchfluss.`); return empty(); }
    let lo = 0, hi = 1e-6, k = 0;
    while (f(hi) < 0 && k < 80) { lo = hi; hi *= 2; k++; }
    if (f(hi) < 0) { errors.push("Aufgabe B: kein Durchfluss im Suchbereich gefunden."); return empty(); }
    for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
    Q = (lo + hi) / 2;
    const residual = f(Q);
    flow = { dpAvail: task.dpAvail, residual };
    if (Math.abs(residual) > 1e-6 * Math.max(1, Math.abs(task.dpAvail))) warnings.push(`Aufgabe B: Restfehler ${fmt(residual)} Pa (Sprung der Rohrreibungszahl am Umschlag laminar/turbulent).`);
    extra.push(step("RH-Q-BIS", "Volumenstrom bei verfügbarer Druckerhöhung", "V̇ mit Δp_erf(V̇) = Δp_verf (Bisektion, 100 Schritte)", `Δp_verf = ${fmt(task.dpAvail, 6)} Pa, Restfehler ${fmt(residual, 3)} Pa`, Q, "m³/s", "Verfahren (R7)"));
  }
  if (task.kind === "C") {
    const pre = solveErrors(Q, 0.1);
    if (pre.length) { errors.push(...pre); return empty(); }
    const f = (d: number) => { ctx.dVar = d; return dpOf(Q) - task.dpAllow; };
    let lo = Math.log(1e-4), hi = Math.log(10);
    if (f(Math.exp(hi)) > 0) { errors.push(`Aufgabe C: auch mit d = 10 m wird Δp_zul = ${fmt(task.dpAllow)} Pa überschritten (statischer Anteil zu groß).`); return empty(); }
    if (f(Math.exp(lo)) <= 0) { errors.push("Aufgabe C: schon d = 0,1 mm erfüllt Δp_zul; Eingaben prüfen."); return empty(); }
    for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (f(Math.exp(m)) > 0) lo = m; else hi = m; }
    const dMin = Math.exp(hi);
    const residual = f(dMin);
    extra.push(step("RH-D-BIS", "Kleinster Innendurchmesser", "d mit Δp_erf(d) = Δp_zul (Bisektion im log-Raum, 100 Schritte)", `Δp_zul = ${fmt(task.dpAllow, 6)} Pa, Restfehler ${fmt(residual, 3)} Pa`, dMin, "m", "Verfahren (R7)"));
    let pipe: NonNullable<LineResult["design"]>["pipe"] = null;
    let dUse = dMin;
    if (task.select) {
      const sel = task.select;
      const cands = fd.pipeSizes.filter((p) => p.norm === sel.norm && p.series === sel.series).map((p) => {
        const walls = p.walls_mm.filter((w) => sel.minWall === null || w >= sel.minWall * 1e3 - 1e-9);
        const s = walls.length ? Math.min(...walls) / 1e3 : null;
        return s === null ? null : { p, s, d: pipeInnerDiameter(p, s) };
      }).filter((c): c is { p: FdPipeSize; s: number; d: number } => c !== null && c.d >= dMin).sort((a, b) => a.d - b.d);
      const c = cands[0];
      if (!c) errors.push(`Aufgabe C: kein Rohr ${sel.norm} ${sel.series} mit d_i ≥ ${fmt(dMin * 1e3)} mm.`);
      else {
        pipe = { id: c.p.id, label: `${c.p.norm} ${c.p.series} ${fmt(c.p.d_a_mm)} × ${fmt(c.s * 1e3)}`, d_a: c.p.d_a_mm / 1e3, s: c.s, d: c.d };
        dUse = c.d;
        extra.push(step("RH-D-DN", "Gewähltes Rohr", "kleinstes Rohr mit d_i = d_a − 2·s ≥ d_min", `${pipe.label} mm: d_i = ${fmt(c.d * 1e3, 6)} mm ≥ ${fmt(dMin * 1e3, 6)} mm`, c.d, "m", `${c.p.source_locator} (${c.p.source_id})`));
      }
    }
    ctx.dVar = dUse;
    design = { dpAllow: task.dpAllow, dMin, residual, pipe };
  }
  // Aufgabe D: Betriebspunkt mit Pumpe (R13 bis R16)
  let pumpPre: { pc: PumpCurves; r: number; residual: number; roots: number; HA: (q: number) => number; lo: number; hi: number; qmin: number } | null = null;
  const pumpSteps: CalcStep[] = [];
  if (task.kind === "D") {
    const pu = task.pump;
    const pc = pumpCurves(pu);
    if (!(pu.npshMargin >= 0)) pc.errors.push("Pumpe: Sicherheitszuschlag NPSH muss mindestens 0 sein.");
    if (!(pu.npshExp > 0)) pc.errors.push("Pumpe: Exponent der NPSH-Umrechnung muss größer als 0 sein.");
    if (pu.pv !== null && !(pu.pv >= 0)) pc.errors.push("Pumpe: Dampfdruck von Hand muss mindestens 0 sein.");
    if (pc.errors.length) { errors.push(...pc.errors); return empty(); }
    warnings.push(...pc.warnings); pumpSteps.push(...pc.steps);
    const pre = solveErrors(Math.max(pc.Qmax, 1e-6) / 2, null);
    if (pre.length) { errors.push(...pre); return empty(); }
    const rg = fluid.rho * inp.g;
    const HA = (q: number): number => (q > 0 ? dpOf(q) / rg : NaN);
    let r: number;
    if (pu.speed.kind === "n") {
      if (!(pu.speed.n > 0)) { errors.push("Pumpe: Betriebsdrehzahl muss größer als 0 sein."); return empty(); }
      r = pu.speed.n / pu.n0;
    } else {
      const Qs = pu.speed.Q;
      if (!(Qs > 0)) { errors.push("Pumpe: Soll-Förderstrom muss größer als 0 sein."); return empty(); }
      const HAs = HA(Qs);
      if (!Number.isFinite(HAs)) { errors.push("Pumpe: Anlagenkennlinie beim Soll-Förderstrom nicht berechenbar (Re > 10⁸)."); return empty(); }
      const rlo = Qs / pc.Qmax, rhi = pc.Qmin > 0 ? Qs / pc.Qmin : 3 * Math.max(1, rlo);
      const sol = gridBisect((x) => headAt(pc, x, Qs) - HAs, rlo, rhi);
      if (!sol.ok) { errors.push(`Pumpe: keine Drehzahl, bei der die Kennlinie den Soll-Förderstrom ${fmt(Qs * 3600)} m³/h mit H_A = ${fmt(HAs)} m trifft (Kennlinienbereich zu klein).`); return empty(); }
      r = sol.x;
      pumpSteps.push(step("PU-N-BIS", "Drehzahl für Soll-Förderstrom", "n mit H_n(V̇_soll) = H_A(V̇_soll), H_n(V̇) = (n/n₀)²·H₀(V̇·n₀/n) (Raster 200, Bisektion 100 Schritte)",
        `V̇_soll = ${fmt(Qs, 6)} m³/s, H_A = ${fmt(HAs, 6)} m, n₀ = ${fmt(pu.n0, 6)} s⁻¹: n/n₀ = ${fmt(r, 6)}, Restfehler ${fmt(sol.residual, 3)} m`, r * pu.n0, "1/s", `Verfahren (R16); ${PUMP_REFS.d3} S. 232`));
    }
    const hi = r * pc.Qmax, lo = r * pc.Qmin > 0 ? r * pc.Qmin : hi * 1e-6;
    const op = gridBisect((q) => headAt(pc, r, q) - HA(q), lo, hi);
    if (!op.ok) {
      const a = headAt(pc, r, lo) - HA(lo), b = headAt(pc, r, hi) - HA(hi);
      errors.push(`Aufgabe D: kein Betriebspunkt im Kennlinienbereich ${fmt(lo * 3600)} bis ${fmt(hi * 3600)} m³/h; ${a < 0 && b < 0 ? "die Pumpe erreicht die Förderhöhe der Anlage nicht (Pumpe zu klein oder Drehzahl zu niedrig)" : "die Pumpe fördert über den Kennlinienbereich hinaus (Pumpe zu groß, Drosseln oder Kennlinie erweitern)"}.`);
      return empty();
    }
    if (op.roots > 1) warnings.push(`Aufgabe D: ${op.roots} Schnittpunkte von Pumpen- und Anlagenkennlinie (instabiler Betrieb möglich); genommen ist der kleinste Förderstrom.`);
    Q = op.x;
    pumpPre = { pc, r, residual: op.residual, roots: op.roots, HA, lo, hi, qmin: r * pc.Qmin };
  }
  const ev = evaluate(ctx, Q, true);
  errors.push(...ev.errors); warnings.push(...ev.warnings);
  const rho = fluid.rho;
  const Ph = ev.dpErf * Q;
  const P = inp.eta === null ? null : Ph / inp.eta;
  ev.G.energie ??= [];
  ev.G.energie.push(...extra);
  ev.G.energie.push(step("RH-P-HYD", "Hydraulische Leistung", "P_h = Δp_erf·V̇", `P_h = ${fmt(ev.dpErf, 6)}·${fmt(Q, 6)}`, Ph, "W", "Roloff 27 S. 742"));
  if (P !== null) ev.G.energie.push(step("RH-P-W", "Antriebsleistung", "P = P_h/η", `P = ${fmt(Ph, 6)}/${fmt(inp.eta, 6)}`, P, "W", "Roloff 27 S. 742"));
  const vMax = Math.max(...ev.res.filter((r) => r.v !== null).map((r) => r.v!));
  const pMin = Math.min(...ev.nodes.map((nd) => nd.p));
  // Nachweise und Hinweise
  const checks: FluidCheck[] = [];
  const nach: CalcStep[] = [];
  const pumpIdx = inp.elements.findIndex((x) => x.kind === "pumpe");
  // Mit Pumpe gilt der Kavitationshinweis nur für die Druckseite, die Saugseite prüft NPSH (R17)
  const kavNodes = pumpIdx >= 0 ? ev.nodes.filter((nd) => nd.index > pumpIdx) : ev.nodes;
  const pMinK = Math.min(...kavNodes.map((nd) => nd.p));
  const side = pumpIdx >= 0 ? " (Druckseite)" : "";
  if (fluid.ps !== null) {
    const ok = pMinK >= fluid.ps;
    checks.push({ key: "kavitation", label: `Kavitation${side}`, ok, text: `p_min = ${fmt(pMinK / 1e5, 4)} bar ${ok ? "≥" : "<"} p_s = ${fmt(fluid.ps / 1e5, 4)} bar` });
    nach.push(step("RH-N-KAV", "Kavitationsgefahr (Abstand zum Dampfdruck)", "p_abs,min/p_s ≥ 1", `p_abs,min/p_s${side} = ${fmt(pMinK, 6)} Pa/${fmt(fluid.ps, 6)} Pa = ${fmt(pMinK / fluid.ps, 4)} ${ok ? "≥" : "<"} 1: ${ok ? "keine Kavitation" : "Kavitation"}`, pMinK / fluid.ps, "1", "IAPWS-IF97 Gl. (30)"));
    if (!ok) warnings.push(`Kavitation: der kleinste Druck im Strang${side} (${fmt(pMinK / 1e5)} bar) liegt unter dem Sättigungsdruck (${fmt(fluid.ps / 1e5)} bar).${pumpIdx >= 0 ? "" : " Mit Pumpe: Aufgabe D (NPSH)."}`);
  } else checks.push({ key: "kavitation", label: `Kavitation${side}`, ok: null, text: "kein Sättigungsdruck bekannt" });
  let pumpRes: PumpResult | null = null;
  if (task.kind === "D" && pumpPre) {
    const pu = task.pump, { pc, r } = pumpPre, rg = rho * inp.g, gg = inp.g;
    const HAb = ev.dpErf / rg, Hb = headAt(pc, r, Q), eta = etaAt(pc, r, Q);
    pumpSteps.push(step("PU-HA", "Förderhöhe der Anlage", "H_A(V̇) = Δp_erf(V̇)/(ρ·g)", `H_A = ${fmt(ev.dpErf, 6)}/(${fmt(rho, 6)}·${fmt(gg, 6)})`, HAb, "m", `${PUMP_REFS.d3} Gl. (8.6); RH-DP-ERF`));
    pumpSteps.push(step("PU-BP", "Betriebspunkt", "V̇_B mit H(V̇_B) = H_A(V̇_B) (Raster 200, Bisektion 100 Schritte)",
      `Kennlinienbereich ${fmt(pumpPre.qmin, 6)} bis ${fmt(pumpPre.hi, 6)} m³/s${pumpPre.lo > pumpPre.qmin ? ` (Suche ab ${fmt(pumpPre.lo, 6)} m³/s, H_A bei V̇ = 0 nicht definiert)` : ""}, H = ${fmt(Hb, 6)} m, Restfehler ${fmt(pumpPre.residual, 3)} m${pumpPre.roots > 1 ? `, ${pumpPre.roots} Schnittpunkte` : ""}`, Q, "m³/s", `${PUMP_REFS.d3} S. 231`));
    const Q0 = Q / r, H0 = polyAt(pc.H.c, Q0), eta0 = pc.eta ? polyAt(pc.eta.c, Q0) : null;
    const affine = Math.abs(r - 1) > 1e-12;
    if (affine) {
      pumpSteps.push(step("PU-AFF-Q", "Förderstrom bei geänderter Drehzahl", "V̇ = V̇₀·n/n₀", `V̇ = ${fmt(Q0, 6)}·${fmt(r, 6)} (Punkt V̇₀ der Kennlinie bei n₀)`, Q0 * r, "m³/s", `${PUMP_REFS.d3} S. 232; ${PUMP_REFS.iso9906} Gl. (27)`));
      pumpSteps.push(step("PU-AFF-H", "Förderhöhe bei geänderter Drehzahl", "H = H₀·(n/n₀)²", `H = ${fmt(H0, 6)}·${fmt(r, 6)}²`, H0 * r * r, "m", `${PUMP_REFS.d3} S. 232; ${PUMP_REFS.iso9906} Gl. (28)`));
      if (eta0 !== null) { const P0 = rg * Q0 * H0 / eta0; pumpSteps.push(step("PU-AFF-P", "Leistungsbedarf bei geänderter Drehzahl", "P = P₀·(n/n₀)³, η = η₀", `P = ${fmt(P0, 6)}·${fmt(r, 6)}³, η = ${fmt(eta0, 6)}`, P0 * r ** 3, "W", `${PUMP_REFS.d3} S. 232; ${PUMP_REFS.iso9906} Gl. (29), (30)`)); }
    }
    const Pu = rg * Q * Hb, P = eta === null ? null : Pu / eta;
    pumpSteps.push(step("PU-PU", "Förderleistung", "P_u = ρ·g·V̇·H", `P_u = ${fmt(rho, 6)}·${fmt(gg, 6)}·${fmt(Q, 6)}·${fmt(Hb, 6)}`, Pu, "W", `${PUMP_REFS.d3} Gl. (2.5a)`));
    if (P !== null) pumpSteps.push(step("PU-P", "Leistungsbedarf der Pumpe", "P = P_u/η(V̇_B)", `P = ${fmt(Pu, 6)}/${fmt(eta!, 6)}`, P, "W", `${PUMP_REFS.d3} S. 231`));
    const bep = bestPoint(pc);
    const nq = bep ? specificSpeed(pu.n0, bep.Q, bep.H, gg) : null;
    if (bep && nq !== null) pumpSteps.push(step("PU-NQ", "Spezifische Drehzahl (Bestpunkt)", "n_q = 333·n·√V̇/(g·H)^(3/4), n in s⁻¹",
      `Bestpunkt der η-Kennlinie bei n₀: V̇ = ${fmt(bep.Q, 6)} m³/s, H = ${fmt(bep.H, 6)} m, η = ${fmt(bep.eta, 4)}: n_q = 333·${fmt(pu.n0, 6)}·√${fmt(bep.Q, 6)}/(${fmt(gg, 6)}·${fmt(bep.H, 6)})^0,75`, nq, "1", `${PUMP_REFS.d3} Gl. (8.1), S. 226`));
    // NPSH (R17)
    const nd = ev.nodes[pumpIdx]!;
    const pv = fluid.ps ?? pu.pv;
    const npshA = pv === null ? null : (nd.p + rho * nd.v * nd.v / 2 - pv) / rg;
    if (npshA !== null) pumpSteps.push(step("PU-NPSHA", "NPSH der Anlage", "NPSH_A = (p_abs,S + ρ·v_S²/2 − p_v)/(ρ·g)",
      `Knoten ${pumpIdx} vor der Pumpe: NPSH_A = (${fmt(nd.p, 6)} + ${fmt(rho, 6)}·${fmt(nd.v, 6)}²/2 − ${fmt(pv!, 6)})/(${fmt(rho, 6)}·${fmt(gg, 6)})`, npshA, "m", `${PUMP_REFS.d3} Gl. (8.2), S. 229`));
    else warnings.push("NPSH: kein Dampfdruck bekannt (Fremdfluid), bitte von Hand eingeben.");
    const npshR = npshAt(pc, r, Q, pu.npshExp);
    if (npshR !== null && affine) pumpSteps.push(step("PU-AFF-NPSH", "NPSH_R bei geänderter Drehzahl", "NPSH_R = NPSH_R,0·(n/n₀)^x", `NPSH_R = ${fmt(polyAt(pc.npsh!.c, Q0), 6)}·${fmt(r, 6)}^${fmt(pu.npshExp)}`, npshR, "m", `${PUMP_REFS.iso9906} Gl. (31), x = 2 erste Näherung`));
    let reserve: number | null = null;
    if (npshA !== null && npshR !== null) {
      reserve = npshA - npshR;
      const ok = reserve >= pu.npshMargin;
      pumpSteps.push(step("PU-RES", "NPSH-Reserve", "ΔNPSH = NPSH_A − NPSH_R(V̇_B)", `ΔNPSH = ${fmt(npshA, 6)} − ${fmt(npshR, 6)}`, reserve, "m", `${PUMP_REFS.d3} S. 230`));
      nach.push(step("PU-N-NPSH", "Kavitation Saugseite (NPSH)", "NPSH_A ≥ NPSH_R + s", `${fmt(npshA, 6)} ${ok ? "≥" : "<"} ${fmt(npshR, 6)} + ${fmt(pu.npshMargin, 6)} m: ${ok ? "kavitationsfrei mit Sicherheit" : "Kavitationsgefahr"}`, reserve, "m", `${PUMP_REFS.d3} S. 230 (Sicherheit ca. 1 bis 2 m)`));
      checks.push({ key: "npsh", label: "NPSH", ok, text: `NPSH_A = ${fmt(npshA, 3)} m, NPSH_R = ${fmt(npshR, 3)} m, Reserve ${fmt(reserve, 3)} m (Soll ≥ ${fmt(pu.npshMargin)} m)` });
      if (!ok) warnings.push(`NPSH: Reserve ${fmt(reserve)} m kleiner als der Sicherheitszuschlag ${fmt(pu.npshMargin)} m; Pumpe tiefer setzen, Saugleitung vergrößern oder kleinere Drehzahl.`);
    } else checks.push({ key: "npsh", label: "NPSH", ok: null, text: npshR === null ? "keine NPSH_R-Kennlinie" : "kein Dampfdruck bekannt" });
    // Kennlinienbereich und Modellgesetze
    // Stabilität mit Toleranz (Freigabe Runde 1, 06.11.2026: dH/dV̇ < 0 ohne Toleranz meldet bei Steigung 0 im Nullpunkt Rundungsreste)
    // Kennlinie bei n: H_n(V̇) = r²·H₀(V̇/r), dH_n/dV̇ = r·(a₁ + 2·a₂·V̇/r); die Steigung ist linear in V̇, größter Wert an einem Rand.
    const qmin = pumpPre.qmin, qmax = pumpPre.hi;
    const sl = [qmin, qmax].map((q) => r * (pc.H.c[1] + 2 * pc.H.c[2] * q / r));
    const hmax = Math.max(headAt(pc, r, qmin), headAt(pc, r, qmax), ...(pc.H.c[2] < 0 && -pc.H.c[1] / (2 * pc.H.c[2]) * r > qmin && -pc.H.c[1] / (2 * pc.H.c[2]) * r < qmax ? [headAt(pc, r, -pc.H.c[1] / (2 * pc.H.c[2]) * r)] : []));
    const epsSl = 1e-6 * hmax / qmax;
    const inRange = Q >= qmin - 1e-15 && Q <= qmax + 1e-15;
    const falling = sl.every((x) => x <= epsSl);
    nach.push(step("PU-N-BER", "Kennlinienbereich und Stabilität", "V̇_min·n/n₀ ≤ V̇_B ≤ V̇_max·n/n₀; dH/dV̇ ≤ ε mit ε = 10⁻⁶·H_max/V̇_max (an beiden Rändern)",
      `V̇_B = ${fmt(Q, 6)} m³/s ${inRange ? "in" : "außerhalb"} ${fmt(qmin, 6)} bis ${fmt(qmax, 6)} m³/s; ε = 10⁻⁶·${fmt(hmax, 6)}/${fmt(qmax, 6)} = ${fmt(epsSl, 4)} m/(m³/s); dH/dV̇ an den Rändern ${fmt(sl[0]!, 4)} und ${fmt(sl[1]!, 4)} m/(m³/s): ${falling ? "fallend (stabil)" : "nicht überall fallend"}`, Math.max(...sl), "m/(m³/s)", "Verfahren (R12); Dubbel 26 Bd. 3 S. 230"));
    checks.push({ key: "kennlinie", label: "Kennlinie", ok: falling && inRange && pumpPre.roots === 1, text: falling ? (pumpPre.roots === 1 ? "fallend, ein Schnittpunkt" : `${pumpPre.roots} Schnittpunkte`) : "Kennlinie nicht überall fallend (instabil)" });
    if (!falling) warnings.push("Pumpe: Kennlinie nicht überall fallend (Dubbel: nichtstabil, Betriebspunkt unter Umständen nicht eindeutig).");
    const dn = Math.abs(r - 1);
    nach.push(step("PU-N-AFF", "Gültigkeit der Modellgesetze", "|n/n₀ − 1| ≤ 0,2", `|${fmt(r, 6)} − 1| = ${fmt(dn, 4)} ${dn <= AFFINITY_LIMIT ? "≤" : ">"} 0,2`, dn, "1", `${PUMP_REFS.d3} S. 232`));
    checks.push({ key: "drehzahl", label: "Drehzahländerung", ok: dn <= AFFINITY_LIMIT, text: `n/n₀ = ${fmt(r, 4)}` });
    if (dn > AFFINITY_LIMIT) warnings.push(`Pumpe: Drehzahländerung ${fmt(dn * 100)} % über 20 %; der Wirkungsgrad bleibt nach Dubbel dann nicht konstant.`);
    // Diagrammwerte
    const qs = Array.from({ length: 41 }, (_, i) => (pumpPre!.hi * 1.15) * i / 40);
    const chart = {
      Q: qs, H: qs.map((q) => (q >= pumpPre!.lo - 1e-15 && q <= pumpPre!.hi + 1e-15 ? headAt(pc, r, q) : NaN)), HA: qs.map((q) => pumpPre!.HA(q)),
      eta: qs.map((q) => (q >= pumpPre!.lo - 1e-15 && q <= pumpPre!.hi + 1e-15 ? etaAt(pc, r, q) : null)),
      npshR: qs.map((q) => (q >= pumpPre!.lo - 1e-15 && q <= pumpPre!.hi + 1e-15 ? npshAt(pc, r, q, pu.npshExp) : null)),
      H0: qs.map((q) => (q >= pc.Qmin && q <= pc.Qmax ? polyAt(pc.H.c, q) : NaN)),
    };
    pumpRes = { curves: pc, r, n: r * pu.n0, Q, H: Hb, eta, Pu, P, nq, bep, npshA, npshR, reserve, margin: pu.npshMargin, residual: pumpPre.residual, roots: pumpPre.roots, chart };
  }
  if (inp.velocityGuideId) {
    const vg = fd.velocity(inp.velocityGuideId);
    if (!vg) errors.push(`Richtwert ${inp.velocityGuideId} nicht in den Fachdaten.`);
    else {
      const ok = vMax >= vg.v_min_m_s && vMax <= vg.v_max_m_s;
      checks.push({ key: "geschwindigkeit", label: "Geschwindigkeit", ok, text: `v_max = ${fmt(vMax)} m/s, Richtwert ${vg.system}, ${vg.case}: ${fmt(vg.v_min_m_s)} bis ${fmt(vg.v_max_m_s)} m/s` });
      nach.push(step("RH-N-V", "Geschwindigkeit gegen Richtwert", "v_min ≤ v_max,Strang ≤ v_max", `${fmt(vg.v_min_m_s)} ≤ ${fmt(vMax, 6)} ≤ ${fmt(vg.v_max_m_s)} m/s: ${ok ? "ja" : "nein"}`, vMax, "m/s", `${vg.source_locator} (${vg.source_id})`));
      if (!ok) warnings.push(`Geschwindigkeit ${fmt(vMax)} m/s außerhalb des Richtwerts ${fmt(vg.v_min_m_s)} bis ${fmt(vg.v_max_m_s)} m/s (${vg.case}).`);
    }
  }
  const pipes = ev.res.filter((r) => r.kind === "rohr" && r.Re !== null);
  const reMin = Math.min(...pipes.map((r) => r.Re!)), reMax = Math.max(...pipes.map((r) => r.Re!));
  const regimes = [...new Set(pipes.map((r) => r.regime))];
  checks.push({ key: "stroemung", label: "Strömungsbereich", ok: !regimes.includes("Übergang"), text: `Re ${fmt(reMin)} bis ${fmt(reMax)}: ${regimes.join(", ")}` });
  nach.push(step("RH-N-RE", "Strömungsbereich (größte Reynolds-Zahl im Strang)", "Re_max = max Re_i; Re < 2 320 laminar; 2 320 ≤ Re < 4 000 Übergang; Re ≥ 4 000 turbulent", `Re_min = ${fmt(reMin, 6)}, Re_max = ${fmt(reMax, 6)}: ${regimes.join(", ")}`, reMax, "1", "Roloff 27 S. 741; VDI-WA L1.2"));
  if (pumpSteps.length) (ev.G.pumpe ??= []).unshift(...pumpSteps);
  const trace: FluidTrace = { stoffwerte: fluid.steps, ...ev.G, nachweis: nach };
  const kpis: FluidKpi[] = [
    { key: "dpErf", label: task.kind === "D" ? "Druckerhöhung der Pumpe" : "Erforderliche Druckerhöhung", sym: "Δp_erf", value: ev.dpErf, unit: "Pa", primary: task.kind === "A" },
    { key: "pAErf", label: "Druck am Anfang", sym: "p_A,erf", value: ev.pAErf, unit: "Pa" },
    { key: "Q", label: task.kind === "D" ? "Förderstrom im Betriebspunkt" : "Volumenstrom", sym: task.kind === "D" ? "V̇_B" : "V̇", value: Q, unit: "m³/s", primary: task.kind === "B" || task.kind === "D" },
    ...(pumpRes ? [
      { key: "H", label: "Förderhöhe im Betriebspunkt", sym: "H_B", value: pumpRes.H, unit: "m", primary: true },
      ...(pumpRes.P !== null ? [{ key: "Ppump", label: "Leistungsbedarf der Pumpe", sym: "P", value: pumpRes.P, unit: "W", primary: true }] : []),
      ...(pumpRes.eta !== null ? [{ key: "etaB", label: "Wirkungsgrad im Betriebspunkt", sym: "η", value: pumpRes.eta, unit: "1" }] : []),
      ...(pumpRes.reserve !== null ? [{ key: "npshRes", label: "NPSH-Reserve", sym: "ΔNPSH", value: pumpRes.reserve, unit: "m", primary: true }] : []),
      { key: "n", label: "Drehzahl", sym: "n", value: pumpRes.n, unit: "1/s" },
      ...(pumpRes.nq !== null ? [{ key: "nq", label: "Spezifische Drehzahl", sym: "n_q", value: pumpRes.nq, unit: "1" }] : []),
    ] : []),
    ...(design ? [{ key: "dMin", label: "Kleinster Innendurchmesser", sym: "d_min", value: design.dMin, unit: "m", primary: true }] : []),
    ...(design?.pipe ? [{ key: "dGew", label: "Gewähltes Rohr, Innendurchmesser", sym: "d_i", value: design.pipe.d, unit: "m", primary: true }] : []),
    { key: "dpV", label: "Druckverlust gesamt", sym: "Δp_v", value: ev.dpV, unit: "Pa", primary: true },
    { key: "dpR", label: "davon Rohrreibung", sym: "ΣΔp_R", value: ev.dpR, unit: "Pa" },
    { key: "dpZ", label: "davon Formstücke und Armaturen", sym: "ΣΔp_ζ", value: ev.dpZ, unit: "Pa" },
    { key: "vMax", label: "Größte Geschwindigkeit", sym: "v_max", value: vMax, unit: "m/s", primary: true },
    { key: "Ph", label: "Hydraulische Leistung", sym: "P_h", value: Ph, unit: "W" },
    ...(P !== null ? [{ key: "P", label: "Antriebsleistung", sym: "P", value: P, unit: "W" }] : []),
    { key: "pMin", label: "Kleinster Druck im Strang", sym: "p_min", value: pMin, unit: "Pa" },
  ];
  return { task: task.kind, fluid, Q, elements: ev.res, nodes: ev.nodes, dpR: ev.dpR, dpZ: ev.dpZ, dpV: ev.dpV, dpGeo: ev.dpGeo, dpKin: ev.dpKin, dpErf: ev.dpErf, pAErf: ev.pAErf, Ph, P, vMax, pMin, flow, design, pump: pumpRes, checks, kpis, trace, errors, warnings: [...new Set(warnings)] };
}
