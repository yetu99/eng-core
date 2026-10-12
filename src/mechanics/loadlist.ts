/**
 * Lastliste: Biegebalken mit Lagern an den Enden und beliebig vielen Einzelkräften, Trapez-Streckenlasten
 * und Einzelmomenten an frei wählbaren Positionen (Konzept Lastliste, freigegeben 12.10.2026, L1 bis L7).
 *
 * Verfahren (exakt, deterministisch):
 * - Momentenlinie mit Föppl-Klammern ⟨x − a⟩ⁿ (Gross/Hauger TM 2, Kap. 4.5; Macaulay 1919):
 *   M(x) = M_A + A·x + Σ Lastterme. Biegelinie durch geschlossene Integration der Klammern (E·I·w″ = −M).
 * - Unbekannte A, M_A, C₁, C₂ aus vier Randbedingungen je Lagerung (lineares 4 × 4-System, Gauß mit Spaltenpivot).
 * - Extremwerte je Segment zwischen Unstetigkeitsstellen: Polynom vom Grad ≤ 5, Nullstellen der Ableitung
 *   vollständig über rekursive Trennung durch die Nullstellen der nächsten Ableitung und Bisektion mit fester Schrittzahl.
 *
 * Einheiten intern: x, L in mm; F in N; q in N/mm (= kN/m); M in N·mm. Eingaben der Liste: F kN, q kN/m, M N·m.
 * Vorzeichen: x ab linkem Ende, Lasten nach unten positiv, Einzelmoment im Uhrzeigersinn positiv,
 * w nach unten positiv, M positiv bei gezogener Unterseite, A und B nach oben positiv.
 * Lasten bei x = 0 und x = L gehören zum Balken; Randbedingungen gelten bei 0⁻ und L⁺.
 */
import { fmt } from "../format";

export type LoadListSupport = "KR" | "GG" | "EG" | "EE";
export type Load =
  | { kind: "F"; x: number; F: number }
  | { kind: "q"; x1: number; x2: number; q1: number; q2: number }
  | { kind: "M"; x: number; M: number };
export interface LoadList { support: LoadListSupport; loads: Load[]; selfWeight: boolean }

export const LOADLIST_ID = "LL" as const;
export const LOADLIST_MAX = 20;

export const LOADLIST_SUPPORTS: Readonly<Record<LoadListSupport, { label: string; short: string; supports: readonly ["fix" | "pin", "free" | "roller" | "fix"]; euler: 1 | 2 | 3 | 4; ref: string }>> = {
  KR: { label: "Kragträger, links eingespannt", short: "Krag", supports: ["fix", "free"], euler: 1, ref: "Roark Tab. 8.1 Fälle 1a, 2a, 3a" },
  GG: { label: "Gelenkig gelagert (Fest- und Loslager)", short: "Gelenkig", supports: ["pin", "roller"], euler: 2, ref: "Roark Tab. 8.1 Fälle 1e, 2e, 3e" },
  EG: { label: "Links eingespannt, rechts gelenkig", short: "Eingesp. / gelenkig", supports: ["fix", "roller"], euler: 3, ref: "Roark Tab. 8.1 Fälle 1c, 2c, 3c" },
  EE: { label: "Beidseitig eingespannt", short: "Beidseitig eingesp.", supports: ["fix", "fix"], euler: 4, ref: "Roark Tab. 8.1 Fälle 1d, 2d, 3d" },
};

export function isLoadListCase(id: string): id is typeof LOADLIST_ID { return id === LOADLIST_ID; }

/** Ein Föppl-Term c·⟨x − a⟩ⁿ der Momentenlinie (Einheiten so, dass M in N·mm entsteht). */
interface Term { c: number; a: number; n: number }

/** Last in internen Einheiten (N, N/mm, N·mm) mit laufender Nummer je Art (F₁, q₁, M₁ …). */
export type LoadSI =
  | { kind: "F"; no: string; x: number; F: number }
  | { kind: "q"; no: string; x1: number; x2: number; q1: number; q2: number; R: number; xc: number }
  | { kind: "M"; no: string; x: number; M: number };

export interface LoadListError { index: number; message: string }

