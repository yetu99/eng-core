/**
 * Grundlagen (Modul elektrik, EL-G01 bis EL-G07): Ohmsches Gesetz, Leistung, Leitwert, Reihe, Parallel, Teiler.
 * SI: V, A, Ω, S, W, H, F. Reine Funktionen mit Rechenweg.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";

const f6 = (x: number): string => fmt(x, 6);
export interface Calc<T> { value: T; steps: CalcStep[] }

export type OhmGiven = "U und R" | "U und I" | "I und R" | "P und U" | "P und R" | "P und I";
export const OHM_GIVEN: readonly OhmGiven[] = ["U und R", "U und I", "I und R", "P und U", "P und R", "P und I"];
export interface OhmValues { u: number; i: number; r: number; p: number }

/** Zwei aus U, I, R, P gegeben → alle vier (EL-G01, EL-G02). Wirft bei ungültigen Werten (Division durch 0, negativ unter Wurzel). */
export function ohm(given: OhmGiven, v: { readonly [K in keyof OhmValues]?: number | undefined }): Calc<OhmValues> {
  const need = (k: keyof OhmValues, positive = false): number => {
    const x = v[k];
    if (typeof x !== "number" || !Number.isFinite(x)) throw new Error(`${k.toUpperCase()} fehlt`);
    if (positive && !(x > 0)) throw new Error(`${k.toUpperCase()} muss größer 0 sein`);
    return x;
  };
  const s: CalcStep[] = [];
  let u: number, i: number, r: number, p: number;
  switch (given) {
    case "U und R": u = need("u"); r = need("r", true); i = u / r; p = (u * u) / r;
      s.push(step("EL-G01-I", "Strom", "I = U / R", `I = ${f6(u)} V / ${f6(r)} Ω`, i, "A"), step("EL-G02-UR", "Leistung", "P = U² / R", `P = (${f6(u)} V)² / ${f6(r)} Ω`, p, "W")); break;
    case "U und I": u = need("u"); i = need("i"); if (i === 0) throw new Error("I darf nicht 0 sein"); r = u / i; p = u * i;
      s.push(step("EL-G01-R", "Widerstand", "R = U / I", `R = ${f6(u)} V / ${f6(i)} A`, r, "Ω"), step("EL-G02-UI", "Leistung", "P = U · I", `P = ${f6(u)} V · ${f6(i)} A`, p, "W")); break;
    case "I und R": i = need("i"); r = need("r", true); u = r * i; p = i * i * r;
      s.push(step("EL-G01-U", "Spannung", "U = R · I", `U = ${f6(r)} Ω · ${f6(i)} A`, u, "V"), step("EL-G02-IR", "Leistung", "P = I² · R", `P = (${f6(i)} A)² · ${f6(r)} Ω`, p, "W")); break;
    case "P und U": p = need("p", true); u = need("u"); if (u === 0) throw new Error("U darf nicht 0 sein"); i = p / u; r = (u * u) / p;
      s.push(step("EL-G02-IPU", "Strom", "I = P / U", `I = ${f6(p)} W / ${f6(u)} V`, i, "A"), step("EL-G02-RPU", "Widerstand", "R = U² / P", `R = (${f6(u)} V)² / ${f6(p)} W`, r, "Ω")); break;
    case "P und R": p = need("p", true); r = need("r", true); u = Math.sqrt(p * r); i = Math.sqrt(p / r);
      s.push(step("EL-G02-UPR", "Spannung", "U = √(P · R)", `U = √(${f6(p)} W · ${f6(r)} Ω)`, u, "V"), step("EL-G02-IPR", "Strom", "I = √(P / R)", `I = √(${f6(p)} W / ${f6(r)} Ω)`, i, "A")); break;
    case "P und I": p = need("p", true); i = need("i"); if (i === 0) throw new Error("I darf nicht 0 sein"); u = p / i; r = p / (i * i);
      s.push(step("EL-G02-UPI", "Spannung", "U = P / I", `U = ${f6(p)} W / ${f6(i)} A`, u, "V"), step("EL-G02-RPI", "Widerstand", "R = P / I²", `R = ${f6(p)} W / (${f6(i)} A)²`, r, "Ω")); break;
  }
  return { value: { u, i, r, p }, steps: s };
}

