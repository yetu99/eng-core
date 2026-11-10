/**
 * Auslegung, Datenblatt und nicht vorgespannte Schraube (Modul verbindungen, Präfix SV, eng-core 0.18.0), Konzept Abschn. 4.10, 14a.
 *   selectBolts (SV-WAHL, S6): alle Regelgewinde M4 bis M39 × 8.8, 10.9, 12.9 mit Geometrie aus der Norm durchrechnen,
 *     gültig, wenn alle Pflichtnachweise erfüllt sind; sortiert nach d, dann Klasse; kleinste gültige Lösung vorgeschlagen.
 *   boltDatasheet (N2, N3): Maße eines Normteils mit Herkunft, Kennwerte A_s, A_d3, d₂, d₃, P, F_M,zul und M_A je Klasse und μ.
 *   computeBoltUnpreloaded (SV-NV): nicht vorgespannte Schraube nach Roloff (8.38).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import {
  counterboreOf, gradeOf, holeOf, partOf, svRegularSizes, threadLengthB, threadOf, SV_GRADES_SELECT,
  type FdBoltGeometry, type FdCounterbore, type FdThread, type SvNorm, type SvRepo,
} from "./boltData";
import { SV_REF_ROLOFF, threadProps, type ThreadProps } from "./thread";
import { fmZul, tighteningTorque } from "./tighten";
import { computeBoltJoint, svAllRequiredOk, type BoltJointInput, type SvCheckKey } from "./bolt";

export type BoltCandidateStatus = "gültig" | "ungültig" | "nicht bewertbar";
export interface BoltCandidate { d: number; grade: string; /** Längenbedarf und gewählte Normlänge (SV-WAHL) */ lNeed: number | null; /** U8: gültig, ungültig (Fehler oder Nachweis nicht erfüllt) oder nicht bewertbar (Kennwert fehlt) */ status: BoltCandidateStatus; reason: string; valid: boolean; length: number | null; FMzul: number | null; FMmax: number | null; MA: number | null; reserve: number | null; failed: SvCheckKey[]; error: string | null }

/** Eingabe einer Kandidatengröße: Geometrie, Länge und Schaft aus der Norm, Klasse aus der Liste. */
export function candidateInput(inp: BoltJointInput, d: number, grade: string): BoltJointInput {
  return { ...inp, task: "A", d, threadId: null, grade, gradeManual: null, length: null, shank: null, taper: null, dW: null, dh: null, dha: null, dWcone: null, mGes: null, kef: null };
}

/**
 * Abbruch der Auslegung (U8, Seti 09.11.2026): fehlt eine von d unabhängige Grenzflächenpressung (Platte Kopf- bzw. Mutterseite,
 * Scheibe), wäre jede Größe nicht bewertbar; die Auslegung bricht dann mit Hinweis ab, statt alle Größen zu verwerfen.
 */
export function selectAbortReason(inp: BoltJointInput): string | null {
  const miss: string[] = [];
  if ((inp.pGHead ?? inp.plates[0]?.pG ?? null) === null) miss.push("Platte Kopfseite");
  if (inp.joint === "DSV" && (inp.pGNut ?? inp.plates[inp.plates.length - 1]?.pG ?? null) === null) miss.push("Platte Mutterseite");
  if ((inp.washerHead || (inp.joint === "DSV" && inp.washerNut)) && inp.pGWasher === null) miss.push("Scheibe ISO 7089");
  return miss.length ? `p_G fehlt (${miss.join(", ")}), von Hand eingeben` : null;
}