/** Prüft die Liste und rechnet in interne Einheiten um. Fehler je Zeile (Index in der Eingabeliste). */
export function normalizeLoads(loads: readonly Load[], L: number): { loads: LoadSI[]; errors: LoadListError[] } {
  const errors: LoadListError[] = [];
  const out: LoadSI[] = [];
  const count = { F: 0, q: 0, M: 0 };
  if (loads.length > LOADLIST_MAX) errors.push({ index: LOADLIST_MAX, message: `höchstens ${LOADLIST_MAX} Lasten` });
  const inRange = (x: number) => Number.isFinite(x) && x >= 0 && x <= L;
  loads.slice(0, LOADLIST_MAX).forEach((l, i) => {
    if (l.kind === "F") {
      if (!inRange(l.x)) { errors.push({ index: i, message: `Position x = ${fmt(l.x)} mm liegt außerhalb 0 … ${fmt(L)} mm` }); return; }
      if (!Number.isFinite(l.F)) { errors.push({ index: i, message: "Kraft F ungültig" }); return; }
      out.push({ kind: "F", no: `F_${++count.F}`, x: l.x, F: l.F * 1000 });
    } else if (l.kind === "M") {
      if (!inRange(l.x)) { errors.push({ index: i, message: `Position x = ${fmt(l.x)} mm liegt außerhalb 0 … ${fmt(L)} mm` }); return; }
      if (!Number.isFinite(l.M)) { errors.push({ index: i, message: "Moment M ungültig" }); return; }
      out.push({ kind: "M", no: `M_${++count.M}`, x: l.x, M: l.M * 1000 });
    } else {
      if (!inRange(l.x1) || !inRange(l.x2)) { errors.push({ index: i, message: `Bereich ${fmt(l.x1)} … ${fmt(l.x2)} mm liegt nicht in 0 … ${fmt(L)} mm` }); return; }
      if (!(l.x2 > l.x1)) { errors.push({ index: i, message: `Streckenlast: Ende x₂ = ${fmt(l.x2)} mm muss größer als Anfang x₁ = ${fmt(l.x1)} mm sein` }); return; }
      if (!Number.isFinite(l.q1) || !Number.isFinite(l.q2)) { errors.push({ index: i, message: "Streckenlast q ungültig" }); return; }
      const d = l.x2 - l.x1, R = (l.q1 + l.q2) / 2 * d;
      // Schwerpunkt des Trapezes ab x₁: d·(q₁ + 2q₂) / (3(q₁ + q₂)); bei R = 0 Mitte (Moment des Paares separat in den Termen)
      const xc = l.q1 + l.q2 !== 0 ? l.x1 + d * (l.q1 + 2 * l.q2) / (3 * (l.q1 + l.q2)) : l.x1 + d / 2;
      out.push({ kind: "q", no: `q_${++count.q}`, x1: l.x1, x2: l.x2, q1: l.q1, q2: l.q2, R, xc });
    }
  });
  return { loads: out, errors };
}

function termsOf(loads: readonly LoadSI[]): Term[] {
  const T: Term[] = [];
  for (const l of loads) {
    if (l.kind === "F") T.push({ c: -l.F, a: l.x, n: 1 });
    else if (l.kind === "M") T.push({ c: l.M, a: l.x, n: 0 });
    else {
      const k = (l.q2 - l.q1) / (l.x2 - l.x1);
      T.push({ c: -l.q1 / 2, a: l.x1, n: 2 }, { c: -k / 6, a: l.x1, n: 3 }, { c: l.q2 / 2, a: l.x2, n: 2 }, { c: k / 6, a: l.x2, n: 3 });
    }
  }
  return T;
}

/** ⟨x − a⟩ⁿ; side "+" zählt x = a dazu (rechtsseitiger Grenzwert), "−" nicht. */
function bracket(x: number, a: number, n: number, side: "+" | "-"): number {
  const on = side === "+" ? x >= a : x > a;
  if (!on) return 0;
  return n === 0 ? 1 : (x - a) ** n;
}

