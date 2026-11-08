/**
 * Rahmenbaum und Rahmenkette (Modul kinematik, Blatt K2, ab 0.14.0): Rechenschritte G-20, Einstieg computeFrames.
 * Konzept handhabung/konzept_k2_homogene_transformation.md, Entscheidung K2-E1: jeder Rahmen hat genau einen
 * Bezugsrahmen (Baum mit einer Wurzel), die Kette nach ISO 9787 ist eine Vorlage darin.
 *
 * Rahmen nach ISO 9787:2013: Welt O0 (5.1), Basis O1 (5.2), mechanische Schnittstelle (Flansch) Om (5.3),
 * Werkzeug Ot mit Ursprung im TCP (5.4), Aufgabe Ok (5.6), Objekt Oj (5.7). Weber/Koch Kap. 2 (DH, Schluss):
 * das Werkzeugsystem hängt über eine konstante homogene Matrix am letzten Gliedsystem (Flansch).
 *
 * Einheiten m und rad; Anzeige mm und Grad in der Oberfläche.
 */
import type { CalcStep, Trace, TraceGroupOf } from "../trace";
import { deg, type Mat3, type Vec3 } from "./so3";
import { KinematicsError, checkRotation } from "./orientation";
import {
  IDENTITY, chainT, checkTransform, composeT, displace, fromPose, fromRp, invertT, se3, splitMatrix, tName, tStr, toMat4, toPose, transformDirection, transformPoint,
  type Mat4, type Pose, type Transform,
} from "./se3";

export type FrameRole = "welt" | "basis" | "flansch" | "werkzeug" | "aufgabe" | "objekt" | "frei";
/** Ein Rahmen mit Lage relativ zu seinem Bezugsrahmen (parent); die Wurzel hat parent null und keine Lage. */
export interface FrameDef {
  /** Kurzzeichen, eindeutig, als Index im Rechenweg (z. B. 0, 1, m, t, k, j). */
  id: string;
  name: string;
  role: FrameRole;
  parent: string | null;
  /** Lage relativ zum Bezugsrahmen als Pose (G-13-P) oder als 4×4-Matrix (G-13-Z, G-14). */
  pose?: Pose;
  matrix?: Mat4;
  /** Orientierung R (z. B. aus Blatt K1) und Ursprung p (G-13 mit Prüfung G-10). */
  rp?: { R: Mat3; p: Vec3 };
}
export interface FrameInput {
  frames: readonly FrameDef[];
  /** Relative Lage T_in,of (Lage von {of} in {in}), G-20-R. */
  rel?: { of: string; in: string } | null;
  /** Punkt (4. Komponente 1, G-17) oder Richtung (4. Komponente 0, G-18), gegeben im Rahmen frame. */
  point?: { frame: string; v: Vec3; kind: "punkt" | "richtung" } | null;
  /** TCP-Soll in Welt (G-20-F, braucht die ISO-Kette Welt, Basis, Flansch, Werkzeug). */
  tcpTarget?: Pose | null;
  /** Rahmen frame verschieben mit Trans(p)·Rot(ω̂, θ), fest in der Wurzel oder mitgedreht (G-19-F, G-19-M). */
  displace?: { frame: string; mode: "fest" | "mitgedreht"; axis: Vec3; theta: number; p: Vec3 } | null;
}
type KinGroup = TraceGroupOf<"kinematik">;

