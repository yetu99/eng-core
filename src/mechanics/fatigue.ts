/**
 * Zusatznachweis Dauerfestigkeit und Zeitfestigkeit (Blatt 1), eng-core 0.9.0.
 *
 * Nennspannungskonzept nach Roloff/Matek Maschinenelemente 27. Aufl. 2025, Kap. 3.4 bis 3.7 (Aufbau nach DIN 743),
 * Werkstoffgruppen, Stützzahl, Mittelspannungsempfindlichkeit und Wöhlerlinie nach FKM-Richtlinie 7. Ausg.
 * (Wiedergabe Roloff TB 3, Steibler 2021 Anhang, Haibach 2006). Eigene Umsetzung, keine Normtexte.
 *
 * Annahmen: Blatt 1 liefert die Oberlast; je Beanspruchung ein Lastverhältnis R = σ_u/σ_o; gleichphasig;
 * Mittelspannung als Betrag (konservativ); K_V = 1 (keine Randschichtverfestigung), K_an = 1, Raumtemperatur,
 * kein Korrosionseinfluss. Einheiten: N, mm, MPa; Lastspielzahl dimensionslos.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { designValue, type Material, type Repo, type PropertyValueJson } from "../materials";
import { sectionHeight, type SectionProps, type SecType, type Dims } from "../sections";
import { alphaK, gradientOf, phiOf, COMP_LABEL, type LoadComp, type NotchGeom, type NotchInput } from "./notch";
import { fatigueGroupOf, ktValue, kgValue, krSigma, supportNumber, sdRequired, woehlerType, deffFamily, type FatigueGroupId } from "./fatigueGroups";

export interface FatigueInput {
  on: boolean;
  notch: NotchInput;
  /** Kerbstelle in mm ab linkem Ende; null = Stelle des größten |M_b| (sonst x = 0) */
  xK: number | null;
  /** Lastverhältnis R = σ_u/σ_o je Beanspruchung, −1 ≤ R ≤ 1 */
  R: Record<LoadComp, number>;
  /** Überlastungsfall 1 (σ_m konstant), 2 (κ konstant), 3 (σ_u konstant) */
  overload: 1 | 2 | 3;
  /** gemittelte Rautiefe R_z in µm */
  Rz: number;
  /** maßgebender Durchmesser für K_t in mm; null = aus dem Querschnitt (Roloff TB 3-10c) */
  dEff: number | null;
  /** technologischer Größeneinfluss manuell (gilt für R_m und R_p); null = aus der Kurve */
  Kt: number | null;
  /** geforderte Lastspielzahl; null = Dauerfestigkeit */
  N: number | null;
  /** geforderte Sicherheit; null = nach Werkstoffart (Roloff TB 3-16a) */
  SDreq: number | null;
  /** Gusswerkstoff zerstörungsfrei geprüft (S_D,erf 1,9 statt 2,1) */
  castTested: boolean;
  /** Wechselfestigkeit der Normprobe manuell in MPa */
  sigmaW: Record<LoadComp, number | null>;
}

export const FATIGUE_DEFAULT: FatigueInput = {
  on: true, notch: { type: "none" }, xK: null, R: { zd: 0, b: -1, t: 0 }, overload: 2, Rz: 6.3, dEff: null, Kt: null, N: null, SDreq: null, castTested: false,
  sigmaW: { zd: null, b: null, t: null },
};

export interface FatigueComp {
  c: LoadComp;
  /** Nennspannung im Kerbquerschnitt unter Oberlast (Vorzeichen wie Schnittgröße) */
  sn: number;
  R: number; sa: number; sm: number;
  alpha: number | null; G: number | null; n: number | null; beta: number;
  Kg: number; KR: number; KD: number;
  WN: number | null; WNsrc: string; W: number | null; GW: number | null;
  psi: number; GA: number | null; S: number | null; AK: number | null;
  /** statische Grenze für σ_GA + σ_m (R_p bzw. f_τ·R_p, spröde R_m) */
  limit: number | null;
}

export interface FatigueResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  group: FatigueGroupId | null;
  groupLabel: string;
  woehler: "I" | "II";
  xK: number;
  notch: NotchGeom | null;
  /** Durchmesser für Nennspannung und K_g (Kerbgrund) in mm, null bei nicht runden Querschnitten */
  d: number | null;
  dEff: number;
  Kt: number; Ktp: number;
  RmN: number | null; Rm: number | null; Rp: number | null;
  smv: number; tmv: number;
  comps: FatigueComp[];
  SD: number | null; SDreq: number;
  N: number | null; SZ: number | null;
  /** rechnerische Lebensdauer (S = 1); Infinity = dauerfest */
  Nlife: number | null;
  steps: CalcStep[];
}

const ROLOFF = "Roloff/Matek 27";
const COMPS: LoadComp[] = ["zd", "b", "t"];
const DBPROP: Record<LoadComp, string> = { zd: "P-SZDW", b: "P-SBW", t: "P-TTW" };
const SYM: Record<LoadComp, string> = { zd: "σ_zd", b: "σ_b", t: "τ_t" };
const SUF: Record<LoadComp, string> = { zd: "Z", b: "B", t: "T" };
const N_D = 1e6, N_DII = 1e8, K_SIG = 5, K_TAU = 8, K2_SIG = 15, K2_TAU = 25;

/** Kleinster Wert einer Kennwertzeile (Bereich → Untergrenze). */
function lowerOf(r: PropertyValueJson | null): number | null {
  if (!r) return null;
  return r.value ?? r.value_min ?? r.value_max ?? null;
}
/** Überlebenswahrscheinlichkeit aus der Bedingung (Pflichtformat WDB 1.1), null = keine Angabe. */
export function pOfCondition(cond: string | null): number | null {
  const m = /P = ([0-9]+(?:,[0-9]+)?) %/.exec(cond ?? "");
  return m ? Number(m[1]!.replace(",", ".")) : null;
}

