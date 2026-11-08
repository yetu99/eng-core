/**
 * Elastisch-plastischer Pressverband nach DIN 7190-1:2017 Abschn. 4.3 (Option, P10; Modul verbindungen, eng-core 0.17.0).
 * Voraussetzungen: volle Welle (Q_I = 0), gleiche E und μ, A ≥ 10 % (Gl. (8)); Z ≥ 30 % (Gl. (9)) nur als Hinweis.
 * ζ aus Gl. (32) exakt per Bisektion (200 Schritte auf [1, 1/Q_A]); Anhang B nur als Vergleich im Rechenweg.
 * Einheiten N, mm, MPa.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { REF_DIN } from "./fit";

const S3 = Math.sqrt(3);
/** Linke Seite von Gl. (32): 2·ln ζ − (Q_A·ζ)² + 1 − √3·p/R_eLA. */
export const eq32 = (zeta: number, QA: number, p: number, ReLA: number): number => 2 * Math.log(zeta) - (QA * zeta) ** 2 + 1 - S3 * p / ReLA;
/** Grenzfugendruck vollplastische Nabe (Gl. (27), (28)). */
export const pPA = (QA: number, ReLA: number): number => (QA < 1 / Math.E ? 2 * ReLA / S3 : -2 * ReLA * Math.log(QA) / S3);
/** Grenzfugendruck vollplastische Vollwelle (Gl. (30)). */
export const pPI = (ReLI: number): number => 2 * ReLI / S3;
/** Elastische Grenze der Nabe (linker Term Gl. (26)): p_el = (1 − Q_A²)·R_eLA/√3. */
export const pElastic = (QA: number, ReLA: number): number => (1 - QA * QA) * ReLA / S3;

/**
 * ζ aus Gl. (32) für p_el ≤ p ≤ p_max(Q_A) per Bisektion mit 200 Halbierungen auf [1, 1/Q_A]; null, wenn keine Lösung
 * im Bereich liegt (p unter der elastischen Grenze oder über dem Maximum bei ζ = 1/Q_A).
 */
export function solveZeta(QA: number, p: number, ReLA: number): number | null {
  let a = 1, b = 1 / QA;
  const fa = eq32(a, QA, p, ReLA), fb = eq32(b, QA, p, ReLA);
  if (Math.abs(fa) <= 1e-15) return 1;
  if (fa > 0 || fb < 0) return null;   // eq32 steigt monoton auf [1, 1/Q_A]
  for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (eq32(m, QA, p, ReLA) < 0) a = m; else b = m; }
  return (a + b) / 2;
}
/** Näherung nach DIN 7190-1 Anhang B (Startwert 1, Abbruch |Δζ| < 0,001), nur Vergleich. */
export function zetaAnnexB(QA: number, p: number, ReLA: number): { zeta: number; steps: number[] } {
  let z = 1; const steps: number[] = [];
  for (let j = 0; j < 100; j++) {
    const zn = z * (1 - (2 * Math.log(z) - (QA * z) ** 2 + 1 - 1.732 * p / ReLA) / (2 * (1 - (QA * z) ** 2)));
    steps.push(zn); if (Math.abs(zn - z) < 0.001) return { zeta: zn, steps };
    z = zn;
  }
  return { zeta: z, steps };
}
/** ξ_w aus ζ (Gl. (34)). */
export const xiOfZeta = (zeta: number, ReLA: number, E: number): number => 2 / S3 * zeta * zeta * ReLA / E;
/** ζ aus ξ_w (Gl. (42)). */
export const zetaOfXi = (xi: number, ReLA: number, E: number): number => Math.sqrt(S3 * xi * E / (2 * ReLA));
/** Fugendruck aus ζ (Gl. (43)). */
export const pOfZeta = (zeta: number, QA: number, ReLA: number): number => ReLA / S3 * (1 + 2 * Math.log(zeta) - (QA * zeta) ** 2);
/** Plastischer Flächenanteil der Nabe (Gl. (35)). */
export const qPA = (zeta: number, QA: number): number => (zeta * zeta - 1) * QA * QA / (1 - QA * QA);

export interface PlasticLimits { pPA: number; pPI: number; pEl: number; pZul: number; fall: 1 | 2; zetaZul: number | null; xiEl: number; xiZul: number | null; possible: boolean; reason: string | null }

