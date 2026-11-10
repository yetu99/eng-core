/**
 * Prüf- und Katalogfälle Schraubenverbindung (Modul verbindungen, eng-core 0.18.0), Konzept fachtools/konzept_sv.md Abschn. 6.
 * Gemeinsam genutzt von scripts/katalog.ts, verification/verbindungen.py (über engine_out/eval) und test/schraube.test.ts.
 * Literaturfälle mit den Eingaben der Quelle (Geometrie von Hand, wo die Quelle eigene Werte nutzt), dazu Fälle für
 * Normgeometrie, Auslegung, alle Optionen und Fehler. Einheiten N, mm, MPa; f_Z in mm.
 */
import type { BoltJointInput, SvPlate } from "../src/index";

export const plate = (h: number, E: number, pG: number | null = null, label?: string): SvPlate => (label ? { h, E, pG, label } : { h, E, pG });
export const svBase = (o: Partial<BoltJointInput>): BoltJointInput => ({
  task: "A", joint: "DSV", d: 12, threadId: null, norm: "ISO 4014", length: null, shank: null, taper: null, grade: "8.8", gradeManual: null, ES: 205000,
  dW: null, dh: null, hole: "mittel", dha: null, washerHead: false, washerNut: false, dWcone: null, coneModel: null, plateModel: "kegel", DA: 60, DAp: null,
  plates: [plate(20, 210000, 760), plate(20, 210000, 760)], EBI: null, mGes: null, engagement: null, phiZu: true, n: 0.5, kef: null,
  FAmax: 10000, FAmin: 0, FQ: 0, torque: null, MY: 0, ra: 0, qF: 1, muT: 0.15, AD: 0, pi: 0, FKHand: 0, fZ: null, rz: "lt10", embedLoad: "axial",
  alphaA: 1.6, nu: 0.9, torsionFree: false, yieldControlled: false, muG: 0.12, muK: 0.12, rolled: "SV", pGHead: null, pGNut: null, pGWasher: null, shearAt: "schaft",
  req: { SF: 1.0, SD: 1.2, Sp: 1.0, SG: 1.2, SA: 1.1 }, temp: null, NZ: null, flange: null, sigmaA: null, ...o,
});
/** VDI B2: D_t so gewählt, dass F_Q = 2·T/(D_t·z) = 8 400 N je Schraube (VDI B2 S. 137). */
export const B2_DT = 2 * 13e6 / (12 * 8400);

