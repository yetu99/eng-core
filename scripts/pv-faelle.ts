/**
 * Prüf- und Katalogfälle Pressverband (Modul verbindungen, eng-core 0.17.0), Konzept fachtools/konzept_pv.md Abschn. 6.
 * Gemeinsam genutzt von scripts/katalog.ts, verification/verbindungen.py (über engine_out/eval) und test/pressverband.test.ts.
 * Literaturfälle mit den Eingaben der Quelle (Werkstoffe von Hand), dazu Fälle für Längspress, Unterkühlen und Fehler.
 */
import type { PressFitInput, PvMaterial } from "../src/index";

export const mat = (label: string, E: number, mu: number, Re: number | null, o: Partial<PvMaterial> = {}): PvMaterial =>
  ({ label, E, mu, Re, Rm: null, A: null, alphaHeat: 11e-6, alphaCool: 8.5e-6, rho: 7850, brittle: false, ...o });
const quer = (thetaAzul: number | null = null, thetaI = 20, clearance: "din" | "half" = "din") => ({ kind: "quer" as const, thetaR: 20, thetaI, clearance, thetaAzul });
const base = (o: Partial<PressFitInput>): PressFitInput => ({
  task: "A", DF: 50, lF: 50, DaA: 100, DiI: 0, hub: mat("Stahl", 215000, 0.3, 300), shaft: mat("Stahl", 215000, 0.3, 200),
  rzA: { kind: "rz", Rz: 6 }, rzI: { kind: "rz", Rz: 6 }, fit: null, T: 0, Fax: 0, KA: 1, Sr: 1, SPA: 1.1, SPI: 1.1, nuR: 0.1, nuL: null,
  joining: quer(), plastic: false, spinN: null, ...o,
});
/** Axialkraft, die bei T = 0, K_A = S_r = 1 genau den Fugendruck p erfordert: F_ax = p·π·D_F·l_F·ν_r. */
const faxFor = (p: number, DF: number, lF: number, nu: number) => p * Math.PI * DF * lF * nu;

/** DIN 7190-1 A.1 als Übermaß: U = ξ_w·D_F + G mit ξ_w = 2·p/((1 − Q_A²)·E), p = 90 N/mm² (exakt). */
export const U_A1 = 2 * 90 / ((1 - 0.25) * 215000) * 50 + 0.4 * 12 / 1e3;