/** Grenzen der elastisch-plastischen Auslegung (Gl. (26) bis (30), (36) bis (41)). */
export function plasticLimits(QA: number, ReLA: number, ReLI: number, SPA: number, SPI: number, E: number, S: CalcStep[]): PlasticLimits {
  const a = pPA(QA, ReLA), b = pPI(ReLI), pEl = pElastic(QA, ReLA);
  const fall: 1 | 2 = b / SPI <= a / SPA ? 1 : 2, pZul = fall === 1 ? b / SPI : a / SPA;
  S.push(step("PV-EP-PPA", "Grenzfugendruck vollplastische Nabe", QA < 1 / Math.E ? "p_PA = 2·R_eLA/√3 (Q_A < 1/e)" : "p_PA = −2·R_eLA·ln Q_A/√3 (Q_A ≥ 1/e)",
    QA < 1 / Math.E ? `p_PA = 2·${fmt(ReLA)}/√3 = ${fmt(a)} N/mm²` : `p_PA = −2·${fmt(ReLA)}·ln ${fmt(QA)}/√3 = ${fmt(a)} N/mm²`, a, "N/mm²", `${REF_DIN} Gl. (27), (28)`));
  S.push(step("PV-EP-PPI", "Grenzfugendruck vollplastische Vollwelle", "p_PI = 2·R_eLI/√3", `p_PI = 2·${fmt(ReLI)}/√3 = ${fmt(b)} N/mm²`, b, "N/mm²", `${REF_DIN} Gl. (30)`));
  const g36 = (1 - QA * QA) * ReLA / 2 >= ReLI;
  const zz = g36 ? null : solveZeta(QA, pZul, ReLA);
  const xiEl = 2 / S3 * ReLA / E, xiZul = zz === null ? null : xiOfZeta(zz, ReLA, E);
  if (zz !== null) S.push(step("PV-EP-ZZUL", "Zulässiger bezogener Plastizitätsdurchmesser", `ζ_zul aus Gl. (32) mit p = ${fall === 1 ? "p_PI/S_PI (Fall 1)" : "p_PA/S_PA (Fall 2)"}`,
    `p = min(${fmt(b)}/${fmt(SPI)}; ${fmt(a)}/${fmt(SPA)}) = ${fmt(pZul)} N/mm² → ζ_zul = ${fmt(zz, 6)}; ξ_w,zul = 2/√3·ζ_zul²·R_eLA/E = ${fmt(xiZul! * 1e3, 5)}·10⁻³`, zz, "1", `${REF_DIN} Gl. (37) bis (41)`));
  const reason = g36 ? `Gl. (36): (1 − Q_A²)·R_eLA/2 = ${fmt((1 - QA * QA) * ReLA / 2)} ≥ R_eLI = ${fmt(ReLI)} N/mm², die Welle wird vor der Nabe vollplastisch`
    : zz === null ? `zulässiger Fugendruck ${fmt(pZul)} N/mm² liegt unter der elastischen Grenze der Nabe ${fmt(pEl)} N/mm²` : null;
  return { pPA: a, pPI: b, pEl, pZul, fall, zetaZul: zz, xiEl, xiZul, possible: reason === null, reason };
}

/** ζ und ξ_w für einen vorgegebenen Fugendruck (Rechengang 1, Gl. (32), (34)), mit Vergleich Anhang B. */
export function plasticFromPressure(QA: number, p: number, ReLA: number, E: number, S: CalcStep[]): { zeta: number; xi: number } | null {
  const z = solveZeta(QA, p, ReLA); if (z === null) return null;
  const b = zetaAnnexB(QA, p, ReLA), xi = xiOfZeta(z, ReLA, E);
  S.push(step("PV-EP-ZETA", "Bezogener Plastizitätsdurchmesser", "2·ln ζ − (Q_A·ζ)² + 1 − √3·p/R_eLA = 0, 1 ≤ ζ ≤ 1/Q_A",
    `p = ${fmt(p)} N/mm², Q_A = ${fmt(QA)}: ζ = ${fmt(z, 6)} (Bisektion, Rest ${fmt(eq32(z, QA, p, ReLA), 2)}); Anhang B: ${b.steps.map((s) => fmt(s, 5)).join("; ")} (Abweichung ${fmt(b.zeta - z, 2)})`, z, "1", `${REF_DIN} Gl. (31) bis (33), Anhang B`));
  S.push(step("PV-EP-XI", "Bezogenes wirksames Übermaß aus ζ", "ξ_w = 2/√3·ζ²·R_eLA/E", `ξ_w = 2/√3·${fmt(z, 6)}²·${fmt(ReLA)}/${fmt(E)} = ${fmt(xi * 1e3, 5)}·10⁻³`, xi, "1", `${REF_DIN} Gl. (34)`));
  return { zeta: z, xi };
}

/** Fugendruck für ein vorgegebenes ξ_w im elastisch-plastischen Bereich (Rechengang 2, Gl. (42), (43), (35)). */
export function plasticFromXi(QA: number, xi: number, ReLA: number, E: number, S: CalcStep[], tag: string): { zeta: number; p: number; q: number } {
  const z = zetaOfXi(xi, ReLA, E), p = pOfZeta(z, QA, ReLA), q = qPA(z, QA);
  S.push(step("PV-EP-ZU", "ζ aus ξ_w", "ζ = √(√3·ξ_w·E/(2·R_eLA))", `${tag}: ζ = √(√3·${fmt(xi * 1e3, 5)}·10⁻³·${fmt(E)}/(2·${fmt(ReLA)})) = ${fmt(z, 6)}`, z, "1", `${REF_DIN} Gl. (42)`));
  S.push(step("PV-EP-P", "Fugendruck elastisch-plastisch", "p = R_eLA/√3·[1 + 2·ln ζ − (Q_A·ζ)²]", `${tag}: p = ${fmt(ReLA)}/√3·[1 + 2·ln ${fmt(z, 6)} − (${fmt(QA)}·${fmt(z, 6)})²] = ${fmt(p)} N/mm²`, p, "N/mm²", `${REF_DIN} Gl. (43)`));
  S.push(step("PV-EP-QPA", "Plastischer Flächenanteil der Nabe", "q_PA/q_A = (ζ² − 1)·Q_A²/(1 − Q_A²)", `${tag}: q_PA/q_A = (${fmt(z, 6)}² − 1)·${fmt(QA)}²/(1 − ${fmt(QA)}²) = ${fmt(q)}`, q, "1", `${REF_DIN} Gl. (35)`));
  return { zeta: z, p, q };
}
