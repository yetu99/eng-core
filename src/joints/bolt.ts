/**
 * Schraubenverbindung, zentrische Einschraubenverbindung nach VDI 2230-1:2015 (Modul verbindungen, Präfix SV, eng-core 0.18.0).
 * Konzept fachtools/konzept_sv.md, freigegeben 09.11.2026 (Abschn. 13, 15); Datenpatch fd 1.3 (Abschn. 16, 17). Eigene Umsetzung
 * ohne Normtext (E12): Rechengang R0 bis R13 als Gliederung, Roloff/Matek 27 als Lehrbuchweg und Prüffall.
 *   Aufgabe A Nachrechnen: Schraube, Geometrie, Lasten → R1 bis R13 mit allen Nachweisen.
 *   Aufgabe B Auslegen: zusätzlich alle Größen M4 bis M39 × 8.8, 10.9, 12.9 (boltSelect.ts, SV-WAHL).
 * Annahmen: zentrisch verspannt und belastet (VDI 3.2.1), Stahlschraube (nichtrostend als Option), E(T) = E_RT, Temperatur
 * vereinfacht nach (R4/2) nur als Option; Krafteinleitungsfaktor n von Hand (S4); Reibung mit μ_min (R7, R13).
 * Einheiten intern N, mm, MPa (N/mm²); Nachgiebigkeit mm/N (Anzeige µm/kN), Moment N·mm (Anzeige N·m), Setzbetrag in mm.
 */
import { fmt } from "../format";
import { step, type CalcStep, type Trace } from "../trace";
import {
  embedOf, engagementOf, gradeOf, holeOf, isStainless, kefSuggest, partOf, shearRatioOf, threadLengthB, threadOf, SV_GRADES_VDI,
  type FdBoltGeometry, type FdThread, type SvHoleClass, type SvRepo, type SvRzClass,
} from "./boltData";
import { SV_REF_ISO3506, SV_REF_ISO898, SV_REF_ROLOFF, SV_REF_VDI, SV_REL_TOL, threadProps, threadSteps, type ThreadProps } from "./thread";
import { boltResilience, plateResilience, type BoltResilience, type PlateLayer, type PlateResilience, type ShankElement, type SvJointType } from "./resilience";
import { fmZul, kappaRoloff, looseningTorque, polarModulus, sigmaASV, threadTorque, tighteningTorque, tighteningTorqueExact } from "./tighten";
import { selectAbortReason, selectBolts, wahlStep, type BoltCandidate } from "./boltSelect";

export type SvNormBolt = "ISO 4014" | "ISO 4017" | "ISO 4762";
export interface SvPlate extends PlateLayer { /** Grenzflächenpressung des Plattenwerkstoffs in N/mm² (null = unbekannt) */ pG: number | null }
export interface BoltJointInput {
  task: "A" | "B";
  joint: SvJointType;
  /** Nenndurchmesser in mm; Feingewinde als Zeilen-ID aus fd_threads (Option), null = Regelgewinde */
  d: number; threadId: string | null;
  norm: SvNormBolt;
  /** Schraubenlänge in mm (null = kleinste Normlänge, O-sv5); wirkt nur, wenn shank null ist */
  length: number | null;
  /** Schaftelemente in der Klemmlänge (null = aus Norm l − b; [] = Ganzgewinde), Durchmesser in mm */
  shank: ShankElement[] | null;
  /** Dehnschaft: Taillendurchmesser d_T (ersetzt den Schaftdurchmesser der Norm-Schaftelemente), null = Schaft d */
  taper: number | null;
  /** Festigkeitsklasse (fd_bolt_grades) oder von Hand R_p0,2 und R_m */
  grade: string; gradeManual: { Rp: number; Rm: number } | null;
  ES: number;
  /** Kopfauflage außen (null = d_w der Norm bzw. d₂ der Scheibe), Bohrung (null = Durchgangsloch ISO 273), Fase */
  dW: number | null; dh: number | null; hole: SvHoleClass; dha: number | null;
  washerHead: boolean; washerNut: boolean;
  /** Verformungskörper: Auflagedurchmesser (null = Pressungsauflage), Modell w und tan φ (null = Verbindungsart, B-sv5), Kegel oder Hohlzylinder */
  dWcone: number | null; coneModel: SvJointType | null; plateModel: "kegel" | "hohlzylinder";
  /** Außendurchmesser des Grundkörpers D_A und Ersatzaußendurchmesser in der Trennfuge D′_A (null = D_A) */
  DA: number; DAp: number | null;
  plates: SvPlate[];
  /** ESV: E-Modul des Teils mit Innengewinde, vorhandene Einschraubtiefe (null = l − l_K), Werkstoffgruppe TB 8-15 und R_m */
  EBI: number | null; mGes: number | null; engagement: { group: string; Rm: number } | null;
  /** Zusatznachgiebigkeit δ_PZu = (w − 1)·δ_M nach VDI Gl. (83) (ESV), Roloff (8.17) ohne */
  phiZu: boolean;
  /** Krafteinleitungsfaktor (von Hand, S4) und optional Vorschlag VDI Tab. 2 */
  n: number; kef: { type: number; laH: number; akH: number } | null;
  /** axiale Betriebskraft je Schraube (Zug positiv, Druck negativ) in N */
  FAmax: number; FAmin: number;
  /** Querkraft direkt (Summe), Moment am Lochkreis T mit D_t und z, Moment um die Schraubenachse M_Y mit Reibradius r_a */
  FQ: number; torque: { T: number; Dt: number; z: number } | null; MY: number; ra: number;
  qF: number; muT: number;
  /** Dichtfläche A_D in mm² und Innendruck in N/mm², Klemmkraft von Hand (Roloff F_Kl) in N */
  AD: number; pi: number; FKHand: number;
  /** Setzbetrag in mm (null = VDI Tab. 5 nach R_z und Last), R_z-Klasse, Belastung für Tab. 5 */
  fZ: number | null; rz: SvRzClass; embedLoad: "axial" | "schub";
  alphaA: number; nu: number; torsionFree: boolean; yieldControlled: boolean;
  muG: number; muK: number;
  rolled: "SV" | "SG";
  /** Grenzflächenpressung Kopf- und Mutterseite (null = aus den Platten), τ_B des Schraubenwerkstoffs über Tab. 7 */
  pGHead: number | null; pGNut: number | null;
  /** Grenzflächenpressung der Scheibe ISO 7089 (Kopf bzw. Mutter auf Scheibe), null = unbekannt (U3, von Hand) */
  pGWasher: number | null;
  shearAt: "schaft" | "gewinde";
  req: { SF: number; SD: number; Sp: number; SG: number; SA: number };
  /** Optionen: Temperatur (R4/2), Zeitfestigkeit N_Z, Flansch, σ_A von Hand (nichtrostend) */
  temp: { dTS: number; dTP: number; alphaS: number; alphaP: number } | null;
  NZ: number | null; flange: { p: number; dm: number; z: number } | null; sigmaA: number | null;
}

export type SvGroup = "geometrie" | "werkstoff" | "nachgiebigkeit" | "kraft" | "vorspannung" | "festigkeit" | "schwingung" | "pressung" | "gleiten" | "anziehen" | "vorwahl" | "nachweis";
export type SvCheckKey = "montage" | "fliessen" | "dauer" | "pressung-kopf" | "pressung-mutter" | "restklemmkraft" | "gleiten" | "abscheren" | "einschraubtiefe" | "kurz" | "gueltig" | "gestaltung";
export type SvCheckState = "erfüllt" | "nicht erfüllt" | "nicht bewertbar" | "Hinweis";
export interface SvCheck { key: SvCheckKey; id: string; label: string; ok: boolean | null; /** Pflichtnachweis für die Auslegung (SV-WAHL) */ required: boolean; reserve: number | null; text: string;
  /** Anzeige (U8): Pflichtnachweis ohne Bewertung (ok = null) ist „nicht bewertbar“ mit Grund im Text, sonst „Hinweis“ */ state: SvCheckState }
/** Auflage (R10): Kopf bzw. Mutter auf Platte, mit Scheibe zusätzlich Kopf bzw. Mutter auf Scheibe (U3). */
export interface SvContact { side: "kopf" | "mutter"; label: string; /** Herkunft p_G (Platte bzw. Scheibe) */ pGFrom: string; dW: number; DKi: number; Ap: number; pG: number | null; pM: number; pB: number; pMax: number; Sp: number | null }
export interface SvKpi { key: string; label: string; sym: string; value: number; unit: string; primary?: boolean }
export interface BoltJointResult {
  task: "A" | "B";
  thread: ThreadProps | null; grade: { label: string; Rp: number; Rm: number; source: string } | null;
  geo: { lK: number; lGew: number; shank: ShankElement[]; length: number | null; d0: number; A0: number; dW: number; dWcone: number; dh: number; DKi: number; Ap: number; ApNut: number | null; DKm: number; part: FdBoltGeometry | null; nut: FdBoltGeometry | null; layers: SvPlate[];
    /** Längenbedarf der Normlängenwahl (O-sv5) und seine Teile, null bei vorgegebener Länge bzw. Schaft */ lNeed: { need: number; text: string } | null } | null;
  bolt: BoltResilience | null; plate: PlateResilience | null;
  dS: number; dP: number; dPZu: number; PhiK: number; PhiN: number; n: number; kefN: number | null;
  FAmax: number; FAmin: number; FSAmax: number; FSAmin: number; FPAmax: number; Fa: number; Fm: number; FQ: number;
  FKQ: number; FKP: number; FKerf: number; fZ: number; FZ: number; dFVth: number;
  FMmin: number; FMmax: number; FMzul: number; FVmin: number; FVmax: number; FKRmin: number;
  FSmax: number; sigZ: number; MG: number; WP: number; tau: number; sigRedB: number; SF: number;
  sigA: number | null; sigAS: number | null; SD: number | null;
  pM: number; pB: number; pMax: number; SpHead: number | null; pMNut: number | null; pBNut: number | null; SpNut: number | null; contacts: SvContact[];
  SG: number | null; tauQ: number | null; SA: number | null; le: number | null; mEff: number | null;
  MA: number; MAex: { MA: number; pitch: number; thread: number; bearing: number } | null; ML: number; MLi: number;
  AsMin: number | null;
  candidates: BoltCandidate[];
  checks: SvCheck[]; kpis: SvKpi[]; trace: Trace<SvGroup>; errors: string[]; warnings: string[];
}

const mu = (x: number) => fmt(x * 1e6, 5);
const kN = (x: number) => fmt(x / 1e3, 5);
const svLe = (a: number, b: number): boolean => a <= b + SV_REL_TOL * Math.max(Math.abs(a), Math.abs(b), 1e-300);