export interface FrameResult {
  errors: string[];
  notes: string[];
  warnings: string[];
  /** Wurzelrahmen (Welt) */
  root: string | null;
  /** Rahmen in Reihenfolge Wurzel zuerst (Bezugsrahmen vor Kind). */
  order: string[];
  /** Lage jedes Rahmens relativ zu seinem Bezugsrahmen bzw. zur Wurzel. */
  local: Record<string, Transform>;
  abs: Record<string, Transform>;
  /** Weg von der Wurzel zu jedem Rahmen (Wurzel zuerst). */
  path: Record<string, string[]>;
  rel: Transform | null;
  relPose: Pose | null;
  /** ISO-Kette: T_0t (G-20-K), T_kt (G-20-A), Flansch-Soll T_1m (G-20-F). */
  iso: { T0t: Transform; Tkt: Transform | null; T1mTarget: Transform | null } | null;
  /** Punkt bzw. Richtung in jedem Rahmen. */
  points: Record<string, Vec3> | null;
  displaced: Transform | null;
  trace: Trace<KinGroup>;
}

const ISO_ROLES = ["welt", "basis", "flansch", "werkzeug"] as const;

/** Rahmenbaum prüfen und ordnen: eine Wurzel, eindeutige Kurzzeichen, bekannte Bezugsrahmen, keine Zyklen. */
export function orderFrames(frames: readonly FrameDef[]): { root: string; order: string[]; path: Record<string, string[]> } {
  if (frames.length === 0) throw new KinematicsError("keine Rahmen");
  const ids = new Set<string>();
  for (const f of frames) {
    if (!/^[A-Za-z0-9]{1,6}$/.test(f.id)) throw new KinematicsError(`Kurzzeichen „${f.id}“: nur Buchstaben und Ziffern, 1 bis 6 Zeichen`);
    if (ids.has(f.id)) throw new KinematicsError(`Kurzzeichen „${f.id}“ ist doppelt`);
    ids.add(f.id);
  }
  const roots = frames.filter((f) => f.parent === null);
  if (roots.length !== 1) throw new KinematicsError(`genau ein Rahmen ohne Bezugsrahmen (Wurzel) erlaubt, gefunden ${roots.length}`);
  for (const f of frames) if (f.parent !== null && !ids.has(f.parent)) throw new KinematicsError(`Rahmen {${f.id}}: Bezugsrahmen {${f.parent}} gibt es nicht`);
  const byId = new Map(frames.map((f) => [f.id, f]));
  const path: Record<string, string[]> = {};
  for (const f of frames) {
    const p: string[] = [];
    let cur: FrameDef | undefined = f;
    while (cur) {
      if (p.includes(cur.id)) throw new KinematicsError(`Rahmen {${f.id}}: Zyklus über {${cur.id}}`);
      p.unshift(cur.id);
      cur = cur.parent === null ? undefined : byId.get(cur.parent);
    }
    path[f.id] = p;
  }
  const order = frames.map((f) => f.id).sort((a, b) => path[a]!.length - path[b]!.length || frames.findIndex((f) => f.id === a) - frames.findIndex((f) => f.id === b));
  return { root: roots[0]!.id, order, path };
}

/**
 * Rahmenbaum auswerten: Lagen (G-13-P, G-13 mit G-10 bzw. G-13-Z mit G-14), Ketten (G-16-N), relative Lage (G-20-R mit G-15, G-16,
 * G-13-X), ISO-Kette (G-20-K, G-20-A, G-20-F), Punkt bzw. Richtung (G-17, G-18), Verschieben (G-19).
 * Rechenweg nach den Gruppen lage, kette, inverse, abbildung.
 */
