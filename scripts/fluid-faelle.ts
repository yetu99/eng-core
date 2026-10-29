/**
 * Beispielfälle der Rohrhydraulik (Modul fluid) für den Formelkatalog (scripts/katalog.ts) und die Abnahme.
 * Jeder Fall erzeugt seine Formeln einmal mit nachrechenbarem Beispiel. Literaturfälle zuerst.
 */
import { fdRepo, units, type LineInput, type LineTask } from "../src/index";

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
  ];
}
