/**
 * Fliehkraft am Pressverband nach DIN 7190-1:2017 Abschn. 10.2 (Option, P11; Modul verbindungen, eng-core 0.17.0).
 * Voraussetzungen: volle Welle, gleiche E, μ und ρ, rein elastisch (Gl. (54), (55)). Grenzdrehzahl und Moment bei n
 * nach Roloff (12.24a), (12.25). Einheiten: E in N/mm², ρ in t/mm³ (kg/m³·10⁻¹²), u in mm/s, n in 1/s, T in N·mm.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { REF_DIN, REF_ROLOFF } from "./fit";

export interface SpinResult { u: number; uab: number; pn: number; ng: number; Tn: number; lim54: number; lim55: number; ratio10: number }

/** Grenzen von ξ_w für rein elastische Beanspruchung unter Fliehkraft (Gl. (54), (55)). */
export const spinXiLimits = (mu: number, QA: number, ReLA: number, ReLI: number, E: number): { lim54: number; lim55: number } =>
  ({ lim54: (3 + mu) / (3 + mu + (1 - mu) * QA * QA) * ReLA / E, lim55: ReLI / (QA * QA * E) });

/**
 * Fliehkraft für Drehzahl n (1/s): ξ_w des Mindestübermaßes für Abheben und Druckabfall (sichere Seite),
 * p = Fugendruck im Stillstand mit diesem ξ_w, T = übertragbares Moment im Stillstand.
 */
export function computeSpin(n: number, DaA: number, E: number, mu: number, rhoT: number, xi: number, p: number, T: number, S: CalcStep[]): SpinResult {
  const u = Math.PI * n * DaA, uab = 2 * Math.sqrt(E * xi / ((3 + mu) * rhoT)), pn = (1 - (u / uab) ** 2) * p, ng = uab / (Math.PI * DaA), Tn = T * (1 - (n / ng) ** 2);
  const ms = (x: number) => fmt(x / 1e3);
  S.push(step("PV-FL-U", "Umfangsgeschwindigkeit der Nabe außen", "u = π·n·D_aA", `u = π·${fmt(n)} 1/s·${fmt(DaA)} mm = ${ms(u)} m/s`, u, "mm/s", `${REF_DIN} Gl. (56)`));
  S.push(step("PV-FL-UAB", "Abhebegeschwindigkeit", "u_ab = 2·√(E·ξ_w/((3 + μ)·ρ))", `u_ab = 2·√(${fmt(E)}·${fmt(xi * 1e3, 5)}·10⁻³/((3 + ${fmt(mu)})·${fmt(rhoT * 1e9, 5)}·10⁻⁹)) = ${ms(uab)} m/s`, uab, "mm/s", `${REF_DIN} Gl. (58)`));
  S.push(step("PV-FL-PN", "Fugendruck bei Drehzahl n", "p_n = [1 − (u/u_ab)²]·p", `p_n = [1 − (${ms(u)}/${ms(uab)})²]·${fmt(p)} = ${fmt(pn)} N/mm²`, pn, "N/mm²", `${REF_DIN} Gl. (57)`));
  S.push(step("PV-FL-NG", "Grenzdrehzahl (Abheben)", "n_g = u_ab/(π·D_aA)", `n_g = ${ms(uab)} m/s/(π·${fmt(DaA)} mm) = ${fmt(ng)} 1/s = ${fmt(ng * 60)} 1/min`, ng, "1/s", `${REF_ROLOFF} (12.24a); ${REF_DIN} Gl. (56), (58)`));
  S.push(step("PV-FL-TN", "Übertragbares Moment bei Drehzahl n", "T_n = T·[1 − (n/n_g)²]", `T_n = ${fmt(T / 1e3)} N·m·[1 − (${fmt(n)}/${fmt(ng)})²] = ${fmt(Tn / 1e3)} N·m`, Tn, "N·mm", `${REF_ROLOFF} (12.25)`));
  return { u, uab, pn, ng, Tn, lim54: NaN, lim55: NaN, ratio10: u / (Math.sqrt(0.1) * uab) };
}