// ---------- Polynome (Koeffizienten aufsteigend, p[i]·uⁱ) ----------
type Poly = number[];
const pEval = (p: Poly, u: number): number => { let s = 0; for (let i = p.length - 1; i >= 0; i--) s = s * u + (p[i] as number); return s; };
const pDer = (p: Poly): Poly => p.slice(1).map((c, i) => c * (i + 1));
const pAdd = (p: Poly, q: Poly): Poly => Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] ?? 0) + (q[i] ?? 0));
/** c·(u + d)ⁿ als Polynom in u (Binomialentwicklung). */
function pShift(c: number, d: number, n: number): Poly {
  const p: Poly = new Array<number>(n + 1).fill(0);
  let binom = 1;
  for (let k = 0; k <= n; k++) { p[k] = c * binom * d ** (n - k); binom = binom * (n - k) / (k + 1); }
  return p;
}
function pDegree(p: Poly, scale: number): number {
  const tol = 1e-13 * scale;
  for (let i = p.length - 1; i > 0; i--) if (Math.abs(p[i] as number) * 1 > tol) return i;
  return 0;
}

export const ROOT_BISECTION_STEPS = 80;

/**
 * Alle reellen Nullstellen von p im offenen Intervall (0, h), aufsteigend.
 * Vollständig: Nullstellen von p werden durch die Nullstellen von p′ getrennt (rekursiv), zwischen zwei
 * Trennstellen liegt höchstens eine Nullstelle mit Vorzeichenwechsel. Bisektion mit fester Schrittzahl.
 * Doppelte Nullstellen ohne Vorzeichenwechsel sind Extremstellen von p und für die Extremwertsuche unerheblich.
 */
export function polyRoots(p: Poly, h: number): number[] {
  const scale = Math.max(1e-300, ...p.map((c, i) => Math.abs(c) * h ** i));
  const deg = pDegree(p, scale);
  if (deg === 0) return [];
  if (deg === 1) { const u = -(p[0] as number) / (p[1] as number); return u > 0 && u < h ? [u] : []; }
  const crit = polyRoots(pDer(p.slice(0, deg + 1)), h);
  const pts = [0, ...crit, h];
  const roots: number[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    let a = pts[i] as number, b = pts[i + 1] as number;
    const fa = pEval(p, a), fb = pEval(p, b);
    if (fa === 0 || fb === 0 || fa * fb > 0) continue;
    let ga = fa;
    for (let k = 0; k < ROOT_BISECTION_STEPS; k++) {
      const m = (a + b) / 2, fm = pEval(p, m);
      if (fm === 0) { a = b = m; break; }
      if (fm * ga < 0) b = m; else { a = m; ga = fm; }
    }
    roots.push((a + b) / 2);
  }
  return roots;
}

export interface Segment { x0: number; x1: number; M: Poly; Q: Poly; q: Poly; EIphi: Poly; EIw: Poly }
export interface Extremum { value: number; x: number }

export interface BeamSolution {
  support: LoadListSupport;
  L: number; EI: number;
  loads: LoadSI[];
  /** Lagerkräfte nach oben positiv (N) */
  A: number; B: number;
  /** Schnittmomente an den Enden M(0⁺), M(L⁻) in N·mm */
  MA: number; MB: number;
  /** Reaktionsmomente der Einspannungen im Uhrzeigersinn (N·mm), 0 bei Gelenk oder freiem Ende */
  CA: number; CB: number;
  C1: number; C2: number;
  segments: Segment[];
  Q: (x: number) => number; M: (x: number) => number; phi: (x: number) => number; w: (x: number) => number;
  /** betragsgrößte Werte mit Vorzeichen und Ort */
  Mext: Extremum; Qext: Extremum; wext: Extremum;
  /** Summe der Lasten nach unten (N) und Moment der Lasten um x = 0 (N·mm, Uhrzeigersinn) */
  sumF: number; sumM0: number;
  /** Gleichgewichtsreste bezogen auf die größte Kraft bzw. das größte Moment */
  resF: number; resM: number;
}

/** Löst ein lineares System (n ≤ 4) mit Gauß und Spaltenpivot, feste Reihenfolge. */
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i] as number]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    if (M[p]![c] === 0) throw new Error("Randwertsystem singulär");
    [M[c], M[p]] = [M[p]!, M[c]!];
    for (let r = c + 1; r < n; r++) { const f = M[r]![c]! / M[c]![c]!; for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!; }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r]![n]!; for (let k = r + 1; k < n; k++) s -= M[r]![k]! * x[k]!; x[r] = s / M[r]![r]!; }
  return x;
}

