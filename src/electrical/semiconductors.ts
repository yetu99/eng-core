/**
 * Halbleitermodelle (Modul elektrik, EL-H, ab 0.21.0, Konzept etechnik/konzept_v1_1.md Abschn. 3.1).
 *
 * Reine Funktionen ohne Netzbezug: Kennlinie, Ableitungen, Parameter aus Datenblattpunkten, Spannungsbegrenzung.
 * Konventionen:
 *  - SI: V, A, S, W. Sperrschichttemperatur fest 25 °C (E-v11-2), U_T = k · T / q mit k, q exakt (CODATA 2018).
 *  - Diode, LED, Z-Diode: U = u_Anode − u_Kathode, I von Anode nach Kathode (Verbraucherzählpfeil, EL-E1).
 *  - Bipolartransistor: Ebers-Moll-Transportmodell (E-v11-3), Klemmenströme positiv in das Bauteil hinein.
 *    PNP mit gespiegelten Spannungen und Strömen (EL-H12).
 *  - N-MOSFET: Shichman-Hodges Level 1, λ = 0, symmetrisch, ohne Body-Diode (E-v11-4).
 *  - Exponent über x_max = 80 linear fortgesetzt (EL-H05), damit keine Überläufe entstehen.
 * Quellen: Tietze, Schenk, Gamm (Diode, Bipolartransistor, FET); Ebers, Moll (1954); Shichman, Hodges (1968);
 * Nagel (1975) SPICE2 (pnjlim, U_krit).
 */

/** Boltzmann-Konstante in J/K (exakt, SI 2019). */
export const K_BOLTZMANN = 1.380649e-23;
/** Elementarladung in C (exakt, SI 2019). */
export const Q_E = 1.602176634e-19;
/** Sperrschichttemperatur in K (25 °C, E-v11-2). */
export const T_JUNCTION = 298.15;
/** Temperaturspannung U_T = k · T / q in V (EL-H01), 25,6926 mV. */
export const U_T = (K_BOLTZMANN * T_JUNCTION) / Q_E;
/** Grenze der Exponentialfunktion (EL-H05). */
export const X_MAX = 80;

/** e^x mit linearer Fortsetzung über X_MAX (EL-H05): stetig und stetig differenzierbar. Rückgabe [Wert, Ableitung]. */
export function limexp(x: number): [number, number] {
  if (x <= X_MAX) { const e = Math.exp(x); return [e, e]; }
  const e = Math.exp(X_MAX);
  return [e * (1 + x - X_MAX), e];
}
/** true, wenn EL-H05 greift. */
export const limexpActive = (x: number): boolean => x > X_MAX;

// ---------------------------------------------------------------- Diode, LED, Z-Diode

export interface DiodeModel {
  /** Sättigungsstrom in A (EL-H03). */
  is: number;
  /** Emissionskoeffizient n. */
  n: number;
  /** Bahnwiderstand in Ω (EL-H04), 0 = kein innerer Knoten. */
  rs: number;
  /** Z-Durchbruch (EL-H06): Z-Spannung, Strom am Prüfpunkt, Emissionskoeffizient. */
  zener: { uz: number; izt: number; nz: number } | null;
}

/** Sättigungsstrom aus dem Datenblattpunkt U_F bei I_F (EL-H03). */
export function saturationCurrent(uf: number, iF: number, n: number, rs = 0): number {
  return iF / Math.expm1((uf - rs * iF) / (n * U_T));
}

export interface DiodeEval { i: number; g: number; limited: boolean }

/** Kennlinie und differentieller Leitwert der Sperrschicht bei U_j (EL-H02, EL-H06, EL-H07). */
export function diodeEval(m: DiodeModel, uj: number): DiodeEval {
  const nut = m.n * U_T;
  const x = uj / nut;
  const [e, de] = limexp(x);
  let i = m.is * (e - 1), g = (m.is * de) / nut, limited = limexpActive(x);
  if (m.zener) {
    const nzut = m.zener.nz * U_T, y = -(uj + m.zener.uz) / nzut;
    const [ez, dez] = limexp(y);
    i -= m.zener.izt * ez;
    g += (m.zener.izt * dez) / nzut;
    limited ||= limexpActive(y);
  }
  return { i, g, limited };
}

