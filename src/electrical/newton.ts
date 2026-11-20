/**
 * Newton-Iteration für den Gleichstrom-Arbeitspunkt mit Halbleitern (Modul elektrik, EL-K, ab 0.21.0, intern).
 *
 * Ablauf (E-v11-5, SPICE2 nach Nagel 1975): gedämpftes Newton mit Spannungsbegrenzung (EL-K04, EL-K05), bei Misserfolg
 * G_min-Stufung (EL-K07), danach Quellenstufung (EL-K08), sonst Abbruch (EL-K09). Jeder Schritt baut die MNA-Matrix aus
 * den linearen Primitiven und den Begleitmodellen neu auf und löst sie (EL-K01). Konvergenz (EL-K03, E-v11-6): Änderung
 * jeder Unbekannten ≤ 1e-10 · |x| + 1e-12 V und Rest jedes Bauteilstroms ≤ 1e-10 · |I| + 1e-15 A, ohne aktive
 * Begrenzung, in zwei aufeinanderfolgenden Schritten. Deterministisch: feste Startwerte (EL-K02), feste Reihenfolge.
 */
import { cscale, type Complex } from "./complex";
import type { ElNetlist } from "./network";
import { solve, type Built, type Prim, type Solved } from "./mna";
import { devVolts, limitVolts, linearize, stamps, startVolts, type Device, type Lin, type Volts } from "./devices";

export const NEWTON_REL = 1e-10;
export const NEWTON_ABS_V = 1e-12;
export const NEWTON_ABS_I = 1e-15;
export const NEWTON_MAX_ITER = 100;
export const NEWTON_BUDGET = 5000;
/** G_min-Stufung: Leitwerte der Stufen in S (EL-K07), danach 0 (nur G_min des Modells). */
export const GMIN_STEPS = [1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-9, 1e-10, 1e-11] as const;

export type NewtonStage = "newton" | "gmin" | "quellen";
export interface NewtonOptions {
  /** Schritte je Newton-Lauf (Vorgabe 100). */
  maxIter?: number;
  /** Gesamtbudget (Vorgabe 5000); Testschalter für EL-K09. */
  budget?: number;
  /** Stufen in dieser Reihenfolge (Vorgabe alle); Testschalter für EL-K07 und EL-K08. */
  stages?: readonly NewtonStage[];
}

export interface NewtonResult {
  ok: boolean;
  solved: Solved | null;
  /** Stufe, mit der die Lösung gefunden wurde, bzw. letzte versuchte Stufe. */
  stage: NewtonStage;
  /** Newton-Schritte insgesamt. */
  steps: number;
  /** Anzahl der G_min-Stufen bzw. Quellenschritte (0, wenn nicht benutzt). */
  gminLevels: number;
  lambdaSteps: number;
  /** größter Rest (A) und größte Änderung (V) im letzten Schritt. */
  residual: number;
  change: number;
  /** Bauteil mit der größten Änderung im letzten Schritt. */
  worst: string | null;
  /** Spannungsbegrenzung (EL-K04, EL-K05) mindestens einmal aktiv. */
  limitedPn: boolean;
  limitedMos: boolean;
  aborted: boolean;
}

interface State { first: boolean; vold: Volts[]; V: Map<string, number> }
const clone = (s: State): State => ({ first: s.first, vold: s.vold.map((v) => [...v]), V: new Map(s.V) });

/** Unabhängige Quellen (Spannungs- und Stromquellen) mit Faktor λ (EL-K08). */
function scaled(prims: readonly Prim[], lambda: number): Prim[] {
  if (lambda === 1) return [...prims];
  return prims.map((p) => (p.t === "V" ? { ...p, v: cscale(p.v, lambda) } : p.t === "I" ? { ...p, i: cscale(p.i, lambda) as Complex } : p));
}