export function computeFrames(inp: FrameInput): FrameResult {
  const trace: Trace<KinGroup> = {};
  const add = (g: KinGroup, steps: CalcStep[]): void => { (trace[g] ??= []).push(...steps); };
  const res: FrameResult = { errors: [], notes: [], warnings: [], root: null, order: [], local: {}, abs: {}, path: {}, rel: null, relPose: null, iso: null, points: null, displaced: null, trace };
  const fail = (e: unknown): void => { res.errors.push(e instanceof KinematicsError ? e.message : String(e)); };
  let tree: ReturnType<typeof orderFrames>;
  try { tree = orderFrames(inp.frames); } catch (e) { fail(e); return res; }
  res.root = tree.root; res.order = tree.order; res.path = tree.path;
  const byId = new Map(inp.frames.map((f) => [f.id, f]));

  // ---------------- Lage je Rahmen relativ zum Bezugsrahmen
  for (const id of tree.order) {
    const f = byId.get(id)!;
    if (f.parent === null) { res.local[id] = IDENTITY; continue; }
    try {
      if (f.matrix) {
        const c = checkTransform(f.matrix, f.parent, f.id);
        add("lage", c.steps); res.notes.push(...c.notes);
        if (!c.value.valid) throw new KinematicsError(`Rahmen {${f.id}} (${f.name}): Matrix ist keine homogene Transformation (Toleranz 10⁻⁹)`);
        res.local[id] = splitMatrix(f.matrix, f.parent, f.id).value;
      } else if (f.rp) {
        const c = checkRotation(f.rp.R);
        add("lage", c.steps); res.notes.push(...c.notes);
        if (!c.value.valid) throw new KinematicsError(`Rahmen {${f.id}} (${f.name}): R ist keine Rotationsmatrix (Toleranz 10⁻⁹)`);
        const t = fromRp(f.rp.R, f.rp.p, f.parent, f.id);
        add("lage", t.steps); res.local[id] = t.value;
      } else if (f.pose) {
        const t = fromPose(f.pose, f.parent, f.id);
        add("lage", t.steps); res.local[id] = t.value;
      } else throw new KinematicsError(`Rahmen {${f.id}} (${f.name}): Lage fehlt`);
    } catch (e) { fail(e); }
  }
  if (res.errors.length) return res;
  for (const id of tree.order) {
    const f = byId.get(id)!;
    res.abs[id] = f.parent === null ? IDENTITY : se3.compose(res.abs[f.parent]!, res.local[id]!);
  }
  /** Kette Wurzel → id mit Rechenweg (G-16, G-16-N). */
  const chainTo = (id: string): Transform => {
    const p = tree.path[id]!;
    if (p.length < 2) return IDENTITY;
    if (p.length === 2) return res.local[id]!;   // ein Glied: T_0k ist die Eingabe selbst
    const c = chainT(p.slice(1).map((k) => res.local[k]!), p);
    add("kette", c.steps);
    return c.value;
  };
  const r0 = tree.root;

  try {
    // ---------------- relative Lage zweier Rahmen (G-20-R)
    if (inp.rel) {
      const { of, in: inn } = inp.rel;
      if (!byId.has(of) || !byId.has(inn)) throw new KinematicsError(`Relative Lage: Rahmen {${byId.has(of) ? inn : of}} gibt es nicht`);
      const Tro = chainTo(of);
      let T: Transform;
      if (inn === r0) T = Tro;
      else if (of === r0) {
        const inv = invertT(chainTo(inn), r0, inn); add("inverse", inv.steps);
        T = inv.value;
      } else {
        const Tri = chainTo(inn);
        const inv = invertT(Tri, r0, inn); add("inverse", inv.steps);
        const c = composeT(inv.value, Tro, inn, r0, of, true); add("kette", c.steps);
        T = c.value;
      }
      add("kette", [tStepRel(r0, inn, of, T)]);
      res.rel = T;
      const ps = toPose(T, inn, of); add("kette", ps.steps); res.notes.push(...ps.notes);
      res.relPose = ps.value;
      const bDeg = deg(ps.value.B);
      if (Math.abs(ps.value.B) !== Math.PI / 2 && 90 - Math.abs(bDeg) < 5)
        res.warnings.push(`Kardansperre nah (B = ${bDeg.toFixed(2).replace(".", ",")}°): A und C der relativen Pose ändern sich bei kleinen Änderungen stark.`);
    }

    // ---------------- ISO-Kette (G-20-K, G-20-A, G-20-F)
    const roleOf = (r: FrameDef["role"]): FrameDef | undefined => inp.frames.find((f) => f.role === r);
    const [w, b, m, t] = ISO_ROLES.map(roleOf);
    if (w && b && m && t) {
      if (w.parent !== null || b.parent !== w.id || m.parent !== b.id || t.parent !== m.id) {
        res.warnings.push("ISO-Kette: erwartet Welt → Basis → Flansch → Werkzeug als direkte Bezugsrahmen; Schritte G-20 entfallen.");
      } else {
        const T01 = res.local[b.id]!, T1m = res.local[m.id]!, Tmt = res.local[t.id]!;
        const c1 = composeT(T01, T1m, w.id, b.id, m.id, false), c2 = composeT(c1.value, Tmt, w.id, m.id, t.id, false);
        add("kette", [...c1.steps, ...c2.steps, isoStep("G-20-K", "Werkzeug in Welt (Rahmenkette ISO 9787)", "T_0t = T_01·T_1m·T_mt (Welt, Basis, Flansch, Werkzeug)",
          `${tName(w.id, t.id)} = ${tName(w.id, b.id)}·${tName(b.id, m.id)}·${tName(m.id, t.id)}`, c2.value,
          "ISO 9787:2013, 5.1 bis 5.4; Weber/Koch Kap. 2 (DH, Werkzeugsystem am letzten Gliedsystem); Lynch/Park S. 78")]);
        let Tkt: Transform | null = null;
        const k = roleOf("aufgabe");
        if (k) {
          const T0k = res.abs[k.id]!;
          if (k.parent !== w.id) add("kette", chainT(tree.path[k.id]!.slice(1).map((x) => res.local[x]!), tree.path[k.id]!).steps);
          const inv = invertT(T0k, w.id, k.id); add("inverse", inv.steps);
          const c = composeT(inv.value, c2.value, k.id, w.id, t.id, false); add("kette", c.steps);
          Tkt = c.value;
          add("kette", [isoStep("G-20-A", "Werkzeug im Aufgabensystem", "T_kt = T_0k⁻¹·T_0t (Lage des TCP im Aufgaben- bzw. BASE-System)",
            `${tName(k.id, t.id)} = ${tName(w.id, k.id)}⁻¹·${tName(w.id, t.id)}`, Tkt, "ISO 9787:2013, 5.6; Lynch/Park S. 78 (T_de = T_ed⁻¹)")]);
        }
        let T1mTarget: Transform | null = null;
        if (inp.tcpTarget) {
          const s = fromPose(inp.tcpTarget, w.id, t.id); add("lage", s.steps);
          const i1 = invertT(T01, w.id, b.id), i2 = invertT(Tmt, m.id, t.id); add("inverse", [...i1.steps, ...i2.steps]);
          const c = chainT([i1.value, s.value, i2.value], [b.id, w.id, t.id, m.id]);
          add("kette", c.steps);
          T1mTarget = c.value;
          add("kette", [isoStep("G-20-F", "Flansch-Soll aus TCP-Soll", "T_1m = T_01⁻¹·T_0t,soll·T_mt⁻¹ (Umstellen von G-20-K)",
            `${tName(b.id, m.id)},soll = ${tName(w.id, b.id)}⁻¹·${tName(w.id, t.id)},soll·${tName(m.id, t.id)}⁻¹`, T1mTarget, "G-20-K umgestellt; Lynch/Park Prop. 3.15, 3.17")]);
        }
        res.iso = { T0t: c2.value, Tkt, T1mTarget };
      }
    }

    // ---------------- Punkt oder Richtung (G-17, G-18) in allen Rahmen
    if (inp.point) {
      const { frame, v, kind } = inp.point;
      if (!byId.has(frame)) throw new KinematicsError(`Punkt: Rahmen {${frame}} gibt es nicht`);
      const map = kind === "punkt" ? transformPoint : transformDirection;
      const inRoot = map(res.abs[frame]!, v, r0, frame);
      if (frame !== r0) add("abbildung", inRoot.steps);
      const pts: Record<string, Vec3> = {};
      for (const id of tree.order) {
        if (id === frame) { pts[id] = [...v] as unknown as Vec3; continue; }
        if (id === r0) { pts[id] = inRoot.value; continue; }
        const inv = se3.invert(res.abs[id]!);
        pts[id] = kind === "punkt" ? se3.point(inv, inRoot.value) : map(inv, inRoot.value).value;
      }
      // Rechenweg zusätzlich für den Rahmen der relativen Lage (Ausgabe in {in})
      const tgt = inp.rel?.in;
      if (tgt && tgt !== r0 && tgt !== frame) {
        const inv = invertT(res.abs[tgt]!, r0, tgt); add("inverse", inv.steps);
        add("abbildung", map(inv.value, inRoot.value, tgt, r0).steps);
      }
      res.points = pts;
    }

    // ---------------- Verschieben fest oder mitgedreht (G-19)
    if (inp.displace) {
      const d = inp.displace;
      if (!byId.has(d.frame)) throw new KinematicsError(`Verschieben: Rahmen {${d.frame}} gibt es nicht`);
      const x = displace(res.abs[d.frame]!, { axis: d.axis, theta: d.theta, p: d.p }, d.mode, r0, d.frame);
      add("abbildung", x.steps); res.notes.push(...x.notes);
      res.displaced = x.value;
    }
  } catch (e) { fail(e); }
  return res;
}

