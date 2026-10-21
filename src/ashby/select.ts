/**
 * Screening, Ranking und Form (Ashby Kap. 5.4, 7.7).
 * Strukturierte Werkstoffe: Index (φ·y)^n / x^k. Darstellung durch Verschieben beider Achsen um φ^a mit
 * a = n / (k − n) (Steifigkeit Balken: a = 1, Festigkeit Balken: a = 2); bei k = 0 (Bauraum) y* = φ·y.
 */
import type { MatClass, Material, Repo } from "../materials";
import { AX, PHI_MAX, PROP, groupValue, indexValue, phiGroup, requiredProps, sf, type MaterialIndex, type PropKey } from "./catalog";

export type ShapeMode = "none" | "modul1" | "max";
export interface PhiSet { Be: number; Bf: number; Te: number; Tf: number }
export interface Limits { Emin: number | null; rhoMax: number | null; sfMin: number | null; priceMax: number | null }
export interface AshbyState { index: MaterialIndex; classes: Record<MatClass, boolean>; limits: Limits; shapeMode: ShapeMode; phiUser: PhiSet | null }

export interface AshbyPoint { m: Material; x0: number; y0: number; x: number; y: number; phi: number; idx: number; pass: boolean }
export interface RankedPoint extends AshbyPoint { rank: number; rel: number }

export function phiFor(m: Material, st: AshbyState): number {
  if (st.shapeMode === "none" || !st.index.shape) return 1;
  const stiff = st.index.y === "E";
  const typ: keyof PhiSet = st.index.shape === "T" ? (stiff ? "Te" : "Tf") : (stiff ? "Be" : "Bf");
  if (st.shapeMode === "modul1") return st.phiUser ? st.phiUser[typ] : 1;
  const t = PHI_MAX[phiGroup(m)] ?? PHI_MAX["Keramik"] ?? [1, 1, 1, 1];
  return { Be: t[0], Te: t[1], Bf: t[2], Tf: t[3] }[typ];
}

function passes(m: Material, L: Limits): boolean {
  if (L.Emin !== null && !(m.E !== null && m.E >= L.Emin)) return false;
  if (L.rhoMax !== null && !(m.rho !== null && m.rho <= L.rhoMax)) return false;
  if (L.sfMin !== null) { const s = sf(m); if (!(s !== null && s >= L.sfMin)) return false; }
  if (L.priceMax !== null && !(m.price !== null && m.price <= L.priceMax)) return false;
  return true;
}

/** Alle Werkstoffe der gewählten Klassen mit Werten auf beiden Achsen. */
export function points(repo: Repo, st: AshbyState, withShape: boolean): AshbyPoint[] {
  const ix = st.index, out: AshbyPoint[] = [];
  if (ix.product) {
    // Produktindex: Achsen = Achsgruppen, keine Formwirkung. M = Y^a · X^b (gleich Π p^e).
    const P = ix.product;
    for (const m of repo.materials) {
      if (!st.classes[m.cls]) continue;
      const y0 = groupValue(P.yG, m), x0 = groupValue(P.xG, m);
      if (y0 === null || x0 === null) continue;
      out.push({ m, x0, y0, x: x0, y: y0, phi: 1, idx: indexValue(ix, y0, x0), pass: passes(m, st.limits) });
    }
    return out;
  }
  for (const m of repo.materials) {
    if (!st.classes[m.cls]) continue;
    const y0 = AX[ix.y].f(m), x0 = ix.k === 0 ? m.rho : AX[ix.x].f(m);
    if (y0 === null || x0 === null || !(y0 > 0) || !(x0 > 0)) continue;
    const phi = withShape ? phiFor(m, st) : 1;
    let x = x0, y = y0;
    if (phi !== 1) {
      if (ix.k > 0 && ix.k !== ix.n) { const a = ix.n / (ix.k - ix.n); x = x0 / Math.pow(phi, a); y = y0 / Math.pow(phi, a); }
      else if (ix.k === 0) y = y0 * phi;
    }
    out.push({ m, x0, y0, x, y, phi, idx: indexValue(ix, y, ix.k === 0 ? 1 : x), pass: passes(m, st.limits) });
  }
  return out;
}

export function screening(repo: Repo, st: AshbyState): { total: number; inClasses: number; noValue: number; pass: number; fail: number } {
  const pts = points(repo, st, false);
  const inClasses = repo.materials.filter((m) => st.classes[m.cls]).length;
  const pass = pts.filter((p) => p.pass).length;
  return { total: repo.materials.length, inClasses, noValue: inClasses - pts.length, pass, fail: pts.length - pass };
}

/** Rangliste der Werkstoffe, die das Screening bestehen. rel = Index(Rang 1) / Index (≥ 1). */
export function ranking(repo: Repo, st: AshbyState, withShape: boolean): RankedPoint[] {
  const pts = points(repo, st, withShape).filter((p) => p.pass).sort((a, b) => b.idx - a.idx || a.m.id.localeCompare(b.m.id));
  const best = pts[0]?.idx ?? 1;
  return pts.map((p, i) => ({ ...p, rank: i + 1, rel: best / p.idx }));
}

export interface Coverage {
  /** Werkstoffe der gewählten Klassen */
  N: number;
  /** davon bewertbar (alle Kennwerte des Index belegt und > 0) */
  n: number;
  /** nicht bewertbare Werkstoffe mit den fehlenden Kennwerten */
  missing: Array<{ m: Material; props: PropKey[] }>;
  /** je gewählter Klasse; low = weniger als die Hälfte bewertbar */
  byClass: Array<{ cls: MatClass; N: number; n: number; low: boolean }>;
}

/**
 * Bewertbarkeit eines Index (Konzept 0.8.0, Abschnitt 5): ein Werkstoff ist bewertbar, wenn alle Kennwerte des Index
 * belegt und > 0 sind. Keine Schätzung, keine Ersatzwerte (außer der bestehenden Regel σ_f = R_p, sonst R_m, sonst σ_bB).
 * n ist identisch mit points(repo, st, false).length.
 */
export function coverage(repo: Repo, st: AshbyState): Coverage {
  const req = requiredProps(st.index);
  const missing: Coverage["missing"] = [];
  const cls = new Map<MatClass, { N: number; n: number }>();
  let N = 0;
  for (const m of repo.materials) {
    if (!st.classes[m.cls]) continue;
    N++;
    const c = cls.get(m.cls) ?? { N: 0, n: 0 }; c.N++;
    const miss = req.filter((p) => { const v = PROP[p].f(m); return v === null || !(v > 0); });
    if (miss.length) missing.push({ m, props: miss }); else c.n++;
    cls.set(m.cls, c);
  }
  const byClass = [...cls.entries()].map(([k, v]) => ({ cls: k, N: v.N, n: v.n, low: v.n < v.N / 2 }));
  return { N, n: N - missing.length, missing, byClass };
}
