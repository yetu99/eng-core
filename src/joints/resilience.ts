/**
 * Nachgiebigkeiten von Schraube und verspannten Teilen (Modul verbindungen, Präfix SV, eng-core 0.18.0), Konzept Abschn. 4.2.
 * Schraube: Ersatzlängen nach VDI 2230-1 Abschn. 5.1.1 (Kopf 0,5·d bzw. 0,4·d, eingeschraubtes Gewinde 0,5·d, Mutter 0,4·d,
 * Innengewinde 0,33·d). Platten: Verformungskegel und Hülse nach VDI Gl. (39) bis (49) (S3), Teilkörper bei bis drei E-Moduln
 * (VDI S. 48 Hinweis 3) als Summe der Kegelstumpf- und Hülsenabschnitte; Vergleich Hohlzylinder nach Roloff (8.9), (8.10).
 * Einheiten: Längen mm, E N/mm², Nachgiebigkeit mm/N (Anzeige µm/kN = 10⁶·mm/N).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { SV_REF_ROLOFF, SV_REF_VDI, type ThreadProps } from "./thread";

/** Schaftelement l_i mit Durchmesser d_i (Schaft d, Dehnschaft d_T). */
export interface ShankElement { l: number; d: number }
/** Verspannte Platte bzw. Scheibe (von Kopf zur Mutter bzw. zum Einschraubteil), Dicke h, E-Modul. */
export interface PlateLayer { h: number; E: number; label?: string }
export type SvJointType = "DSV" | "ESV";

const mu = (x: number) => fmt(x * 1e6, 5);   // mm/N → µm/kN

export interface BoltResilience { dSK: number; dI: number[]; dGew: number; dG: number; dM: number; dS: number; lSK: number; lM: number; EM: number }
/**
 * δ_S = δ_SK + Σδ_i + δ_Gew + δ_G + δ_M (VDI Gl. (19), Roloff (8.7)). Kopf: l_SK = 0,5·d (Sechskant) bzw. 0,4·d (Innensechskant).
 * Mutter (DSV): l_M = 0,4·d mit E_M = E_S; Innengewinde (ESV): l_M = 0,33·d mit E_M = E_BI (VDI S. 40).
 */
export function boltResilience(T: ThreadProps, ES: number, hexHead: boolean, shank: readonly ShankElement[], lGew: number, joint: SvJointType, EBI: number, out: CalcStep[]): BoltResilience {
  const lSK = (hexHead ? 0.5 : 0.4) * T.d, dSK = lSK / (ES * T.AN);
  out.push(step("SV-DSK", "Nachgiebigkeit Schraubenkopf", `δ_SK = l_SK/(E_S·A_N), l_SK = ${hexHead ? "0,5" : "0,4"}·d (${hexHead ? "Sechskant" : "Innensechskant"})`,
    `δ_SK = ${fmt(lSK)}/(${fmt(ES)}·${fmt(T.AN)}) = ${mu(dSK)} µm/kN`, dSK, "mm/N", `${SV_REF_VDI} Abschn. 5.1.1 (S. 40 f.); ${SV_REF_ROLOFF} (8.8)`));
  const dI = shank.map((e, i) => {
    const A = Math.PI / 4 * e.d * e.d, v = e.l / (ES * A);
    out.push(step("SV-DI", `Nachgiebigkeit Schaftelement ${i + 1}`, "δ_i = l_i/(E_S·A_i), A_i = π/4·d_i²", `δ_${i + 1} = ${fmt(e.l)}/(${fmt(ES)}·π/4·${fmt(e.d)}²) = ${mu(v)} µm/kN`, v, "mm/N", `${SV_REF_VDI} Abschn. 5.1.1; ${SV_REF_ROLOFF} (8.8)`));
    return v;
  });
  const dGew = lGew / (ES * T.Ad3);
  out.push(step("SV-DGEW", "Nachgiebigkeit freies Gewinde", "δ_Gew = l_Gew/(E_S·A_d3)", `δ_Gew = ${fmt(lGew)}/(${fmt(ES)}·${fmt(T.Ad3)}) = ${mu(dGew)} µm/kN`, dGew, "mm/N", `${SV_REF_VDI} Abschn. 5.1.1 (S. 40)`));
  const dG = 0.5 * T.d / (ES * T.Ad3);
  out.push(step("SV-DG", "Nachgiebigkeit eingeschraubtes Gewinde", "δ_G = 0,5·d/(E_S·A_d3)", `δ_G = 0,5·${fmt(T.d)}/(${fmt(ES)}·${fmt(T.Ad3)}) = ${mu(dG)} µm/kN`, dG, "mm/N", `${SV_REF_VDI} Abschn. 5.1.1 (S. 40)`));
  const esv = joint === "ESV", lM = (esv ? 0.33 : 0.4) * T.d, EM = esv ? EBI : ES, dM = lM / (EM * T.AN);
  out.push(step("SV-DM", esv ? "Nachgiebigkeit Innengewinde (ESV)" : "Nachgiebigkeit Mutter (DSV)", `δ_M = l_M/(E_M·A_N), l_M = ${esv ? "0,33·d, E_M = E_BI" : "0,4·d, E_M = E_S"}`,
    `δ_M = ${fmt(lM)}/(${fmt(EM)}·${fmt(T.AN)}) = ${mu(dM)} µm/kN`, dM, "mm/N", `${SV_REF_VDI} Abschn. 5.1.1 (S. 40)`));
  const dS = dSK + dI.reduce((a, b) => a + b, 0) + dGew + dG + dM;
  out.push(step("SV-DS", "Nachgiebigkeit der Schraube", "δ_S = δ_SK + Σδ_i + δ_Gew + δ_G + δ_M",
    `δ_S = ${mu(dSK)} + ${dI.map(mu).join(" + ") || "0"} + ${mu(dGew)} + ${mu(dG)} + ${mu(dM)} = ${mu(dS)} µm/kN`, dS, "mm/N", `${SV_REF_VDI} Gl. (19); ${SV_REF_ROLOFF} (8.7)`));
  return { dSK, dI, dGew, dG, dM, dS, lSK, lM, EM };
}