export interface SvFall { id: string; label: string; inp: BoltJointInput }
export const svFaelle: SvFall[] = [
  { id: "P-SV1", label: "Roloff/Matek 27 Bsp. 8.1: Kolben, ISO 4762 M16 10.9, ESV, l_K 52,4, Schaft 26, D_A 100, Hohlzylinder d_w 24, d_h 17,5, n 0,3, k_A 1,6, F_Kl 15 kN, F_B 35,7 kN schwellend, f_Z 11 µm, μ 0,12",
    inp: svBase({ joint: "ESV", d: 16, norm: "ISO 4762", grade: "10.9", ES: 210000, shank: [{ l: 26, d: 16 }], dWcone: 24, plateModel: "hohlzylinder", DA: 100, plates: [plate(52.4, 210000, null, "Kolbenstange")],
      EBI: 210000, mGes: 17.6, phiZu: false, n: 0.3, FAmax: 35700, FAmin: 0, FKHand: 15000, fZ: 0.011, alphaA: 1.6 }) },
  { id: "P-SV2", label: "Roloff/Matek 27 Bsp. 8.3: Zahnkranz, ISO 4014 M8×55 8.8 in EN-GJL-250 (E_M 115 000), l_K 45, D_A 60, Hohlzylinder d_w 13, μ_T 0,20, T 630 N·m (Teilkreis 192, Lochkreis 150, z 8), k_A 1,6, f_Z 10 µm, μ 0,14",
    inp: svBase({ joint: "ESV", d: 8, length: 55, grade: "8.8", ES: 210000, dWcone: 13, plateModel: "hohlzylinder", DA: 60, plates: [plate(45, 210000, null, "Zahnkranz")], EBI: 115000, phiZu: false,
      FAmax: 0, FAmin: 0, FQ: 2 * 630e3 / 192, torque: { T: 630e3, Dt: 150, z: 8 }, muT: 0.2, fZ: 0.01, alphaA: 1.6, muG: 0.14, muK: 0.14, engagement: { group: "GJL 250", Rm: 250 } }) },
  { id: "P-SV3", label: "VDI 2230-1 Bsp. B1: Kolben 16MnCr5, ISO 4762 M12 10.9, ESV mit DSV-Näherung (d_Wm 21,115, w = 1), d_h 13,5, l_K 42, Schaft 24, D_A = D′_A 80, n 0,35 (Tab. 2 SV 4), f_Z 8 µm, α_A 1,8, F_A 24,9 kN schwellend, F_Kerf 1 kN, μ 0,10",
    inp: svBase({ joint: "ESV", d: 12, norm: "ISO 4762", grade: "10.9", shank: [{ l: 24, d: 12 }], dWcone: (17.23 + 25) / 2, coneModel: "DSV", DA: 80, plates: [plate(42, 205000, 1300, "Kolben 16MnCr5")],
      EBI: 205000, mGes: 18, engagement: { group: "Stahl", Rm: 700 }, n: 0.35, kef: { type: 4, laH: 0, akH: 3.89 / 42 }, FAmax: 24900, FAmin: 0, FKHand: 1000, fZ: 0.008, alphaA: 1.8, muG: 0.1, muK: 0.1 }) },
  { id: "P-SV4", label: "VDI 2230-1 Bsp. B2: Scheibenkupplung EN-GJL-250 (E 110 000), 12 × ISO 4014 M16 10.9, DSV, l_K 2 × 30, Schaft 42, d_W 22,5, d_h 17, d_ha 17,7, D′_A 99, T 13 kN·m (F_Q 8,4 kN), μ_T 0,15, α_A 1,6, R_z < 10, μ 0,12",
    inp: svBase({ d: 16, grade: "10.9", shank: [{ l: 42, d: 16 }], dW: 22.5, dh: 17, dha: 17.7, DA: 99, plates: [plate(30, 110000, 850), plate(30, 110000, 850)], FAmax: 0, FAmin: 0,
      torque: { T: 13e6, Dt: B2_DT, z: 12 }, muT: 0.15, rz: "lt10", embedLoad: "schub", alphaA: 1.6 }) },
  { id: "P-SV5", label: "Roloff/Matek EKB 9 Seilzugvorrichtung: M10 8.8 Ganzgewinde, DSV, Hand angezogen k_A 4, l_K 18, Hohlzylinder d_w 16, d_h 11, D_A 100, F_Kl 2,6 kN, F_B 1,67 kN, n 0,5, f_Z 11 µm (Negativfall F_VM > F_sp)",
    inp: svBase({ d: 10, norm: "ISO 4017", shank: [], ES: 210000, dWcone: 16, plateModel: "hohlzylinder", DA: 100, plates: [plate(18, 210000, 490)], FKHand: 2600, FAmax: 1670, FAmin: 1670, fZ: 0.011, alphaA: 4 }) },
  { id: "P-SV12", label: "Auslegung DSV: ISO 4014 ohne Scheiben, 2 × 20 mm S355 (p_G 760), D_A 50, F_A 5 bis 20 kN, F_Q 2 kN, μ_T 0,15, α_A 1,6, μ 0,10; Vorschlag n Tab. 2 SV 1",
    inp: svBase({ task: "B", d: 12, DA: 50, FAmax: 20000, FAmin: 5000, FQ: 2000, muG: 0.1, muK: 0.1, kef: { type: 1, laH: 0, akH: 0.2 } }) },
  { id: "P-SV19", label: "Auslegung wie P-SV12 mit Scheiben ISO 7089 ohne p_G der Scheibe: Abbruch mit Hinweis (U8)",
    inp: svBase({ task: "B", d: 12, washerHead: true, washerNut: true, DA: 50, FAmax: 20000, FAmin: 5000, FQ: 2000, muG: 0.1, muK: 0.1 }) },
  { id: "P-SV20", label: "Scheiben an Kopf und Mutter, zwei Auflagen je Seite (U3): ISO 4014 M12 10.9, p_G Scheibe 900 N/mm² als Testwert von Hand (keine Fundstelle), F_A 5 bis 20 kN",
    inp: svBase({ d: 12, grade: "10.9", washerHead: true, washerNut: true, pGWasher: 900, DA: 50, FAmax: 20000, FAmin: 5000, muG: 0.1, muK: 0.1 }) },
  { id: "P-SV13", label: "ESV ISO 4762 M10 10.9, Deckel S355 in l_K auf Einschraubteil AlMg (E 70 000), Normlänge aus l_e (TB 8-15), Moment M_Y, Dichtkraft, schlussgewalzt, Zeitfestigkeit N_Z 5·10⁵, Temperatur +80 K",
    inp: svBase({ joint: "ESV", d: 10, norm: "ISO 4762", grade: "10.9", DA: 40, plates: [plate(25, 210000, 760, "Deckel S355 (α_P 12·10⁻⁶/K)")], EBI: 70000, engagement: { group: "AlMg-Leg.", Rm: 330 },
      FAmax: 8000, FAmin: 2000, MY: 20000, ra: 12, AD: 300, pi: 5, rolled: "SG", NZ: 5e5, temp: { dTS: 80, dTP: 80, alphaS: 11.5e-6, alphaP: 12e-6 }, rz: "10to40", muG: 0.1, muK: 0.1 }) },
  { id: "P-SV14", label: "Dehnschraube ISO 4014 M16 10.9, d_T 12, drei Platten (Stahl 20, Al 15, Stahl 20), D_A 40 (Kegel und Hülse), streckgrenzgesteuert (α_A 1,2, ν 1,0), F_A 0 bis 30 kN",
    inp: svBase({ d: 16, grade: "10.9", taper: 12, DA: 40, plates: [plate(20, 210000, 760), plate(15, 70000, 325, "Al-Zwischenplatte"), plate(20, 210000, 760)], FAmax: 30000, FAmin: 0,
      yieldControlled: true, nu: 1.0, alphaA: 1.2, muG: 0.1, muK: 0.1 }) },
  { id: "P-SV15", label: "Hülse (d_W ≥ D_A): ISO 4017 M8 8.8, D_A 11, hydraulisch torsionsfrei, F_A 3 kN statisch",
    inp: svBase({ d: 8, norm: "ISO 4017", DA: 11, plates: [plate(10, 210000, 760), plate(10, 210000, 760)], FAmax: 3000, FAmin: 3000, torsionFree: true, alphaA: 1.4 }) },
  { id: "P-SV16", label: "Nichtrostend A2-70 mit Feingewinde M16×1,5 (Option), σ_A von Hand 40 N/mm², Flansch p 10 N/mm², d_m 120, z 8",
    inp: svBase({ d: 16, threadId: "GF16x1,5", grade: "A2-70", ES: 200000, DA: 50, plates: [plate(25, 200000, 630), plate(25, 200000, 630)], flange: { p: 10, dm: 120, z: 8 }, FAmin: 0, sigmaA: 40 }) },
  { id: "P-SV17", label: "Kegel und Hülse mit einem E: ISO 4014 M12 8.8, D_A 24, F_A 8 kN schwellend",
    inp: svBase({ d: 12, length: 60, DA: 24, plates: [plate(18, 210000, 760), plate(18, 210000, 760)], FAmax: 8000, FAmin: 0 }) },
];