/** Leeres Ergebnis (Fehlerfall). */
function emptyResult(task: "A" | "B", trace: Trace<SvGroup>, errors: string[], warnings: string[]): BoltJointResult {
  const N = NaN;
  return { task, thread: null, grade: null, geo: null, bolt: null, plate: null, dS: N, dP: N, dPZu: N, PhiK: N, PhiN: N, n: N, kefN: null, FAmax: N, FAmin: N, FSAmax: N, FSAmin: N, FPAmax: N, Fa: N, Fm: N, FQ: N,
    FKQ: N, FKP: N, FKerf: N, fZ: N, FZ: N, dFVth: N, FMmin: N, FMmax: N, FMzul: N, FVmin: N, FVmax: N, FKRmin: N, FSmax: N, sigZ: N, MG: N, WP: N, tau: N, sigRedB: N, SF: N,
    sigA: null, sigAS: null, SD: null, pM: N, pB: N, pMax: N, SpHead: null, pMNut: null, pBNut: null, SpNut: null, contacts: [], SG: null, tauQ: null, SA: null, le: null, mEff: null,
    MA: N, MAex: null, ML: N, MLi: N, AsMin: null, candidates: [], checks: [], kpis: [], trace, errors, warnings };
}

/** Rechengang R0 bis R13 (Aufgabe A; Aufgabe B ergänzt den Auslegungsvorschlag SV-WAHL). */
export function computeBoltJoint(fd: SvRepo, inp: BoltJointInput): BoltJointResult {
  const errors: string[] = [], warnings: string[] = [];
  const G_: Trace<SvGroup> = {}; const add = (g: SvGroup, s: CalcStep) => { (G_[g] ??= []).push(s); };
  const fail = () => emptyResult(inp.task, G_, errors, warnings);
  // ---------------------------------------------------------------- Eingaben prüfen (P-SV11)
  const tr: FdThread | null = threadOf(fd, inp.d, inp.threadId);
  if (!tr) errors.push(inp.threadId ? `Gewinde ${inp.threadId} nicht in den Fachdaten (fd_threads).` : `Regelgewinde M${fmt(inp.d)} nicht in den Fachdaten: zulässig M4 bis M39 (DIN 13-1).`);
  if (!inp.plates.length || inp.plates.length > 3) errors.push("Eine bis drei verspannte Platten eingeben.");
  if (inp.plates.some((p) => !(p.h > 0) || !(p.E > 0))) errors.push("Jede Platte braucht h > 0 und E > 0.");
  if (!(inp.ES > 0)) errors.push("E-Modul der Schraube E_S muss größer als 0 sein.");
  if (!(inp.n >= 0 && inp.n <= 1)) errors.push("Krafteinleitungsfaktor n zwischen 0 und 1 eingeben.");
  if (!(inp.muG > 0 && inp.muK > 0 && inp.muT > 0)) errors.push("Reibungszahlen μ_G, μ_K und μ_T müssen größer als 0 sein.");
  if (!(inp.alphaA >= 1)) errors.push("Anziehfaktor α_A muss mindestens 1 sein.");
  if (!(inp.nu > 0 && inp.nu <= 1)) errors.push("Ausnutzungsgrad ν zwischen 0 und 1 eingeben.");
  if (inp.FKHand < 0 || inp.AD < 0 || inp.pi < 0 || inp.FQ < 0 || inp.MY < 0) errors.push("Klemmkraft von Hand, Dichtfläche, Innendruck, Querkraft und Moment dürfen nicht negativ sein (F_Kerf < 0).");
  if (inp.flange === null && inp.FAmin > inp.FAmax) errors.push("F_A,min darf nicht größer als F_A,max sein.");
  if (inp.joint === "ESV" && !(inp.EBI !== null && inp.EBI > 0)) errors.push("Einschraubverbindung: E-Modul des Teils mit Innengewinde E_BI eingeben.");
  if (inp.torque && !(inp.torque.Dt > 0 && inp.torque.z >= 1)) errors.push("Moment am Lochkreis: D_t > 0 und z ≥ 1.");
  if (inp.MY > 0 && !(inp.ra > 0)) errors.push("Moment um die Schraubenachse: Reibradius r_a > 0 eingeben.");
  if (!(inp.qF >= 1)) errors.push("Anzahl der kraftübertragenden Trennfugen q_F mindestens 1.");
  if (inp.fZ !== null && !(inp.fZ >= 0)) errors.push("Setzbetrag f_Z ≥ 0 eingeben.");
  if (!(inp.DA > 0)) errors.push("Außendurchmesser D_A muss größer als 0 sein.");
  if (errors.length) return fail();
  const T = threadProps(tr!), d = T.d;
  if (inp.norm !== "ISO 4017" && inp.taper !== null && !(inp.taper > 0 && inp.taper < T.dS)) errors.push(`Dehnschaft: 0 < d_T < d_S = ${fmt(T.dS)} mm.`);

  // ---------------------------------------------------------------- Werkstoff der Schraube
  const gr = inp.gradeManual ? null : gradeOf(fd, inp.grade, d);
  if (!inp.gradeManual && !gr) errors.push(`Festigkeitsklasse ${inp.grade} für M${fmt(d)} nicht in den Fachdaten (fd_bolt_grades).`);
  const Rp = inp.gradeManual ? inp.gradeManual.Rp : gr?.yield_min_mpa ?? NaN, Rm = inp.gradeManual ? inp.gradeManual.Rm : gr?.rm_min_mpa ?? NaN;
  if (inp.gradeManual && !(inp.gradeManual.Rp > 0 && inp.gradeManual.Rm >= inp.gradeManual.Rp)) errors.push("Werkstoff von Hand: 0 < R_p0,2 ≤ R_m.");
  if (errors.length) return fail();
  const stainless = !inp.gradeManual && isStainless(inp.grade);
  const gradeLabel = inp.gradeManual ? "von Hand" : inp.grade;
  if (stainless) add("werkstoff", step("SV-OPT-A24", "Nichtrostende Schraube (Option)", "R_p0,2 = R_pf und R_m aus ISO 3506-1; σ_A nur von Hand (VDI-Werte gelten nicht)",
    `${inp.grade}: R_p0,2 = ${fmt(Rp)} N/mm², R_m = ${fmt(Rm)} N/mm²`, Rp, "N/mm²", `${SV_REF_ISO3506}`));
  if (!inp.gradeManual && !stainless && !(SV_GRADES_VDI as readonly string[]).includes(inp.grade)) warnings.push(`Festigkeitsklasse ${inp.grade} unter 8.8: VDI 2230 gilt für 8.8 bis 12.9 (SV-N-GUELT), Nachweise nur als Anhalt.`);

  // ---------------------------------------------------------------- Geometrie (Normteile, Klemmlänge, Schaft)
  const hexHead = inp.norm !== "ISO 4762";
  const washer = fd.geometry.find((g) => g.norm === "ISO 7089" && g.d_mm === d) ?? null;
  if ((inp.washerHead || inp.washerNut) && !washer) errors.push(`Scheibe ISO 7089 für M${fmt(d)} fehlt in den Fachdaten.`);
  const layers: SvPlate[] = [];
  if (inp.washerHead && washer) layers.push({ h: washer.h_mm!, E: inp.ES, pG: null, label: "Scheibe ISO 7089 (Kopf)" });
  inp.plates.forEach((p, i) => layers.push({ ...p, label: p.label ?? `Platte ${i + 1}` }));
  if (inp.joint === "DSV" && inp.washerNut && washer) layers.push({ h: washer.h_mm!, E: inp.ES, pG: null, label: "Scheibe ISO 7089 (Mutter)" });
  const lK = layers.reduce((a, l) => a + l.h, 0);
  const nut = inp.joint === "DSV" ? partOf(fd, "ISO 4032", d) : null;
  if (inp.joint === "DSV" && !nut) warnings.push(`Mutter ISO 4032 M${fmt(d)} nicht in der Norm (beginnt bei M5, B-sv9): Mutterhöhe und Mutterauflage von Hand prüfen.`);
  // Länge und Schaft aus der Norm (O-sv5)
  let length = inp.length, part: FdBoltGeometry | null = partOf(fd, inp.norm, d, length);
  if (!part) errors.push(`${inp.norm} M${fmt(d)} nicht in den Fachdaten (B-sv9: ISO 4762 ohne M18, M22, M27, M33, M39).`);
  let leFactor: number | null = null, leRow = null as ReturnType<typeof engagementOf>;
  if (inp.joint === "ESV" && inp.engagement) { leRow = engagementOf(fd, inp.engagement.group, inp.engagement.Rm, gradeLabel === "von Hand" ? "8.8" : inp.grade, T.series); leFactor = leRow ? leRow.le_d_max : null; }
  let lNeed: { need: number; text: string } | null = null;
  if (part && inp.shank === null && length === null) {
    const needText = inp.joint === "DSV" ? `l_K ${fmt(lK)} + m ${fmt(nut?.m_max_mm ?? 0.8 * d)}${nut ? "" : " (0,8·d)"} + 2·P ${fmt(2 * T.P)}` : `l_K ${fmt(lK)} + ${inp.mGes !== null ? `m_ges ${fmt(inp.mGes)}` : leFactor !== null ? `l_e ${fmt(leFactor * d)}` : `1,25·d ${fmt(1.25 * d)}`}${inp.mGes !== null ? "" : ` + 2·P ${fmt(2 * T.P)}`}`;
    const need = inp.joint === "DSV" ? lK + (nut?.m_max_mm ?? 0.8 * d) + 2 * T.P : lK + (inp.mGes ?? (leFactor !== null ? leFactor * d : 1.25 * d) + 2 * T.P);   // ESV: m_eff = m_ges − 2·P ≥ l_e (Gl. (208))
    const ls = [...new Set(fd.geometry.filter((g) => g.norm === inp.norm && g.d_mm === d).flatMap((g) => g.l_series))].sort((a, b) => a - b);
    // kleinste Normlänge mit l ≥ Bedarf und Schaft l − b ≤ l_K (Gewinde muss in Mutter bzw. Innengewinde reichen)
    const fits = (l: number) => { const p = partOf(fd, inp.norm, d, l), b = p ? threadLengthB(p, l) : null; return b === null || l - b <= lK * (1 + SV_REL_TOL); };
    length = ls.find((l) => l >= need - 1e-9 && fits(l)) ?? null;
    if (length === null) errors.push(`Keine Normlänge ${inp.norm} M${fmt(d)} ≥ ${fmt(need)} mm mit Schaft l − b ≤ l_K = ${fmt(lK)} mm${inp.norm === "ISO 4014" ? " (ISO 4017 Ganzgewinde wählen)" : ""}.`);
    else { part = partOf(fd, inp.norm, d, length); lNeed = { need, text: `${needText} = ${fmt(need)} mm → l = ${fmt(length)} mm` }; }
  }
  if (errors.length) return fail();
  let shank: ShankElement[];
  if (inp.shank !== null) shank = inp.shank.map((e) => ({ ...e }));
  else {
    const b = length !== null && part ? threadLengthB(part, length) : null;
    const ls = b === null || length === null ? 0 : Math.max(0, length - b);
    shank = ls > 0 ? [{ l: ls, d: inp.taper ?? d }] : [];
    if (length !== null && part && part.l_min_mm !== null && part.l_max_mm !== null && !(length >= part.l_min_mm && length <= part.l_max_mm)) warnings.push(`Länge ${fmt(length)} mm außerhalb der Normreihe ${inp.norm} M${fmt(d)} (${fmt(part.l_min_mm)} bis ${fmt(part.l_max_mm)} mm).`);
  }
  if (shank.some((e) => !(e.l >= 0 && e.d > 0))) errors.push("Schaftelemente: l ≥ 0 und d > 0.");
  const lShank = shank.reduce((a, e) => a + e.l, 0);
  if (!(lK > 0)) errors.push("Klemmlänge l_K muss größer als 0 sein.");
  if (lShank > lK * (1 + SV_REL_TOL)) errors.push(`Schaftlänge ${fmt(lShank)} mm größer als die Klemmlänge ${fmt(lK)} mm: Gewinde reicht nicht in ${inp.joint === "DSV" ? "die Mutter" : "das Innengewinde"}.`);
  const dhAuto = holeOf(fd, d, inp.hole);
  const dh = inp.dh ?? dhAuto ?? NaN;
  const dWhead = inp.dW ?? part?.dw_min_mm ?? NaN;
  const dWplate = inp.dW ?? (inp.washerHead && washer ? washer.d2_max_mm! : dWhead);
  const dWcone = inp.dWcone ?? dWplate;
  const DKi = Math.max(dh, inp.dha ?? 0);
  if (!(dh > 0)) errors.push("Bohrungsdurchmesser d_h fehlt.");
  if (!(dWplate > dh) || !(dWcone > dh)) errors.push(`Auflagedurchmesser d_W muss größer als die Bohrung d_h sein (d_W ${fmt(dWplate)}, d_h ${fmt(dh)} mm).`);
  if (!(inp.DA > dh)) errors.push(`Außendurchmesser D_A muss größer als die Bohrung d_h sein (D_A ${fmt(inp.DA)}, d_h ${fmt(dh)} mm).`);
  if (inp.DAp !== null && !(inp.DAp > dh)) errors.push("D′_A muss größer als d_h sein.");
  if (errors.length) return fail();
  const DAp = inp.DAp ?? inp.DA;
  const lGew = Math.max(0, lK - lShank);
  threadSteps(T, tr!).forEach((s) => add("geometrie", s));
  const dmin = shank.length ? Math.min(...shank.map((e) => e.d)) : Infinity, taper = dmin < T.dS;
  const d0 = taper ? dmin : T.dS, A0 = Math.PI / 4 * d0 * d0;
  if (taper) add("geometrie", step("SV-AT", "Taillenquerschnitt (Dehnschaft)", "A_T = π/4·d_T², Vorschlag d_T = 0,9·d₃", `A_T = π/4·${fmt(d0)}² = ${fmt(A0)} mm² (Vorschlag 0,9·d₃ = ${fmt(0.9 * T.d3)} mm)`, A0, "mm²", `${SV_REF_ROLOFF} (8.34b)`));
  add("geometrie", step("SV-DS0", "Durchmesser zu A_s und Rechendurchmesser d₀", "d_S = (d₂ + d₃)/2; d₀ = d_S, Dehnschraube d₀ = d_T", `d_S = (${fmt(T.d2)} + ${fmt(T.d3)})/2 = ${fmt(T.dS)} mm; d₀ = ${fmt(d0)} mm`, d0, "mm", `${SV_REF_VDI} R7; ${SV_REF_ROLOFF} (8.32)`));
  add("geometrie", step("SV-LK", "Klemmlänge", "l_K = Σ h_i (Platten und Scheiben)", `l_K = ${layers.map((l) => fmt(l.h)).join(" + ")} = ${fmt(lK)} mm`, lK, "mm", `${SV_REF_VDI} Bild 6`));
  add("geometrie", step("SV-LGEW", "Freie belastete Gewindelänge", "l_Gew = l_K − Σ l_i (Schaftelemente in der Klemmlänge)", `l_Gew = ${fmt(lK)} − ${fmt(lShank)} = ${fmt(lGew)} mm${length !== null && inp.shank === null ? ` (${inp.norm} M${fmt(d)}×${fmt(length)}, Klasse ${part!.product_class})` : ""}`, lGew, "mm", `${SV_REF_VDI} Bild 6; ${SV_REF_ROLOFF} Bsp. 8.1`));
  // Auflageflächen je Kontakt (U3, Seti 09.11.2026): mit Scheibe Kopf bzw. Mutter auf Scheibe (D_Ki = d₁ der Scheibe) und Scheibe auf
  // Platte (d_W = d₂ der Scheibe; Annahme Lastverteilung über die Scheibe, ohne Normstelle); maßgebend ist die kleinere Sicherheit
  const plates0 = layers.filter((l) => !l.label?.startsWith("Scheibe"));
  const pGplH = inp.pGHead ?? plates0[0]?.pG ?? null, pGplN = inp.pGNut ?? plates0[plates0.length - 1]?.pG ?? null;
  const cts: Array<Pick<SvContact, "side" | "label" | "pGFrom" | "dW" | "DKi" | "Ap" | "pG">> = [];
  const mk = (side: "kopf" | "mutter", label: string, dWc: number, Di: number, pG: number | null, note: string) => {
    const pGFrom = label.endsWith("Scheibe") ? "Scheibe ISO 7089, von Hand" : (side === "kopf" ? inp.pGHead : inp.pGNut) !== null ? "von Hand" : (side === "kopf" ? plates0[0] : plates0[plates0.length - 1])?.label ?? "Platte";
    const A = Math.PI / 4 * (dWc * dWc - Di * Di); cts.push({ side, label, pGFrom, dW: dWc, DKi: Di, Ap: A, pG });
    add("geometrie", step("SV-AP", "Auflagefläche", "A_p,min = π/4·(d_W² − D_Ki²), D_Ki = max(d_h, d_ha) bzw. d₁ der Scheibe", `${label}: A_p = π/4·(${fmt(dWc)}² − ${fmt(Di)}²) = ${fmt(A)} mm²${note}`, A, "mm²", `${SV_REF_VDI} Gl. (193); ${SV_REF_ROLOFF} (8.36)`));
  };
  const SCH = " (Annahme: Scheibe trägt auf d₂, ohne Normstelle)";
  if (inp.washerHead && washer) { mk("kopf", "Kopf auf Scheibe", dWhead, washer.d1_min_mm!, inp.pGWasher, " (Scheibe ISO 7089)"); mk("kopf", "Scheibe auf Platte", dWplate, DKi, pGplH, SCH); }
  else mk("kopf", "Kopf auf Platte", dWplate, DKi, pGplH, "");
  if (inp.joint === "DSV") {
    const dWn = nut?.dw_min_mm ?? null;
    if (inp.washerNut && washer) { if (dWn !== null) mk("mutter", "Mutter auf Scheibe", dWn, washer.d1_min_mm!, inp.pGWasher, " (Mutter ISO 4032, Scheibe ISO 7089)"); mk("mutter", "Scheibe auf Platte", washer.d2_max_mm!, DKi, pGplN, SCH); }
    else if (dWn !== null && dWn > DKi) mk("mutter", "Mutter auf Platte", dWn, DKi, pGplN, " (Mutter ISO 4032)");
  }
  const Ap = cts.filter((c) => c.side === "kopf").pop()!.Ap, ApNut = cts.filter((c) => c.side === "mutter").pop()?.Ap ?? null;
  const DKm = (dWhead + DKi) / 2;
  add("geometrie", step("SV-DKM", "Reibdurchmesser der Kopfauflage", "D_Km = (d_W + D_Ki)/2", `D_Km = (${fmt(dWhead)} + ${fmt(DKi)})/2 = ${fmt(DKm)} mm`, DKm, "mm", `${SV_REF_VDI} R13; ${SV_REF_ROLOFF} zu (8.24)`));

  // ---------------------------------------------------------------- R1 bis R3: Nachgiebigkeit und Kraftverhältnis
  const NG: CalcStep[] = [];
  const bolt = boltResilience(T, inp.ES, hexHead, shank, lGew, inp.joint, inp.EBI ?? inp.ES, NG);
  const coneModel = inp.coneModel ?? inp.joint;
  const plate = plateResilience(layers, dWcone, dh, inp.DA, DAp, coneModel, inp.plateModel, NG);
  NG.forEach((s) => add("nachgiebigkeit", s));
  if (inp.plateModel === "hohlzylinder") warnings.push("Platten als Hohlzylinder (Roloff): bei der ESV liefert er eine größere, bei der DSV eine kleinere Nachgiebigkeit als der Kegel nach VDI (B-sv4).");
  if (coneModel !== inp.joint) warnings.push(`Verformungsmodell ${coneModel} bei ${inp.joint} (B-sv5): w und tan φ nach ${coneModel}, δ_PZu und l_M nach ${inp.joint}.`);
  const dS = bolt.dS, dP = plate.dP, w = inp.joint === "ESV" ? 2 : 1;
  const dPZu = inp.phiZu ? (w - 1) * bolt.dM : 0;
  const PhiK = (dP + dPZu) / (dS + dP);
  add("kraft", step("SV-PHIK", "Kraftverhältnis Kopf/Mutter (n = 1)", "Φ_K = (δ_P + δ_PZu)/(δ_S + δ_P); VDI Gl. (83): δ_PZu = (w − 1)·δ_M (w = 1 DSV, 2 ESV); Roloff (8.17): δ_PZu = 0 (Schalter δ_PZu aus)",
    `${inp.phiZu ? `VDI: δ_PZu = (${w} − 1)·${mu(bolt.dM)}` : "Roloff-Weg (Schalter aus): δ_PZu"} = ${mu(dPZu)} µm/kN; Φ_K = (${mu(dP)} + ${mu(dPZu)})/(${mu(dS)} + ${mu(dP)}) = ${fmt(PhiK, 5)}${!inp.phiZu && w === 2 ? ` (VDI-Weg mit δ_PZu = δ_M = ${mu(bolt.dM)}: Φ_K = ${fmt((dP + bolt.dM) / (dS + dP), 5)})` : ""}`, PhiK, "1", `${SV_REF_VDI} Gl. (83); ${SV_REF_ROLOFF} (8.17)`));
  let kefN: number | null = null;
  if (inp.kef) {
    kefN = kefSuggest(fd, inp.kef.type, inp.kef.laH, inp.kef.akH);
    if (kefN === null) warnings.push(`Krafteinleitung: kein Vorschlag aus VDI Tab. 2 (Typ SV ${inp.kef.type}).`);
    else add("kraft", step("SV-KEF", "Vorschlag Krafteinleitungsfaktor (VDI Tab. 2)", "lineare Interpolation in l_A/h und a_k/h je Typ SV 1 bis SV 6",
      `SV ${inp.kef.type}, l_A/h = ${fmt(inp.kef.laH)}, a_k/h = ${fmt(inp.kef.akH, 4)}: n = ${fmt(kefN, 4)} (gewählt n = ${fmt(inp.n)})`, kefN, "1", `${SV_REF_VDI} Tab. 2 (S. 62)`));
  }
  const PhiN = inp.n * PhiK;
  add("kraft", step("SV-PHIN", "Kraftverhältnis mit Krafteinleitung", "Φ_n = n·Φ_K", `Φ_n = ${fmt(inp.n)}·${fmt(PhiK, 5)} = ${fmt(PhiN, 5)}`, PhiN, "1", `${SV_REF_VDI} (R3/3); ${SV_REF_ROLOFF} (8.17)`));
  // Betriebskräfte
  let FAmax = inp.FAmax; const FAmin = inp.FAmin;
  if (inp.flange) {
    if (!(inp.flange.p >= 0 && inp.flange.dm > 0 && inp.flange.z >= 1)) { errors.push("Flansch: p ≥ 0, d_m > 0, z ≥ 1."); return fail(); }
    FAmax = inp.flange.p * Math.PI / 4 * inp.flange.dm * inp.flange.dm / inp.flange.z;
    add("kraft", step("SV-OPT-FL", "Axialkraft je Schraube am Flansch (Option)", "F_A = p·π/4·d_m²/z (Druck bis Dichtungsmitte)", `F_A,max = ${fmt(inp.flange.p)}·π/4·${fmt(inp.flange.dm)}²/${fmt(inp.flange.z)} = ${fmt(FAmax)} N`, FAmax, "N", `${SV_REF_ROLOFF} Bsp. 8.2 (S. 303)`));
    if (FAmin > FAmax) { errors.push("F_A,min darf nicht größer als F_A,max sein."); return fail(); }
  }
  const FSAmax = PhiN * FAmax, FSAmin = PhiN * FAmin, FPAmax = (1 - PhiN) * FAmax;
  add("kraft", step("SV-FSA", "Schraubenzusatzkraft", "F_SA = Φ_n·F_A (max und min)", `F_SA,max = ${fmt(PhiN, 5)}·${fmt(FAmax)} = ${fmt(FSAmax)} N; F_SA,min = ${fmt(FSAmin)} N`, FSAmax, "N", `${SV_REF_VDI} (R3/1); ${SV_REF_ROLOFF} (8.11)`));
  add("kraft", step("SV-FPA", "Plattenentlastung", "F_PA = (1 − Φ_n)·F_A", `F_PA,max = (1 − ${fmt(PhiN, 5)})·${fmt(FAmax)} = ${fmt(FPAmax)} N`, FPAmax, "N", `${SV_REF_VDI} (R3/2); ${SV_REF_ROLOFF} (8.12)`));
  let FQ = inp.FQ / (inp.torque?.z ?? 1);
  if (inp.torque) {
    const t = 2 * inp.torque.T / (inp.torque.Dt * inp.torque.z); FQ += t;
    add("kraft", step("SV-FQT", "Querkraft je Schraube aus Moment am Lochkreis", "F_Q = 2·T/(D_t·z) + F_Q,direkt/z", `F_Q = 2·${fmt(inp.torque.T / 1e3)} N·m·10³/(${fmt(inp.torque.Dt)}·${fmt(inp.torque.z)}) + ${fmt(inp.FQ)}/${fmt(inp.torque.z)} = ${fmt(FQ)} N`, FQ, "N", `${SV_REF_ROLOFF} (8.18); ${SV_REF_VDI} B2 S. 137`));
  }

  // ---------------------------------------------------------------- R2: erforderliche Klemmkraft
  const FKQ = FQ / (inp.qF * inp.muT) + (inp.MY > 0 ? inp.MY / (inp.qF * inp.ra * inp.muT) : 0);
  if (FQ > 0 || inp.MY > 0) add("vorspannung", step("SV-FKQ", "Klemmkraft für Querkraft und Moment (Reibschluss)", "F_KQ = F_Q,max/(q_F·μ_T,min) + M_Y,max/(q_M·r_a·μ_T,min)",
    `F_KQ = ${fmt(FQ)}/(${fmt(inp.qF)}·${fmt(inp.muT)})${inp.MY > 0 ? ` + ${fmt(inp.MY)}/(${fmt(inp.qF)}·${fmt(inp.ra)}·${fmt(inp.muT)})` : ""} = ${fmt(FKQ)} N`, FKQ, "N", `${SV_REF_VDI} (R2/1); ${SV_REF_ROLOFF} (8.18)`));
  const FKP = inp.AD * inp.pi;
  if (FKP > 0) add("vorspannung", step("SV-FKP", "Dichtkraft", "F_KP = A_D·p_i,max", `F_KP = ${fmt(inp.AD)}·${fmt(inp.pi)} = ${fmt(FKP)} N`, FKP, "N", `${SV_REF_VDI} (R2/2)`));
  const FKerf = Math.max(FKQ, FKP + inp.FKHand);
  add("vorspannung", step("SV-FKERF", "Erforderliche Klemmkraft", "F_Kerf = max(F_KQ; F_KP + F_K,Hand) (F_KA = 0, zentrisch)", `F_Kerf = max(${fmt(FKQ)}; ${fmt(FKP)} + ${fmt(inp.FKHand)}) = ${fmt(FKerf)} N`, FKerf, "N", `${SV_REF_VDI} (R2/4)`));
  // ---------------------------------------------------------------- R4: Setzen, Temperatur
  const nA = inp.joint === "DSV" ? 2 : 1, nT = layers.length - 1 + (inp.joint === "ESV" ? 1 : 0);
  let fZ: number;
  if (inp.fZ !== null) { fZ = inp.fZ; add("vorspannung", step("SV-FZSUM", "Setzbetrag (von Hand)", "f_Z eingegeben", `f_Z = ${fmt(fZ * 1e3)} µm`, fZ, "mm", `${SV_REF_VDI} Tab. 5; ${SV_REF_ROLOFF} TB 8-10a`)); }
  else {
    const e = embedOf(fd, inp.rz, inp.embedLoad);
    if (!e) { errors.push("Setzbeträge fehlen in den Fachdaten (fd_sv_embed)."); return fail(); }
    fZ = (e.f_thread_um + nA * e.f_bearing_um + nT * e.f_interface_um) / 1e3;
    add("vorspannung", step("SV-FZSUM", "Setzbetrag (Richtwerte)", "f_Z = f_Gewinde + n_A·f_Auflage + n_T·f_Trennfuge",
      `R_z ${inp.rz === "lt10" ? "< 10" : inp.rz === "10to40" ? "10 bis < 40" : "40 bis < 160"} µm, ${inp.embedLoad}: f_Z = ${fmt(e.f_thread_um)} + ${nA}·${fmt(e.f_bearing_um)} + ${nT}·${fmt(e.f_interface_um)} = ${fmt(fZ * 1e3)} µm`, fZ, "mm", `${SV_REF_VDI} Tab. 5; ${SV_REF_ROLOFF} TB 8-10a`));
  }
  const FZ = fZ / (dS + dP);
  add("vorspannung", step("SV-FZ", "Vorspannkraftverlust durch Setzen", "F_Z = f_Z/(δ_S + δ_P)", `F_Z = ${fmt(fZ * 1e3)}·10⁻³/(${mu(dS)} + ${mu(dP)})·10⁻⁶ = ${fmt(FZ)} N`, FZ, "N", `${SV_REF_VDI} (R4/1); ${SV_REF_ROLOFF} (8.19)`));
  let dFVth = 0;
  if (inp.temp) {
    const t = inp.temp; dFVth = lK * (t.alphaS * t.dTS - t.alphaP * t.dTP) / (dS + dP);
    add("vorspannung", step("SV-OPT-VTH", "Vorspannkraftänderung durch Temperatur (Option, vereinfacht)", "ΔF′_Vth = l_K·(α_S·ΔT_S − α_P·ΔT_P)/(δ_S·E_SRT/E_ST + δ_P·E_PRT/E_PT), hier E(T) = E_RT",
      `ΔF′_Vth = ${fmt(lK)}·(${fmt(t.alphaS * 1e6)}·10⁻⁶·${fmt(t.dTS)} − ${fmt(t.alphaP * 1e6)}·10⁻⁶·${fmt(t.dTP)})/(${mu(dS)} + ${mu(dP)})·10⁻⁶ = ${fmt(dFVth)} N (α_P der verspannten Teile in l_K${inp.joint === "ESV" ? "; das Teil mit Innengewinde liegt außerhalb l_K" : ""})`, dFVth, "N", `${SV_REF_VDI} (R4/2)`));
    warnings.push("Temperatur nur Entwurf: E(T) und Relaxation nicht erfasst (S11).");
  }
  const dFloss = Math.max(dFVth, 0), dFgain = Math.min(dFVth, 0);
  // ---------------------------------------------------------------- R5 bis R7: Montagevorspannkraft
  const FMmin = FKerf + (1 - PhiN) * FAmax + FZ + dFloss;
  add("vorspannung", step("SV-FMMIN", "Mindestmontagevorspannkraft", "F_M,min = F_Kerf + (1 − Φ_n)·F_A,max + F_Z + ΔF′_Vth (Zunahme ΔF′_Vth < 0 → 0)",
    `F_M,min = ${fmt(FKerf)} + (1 − ${fmt(PhiN, 5)})·${fmt(FAmax)} + ${fmt(FZ)} + ${fmt(dFloss)} = ${fmt(FMmin)} N${inp.temp ? "" : " (Temperatur nicht berücksichtigt: ΔF′_Vth = 0)"}`, FMmin, "N", `${SV_REF_VDI} (R5/1); ${SV_REF_ROLOFF} (8.29), (8.30)`));
  const FMmax = inp.alphaA * FMmin;
  add("vorspannung", step("SV-FMMAX", "Maximalmontagevorspannkraft", "F_M,max = α_A·F_M,min", `F_M,max = ${fmt(inp.alphaA)}·${fmt(FMmin)} = ${fmt(FMmax)} N`, FMmax, "N", `${SV_REF_VDI} (R6/1); ${SV_REF_ROLOFF} (8.29)`));
  const FMzul = fmZul(T, d0, inp.nu, Rp, inp.muG);
  add("vorspannung", step("SV-FMZUL", "Zulässige Montagevorspannkraft", "F_M,zul = A₀·ν·R_p0,2min/√(1 + 3·[3/2·d₂/d₀·(P/(π·d₂) + 1,155·μ_G,min)]²)",
    `${gradeLabel}: R_p0,2 = ${fmt(Rp)} N/mm²; F_M,zul = ${fmt(A0)}·${fmt(inp.nu)}·${fmt(Rp)}/√(1 + 3·[1,5·${fmt(T.d2)}/${fmt(d0)}·(${fmt(T.P)}/(π·${fmt(T.d2)}) + 1,155·${fmt(inp.muG)})]²) = ${fmt(FMzul)} N`, FMzul, "N",
    `${SV_REF_VDI} (R7/2); ${SV_REF_ROLOFF} (8.32), (8.33); ${stainless ? SV_REF_ISO3506 : SV_REF_ISO898} Tab. 3`));
  const sigRedM = inp.nu * Rp;
  add("festigkeit", step("SV-SREDM", "Vergleichsspannung bei der Montage", "σ_red,M = ν·R_p0,2min (bei F_M,zul)", `σ_red,M = ${fmt(inp.nu)}·${fmt(Rp)} = ${fmt(sigRedM)} N/mm²`, sigRedM, "N/mm²", `${SV_REF_VDI} (R7/1); ${SV_REF_ROLOFF} (8.31)`));
  // ---------------------------------------------------------------- R8: Betriebsbeanspruchung
  const FSmax = FMzul + FSAmax - dFgain;
  add("festigkeit", step("SV-FSMAX", "Maximale Schraubenkraft", "F_S,max = F_M,zul + Φ_n·F_A,max − ΔF_Vth (nur Zunahme, ΔF_Vth < 0)", `F_S,max = ${fmt(FMzul)} + ${fmt(FSAmax)} − (${fmt(dFgain)}) = ${fmt(FSmax)} N`, FSmax, "N", `${SV_REF_VDI} (R8/1); ${SV_REF_ROLOFF} (8.14)`));
  const sigZ = FSmax / A0;
  add("festigkeit", step("SV-SZMAX", "Maximale Zugspannung", "σ_z,max = F_S,max/A₀", `σ_z,max = ${fmt(FSmax)}/${fmt(A0)} = ${fmt(sigZ)} N/mm²`, sigZ, "N/mm²", `${SV_REF_VDI} (R8/2)`));
  const MG = threadTorque(FMzul, T, inp.muG), WP = polarModulus(d0), tau = inp.torsionFree ? 0 : MG / WP;
  add("festigkeit", step("SV-MG", "Gewindemoment", "M_G = F_M,zul·d₂/2·(P/(π·d₂) + 1,155·μ_G,min)", `M_G = ${fmt(FMzul)}·${fmt(T.d2)}/2·(${fmt(T.P)}/(π·${fmt(T.d2)}) + 1,155·${fmt(inp.muG)}) = ${fmt(MG / 1e3)} N·m`, MG, "N·mm", `${SV_REF_VDI} Gl. (154); ${SV_REF_ROLOFF} (8.23)`));
  add("festigkeit", step("SV-WP", "Polares Widerstandsmoment", "W_P = π/16·d₀³", `W_P = π/16·${fmt(d0)}³ = ${fmt(WP)} mm³`, WP, "mm³", `${SV_REF_VDI} Gl. (156)`));
  add("festigkeit", step("SV-TAU", "Torsionsspannung", inp.torsionFree ? "torsionsfrei angezogen: τ_max = 0" : "τ_max = M_G/W_P", inp.torsionFree ? "τ_max = 0 (hydraulisch, torsionsfrei)" : `τ_max = ${fmt(MG)}/${fmt(WP)} = ${fmt(tau)} N/mm²`, tau, "N/mm²", `${SV_REF_VDI} (R8/3)`));
  const kt = 0.5, sigRedB = Math.sqrt(sigZ * sigZ + 3 * (kt * tau) ** 2);
  add("festigkeit", step("SV-SREDB", "Vergleichsspannung im Betrieb", "σ_red,B = √(σ_z,max² + 3·(k_τ·τ_max)²), k_τ = 0,5", `σ_red,B = √(${fmt(sigZ)}² + 3·(0,5·${fmt(tau)})²) = ${fmt(sigRedB)} N/mm²`, sigRedB, "N/mm²", `${SV_REF_VDI} (R8/4); ${SV_REF_ROLOFF} (8.35b)`));
  const SF = Rp / sigRedB;
  add("festigkeit", step("SV-SF", "Sicherheit gegen Fließen", "S_F = R_p0,2min/σ_red,B", `S_F = ${fmt(Rp)}/${fmt(sigRedB)} = ${fmt(SF, 4)}`, SF, "1", `${SV_REF_VDI} (R8/5-2); ${SV_REF_ROLOFF} (8.35a)`));
  const FBS01 = 0.1 * Rp * A0;
  add("festigkeit", step("SV-FBS01", "Zulässige Zusatzkraft nach Roloff (Kurznachweis)", "F_SA ≤ 0,1·R_p0,2·A₀ (bei ν = 0,9)", `0,1·${fmt(Rp)}·${fmt(A0)} = ${fmt(FBS01)} N; F_SA,max = ${fmt(FSAmax)} N`, FBS01, "N", `${SV_REF_ROLOFF} (8.34a/b)`));
  // ---------------------------------------------------------------- R9: Dauerhaltbarkeit
  const dynamic = Math.abs(FAmax - FAmin) > SV_REL_TOL * Math.max(Math.abs(FAmax), Math.abs(FAmin), 1);
  const Fa = (FSAmax - FSAmin) / 2, Fm = FMzul + (FSAmax + FSAmin) / 2;
  add("kraft", step("SV-FAM", "Ausschlag- und Mittelkraft der Schraube", "F_a = (F_SAo − F_SAu)/2; F_m = F_V + (F_Ao + F_Au)/2·Φ_n (F_V = F_M,zul)", `F_a = (${fmt(FSAmax)} − ${fmt(FSAmin)})/2 = ${fmt(Fa)} N; F_m = ${fmt(FMzul)} + ${fmt((FSAmax + FSAmin) / 2)} = ${fmt(Fm)} N`, Fa, "N", `${SV_REF_ROLOFF} (8.15), (8.16)`));
  let sigA: number | null = null, sigAS: number | null = null, SD: number | null = null;
  if (dynamic) {
    sigA = Fa / T.As;
    add("schwingung", step("SV-SA", "Spannungsausschlag", "σ_a = (F_SAo − F_SAu)/(2·A_s)", `σ_a = (${fmt(FSAmax)} − ${fmt(FSAmin)})/(2·${fmt(T.As)}) = ${fmt(sigA)} N/mm²`, sigA, "N/mm²", `${SV_REF_VDI} (R9/1); ${SV_REF_ROLOFF} (8.20a)`));
    if (inp.sigmaA !== null) { sigAS = inp.sigmaA; warnings.push(`Dauerhaltbarkeit σ_A = ${fmt(sigAS)} N/mm² von Hand.`); }
    else if (stainless || inp.gradeManual) warnings.push("Dauerhaltbarkeit: VDI-Werte σ_ASV, σ_ASG gelten nur für Stahlschrauben 8.8 bis 12.9; σ_A von Hand eingeben.");
    else {
      const asv = sigmaASV(d);
      add("schwingung", step("SV-SASV", "Dauerhaltbarkeit schlussvergütet", "σ_ASV = 0,85·(150/d + 45)", `σ_ASV = 0,85·(150/${fmt(d)} + 45) = ${fmt(asv)} N/mm²`, asv, "N/mm²", `${SV_REF_VDI} (R9/5-1); ${SV_REF_ROLOFF} (8.21)`));
      sigAS = asv;
      if (inp.rolled === "SG") {
        const F02 = T.As * Rp, asg = (2 - Fm / F02) * asv;
        add("schwingung", step("SV-SASG", "Dauerhaltbarkeit schlussgewalzt", "σ_ASG = (2 − F_Sm/F_0,2min)·σ_ASV, F_0,2min = A_s·R_p0,2min", `σ_ASG = (2 − ${fmt(Fm)}/${fmt(F02)})·${fmt(asv)} = ${fmt(asg)} N/mm²`, asg, "N/mm²", `${SV_REF_VDI} (R9/5-2); ${SV_REF_ROLOFF} (8.22)`));
        sigAS = asg;
      }
    }
    if (sigAS !== null && inp.NZ !== null && inp.NZ < 2e6) {
      if (!(inp.NZ > 0)) { errors.push("Lastwechselzahl N_Z muss größer als 0 sein."); return fail(); }
      const ex = inp.rolled === "SG" ? 1 / 6 : 1 / 3, z = sigAS * (2e6 / inp.NZ) ** ex;
      add("schwingung", step("SV-OPT-SAZ", "Zeitfestigkeit (Option)", inp.rolled === "SG" ? "σ_AZSG = σ_ASG·(N_D/N_Z)^(1/6), N_D = 2·10⁶" : "σ_AZSV = σ_ASV·(N_D/N_Z)^(1/3), N_D = 2·10⁶",
        `σ_AZ = ${fmt(sigAS)}·(2·10⁶/${fmt(inp.NZ)})^(${inp.rolled === "SG" ? "1/6" : "1/3"}) = ${fmt(z)} N/mm²`, z, "N/mm²", `${SV_REF_VDI} (R9/6-1), (R9/6-2)`));
      sigAS = z;
    }
    if (sigAS !== null) {
      SD = sigAS / sigA;
      add("schwingung", step("SV-SD", "Sicherheit gegen Dauerbruch", "S_D = σ_AS/σ_a", `S_D = ${fmt(sigAS)}/${fmt(sigA)} = ${fmt(SD, 4)}`, SD, "1", `${SV_REF_VDI} (R9/4); ${SV_REF_ROLOFF} (8.20b)`));
    }
  }
  // ---------------------------------------------------------------- R10: Flächenpressung
  const FVmax = FMzul - FZ;
  const FSAp = Math.max(FSAmax, 0), FMTab = inp.yieldControlled ? fmZul(T, d0, 0.9, Rp, inp.muG) : NaN;
  const contacts: SvContact[] = cts.map((c) => {
    const pMc = FMzul / c.Ap, pBc = (FVmax + FSAp - dFgain) / c.Ap;
    add("pressung", step("SV-PM", "Flächenpressung Montage", "p_M,max = F_M,zul/A_p,min", `${c.label}: p_M = ${fmt(FMzul)}/${fmt(c.Ap)} = ${fmt(pMc)} N/mm²`, pMc, "N/mm²", `${SV_REF_VDI} (R10/1); ${SV_REF_ROLOFF} (8.36)`));
    add("pressung", step("SV-PB", "Flächenpressung Betrieb", "p_B,max = (F_V,max + F_SA,max − ΔF_Vth)/A_p,min, F_V,max = F_M,zul − F_Z (ΔF_Vth > 0 → 0, Druck: F_SA = 0)",
      `${c.label}: p_B = (${fmt(FVmax)} + ${fmt(FSAp)} − (${fmt(dFgain)}))/${fmt(c.Ap)} = ${fmt(pBc)} N/mm²`, pBc, "N/mm²", `${SV_REF_VDI} (R10/2), Gl. (191)`));
    let pmx = Math.max(pMc, pBc);
    if (inp.yieldControlled) { pmx = 1.4 * FMTab / c.Ap;
      add("pressung", step("SV-PSG", "Flächenpressung streckgrenz- bzw. drehwinkelgesteuert", "p_max = 1,4·F_M,Tab/A_p,min (F_M,Tab mit ν = 0,9)", `${c.label}: p_max = 1,4·${fmt(FMTab)}/${fmt(c.Ap)} = ${fmt(pmx)} N/mm²`, pmx, "N/mm²", `${SV_REF_VDI} (R10/3); ${SV_REF_ROLOFF} (8.37)`)); }
    let Sp: number | null = null;
    if (c.pG !== null) { Sp = c.pG / pmx; add("pressung", step("SV-SP", "Sicherheit gegen Flächenpressung", "S_p = p_G/p_max", `${c.label}: S_p = ${fmt(c.pG)}/${fmt(pmx)} = ${fmt(Sp, 4)}`, Sp, "1", `${SV_REF_VDI} (R10/4)`)); }
    else warnings.push(`Flächenpressung ${c.label}: p_G unbekannt (${c.label.endsWith("Scheibe") ? "Scheibe ISO 7089, von Hand eingeben" : "Werkstoff ohne Zeile in fd_sv_pg, von Hand eingeben"}); nicht bewertbar.`);
    return { ...c, pM: pMc, pB: pBc, pMax: pmx, Sp };
  });
  const plateC = (side: "kopf" | "mutter") => contacts.filter((c) => c.side === side).pop() ?? null;
  const minSp = (side: "kopf" | "mutter") => { const v = contacts.filter((c) => c.side === side && c.Sp !== null).map((c) => c.Sp!); return v.length ? Math.min(...v) : null; };
  const pM = plateC("kopf")!.pM, pB = plateC("kopf")!.pB, pMax = plateC("kopf")!.pMax, SpHead = minSp("kopf");
  const pMNut = plateC("mutter")?.pM ?? null, pBNut = plateC("mutter")?.pB ?? null, SpNut = minSp("mutter");
  // ---------------------------------------------------------------- R12: Restklemmkraft, Gleiten, Abscheren
  const FVmin = FMzul / inp.alphaA - FZ - dFloss;
  add("vorspannung", step("SV-FVMIN", "Kleinste Vorspannkraft im Betrieb", "F_V,min = F_M,zul/α_A − F_Z − ΔF′_Vth (Zunahme ΔF′_Vth < 0 → 0)", `F_V,min = ${fmt(FMzul)}/${fmt(inp.alphaA)} − ${fmt(FZ)} − ${fmt(dFloss)} = ${fmt(FVmin)} N`, FVmin, "N", `${SV_REF_VDI} (R12/1)`));
  const FKRmin = FVmin - (1 - PhiN) * FAmax;
  add("vorspannung", step("SV-FKR", "Kleinste Restklemmkraft", "F_KR,min = F_V,min − (1 − Φ_n)·F_A,max", `F_KR,min = ${fmt(FVmin)} − (1 − ${fmt(PhiN, 5)})·${fmt(FAmax)} = ${fmt(FKRmin)} N`, FKRmin, "N", `${SV_REF_VDI} (R12/1); ${SV_REF_ROLOFF} (8.13)`));
  let SG: number | null = null, tauQ: number | null = null, SA: number | null = null;
  if (FKQ > 0) { SG = FKRmin / FKQ; add("gleiten", step("SV-SG", "Sicherheit gegen Gleiten", "S_G = F_KR,min/F_KQerf", `S_G = ${fmt(FKRmin)}/${fmt(FKQ)} = ${fmt(SG, 4)}`, SG, "1", `${SV_REF_VDI} (R12/4)`)); }
  if (FQ > 0) {
    const dTau = inp.shearAt === "schaft" ? d : T.dS, Atau = Math.PI / 4 * dTau * dTau;
    tauQ = FQ / Atau;
    add("gleiten", step("SV-TAUQ", "Scherspannung bei Durchrutschen", "τ_Q,max = F_Q,max/A_τ (A_τ mit d_τ = d_i im Schaft, d_S im Gewinde, B-sv6)", `τ_Q = ${fmt(FQ)}/(π/4·${fmt(dTau)}²) = ${fmt(tauQ)} N/mm² (${inp.shearAt})`, tauQ, "N/mm²", `${SV_REF_VDI} (R12/5), Gl. (219)`));
    const sr = inp.gradeManual ? null : shearRatioOf(fd, inp.grade);
    if (sr) { const tauB = sr.tau_rm * Rm; SA = tauB * Atau / FQ;
      add("gleiten", step("SV-SAB", "Sicherheit gegen Abscheren", "S_A = τ_B·A_τ/F_Q,max, τ_B = (τ_B/R_m)·R_m", `τ_B = ${fmt(sr.tau_rm)}·${fmt(Rm)} = ${fmt(tauB)} N/mm²; S_A = ${fmt(tauB)}·${fmt(Atau)}/${fmt(FQ)} = ${fmt(SA, 4)}`, SA, "1", `${SV_REF_VDI} (R12/7), Tab. 7`)); }
    else warnings.push("Abscheren: τ_B/R_m für den Schraubenwerkstoff unbekannt (VDI Tab. 7); Nachweis entfällt.");
  }
  // ---------------------------------------------------------------- R11: Einschraubtiefe
  let le: number | null = null, mEff: number | null = null;
  if (inp.joint === "ESV") {
    if (leRow) { le = leRow.le_d_max * d;
      add("gleiten", step("SV-LE", "Erforderliche Einschraubtiefe (Anhaltswert)", "l_e = Faktor·d nach Werkstoff Innengewinde, R_m, Klasse, d/P (oberer Wert)",
        `${leRow.material_group} (R_m > ${fmt(leRow.rm_over_mpa)}), ${leRow.grade} ${leRow.thread}: l_e = ${fmt(leRow.le_d_max)}·${fmt(d)} = ${fmt(le)} mm${leRow.le_d_print_max !== leRow.le_d_max ? ` (Druckwert ${fmt(leRow.le_d_print_max)}·d, angehoben B-sv13)` : ""}`, le, "mm", `${SV_REF_ROLOFF} TB 8-15`)); }
    else warnings.push("Einschraubtiefe: keine Zeile in TB 8-15 (Werkstoffgruppe, R_m, Klasse); Nachweis von Hand.");
    const mG = inp.mGes ?? (length !== null && inp.shank === null ? length - lK : null);
    if (mG !== null) { mEff = mG - 2 * T.P;
      add("gleiten", step("SV-MVORH", "Vorhandene wirksame Einschraubtiefe", "m_eff,vorh = m_ges − 2·P", `m_eff = ${fmt(mG)} − 2·${fmt(T.P)} = ${fmt(mEff)} mm`, mEff, "mm", `${SV_REF_VDI} Gl. (208), B1 S. 136`)); }
  }
  // ---------------------------------------------------------------- R13: Anziehen und Lösen
  const MA = tighteningTorque(FMzul, T, inp.muG, DKm, inp.muK), MAex = tighteningTorqueExact(FMzul, T, inp.muG, DKm, inp.muK);
  add("anziehen", step("SV-MA", "Anziehmoment", "M_A = F_M,zul·(0,16·P + 0,58·d₂·μ_G,min + D_Km/2·μ_K,min)", `M_A = ${fmt(FMzul)}·(0,16·${fmt(T.P)} + 0,58·${fmt(T.d2)}·${fmt(inp.muG)} + ${fmt(DKm)}/2·${fmt(inp.muK)}) = ${fmt(MA / 1e3)} N·m`, MA, "N·mm", `${SV_REF_VDI} (R13/1); ${SV_REF_ROLOFF} (8.26)`));
  add("anziehen", step("SV-MA-EX", "Anziehmoment exakt", "M_A = F_M·[d₂/2·tan(φ + ρ′) + D_Km/2·μ_K], tan ρ′ = μ_G/cos 30°",
    `M_A = ${fmt(MAex.MA / 1e3)} N·m (Steigung ${fmt(MAex.pitch / 1e3)}, Gewindereibung ${fmt(MAex.thread / 1e3)}, Auflagereibung ${fmt(MAex.bearing / 1e3)} N·m; Abweichung zu (R13/1) ${fmt((MA / MAex.MA - 1) * 100, 3)} %)`, MAex.MA, "N·mm", `${SV_REF_ROLOFF} (8.24); ${SV_REF_VDI} Abschn. 5.4.3`));
  const L = looseningTorque(FVmax, T, inp.muG, DKm, inp.muK);
  add("anziehen", step("SV-ML", "Losdrehmoment", "M_L = F_V·[d₂/2·tan(ρ′ − φ) + D_Km/2·μ_K], F_V = F_M,zul − F_Z", `M_L = ${fmt(FVmax)}·[…] = ${fmt(L.ML / 1e3)} N·m`, L.ML, "N·mm", `${SV_REF_ROLOFF} S. 277`));
  add("anziehen", step("SV-MLI", "Inneres Losdrehmoment", "M_Li = F_V·P/(2·π)", `M_Li = ${fmt(FVmax)}·${fmt(T.P)}/(2·π) = ${fmt(L.MLi / 1e3)} N·m`, L.MLi, "N·mm", `${SV_REF_ROLOFF} S. 278`));
  // ---------------------------------------------------------------- R0: Vorwahl (Startwert, Roloff (8.2))
  let AsMin: number | null = null;
  { const reduced = taper, beta = taper ? 0.6 : lShank > 0 ? 1.1 : 0.8, kap = kappaRoloff(inp.muG, reduced), FB = Math.max(FAmax, 0);
    const den = Rp / (kap * inp.alphaA) - beta * inp.ES * fZ / lK;
    if (den > 0 && FB + FKerf > 0) { AsMin = (FB + FKerf) / den;
      const sizes = fd.threads.filter((t) => t.series === "regel").sort((a, b) => a.d_mm - b.d_mm).find((t) => threadProps(t).As >= AsMin! - 1e-12);
      add("vorwahl", step("SV-ASMIN", "Mindestquerschnitt nach Kübler (Vorwahl R0)", "A_s ≥ (F_B + F_Kl)/(R_p0,2/(κ·k_A) − β·E_S·f_Z/l_K), κ nach μ_G, β 1,1/0,8/0,6",
        `κ = ${fmt(kap, 4)}, β = ${fmt(beta)}: A_s ≥ (${fmt(FB)} + ${fmt(FKerf)})/(${fmt(Rp)}/(${fmt(kap, 4)}·${fmt(inp.alphaA)}) − ${fmt(beta)}·${fmt(inp.ES)}·${fmt(fZ, 4)}/${fmt(lK)}) = ${fmt(AsMin)} mm²${sizes ? ` → kleinstes Regelgewinde M${fmt(sizes.d_mm)}` : ""}`, AsMin, "mm²", `${SV_REF_ROLOFF} (8.2), Bsp. 8.3`)); }
  }

  // ---------------------------------------------------------------- Nachweise
  const checks: SvCheck[] = [];
  const N = (id: string, title: string, formula: string, subst: string, value: number, unit: string, ref: string) => add("nachweis", step(id, title, formula, subst, value, unit, ref));
  const rFM = FMzul / FMmax;
  N("SV-N-FM", "Nachweis Schraubengröße", "F_M,max ≤ F_M,zul (Reserve F_M,zul/F_M,max)", `${fmt(FMzul)}/${fmt(FMmax)} = ${fmt(rFM, 4)}`, rFM, "1", `${SV_REF_VDI} (R7/3); ${SV_REF_ROLOFF} S. 273`);
  checks.push({ key: "montage", id: "SV-N-FM", label: "Montage", ok: svLe(FMmax, FMzul), required: true, reserve: rFM, state: "Hinweis", text: svLe(FMmax, FMzul) ? `F_M,max ${kN(FMmax)} kN ≤ F_M,zul ${kN(FMzul)} kN` : `F_M,max ${kN(FMmax)} kN > F_M,zul ${kN(FMzul)} kN: größere Schraube, höhere Klasse oder genaueres Anziehverfahren` });
  const rSF = SF / inp.req.SF;
  N("SV-N-SF", "Nachweis Fließen im Betrieb", "S_F ≥ S_F,erf (Verhältnis)", `${fmt(SF, 4)}/${fmt(inp.req.SF)} = ${fmt(rSF, 4)}`, rSF, "1", `${SV_REF_VDI} R8`);
  checks.push({ key: "fliessen", id: "SV-N-SF", label: "Fließen", ok: rSF >= 1 - SV_REL_TOL, required: true, reserve: rSF, text: `S_F = ${fmt(SF, 3)} (Soll ${fmt(inp.req.SF)})`, state: "Hinweis" });
  if (dynamic) {
    const ok = SD !== null ? SD / inp.req.SD >= 1 - SV_REL_TOL : null;
    if (SD !== null) N("SV-N-SD", "Nachweis Dauerhaltbarkeit", "S_D ≥ S_D,erf (Verhältnis)", `${fmt(SD, 4)}/${fmt(inp.req.SD)} = ${fmt(SD / inp.req.SD, 4)}`, SD / inp.req.SD, "1", `${SV_REF_VDI} R9`);
    checks.push({ key: "dauer", id: "SV-N-SD", label: "Dauerhaltbarkeit", ok, required: true, reserve: SD !== null ? SD / inp.req.SD : null, text: SD !== null ? `S_D = ${fmt(SD, 3)} (Soll ${fmt(inp.req.SD)})` : "nicht bewertbar: σ_A unbekannt (von Hand eingeben)", state: "Hinweis" });
  }
  for (const [key, side, sd] of [["pressung-kopf", "kopf", "Kopfseite"], ["pressung-mutter", "mutter", "Mutterseite"]] as const) {
    const cs = contacts.filter((c) => c.side === side); if (!cs.length) continue;
    const known = cs.filter((c) => c.Sp !== null), miss = cs.filter((c) => c.Sp === null);
    const r = known.length ? Math.min(...known.map((c) => c.Sp! / inp.req.Sp)) : null, low = known.find((c) => c.Sp! / inp.req.Sp === r);
    const one = (c: SvContact) => inp.yieldControlled
      ? `${c.label} (p_G ${fmt(c.pG!)} N/mm², ${c.pGFrom}): p_max = 1,4·${fmt(FMTab)}/${fmt(c.Ap)} = ${fmt(c.pMax)} N/mm² (streckgrenzgesteuert); S_p = ${fmt(c.pG!)}/${fmt(c.pMax)} = ${fmt(c.Sp!, 4)}`
      : `${c.label} (p_G ${fmt(c.pG!)} N/mm², ${c.pGFrom}): p_M = ${fmt(FMzul)}/${fmt(c.Ap)} = ${fmt(c.pM)}, p_B = (${fmt(FVmax)} + ${fmt(FSAp)} − (${fmt(dFgain)}))/${fmt(c.Ap)} = ${fmt(c.pB)} N/mm²; p_max = ${fmt(c.pMax)} N/mm² (${c.pM >= c.pB ? "Montage" : "Betrieb"} maßgebend); S_p = ${fmt(c.pG!)}/${fmt(c.pMax)} = ${fmt(c.Sp!, 4)}`;
    if (r !== null) N("SV-N-P", `Nachweis Flächenpressung ${sd}`,
      "S_p = p_G/p_max je Auflage, p_max = max(p_M; p_B), p_M = F_M,zul/A_p,min (Montage), p_B = (F_V,max + F_SA,max − ΔF_Vth)/A_p,min (Betrieb), F_V,max = F_M,zul − F_Z; streckgrenz- bzw. drehwinkelgesteuert p_max = 1,4·F_M,Tab/A_p,min; maßgebend die kleinere Sicherheit; Nachweis S_p/S_p,erf ≥ 1",
      `${known.map(one).join("; ")}; maßgebend ${low!.label}: S_p/S_p,erf = ${fmt(low!.Sp!, 4)}/${fmt(inp.req.Sp)} = ${fmt(r, 4)}`, r, "1", `${SV_REF_VDI} R10, (R10/1) bis (R10/4)`);
    const ok = r !== null && r < 1 - SV_REL_TOL ? false : miss.length ? null : true;
    const txt = [known.length ? `S_p = ${fmt(Math.min(...known.map((c) => c.Sp!)), 3)} (${low!.label}, Soll ${fmt(inp.req.Sp)})` : "", miss.length ? `nicht bewertbar: p_G fehlt (${miss.map((c) => c.label).join(", ")})` : ""].filter(Boolean).join("; ");
    checks.push({ key, id: "SV-N-P", label: `Flächenpressung ${sd}`, ok, required: true, reserve: r, text: txt, state: "Hinweis" });
  }
  const rKR = FKerf > 0 ? FKRmin / FKerf : FKRmin > 0 ? Infinity : 0;
  N("SV-N-KR", "Nachweis Restklemmkraft", "F_KR,min ≥ F_Kerf; F_KR,min ≤ 0: Trennfuge öffnet", `F_KR,min ${fmt(FKRmin)} N, F_Kerf ${fmt(FKerf)} N`, FKRmin - FKerf, "N", `${SV_REF_VDI} R5; ${SV_REF_ROLOFF} (8.13)`);
  const okKR = FKRmin >= FKerf - SV_REL_TOL * Math.max(FKerf, 1) && FKRmin > 0;
  checks.push({ key: "restklemmkraft", id: "SV-N-KR", label: "Restklemmkraft", ok: okKR, required: true, reserve: Number.isFinite(rKR) ? rKR : null, text: FKRmin <= 0 ? `F_KR,min = ${kN(FKRmin)} kN ≤ 0: Trennfuge öffnet` : `F_KR,min ${kN(FKRmin)} kN ${okKR ? "≥" : "<"} F_Kerf ${kN(FKerf)} kN`, state: "Hinweis" });
  if (FKRmin <= 0) warnings.push("Trennfuge öffnet (F_KR,min ≤ 0): Vorspannung erhöhen; Klaffen ist nicht im Umfang (VDI 3.2.2).");
  if (SG !== null) {
    N("SV-N-SG", "Nachweis Gleiten", "S_G ≥ S_G,erf (Verhältnis)", `${fmt(SG, 4)}/${fmt(inp.req.SG)} = ${fmt(SG / inp.req.SG, 4)}`, SG / inp.req.SG, "1", `${SV_REF_VDI} R12`);
    checks.push({ key: "gleiten", id: "SV-N-SG", label: "Gleiten", ok: SG / inp.req.SG >= 1 - SV_REL_TOL, required: true, reserve: SG / inp.req.SG, text: `S_G = ${fmt(SG, 3)} (Soll ${fmt(inp.req.SG)}; bei dynamischer Querkraft Gleitreibung ansetzen)`, state: "Hinweis" });
  }
  if (SA !== null) {
    N("SV-N-SA", "Nachweis Abscheren (Ausfallbetrachtung)", "S_A ≥ S_A,erf (Verhältnis)", `${fmt(SA, 4)}/${fmt(inp.req.SA)} = ${fmt(SA / inp.req.SA, 4)}`, SA / inp.req.SA, "1", `${SV_REF_VDI} R12`);
    checks.push({ key: "abscheren", id: "SV-N-SA", label: "Abscheren", ok: SA / inp.req.SA >= 1 - SV_REL_TOL, required: false, reserve: SA / inp.req.SA, text: `S_A = ${fmt(SA, 3)} (Soll ${fmt(inp.req.SA)}, Hinweis)`, state: "Hinweis" });
  }
  if (inp.joint === "ESV") {
    const ok = le !== null && mEff !== null ? mEff >= le - SV_REL_TOL * le : null;
    N("SV-N-LE", "Nachweis Einschraubtiefe", "m_eff,vorh ≥ l_e (ESV)", le !== null && mEff !== null ? `${fmt(mEff)} mm ${ok ? "≥" : "<"} ${fmt(le)} mm` : "nicht bewertbar (l_e oder m_ges fehlt)", le !== null && mEff !== null ? mEff - le : 0, "mm", `${SV_REF_VDI} R11; ${SV_REF_ROLOFF} TB 8-15`);
    checks.push({ key: "einschraubtiefe", id: "SV-N-LE", label: "Einschraubtiefe", ok, required: true, reserve: le !== null && mEff !== null ? mEff / le : null, text: le !== null && mEff !== null ? `m_eff ${fmt(mEff)} mm, l_e ${fmt(le)} mm` : `nicht bewertbar: ${le === null ? "l_e (TB 8-15)" : "m_ges"} fehlt`, state: "Hinweis" });
  } else {
    N("SV-N-LE", "Nachweis Einschraubtiefe", "Normmutter ISO 4032 gleicher Festigkeitsklasse: Nachweis entfällt (VDI B2)", "DSV mit Mutter passender Klasse (ISO 898-2): erfüllt", 1, "1", `${SV_REF_VDI} R11; B2 S. 141`);
    checks.push({ key: "einschraubtiefe", id: "SV-N-LE", label: "Einschraubtiefe", ok: true, required: false, reserve: null, text: "Mutter ISO 4032 mit passender Festigkeitsklasse (ISO 898-2), Pflicht nur bei ESV (U8)", state: "Hinweis" });
  }
  N("SV-N-FBS", "Kurznachweis Roloff (nur Anzeige)", "F_SA ≤ 0,1·R_p0,2·A₀ (Verhältnis)", `${fmt(FSAmax)}/${fmt(FBS01)} = ${fmt(FSAmax / FBS01, 4)}`, FSAmax / FBS01, "1", `${SV_REF_ROLOFF} (8.34)`);
  checks.push({ key: "kurz", id: "SV-N-FBS", label: "Kurznachweis Roloff", ok: FSAmax <= FBS01 * (1 + SV_REL_TOL), required: false, reserve: FBS01 / Math.max(FSAmax, 1e-300), text: `F_SA,max ${kN(FSAmax)} kN ${FSAmax <= FBS01 ? "≤" : ">"} 0,1·R_p0,2·A₀ = ${kN(FBS01)} kN`, state: "Hinweis" });
  const gu: string[] = [];
  if (!(d >= 4 && d <= 39)) gu.push("Größe außerhalb M4 bis M39");
  if (inp.gradeManual || stainless || !(SV_GRADES_VDI as readonly string[]).includes(inp.grade)) gu.push("Werkstoff außerhalb Stahl 8.8 bis 12.9");
  if (inp.temp) gu.push("Temperatur nur vereinfacht");
  N("SV-N-GUELT", "Gültigkeit", "M4 bis M39, 8.8 bis 12.9, Stahlschraube, zentrisch, D_A > d_h, Raumtemperatur", gu.length ? gu.join("; ") : "im Gültigkeitsbereich", gu.length, "1", `${SV_REF_VDI} Abschn. 1`);
  checks.push({ key: "gueltig", id: "SV-N-GUELT", label: "Gültigkeit", ok: gu.length ? null : true, required: false, reserve: null, text: gu.length ? gu.join("; ") : "VDI 2230-1, zentrisch, M4 bis M39, 8.8 bis 12.9", state: "Hinweis" });
  const geo: string[] = [], lr = lK / d;
  if (lr < 2) geo.push("l_K/d < 2: größere Streuung von α_A (Tab. A8)");
  if (lr > 5 && !taper) geo.push("l_K/d > 5: Dehnschraube empfohlen");
  { let z = 0; const ends = layers.slice(0, -1).map((l) => (z += l.h)); if (lShank > 0 && lShank < lK && ends.some((e) => Math.abs(e - lShank) < T.P)) geo.push("Gewindeauslauf in einer Trennfuge"); }
  N("SV-N-GEO", "Gestaltung", "l_K/d < 2 Hinweis α_A; l_K/d > 5 Dehnschraube empfohlen; Gewindeauslauf nicht in der Trennfuge", `l_K/d = ${fmt(lr, 4)}${geo.length ? `; ${geo.join("; ")}` : ""}`, lr, "1", `${SV_REF_VDI} Tab. A8; ${SV_REF_ROLOFF} Abschn. 8.2.2`);
  checks.push({ key: "gestaltung", id: "SV-N-GEO", label: "Gestaltung", ok: geo.length ? null : true, required: false, reserve: null, text: geo.length ? geo.join("; ") : "Empfehlungen eingehalten", state: "Hinweis" });

  for (const c of checks) c.state = c.ok === true ? "erfüllt" : c.ok === false ? "nicht erfüllt" : c.required ? "nicht bewertbar" : "Hinweis";
  // ---------------------------------------------------------------- Kennwerte
  const req = checks.filter((c) => c.required && c.reserve !== null);
  const minRes = req.length ? Math.min(...req.map((c) => c.reserve!)) : NaN;
  // maßgebende Auflage (0.18.1, F2): kleinste Sicherheit S_p aller Auflagen, ohne p_G die größte Pressung
  const knownSp = contacts.filter((c) => c.Sp !== null);
  const pGov = knownSp.length ? knownSp.reduce((a, c) => (c.Sp! < a.Sp! ? c : a)) : contacts.reduce((a, c) => (c.pMax > a.pMax ? c : a));
  const kpis: SvKpi[] = [
    { key: "res", label: "Kleinste Reserve der Pflichtnachweise", sym: "min(S/S_erf)", value: minRes, unit: "1", primary: true },
    { key: "MA", label: "Anziehmoment", sym: "M_A", value: MA / 1e3, unit: "N·m", primary: true },
    { key: "FMmin", label: "Mindestmontagevorspannkraft", sym: "F_M,min", value: FMmin / 1e3, unit: "kN" }, { key: "FMmax", label: "Maximalmontagevorspannkraft", sym: "F_M,max", value: FMmax / 1e3, unit: "kN" },
    { key: "FMzul", label: "Zulässige Montagevorspannkraft", sym: "F_M,zul", value: FMzul / 1e3, unit: "kN" }, { key: "PhiN", label: "Kraftverhältnis", sym: "Φ_n", value: PhiN, unit: "1" },
    { key: "FZ", label: "Vorspannkraftverlust Setzen", sym: "F_Z", value: FZ / 1e3, unit: "kN" }, { key: "FKR", label: "Kleinste Restklemmkraft", sym: "F_KR,min", value: FKRmin / 1e3, unit: "kN" },
    { key: "sred", label: "Vergleichsspannung Betrieb", sym: "σ_red,B", value: sigRedB, unit: "N/mm²" }, { key: "p", label: "Flächenpressung maßgebende Auflage", sym: "p_max", value: pGov.pMax, unit: "N/mm²" },
  ];
  if (sigA !== null) kpis.push({ key: "sa", label: "Spannungsausschlag", sym: "σ_a", value: sigA, unit: "N/mm²" });
  const res: BoltJointResult = {
    task: inp.task, thread: T, grade: { label: gradeLabel, Rp, Rm, source: inp.gradeManual ? "Hand" : `${gr!.standard} (${gr!.source_id})` },
    geo: { lK, lGew, shank, length, d0, A0, dW: dWplate, dWcone, dh, DKi, Ap, ApNut, DKm, part, nut, layers, lNeed },
    bolt, plate, dS, dP, dPZu, PhiK, PhiN, n: inp.n, kefN, FAmax, FAmin, FSAmax, FSAmin, FPAmax, Fa, Fm, FQ, FKQ, FKP, FKerf, fZ, FZ, dFVth,
    FMmin, FMmax, FMzul, FVmin, FVmax, FKRmin, FSmax, sigZ, MG, WP, tau, sigRedB, SF, sigA, sigAS, SD, pM, pB, pMax, SpHead, pMNut, pBNut, SpNut, contacts,
    SG, tauQ, SA, le, mEff, MA, MAex, ML: L.ML, MLi: L.MLi, AsMin, candidates: [], checks, kpis, trace: G_, errors, warnings,
  };
  if (inp.task === "B") {
    const why = selectAbortReason(inp);
    if (why) warnings.push(`Auslegung abgebrochen: ${why}.`); else res.candidates = selectBolts(fd, inp);
    add("vorwahl", wahlStep(inp, res.candidates, why));
  }
  return res;
}