/** tan φ des Verformungskegels: ESV Gl. (42), DSV Gl. (43); β_L = l_K/d_W, y = D′_A/d_W. */
export function coneTan(model: SvJointType, lK: number, dW: number, DAp: number): number {
  const bL = lK / dW, y = DAp / dW;
  return model === "ESV" ? 0.348 + 0.013 * Math.log(bL) + 0.193 * Math.log(y) : 0.362 + 0.032 * Math.log(bL / 2) + 0.153 * Math.log(y);
}
/** Nachgiebigkeit eines Kegelstumpfs vom Außendurchmesser D1 bis D2 (D wächst mit 2·tan φ je Länge), Bohrung d_h. */
export const frustum = (D1: number, D2: number, dh: number, E: number, t: number): number =>
  Math.log((D1 + dh) * (D2 - dh) / ((D1 - dh) * (D2 + dh))) / (E * Math.PI * dh * t);
/** Nachgiebigkeit einer Hülse (Hohlzylinder D_A, d_h) der Länge l. */
export const sleeve = (l: number, DA: number, dh: number, E: number): number => 4 * l / (E * Math.PI * (DA * DA - dh * dh));

export type PlateCase = "kegel" | "kegel-huelse" | "huelse";
export interface PlateResilience {
  model: "kegel" | "hohlzylinder"; coneModel: SvJointType; w: 1 | 2; tanPhi: number; DAGr: number; lV: number; lH: number; case: PlateCase;
  dP: number; /** Kegel und Hülse nach VDI (immer gerechnet, auch beim Modell Hohlzylinder) */ dPK: number; /** Teilkörper je Platte (Summe = δ_P) */ parts: number[];
  /** Hohlzylinder (Vergleich bzw. Modell) */ Aers: number | null; x: number | null; dPHZ: number | null;
}

/**
 * Teilnachgiebigkeiten des Verformungskörpers über die Platten (VDI S. 48 Hinweis 3): Außendurchmesser
 * D(s) = d_W + 2·s·tan φ mit s = Abstand zur nächsten Auflage (DSV, w = 1, zwei Kegel bis l_K/2) bzw. zur Kopfauflage
 * (ESV, w = 2), begrenzt auf D_A (Hülse). Jede Platte wird an den Knickstellen l_V, l_K/2, l_K − l_V geteilt.
 */
