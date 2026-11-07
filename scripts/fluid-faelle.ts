/**
 * Beispielfälle der Rohrhydraulik (Modul fluid) für den Formelkatalog (scripts/katalog.ts) und die Abnahme.
 * Jeder Fall erzeugt seine Formeln einmal mit nachrechenbarem Beispiel. Literaturfälle zuerst.
 */
import { fdRepo, units, rpm, type LineInput, type LineTask, type MeterInput, type SurgeInput, type PumpInput, type PumpPoint } from "../src/index";

const P0 = 101325;
const lc = (element: string, pred: (r: { dn_min: number | null; param_value: number | null }) => boolean = () => true): string => {
  const r = fdRepo.lossCoeff.find((x) => x.element === element && pred(x));
  if (!r) throw new Error(`fd_loss_coeff: ${element} fehlt`);
  return r.id;
};
const rough = (state: string): string => {
  const r = fdRepo.roughness.find((x) => x.state === state);
  if (!r) throw new Error(`fd_roughness: ${state} fehlt`);
  return r.id;
};
const pipe = (norm: string, series: string, da: number): string => {
  const r = fdRepo.pipeSizes.find((x) => x.norm === norm && x.series === series && x.d_a_mm === da);
  if (!r) throw new Error(`fd_pipe_sizes: ${norm} ${series} ${da} fehlt`);
  return r.id;
};
const fv = (name: string, t: number): string => {
  const f = fdRepo.fluids.find((x) => x.name === name);
  const v = f && fdRepo.fluidValues.find((x) => x.fluid_id === f.id && x.t_c === t);
  if (!v) throw new Error(`fd_fluid_values: ${name} ${t} °C fehlt`);
  return v.id;
};

export interface FluidFall { id: string; text: string; inp: LineInput; task: LineTask }