function isoStep(id: string, title: string, formula: string, subst: string, T: Transform, ref: string): CalcStep {
  return { id, title, formula, subst: `${subst} = ${tStr(T)}`, value: Math.hypot(...T.p), unit: "m", ref, matrix: toMat4(T) };
}
function tStepRel(r: string, i: string, k: string, T: Transform): CalcStep {
  const s = i === r ? `${tName(i, k)} = ${tName(r, k)} (Bezug ist die Wurzel)` : k === r ? `${tName(i, k)} = ${tName(r, i)}⁻¹ (gesucht ist die Wurzel)` : `${tName(i, k)} = ${tName(r, i)}⁻¹·${tName(r, k)}`;
  return isoStep("G-20-R", "Relative Lage zweier Rahmen im Baum", "T_ik = T_ri⁻¹·T_rk (r = Wurzel; T_ri, T_rk als Ketten G-16-N)", s, T,
    "Lynch/Park S. 78 (T_de = T_ed⁻¹) und Bsp. 3.19; Weber/Koch Gl. (2.17)");
}

/** Alle Schritte eines Ergebnisses in Anzeigereihenfolge. */
export function frameSteps(r: FrameResult): CalcStep[] {
  return [...(r.trace.lage ?? []), ...(r.trace.kette ?? []), ...(r.trace.inverse ?? []), ...(r.trace.abbildung ?? [])];
}

// ---------------------------------------------------------------- Lernhilfe Schritt für Schritt (keine Formel-ID)
export interface ChainStage { label: string; from: string; to: string; before: Transform; after: Transform }
/**
 * Zwischenprodukte der Kette Wurzel → id: Stufe k zeigt T_0(k−1) → T_0k (gleiche Formeln wie G-16, ohne Rechenweg).
 * Für die Ansicht „Schritt für Schritt“: die Kette wächst Glied für Glied.
 */
export function chainStages(r: FrameResult, id: string): ChainStage[] {
  const p = r.path[id];
  if (!p || p.length < 2) return [];
  const out: ChainStage[] = [];
  let cur = IDENTITY;
  for (let k = 1; k < p.length; k++) {
    const next = se3.compose(cur, r.local[p[k]!]!);
    out.push({ label: `${k}. ${tName(p[0]!, p[k - 1]!)}·${tName(p[k - 1]!, p[k]!)} = ${tName(p[0]!, p[k]!)}`, from: p[k - 1]!, to: p[k]!, before: cur, after: next });
    cur = next;
  }
  return out;
}