export function coneLayers(layers: readonly PlateLayer[], dW: number, dh: number, DA: number, w: 1 | 2, t: number): number[] {
  const lK = layers.reduce((a, l) => a + l.h, 0);
  const lV = DA > dW ? (DA - dW) / (2 * t) : 0;
  const breaks = new Set<number>([0, lK]);
  if (w === 1) { breaks.add(lK / 2); if (lV < lK / 2) { breaks.add(lV); breaks.add(lK - lV); } } else if (lV < lK) breaks.add(lV);
  const pts = [...breaks].filter((z) => z >= 0 && z <= lK).sort((a, b) => a - b);
  const sOf = (z: number) => (w === 1 ? Math.min(z, lK - z) : z);
  let z0 = 0;
  return layers.map((L) => {
    const a = z0, b = z0 + L.h; z0 = b;
    const cuts = [a, ...pts.filter((z) => z > a && z < b), b];
    let s = 0;
    for (let i = 0; i < cuts.length - 1; i++) {
      const za = cuts[i]!, zb = cuts[i + 1]!, sa = sOf(za), sb = sOf(zb), sm = sOf((za + zb) / 2);
      if (sm >= lV) s += sleeve(zb - za, DA, dh, L.E);
      else { const lo = Math.min(sa, sb), hi = Math.max(sa, sb); s += frustum(dW + 2 * lo * t, dW + 2 * hi * t, dh, L.E, t); }
    }
    return s;
  });
}

/** Hohlzylinder nach Roloff (8.9), (8.10): D′_A = min(D_A, d_w + l_K), x = ∛(l_K·d_w/D′_A²). */
export function hollowCylinder(dW: number, dh: number, DA: number, lK: number): { Aers: number; x: number | null; DAe: number } {
  if (DA <= dW) return { Aers: Math.PI / 4 * (DA * DA - dh * dh), x: null, DAe: DA };
  const DAe = Math.min(DA, dW + lK), x = Math.cbrt(lK * dW / (DAe * DAe));
  return { Aers: Math.PI / 4 * (dW * dW - dh * dh) + Math.PI / 8 * dW * (DAe - dW) * ((x + 1) * (x + 1) - 1), x, DAe };
}

/**
 * Nachgiebigkeit der verspannten Teile: Kegel und Hülse nach VDI (Standard) oder Hohlzylinder nach Roloff (Umschalter, B-sv4).
 * coneModel: Verformungsmodell für w und tan φ (B-sv5, z. B. ESV mit DSV-Näherung in VDI B1), unabhängig von der Verbindungsart.
 */