/** Bauteil-Wöhlerlinie σ_AK(N) einer Komponente (Typ I bzw. II, Begrenzung durch die statische Grenze). */
function akOf(fc: FatigueComp, N: number, typ: "I" | "II"): number {
  const k1 = fc.c === "t" ? K_TAU : K_SIG, k2 = fc.c === "t" ? K2_TAU : K2_SIG, GA = fc.GA!;
  let v = N < N_D ? GA * (N_D / N) ** (1 / k1) : typ === "I" ? GA : GA * (N_D / Math.min(N, N_DII)) ** (1 / k2);
  if (fc.limit !== null && v + fc.sm > fc.limit) v = Math.max(0, fc.limit - fc.sm);
  return v;
}

export interface WoehlerSeries {
  c: LoadComp;
  /** σ_AK über N (logarithmisch verteilt von 10³ bis N_max) */
  pts: { N: number; s: number }[];
  /** Ausschlagspannung σ_a der Komponente (Betriebspunkt) */
  sa: number;
  GA: number;
}
export interface WoehlerChart {
  typ: "I" | "II";
  ND: number;
  Nmin: number;
  Nmax: number;
  series: WoehlerSeries[];
  /** geforderte Lastspielzahl (null = Dauerfestigkeit) und rechnerische Lebensdauer */
  N: number | null;
  Nlife: number | null;
}

/** Daten für das Wöhlerdiagramm in Blatt 3; rechnet mit derselben Wöhlerlinie wie der Nachweis (E-WL1, E-WL2). */
export function woehlerChart(res: FatigueResult, nPts = 121): WoehlerChart | null {
  if (!res.ok) return null;
  const Nmin = 1e3, Nmax = res.woehler === "I" ? 1e7 : 1e9;
  const series = res.comps.filter((fc) => fc.sa > 1e-12 && fc.GA !== null && fc.GA > 0).map((fc) => ({
    c: fc.c, sa: fc.sa, GA: fc.GA!,
    pts: Array.from({ length: nPts }, (_, i) => { const N = Nmin * (Nmax / Nmin) ** (i / (nPts - 1)); return { N, s: akOf(fc, N, res.woehler) }; }),
  }));
  return { typ: res.woehler, ND: N_D, Nmin, Nmax, series, N: res.N, Nlife: res.Nlife };
}

export interface FatigueContext {
  repo: Repo;
  mat: Material;
  sec: SectionProps;
  secType: SecType;
  dims: Dims;
  L: number;
  kind: "zug" | "biegung" | "torsion" | "combined";
  /** Schnittgrößen als Funktion von x (N, N·mm) aus Blatt 1 */
  Nx: ((x: number) => number) | null;
  Mx: ((x: number) => number) | null;
  Tx: ((x: number) => number) | null;
  /** Ort des größten |M_b| aus Blatt 1 */
  xM: number | null;
  /** Ort der größten |N| (Zug mit Eigengewicht: Einspannung x = 0) */
  RpN: number | null;
  dvRM: { choice: Parameters<typeof designValue>[3]; manual: number | null };
}