/** Auslegung SV-WAHL: alle Größen × Klassen, Reihenfolge nach d, dann 8.8, 10.9, 12.9. */
export function selectBolts(fd: SvRepo, inp: BoltJointInput): BoltCandidate[] {
  const out: BoltCandidate[] = [];
  for (const d of svRegularSizes(fd)) for (const grade of SV_GRADES_SELECT) {
    const r = computeBoltJoint(fd, candidateInput(inp, d, grade));
    if (r.errors.length) { out.push({ d, grade, lNeed: null, status: "ungültig", reason: r.errors[0]!, valid: false, length: null, FMzul: null, FMmax: null, MA: null, reserve: null, failed: [], error: r.errors[0]! }); continue; }
    const req = r.checks.filter((c) => c.required), bad = req.filter((c) => c.ok === false), open = req.filter((c) => c.ok === null);
    const status: BoltCandidateStatus = bad.length ? "ungültig" : open.length ? "nicht bewertbar" : "gültig";
    const reason = bad.length ? `nicht erfüllt: ${bad.map((c) => c.label).join(", ")}` : open.length ? open.map((c) => `${c.label}: ${c.text}`).join("; ") : "";
    out.push({ d, grade, lNeed: r.geo!.lNeed?.need ?? null, status, reason, valid: status === "gültig" && svAllRequiredOk(r), length: r.geo!.length, FMzul: r.FMzul, FMmax: r.FMmax, MA: r.MA, reserve: r.kpis[0]!.value, failed: [...bad, ...open].map((c) => c.key), error: null });
  }
  return out;
}

export function wahlStep(inp: BoltJointInput, list: readonly BoltCandidate[], abort: string | null = null): CalcStep {
  const ok = list.filter((c) => c.valid), first = ok[0], nb = list.filter((c) => c.status === "nicht bewertbar").length;
  const all = ok.map((c) => `M${fmt(c.d)} ${c.grade}×${c.length !== null ? fmt(c.length) : "?"} (Bedarf ${c.lNeed !== null ? fmt(c.lNeed) : "?"} mm, M_A ${fmt(c.MA! / 1e3)} N·m)`).join("; ");
  return step("SV-WAHL", "Auslegung: gültige Schrauben", "Aufzählung M4 bis M39 × 8.8, 10.9, 12.9 mit Geometrie aus der Norm; Länge = kleinste Normlänge der Norm (fd_bolt_geometry) mit l ≥ l_K + m + 2·P (DSV: Mutterhöhe m ISO 4032, Überstand 2·P) bzw. l ≥ l_K + l_e + 2·P (ESV, l_e TB 8-15, sonst 1,25·d) und Schaft l − b ≤ l_K (ISO 4014: b für l ≤ 125, ≤ 200, > 200 mm); je Größe gültig (alle Pflichtnachweise erfüllt), ungültig oder nicht bewertbar (Kennwert fehlt); sortiert nach d, dann Klasse; fehlt p_G einer Platte oder Scheibe: Abbruch mit Hinweis",
    abort ? `${inp.norm}, ${inp.joint}: Auslegung abgebrochen, ${abort}` : `${inp.norm}, ${inp.joint}: ${ok.length} von ${list.length} gültig${nb ? `, ${nb} nicht bewertbar` : ""}${first ? `; kleinste M${fmt(first.d)} ${first.grade}` : ""}${all ? `; alle gültigen: ${all}` : ""}`, first ? first.d : 0, "mm", "Verfahren (S6, U8)");
}