/** Pflichtnachweise erfüllt (Grundlage der Auslegung SV-WAHL). */
export const svAllRequiredOk = (r: BoltJointResult): boolean => !r.errors.length && r.checks.filter((c) => c.required).every((c) => c.ok === true);

// ---------------------------------------------------------------- Verspannungsschaubild (G1)
export interface JointDiagramState { key: "FMmax" | "FMmin" | "FV" | "betriebMax" | "betriebMin"; label: string; FV: number; fS: number; fP: number }
export interface JointDiagram {
  /** Kennlinien: Schraube (Steigung 1/δ_S) und Platten (Steigung −1/δ_P) je Zustand; Platten mit Krafteinleitung n (Roloff Bild 8.13) */
  dS: number; dP: number; dPn: number; PhiN: number;
  states: JointDiagramState[];
  /** Betriebspunkt bei F_A,max und F_A,min auf der Montagelinie F_V = F_M,zul/α_A − F_Z: Pfeile F_SA, F_PA, F_KR */
  operating: Array<{ FA: number; x: number; FS: number; FKR: number; FSA: number; FPA: number }>;
  limits: { FMzul: number; F02: number; FKerf: number };
  /** Polylinien je Zustand in (f in mm, F in N) */
  lines: Array<{ key: string; pts: Array<[number, number]> }>;
}
/**
 * Punkte des Verspannungsschaubilds nach VDI-Darstellung (G1). Für n < 1 ist die wirksame Plattenkennlinie im Betrieb
 * δ_P* = δ_S·Φ_n/(1 − Φ_n), damit F_SA = Φ_n·F_A und F_PA = (1 − Φ_n)·F_A am Diagramm abgelesen werden (Roloff Bild 8.13).
 */
