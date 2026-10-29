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
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace, type TraceGroupOf } from "../trace";
import type { FdLossCoeff, FdPipeSize, FdRepo } from "./fdData";
import { frictionFactor, type Friction } from "./friction";
import { fluidProps, type FluidInput, type FluidProps } from "./props";

export type FluidGroup = TraceGroupOf<"fluid">;
export type FluidTrace = Trace<FluidGroup>;

/** Rohrquerschnitt: Innendurchmesser von Hand, Normrohr mit Wanddicke, oder variabel (Aufgabe C). */
export type PipeGeom =
  | { kind: "d"; d: number }
  | { kind: "norm"; pipeId: string; wall: number }
  | { kind: "var" };

/** Rauheit: Tabellenzeile (k_min oder k_max) oder von Hand, k in m. */
export type Roughness = { kind: "tab"; id: string; which: "min" | "max" } | { kind: "hand"; k: number };

export type LineElement =
  | { kind: "rohr"; label?: string; L: number; geom: PipeGeom; rough: Roughness; dz: number }
  | { kind: "zeta"; label?: string; lossId: string; count: number }
  | { kind: "bogen"; label?: string; surface: "glatt" | "rauh"; rd: number; count: number }
  | { kind: "erweiterung"; label?: string }
  | { kind: "zetaHand"; label?: string; zeta: number; ref: "1" | "2" | null; count: number };

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
}

export type LineTask =
  | { kind: "A" }
  | { kind: "B"; dpAvail: number }
  | { kind: "C"; dpAllow: number; select: { norm: string; series: string; minWall: number | null } | null };

export interface ElementResult {
  index: number; kind: LineElement["kind"]; label: string;
  d: number | null; A: number | null; v: number | null; Re: number | null; k: number | null; eps: number | null;
  lambda: number | null; regime: Friction["regime"] | null; zeta: number | null; vRef: number | null;
  L: number; dz: number; dp: number; hv: number;
}
export interface LineNode { index: number; x: number; z: number; v: number; p: number; H: number; hp: number }
export interface FluidKpi { key: string; label: string; sym: string; value: number; unit: string; primary?: boolean }
export interface FluidCheck { key: "kavitation" | "geschwindigkeit" | "stroemung"; label: string; ok: boolean | null; text: string }

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
  checks: FluidCheck[];
  kpis: FluidKpi[];
  trace: FluidTrace;
  errors: string[];
  warnings: string[];
}

