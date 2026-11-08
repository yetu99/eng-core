/**
 * Zylindrischer Pressverband nach DIN 7190-1:2017 (Modul verbindungen, Präfix PV, eng-core 0.17.0).
 * Konzept fachtools/konzept_pv.md, freigegeben 08.11.2026 (F-pv1 bis F-pv11). Eigene Umsetzung ohne Normtext (E12).
 *   Aufgabe A Nachrechnen: Passung oder Übermaß gegeben → p_min, p_max, T, F_ax, Sicherheiten, Spannungen, Fügen.
 *   Aufgabe B Auslegen: T, F_ax gegeben → Ü_u, Ü_o, Passtoleranz, Passungsvorschlag; mit gewählter Passung wie A.
 * Annahmen: gleiche Länge von Welle und Nabe, Nabe mit konstantem D_aA, ebener Spannungszustand, Glättung g_F = 0,4,
 * rein elastisch (Rechengang 1 und 2); elastisch-plastisch und Fliehkraft als Option (DIN 4.3, 10.2).
 * Spröde Fügeteile (A < 10 % oder ohne R_e): rein elastisch mit R_m statt R_eL (DIN 4.1, Roloff Bsp. 12.2, O-pv3).
 * Lastfall T und F_ax gleichzeitig über die resultierende Umfangs- und Längskraft (Roloff (12.9)).
 * Einheiten intern N, mm, MPa (N/mm²), °C; Übermaße in mm (Anzeige µm), Moment in N·mm (Anzeige N·m).
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace } from "../trace";
import { lame, type StressPoint } from "../mechanics/pressure";
import { rzOfRa, type PvMaterial, type PvRepo } from "./pvData";
import { REF_DIN, REF_ROLOFF, PV_REL_TOL, fitLimits, fitSteps, fitSelectStep, selectFits, type FitCandidate, type FitLimits, type FitSpecIso } from "./fit";
import { plasticFromPressure, plasticFromXi, plasticLimits, type PlasticLimits } from "./plastic";
import { computeSpin, spinXiLimits, type SpinResult } from "./spin";
import { computeLaengs, computeQuer, type JoinResult, type PvJoining } from "./join";

export type RzSpec = { kind: "rz"; Rz: number } | { kind: "ra"; Ra: number };
export type PvFitSpec = FitSpecIso | { kind: "manual"; Uk: number; Ug: number };
export interface PressFitInput {
  task: "A" | "B";
  /** Fugendurchmesser, Fugenlänge, Außendurchmesser Nabe, Innendurchmesser Welle (0 = voll) in mm */
  DF: number; lF: number; DaA: number; DiI: number;
  hub: PvMaterial; shaft: PvMaterial;
  /** gemittelte Rautiefe in µm oder Ra (0,8; 1,6; 3,2 µm) nach DIN Tab. 1 */
  rzA: RzSpec; rzI: RzSpec;
  /** A: Pflicht; B: optional (gewählte Passung nachrechnen). Übermaß von Hand in mm. */
  fit: PvFitSpec | null;
  /** Drehmoment in N·mm, Axialkraft in N, Anwendungsfaktor, Soll-Sicherheiten gegen Rutschen und plastische Dehnung */
  T: number; Fax: number; KA: number; Sr: number; SPA: number; SPI: number;
  /** Haftbeiwert Rutschen (quer ν_r = ν_ru = ν_rl, längs ν_rl) und Lösen ν_ll (Längspress, Einpresskraft) */
  nuR: number; nuL: number | null;
  joining: PvJoining;
  /** Optionen: elastisch-plastisch (DIN 4.3) und Drehzahl in 1/min (DIN 10.2), Standard aus */
  plastic: boolean; spinN: number | null;
}

export type PvGroup = "geometrie" | "passung" | "fugendruck" | "betrieb" | "spannungen" | "montage" | "plastisch" | "fliehkraft" | "nachweis";
export type PvState = "elastisch" | "elastisch-plastisch" | "unzulässig";
export interface PvKpi { key: string; label: string; sym: string; value: number; unit: string; primary?: boolean }
export interface PvCheck { key: "rutschen" | "nabe" | "welle" | "plastisch" | "passung" | "verformbarkeit" | "fuegetemperatur" | "fliehkraft" | "gestaltung"; id: string; label: string; ok: boolean | null; text: string }
export interface PvSide { U: number; Uw: number; xi: number; p: number; state: PvState; zeta: number | null; qPA: number | null }
export interface PressFitResult {
  task: "A" | "B";
  QA: number; QI: number; AF: number; K: number; RzA: number; RzI: number; G: number;
  /** Festigkeitskennwert in der Rechnung (R_eL oder spröde R_m) und zulässige Fugendrücke rein elastisch */
  RA: number; RI: number; pzulA: number; pzulI: number;
  Ft: number; FR: number; perf: number | null;
  Uu: number | null; Uo: number | null; PT: number | null; candidates: FitCandidate[];
  fit: (FitLimits & { manual: boolean }) | null;
  min: PvSide | null; max: PvSide | null;
  T: number | null; Faxt: number | null; SrIst: number | null; SPAist: number | null; SPIist: number | null;
  stress: { tAi: number; tAa: number; tIi: number; tIa: number; rF: number; vA: number; vI: number } | null; dDaA: number | null;
  join: JoinResult | null; plastic: PlasticLimits | null; spin: (SpinResult & { lim54: number; lim55: number }) | null;
  checks: PvCheck[]; kpis: PvKpi[]; trace: Trace<PvGroup>; errors: string[]; warnings: string[];
}

const S3 = Math.sqrt(3);
const um = (x: number) => fmt(x * 1e3);
const e3 = (x: number) => `${fmt(x * 1e3, 5)}·10⁻³`;
/** a ≤ b mit relativer Toleranz 10⁻⁹ (O-pv2). */
export const pvLe = (a: number, b: number): boolean => a <= b + PV_REL_TOL * Math.max(Math.abs(a), Math.abs(b), 1e-300);

/** Hilfsgröße K (DIN Gl. (13), Sonderfall volle Welle Gl. (14)). */
export const pvK = (EA: number, EI: number, muA: number, muI: number, QA: number, QI: number): number =>
  EA / EI * ((1 + QI * QI) / (1 - QI * QI) - muI) + (1 + QA * QA) / (1 - QA * QA) + muA;