export function jointDiagram(r: BoltJointResult): JointDiagram | null {
  if (r.errors.length || !Number.isFinite(r.dS)) return null;
  const dS = r.dS, dP = r.dP, dPn = dS * r.PhiN / (1 - r.PhiN);
  const st = (key: JointDiagramState["key"], label: string, F: number): JointDiagramState => ({ key, label, FV: F, fS: F * dS, fP: F * dP });
  const FV = r.FVmin;
  const states = [st("FMmax", "Montage F_M,max", r.FMmax), st("FMmin", "Montage F_M,min", r.FMmin), st("FV", "nach Setzen F_V,min", FV)];
  const operating = [r.FAmax, r.FAmin].map((FA) => {
    const FSA = r.PhiN * FA, FPA = (1 - r.PhiN) * FA;
    return { FA, x: FV * dS + FSA * dS, FS: FV + FSA, FKR: FV - FPA, FSA, FPA };
  });
  states.push({ key: "betriebMax", label: "Betrieb F_A,max", FV, fS: operating[0]!.x, fP: FV * dP }, { key: "betriebMin", label: "Betrieb F_A,min", FV, fS: operating[1]!.x, fP: FV * dP });
  const lines = [
    ...states.slice(0, 3).map((s) => ({ key: s.key, pts: [[0, 0], [s.fS, s.FV], [s.fS + s.fP, 0]] as Array<[number, number]> })),
    { key: "plattenN", pts: [[FV * dS, FV], [FV * dS + FV * dPn, 0]] as Array<[number, number]> },
  ];
  return { dS, dP, dPn, PhiN: r.PhiN, states, operating, limits: { FMzul: r.FMzul, F02: r.thread!.As * r.grade!.Rp, FKerf: r.FKerf }, lines };
}