export function fluidFaelle(): FluidFall[] {
  return [
    {
      id: "RH-K1", text: "Roloff/Matek 27 Bsp. 18.2: Wasser 10 °C, 300 m³/h, d_i 309,9 mm, L 280 m, k 0,18 mm (zementiert), Σζ 19,2 von Hand, Δz 10 m, η 0,7",
      inp: {
        fluid: { spec: { kind: "wasser" }, T: units.cToK(10), p: P0 }, Q: units.m3hToM3s(300), g: 9.81, eta: 0.7, velocityGuideId: null,
        start: { p: P0, z: 0, v0: true }, end: { p: P0, v0: true },
        elements: [
          { kind: "zetaHand", label: "Einlauf vorstehend", zeta: 3, ref: "2", count: 1 },
          { kind: "rohr", label: "Druckleitung", L: 280, geom: { kind: "d", d: 0.3099 }, rough: { kind: "tab", id: rough("zementiert"), which: "max" }, dz: 10 },
          { kind: "zetaHand", label: "Durchgangsventile", zeta: 6, ref: null, count: 2 },
          { kind: "zetaHand", label: "Rückschlagklappe", zeta: 0.8, ref: null, count: 1 },
          { kind: "zetaHand", label: "Kniestücke 60°", zeta: 0.8, ref: null, count: 3 },
          { kind: "zetaHand", label: "Ausströmung", zeta: 1, ref: "1", count: 1 },
        ],
      },
      task: { kind: "A" },
    },
    {
      id: "RH-K2", text: "Dubbel 26 Bd. 1 Abb. 17.16: 8 L/s, d 80/60/80 mm, k 0,04 mm, ν 10⁻⁶ m²/s, ρ 1 000 kg/m³ von Hand, Höhen 7 m und 5 m, Freistrahl",
      inp: {
        fluid: { spec: { kind: "hand", rho: 1000, nu: 1e-6 }, T: units.cToK(20), p: P0 }, Q: 8e-3, g: 9.81, eta: null, velocityGuideId: null,
        start: { p: 1e5, z: 7, v0: true }, end: { p: 1e5, v0: false },
        elements: [
          { kind: "zetaHand", label: "Rohreinlauf", zeta: 0.5, ref: "2", count: 1 },
          { kind: "rohr", label: "l₁", L: 35, geom: { kind: "d", d: 0.08 }, rough: { kind: "hand", k: 0.04e-3 }, dz: -2 },
          { kind: "zetaHand", label: "Konfusor", zeta: 0.05, ref: "2", count: 1 },
          { kind: "rohr", label: "l₂", L: 25, geom: { kind: "d", d: 0.06 }, rough: { kind: "hand", k: 0.04e-3 }, dz: 0 },
          { kind: "zetaHand", label: "Kniestück 22,5°", zeta: 0.11, ref: null, count: 1 },
          { kind: "rohr", label: "l₃", L: 13, geom: { kind: "d", d: 0.06 }, rough: { kind: "hand", k: 0.04e-3 }, dz: 0 },
          { kind: "zetaHand", label: "Kniestück 22,5°", zeta: 0.11, ref: null, count: 1 },
          { kind: "rohr", label: "l₄", L: 25, geom: { kind: "d", d: 0.06 }, rough: { kind: "hand", k: 0.04e-3 }, dz: 0 },
          { kind: "zetaHand", label: "Diffusor", zeta: 0.3, ref: "2", count: 1 },
          { kind: "rohr", label: "Austritt d₆", L: 0, geom: { kind: "d", d: 0.08 }, rough: { kind: "hand", k: 0.04e-3 }, dz: 0 },
        ],
      },
      task: { kind: "A" },
    },
    {
      id: "RH-K3", text: "Spindelöl 20 °C (TB 18-9), 20 L/min, Stahlrohr EN 10220 21,3 × 2, Bogen glatt r/d 3, Erweiterung auf 26,9 × 2, Schieber DN 20…25, Richtwert Ölleitung",
      inp: {
        fluid: { spec: { kind: "tabelle", valueId: fv("Spindelöl", 20) }, T: units.cToK(20), p: P0 }, Q: units.lminToM3s(20), g: 9.81, eta: 0.8,
        velocityGuideId: fdRepo.velocityGuide.find((x) => x.case === "viskose Flüssigkeiten allgemein")!.id,
        start: { p: units.barGaugeToPaAbs(5), z: 0, v0: false }, end: { p: P0, v0: false },
        elements: [
          { kind: "rohr", L: 4, geom: { kind: "norm", pipeId: pipe("DIN EN 10220", "Reihe 1", 21.3), wall: 0.002 }, rough: { kind: "tab", id: rough("neu, mit Walzhaut"), which: "max" }, dz: 0.5 },
          { kind: "bogen", surface: "glatt", rd: 3, count: 2 },
          { kind: "erweiterung" },
          { kind: "rohr", L: 6, geom: { kind: "norm", pipeId: pipe("DIN EN 10220", "Reihe 1", 26.9), wall: 0.002 }, rough: { kind: "tab", id: rough("neu, mit Walzhaut"), which: "max" }, dz: 0 },
          { kind: "zeta", lossId: lc("Schieber", (r) => r.dn_min === 20), count: 1 },
        ],
      },
      task: { kind: "A" },
    },
    {
      id: "RH-K4", text: "Hydrauliköl ISO VG 46 bei 40 °C (ρ 870 kg/m³ von Hand), verfügbare Druckerhöhung 2 bar, d 20 mm, L 15 m, k 0,01 mm",
      inp: {
        fluid: { spec: { kind: "tabelle", valueId: fv("Hydrauliköl ISO VG 46", 40), rho: 870 }, T: units.cToK(40), p: P0 }, Q: 0, g: 9.81, eta: null, velocityGuideId: null,
        start: { p: P0, z: 0, v0: true }, end: { p: P0, v0: true },
        elements: [
          { kind: "zeta", lossId: lc("Verengung, abgerundet"), count: 1 },
          { kind: "rohr", L: 15, geom: { kind: "d", d: 0.02 }, rough: { kind: "hand", k: 1e-5 }, dz: 0 },
          { kind: "zeta", lossId: lc("Ausströmung"), count: 1 },
        ],
      },
      task: { kind: "B", dpAvail: 2e5 },
    },
    {
      id: "RH-K5", text: "Wasser 20 °C, 10 m³/h, PE SDR 11 (DIN 8074) gesucht, L 120 m, k 0,007 mm von Hand, Δz 6 m, Δp_zul 1,5 bar, Richtwert Hauptleitung",
      inp: {
        fluid: { spec: { kind: "wasser" }, T: units.cToK(20), p: P0 }, Q: units.m3hToM3s(10), g: 9.81, eta: 0.65,
        velocityGuideId: fdRepo.velocityGuide.find((x) => x.case === "Hauptleitung")!.id,
        start: { p: P0, z: 0, v0: true }, end: { p: P0, v0: true },
        elements: [
          { kind: "zeta", lossId: lc("Verengung, abgerundet"), count: 1 },
          { kind: "rohr", L: 120, geom: { kind: "var" }, rough: { kind: "hand", k: 7e-6 }, dz: 6 },
          { kind: "bogen", surface: "glatt", rd: 2, count: 4 },
          { kind: "zeta", lossId: lc("Ausströmung"), count: 1 },
        ],
      },
      task: { kind: "C", dpAllow: 1.5e5, select: { norm: "DIN 8074", series: "SDR 11", minWall: null } },
    },
    {
      id: "RH-K6", text: "Glyzerin 20 °C (TB 18-9), 0,5 L/min, d 10 mm, L 2 m: laminar (Hagen-Poiseuille)",
      inp: {
        fluid: { spec: { kind: "tabelle", valueId: fv("Glyzerin", 20) }, T: units.cToK(20), p: P0 }, Q: units.lminToM3s(0.5), g: 9.81, eta: null, velocityGuideId: null,
        start: { p: P0, z: 0, v0: false }, end: { p: P0, v0: false },
        elements: [{ kind: "rohr", L: 2, geom: { kind: "d", d: 0.01 }, rough: { kind: "hand", k: 1e-6 }, dz: 0 }],
      },
      task: { kind: "A" },
    },
    ...fluidFaelleB(),
  ];
}