export function newtonDc(net: ElNetlist, b: Built, opts: NewtonOptions = {}): NewtonResult {
  const maxIter = opts.maxIter ?? NEWTON_MAX_ITER, budget = opts.budget ?? NEWTON_BUDGET;
  const stages = opts.stages ?? ["newton", "gmin", "quellen"];
  const devs: Device[] = b.devices;
  const res: NewtonResult = { ok: false, solved: null, stage: stages[0] ?? "newton", steps: 0, gminLevels: 0, lambdaSteps: 0, residual: NaN, change: NaN, worst: null, limitedPn: false, limitedMos: false, aborted: false };
  const fresh = (): State => ({ first: true, vold: devs.map(startVolts), V: new Map() });

  /** Ein Newton-Lauf ab Zustand st (wird fortgeschrieben). */
  const run = (st: State, gstep: number, lambda: number): boolean => {
    const base = scaled(b.prims, lambda);
    let good = 0;
    for (let k = 0; k < maxIter; k++) {
      if (res.steps >= budget) { res.aborted = true; return false; }
      const extra: Prim[] = [], lins: Lin[] = [], used: Volts[] = [];
      let limited = false;
      const wasFirst = st.first;
      devs.forEach((d, n) => {
        let v: Volts;
        if (st.first) v = st.vold[n]!;
        else {
          const [vl, l] = limitVolts(d, devVolts(d, (x) => st.V.get(x) ?? 0), st.vold[n]!);
          v = vl;
          if (l) { limited = true; if (d.t === "mos") res.limitedMos = true; else res.limitedPn = true; }
        }
        st.vold[n] = v; used.push(v);
        const lin = linearize(d, v); lins.push(lin);
        extra.push(...stamps(d, v, lin, gstep));
      });
      st.first = false;
      const s = solve(net, { ...b, prims: [...base, ...extra] });
      res.steps++;
      res.solved = s;
      if (!s.ok) return false;
      // Änderung der Unbekannten
      let change = 0, dxOk = true;
      for (const [n, c] of s.V) {
        const xn = c.re, xo = st.V.get(n) ?? 0, dx = Math.abs(xn - xo);
        if (dx > NEWTON_REL * Math.max(Math.abs(xn), Math.abs(xo)) + NEWTON_ABS_V) dxOk = false;
        change = Math.max(change, dx);
      }
      // Rest der Bauteilströme: exakter Strom gegen Linearisierung
      let resid = 0, resOk = true, worst: string | null = null, worstDv = -1;
      const vnew = (x: string): number => s.V.get(x)?.re ?? 0;
      devs.forEach((d, n) => {
        const raw = devVolts(d, vnew), ex = linearize(d, raw), lin = lins[n]!, u = used[n]!;
        lin.f.forEach((f0, r) => {
          const pred = f0 + lin.J[r]!.reduce((acc, g, c) => acc + g * (raw[c]! - u[c]!), 0), e = ex.f[r]!, dI = Math.abs(e - pred);
          if (dI > NEWTON_REL * Math.max(Math.abs(e), Math.abs(pred)) + NEWTON_ABS_I) resOk = false;
          resid = Math.max(resid, dI);
        });
        const dv = Math.max(...raw.map((x, c) => Math.abs(x - u[c]!)));
        if (dv > worstDv) { worstDv = dv; worst = d.el; }
      });
      res.residual = resid; res.change = change; res.worst = worst;
      st.V = new Map([...s.V].map(([n, c]) => [n, c.re]));
      const conv = !wasFirst && !limited && dxOk && resOk;
      good = conv ? good + 1 : 0;
      if (good >= 2) return true;
    }
    return false;
  };

  for (const stage of stages) {
    res.stage = stage;
    if (res.aborted) break;
    if (stage === "newton") {
      if (run(fresh(), 0, 1)) { res.ok = true; return res; }
    } else if (stage === "gmin") {
      const st = fresh();
      let ok = true;
      for (const g of [...GMIN_STEPS, 0]) { res.gminLevels++; if (!run(st, g, 1)) { ok = false; break; } }
      if (ok) { res.ok = true; return res; }
    } else {
      let st = fresh();
      res.lambdaSteps = 1;
      if (!run(st, 0, 0)) continue;
      let lambda = 0, dl = 0.1;
      while (lambda < 1 && !res.aborted) {
        const lt = Math.min(1, lambda + dl), save = clone(st);
        res.lambdaSteps++;
        if (run(st, 0, lt)) { lambda = lt; dl = Math.min(2 * dl, 1); }
        else { st = save; dl /= 2; if (dl < 1e-4) break; }
      }
      if (lambda === 1) { res.ok = true; return res; }
    }
  }
  if (res.steps >= budget) res.aborted = true;
  return res;
}