export function computePressFit(fd: PvRepo, inp: PressFitInput): PressFitResult {
  const errors: string[] = [], warnings: string[] = [];
  const G_: Trace<PvGroup> = {}; const add = (g: PvGroup, s: CalcStep) => { (G_[g] ??= []).push(s); };
  const { DF, lF, DaA, DiI, hub, shaft } = inp;
  const empty = (): PressFitResult => ({ task: inp.task, QA: NaN, QI: NaN, AF: NaN, K: NaN, RzA: NaN, RzI: NaN, G: NaN, RA: NaN, RI: NaN, pzulA: NaN, pzulI: NaN, Ft: NaN, FR: NaN, perf: null,
    Uu: null, Uo: null, PT: null, candidates: [], fit: null, min: null, max: null, T: null, Faxt: null, SrIst: null, SPAist: null, SPIist: null, stress: null, dDaA: null, join: null, plastic: null, spin: null,
    checks: [], kpis: [], trace: G_, errors, warnings });
  // ---------------------------------------------------------------- Eingaben prüfen (PV-P15)
  if (!(DF > 0)) errors.push("Fugendurchmesser D_F muss größer als 0 sein.");
  if (!(lF > 0)) errors.push("Fugenlänge l_F muss größer als 0 sein.");
  if (!(DaA > DF)) errors.push("Außendurchmesser der Nabe muss größer als D_F sein (Q_A < 1).");
  if (!(DiI >= 0 && DiI < DF)) errors.push("Innendurchmesser der Welle: 0 (voll) oder 0 < D_iI < D_F.");
  for (const [m, n] of [[hub, "Nabe"], [shaft, "Welle"]] as const) {
    if (!(m.E > 0)) errors.push(`${n}: E-Modul fehlt oder ist nicht größer als 0.`);
    if (!(m.mu > 0 && m.mu < 0.5)) errors.push(`${n}: Querdehnzahl μ zwischen 0 und 0,5 eingeben.`);
    if (!(((m.brittle ? m.Rm : m.Re) ?? 0) > 0)) errors.push(`${n}: ${m.brittle ? "R_m" : "R_eL"} fehlt (spröde: R_m, sonst R_eL bzw. R_p0,2).`);
  }
  if (!(inp.SPA > 0 && inp.SPI > 0 && inp.Sr > 0 && inp.KA > 0)) errors.push("Sicherheiten S_r, S_PA, S_PI und K_A müssen größer als 0 sein.");
  if (!(inp.nuR > 0 && inp.nuR < 1)) errors.push("Haftbeiwert ν_r zwischen 0 und 1 eingeben.");
  if (!(inp.T >= 0 && inp.Fax >= 0)) errors.push("Drehmoment und Axialkraft dürfen nicht negativ sein.");
  if (inp.task === "B" && !(inp.T > 0 || inp.Fax > 0)) errors.push("Aufgabe B: Drehmoment oder Axialkraft eingeben.");
  if (inp.task === "A" && !inp.fit) errors.push("Aufgabe A: Passung oder Übermaß eingeben.");
  if (inp.fit?.kind === "iso" && !([inp.fit.hole, inp.fit.grade].every((g) => Number.isInteger(g) && g >= 5 && g <= 11))) errors.push("ISO-Passung: Grade IT5 bis IT11.");
  if (inp.fit?.kind === "manual" && !(inp.fit.Ug >= inp.fit.Uk && inp.fit.Uk > 0)) errors.push("Übermaß von Hand: 0 < U_k ≤ U_g.");
  if (inp.joining.kind === "laengs" && !(inp.nuL !== null && inp.nuL > 0 && inp.nuL < 1)) errors.push("Längspressverband: Haftbeiwert ν_ll (Lösen) zwischen 0 und 1 eingeben.");
  const rzOf = (r: RzSpec, n: string): number => {
    if (r.kind === "rz") { if (!(r.Rz >= 0)) errors.push(`${n}: Rz ≥ 0 eingeben.`); return r.Rz; }
    const row = rzOfRa(fd, r.Ra); if (!row) { errors.push(`${n}: Ra ${fmt(r.Ra)} µm nicht in DIN 7190-1 Tab. 1 (0,8; 1,6; 3,2).`); return NaN; } return row.rz_um;
  };
  const RzA = rzOf(inp.rzA, "Nabe"), RzI = rzOf(inp.rzI, "Welle");
  let FL: FitLimits | string | null = null;
  if (inp.fit?.kind === "iso" && !errors.length) { FL = fitLimits(fd, DF, inp.fit); if (typeof FL === "string") errors.push(FL); }
  if (errors.length) return empty();

  // ---------------------------------------------------------------- Geometrie
  const QA = DF / DaA, QI = DiI / DF, AF = Math.PI * DF * lF, solid = DiI === 0;
  add("geometrie", step("PV-QA", "Durchmesserverhältnis Nabe", "Q_A = D_F/D_aA", `Q_A = ${fmt(DF)}/${fmt(DaA)} = ${fmt(QA, 5)}`, QA, "1", `${REF_DIN} Gl. (10)`));
  add("geometrie", step("PV-QI", "Durchmesserverhältnis Welle", "Q_I = D_iI/D_F (Vollwelle: 0)", `Q_I = ${fmt(DiI)}/${fmt(DF)} = ${fmt(QI, 5)}`, QI, "1", `${REF_DIN} Gl. (11)`));
  add("geometrie", step("PV-AF", "Fugenfläche", "A_F = π·D_F·l_F", `A_F = π·${fmt(DF)}·${fmt(lF)} = ${fmt(AF)} mm²`, AF, "mm²", `${REF_ROLOFF} (12.10)`));
  // ---------------------------------------------------------------- Oberfläche und Glättung
  for (const [r, n, v] of [[inp.rzA, "Nabe", RzA], [inp.rzI, "Welle", RzI]] as const)
    if (r.kind === "ra") add("passung", step("PV-RZ", "Rz aus Ra", "Ra 0,8/1,6/3,2 µm → Rz 6,3/12,5/20 µm", `${n}: Ra ${fmt(r.Ra)} µm → Rz ${fmt(v)} µm`, v, "µm", `${REF_DIN} Tab. 1`));
  const G = 0.4 * (RzA + RzI) / 1e3;
  add("passung", step("PV-GL", "Glättung", "G = 0,4·(Rz_A + Rz_I)", `G = 0,4·(${fmt(RzA)} + ${fmt(RzI)}) = ${um(G)} µm`, G, "mm", `${REF_DIN} Gl. (7); ${REF_ROLOFF} (12.15)`));
  // ---------------------------------------------------------------- Hilfsgröße und zulässige Fugendrücke
  const K = pvK(hub.E, shaft.E, hub.mu, shaft.mu, QA, QI);
  add("fugendruck", step("PV-K", "Hilfsgröße K", "K = E_A/E_I·[(1 + Q_I²)/(1 − Q_I²) − μ_I] + (1 + Q_A²)/(1 − Q_A²) + μ_A",
    `K = ${fmt(hub.E)}/${fmt(shaft.E)}·[(1 + ${fmt(QI)}²)/(1 − ${fmt(QI)}²) − ${fmt(shaft.mu)}] + (1 + ${fmt(QA)}²)/(1 − ${fmt(QA)}²) + ${fmt(hub.mu)} = ${fmt(K, 5)}`, K, "1", `${REF_DIN} Gl. (13), (14); ${REF_ROLOFF} (12.13)`));
  const RA = (hub.brittle ? hub.Rm : hub.Re)!, RI = (shaft.brittle ? shaft.Rm : shaft.Re)!;
  const sA = hub.brittle ? "R_mA (spröde)" : "R_eLA", sI = shaft.brittle ? "R_mI (spröde)" : "R_eLI";
  if (hub.brittle) warnings.push("Nabe spröde: rein elastische Auslegung mit R_m (DIN 7190-1 Abschn. 4.1); Vorschlag S_P = 2 (Roloff Bsp. 12.2).");
  if (shaft.brittle) warnings.push("Welle spröde: rein elastische Auslegung mit R_m (DIN 7190-1 Abschn. 4.1).");
  const pzulA = (1 - QA * QA) * RA / (S3 * inp.SPA);
  add("fugendruck", step("PV-PZA", "Zulässiger Fugendruck Nabe (rein elastisch)", "p_zul,A = (1 − Q_A²)·R_eLA/(√3·S_PA)", `p_zul,A = (1 − ${fmt(QA)}²)·${fmt(RA)} (${sA})/(√3·${fmt(inp.SPA)}) = ${fmt(pzulA)} N/mm²`, pzulA, "N/mm²", `${REF_DIN} Gl. (15); ${REF_ROLOFF} (12.17)`));
  const pzulI = solid ? 2 * RI / (S3 * inp.SPI) : (1 - QI * QI) * RI / (S3 * inp.SPI);
  add("fugendruck", solid
    ? step("PV-PZI-V", "Zulässiger Fugendruck Vollwelle", "p_zul,I = 2·R_eLI/(√3·S_PI)", `p_zul,I = 2·${fmt(RI)} (${sI})/(√3·${fmt(inp.SPI)}) = ${fmt(pzulI)} N/mm²`, pzulI, "N/mm²", `${REF_DIN} Gl. (17)`)
    : step("PV-PZI-H", "Zulässiger Fugendruck Hohlwelle", "p_zul,I = (1 − Q_I²)·R_eLI/(√3·S_PI)", `p_zul,I = (1 − ${fmt(QI)}²)·${fmt(RI)} (${sI})/(√3·${fmt(inp.SPI)}) = ${fmt(pzulI)} N/mm²`, pzulI, "N/mm²", `${REF_DIN} Gl. (16)`));

  // ---------------------------------------------------------------- Option elastisch-plastisch: Voraussetzungen und Grenzen
  let PL: PlasticLimits | null = null;
  const plSteps: CalcStep[] = [];
  if (inp.plastic) {
    const pre: string[] = [];
    if (!solid) pre.push("Welle nicht voll (Q_I > 0)");
    if (Math.abs(hub.E - shaft.E) > PV_REL_TOL * hub.E || Math.abs(hub.mu - shaft.mu) > 1e-12) pre.push("E oder μ von Welle und Nabe verschieden");
    if (hub.brittle || shaft.brittle) pre.push("spröder Werkstoff");
    for (const [m, n] of [[hub, "Nabe"], [shaft, "Welle"]] as const) if (m.A !== null && m.A < 10) pre.push(`Bruchdehnung ${n} ${fmt(m.A)} % < 10 %`);
    if (pre.length) warnings.push(`Option elastisch-plastisch nicht anwendbar (DIN 7190-1 Abschn. 4.3.1): ${pre.join("; ")}. Rechnung rein elastisch.`);
    else {
      PL = plasticLimits(QA, RA, RI, inp.SPA, inp.SPI, hub.E, plSteps);
      if (!PL.possible) warnings.push(`Elastisch-plastische Auslegung nicht möglich: ${PL.reason}. Rechnung rein elastisch.`);
      warnings.push("Elastisch-plastisch: Brucheinschnürung Z ≥ 30 % (DIN 7190-1 Gl. (9)) selbst prüfen, die WDB führt Z nicht.");
    }
  }
  const epOn = PL !== null && PL.possible;

  // ---------------------------------------------------------------- Belastung und Haftung
  const Ft = 2 * inp.T / DF, Fres = Math.hypot(inp.Fax, Ft), FR = inp.Sr * inp.KA * Fres, loaded = Fres > 0;
  let perf: number | null = null;
  if (loaded) {
    if (inp.T > 0) add("betrieb", step("PV-FT", "Umfangskraft in der Fuge", "F_t = 2·T/D_F", `F_t = 2·${fmt(inp.T / 1e3)} N·m·10³/${fmt(DF)} = ${fmt(Ft)} N`, Ft, "N", `${REF_ROLOFF} S. 449`));
    add("betrieb", step("PV-FRES", "Rutschkraft (Auslegung)", "F_R = S_r·K_A·√(F_ax² + F_t²)", `F_R = ${fmt(inp.Sr)}·${fmt(inp.KA)}·√(${fmt(inp.Fax)}² + ${fmt(Ft)}²) = ${fmt(FR)} N`, FR, "N", `${REF_ROLOFF} (12.9)`));
    perf = FR / (AF * inp.nuR);
    add("betrieb", step("PV-PERF", "Erforderlicher Fugendruck", "p_erf = F_R/(A_F·ν_r)", `p_erf = ${fmt(FR)}/(${fmt(AF)}·${fmt(inp.nuR)}) = ${fmt(perf)} N/mm²`, perf, "N/mm²", `${REF_ROLOFF} (12.10); ${REF_DIN} Gl. (1), (2) umgestellt`));
  }

  // ---------------------------------------------------------------- Aufgabe B: Übermaßgrenzen und Passungsvorschlag
  let Uu: number | null = null, Uo: number | null = null, PT: number | null = null, candidates: FitCandidate[] = [];
  if (inp.task === "B" && perf !== null) {
    const pmaxAllow = Math.min(pzulA, pzulI);
    let xiU: number;
    if (epOn && perf > PL!.pEl * (1 + PV_REL_TOL)) {
      const r = plasticFromPressure(QA, perf, RA, hub.E, plSteps);
      if (r === null || perf > PL!.pZul * (1 + PV_REL_TOL)) { errors.push(`Erforderlicher Fugendruck ${fmt(perf)} N/mm² über dem zulässigen elastisch-plastischen Fugendruck ${fmt(PL!.pZul)} N/mm².`); return empty(); }
      xiU = r.xi;
      add("fugendruck", step("PV-UU", "Kleinstes erforderliches Übermaß (elastisch-plastisch)", "Ü_u = ξ_w·D_F + G", `Ü_u = ${e3(xiU)}·${fmt(DF)} + ${um(G)}·10⁻³ = ${um(xiU * DF + G)} µm`, xiU * DF + G, "mm", `${REF_DIN} Gl. (34), (12), (7)`));
    } else {
      xiU = K * perf / hub.E;
      add("fugendruck", step("PV-XIERF", "Bezogenes wirksames Übermaß für p_erf", "ξ_w = K·p/E_A", `ξ_w = ${fmt(K, 5)}·${fmt(perf)}/${fmt(hub.E)} = ${e3(xiU)}`, xiU, "1", `${REF_DIN} Gl. (18)`));
      add("fugendruck", step("PV-UU", "Kleinstes erforderliches Übermaß", "Ü_u = K·p_erf·D_F/E_A + G", `Ü_u = ${fmt(K, 5)}·${fmt(perf)}·${fmt(DF)}/${fmt(hub.E)} + ${um(G)}·10⁻³ = ${um(xiU * DF + G)} µm`, xiU * DF + G, "mm", `${REF_ROLOFF} (12.14), (12.16); ${REF_DIN} Gl. (18), (7)`));
    }
    Uu = xiU * DF + G;
    if (epOn) {
      Uo = PL!.xiZul! * DF + G;
      add("fugendruck", step("PV-UO", "Größtes zulässiges Übermaß (elastisch-plastisch)", "Ü_o = ξ_w,zul·D_F + G", `Ü_o = ${e3(PL!.xiZul!)}·${fmt(DF)} + ${um(G)}·10⁻³ = ${um(Uo)} µm`, Uo, "mm", `${REF_DIN} Gl. (41), (12), (7)`));
    } else {
      Uo = K * pmaxAllow * DF / hub.E + G;
      add("fugendruck", step("PV-UO", "Größtes zulässiges Übermaß", "Ü_o = K·min(p_zul,A; p_zul,I)·D_F/E_A + G", `Ü_o = ${fmt(K, 5)}·${fmt(pmaxAllow)}·${fmt(DF)}/${fmt(hub.E)} + ${um(G)}·10⁻³ = ${um(Uo)} µm`, Uo, "mm", `${REF_ROLOFF} (12.18), (12.19)`));
    }
    PT = Uo - Uu;
    add("fugendruck", step("PV-PT", "Passtoleranz", "PT = Ü_o − Ü_u", `PT = ${um(Uo)} − ${um(Uu)} = ${um(PT)} µm`, PT, "mm", `${REF_ROLOFF} (12.20)`));
    if (!(PT > 0)) errors.push(`Passtoleranz ${um(PT)} µm ≤ 0: kein Übermaß erfüllt Rutschen und plastische Grenze; Nabe, Länge oder Werkstoff ändern.`);
    else {
      candidates = selectFits(fd, DF, Uu, Uo);
      if (DF <= 500) add("passung", fitSelectStep(DF, Uu, Uo, candidates)); else warnings.push("Passungsvorschlag nur bis D_F = 500 mm (ISO 286-1 Tab. 1, 5 im Umfang).");
      if (DF <= 500 && !candidates.length) warnings.push("Keine Passung H6 bis H8 mit p bis z (IT5 bis IT8) liegt zwischen Ü_u und Ü_o.");
    }
  }

  // ---------------------------------------------------------------- Übermaß der gewählten Passung
  let fit: PressFitResult["fit"] = null;
  if (inp.fit?.kind === "iso" && FL && typeof FL !== "string") { fit = { ...FL, manual: false }; fitSteps(fd, DF, inp.fit, FL).forEach((s) => add("passung", s)); }
  if (inp.fit?.kind === "manual") {
    fit = { label: "von Hand", EI: NaN, ES: NaN, ei: NaN, es: NaN, Uk: inp.fit.Uk, Ug: inp.fit.Ug, manual: true };
    add("passung", step("PV-U-MAN", "Übermaß von Hand", "U_k, U_g eingegeben (U_k ≤ U_i ≤ U_g)", `U_k = ${um(inp.fit.Uk)} µm, U_g = ${um(inp.fit.Ug)} µm`, inp.fit.Uk, "mm", `${REF_DIN} Gl. (6)`));
  }
  let side: { min: PvSide; max: PvSide } | null = null;
  if (fit && !errors.length) {
    const one = (U: number, tag: "k" | "g"): PvSide => {
      const Uw = U - G, xi = Uw / DF, name = tag === "k" ? "Mindestübermaß" : "Höchstübermaß";
      add("passung", step("PV-UW", "Wirksames Übermaß", "U_w = U − G", `${name}: U_w,${tag} = ${um(U)} − ${um(G)} = ${um(Uw)} µm`, Uw, "mm", `${REF_DIN} Gl. (7)`));
      add("passung", step("PV-XI", "Bezogenes wirksames Übermaß", "ξ_w = U_w/D_F", `${name}: ξ_w,${tag} = ${um(Uw)}·10⁻³/${fmt(DF)} = ${e3(xi)}`, xi, "1", `${REF_DIN} Gl. (12)`));
      if (!(Uw > 0)) { errors.push(`Wirksames Übermaß U_w,${tag} = ${um(Uw)} µm ≤ 0: die Glättung ${um(G)} µm hebt das Übermaß auf.`); return { U, Uw, xi, p: NaN, state: "unzulässig", zeta: null, qPA: null }; }
      if (epOn && xi > PL!.xiEl * (1 + PV_REL_TOL)) {
        const ok = pvLe(xi, PL!.xiZul!);
        const r = plasticFromXi(QA, xi, RA, hub.E, plSteps, tag === "k" ? "U_k" : "U_g");
        return { U, Uw, xi, p: r.p, state: ok && r.q <= 0.3 + PV_REL_TOL ? "elastisch-plastisch" : "unzulässig", zeta: r.zeta, qPA: r.q };
      }
      const p = xi * hub.E / K;
      add("fugendruck", step("PV-P", "Fugendruck aus Übermaß", "p = ξ_w·E_A/K", `${tag === "k" ? "p_min" : "p_max"} = ${e3(xi)}·${fmt(hub.E)}/${fmt(K, 5)} = ${fmt(p)} N/mm²`, p, "N/mm²", `${REF_DIN} Gl. (24)`));
      return { U, Uw, xi, p, state: pvLe(p, Math.min(pzulA, pzulI)) ? "elastisch" : "unzulässig", zeta: null, qPA: null };
    };
    const mn = one(fit.Uk, "k"), mx = one(fit.Ug, "g");
    if (!errors.length) side = { min: mn, max: mx };
  }
  plSteps.forEach((s) => add("plastisch", s));
  if (errors.length) return empty();

  // ---------------------------------------------------------------- Übertragbare Lasten, Sicherheiten, Spannungen (bei Passung)
  let Tt: number | null = null, Faxt: number | null = null, SrIst: number | null = null, SPAist: number | null = null, SPIist: number | null = null;
  let stress: PressFitResult["stress"] = null, dDaA: number | null = null, join: JoinResult | null = null, spin: PressFitResult["spin"] = null;
  if (side) {
    const pmin = side.min.p, pmax = side.max.p;
    Tt = Math.PI / 2 * DF * DF * lF * pmin * inp.nuR / inp.Sr; Faxt = Math.PI * DF * lF * pmin * inp.nuR / inp.Sr;
    add("betrieb", step("PV-T", "Übertragbares Drehmoment (p_min)", "T = π/2·D_F²·l_F·p·ν_ru/S_r", `T = π/2·${fmt(DF)}²·${fmt(lF)}·${fmt(pmin)}·${fmt(inp.nuR)}/${fmt(inp.Sr)} = ${fmt(Tt / 1e3)} N·m`, Tt, "N·mm", `${REF_DIN} Gl. (1)`));
    add("betrieb", step("PV-FAX", "Übertragbare Axialkraft (p_min)", "F_ax = π·D_F·l_F·p·ν_rl/S_r", `F_ax = π·${fmt(DF)}·${fmt(lF)}·${fmt(pmin)}·${fmt(inp.nuR)}/${fmt(inp.Sr)} = ${fmt(Faxt / 1e3)} kN`, Faxt, "N", `${REF_DIN} Gl. (2)`));
    // Spannungen mit p_max (geschlossene Form; Lamé-Verlauf über pressFitProfile)
    const p = pmax, qa = QA * QA, qi = QI * QI;
    const tAi = p * (1 + qa) / (1 - qa), tAa = 2 * p * qa / (1 - qa), tIi = solid ? -p : -2 * p / (1 - qi), tIa = solid ? -p : -p * (1 + qi) / (1 - qi);
    const vA = 2 * p / (1 - qa), vI = solid ? p : 2 * p / (1 - qi);
    add("spannungen", step("PV-S-TAI", "Tangentialspannung Nabe innen (p_max)", "σ_tAi = p·(1 + Q_A²)/(1 − Q_A²); σ_r = −p", `σ_tAi = ${fmt(p)}·(1 + ${fmt(qa)})/(1 − ${fmt(qa)}) = ${fmt(tAi)} N/mm²`, tAi, "N/mm²", `${REF_ROLOFF} (12.6)`));
    add("spannungen", step("PV-S-TAA", "Tangentialspannung Nabe außen (p_max)", "σ_tAa = 2·p·Q_A²/(1 − Q_A²)", `σ_tAa = 2·${fmt(p)}·${fmt(qa)}/(1 − ${fmt(qa)}) = ${fmt(tAa)} N/mm²`, tAa, "N/mm²", `${REF_ROLOFF} (12.6)`));
    add("spannungen", step("PV-S-TII", "Tangentialspannung Welle innen (p_max)", solid ? "Vollwelle: σ_t = σ_r = −p" : "σ_tIi = −2·p/(1 − Q_I²)", solid ? `σ_tIi = −${fmt(p)} N/mm²` : `σ_tIi = −2·${fmt(p)}/(1 − ${fmt(qi)}) = ${fmt(tIi)} N/mm²`, tIi, "N/mm²", `${REF_ROLOFF} (12.7), S. 443`));
    add("spannungen", step("PV-S-TIA", "Tangentialspannung Welle außen (p_max)", "σ_tIa = −p·(1 + Q_I²)/(1 − Q_I²)", `σ_tIa = −${fmt(p)}·(1 + ${fmt(qi)})/(1 − ${fmt(qi)}) = ${fmt(tIa)} N/mm²`, tIa, "N/mm²", `${REF_ROLOFF} (12.7)`));
    add("spannungen", step("PV-S-VA", "Vergleichsspannung Nabe innen (SH)", "σ_vAi = 2·p/(1 − Q_A²)", `σ_vAi = 2·${fmt(p)}/(1 − ${fmt(qa)}) = ${fmt(vA)} N/mm²`, vA, "N/mm²", `${REF_ROLOFF} (12.8); Dubbel 2 S. 199`));
    add("spannungen", step("PV-S-VI", "Vergleichsspannung Welle (SH)", solid ? "Vollwelle: σ_vI = p" : "σ_vIi = 2·p/(1 − Q_I²)", solid ? `σ_vI = ${fmt(p)} N/mm²` : `σ_vIi = 2·${fmt(p)}/(1 − ${fmt(qi)}) = ${fmt(vI)} N/mm²`, vI, "N/mm²", `${REF_ROLOFF} (12.8)`));
    SPAist = (1 - qa) * RA / (S3 * pmax); SPIist = solid ? 2 * RI / (S3 * pmax) : (1 - qi) * RI / (S3 * pmax);
    add("spannungen", step("PV-SPA", "Ist-Sicherheit Nabe gegen plastische Dehnung", "S_PA = (1 − Q_A²)·R_eLA/(√3·p_max)", `S_PA = (1 − ${fmt(qa)})·${fmt(RA)}/(√3·${fmt(pmax)}) = ${fmt(SPAist)}`, SPAist, "1", `${REF_DIN} Gl. (15) umgestellt`));
    add("spannungen", step("PV-SPI", "Ist-Sicherheit Welle gegen plastische Dehnung", solid ? "S_PI = 2·R_eLI/(√3·p_max)" : "S_PI = (1 − Q_I²)·R_eLI/(√3·p_max)",
      solid ? `S_PI = 2·${fmt(RI)}/(√3·${fmt(pmax)}) = ${fmt(SPIist)}` : `S_PI = (1 − ${fmt(qi)})·${fmt(RI)}/(√3·${fmt(pmax)}) = ${fmt(SPIist)}`, SPIist, "1", `${REF_DIN} Gl. (16), (17) umgestellt`));
    dDaA = DaA * tAa / hub.E;
    add("spannungen", step("PV-DAA", "Aufweitung des Nabenaußendurchmessers (p_max)", "ΔD_aA = D_aA·σ_tAa/E_A (σ_r = 0 außen)", `ΔD_aA = ${fmt(DaA)}·${fmt(tAa)}/${fmt(hub.E)} = ${um(dDaA)} µm`, dDaA, "mm", "Hooke; Lamé P-ZY-U"));
    stress = { tAi, tAa, tIi, tIa, rF: -p, vA, vI };
    if (side.max.state === "elastisch-plastisch") warnings.push("p_max elastisch-plastisch: Spannungen und Sicherheiten oben nach den rein elastischen Formeln (Vergleich), maßgebend ist der Nachweis nach DIN 4.3.");
    // ---------------------------------------------------------------- Fügen
    const jn = inp.joining;
    if (jn.kind === "laengs") join = computeLaengs(fd, DF, lF, inp.nuL!, pmax, (G_.montage ??= []));
    else {
      const aA = hub.alphaHeat, aI = jn.thetaI < jn.thetaR ? shaft.alphaCool : shaft.alphaHeat;
      if (aA === null || aI === null) warnings.push(`Fügetemperatur: α ${aA === null ? "der Nabe (Erwärmen)" : "der Welle (" + (jn.thetaI < jn.thetaR ? "Unterkühlen" : "Erwärmen") + ")"} fehlt; von Hand eingeben.`);
      else join = computeQuer(jn, DF, fit!.Ug, aA, aI, (G_.montage ??= []));
    }
    // ---------------------------------------------------------------- Option Fliehkraft
    if (inp.spinN !== null) {
      const pre: string[] = [];
      if (!solid) pre.push("Welle nicht voll");
      if (Math.abs(hub.E - shaft.E) > PV_REL_TOL * hub.E || Math.abs(hub.mu - shaft.mu) > 1e-12) pre.push("E oder μ verschieden");
      if (hub.rho === null || shaft.rho === null || Math.abs(hub.rho - shaft.rho) > 1e-9 * hub.rho) pre.push("Dichte fehlt oder verschieden");
      if (side.max.state !== "elastisch") pre.push("nicht rein elastisch");
      if (!(inp.spinN > 0)) pre.push("Drehzahl nicht größer als 0");
      if (pre.length) warnings.push(`Option Fliehkraft nicht anwendbar (DIN 7190-1 Abschn. 10.2 a bis c): ${pre.join("; ")}.`);
      else {
        const L = spinXiLimits(hub.mu, QA, RA, RI, hub.E), S: CalcStep[] = [];
        const r = computeSpin(inp.spinN / 60, DaA, hub.E, hub.mu, hub.rho! * 1e-12, side.min.xi, pmin, Tt, S);
        S.forEach((s) => add("fliehkraft", s)); spin = { ...r, ...L };
        if (r.pn <= 0) warnings.push(`Fliehkraft: bei n = ${fmt(inp.spinN)} 1/min hebt die Nabe ab (u ≥ u_ab), kein Fugendruck.`);
      }
    }
    // Rutschnachweis mit dem kleinsten Fugendruck im Betrieb: p_min im Stillstand, mit Fliehkraft p_n nach DIN Gl. (57)
    // (Prüfliste Formelfreigabe 0.17.0, Seti 08.11.2026: Stillstandswert läge bei Drehzahl auf der unsicheren Seite)
    if (loaded) {
      const pR = spin ? spin.pn : pmin, S0 = pmin * AF * inp.nuR / (inp.KA * Fres);
      SrIst = pR * AF * inp.nuR / (inp.KA * Fres);
      add("betrieb", step("PV-SR", "Ist-Sicherheit gegen Rutschen", "S_r,ist = p·A_F·ν_r/(K_A·√(F_ax² + F_t²)) mit p = p_min (Stillstand) bzw. p = p_n (Drehzahl n)",
        `${spin ? "p = p_n" : "p = p_min"}: S_r,ist = ${fmt(pR)}·${fmt(AF)}·${fmt(inp.nuR)}/(${fmt(inp.KA)}·${fmt(Fres)}) = ${fmt(SrIst)}${spin ? ` (Stillstand mit p_min ${fmt(pmin)}: ${fmt(S0)})` : ""}`,
        SrIst, "1", `${REF_ROLOFF} S. 449 (S_H′); ${REF_DIN} Gl. (57)`));
    }
  }

  // ---------------------------------------------------------------- Nachweise
  const checks: PvCheck[] = [];
  const N = (id: string, title: string, formula: string, subst: string, value: number, unit: string, ref: string) => add("nachweis", step(id, title, formula, subst, value, unit, ref));
  if (side) {
    const pmax = side.max.p, uA = pmax / pzulA, uI = pmax / pzulI;
    const epHub = side.max.state === "elastisch-plastisch";
    N("PV-N-SPA", "Nachweis Nabe rein elastisch", "p_max ≤ p_zul,A (Auslastung p_max/p_zul,A)", `${fmt(pmax)}/${fmt(pzulA)} = ${fmt(uA)}`, uA, "1", `${REF_DIN} Gl. (15), (20)`);
    N("PV-N-SPI", "Nachweis Welle rein elastisch", "p_max ≤ p_zul,I (Auslastung p_max/p_zul,I)", `${fmt(pmax)}/${fmt(pzulI)} = ${fmt(uI)}`, uI, "1", `${REF_DIN} Gl. (16), (17), (21)`);
    checks.push({ key: "nabe", id: "PV-N-SPA", label: "Nabe", ok: epHub ? true : pvLe(pmax, pzulA), text: epHub ? `elastisch-plastisch nach DIN 4.3 zulässig (q_PA/q_A = ${fmt(side.max.qPA!)})` : `S_PA,ist = ${fmt(SPAist!)} (Soll ${fmt(inp.SPA)})` });
    checks.push({ key: "welle", id: "PV-N-SPI", label: "Welle", ok: pvLe(pmax, pzulI), text: `S_PI,ist = ${fmt(SPIist!)} (Soll ${fmt(inp.SPI)})` });
    const over = Math.max(0, uA - 1, uI - 1) * 100;
    const part = uA > 1 && uI > 1 ? "Nabe und Welle" : uA > 1 ? "Nabe" : uI > 1 ? "Welle" : "keines";
    N("PV-N-ELAST", "Warnung plastisch", "p_max > p_zul,A oder p_zul,I → plastische Dehnung (Überschreitung in %)", `Teil: ${part}; Überschreitung ${fmt(over)} %`, over, "%", `${REF_DIN} Abschn. 4.1, S. 9`);
    if (over > PV_REL_TOL * 100 && !epHub) {
      const ep = (hub.brittle || shaft.brittle) ? "nicht zulässig (spröde, nur rein elastisch)" : !solid || Math.abs(hub.E - shaft.E) > PV_REL_TOL * hub.E ? "nicht zulässig (Voraussetzungen DIN 4.3 nicht erfüllt)" : "Option elastisch-plastisch prüfen";
      warnings.push(`Plastisch: ${part} überschreitet die elastische Grenze um ${fmt(over)} %; ${ep}.`);
    }
    if (epOn) {
      const q = Math.max(side.min.qPA ?? 0, side.max.qPA ?? 0), ok = side.min.state !== "unzulässig" && side.max.state !== "unzulässig";
      N("PV-N-EP", "Grenzen elastisch-plastisch", "ξ_w ≤ 2/√3·ζ_zul²·R_eLA/E (41) und q_PA/q_A ≤ 0,30 (35)", `ξ_w,g = ${e3(side.max.xi)} ≤ ${e3(PL!.xiZul!)}; q_PA/q_A = ${fmt(q)}`, q, "1", `${REF_DIN} Gl. (26), (29), (33), (36), (41), (35)`);
      checks.push({ key: "plastisch", id: "PV-N-EP", label: "Elastisch-plastisch", ok, text: ok ? `zulässig, q_PA/q_A = ${fmt(q)} ≤ 0,30` : "Grenze nach Gl. (41) oder q_PA/q_A ≤ 0,30 überschritten" });
      if (!ok) warnings.push("Elastisch-plastisch: Höchstübermaß über der Grenze nach DIN 7190-1 Gl. (41) bzw. q_PA/q_A > 0,30, nicht zulässig.");
    }
    if (loaded) {
      const r = SrIst! / inp.Sr;
      N("PV-N-SR", "Nachweis Rutschen", "S_r,ist ≥ S_r (mit p_min, bei Drehzahl mit p_n)", `${fmt(SrIst!)}/${fmt(inp.Sr)} = ${fmt(r)}`, r, "1", `${REF_DIN} Gl. (1), (2)`);
      checks.push({ key: "rutschen", id: "PV-N-SR", label: "Rutschen", ok: r >= 1 - PV_REL_TOL, text: `S_r,ist = ${fmt(SrIst!)} (Soll ${fmt(inp.Sr)}${spin ? `, mit p_n bei ${fmt(inp.spinN!)} 1/min` : ""})` });
    }
    if (inp.task === "B" && Uu !== null && Uo !== null && fit) {
      const m = Math.min(fit.Uk - Uu, Uo - fit.Ug), ok = fit.Uk >= Uu - PV_REL_TOL * Uu && pvLe(fit.Ug, Uo);
      N("PV-N-PASS", "Passung trägt", "U_k ≥ Ü_u und U_g ≤ Ü_o (kleinster Abstand)", `U_k ${um(fit.Uk)} ≥ Ü_u ${um(Uu)}; U_g ${um(fit.Ug)} ≤ Ü_o ${um(Uo)} µm; Abstand ${um(m)} µm`, m, "mm", `${REF_ROLOFF} S. 446`);
      checks.push({ key: "passung", id: "PV-N-PASS", label: "Passung", ok, text: ok ? `${fit.label} liegt zwischen Ü_u und Ü_o` : `${fit.label} verletzt Ü_u oder Ü_o` });
    }
    if (join && join.thetaA !== null && join.thetaAzul !== null) {
      const d = join.thetaAzul - join.thetaA, ok = d >= 0;
      N("PV-N-TA", "Nachweis Fügetemperatur", "ϑ_A,erf ≤ ϑ_A,zul (Reserve ϑ_A,zul − ϑ_A,erf)", `${fmt(join.thetaAzul)} − ${fmt(join.thetaA)} = ${fmt(d)} K`, d, "K", `${REF_DIN} Tab. 8, S. 23`);
      checks.push({ key: "fuegetemperatur", id: "PV-N-TA", label: "Fügetemperatur", ok, text: ok ? `ϑ_A,erf ${fmt(join.thetaA)} °C ≤ ${fmt(join.thetaAzul)} °C` : `ϑ_A,erf ${fmt(join.thetaA)} °C > ${fmt(join.thetaAzul)} °C: Welle unterkühlen oder Übermaß verringern` });
    }
    if (spin) {
      const lim = Math.min(spin.lim54, spin.lim55), r = side.max.xi / lim;
      N("PV-N-FL", "Fliehkraft rein elastisch", "ξ_w ≤ (3 + μ)/(3 + μ + (1 − μ)·Q_A²)·R_eLA/E (54) und ξ_w ≤ R_eLI/(Q_A²·E) (55)", `ξ_w,g ${e3(side.max.xi)}; Grenzen ${e3(spin.lim54)} und ${e3(spin.lim55)}; Verhältnis ${fmt(r)}`, r, "1", `${REF_DIN} Gl. (54), (55)`);
      N("PV-N-FL10", "Druckabfall höchstens 10 %", "u ≤ √0,1·u_ab ≈ 0,316·u_ab (Verhältnis)", `${fmt(spin.u / 1e3)}/(0,316·${fmt(spin.uab / 1e3)}) = ${fmt(spin.ratio10)}`, spin.ratio10, "1", `${REF_DIN} Gl. (59)`);
      checks.push({ key: "fliehkraft", id: "PV-N-FL", label: "Fliehkraft", ok: r <= 1 + PV_REL_TOL && spin.ratio10 <= 1 + PV_REL_TOL,
        text: `p_n = ${fmt(spin.pn)} N/mm², n_g = ${fmt(spin.ng * 60)} 1/min${spin.ratio10 > 1 ? "; Druckabfall über 10 %" : ""}` });
    }
  }
  const A = hub.A;
  if (A !== null) {
    N("PV-N-VERF", "Verformbarkeit Nabe", "A ≥ 10 % (Z ≥ 30 % selbst prüfen)", `A = ${fmt(A)} %`, A, "%", `${REF_DIN} Gl. (8), (9)`);
    checks.push({ key: "verformbarkeit", id: "PV-N-VERF", label: "Verformbarkeit", ok: A >= 10, text: A >= 10 ? `A = ${fmt(A)} % ≥ 10 %` : `A = ${fmt(A)} % < 10 %: spröde, nur rein elastisch` });
  }
  const lr = lF / DF, geo: string[] = [];
  if (lr > 1.5) geo.push("l_F/D_F > 1,5: bei Torsion kein Gewinn");
  if (lr <= 0.5) geo.push("l_F/D_F ≤ 0,5: bei Biegung zu kurz");
  if (QA > 0.5) geo.push("Q_A > 0,5: dünnwandige Nabe");
  N("PV-N-GEO", "Gestaltung", "Torsion l_F/D_F ≤ 1,5; Biegung l_F/D_F > 0,5; Q_A ≤ 0,5 empfohlen (Hinweise)", `l_F/D_F = ${fmt(lr)}; Q_A = ${fmt(QA)}${geo.length ? `; ${geo.join("; ")}` : ""}`, lr, "1", `${REF_DIN} Gl. (46), (47), S. 16`);
  checks.push({ key: "gestaltung", id: "PV-N-GEO", label: "Gestaltung", ok: geo.length ? null : true, text: geo.length ? geo.join("; ") : "Empfehlungen eingehalten" });

  // ---------------------------------------------------------------- Kennwerte
  const kpis: PvKpi[] = [];
  if (inp.task === "B" && Uu !== null && Uo !== null) kpis.push({ key: "Uu", label: "Kleinstes erforderliches Übermaß", sym: "Ü_u", value: Uu * 1e3, unit: "µm", primary: true },
    { key: "Uo", label: "Größtes zulässiges Übermaß", sym: "Ü_o", value: Uo * 1e3, unit: "µm", primary: true }, { key: "PT", label: "Passtoleranz", sym: "PT", value: PT! * 1e3, unit: "µm" });
  if (side) {
    if (SrIst !== null) kpis.push({ key: "Sr", label: "Sicherheit gegen Rutschen", sym: "S_r,ist", value: SrIst, unit: "1", primary: inp.task === "A" });
    const sp = Math.min(SPAist!, SPIist!);
    kpis.push({ key: "SP", label: "Kleinere Sicherheit gegen plastische Dehnung", sym: "S_P,ist", value: sp, unit: "1", primary: inp.task === "A" },
      { key: "pmin", label: "Fugendruck aus Mindestübermaß", sym: "p_min", value: side.min.p, unit: "N/mm²" }, { key: "pmax", label: "Fugendruck aus Höchstübermaß", sym: "p_max", value: side.max.p, unit: "N/mm²" },
      { key: "T", label: "Übertragbares Drehmoment", sym: "T", value: Tt! / 1e3, unit: "N·m" }, { key: "Fax", label: "Übertragbare Axialkraft", sym: "F_ax", value: Faxt! / 1e3, unit: "kN" },
      { key: "vA", label: "Vergleichsspannung Nabe innen", sym: "σ_vAi", value: stress!.vA, unit: "N/mm²" }, { key: "dDaA", label: "Aufweitung Nabe außen", sym: "ΔD_aA", value: dDaA! * 1e3, unit: "µm" });
  }
  return { task: inp.task, QA, QI, AF, K, RzA, RzI, G, RA, RI, pzulA, pzulI, Ft, FR, perf, Uu, Uo, PT, candidates, fit, min: side?.min ?? null, max: side?.max ?? null,
    T: Tt, Faxt, SrIst, SPAist, SPIist, stress, dDaA, join, plastic: PL, spin, checks, kpis, trace: G_, errors, warnings };
}

/** Spannungsverlauf σ_r(r), σ_t(r) in Welle und Nabe über lame() (P6), n + 1 Punkte je Teil, r in mm. */
export function pressFitProfile(inp: Pick<PressFitInput, "DF" | "DaA" | "DiI" | "hub" | "shaft">, p: number, n = 40): { hub: StressPoint[]; shaft: StressPoint[] } {
  const a = inp.DF / 2, b = inp.DaA / 2, c = inp.DiI / 2;
  const H = lame("ZY", false, a, b, p, 0, inp.hub.E, inp.hub.mu), W = lame("ZY", false, c, a, 0, p, inp.shaft.E, inp.shaft.mu);
  const rs = (r0: number, r1: number) => Array.from({ length: n + 1 }, (_, i) => r0 + (r1 - r0) * i / n);
  return { hub: rs(a, b).map((r) => H.at(r)), shaft: rs(c, a).map((r) => (r === 0 ? { ...W.at(a * 1e-9), r: 0 } : W.at(r))) };
}