/**
 * Löst den Balken. EI in N·mm² (für Schritt 6 auch 1 zulässig: w ist dann w·E·I).
 * Die Lasten müssen mit normalizeLoads geprüft sein.
 */
export function solveBeam(support: LoadListSupport, loads: readonly LoadSI[], L: number, EI: number): BeamSolution {
  const T = termsOf(loads);
  const sumT = (x: number, side: "+" | "-", f: (t: Term) => [number, number]) => T.reduce((s, t) => { const [c, n] = f(t); return s + c * bracket(x, t.a, n, side); }, 0);
  // Lastanteile (ohne Unbekannte)
  const mL = (x: number, s: "+" | "-") => sumT(x, s, (t) => [t.c, t.n]);
  const qL = (x: number, s: "+" | "-") => sumT(x, s, (t) => [t.n === 0 ? 0 : t.c * t.n, Math.max(t.n - 1, 0)]);
  const tL = (x: number) => sumT(x, "+", (t) => [-t.c / (t.n + 1), t.n + 1]);
  const wL = (x: number) => sumT(x, "+", (t) => [-t.c / ((t.n + 1) * (t.n + 2)), t.n + 2]);
  // Zeilen in den Unbekannten [A, M_A, C1, C2]
  type Row = [number[], number];
  const W = (x: number): Row => [[-(x ** 3) / 6, -(x ** 2) / 2, x, 1], -wL(x)];
  const P = (x: number): Row => [[-(x ** 2) / 2, -x, 1, 0], -tL(x)];
  const Mr = (x: number, s: "+" | "-"): Row => [[x, 1, 0, 0], -mL(x, s)];
  const Qr = (x: number, s: "+" | "-"): Row => [[1, 0, 0, 0], -qL(x, s)];
  const bc: Record<LoadListSupport, Row[]> = {
    KR: [W(0), P(0), Mr(L, "+"), Qr(L, "+")],
    GG: [W(0), Mr(0, "-"), W(L), Mr(L, "+")],
    EG: [W(0), P(0), W(L), Mr(L, "+")],
    EE: [W(0), P(0), W(L), P(L)],
  };
  const rows = bc[support];
  const [A, MA0, C1, C2] = solveLinear(rows.map((r) => r[0]), rows.map((r) => r[1])) as [number, number, number, number];

  const M = (x: number, s: "+" | "-" = "+") => MA0 + A * x + mL(x, s);
  const Q = (x: number, s: "+" | "-" = "+") => A + qL(x, s);
  const EIphi = (x: number) => -MA0 * x - A * x * x / 2 + tL(x) + C1;
  const EIw = (x: number) => -MA0 * x * x / 2 - A * x ** 3 / 6 + wL(x) + C1 * x + C2;

  // Segmente zwischen Unstetigkeitsstellen
  const cuts = [...new Set([0, L, ...T.map((t) => t.a)].filter((x) => x >= 0 && x <= L))].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const x0 = cuts[i] as number, x1 = cuts[i + 1] as number;
    let pm: Poly = [MA0 + A * x0, A];
    for (const t of T) if (t.a <= x0) pm = pAdd(pm, pShift(t.c, x0 - t.a, t.n));
    const pq = pDer(pm);
    const pq2 = pDer(pq).map((c) => -c); // Streckenlast q(x) = −dQ/dx
    // E·I·φ = −∫M + C1, E·I·w = −∬M + C1·x + C2 (lokal ab x0, Integrationskonstanten aus den globalen Werten)
    const intM: Poly = [0, ...pm.map((c, k) => c / (k + 1))];
    const phi: Poly = pAdd([EIphi(x0)], intM.map((c) => -c));
    const intPhi: Poly = [0, ...phi.map((c, k) => c / (k + 1))];
    const pw: Poly = pAdd([EIw(x0)], intPhi);
    segments.push({ x0, x1, M: pm, Q: pq.length ? pq : [0], q: pq2.length ? pq2 : [0], EIphi: phi, EIw: pw });
  }

  // Extremwerte: Segmentränder und Nullstellen der Ableitung
  const ext = (f: (s: Segment) => Poly, d: (s: Segment) => Poly): Extremum => {
    let best: Extremum = { value: 0, x: 0 };
    for (const s of segments) {
      const h = s.x1 - s.x0, p = f(s);
      for (const u of [0, ...polyRoots(d(s), h), h]) {
        const v = pEval(p, u);
        if (Math.abs(v) > Math.abs(best.value) * (1 + 1e-12) + 1e-300) best = { value: v, x: s.x0 + u };
      }
    }
    return best;
  };
  const Mext = ext((s) => s.M, (s) => s.Q);
  const Qext = ext((s) => s.Q, (s) => pDer(s.Q));
  const wext0 = ext((s) => s.EIw, (s) => s.EIphi);
  const wext = { value: wext0.value / EI, x: wext0.x };

  // Lagerkräfte und Reaktionsmomente, Gleichgewicht
  const fixL = support !== "GG";
  const B = support === "KR" ? 0 : -Q(L, "+");
  const CA = fixL ? MA0 : 0;
  const CB = support === "EE" ? -M(L, "+") : 0;
  let sumF = 0, sumM0 = 0;
  for (const l of loads) {
    if (l.kind === "F") { sumF += l.F; sumM0 += l.F * l.x; }
    else if (l.kind === "q") { sumF += l.R; sumM0 += l.R * l.xc; if (l.q1 + l.q2 === 0) sumM0 += (l.q2 - l.q1) / 2 * (l.x2 - l.x1) ** 2 / 6; }
    else sumM0 += l.M;
  }
  const refF = Math.max(1, ...loads.map((l) => (l.kind === "F" ? Math.abs(l.F) : l.kind === "q" ? Math.max(Math.abs(l.q1), Math.abs(l.q2)) * (l.x2 - l.x1) : 0)), Math.abs(A), Math.abs(B));
  const refM = Math.max(refF * L, ...loads.map((l) => (l.kind === "M" ? Math.abs(l.M) : 0)));
  const resF = (A + B - sumF) / refF;
  const resM = (sumM0 + CA + CB - B * L) / refM;

  return {
    support, L, EI, loads: [...loads], A, B, MA: M(0, "+"), MB: M(L, "-"), CA, CB, C1, C2, segments,
    Q: (x) => Q(x, "+"), M: (x) => M(x, "+"), phi: (x) => EIphi(x) / EI, w: (x) => EIw(x) / EI,
    Mext, Qext, wext, sumF, sumM0, resF, resM,
  };
}