/** EL-G03 Leitwert. */
export function conductance(r: number): Calc<number> {
  if (!(r > 0)) throw new Error("R muss größer 0 sein");
  return { value: 1 / r, steps: [step("EL-G03", "Leitwert", "G = 1 / R", `G = 1 / ${f6(r)} Ω`, 1 / r, "S")] };
}

export type Kind = "R" | "L" | "C";
const UNIT: Record<Kind, string> = { R: "Ω", L: "H", C: "F" };
const NAME: Record<Kind, string> = { R: "Widerstände", L: "Induktivitäten", C: "Kapazitäten" };

/** EL-G04 Reihenschaltung: R und L addieren, bei C die Kehrwerte. */
export function series(kind: Kind, xs: readonly number[]): Calc<number> {
  if (!xs.length || xs.some((x) => !(x > 0))) throw new Error("Werte müssen größer 0 sein");
  const u = UNIT[kind], list = xs.map((x) => `${f6(x)} ${u}`);
  if (kind === "C") { const v = 1 / xs.reduce((s, x) => s + 1 / x, 0); return { value: v, steps: [step("EL-G04-C", `Reihenschaltung ${NAME.C}`, "1 / C_ges = Σ 1 / C_i", `1 / C_ges = ${list.map((x) => `1 / ${x}`).join(" + ")}`, v, u)] }; }
  const v = xs.reduce((s, x) => s + x, 0);
  return { value: v, steps: [step(`EL-G04-${kind}`, `Reihenschaltung ${NAME[kind]}`, `${kind}_ges = Σ ${kind}_i`, `${kind}_ges = ${list.join(" + ")}`, v, u)] };
}

/** EL-G05 Parallelschaltung: bei R und L die Kehrwerte, C addieren. */
export function parallel(kind: Kind, xs: readonly number[]): Calc<number> {
  if (!xs.length || xs.some((x) => !(x > 0))) throw new Error("Werte müssen größer 0 sein");
  const u = UNIT[kind], list = xs.map((x) => `${f6(x)} ${u}`);
  if (kind === "C") { const v = xs.reduce((s, x) => s + x, 0); return { value: v, steps: [step("EL-G05-C", `Parallelschaltung ${NAME.C}`, "C_ges = Σ C_i", `C_ges = ${list.join(" + ")}`, v, u)] }; }
  const v = 1 / xs.reduce((s, x) => s + 1 / x, 0);
  return { value: v, steps: [step(`EL-G05-${kind}`, `Parallelschaltung ${NAME[kind]}`, `1 / ${kind}_ges = Σ 1 / ${kind}_i`, `1 / ${kind}_ges = ${list.map((x) => `1 / ${x}`).join(" + ")}`, v, u)] };
}

/** EL-G06 unbelasteter Spannungsteiler. */
export function voltageDivider(u: number, r1: number, r2: number): Calc<number> {
  if (!(r1 >= 0) || !(r2 >= 0) || !(r1 + r2 > 0)) throw new Error("R_1 + R_2 muss größer 0 sein");
  const v = (u * r2) / (r1 + r2);
  return { value: v, steps: [step("EL-G06", "Unbelasteter Spannungsteiler", "U_2 = U · R_2 / (R_1 + R_2)", `U_2 = ${f6(u)} V · ${f6(r2)} Ω / (${f6(r1)} Ω + ${f6(r2)} Ω)`, v, "V")] };
}

/** EL-G07 Stromteiler: Strom im Zweig k von parallelen Widerständen. */
export function currentDivider(i: number, rs: readonly number[], k: number): Calc<number> {
  if (!rs.length || rs.some((r) => !(r > 0)) || !(k >= 0 && k < rs.length)) throw new Error("Widerstände größer 0, Zweig vorhanden");
  const gs = rs.map((r) => 1 / r), sum = gs.reduce((s, g) => s + g, 0), v = (i * gs[k]!) / sum;
  return { value: v, steps: [step("EL-G07", `Stromteiler Zweig ${k + 1}`, "I_k = I · G_k / Σ G_i", `I_${k + 1} = ${f6(i)} A · ${f6(gs[k]!)} S / ${f6(sum)} S`, v, "A")] };
}