/** Kritische Spannung U_krit = n U_T · ln(n U_T / (√2 · I_S)) (EL-K04). */
export function criticalVoltage(is: number, nut: number): number {
  return nut * Math.log(nut / (Math.SQRT2 * is));
}

/**
 * pn-Spannungsbegrenzung nach SPICE2 (EL-K04): wenn U_neu > U_krit und |U_neu − U_alt| > 2 n U_T, wird der Schritt
 * logarithmisch gedämpft. Rückgabe [begrenzte Spannung, begrenzt?].
 */
export function pnjlim(vnew: number, vold: number, nut: number, vcrit: number): [number, boolean] {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * nut) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / nut;
      return [arg > 0 ? vold + nut * Math.log(arg) : vcrit, true];
    }
    return [nut * Math.log(vnew / nut), true];
  }
  return [vnew, false];
}

/** Begrenzung für Diode mit Z-Durchbruch: Durchlass über pnjlim, Durchbruch über pnjlim der verschobenen Spannung −(U + U_Z). */
export function diodeLimit(m: DiodeModel, vnew: number, vold: number): [number, boolean] {
  const nut = m.n * U_T;
  const [v1, l1] = pnjlim(vnew, vold, nut, criticalVoltage(m.is, nut));
  if (!m.zener || v1 >= 0) return [v1, l1];
  const nzut = m.zener.nz * U_T, crit = criticalVoltage(m.zener.izt, nzut);
  const [w, l2] = pnjlim(-(v1 + m.zener.uz), -(vold + m.zener.uz), nzut, crit);
  return [-(w + m.zener.uz), l1 || l2];
}

// ---------------------------------------------------------------- Bipolartransistor

export interface BjtModel {
  /** +1 NPN, −1 PNP (EL-H12). */
  polarity: 1 | -1;
  /** Transport-Sättigungsstrom in A (EL-H11). */
  is: number;
  betaF: number;
  betaR: number;
}

/** I_S = I_C,ref / e^(U_BE,ref / U_T) (EL-H11). */
export const bjtSaturationCurrent = (ubeRef: number, icRef: number): number => icRef / Math.exp(ubeRef / U_T);

export interface BjtEval {
  /** Kollektor- und Basisstrom in A (in das Bauteil hinein, mit Polarität). */
  ic: number; ib: number;
  /** Ableitungen ∂I_C/∂U_BE, ∂I_C/∂U_BC, ∂I_B/∂U_BE, ∂I_B/∂U_BC (EL-H13, mit Polarität bereits richtig für U_BE = u_b − u_e). */
  gcbe: number; gcbc: number; gbbe: number; gbbc: number;
  limited: boolean;
}

/**
 * Ebers-Moll-Transportmodell (EL-H09, EL-H10, EL-H12, EL-H13). Eingänge sind die Klemmenspannungen U_BE = u_b − u_e
 * und U_BC = u_b − u_c; für PNP werden intern U_EB, U_CB benutzt und die Ströme gespiegelt. Die Ableitungen beziehen sich
 * auf U_BE und U_BC (Kettenregel: zweimal Vorzeichen, also unverändert).
 */