export function plateResilience(layers: readonly PlateLayer[], dW: number, dh: number, DA: number, DAp: number, coneModel: SvJointType, model: "kegel" | "hohlzylinder", out: CalcStep[]): PlateResilience {
  const lK = layers.reduce((a, l) => a + l.h, 0), w: 1 | 2 = coneModel === "ESV" ? 2 : 1;
  const t = coneTan(coneModel, lK, dW, DAp), DAGr = dW + w * lK * t;
  const bL = lK / dW, y = DAp / dW;
  out.push(step("SV-TANPHI", `Kegelwinkel (${coneModel === "ESV" ? "ESV, Gl. (42)" : "DSV, Gl. (43)"})`,
    coneModel === "ESV" ? "tan φ_E = 0,348 + 0,013·ln β_L + 0,193·ln y; β_L = l_K/d_W, y = D′_A/d_W" : "tan φ_D = 0,362 + 0,032·ln(β_L/2) + 0,153·ln y; β_L = l_K/d_W, y = D′_A/d_W",
    `β_L = ${fmt(lK)}/${fmt(dW)} = ${fmt(bL, 5)}; y = ${fmt(DAp)}/${fmt(dW)} = ${fmt(y, 5)}; tan φ = ${fmt(t, 5)}`, t, "1", `${SV_REF_VDI} Gl. (42), (43)`));
  out.push(step("SV-DAGR", "Grenzdurchmesser des Verformungskegels", "D_A,Gr = d_W + w·l_K·tan φ (w = 1 DSV, 2 ESV)", `D_A,Gr = ${fmt(dW)} + ${w}·${fmt(lK)}·${fmt(t, 5)} = ${fmt(DAGr)} mm`, DAGr, "mm", `${SV_REF_VDI} Gl. (39)`));
  const parts = coneLayers(layers, dW, dh, DA, w, t), dPK = parts.reduce((a, b) => a + b, 0);
  const lVraw = DA > dW ? (DA - dW) / (2 * t) : 0, lV = Math.min(lVraw, w * lK / 2), lH = lK - 2 * lV / w;
  const kase: PlateCase = dW >= DA ? "huelse" : DA >= DAGr ? "kegel" : "kegel-huelse";
  const one = layers.every((l) => Math.abs(l.E - layers[0]!.E) <= 1e-12 * layers[0]!.E), E = layers[0]!.E;
  if (one) {
    if (kase === "kegel") {
      const v = 2 * Math.log((dW + dh) * (dW + w * lK * t - dh) / ((dW - dh) * (dW + w * lK * t + dh))) / (w * E * Math.PI * dh * t);
      out.push(step("SV-DP-K", "Nachgiebigkeit Platten, Kegel (D_A ≥ D_A,Gr)", "δ_P = 2·ln[((d_W + d_h)(d_W + w·l_K·tan φ − d_h))/((d_W − d_h)(d_W + w·l_K·tan φ + d_h))]/(w·E_P·π·d_h·tan φ)",
        `δ_P = 2·ln[(${fmt(dW + dh)}·${fmt(dW + w * lK * t - dh)})/(${fmt(dW - dh)}·${fmt(dW + w * lK * t + dh)})]/(${w}·${fmt(E)}·π·${fmt(dh)}·${fmt(t, 5)}) = ${mu(v)} µm/kN`, v, "mm/N", `${SV_REF_VDI} Gl. (40)`));
    } else if (kase === "kegel-huelse") {
      const dV = frustum(dW, dW + 2 * lV * t, dh, E, t), dH = sleeve(lH, DA, dh, E), v = 2 / w * dV + dH;
      out.push(step("SV-DP-KH", "Nachgiebigkeit Platten, Kegel und Hülse (d_W < D_A < D_A,Gr)", "l_V = (D_A − d_W)/(2·tan φ), l_H = l_K − 2·l_V/w, δ_P = 2/w·δ_P^V + δ_P^H",
        `l_V = ${fmt(lV)} mm, l_H = ${fmt(lH)} mm; δ_P^V = ${mu(dV)}, δ_P^H = ${mu(dH)}; δ_P = ${mu(v)} µm/kN`, v, "mm/N", `${SV_REF_VDI} Gl. (41), (44) bis (49) (S. 47)`));
    } else {
      const v = sleeve(lK, DA, dh, E);
      out.push(step("SV-DP-H", "Nachgiebigkeit Platten, nur Hülse (d_W ≥ D_A)", "δ_P = 4·l_K/(E_P·π·(D_A² − d_h²))", `δ_P = 4·${fmt(lK)}/(${fmt(E)}·π·(${fmt(DA)}² − ${fmt(dh)}²)) = ${mu(v)} µm/kN`, v, "mm/N", `${SV_REF_VDI} Abschn. 5.1.2, Gl. (49)`));
    }
  } else {
    out.push(step("SV-DP-T", "Nachgiebigkeit Platten, Teilkörper mit eigenem E", "Zerlegung nach l_i, d_W,i = d_W + 2·tan φ·Σl_j, δ_P = Σ δ_P,i (Kegelstumpf bzw. Hülse je Abschnitt)",
      `${layers.map((l, i) => `${l.label ?? `Platte ${i + 1}`} (h ${fmt(l.h)}, E ${fmt(l.E)}): ${mu(parts[i]!)}`).join("; ")}; δ_P = ${mu(dPK)} µm/kN`, dPK, "mm/N", `${SV_REF_VDI} S. 48 Hinweis 3`));
  }
  const H = hollowCylinder(dW, dh, DA, lK), dPHZ = layers.reduce((a, l) => a + l.h / (H.Aers * l.E), 0);
  if (model === "hohlzylinder")
    out.push(step("SV-DP-HZ", "Nachgiebigkeit Platten, Hohlzylinder (Roloff)", "A_ers = π/4·(d_w² − d_h²) + π/8·d_w·(D_A − d_w)·((x + 1)² − 1), x = ∛(l_K·d_w/D_A²), D_A ≤ d_w + l_K; δ_T = Σ l_i/(A_ers·E_i)",
      `D_A = ${fmt(H.DAe)} mm${H.x !== null ? `, x = ${fmt(H.x, 5)}` : ""}; A_ers = ${fmt(H.Aers)} mm²; δ_T = ${mu(dPHZ)} µm/kN (Kegel: ${mu(dPK)} µm/kN)`, dPHZ, "mm/N", `${SV_REF_ROLOFF} (8.9), (8.10)`));
  return { model, coneModel, w, tanPhi: t, DAGr, lV, lH, case: kase, dP: model === "kegel" ? dPK : dPHZ, dPK, parts: model === "kegel" ? parts : layers.map((l) => l.h / (H.Aers * l.E)), Aers: H.Aers, x: H.x, dPHZ };
}