export interface PvFall { id: string; label: string; inp: PressFitInput }
export const pvFaelle: PvFall[] = [
  { id: "P-PV1", label: "DIN 7190-1 A.1: D_F 50, D_aA 100, Vollwelle, E 215 000, μ 0,3, Rz 6/6, p 90 N/mm² (über F_ax), S_P 1,1",
    inp: base({ task: "B", Fax: faxFor(90, 50, 50, 0.1) }) },
  { id: "P-PV2", label: "DIN 7190-1 A.2: wie A.1, U = 75 µm",
    inp: base({ fit: { kind: "manual", Uk: 0.075, Ug: 0.075 } }) },
  { id: "P-PV3", label: "DIN 7190-1 A.3: Hohlwelle D_iI 10, D_aA 125, E_A 70 000, E_I 215 000, R_eLA 150, R_eLI 300, p 50 N/mm², S_P 1,2",
    inp: base({ task: "B", DiI: 10, DaA: 125, hub: mat("Al", 70000, 0.3, 150), shaft: mat("Stahl", 215000, 0.3, 300), SPA: 1.2, SPI: 1.2, Fax: faxFor(50, 50, 50, 0.1) }) },
  { id: "P-PV4", label: "DIN 7190-1 A.4: wie A.3, U = 65 µm",
    inp: base({ DiI: 10, DaA: 125, hub: mat("Al", 70000, 0.3, 150), shaft: mat("Stahl", 215000, 0.3, 300), SPA: 1.2, SPI: 1.2, fit: { kind: "manual", Uk: 0.065, Ug: 0.065 } }) },
  { id: "P-PV5", label: "DIN 7190-1 A.5 (elastisch-plastisch): R_eLA 400, R_eLI 400, Rz 8/8, p 220 N/mm², S_PA 1,25, S_PI 1,1",
    inp: base({ task: "B", hub: mat("Stahl", 215000, 0.3, 400, { A: 15 }), shaft: mat("Stahl", 215000, 0.3, 400, { A: 15 }), rzA: { kind: "rz", Rz: 8 }, rzI: { kind: "rz", Rz: 8 }, SPA: 1.25, SPI: 1.1, Fax: faxFor(220, 50, 50, 0.1), plastic: true }) },
  { id: "P-PV6", label: "DIN 7190-1 A.6 (elastisch-plastisch): wie A.5, U = 190 µm",
    inp: base({ hub: mat("Stahl", 215000, 0.3, 400, { A: 15 }), shaft: mat("Stahl", 215000, 0.3, 400, { A: 15 }), rzA: { kind: "rz", Rz: 8 }, rzI: { kind: "rz", Rz: 8 }, SPA: 1.25, SPI: 1.1, fit: { kind: "manual", Uk: 0.19, Ug: 0.19 }, plastic: true }) },
  { id: "P-PV7a", label: "DIN 7190-1 A.7 (Fliehkraft): wie A.1 mit p 90 N/mm², ρ 7850 kg/m³, n 10 000 1/min",
    inp: base({ fit: { kind: "manual", Uk: U_A1, Ug: U_A1 }, spinN: 10000, T: 100e3 }) },
  { id: "P-PV7b", label: "DIN 7190-1 A.7 (Fliehkraft): wie A.1, n 20 000 1/min",
    inp: base({ fit: { kind: "manual", Uk: U_A1, Ug: U_A1 }, spinN: 20000, T: 100e3 }) },
  { id: "P-PV8", label: "Roloff/Matek 27 Bsp. 12.2: Riemenscheibe EN-GJL-250 (E 115 000, μ 0,25, R_m 180, S 2) auf E295, D_F 80, D_aA 190, l_F 115, T 1200 N·m, S_H 1,5, ν 0,16, Rz 6,3/6,3, H6/r6, Fügespiel Ü_o′/2",
    inp: base({ task: "B", DF: 80, DaA: 190, lF: 115, hub: mat("EN-GJL-250", 115000, 0.25, null, { Rm: 180, brittle: true, alphaHeat: 10e-6, alphaCool: 8e-6, A: 0.5 }), shaft: mat("E295", 210000, 0.3, 295),
      rzA: { kind: "rz", Rz: 6.3 }, rzI: { kind: "rz", Rz: 6.3 }, T: 1.2e6, Sr: 1.5, SPA: 2, SPI: 1.1, nuR: 0.16, fit: { kind: "iso", hole: 6, field: "r", grade: 6 }, joining: quer(null, 20, "half") }) },
  { id: "P-PV9", label: "DIN 7190-1 Tab. 5: ⌀160 H7/u6, Hohlwelle D_iI 60, Nabe D_aA 320, l_F 160, Stahl vergütet (ϑ_A,zul 300 °C), Welle mit Stickstoff unterkühlt, Ra 1,6/0,8",
    inp: base({ DF: 160, DaA: 320, lF: 160, DiI: 60, hub: mat("42CrMo4", 210000, 0.3, 650), shaft: mat("C45E", 210000, 0.3, 430), rzA: { kind: "ra", Ra: 1.6 }, rzI: { kind: "ra", Ra: 0.8 },
      fit: { kind: "iso", hole: 7, field: "u", grade: 6 }, T: 20e6, Sr: 1.5, nuR: 0.14, SPA: 1.1, SPI: 1.1, joining: quer(300, -195.8) }) },
  { id: "P-PV16", label: "Längspressverband ⌀40 H7/s6, l_F 40, D_aA 80, Stahl/E335 trocken (ν_rl 0,08, ν_ll 0,11), T 150 N·m, F_ax 2 kN",
    inp: base({ DF: 40, DaA: 80, lF: 40, hub: mat("E335", 210000, 0.3, 335), shaft: mat("C45", 210000, 0.3, 430), fit: { kind: "iso", hole: 7, field: "s", grade: 6 }, T: 150e3, Fax: 2000, Sr: 1.5, nuR: 0.08, nuL: 0.11, joining: { kind: "laengs" } }) },
  { id: "P-PV17", label: "Längspressverband ⌀100 H7/r6, l_F 80, D_aA 160, Stahl/S235 geschmiert (ν_rl 0,06, ν_ll 0,07), T 1000 N·m, Erwärmen ϑ_A,zul 350 °C nicht nötig",
    inp: base({ DF: 100, DaA: 160, lF: 80, hub: mat("S235", 210000, 0.3, 235), shaft: mat("42CrMo4", 210000, 0.3, 650), fit: { kind: "iso", hole: 7, field: "r", grade: 6 }, T: 1e6, Sr: 1.5, nuR: 0.06, nuL: 0.07, joining: { kind: "laengs" } }) },
  { id: "P-PV18", label: "Auslegung ⌀60, D_aA 120, l_F 70, Stahl S355/42CrMo4, T 800 N·m, ν 0,14, S_r 1,5, Vorschlag H7/s6 nachrechnen",
    inp: base({ task: "B", DF: 60, DaA: 120, lF: 70, hub: mat("S355", 210000, 0.3, 355), shaft: mat("42CrMo4", 210000, 0.3, 650), T: 800e3, Sr: 1.5, nuR: 0.14, fit: { kind: "iso", hole: 7, field: "s", grade: 6 }, joining: quer(300) }) },
];