// ---------------------------------------------------------------- RH b (eng-core 0.13.0): Pumpe, Querschnitte, Walther
const pts = (rows: Array<[number, number, number | null, number | null]>): PumpPoint[] => rows.map(([q, h, eta, npsh]) => ({ Q: units.m3hToM3s(q), H: h, eta, npsh }));
/** Beispielpumpe (radial, n₀ 1 450 min⁻¹), Datenblattpunkte frei gewählt, glatt; nur für Beispiele und Prüffälle. */
export const PUMPE_B: PumpPoint[] = pts([[0, 22, null, null], [150, 21, 0.65, 2.0], [300, 17, 0.8, 3.0], [400, 12.5, 0.74, 4.5]]);
const pumpIn = (points: PumpPoint[], speed: PumpInput["speed"], over: Partial<PumpInput> = {}): PumpInput => ({ points, n0: rpm.toHz(1450), speed, npshMargin: 2, npshExp: 2, pv: null, ...over });
/** Roloff Bsp. 18.2 mit Saugleitung DN 300 (EN 10220 323,9 × 7,1), Pumpe 3 m über dem Saugspiegel, Druckleitung wie RH-K1. */
const anlageK1 = (): LineInput => ({
  fluid: { spec: { kind: "wasser" }, T: units.cToK(10), p: P0 }, Q: 0, g: 9.81, eta: null, velocityGuideId: null,
  start: { p: P0, z: 0, v0: true }, end: { p: P0, v0: true },
  elements: [
    { kind: "zeta", label: "Einlauf", lossId: lc("Verengung, abgerundet"), count: 1 },
    { kind: "rohr", label: "Saugleitung", L: 6, geom: { kind: "norm", pipeId: pipe("DIN EN 10220", "Reihe 1", 323.9), wall: 0.0071 }, rough: { kind: "tab", id: rough("zementiert"), which: "max" }, dz: 3 },
    { kind: "pumpe", label: "Kreiselpumpe" },
    { kind: "zetaHand", label: "Durchgangsventile", zeta: 6, ref: null, count: 2 },
    { kind: "rohr", label: "Druckleitung", L: 280, geom: { kind: "d", d: 0.3099 }, rough: { kind: "tab", id: rough("zementiert"), which: "max" }, dz: 7 },
    { kind: "zetaHand", label: "Kniestücke 60°", zeta: 0.8, ref: null, count: 3 },
    { kind: "zetaHand", label: "Ausströmung", zeta: 1, ref: "1", count: 1 },
  ],
});
/** Analytischer Fall P22: H = 40 − 0,0016·V̇² und H_A = 15 + 0,001·V̇² (V̇ in m³/h), Strang nur aus ζ von Hand. */
export const anlageAnalytisch = (): LineInput => {
  const A = Math.PI * 0.1 * 0.1 / 4;
  return {
    fluid: { spec: { kind: "hand", rho: 1000, nu: 1e-6 }, T: units.cToK(20), p: P0 }, Q: 0, g: 9.81, eta: null, velocityGuideId: null,
    start: { p: P0, z: 0, v0: true }, end: { p: P0, v0: true },
    elements: [
      { kind: "pumpe", label: "Pumpe" },
      { kind: "rohr", label: "Steigleitung (ohne Reibung)", L: 0, geom: { kind: "d", d: 0.1 }, rough: { kind: "hand", k: 1e-5 }, dz: 15 },
      { kind: "zetaHand", label: "Widerstand k = 0,001 h²/m⁵", zeta: 0.001 * 3600 ** 2 * 2 * 9.81 * A * A, ref: null, count: 1 },
    ],
  };
};
export const PUMPE_ANALYTISCH: PumpPoint[] = pts([[0, 40, null, null], [50, 36, null, null], [100, 24, null, null]]);