/** Startliste aus einem der sechs Standardfälle (Übernahme beim Umschalten auf die Lastliste). F, q wie Eingabe (kN, kN/m). */
export function loadListFromCase(caseId: string, L: number, F: number, q: number, a: number): LoadList {
  switch (caseId) {
    case "KE": return { support: "KR", loads: [{ kind: "F", x: L, F }], selfWeight: false };
    case "KQ": return { support: "KR", loads: [{ kind: "q", x1: 0, x2: L, q1: q, q2: q }], selfWeight: false };
    case "EE": return { support: "GG", loads: [{ kind: "F", x: L / 2, F }], selfWeight: false };
    case "E4": return { support: "GG", loads: [{ kind: "F", x: a, F }, { kind: "F", x: L - a, F }], selfWeight: false };
    case "BQ": return { support: "EE", loads: [{ kind: "q", x1: 0, x2: L, q1: q, q2: q }], selfWeight: false };
    default: return { support: "GG", loads: [{ kind: "q", x1: 0, x2: L, q1: q, q2: q }], selfWeight: false };
  }
}

/** Kurztext einer Last für Rechenweg und Skizze (Eingabeeinheiten). */
export function loadText(l: LoadSI): string {
  if (l.kind === "F") return `${l.no} = ${fmt(l.F / 1000)} kN bei x = ${fmt(l.x)} mm`;
  if (l.kind === "M") return `${l.no} = ${fmt(l.M / 1000)} N·m bei x = ${fmt(l.x)} mm`;
  return l.q1 === l.q2
    ? `${l.no} = ${fmt(l.q1)} kN/m von ${fmt(l.x1)} bis ${fmt(l.x2)} mm`
    : `${l.no} = ${fmt(l.q1)} → ${fmt(l.q2)} kN/m von ${fmt(l.x1)} bis ${fmt(l.x2)} mm`;
}