/** Fehler- und Hinweisfälle (P-PV15). */
export const pvFehlerfaelle: PvFall[] = [
  { id: "P-PV15a", label: "D_F ≤ 0", inp: base({ DF: 0, fit: { kind: "manual", Uk: 0.05, Ug: 0.06 } }) },
  { id: "P-PV15b", label: "Q_A ≥ 1", inp: base({ DaA: 50, fit: { kind: "manual", Uk: 0.05, Ug: 0.06 } }) },
  { id: "P-PV15c", label: "D_iI ≥ D_F", inp: base({ DiI: 50, fit: { kind: "manual", Uk: 0.05, Ug: 0.06 } }) },
  { id: "P-PV15d", label: "l_F ≤ 0", inp: base({ lF: 0, fit: { kind: "manual", Uk: 0.05, Ug: 0.06 } }) },
  { id: "P-PV15e", label: "Glättung frisst Übermaß", inp: base({ fit: { kind: "manual", Uk: 0.004, Ug: 0.006 } }) },
  { id: "P-PV15f", label: "D_F > 500 mit ISO-Passung", inp: base({ DF: 600, DaA: 1000, fit: { kind: "iso", hole: 7, field: "s", grade: 6 } }) },
  { id: "P-PV15g", label: "t unter 24 mm nicht definiert", inp: base({ DF: 20, DaA: 40, fit: { kind: "iso", hole: 7, field: "t", grade: 6 } }) },
  { id: "P-PV15h", label: "Option elastisch-plastisch ohne Voraussetzungen (Hohlwelle)", inp: base({ DiI: 10, fit: { kind: "manual", Uk: 0.05, Ug: 0.06 }, plastic: true }) },
  { id: "P-PV15i", label: "Fliehkraft mit ungleichen Werkstoffen", inp: base({ hub: mat("Al", 70000, 0.33, 150, { rho: 2700 }), fit: { kind: "manual", Uk: 0.05, Ug: 0.06 }, spinN: 3000 }) },
];
