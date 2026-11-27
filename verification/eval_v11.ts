/** Modul chemie v1.1 bis v1.4 (ab 0.25.0): Prüffälle Thermochemie, Gleichgewicht, Kinetik, Elektrochemie, Wasserchemie. */
import { readFileSync } from "node:fs";
import { chemie } from "../src/index";
import { CH_TABLE } from "../scripts/chemie-faelle";

const V11 = JSON.parse(readFileSync(new URL("../test/fixtures/ch_v11.json", import.meta.url), "utf8")) as {
  thermo: chemie.ThermoRow[];
  equilibria: Array<{ id: string; log_k_25: number; delta_h_kJ_mol: number | null; analytic: number[] | null }>;
  potentials: Array<{ id: string; couple: string; half_reaction: string; E0_V: number }>;
};
export const CH_THERMO = chemie.thermoTable(V11.thermo);
export const CH_EQ = new Map(V11.equilibria.map((e) => [e.id, { log_k_25: e.log_k_25, delta_h_J_mol: e.delta_h_kJ_mol === null ? null : e.delta_h_kJ_mol * 1000, analytic: e.analytic }]));
export const CH_HALF = new Map(V11.potentials.map((p) => [p.id, chemie.parseHalfCell(p.id, p.couple, p.half_reaction, p.E0_V)]));

export type ChV11Case =
  | { id: string; type: "chthermo"; terms: Array<[string, "edukt" | "produkt", number]>; T: number; module?: string; abs?: boolean }
  | { id: string; type: "chfuel"; f: string; module?: string; abs?: boolean }
  | { id: string; type: "chmix"; parts: Array<[string, number]>; module?: string; abs?: boolean }
  | { id: string; type: "chheat"; xi: number; dH: number; module?: string; abs?: boolean }
  | { id: string; type: "chk"; dG: number; T: number; module?: string; abs?: boolean }
  | { id: string; type: "chlogk"; e: string; T: number; module?: string; abs?: boolean }
  | { id: string; type: "cheqx"; sp: Array<[string, number, number, chemie.EqKind]>; K: number; mode: "gas" | "loesung"; val: number; module?: string; abs?: boolean }
  | { id: string; type: "chq"; nu: number[]; a: number[]; K: number; T: number; module?: string; abs?: boolean }
  | { id: string; type: "charr"; A: number; Ea: number; T: number; module?: string; abs?: boolean }
  | { id: string; type: "chea"; k1: number; T1: number; k2: number; T2: number; module?: string; abs?: boolean }
  | { id: string; type: "chrate"; n: chemie.RateOrder; k: number; c0: number; t: number; X: number; module?: string; abs?: boolean }
  | { id: string; type: "chorder"; t: number[]; c: number[]; module?: string; abs?: boolean }
  | { id: string; type: "chcell"; a: string; b: string; T: number; act: Record<string, number>; module?: string; abs?: boolean }
  | { id: string; type: "chnernst"; p: string; T: number; act: Record<string, number>; module?: string; abs?: boolean }
  | { id: string; type: "che0"; dG: number; z: number; module?: string; abs?: boolean }
  | { id: string; type: "chluther"; z1: number; E1: number; z2: number; E2: number; module?: string; abs?: boolean }
  | { id: string; type: "chfar"; I: number; t?: number; n?: number; z: number; M: number; etaF: number; module?: string; abs?: boolean }
  | { id: string; type: "chely"; dG: number; dH: number; z: number; U: number; M: number; etaF: number; module?: string; abs?: boolean }
  | { id: string; type: "chdh"; T: number; module?: string; abs?: boolean }
  | { id: string; type: "chab"; sy: Array<[number, number[], number]>; st: Array<[number, number]>; pKw: number; T: number; act: boolean; module?: string; abs?: boolean }
  | { id: string; type: "chhard"; bCa: number; bMg: number; ks: number | null; module?: string; abs?: boolean }
  | { id: string; type: "chion"; ions: Array<[number, number]>; module?: string; abs?: boolean }
  | { id: string; type: "chcarb"; T: number; pH: number; Ca: number; alk: number; I: number; lk: [number, number, number, number, number]; module?: string; abs?: boolean };

export const CH_V11_TYPES: ReadonlySet<string> = new Set(["chthermo", "chfuel", "chmix", "chheat", "chk", "chlogk", "cheqx", "chq", "charr", "chea", "chrate", "chorder", "chcell", "chnernst", "che0", "chluther", "chfar", "chely", "chdh", "chab", "chhard", "chion", "chcarb"]);

const half = (id: string) => { const h = CH_HALF.get(id); if (!h) throw new Error(`Halbzelle ${id} fehlt`); return h; };