export function computeFatigue(ctx: FatigueContext, inp: FatigueInput): FatigueResult {
  const steps: CalcStep[] = [];
  const add = (s: CalcStep) => steps.push(s);
  const res: FatigueResult = {
    ok: false, errors: [], warnings: [], group: null, groupLabel: "", woehler: "I", xK: 0, notch: null, d: null, dEff: NaN, Kt: 1, Ktp: 1,
    RmN: null, Rm: null, Rp: null, smv: 0, tmv: 0, comps: [], SD: null, SDreq: NaN, N: inp.N, SZ: null, Nlife: null, steps,
  };
  const { repo, mat, sec, secType, dims, L } = ctx;
  const gc = fatigueGroupOf(mat);
  if (!gc) { res.errors.push(`${mat.cls}: Dauerfestigkeitsnachweis nur für Metalle (Polymere und Verbund nicht unterstützt)`); return res; }
  const grp = gc.group;
  res.group = grp.id; res.groupLabel = grp.label; res.woehler = woehlerType(gc);
  if (gc.note) res.warnings.push(gc.note);

  // ---------- Kerbstelle und Schnittgrößen
  const xK = inp.xK ?? ctx.xM ?? 0;
  if (!(xK >= 0 && xK <= L)) { res.errors.push(`Kerbstelle x_K = ${fmt(xK)} mm außerhalb 0 … ${fmt(L)} mm`); return res; }
  res.xK = xK;
  const Nf = ctx.Nx ? ctx.Nx(xK) : 0, Mf = ctx.Mx ? ctx.Mx(xK) : 0, Tf = ctx.Tx ? ctx.Tx(xK) : 0;
  add(step("E-X-SG", "Schnittgrößen an der Kerbstelle (Oberlast)", "N(x_K), M_b(x_K), T(x_K) aus dem Blatt-1-Lastfall", `x_K = ${fmt(xK)} mm: N = ${fmt(Nf)} N, M_b = ${fmt(Mf)} N·mm, T = ${fmt(Tf)} N·mm`, xK, "mm", inp.xK === null ? "Vorgabe: Stelle des größten Biegemoments" : "Eingabe"));

  // ---------- Geometrie
  const round = secType === "rund_voll" || secType === "rund_hohl";
  const Dsec = round ? (dims["D"] ?? NaN) : NaN;
  const di = secType === "rund_hohl" ? Dsec - 2 * (dims["t"] ?? 0) : 0;
  const nt = inp.notch;
  let geom: NotchGeom | null = null;
  if (nt.type === "absatz" || nt.type === "nut" || nt.type === "bohrung") {
    if (!round) { res.errors.push("Kerbformeln (Absatz, Nut, Querbohrung) nur für Rund voll und Rund hohl; sonst α_k oder β_k manuell"); return res; }
    if (nt.type === "absatz") {
      if (!(nt.D > Dsec)) { res.errors.push(`Absatz: D = ${fmt(nt.D)} mm muss größer als der Blatt-1-Durchmesser d = ${fmt(Dsec)} mm sein`); return res; }
      geom = { kind: "absatz", d: Dsec, D: nt.D, t: (nt.D - Dsec) / 2, r: nt.r };
    } else if (nt.type === "nut") {
      const d = Dsec - 2 * nt.t;
      if (!(nt.t > 0) || !(d > di)) { res.errors.push(`Umlaufnut: Nuttiefe t = ${fmt(nt.t)} mm unzulässig (Kerbgrund d = ${fmt(d)} mm, Innendurchmesser ${fmt(di)} mm)`); return res; }
      geom = { kind: "nut", d, D: Dsec, t: nt.t, r: nt.r };
    } else {
      if (secType === "rund_hohl") { res.errors.push("Querbohrung nur für Rund voll (TB 3-6e)"); return res; }
      if (!(nt.dB > 0)) { res.errors.push("Querbohrung: Bohrungsdurchmesser muss größer als 0 sein"); return res; }
      geom = { kind: "bohrung", d: Dsec, D: Dsec, t: nt.dB / 2, r: nt.dB / 2 };
    }
  }
  res.notch = geom;
  const d = round ? (geom ? geom.d : Dsec) : null;
  res.d = d;

  // ---------- Nennspannungen
  const force: Record<LoadComp, number> = { zd: Nf, b: Mf, t: Tf };
  const sn: Partial<Record<LoadComp, number>> = {};
  for (const c of COMPS) {
    const F = force[c];
    if (Math.abs(F) <= 1e-12) continue;
    let v: number;
    if (geom?.kind === "bohrung") {
      const dB = 2 * geom.r, dd = geom.d;
      const den = c === "zd" ? Math.PI * dd * dd / 4 - dB * dd : c === "b" ? Math.PI * dd ** 3 / 32 - dB * dd * dd / 6 : Math.PI * dd ** 3 / 16 - dB * dd * dd / 6;
      v = F / den;
      const f = { zd: "σ_n = F_N / A_n  mit  A_n = π·d²/4 − d_B·d", b: "σ_n = M_b / W_b,n  mit  W_b,n = π·d³/32 − d_B·d²/6", t: "τ_n = T / W_t,n  mit  W_t,n = π·d³/16 − d_B·d²/6" }[c];
      const wn = { zd: "A_n", b: "W_b,n", t: "W_t,n" }[c];
      add(step(`E-NS-Q${SUF[c]}`, `Nennspannung Querbohrung, ${COMP_LABEL[c]}`, f, `${wn} = ${fmt(den)}  (d = ${fmt(dd)}, d_B = ${fmt(dB)} mm);  ${fmt(F)} / ${fmt(den)}`, v, "MPa", `${ROLOFF} TB 3-6e`));
    } else if (round && d !== null) {
      const den = c === "zd" ? Math.PI * (d * d - di * di) / 4 : c === "b" ? Math.PI * (d ** 4 - di ** 4) / (32 * d) : Math.PI * (d ** 4 - di ** 4) / (16 * d);
      v = F / den;
      const f = { zd: "σ_n = 4·F_N / (π·(d² − d_i²))", b: "σ_n = 32·M_b·d / (π·(d⁴ − d_i⁴))", t: "τ_n = 16·T·d / (π·(d⁴ − d_i⁴))" }[c];
      add(step(`E-NS-${SUF[c]}`, `Nennspannung im Kerbquerschnitt, ${COMP_LABEL[c]}`, f, `${fmt(F)} / ${fmt(den)}  (d = ${fmt(d)}, d_i = ${fmt(di)} mm)`, v, "MPa", `${ROLOFF} TB 3-6c, d`));
    } else {
      const den = c === "zd" ? sec.A : c === "b" ? sec.W : sec.Wt;
      v = F / den;
      add(step("E-NS-X", `Nennspannung (Querschnitt Blatt 1), ${COMP_LABEL[c]}`, "σ_n = F_N/A, M_b/W bzw. T/Wₜ (Querschnittswerte Blatt 1)", `${fmt(F)} / ${fmt(den)}`, v, "MPa"));
    }
    sn[c] = v;
  }
  const present = COMPS.filter((c) => sn[c] !== undefined);
  if (!present.length) { res.errors.push("Keine Beanspruchung an der Kerbstelle"); return res; }

  // ---------- Lastzyklus
  const cmp: Partial<Record<LoadComp, FatigueComp>> = {};
  for (const c of present) {
    const R = inp.R[c];
    if (!(R >= -1 && R <= 1)) { res.errors.push(`${COMP_LABEL[c]}: Lastverhältnis R = ${R} außerhalb −1 … 1`); return res; }
    const smax = Math.abs(sn[c]!), sa = smax * (1 - R) / 2, sm = smax * (1 + R) / 2;
    add(step("E-AM", `Ausschlag und Mittelspannung, ${COMP_LABEL[c]}`, "σ_a = |σ_n|·(1 − R)/2,  σ_m = |σ_n|·(1 + R)/2  (Oberlast aus Blatt 1, Mittelspannung als Betrag)", `|σ_n| = ${fmt(smax)} MPa, R = ${fmt(R)}: σ_m = ${fmt(sm)} MPa`, sa, "MPa", `${ROLOFF} Abschn. 3.2`));
    cmp[c] = { c, sn: sn[c]!, R, sa, sm, alpha: null, G: null, n: null, beta: 1, Kg: 1, KR: 1, KD: 1, WN: null, WNsrc: "", W: null, GW: null, psi: 0, GA: null, S: null, AK: null, limit: null };
  }
  const active = present.filter((c) => cmp[c]!.sa > 1e-12);
  if (!active.length) { res.errors.push("Kein Spannungsausschlag (R = 1 für alle Beanspruchungen): statischer Nachweis in Blatt 1 genügt"); return res; }
  const ms = (c: LoadComp) => cmp[c]?.sm ?? 0;
  const smv = Math.sqrt((ms("zd") + ms("b")) ** 2 + 3 * ms("t") ** 2);
  const tmv = grp.fTau * smv;
  res.smv = smv; res.tmv = tmv;
  if (smv > 0) {
    add(step("E-MV", "Vergleichsmittelspannung (GEH)", "σ_mv = √((σ_zdm + σ_bm)² + 3·τ_tm²)", `√((${fmt(ms("zd"))} + ${fmt(ms("b"))})² + 3·${fmt(ms("t"))}²)`, smv, "MPa", `${ROLOFF} Gl. 3.55`));
    if (cmp.t) add(step("E-MVT", "Vergleichsmittelspannung Schub", "τ_mv = f_τ·σ_mv", `${fmt(grp.fTau)}·${fmt(smv)}`, tmv, "MPa", `${ROLOFF} Gl. 3.56, TB 3-2`));
  }

  // ---------- Werkstoff, technologischer Größeneinfluss
  const rowRm = designValue(repo, mat, "P-RM", ctx.dvRM.choice, ctx.dvRM.manual);
  const RmN = rowRm?.v ?? null, RpN = ctx.RpN;
  res.RmN = RmN;
  if (RmN === null) { res.errors.push("R_m nicht belegt: Ermüdungsnachweis braucht die Zugfestigkeit"); return res; }
  const fam = gc.kt;
  let dEff: number, dEffText: string;
  if (inp.dEff !== null) { dEff = inp.dEff; dEffText = "Eingabe"; }
  else {
    const f2 = deffFamily(fam) === 2;
    const tt = (x: number) => (f2 ? 2 * x : x);
    switch (secType) {
      case "rund_voll": dEff = geom?.kind === "absatz" ? geom.D : Dsec; dEffText = "Rund: d_eff = größter Durchmesser"; break;
      case "rund_hohl": dEff = tt(dims["t"] ?? NaN); dEffText = f2 ? "Ring: d_eff = 2·t" : "Ring: d_eff = t"; break;
      case "rechteck_voll": { const a = Math.min(dims["b"] ?? NaN, dims["h"] ?? NaN), b = Math.max(dims["b"] ?? NaN, dims["h"] ?? NaN); dEff = f2 ? 2 * a * b / (a + b) : a; dEffText = f2 ? "Rechteck: d_eff = 2·b·t/(b + t)" : "Rechteck: d_eff = t (kleinere Seite)"; break; }
      case "rechteck_hohl": case "dreieck_hohl": dEff = tt(dims["t"] ?? NaN); dEffText = f2 ? "Hohlprofil: d_eff = 2·t" : "Hohlprofil: d_eff = t"; break;
      case "l_profil": dEff = tt(dims["t"] ?? NaN); dEffText = f2 ? "Profil: d_eff = 2·t" : "Profil: d_eff = t"; break;
      case "dreieck_voll": dEff = sectionHeight(secType, dims); dEffText = "Dreieck: d_eff = Höhe (Näherung)"; res.warnings.push("Dreieck voll: d_eff als Höhe angenommen (nicht in TB 3-10c)"); break;
      default: dEff = tt(Math.max(dims["tw"] ?? 0, dims["tf"] ?? 0)); dEffText = f2 ? "Profil: d_eff = 2·max(t_w, t_f)" : "Profil: d_eff = max(t_w, t_f)"; break;
    }
  }
  res.dEff = dEff;
  add(step("E-DEFF", "Maßgebender Durchmesser für den technologischen Größeneinfluss", "d_eff nach Querschnittsform und Werkstoffart (Roloff TB 3-10c)", dEffText, dEff, "mm", `${ROLOFF} TB 3-10c`));
  let Kt: number, Ktp: number;
  if (inp.Kt !== null) {
    Kt = Ktp = inp.Kt;
    add(step("E-KT-M", "Technologischer Größeneinfluss (manuell)", "K_t manuell (gilt für R_m und R_p)", `K_t = ${fmt(inp.Kt)}`, Kt, "–", "Eingabe"));
  } else {
    const km = ktValue(fam, "m", dEff);
    Kt = km.Kt; add(step(km.id, "Technologischer Größeneinfluss (Zugfestigkeit)", km.formula, km.subst, Kt, "–", `${ROLOFF} TB 3-10a, b`));
    if (km.note) res.warnings.push(km.note);
    const kp = ktValue(fam, "p", dEff);
    Ktp = kp.Kt;
    if (RpN !== null && (kp.id !== km.id || kp.Kt !== km.Kt)) add(step(kp.id, "Technologischer Größeneinfluss (Streckgrenze)", kp.formula, kp.subst, Ktp, "–", `${ROLOFF} TB 3-10a, b`));
  }
  res.Kt = Kt; res.Ktp = Ktp;
  const Rm = Kt * RmN, Rp = RpN !== null ? Ktp * RpN : null;
  res.Rm = Rm; res.Rp = Rp;
  add(step("E-RM", "Zugfestigkeit im Bauteil", "R_m = K_t·R_mN", `${fmt(Kt)}·${fmt(RmN)}`, Rm, "MPa", `${ROLOFF} Gl. 3.39`));
  if (Rp !== null && RpN !== null) add(step("E-RP", "Streckgrenze im Bauteil", "R_p = K_t·R_pN", `${fmt(Ktp)}·${fmt(RpN)}`, Rp, "MPa", `${ROLOFF} Gl. 3.40`));
  if (inp.Kt === null && /d\s*[≤<]|<\s*d|dicke|t\s*[≤<]/i.test(rowRm?.cond ?? "") && Kt < 1) res.warnings.push(`R_mN gilt laut Datenbank für „${rowRm?.cond}“; K_t mindert zusätzlich. Bei Festigkeit für den Bauteildurchmesser K_t = 1 setzen`);

  // ---------- Wechselfestigkeit der Normprobe
  const rowSch = repo.row(mat.id, "P-SZSCH");
  const kg1: Partial<Record<LoadComp, boolean>> = {};
  for (const c of active) {
    const fc = cmp[c]!;
    const man = inp.sigmaW[c];
    if (man !== null && man > 0) {
      fc.WN = man; fc.WNsrc = "manuell";
      add(step("E-W-M", `Wechselfestigkeit Normprobe (manuell), ${COMP_LABEL[c]}`, "σ_WN manuell", `${SYM[c]}WN = ${fmt(man)} MPa`, man, "MPa", "Eingabe"));
      res.warnings.push(`${COMP_LABEL[c]}: Wechselfestigkeit manuell gesetzt`);
      continue;
    }
    const row = repo.row(mat.id, DBPROP[c]);
    const vDb = lowerOf(row);
    const p = row ? pOfCondition(row.condition) : null;
    if (row && vDb !== null) add(step("E-W-DB", `Wechselfestigkeit aus der Werkstoffdatenbank, ${COMP_LABEL[c]}`, "σ_WN = Kennwert der Standardvariante (P-SZDW, P-SBW, P-TTW; Bereich: unterer Wert)", `${DBPROP[c]}: ${fmt(vDb)} MPa (${row.condition ?? "ohne Bedingung"})`, vDb, "MPa", repo.sourceName(row.source_id)));
    let vEst: number | null = null;
    if (grp.steel) {
      const f = { zd: 0.4, b: 0.5, t: 0.3 }[c];
      vEst = f * RmN;
      add(step(`E-W-EST-${SUF[c]}`, `Wechselfestigkeit Normprobe, Abschätzung Stahl, ${COMP_LABEL[c]}`, `${SYM[c]}WN ≈ ${String(f).replace(".", ",")}·R_mN`, `${String(f).replace(".", ",")}·${fmt(RmN)}`, vEst, "MPa", `${ROLOFF} Fußnote 13 (DIN 743)`));
    } else if (grp.fWs) {
      const fw = grp.fWs(RmN), zd = fw * RmN;
      vEst = c === "t" ? grp.fTau * zd : zd;
      const f = { zd: "σ_zdWN = f_Wσ·R_mN (f_Wσ nach Werkstoffgruppe)", b: "σ_bWN = σ_zdWN = f_Wσ·R_mN (ohne Biegeanteil, dann K_g = 1)", t: "τ_tWN = f_Wτ·f_Wσ·R_mN (dann K_g = 1)" }[c];
      add(step(`E-W-ESTG-${SUF[c]}`, `Wechselfestigkeit Normprobe, Abschätzung ${grp.label}, ${COMP_LABEL[c]}`, f, (c === "t" ? `${fmt(grp.fTau)}·${fmt(fw)}·${fmt(RmN)}` : `${fmt(fw)}·${fmt(RmN)}`) + `  (${grp.label}: f_Wσ = ${grp.fWsText}, f_Wτ = ${fmt(grp.fTau)})`, vEst, "MPa", `${ROLOFF} TB 3-2, Gl. 3.34, 3.35`));
    }
    if (vDb !== null && vEst !== null && (p === null || p < 97.5)) {
      const v = Math.min(vDb, vEst);
      fc.WN = v; fc.WNsrc = v === vDb ? `Datenbank (${repo.sourceName(row!.source_id)})` : "Abschätzung (kleiner als Datenbankwert)";
      if (v === vEst && !grp.steel && c !== "zd") kg1[c] = true;
      add(step("E-W-P50", `Wechselfestigkeit, Vergleich Mittelwert und Abschätzung, ${COMP_LABEL[c]}`, "σ_WN = min(Datenbankwert mit P < 97,5 % oder ohne Angabe, Abschätzung mit P_ü = 97,5 %)", `min(${fmt(vDb)}; ${fmt(vEst)})`, v, "MPa", "Konzept 0.9.0 E10"));
    } else if (vDb !== null) {
      fc.WN = vDb; fc.WNsrc = `Datenbank (${repo.sourceName(row!.source_id)})`;
      if (p === null || p < 97.5) res.warnings.push(`${COMP_LABEL[c]}: Datenbankwert ${p === null ? "ohne Überlebenswahrscheinlichkeit" : `mit P = ${fmt(p)} %`}, keine Abschätzung zum Vergleich`);
    } else if (vEst !== null) {
      fc.WN = vEst; fc.WNsrc = "Abschätzung aus R_m";
      if (!grp.steel && c !== "zd") kg1[c] = true;
    } else {
      res.errors.push(`${COMP_LABEL[c]}: keine Wechselfestigkeit (Datenbank leer, keine Abschätzung für ${grp.label}); bitte manuell eingeben`);
    }
  }
  if (res.errors.length) { res.comps = present.map((c) => cmp[c]!); return res; }
  for (const c of active) {
    const fc = cmp[c]!;
    fc.W = Kt * fc.WN!;
    add(step("E-W-KT", `Wechselfestigkeit im Bauteil, ${COMP_LABEL[c]}`, "σ_W = K_t·σ_WN", `${fmt(Kt)}·${fmt(fc.WN!)}`, fc.W, "MPa", `${ROLOFF} Gl. 3.41 bis 3.44`));
  }

  // ---------- Kerbwirkung
  if (geom && geom.kind !== "bohrung") {
    const phi = phiOf(geom);
    if (active.some((c) => c !== "t")) add(step("E-PHI", "Hilfsgröße für das Spannungsgefälle", "φ = 1/(√(8·(D − d)/r) + 2) für (D − d)/d ≤ 0,5, sonst φ = 0", `D = ${fmt(geom.D)}, d = ${fmt(geom.d)}, r = ${fmt(geom.r)} mm`, phi, "–", `${ROLOFF} TB 3-7a`));
  }
  for (const c of active) {
    const fc = cmp[c]!;
    if (geom) {
      const a = alphaK(geom, c);
      if (a.errors.length) { res.errors.push(...a.errors); continue; }
      add(step(a.id, `Formzahl, ${COMP_LABEL[c]}`, a.formula, a.subst, a.alpha, "–", a.ref));
      const gr = gradientOf(geom, c);
      add(step(gr.id, `Bezogenes Spannungsgefälle, ${COMP_LABEL[c]}`, gr.formula, gr.subst, gr.G, "1/mm", `${ROLOFF} TB 3-7a`));
      fc.alpha = a.alpha; fc.G = gr.G;
    } else if (nt.type === "alpha") {
      const a = nt.alpha[c];
      fc.alpha = a !== undefined && a >= 1 ? a : 1;
      if (a === undefined) res.warnings.push(`${COMP_LABEL[c]}: keine Formzahl angegeben, α_k = 1`);
      add(step("E-AK-M", `Formzahl (manuell), ${COMP_LABEL[c]}`, "α_k manuell (Quelle angeben)", `α_k = ${fmt(fc.alpha)}${nt.ref ? ` (${nt.ref})` : ""}`, fc.alpha, "–", "Eingabe"));
      const gm = nt.G?.[c];
      if (gm !== undefined && gm > 0) { fc.G = gm; add(step("E-GS-M", `Bezogenes Spannungsgefälle (manuell), ${COMP_LABEL[c]}`, "G′ manuell", `G′ = ${fmt(gm)} 1/mm`, gm, "1/mm", "Eingabe")); }
    }
    if (fc.alpha !== null) {
      if (fc.G !== null) {
        const sn_ = supportNumber(grp, fc.G, Rm);
        let nn = sn_.n;
        add(step(sn_.id, `Stützzahl, ${COMP_LABEL[c]}`, sn_.formula, `G′ = ${fmt(fc.G)} 1/mm, R_m = ${fmt(Rm)} MPa, a_G = ${fmt(grp.aG)}, b_G = ${fmt(grp.bG)} MPa`, nn, "–", `${ROLOFF} TB 3-7b; Steibler 2021 Anh. A8`));
        if (nn > fc.alpha) { nn = fc.alpha; res.warnings.push(`${COMP_LABEL[c]}: n > α_k, n = α_k gesetzt`); }
        fc.n = nn;
      } else {
        fc.n = 1;
        add(step("E-N-0", `Stützzahl ohne Spannungsgefälle, ${COMP_LABEL[c]}`, "n = 1 (kein Spannungsgefälle bekannt, konservativ)", "Annahme", 1, "–"));
      }
      fc.beta = fc.alpha / fc.n;
      add(step("E-BETA", `Kerbwirkungszahl, ${COMP_LABEL[c]}`, "β_k = α_k / n", `${fmt(fc.alpha)} / ${fmt(fc.n)}`, fc.beta, "–", `${ROLOFF} Gl. 3.30`));
    } else if (nt.type === "beta") {
      const b = nt.beta[c];
      fc.beta = b !== undefined && b >= 1 ? b : 1;
      if (b === undefined) res.warnings.push(`${COMP_LABEL[c]}: keine Kerbwirkungszahl angegeben, β_k = 1`);
      add(step("E-BETA-M", `Kerbwirkungszahl (manuell), ${COMP_LABEL[c]}`, "β_k manuell (z. B. Passfeder Roloff TB 3-9)", `β_k = ${fmt(fc.beta)}${nt.ref ? ` (${nt.ref})` : ""}`, fc.beta, "–", "Eingabe"));
    }
  }
  if (res.errors.length) { res.comps = present.map((c) => cmp[c]!); return res; }

  // ---------- Größe, Rauheit, Konstruktionsfaktor
  const dK = d ?? sectionHeight(secType, dims);
  if (!round) res.warnings.push(`K_g mit d = Querschnittshöhe ${fmt(dK)} mm (Näherung, DIN 743 gilt für Rundstäbe)`);
  const kgv = kgValue(dK);
  if (active.some((c) => c !== "zd" && !kg1[c])) add(step("E-KG", "Geometrischer Größeneinfluss (Biegung, Torsion)", "K_g = 1 − 0,2·lg(d/7,5 mm)/lg 20 für 7,5 ≤ d < 150 mm; 0,8 ab 150 mm; 1 unter 7,5 mm; Zug/Druck K_g = 1", `d = ${fmt(dK)} mm`, kgv, "–", `${ROLOFF} TB 3-10d`));
  const KRs = krSigma(grp, inp.Rz, Rm);
  add(step("E-KR", "Einfluss der Oberflächenrauheit (Normalspannung)", "K_R,σ = 1 − a_R·lg(R_z/µm)·lg(2·R_m/R_m,N,min), höchstens 1", `a_R = ${fmt(grp.aR)}, R_z = ${fmt(inp.Rz)} µm, R_m = ${fmt(Rm)} MPa, R_m,N,min = ${fmt(grp.RmNmin)} MPa`, KRs, "–", `Steibler 2021 Anh. A11; für Stahl gleich ${ROLOFF} TB 3-11`));
  const KRt = 1 - grp.fTau * (1 - KRs);
  if (cmp.t) add(step("E-KRT", "Einfluss der Oberflächenrauheit (Schub)", "K_R,τ = 1 − f_τ·(1 − K_R,σ)", `1 − ${fmt(grp.fTau)}·(1 − ${fmt(KRs)})`, KRt, "–", "FKM-Form; Stahl wie 0,575·K_Oσ + 0,425"));
  for (const c of active) {
    const fc = cmp[c]!;
    fc.Kg = c === "zd" || kg1[c] ? 1 : kgv;
    fc.KR = c === "t" ? KRt : KRs;
    fc.KD = fc.beta / fc.Kg + 1 / fc.KR - 1;
    add(step("E-KD", `Konstruktionsfaktor, ${COMP_LABEL[c]}`, "K_D = (β_k/K_g + 1/K_R − 1)/K_V,  K_V = 1", `(${fmt(fc.beta)}/${fmt(fc.Kg)} + 1/${fmt(fc.KR)} − 1)/1`, fc.KD, "–", `${ROLOFF} Gl. 3.45 bis 3.48`));
    fc.GW = fc.W! / fc.KD;
    add(step("E-GW", `Gestaltwechselfestigkeit, ${COMP_LABEL[c]}`, "σ_GW = σ_W / K_D", `${fmt(fc.W!)} / ${fmt(fc.KD)}`, fc.GW, "MPa", `${ROLOFF} Gl. 3.53, 3.54`));
    if (fc.alpha !== null && Rp !== null && fc.alpha * Math.abs(fc.sn) > (c === "t" ? grp.fTau * Rp : Rp)) res.warnings.push(`${COMP_LABEL[c]}: Kerbspannung α_k·|σ_n| = ${fmt(fc.alpha * Math.abs(fc.sn), 3)} MPa über der Fließgrenze (örtliches Fließen, Nennspannungskonzept gilt weiter)`);
    if (fc.alpha !== null) add(step("E-KSP", `Kerbspannung unter Oberlast (Information), ${COMP_LABEL[c]}`, "σ_max,K = α_k·|σ_n|", `${fmt(fc.alpha)}·${fmt(Math.abs(fc.sn))}`, fc.alpha * Math.abs(fc.sn), "MPa", `${ROLOFF} Gl. 3.26`));
  }

  // ---------- Mittelspannung
  const rowZd = repo.row(mat.id, "P-SZDW");
  let psi: number;
  if (rowSch && rowZd && lowerOf(rowSch) && lowerOf(rowZd) && rowSch.source_id === rowZd.source_id) {
    const zd = lowerOf(rowZd)!, sch = lowerOf(rowSch)!;
    psi = Math.max(0, 2 * zd / sch - 1);
    add(step("E-PSI-DB", "Mittelspannungsempfindlichkeit aus der Schwellfestigkeit", "ψ_σ = 2·σ_zdW/σ_zSch − 1", `2·${fmt(zd)}/${fmt(sch)} − 1`, psi, "–", repo.sourceName(rowSch.source_id)));
  } else {
    psi = Math.max(0, grp.aM * Rm + grp.bM);
    add(step("E-PSI", "Mittelspannungsempfindlichkeit", "ψ_σ = a_M·R_m + b_M", `${fmt(grp.aM)}·${fmt(Rm)} + (${fmt(grp.bM)})`, psi, "–", `${ROLOFF} Gl. 3.59, TB 3-15; Steibler 2021 Anh. A14`));
  }
  const psiT = grp.fTau * psi;
  if (cmp.t) add(step("E-PSIT", "Mittelspannungsempfindlichkeit Schub", "ψ_τ = f_τ·ψ_σ", `${fmt(grp.fTau)}·${fmt(psi)}`, psiT, "–", `${ROLOFF} Gl. 3.60`));

  // ---------- Gestaltausschlagfestigkeit, Sicherheit
  const limStat = Rp ?? Rm;
  for (const c of active) {
    const fc = cmp[c]!;
    const ps = c === "t" ? psiT : psi, mv = c === "t" ? tmv : smv, sa = fc.sa, GW = fc.GW!;
    fc.psi = ps;
    let GA: number, id: string, f: string, s: string;
    if (inp.overload === 1) { GA = GW - ps * mv; id = "E-GA1"; f = "σ_GA = σ_GW − ψ·σ_mv  (Überlastungsfall 1, σ_m konstant)"; s = `${fmt(GW)} − ${fmt(ps)}·${fmt(mv)}`; }
    else if (inp.overload === 2) { GA = GW / (1 + ps * mv / sa); id = "E-GA2"; f = "σ_GA = σ_GW / (1 + ψ·σ_mv/σ_a)  (Überlastungsfall 2, κ konstant)"; s = `${fmt(GW)} / (1 + ${fmt(ps)}·${fmt(mv)}/${fmt(sa)})`; }
    else { GA = (GW - ps * (mv - sa)) / (1 + ps); id = "E-GA3"; f = "σ_GA = (σ_GW − ψ·σ_u) / (1 + ψ)  mit  σ_u = σ_mv − σ_a  (Überlastungsfall 3, Unterspannung σ_u konstant)"; s = `σ_u = ${fmt(mv)} − ${fmt(sa)} = ${fmt(mv - sa)};  (${fmt(GW)} − ${fmt(ps)}·${fmt(mv - sa)}) / (1 + ${fmt(ps)})`; }
    add(step(id, `Gestaltausschlagfestigkeit, ${COMP_LABEL[c]}`, f, s, GA, "MPa", `${ROLOFF} Gl. 3.61 bis 3.66`));
    const lim = c === "t" ? grp.fTau * limStat : limStat;
    fc.limit = lim;
    if (GA + fc.sm > lim) {
      const g2 = Math.max(0, lim - fc.sm);
      add(step("E-GA-F", `Begrenzung durch Fließen, ${COMP_LABEL[c]}`, "σ_GA ≤ R_p − σ_m (Schub: f_τ·R_p − τ_m; spröde: R_m)", `${fmt(lim)} − ${fmt(fc.sm)}`, g2, "MPa", `${ROLOFF} Hinweis zu Gl. 3.65`));
      res.warnings.push(`${COMP_LABEL[c]}: Gestaltausschlagfestigkeit durch die Fließgrenze begrenzt`);
      GA = g2;
    }
    if (GA <= 0) { res.errors.push(`${COMP_LABEL[c]}: keine ertragbare Amplitude (Mittelspannung zu hoch)`); fc.GA = 0; continue; }
    fc.GA = GA; fc.S = GA / sa;
    add(step("E-SD", `Sicherheit gegen Dauerbruch, ${COMP_LABEL[c]}`, "S = σ_GA / σ_a", `${fmt(GA)} / ${fmt(sa)}`, fc.S, "–", `${ROLOFF} Abschn. 3.7`));
  }
  res.comps = present.map((c) => cmp[c]!);
  const SDreq = inp.SDreq ?? sdRequired(gc, inp.castTested);
  res.SDreq = SDreq;
  add(step("E-SDERF", "Erforderliche Sicherheit gegen Dauerbruch", "S_D,erf = 1,5 (Walz- und Schmiedewerkstoff), 2,1 (Guss), 1,9 (Guss zerstörungsfrei geprüft) oder Eingabe", inp.SDreq !== null ? "Eingabe" : gc.cast ? (inp.castTested ? "Guss, zerstörungsfrei geprüft" : "Guss, nicht geprüft") : "Walz- oder Schmiedewerkstoff", SDreq, "–", `${ROLOFF} TB 3-16a`));
  if (res.errors.length) return res;
  const combine = (amp: (fc: FatigueComp) => number | null): number => {
    const q = (c: LoadComp) => { const fc = cmp[c]; if (!fc || !(fc.sa > 1e-12)) return 0; const A = amp(fc); return A && A > 0 ? fc.sa / A : Infinity; };
    const s1 = q("zd") + q("b"), s2 = q("t");
    return 1 / Math.sqrt(s1 * s1 + s2 * s2);
  };
  const SD = combine((fc) => fc.GA);
  res.SD = SD;
  if (active.length > 1) add(step("E-SDV", "Sicherheit gegen Dauerbruch, zusammengesetzt", "S_D = 1/√((1/S_zd + 1/S_b)² + (1/S_t)²)  mit  S_i = σ_iGA/σ_ia  (= 1/√((σ_zda/σ_zdGA + σ_ba/σ_bGA)² + (τ_ta/τ_tGA)²); Normalspannungen phasengleich, Maximum an derselben Stelle)", active.map((c) => `S_${c} = ${fmt(cmp[c]!.GA!)}/${fmt(cmp[c]!.sa)} = ${fmt(cmp[c]!.S!)}`).join(", "), SD, "–", `${ROLOFF} Gl. 3.90`));

  // ---------- Zeitfestigkeit
  const typ = res.woehler;
  const ak = (fc: FatigueComp, N: number): number => akOf(fc, N, typ);
  const SZat = (N: number) => combine((fc) => ak(fc, N));
  if (inp.N !== null) {
    if (!(inp.N >= 1e3)) { res.errors.push(`Lastspielzahl N = ${inp.N} unter 10³ (Kurzzeitfestigkeit nicht abgedeckt)`); return res; }
    for (const c of active) {
      const fc = cmp[c]!; fc.AK = ak(fc, inp.N);
      const f = typ === "I"
        ? "σ_AK = σ_GA·(N_D/N)^(1/k) für N < N_D, sonst σ_GA;  N_D = 10⁶, k_σ = 5, k_τ = 8 (Typ I)"
        : "σ_AK = σ_GA·(N_D/N)^(1/k) für N < N_D; σ_GA·(N_D/N)^(1/k_II) bis 10⁸, danach konstant;  N_D = 10⁶, k_σ = 5, k_τ = 8, k_II,σ = 15, k_II,τ = 25 (Typ II)";
      add(step(typ === "I" ? "E-WL1" : "E-WL2", `Bauteil-Wöhlerlinie, ${COMP_LABEL[c]}`, f, `σ_GA = ${fmt(fc.GA!)} MPa, N = ${fmt(inp.N)}`, fc.AK, "MPa", "Steibler 2021 Anh. A6 (FKM Tab. 4.4.3); Roloff Bsp. 3.5"));
    }
    res.SZ = SZat(inp.N);
    add(step("E-SZ", "Sicherheit bei der geforderten Lastspielzahl", "S_Z = 1/√((1/S_Z,zd + 1/S_Z,b)² + (1/S_Z,t)²)  mit  S_Z,i = σ_iAK/σ_ia  (= 1/√((σ_zda/σ_zdAK + σ_ba/σ_bAK)² + (τ_ta/τ_tAK)²))", `N = ${fmt(inp.N)}`, res.SZ, "–", `${ROLOFF} Gl. 3.90 mit σ_AK`));
  }
  // rechnerische Lebensdauer (S = 1): Bisektion auf lg N, monoton fallend
  const lgMax = typ === "I" ? Math.log10(N_D) : Math.log10(N_DII);
  if (SZat(10 ** lgMax) >= 1) res.Nlife = Infinity;
  else if (SZat(1e3) < 1) { res.Nlife = 1e3; res.warnings.push("Rechnerische Lebensdauer unter 10³ Lastspielen (Kurzzeitfestigkeit, nicht abgedeckt)"); }
  else {
    let lo = 3, hi = lgMax;
    for (let i = 0; i < 100 && hi - lo > 1e-12; i++) { const m = (lo + hi) / 2; if (SZat(10 ** m) >= 1) lo = m; else hi = m; }
    res.Nlife = 10 ** lo;
    add(step("E-NZ", "Rechnerische Lebensdauer (Sicherheit 1)", "N mit S_Z(N) = 1, Bisektion auf lg N zwischen 10³ und 10⁶ (Typ I) bzw. 10⁸ (Typ II)", `S_D = ${fmt(SD)}`, res.Nlife, "–"));
  }
  res.ok = true;
  return res;
}