const REF_DUB = "Dubbel 26 Bd. 1 Gl. (17.10)";
const elLabel = (e: LineElement, i: number): string => e.label?.trim() || `${e.kind === "rohr" ? "Rohr" : e.kind === "erweiterung" ? "Erweiterung" : e.kind === "bogen" ? "Bogen" : "Element"} ${i + 1}`;

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
    let d: number;
    if (e.geom.kind === "d") d = e.geom.d;
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
    const A = (Math.PI * d * d) / 4, v = Q / A, Re = (v * d) / nu, eps = k / d;
    add("geometrie", step("RH-A", "Querschnitt", "A = π·d²/4", `${label}: A = π·${fmt(d, 6)}²/4`, A, "m²", "Roloff 27 Gl. 18.3"));
    add("geometrie", step("RH-V", "mittlere Geschwindigkeit", "v = V̇/A", `${label}: v = ${fmt(Q, 6)}/${fmt(A, 6)}`, v, "m/s", "Roloff 27 Gl. 18.3"));
    add("reibung", step("RH-RE", "Reynolds-Zahl", "Re = v·d/ν", `${label}: Re = ${fmt(v, 6)}·${fmt(d, 6)}/${fmt(nu, 6)}`, Re, "1", "Roloff 27 Gl. 18.8; VDI-WA L1.2 Gl. (2)"));
    add("reibung", step("RH-EPS", "relative Rauheit", "ε = k/d", `${label}: ε = ${fmt(k, 6)}/${fmt(d, 6)}`, eps, "1", "VDI-WA L1.2 Gl. (8)"));
    const f = frictionFactor(Re, eps, label);
    errors.push(...f.errors); warnings.push(...f.warnings);
    f.steps.forEach((s) => add("reibung", s));
    const dp = f.lambda * (e.L / d) * rho * v * v / 2;
    add("verluste", step("RH-DP-R", "Reibungsdruckverlust", "Δp_R = λ·(L/d)·ρ·v²/2", `${label}: Δp_R = ${fmt(f.lambda, 6)}·(${fmt(e.L, 6)}/${fmt(d, 6)})·${fmt(rho, 6)}·${fmt(v, 6)}²/2`, dp, "Pa", "Roloff 27 Gl. 18.5; VDI-WA L1.2 Gl. (1)"));
    res.push({ ...base, d, A, v, Re, k, eps, lambda: f.lambda, regime: f.regime, L: e.L, dz: e.dz, dp, hv: dp / (rho * g) });
  });
  const pipeV = (from: number, dir: -1 | 1): number | null => {
    for (let j = from; j >= 0 && j < res.length; j += dir) if (res[j]!.kind === "rohr" && res[j]!.v !== null) return res[j]!.v;
    return null;
  };
  // 2. Formstücke und Armaturen
  els.forEach((e, i) => {
    if (e.kind === "rohr") return;
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
  let p = pAErf;
  for (let i = 0; i <= n; i++) {
    if (i > 0) {
      const r = res[i - 1]!;
      const pPrev = p;
      p = pPrev + rho / 2 * (vNode[i - 1]! ** 2 - vNode[i]! ** 2) + rho * g * (zNode[i - 1]! - zNode[i]!) - r.dp;
      add("energie", step("RH-BE", "Druck nach dem Element", "p_2 = p_1 + ρ/2·(v_1² − v_2²) + ρ·g·(z_1 − z_2) − Δp_v",
        `${r.label}: p = ${fmt(pPrev, 6)} + ${fmt(rho, 6)}/2·(${fmt(vNode[i - 1]!, 6)}² − ${fmt(vNode[i]!, 6)}²) + ${fmt(rho, 6)}·${fmt(g, 6)}·(${fmt(zNode[i - 1]!, 6)} − ${fmt(zNode[i]!, 6)}) − ${fmt(r.dp, 6)}`, p, "Pa", REF_DUB));
    }
    const hp = p / (rho * g), H = hp + vNode[i]! ** 2 / (2 * g) + zNode[i]!;
    nodes.push({ index: i, x: xNode[i]!, z: zNode[i]!, v: vNode[i]!, p, H, hp });
  }
  for (const i of [0, n]) {
    const nd = nodes[i]!, tag = i === 0 ? "Anfang" : "Ende";
    add("energie", step("RH-H-P", "Druckhöhe", "h_p = p/(ρ·g)", `${tag}: h_p = ${fmt(nd.p, 6)}/(${fmt(rho, 6)}·${fmt(g, 6)})`, nd.hp, "m", "Dubbel 26 Bd. 1 S. 325"));
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
  if (task.kind !== "B" && !(inp.Q > 0)) e.push("Volumenstrom muss größer als 0 sein.");
  if (task.kind === "C" && !inp.elements.some((x) => x.kind === "rohr" && x.geom.kind === "var")) e.push("Aufgabe C: mindestens ein Rohr mit variablem Durchmesser markieren.");
  if (task.kind !== "C" && inp.elements.some((x) => x.kind === "rohr" && x.geom.kind === "var")) e.push("Variabler Durchmesser nur in Aufgabe C.");
  return e;
}

/** Rohrstrang rechnen (Aufgaben A, B, C). */
export function computeLine(fd: FdRepo, inp: LineInput, task: LineTask = { kind: "A" }): LineResult {
  const fluid = fluidProps(fd, inp.fluid);
  const errors = [...validate(inp, task), ...fluid.errors];
  const warnings = [...fluid.warnings];
  const empty = (): LineResult => ({ task: task.kind, fluid, Q: NaN, elements: [], nodes: [], dpR: NaN, dpZ: NaN, dpV: NaN, dpGeo: NaN, dpKin: NaN, dpErf: NaN, pAErf: NaN, Ph: NaN, P: null, vMax: NaN, pMin: NaN, flow: null, design: null, checks: [], kpis: [], trace: { stoffwerte: fluid.steps }, errors, warnings });
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
  if (fluid.ps !== null) {
    const ok = pMin >= fluid.ps;
    checks.push({ key: "kavitation", label: "Kavitation", ok, text: `p_min = ${fmt(pMin / 1e5, 4)} bar ${ok ? "≥" : "<"} p_s = ${fmt(fluid.ps / 1e5, 4)} bar` });
    nach.push(step("RH-N-KAV", "Kavitationsgefahr (Abstand zum Dampfdruck)", "p_abs,min/p_s ≥ 1", `p_abs,min/p_s = ${fmt(pMin, 6)} Pa/${fmt(fluid.ps, 6)} Pa = ${fmt(pMin / fluid.ps, 4)} ${ok ? "≥" : "<"} 1: ${ok ? "keine Kavitation" : "Kavitation"}`, pMin / fluid.ps, "1", "IAPWS-IF97 Gl. (30)"));
    if (!ok) warnings.push(`Kavitation: der kleinste Druck im Strang (${fmt(pMin / 1e5)} bar) liegt unter dem Sättigungsdruck (${fmt(fluid.ps / 1e5)} bar). NPSH folgt mit RH b.`);
  } else checks.push({ key: "kavitation", label: "Kavitation", ok: null, text: "kein Sättigungsdruck bekannt" });
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
  const trace: FluidTrace = { stoffwerte: fluid.steps, ...ev.G, nachweis: nach };
  const kpis: FluidKpi[] = [
    { key: "dpErf", label: "Erforderliche Druckerhöhung", sym: "Δp_erf", value: ev.dpErf, unit: "Pa", primary: task.kind === "A" },
    { key: "pAErf", label: "Druck am Anfang", sym: "p_A,erf", value: ev.pAErf, unit: "Pa" },
    { key: "Q", label: "Volumenstrom", sym: "V̇", value: Q, unit: "m³/s", primary: task.kind === "B" },
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
  return { task: task.kind, fluid, Q, elements: ev.res, nodes: ev.nodes, dpR: ev.dpR, dpZ: ev.dpZ, dpV: ev.dpV, dpGeo: ev.dpGeo, dpKin: ev.dpKin, dpErf: ev.dpErf, pAErf: ev.pAErf, Ph, P, vMax, pMin, flow, design, checks, kpis, trace, errors, warnings: [...new Set(warnings)] };
}