export function bjtEval(m: BjtModel, ube: number, ubc: number): BjtEval {
  const s = m.polarity, vbe = s * ube, vbc = s * ubc;
  const [ef, def] = limexp(vbe / U_T), [er, der] = limexp(vbc / U_T);
  const ic = m.is * (ef - er) - (m.is / m.betaR) * (er - 1);
  const ib = (m.is / m.betaF) * (ef - 1) + (m.is / m.betaR) * (er - 1);
  const gcbe = (m.is * def) / U_T, gcbc = -(m.is * der) / U_T - (m.is * der) / (m.betaR * U_T);
  const gbbe = (m.is * def) / (m.betaF * U_T), gbbc = (m.is * der) / (m.betaR * U_T);
  return { ic: s * ic, ib: s * ib, gcbe, gcbc, gbbe, gbbc, limited: limexpActive(vbe / U_T) || limexpActive(vbc / U_T) };
}

/** Kritische Spannung der Übergänge des Bipolartransistors (n = 1). */
export const bjtCriticalVoltage = (m: BjtModel): number => criticalVoltage(m.is, U_T);

// ---------------------------------------------------------------- N-MOSFET

export interface MosModel { uth: number; k: number }

/** K = 1 / (R_DS(on) · (U_GS,ref − U_th)) (EL-H17). */
export const mosK = (ron: number, ugsRef: number, uth: number): number => 1 / (ron * (ugsRef - uth));

export type MosRegion = "sperrend" | "linear" | "gesättigt";
export interface MosEval {
  /** Drainstrom in A (in den Drain hinein, aus der Source heraus). */
  id: number;
  /** ∂I_D/∂U_GS und ∂I_D/∂U_DS (EL-H19), bezogen auf die Klemmen g, d, s. */
  gm: number; gds: number;
  region: MosRegion;
  /** true: Drain und Source getauscht (EL-H18, U_DS < 0). */
  swapped: boolean;
}

/** Shichman-Hodges ohne Tausch für U_DS ≥ 0 (EL-H14 bis EL-H16, EL-H19). */
function mosForward(m: MosModel, ugs: number, uds: number): { id: number; gm: number; gds: number; region: MosRegion } {
  const ov = ugs - m.uth;
  if (ov <= 0) return { id: 0, gm: 0, gds: 0, region: "sperrend" };
  if (uds < ov) return { id: m.k * (ov * uds - (uds * uds) / 2), gm: m.k * uds, gds: m.k * (ov - uds), region: "linear" };
  return { id: (m.k / 2) * ov * ov, gm: m.k * ov, gds: 0, region: "gesättigt" };
}

/**
 * N-MOSFET mit Symmetrie (EL-H18): für U_DS < 0 tauschen Drain und Source, I_D(U_GS, U_DS) = −I_D(U_GD, −U_DS).
 * Ableitungen nach U_GS und U_DS der Originalklemmen: mit U_GD = U_GS − U_DS gilt
 * ∂I_D/∂U_GS = −g_m', ∂I_D/∂U_DS = g_m' + g_ds'.
 */
export function mosEval(m: MosModel, ugs: number, uds: number): MosEval {
  if (uds >= 0) return { ...mosForward(m, ugs, uds), swapped: false };
  const r = mosForward(m, ugs - uds, -uds);
  return { id: -r.id, gm: -r.gm, gds: r.gm + r.gds, region: r.region, swapped: true };
}

/** MOSFET-Schrittbegrenzung (EL-K05): |ΔU_GS| ≤ 0,5 V + 0,5 · |U_GS,alt − U_th|, |ΔU_DS| ≤ 2 V. */
export function mosLimit(m: MosModel, ugsNew: number, ugsOld: number, udsNew: number, udsOld: number): [number, number, boolean] {
  const dmax = 0.5 + 0.5 * Math.abs(ugsOld - m.uth);
  let ugs = ugsNew, uds = udsNew, lim = false;
  if (Math.abs(ugsNew - ugsOld) > dmax) { ugs = ugsOld + Math.sign(ugsNew - ugsOld) * dmax; lim = true; }
  if (Math.abs(udsNew - udsOld) > 2) { uds = udsOld + Math.sign(udsNew - udsOld) * 2; lim = true; }
  return [ugs, uds, lim];
}
