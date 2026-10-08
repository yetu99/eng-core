/**
 * Biegebalken nach Bernoulli, statisch, linear-elastisch. Einheiten: N, mm, MPa.
 * x läuft von links (bei Kragträgern: Einspannung) nach rechts. w positiv nach unten.
 * Maxima in geschlossener Form; die Verläufe dienen nur der Darstellung.
 */
import { fmt } from "../format";
import type { BendingCaseId } from "./cases";

export interface BeamFns {
  Q: (x: number) => number;
  M: (x: number) => number;
  /** Durchbiegung bei gegebener Biegesteifigkeit EI */
  w: (x: number, EI: number) => number;
}

export interface BeamMax {
  M: number; Q: number; w: number; xM: number;
  /** Formel und Einsetzung für den Rechenweg */
  fM: string; sM: string; fw: string; sw: string;
}

/** Schnittgrößen- und Biegelinienverläufe. F in N, q in N/mm, a und L in mm. */
export function beamFns(c: BendingCaseId, L: number, F: number, q: number, a: number): BeamFns {
  switch (c) {
    case "KE": return { Q: () => F, M: (x) => -F * (L - x), w: (x, EI) => F * x * x * (3 * L - x) / (6 * EI) };
    case "KQ": return { Q: (x) => q * (L - x), M: (x) => -q * (L - x) ** 2 / 2, w: (x, EI) => q * x * x * (6 * L * L - 4 * L * x + x * x) / (24 * EI) };
    case "EE": return {
      Q: (x) => (x < L / 2 ? F / 2 : -F / 2), M: (x) => (x <= L / 2 ? F * x / 2 : F * (L - x) / 2),
      w: (x, EI) => { const u = x <= L / 2 ? x : L - x; return F * u * (3 * L * L - 4 * u * u) / (48 * EI); },
    };
    case "EQ": return { Q: (x) => q * (L / 2 - x), M: (x) => q * x * (L - x) / 2, w: (x, EI) => q * x * (L ** 3 - 2 * L * x * x + x ** 3) / (24 * EI) };
    case "E4": return {
      Q: (x) => (x < a ? F : x > L - a ? -F : 0), M: (x) => (x < a ? F * x : x > L - a ? F * (L - x) : F * a),
      w: (x, EI) => { const u = x <= L / 2 ? x : L - x; return u <= a ? F * u * (3 * L * a - 3 * a * a - u * u) / (6 * EI) : F * a * (3 * L * u - 3 * u * u - a * a) / (6 * EI); },
    };
    case "BQ": return { Q: (x) => q * (L / 2 - x), M: (x) => q * (6 * L * x - 6 * x * x - L * L) / 12, w: (x, EI) => q * x * x * (L - x) ** 2 / (24 * EI) };
  }
}

/** Größtes Moment, größte Querkraft, größte Durchbiegung (geschlossene Formeln). */
export function bendingMax(c: BendingCaseId, L: number, F: number, q: number, a: number, EI: number): BeamMax {
  switch (c) {
    case "KE": return { M: F * L, Q: F, w: F * L ** 3 / (3 * EI), xM: 0, fM: "M_max = F·L", sM: `${fmt(F)}·${fmt(L)}`, fw: "f = F·L³ / (3·E·I)", sw: `${fmt(F)}·${fmt(L)}³ / (3·${fmt(EI)})` };
    case "KQ": return { M: q * L * L / 2, Q: q * L, w: q * L ** 4 / (8 * EI), xM: 0, fM: "M_max = q·L²/2", sM: `${fmt(q)}·${fmt(L)}²/2`, fw: "f = q·L⁴ / (8·E·I)", sw: `${fmt(q)}·${fmt(L)}⁴ / (8·${fmt(EI)})` };
    case "EE": return { M: F * L / 4, Q: F / 2, w: F * L ** 3 / (48 * EI), xM: L / 2, fM: "M_max = F·L/4", sM: `${fmt(F)}·${fmt(L)}/4`, fw: "f = F·L³ / (48·E·I)", sw: `${fmt(F)}·${fmt(L)}³ / (48·${fmt(EI)})` };
    case "EQ": return { M: q * L * L / 8, Q: q * L / 2, w: 5 * q * L ** 4 / (384 * EI), xM: L / 2, fM: "M_max = q·L²/8", sM: `${fmt(q)}·${fmt(L)}²/8`, fw: "f = 5·q·L⁴ / (384·E·I)", sw: `5·${fmt(q)}·${fmt(L)}⁴ / (384·${fmt(EI)})` };
    case "E4": return { M: F * a, Q: F, w: F * a * (3 * L * L - 4 * a * a) / (24 * EI), xM: L / 2, fM: "M_max = F·a", sM: `${fmt(F)}·${fmt(a)}`, fw: "f = F·a·(3L² − 4a²) / (24·E·I)", sw: `${fmt(F)}·${fmt(a)}·(3·${fmt(L)}² − 4·${fmt(a)}²) / (24·${fmt(EI)})` };
    case "BQ": return { M: q * L * L / 12, Q: q * L / 2, w: q * L ** 4 / (384 * EI), xM: 0, fM: "M_max = q·L²/12 (Einspannung)", sM: `${fmt(q)}·${fmt(L)}²/12`, fw: "f = q·L⁴ / (384·E·I)", sw: `${fmt(q)}·${fmt(L)}⁴ / (384·${fmt(EI)})` };
  }
}