/** Fehler- und Hinweisfälle (P-SV11). */
export const svFehlerfaelle: SvFall[] = [
  { id: "P-SV11a", label: "d außerhalb M4 bis M39", inp: svBase({ d: 3 }) },
  { id: "P-SV11b", label: "d_h ≥ d_W", inp: svBase({ dh: 20 }) },
  { id: "P-SV11c", label: "D_A ≤ d_h", inp: svBase({ DA: 13 }) },
  { id: "P-SV11d", label: "l_K ≤ 0", inp: svBase({ plates: [plate(0, 210000)] }) },
  { id: "P-SV11e", label: "Schaftlänge > l_K", inp: svBase({ shank: [{ l: 50, d: 12 }] }) },
  { id: "P-SV11f", label: "n ∉ [0, 1]", inp: svBase({ n: 1.2 }) },
  { id: "P-SV11g", label: "μ ≤ 0", inp: svBase({ muG: 0 }) },
  { id: "P-SV11h", label: "α_A < 1", inp: svBase({ alphaA: 0.9 }) },
  { id: "P-SV11i", label: "F_Kerf < 0", inp: svBase({ FKHand: -1 }) },
  { id: "P-SV11j", label: "Klasse unter 8.8 (Hinweis)", inp: svBase({ grade: "6.8" }) },
  { id: "P-SV11k", label: "F_A,min > F_A,max", inp: svBase({ FAmin: 20000 }) },
];