export function evalChV11(c: ChV11Case): Record<string, number | null> {
  switch (c.type) {
    case "chthermo": {
      const r = chemie.reactionThermo(c.terms.map(([formula, side, coefficient]) => ({ formula, side, coefficient })), CH_THERMO, c.T);
      if (!r.ok) throw new Error(`${c.id}: ${r.error}`);
      return { dH: r.dH, dS: r.dS, dG298: r.dG298, dGT: r.dGT, logK: r.logK, Tinv: r.Tinv };
    }
    case "chfuel": {
      const r = chemie.fuelValue(c.f, CH_THERMO, CH_TABLE);
      if (!r.ok) throw new Error(`${c.id}: ${r.error}`);
      return { o2: r.o2, Hs_m: r.Hs_m, Hi_m: r.Hi_m, Hs_w: r.Hs_w, Hi_w: r.Hi_w, Hs_v: r.Hs_v, Hi_v: r.Hi_v };
    }
    case "chmix": {
      const r = chemie.mixtureValue(c.parts.map(([f, x]) => { const v = chemie.fuelValue(f, CH_THERMO, CH_TABLE); return { label: f, x, Hs_v: v.Hs_v!, Hi_v: v.Hi_v! }; }));
      return { Hs_v: r.Hs_v, Hi_v: r.Hi_v };
    }
    case "chheat": return { Q: chemie.reactionHeat(c.xi, c.dH).Q };
    case "chk": return { logK: chemie.eqConstant(c.dG, c.T).logK };
    case "chlogk": { const e = CH_EQ.get(c.e); if (!e) throw new Error(c.e); return { logK: chemie.logKAt(e, c.T).logK }; }
    case "cheqx": {
      const r = chemie.equilibriumExtent(c.sp.map(([label, nu, n0, kind]) => ({ label, nu, n0, kind })), c.K, c.mode === "gas" ? { mode: "gas", p: c.val } : { mode: "loesung", V: c.val });
      if (!r.ok) throw new Error(`${c.id}: ${r.error}`);
      const o: Record<string, number | null> = { xi: r.xi };
      r.n.forEach((x, i) => { o[`n${i}`] = x; });
      return o;
    }
    case "chq": { const r = chemie.reactionQuotient(c.nu.map((nu, i) => ({ label: String(i), nu, activity: c.a[i]! })), c.K, c.T); return { lnQ: r.lnQ, dG: r.dG }; }
    case "charr": return { k: chemie.arrhenius(c.A, c.Ea, c.T).k };
    case "chea": { const r = chemie.activationEnergy(c.k1, c.T1, c.k2, c.T2); return { Ea: r.Ea, A: r.A, f: chemie.rateFactor(r.Ea, c.T1, c.T2).factor }; }
    case "chrate": { const r = chemie.rateLaw(c.n, c.k, c.c0, c.t, c.X); return { c: r.c, tHalf: r.tHalf, tX: r.tX }; }
    case "chorder": {
      const r = chemie.orderFromData(c.t, c.c);
      const f = (n: number) => r.fits.find((x) => x.order === n)!;
      return { k0: f(0).k, k1: f(1).k, k2: f(2).k, r0: f(0).r2, r1: f(1).r2, r2: f(2).r2, best: r.best };
    }
    case "chcell": { const r = chemie.cell(half(c.a), half(c.b), c.T, c.act); return { z: r.z, dE0: r.dE0, dE: r.dE, dG: r.dG, logK: r.logK }; }
    case "chnernst": return { E: chemie.nernst(half(c.p), c.T, c.act).E };
    case "che0": return { E0: chemie.potentialFromGibbs(c.dG, c.z).E0 };
    case "chluther": return { E3: chemie.luther(c.z1, c.E1, c.z2, c.E2).E3 };
    case "chfar": {
      const r = chemie.faraday({ I: c.I, z: c.z, M: c.M, etaF: c.etaF, ...(c.t !== undefined && c.t !== null ? { t: c.t } : { n: c.n! }) });
      return { n: r.n, t: r.t, m: r.m, Q: r.Q };
    }
    case "chely": { const r = chemie.electrolysis({ dG: c.dG, dH: c.dH, z: c.z, U: c.U, M: c.M, etaF: c.etaF }); return { Urev: r.Urev, Uth: r.Uth, etaU: r.etaU_HHV, w: r.w, eta: r.eta }; }
    case "chdh": { const A = chemie.debyeHuckelA(c.T).A; return { A, g1: chemie.davies(1, 0.01, A).gamma, g2: chemie.davies(2, 0.01, A).gamma }; }
    case "chab": {
      const r = chemie.acidBase({ systems: c.sy.map(([cT, pK, z0], i) => ({ label: `S${i}`, cT, pK, z0 })), strong: c.st.map(([cc, z], i) => ({ label: `I${i}`, c: cc, z })), pKw: c.pKw, T: c.T, activity: c.act });
      if (!r.ok) throw new Error(`${c.id}: ${r.error}`);
      return { pH: r.pH, I: r.I, beta: r.beta };
    }
    case "chhard": { const r = chemie.hardness(c.bCa, c.bMg, c.ks, CH_TABLE); const o: Record<string, number | null> = { c: r.c, dH: r.dH }; if (c.ks !== null) o["KH"] = r.KH; return o; }
    case "chion": { const ions = c.ions.map(([cc, z], i) => ({ label: String(i), c: cc, z })); return { I: chemie.ionicStrength(ions).I, err: chemie.ionBalance(ions).error }; }
    case "chcarb": {
      const [logK1, logK2, logKw, logKsp, logKH] = c.lk;
      const r = chemie.carbonate({ T: c.T, pH: c.pH, Ca: c.Ca, alk: c.alk, I: c.I, logK1, logK2, logKw, logKsp, logKH }, CH_TABLE);
      return { CT: r.CT, SI: r.SI, pHC: r.pHC, D: r.D, pCO2: r.pCO2 };
    }
  }
}