export function fluidFaelleB(): FluidFall[] {
  return [
    { id: "RH-K7", text: "Pumpe analytisch (Prüffall P22): Punkte (0; 40), (50; 36), (100; 24) m³/h und m bei 1 450 min⁻¹, Anlage H_A = 15 m + 0,001·V̇² (ζ von Hand), Wasser ρ 1 000 kg/m³ von Hand",
      inp: anlageAnalytisch(), task: { kind: "D", pump: pumpIn(PUMPE_ANALYTISCH, { kind: "n", n: rpm.toHz(1450) }) } },
    { id: "RH-K8", text: "Roloff Bsp. 18.2 mit Saugleitung 323,9 × 7,1 (6 m, Pumpe 3 m über dem Saugspiegel) und Beispielpumpe (4 Punkte mit η und NPSH_R, n₀ 1 450 min⁻¹) bei 1 380 min⁻¹, Wasser 10 °C, s = 2 m",
      inp: anlageK1(), task: { kind: "D", pump: pumpIn(PUMPE_B, { kind: "n", n: rpm.toHz(1380) }) } },
    { id: "RH-K9", text: "wie RH-K8, Drehzahl für Soll-Förderstrom 300 m³/h gesucht",
      inp: anlageK1(), task: { kind: "D", pump: pumpIn(PUMPE_B, { kind: "Qsoll", Q: units.m3hToM3s(250) }) } },
    { id: "RH-K10", text: "HLP 46 nach Walther (ν40 46, ν100 6,1 mm²/s, C 0,8, ρ 870 kg/m³) bei 20 °C, Kreisring 40/30 mm (laminar, φ aus Tabelle), Rechteckkanal 30 × 10 mm, Querschnitt von Hand, je 2 m",
      inp: {
        fluid: { spec: { kind: "walther", walther: { T1: units.cToK(40), nu1: 46e-6, T2: units.cToK(100), nu2: 6.1e-6, C: 0.8 }, rho: 870, label: "HLP 46" }, T: units.cToK(20), p: P0 },
        Q: units.lminToM3s(10), g: 9.81, eta: null, velocityGuideId: null, start: { p: units.barGaugeToPaAbs(5), z: 0, v0: false }, end: { p: P0, v0: false },
        elements: [
          { kind: "rohr", label: "Ringspalt", L: 2, geom: { kind: "section", section: { kind: "ring", da: 0.04, di: 0.03 } }, rough: { kind: "hand", k: 1e-5 }, dz: 0 },
          { kind: "rohr", label: "Rechteckkanal", L: 2, geom: { kind: "section", section: { kind: "rechteck", b: 0.03, h: 0.01 } }, rough: { kind: "hand", k: 1e-5 }, dz: 0 },
          { kind: "rohr", label: "Sonderprofil", L: 2, geom: { kind: "section", section: { kind: "au", A: 4e-4, U: 0.09 } }, rough: { kind: "hand", k: 1e-5 }, dz: 0 },
        ],
      }, task: { kind: "A" } },
    { id: "RH-K11", text: "Wasser 20 °C, 60 m³/h, Rechteckkanal 200 × 100 mm (turbulent, d_h), L 30 m, k 0,1 mm, mit Überdruckhöhe gegen 0,95 bar Umgebung",
      inp: {
        fluid: { spec: { kind: "wasser" }, T: units.cToK(20), p: P0 }, Q: units.m3hToM3s(60), g: 9.81, eta: null, velocityGuideId: null, pAmb: 95000,
        start: { p: P0, z: 0, v0: true }, end: { p: P0, v0: true },
        elements: [{ kind: "rohr", label: "Kanal", L: 30, geom: { kind: "section", section: { kind: "rechteck", b: 0.2, h: 0.1 } }, rough: { kind: "hand", k: 1e-4 }, dz: 0 }, { kind: "zeta", lossId: lc("Ausströmung"), count: 1 }],
      }, task: { kind: "A" } },
  ];
}