// ---------------------------------------------------------------- Datenblatt Normteil (N2, N3, G3)
export const SV_DATASHEET_MU = [0.08, 0.1, 0.12, 0.14, 0.16] as const;
export interface BoltDatasheet {
  d: number; norm: SvNorm; thread: FdThread; props: ThreadProps;
  head: FdBoltGeometry | null; nut: FdBoltGeometry | null; washer: FdBoltGeometry | null;
  holes: { fein: number | null; mittel: number | null; grob: number | null }; counterbore: FdCounterbore | null;
  length: number | null; b: number | null; lengths: number[];
  /** F_M,zul (ν = 0,9) und M_A (μ_G = μ_K, D_Km mit Loch mittel) je Klasse und Reibungszahl; Kern-Formeln SV-FMZUL, SV-MA */
  grades: Array<{ grade: string; Rp: number; Rm: number; rows: Array<{ mu: number; FMzul: number; MA: number }> }>;
  sources: Array<{ part: string; source_id: string; source_locator: string }>;
}
/** Datenblatt einer Schraube (Maße mit Herkunft aus fd 1.3, keine neue Formel). null, wenn Gewinde oder Norm fehlen. */
export function boltDatasheet(fd: SvRepo, d: number, norm: "ISO 4014" | "ISO 4017" | "ISO 4762", opts: { length?: number | null; threadId?: string | null } = {}): BoltDatasheet | null {
  const t = threadOf(fd, d, opts.threadId ?? null); if (!t) return null;
  const T = threadProps(t), length = opts.length ?? null;
  const head = partOf(fd, norm, d, length), nut = partOf(fd, "ISO 4032", d), washer = partOf(fd, "ISO 7089", d);
  const holes = { fein: holeOf(fd, d, "fein"), mittel: holeOf(fd, d, "mittel"), grob: holeOf(fd, d, "grob") };
  const cb = counterboreOf(fd, norm === "ISO 4762" ? "zylinder" : "sechskant", d);
  const lengths = [...new Set(fd.geometry.filter((g) => g.norm === norm && g.d_mm === d).flatMap((g) => g.l_series))].sort((a, b) => a - b);
  const DKm = head?.dw_min_mm != null && holes.mittel !== null ? (head.dw_min_mm + holes.mittel) / 2 : null;
  const grades = SV_GRADES_SELECT.map((g) => gradeOf(fd, g, d)).filter((g) => g !== null).map((g) => ({
    grade: g!.grade, Rp: g!.yield_min_mpa, Rm: g!.rm_min_mpa,
    rows: SV_DATASHEET_MU.map((m) => { const F = fmZul(T, T.dS, 0.9, g!.yield_min_mpa, m); return { mu: m, FMzul: F, MA: DKm !== null ? tighteningTorque(F, T, m, DKm, m) : NaN }; }),
  }));
  const sources = [["Gewinde", t], ["Schraube", head], ["Mutter", nut], ["Scheibe", washer], ["Senkung", cb]].filter(([, r]) => r)
    .map(([p, r]) => ({ part: p as string, source_id: (r as { source_id: string }).source_id, source_locator: (r as { source_locator: string }).source_locator }));
  return { d, norm, thread: t, props: T, head, nut, washer, holes, counterbore: cb, length, b: head && length !== null ? threadLengthB(head, length) : null, lengths, grades, sources };
}

// ---------------------------------------------------------------- nicht vorgespannte Schraube (SV-NV)
export interface UnpreloadedResult { AsErf: number; S: number; Rp: number; d: number | null; steps: CalcStep[]; errors: string[] }
/** A_s ≥ F/(R_p0,2/S), S = 1,25 (ohne Last angezogen) bzw. 1,5 (unter Last angezogen), Roloff (8.38). */
export function computeBoltUnpreloaded(fd: SvRepo, F: number, grade: string, underLoad: boolean): UnpreloadedResult {
  const errors: string[] = [], S = underLoad ? 1.5 : 1.25;
  if (!(F > 0)) errors.push("Axialkraft F muss größer als 0 sein.");
  const g = gradeOf(fd, grade, 39); if (!g) errors.push(`Festigkeitsklasse ${grade} nicht in den Fachdaten.`);
  if (errors.length) return { AsErf: NaN, S, Rp: NaN, d: null, steps: [], errors };
  // kleinste Größe mit A_s ≥ A_s,erf; R_p0,2 je Größenbereich (8.8: 640 bis M16, 660 darüber)
  let hit: number | null = null, AsErf = NaN, Rp = NaN;
  for (const d of svRegularSizes(fd)) {
    const gr = gradeOf(fd, grade, d); if (!gr) continue;
    const A = F * S / gr.yield_min_mpa, T = threadProps(threadOf(fd, d)!);
    if (Number.isNaN(AsErf)) { AsErf = A; Rp = gr.yield_min_mpa; }
    if (T.As >= A - 1e-12) { hit = d; AsErf = A; Rp = gr.yield_min_mpa; break; }
  }
  const s = step("SV-NV", "Nicht vorgespannte Schraube", "A_s ≥ F/(R_p0,2/S), S = 1,25 bzw. 1,5 unter Last angezogen",
    `A_s ≥ ${fmt(F)}/(${fmt(Rp)}/${fmt(S)}) = ${fmt(AsErf)} mm²${hit !== null ? ` → M${fmt(hit)} ${grade}` : " → keine Größe bis M39"}`, AsErf, "mm²", `${SV_REF_ROLOFF} (8.38)`);
  return { AsErf, S, Rp, d: hit, steps: [s], errors };
}