export interface MessFall { id: string; text: string; inp: MeterInput }
export function messFaelle(): MessFall[] {
  const w = { rho: 998.2057, nu: 1.0035e-6 };
  return [
    { id: "RH-M1", text: "Blende mit Flansch-Druckentnahmen, D 100 mm, d 50 mm (β 0,5), Wasser 20 °C (ρ, ν gerundet von Hand), V̇ 40 m³/h gegeben", inp: { device: { kind: "blende", taps: "flansch" }, D: 0.1, d: 0.05, ...w, mode: { kind: "Q", Q: units.m3hToM3s(40) } } },
    { id: "RH-M2", text: "Blende mit Eck-Druckentnahmen, D 60 mm, d 30 mm (Zusatzterm D < 71,12 mm), Δp 0,5 bar gemessen", inp: { device: { kind: "blende", taps: "eck" }, D: 0.06, d: 0.03, ...w, mode: { kind: "dp", dp: 0.5e5 } } },
    { id: "RH-M3", text: "Venturi maschinell bearbeitet, D 200 mm, d 120 mm (β 0,6), Δp 0,2 bar, ξ 0,1 von Hand", inp: { device: { kind: "venturi", variant: "maschinell bearbeiteter Einlaufkonus", C: null, xi: 0.1 }, D: 0.2, d: 0.12, ...w, mode: { kind: "dp", dp: 0.2e5 } } },
    { id: "RH-M4", text: "Venturi mit C = 0,98 von Hand, D 80 mm, d 40 mm, V̇ 20 m³/h", inp: { device: { kind: "venturi", variant: null, C: 0.98, xi: null }, D: 0.08, d: 0.04, ...w, mode: { kind: "Q", Q: units.m3hToM3s(20) } } },
  ];
}

export interface StossFall { id: string; text: string; inp: SurgeInput }
export function stossFaelle(): StossFall[] {
  return [
    { id: "RH-S1", text: "Chaudhry 2014 Beispiel S. 57 f. (Kootenay Canal, Rohr 1): D 6,71 m, e 19 mm, E 207 GPa, ν 0,3, K 2,19 GPa, ρ 999 kg/m³, Dehnkupplung an einem Ende (dünnwandig, Gl. (2-71)); Δv 1 m/s, l 244 m, schnell",
      inp: { fluid: { kind: "hand", rho: 999, K: 2.19e9 }, wave: { kind: "wand", D: 6.71, e: 0.019, E: 207e9, nu: 0.3, anchor: "b", wall: "duenn", material: "Stahl" }, L: 244, dv: 1, tS: 0, p: 8e5, ps: null } },
    { id: "RH-S2", text: "Roloff Gl. (18.20) bis (18.22): Wasser 20 °C, Richtwert a 1 000 m/s, Δv 1,5 m/s, l 800 m, t_S 6 s (langsam), p 5 bar absolut",
      inp: { fluid: { kind: "wasser", T: units.cToK(20), p: P0 }, wave: { kind: "richtwert", id: "WS01" }, L: 800, dv: 1.5, tS: 6, p: 5e5, ps: null } },
    { id: "RH-S3", text: "Wasser 20 °C, starre Wand (a = w aus IF97), Δv 2 m/s, l 500 m, t_S 0,2 s (schnell), p 3 bar absolut: Unterdruck",
      inp: { fluid: { kind: "wasser", T: units.cToK(20), p: P0 }, wave: { kind: "starr" }, L: 500, dv: 2, tS: 0.2, p: 3e5, ps: null } },
    { id: "RH-S4", text: "Wasser 20 °C, PE-HD 110 × 10 (SDR 11, E 1,1 GPa, ν 0,46 von Hand), dickwandig, längs verankert, Δv 1 m/s, l 300 m, schnell, p 6 bar absolut",
      inp: { fluid: { kind: "wasser", T: units.cToK(20), p: P0 }, wave: { kind: "wand", D: 0.09, e: 0.01, E: 1.1e9, nu: 0.46, anchor: "a", wall: "dick", material: "PE-HD" }, L: 300, dv: 1, tS: 0, p: 6e5, ps: null } },
    { id: "RH-S5", text: "Öl nach Chaudhry Tab. 2-2 (900 kg/m³, K 1,5 GPa), Stahl 28 × 2 dickwandig mit Dehnfugen (E 210 GPa, ν 0,3), Δv 3 m/s, l 12 m, t_S 0,01 s",
      inp: { fluid: { kind: "tabelle", id: "BK06" }, wave: { kind: "wand", D: 0.024, e: 0.002, E: 210e9, nu: 0.3, anchor: "c", wall: "dick", material: "Stahl" }, L: 12, dv: 3, tS: 0.01, p: 100e5, ps: null } },
    { id: "RH-S6", text: "Wellengeschwindigkeit von Hand 400 m/s, Fluid von Hand ρ 1 000 kg/m³, Δv 0,8 m/s, l 150 m, t_S 2 s, p 4 bar, p_v 2,3 kPa von Hand",
      inp: { fluid: { kind: "hand", rho: 1000, K: null }, wave: { kind: "hand", a: 400 }, L: 150, dv: 0.8, tS: 2, p: 4e5, ps: 2300 } },
  ];
}
