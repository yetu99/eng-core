/**
 * Redox nach der Ionen-Elektronen-Methode (Modul chemie, CH-R01 bis CH-R08, Modus D, CH-E6, CH-E7).
 * Primärweg Halbreaktionen: Zentralatom ausgleichen, O mit H2O, H mit H⁺, Ladung mit e⁻; basisch je H⁺ ein OH⁻ auf
 * beiden Seiten. Elektronenausgleich über kgV, Summieren, Kürzen. Gegenprüfung: Summengleichung über den Nullraum
 * (CH-B). Medium nur sauer oder basisch. v1: genau zwei Halbreaktionen (einschließlich Dis- und Komproportionierung).
 * Quelle: Mortimer/Müller, Chemie, Kap. Redoxreaktionen (Ionen-Elektronen-Methode).
 */
import { step, type CalcStep } from "../trace";
import type { ChTable } from "./constants";
import { balance, elementMatrix, type Side, type Species } from "./balance";
import { parseFormula, type Composition, type ParsedFormula } from "./formula";
import { oxidationStates, type OxResult } from "./oxidation";
import { Q, gcdB, lcmB } from "./rational";

export type RedoxMedium = "sauer" | "basisch";

interface Term { key: string; display: string; comp: Composition; charge: number; order: number }
type Half = Map<string, { t: Term; c: bigint }>;

export interface HalfReaction { kind: "oxidation" | "reduktion"; element: string; text: string; electrons: number; factor: number }
export interface RedoxResult {
  status: "eindeutig" | "keine_redox" | "fehler";
  oxStates: OxResult[];
  oxidation: HalfReaction | null;
  reduction: HalfReaction | null;
  /** übertragene Elektronen in der Summengleichung */
  electrons: number | null;
  equation: string | null;
  terms: Array<{ key: string; display: string; side: Side; coefficient: number }>;
  /** Vergleich mit Modus A für dieselben Stoffe. */
  algebraic: "gleich" | "mehrdeutig" | "abweichend" | null;
  check: Array<{ key: string; left: number; right: number }>;
  message: string | null;
  steps: CalcStep[];
}

const AUX: Record<string, Term> = {
  "H2O": { key: "H2O", display: "H₂O", comp: { H: 2, O: 1 }, charge: 0, order: 100 },
  "H^+": { key: "H^+", display: "H⁺", comp: { H: 1 }, charge: 1, order: 101 },
  "HO^-": { key: "HO^-", display: "OH⁻", comp: { H: 1, O: 1 }, charge: -1, order: 102 },
  "e^-": { key: "e^-", display: "e⁻", comp: {}, charge: -1, order: 103 },
};
const term = (p: ParsedFormula, order: number): Term => AUX[p.hill] ? AUX[p.hill]! : { key: p.hill, display: p.display.replace(/\((s|l|g|aq)\)$/, ""), comp: p.composition, charge: p.charge, order };
const isHO = (t: Term): boolean => Object.keys(t.comp).every((e) => e === "H" || e === "O");
const abs = (x: bigint): bigint => (x < 0n ? -x : x);

function addTo(h: Half, t: Term, c: bigint): void { const x = h.get(t.key); if (x) x.c += c; else h.set(t.key, { t, c }); if (h.get(t.key)!.c === 0n) h.delete(t.key); }
const sumEl = (h: Half, e: string): bigint => [...h.values()].reduce((s, x) => s + x.c * BigInt(x.t.comp[e] ?? 0), 0n);
const sumQ = (h: Half): bigint => [...h.values()].reduce((s, x) => s + x.c * BigInt(x.t.charge), 0n);
function text(h: Half): string {
  const items = [...h.values()].sort((a, b) => a.t.order - b.t.order);
  const side = (pos: boolean) => items.filter((x) => (x.c > 0n) === pos).map((x) => `${abs(x.c) === 1n ? "" : `${abs(x.c)} `}${x.t.display}`).join(" + ");
  return `${side(true)} → ${side(false)}`;
}

/** OZ eines Elements in einer Spezies (Mittelwert) oder null. */
function oxOf(ox: OxResult, e: string): Q | null { return ox.atoms.find((a) => a.element === e)?.ox ?? null; }

/** Gemeinsames Element mit OZ-Änderung, bevorzugt nicht H/O. */
function sharedChanged(a: Term, ra: OxResult, b: Term, rb: OxResult): string | null {
  const els = Object.keys(a.comp).filter((e) => (b.comp[e] ?? 0) > 0).sort((x, y) => Number(x === "H" || x === "O") - Number(y === "H" || y === "O") || x.localeCompare(y));
  for (const e of els) { const p = oxOf(ra, e), q = oxOf(rb, e); if (p && q && !p.eq(q)) return e; }
  return null;
}

/** CH-R03, CH-R04: Halbreaktion E → P um das Zentralatom X; Koeffizienten links positiv, rechts negativ. */
function halfReaction(E: Term, P: Term, X: string, medium: RedoxMedium): { h: Half; e: bigint } | { error: string } {
  const a = BigInt(E.comp[X]!), b = BigInt(P.comp[X]!), g = gcdB(a, b);
  const h: Half = new Map();
  addTo(h, E, b / g); addTo(h, P, -(a / g));
  if (E.key === P.key) return { error: "gleicher Stoff auf beiden Seiten" };
  const others = [...new Set([...Object.keys(E.comp), ...Object.keys(P.comp)])].filter((e) => e !== X && e !== "H" && e !== "O");
  const open = others.filter((e) => sumEl(h, e) !== 0n);
  if (open.length) return { error: `Element ${open.join(", ")} in der Halbreaktion ${E.display} → ${P.display} nicht ausgeglichen: Zuschauerionen entfernen (Ionengleichung)` };
  const dO = sumEl(h, "O"); if (dO !== 0n) addTo(h, AUX["H2O"]!, -dO);
  const dH = sumEl(h, "H"); if (dH !== 0n) addTo(h, AUX["H^+"]!, -dH);
  const dq = sumQ(h); if (dq !== 0n) addTo(h, AUX["e^-"]!, dq);
  if (medium === "basisch") {
    const hp = h.get("H^+")?.c ?? 0n;
    if (hp !== 0n) { h.delete("H^+"); addTo(h, AUX["H2O"]!, hp); addTo(h, AUX["HO^-"]!, -hp); }
  }
  const e = h.get("e^-")?.c ?? 0n;
  for (const el of [...new Set([...Object.keys(E.comp), ...Object.keys(P.comp), "H", "O"])]) if (sumEl(h, el) !== 0n) return { error: `Halbreaktion ${E.display} → ${P.display}: ${el} nicht ausgleichbar` };
  if (sumQ(h) !== 0n) return { error: `Halbreaktion ${E.display} → ${P.display}: Ladung nicht ausgleichbar` };
  return { h, e };
}

const fail = (oxStates: OxResult[], message: string, steps: CalcStep[], status: RedoxResult["status"] = "fehler"): RedoxResult =>
  ({ status, oxStates, oxidation: null, reduction: null, electrons: null, equation: null, terms: [], algebraic: null, check: [], message, steps });

/** Modus D (CH-R01 bis CH-R07). H⁺, OH⁻, H₂O und e⁻ in der Eingabe werden ignoriert und neu bestimmt. */
export function redox(species: readonly Species[], medium: RedoxMedium, table: ChTable): RedoxResult {
  const steps: CalcStep[] = [];
  if ((medium as string) !== "sauer" && (medium as string) !== "basisch") return fail([], "Medium sauer oder basisch wählen (neutral ist nicht eindeutig)", steps);
  const parsed = species.map((s) => parseFormula(s.formula));
  const bad = parsed.find((p) => !p.ok);
  if (bad) return fail([], `${bad.input}: ${bad.error}`, [...bad.steps]);
  const items = parsed.map((p, i) => ({ p, side: species[i]!.side, t: term(p, i) })).filter((x) => !AUX[x.p.hill]);
  const L = items.filter((x) => x.side === "edukt"), R = items.filter((x) => x.side === "produkt");
  if (!L.length || !R.length) return fail([], "Edukte und Produkte angeben", steps);
  const ox = new Map<string, OxResult>();
  for (const x of items) { const r = oxidationStates(x.p, table); ox.set(x.t.key, r); steps.push(...r.steps.filter((s) => s.id !== "CH-O07")); if (!r.ok) return fail([...ox.values()], `${x.t.display}: ${r.error}`, steps); }
  const oxStates = [...ox.values()];
  // CH-R01: Änderungen
  const changes: string[] = []; let nCh = 0;
  const allEls = [...new Set(items.flatMap((x) => Object.keys(x.t.comp)))].sort();
  for (const e of allEls) {
    const l = L.filter((x) => x.t.comp[e]).map((x) => oxOf(ox.get(x.t.key)!, e)!), r = R.filter((x) => x.t.comp[e]).map((x) => oxOf(ox.get(x.t.key)!, e)!);
    const lv = [...new Set(l.map((q) => q.toString(true)))], rv = [...new Set(r.map((q) => q.toString(true)))];
    if (lv.length && rv.length && (lv.length > 1 || rv.length > 1 || lv[0] !== rv[0])) { changes.push(`${e}: ${lv.join(", ")} → ${rv.join(", ")}`); nCh++; }
  }
  steps.push(step("CH-R01", "Änderungen der Oxidationszahl", "OZ steigt: oxidiert; OZ sinkt: reduziert", changes.length ? changes.join("; ") : "keine Änderung", nCh, "1"));
  if (!nCh) return fail(oxStates, "keine Redoxreaktion (keine Oxidationszahl ändert sich)", steps, "keine_redox");
  // CH-R02: Paare
  type It = (typeof items)[number];
  const water = { t: AUX["H2O"]!, side: "edukt" as Side, p: parseFormula("H2O") };
  const oxW = oxidationStates("H2O", table); ox.set("H2O", oxW);
  const pairOk = (a: It | typeof water, b: It | typeof water) => sharedChanged(a.t, ox.get(a.t.key)!, b.t, ox.get(b.t.key)!);
  const tryPairs = (cands: Array<Array<[It | typeof water, It | typeof water]>>) => cands.filter((m) => m.every(([a, b]) => pairOk(a, b) !== null));
  let options: Array<Array<[It | typeof water, It | typeof water]>> = [];
  if (L.length === 2 && R.length === 2) options = tryPairs([[[L[0]!, R[0]!], [L[1]!, R[1]!]], [[L[0]!, R[1]!], [L[1]!, R[0]!]]]);
  else if (L.length === 1 && R.length === 2) options = tryPairs([[[L[0]!, R[0]!], [L[0]!, R[1]!]]]);
  else if (L.length === 2 && R.length === 1) options = tryPairs([[[L[0]!, R[0]!], [L[1]!, R[0]!]]]);
  if (!options.length && L.length + R.length === 3) {
    // Stoff nur aus H und O ohne Partner (H2O2, O2): Partner H2O auf der anderen Seite
    const ho = items.filter((x) => isHO(x.t));
    if (ho.length === 1) {
      const s = ho[0]!, rest = items.filter((x) => x !== s), l = rest.filter((x) => x.side === "edukt"), r = rest.filter((x) => x.side === "produkt");
      if (l.length === 1 && r.length === 1) options = tryPairs([[[l[0]!, r[0]!], s.side === "edukt" ? [s, water] : [water, s]]]);
    }
  }
  if (!options.length) return fail(oxStates, "Redoxpaare nicht eindeutig zuordenbar (v1: genau zwei Halbreaktionen); Modus A nutzen", steps);
  if (options.length > 1) return fail(oxStates, "Zuordnung der Redoxpaare mehrdeutig; Modus A nutzen", steps);
  const pairs = options[0]!;
  steps.push(step("CH-R02", "Redoxpaare", "je Element mit OZ-Änderung: Edukt und Produkt mit diesem Element", pairs.map(([a, b]) => `${a.t.display} / ${b.t.display} (${pairOk(a, b)})`).join("; "), pairs.length, "1"));
  // CH-R03: Halbreaktionen
  const halves: Array<{ h: Half; e: bigint; X: string; E: Term; P: Term }> = [];
  for (const [a, b] of pairs) {
    const X = pairOk(a, b)!;
    const r = halfReaction(a.t, b.t, X, medium);
    if ("error" in r) { steps.push(step("CH-R04", "Zuschauer", "Element außer Zentralatom, H, O offen → Ionengleichung nötig", r.error, 1, "1")); return fail(oxStates, r.error, steps); }
    if (r.e === 0n) return fail(oxStates, `Halbreaktion ${a.t.display} → ${b.t.display} ohne Elektronenübertragung`, steps);
    halves.push({ ...r, X, E: a.t, P: b.t });
  }
  const oxH = halves.filter((x) => x.e < 0n), redH = halves.filter((x) => x.e > 0n);
  if (oxH.length !== 1 || redH.length !== 1) return fail(oxStates, "eine Oxidation und eine Reduktion nötig", steps);
  for (const x of [oxH[0]!, redH[0]!]) {
    const dOZ = oxOf(ox.get(x.P.key)!, x.X)!.sub(oxOf(ox.get(x.E.key)!, x.X)!);
    const nX = (x.h.get(x.E.key)?.c ?? 0n) * BigInt(x.E.comp[x.X]!);
    const zOZ = dOZ.mul(new Q(nX));
    const note = abs(zOZ.n) === abs(x.e) && zOZ.d === 1n ? "" : " (weitere Elemente ändern ihre OZ)";
    steps.push(step("CH-R03", `${x.e < 0n ? "Oxidation" : "Reduktion"} (${x.X})`, "Zentralatom ausgleichen, O mit H₂O, H mit H⁺, Ladung mit e⁻ (basisch danach je H⁺ ein OH⁻ auf beiden Seiten); z = |ΔOZ| · Atomzahl", `${text(x.h)}; ΔOZ(${x.X}) = ${dOZ.toString(true)}, z = ${abs(x.e)}${note}`, Number(abs(x.e)), "1"));
  }
  // CH-R05: Elektronenausgleich
  const zo = abs(oxH[0]!.e), zr = abs(redH[0]!.e), Lz = lcmB(zo, zr), fo = Lz / zo, fr = Lz / zr;
  steps.push(step("CH-R05", "Elektronenausgleich", "Faktoren kgV(z_ox, z_red) / z", `kgV(${zo}, ${zr}) = ${Lz}: Oxidation · ${fo}, Reduktion · ${fr}`, Number(Lz), "1"));
  // CH-R06: Summengleichung
  const tot: Half = new Map();
  for (const [h, f] of [[oxH[0]!.h, fo], [redH[0]!.h, fr]] as const) for (const x of h.values()) addTo(tot, x.t, x.c * f);
  tot.delete("e^-");
  const g = [...tot.values()].reduce((s, x) => gcdB(s, x.c), 0n) || 1n;
  for (const x of tot.values()) x.c /= g;
  const eq = text(tot);
  const z = Number(Lz / g);
  steps.push(step("CH-R06", "Summengleichung", "Halbreaktionen addieren, gleiche Stoffe verrechnen, durch ggT teilen", eq, [...tot.values()].reduce((s, x) => s + Number(abs(x.c)), 0), "1"));
  // CH-R07: Probe und Gegenprüfung
  const els = [...new Set([...tot.values()].flatMap((x) => Object.keys(x.t.comp)))].sort();
  const check = [...els, "Ladung"].map((k) => {
    let left = 0, right = 0;
    for (const x of tot.values()) { const v = Number(abs(x.c)) * (k === "Ladung" ? x.t.charge : x.t.comp[k] ?? 0); if (x.c > 0n) left += v; else right += v; }
    return { key: k, left, right };
  });
  const maxRes = Math.max(...check.map((c) => Math.abs(c.left - c.right)));
  const ordered = [...tot.values()].sort((a, b) => a.t.order - b.t.order);
  const terms = ordered.map((x) => ({ key: x.t.key, display: x.t.display, side: (x.c > 0n ? "edukt" : "produkt") as Side, coefficient: Number(abs(x.c)) }));
  const alg = balance(ordered.map((x) => ({ formula: x.t.key === "e^-" ? "e-" : x.t.key, side: x.c > 0n ? "edukt" : "produkt" })));
  const algebraic: RedoxResult["algebraic"] = alg.status === "mehrdeutig" ? "mehrdeutig" : alg.status === "eindeutig" && alg.coefficients.every((c, i) => c === terms[i]!.coefficient) ? "gleich" : "abweichend";
  steps.push(step("CH-R07", "Probe und Gegenprüfung", "Elemente und Ladung ausgeglichen, e⁻ abgegeben = aufgenommen; Vergleich mit Modus A (Nullraum)", `${check.map((c) => `${c.key}: ${c.left} = ${c.right}`).join("; ")}; Modus A: ${algebraic === "gleich" ? "gleiches Ergebnis" : algebraic === "mehrdeutig" ? "algebraisch mehrdeutig, Halbreaktionen eindeutig" : "abweichend"}`, maxRes, "1"));
  if (maxRes !== 0 || algebraic === "abweichend") return fail(oxStates, "Probe fehlgeschlagen", steps);
  const hr = (x: (typeof halves)[number], kind: HalfReaction["kind"], f: bigint): HalfReaction => ({ kind, element: x.X, text: text(x.h), electrons: Number(abs(x.e)), factor: Number(f) });
  return { status: "eindeutig", oxStates, oxidation: hr(oxH[0]!, "oxidation", fo), reduction: hr(redH[0]!, "reduktion", fr), electrons: z, equation: eq, terms, algebraic, check, message: null, steps };
}

/** CH-R08 übertragene Elektronen einer bilanzierten (molekularen) Gleichung: z = Σ_X max(0, Δ_X), Δ_X = Σ_rechts ν·n·OZ − Σ_links ν·n·OZ. */
export function electronTransfer(species: readonly Species[], coefficients: readonly number[], table: ChTable): { z: number | null; estimated: boolean; error: string | null; steps: CalcStep[] } {
  const delta = new Map<string, Q>(); let estimated = false;
  if (coefficients.length !== species.length || coefficients.some((c) => !(c > 0) || !Number.isInteger(c))) return { z: null, estimated, error: "Koeffizienten fehlen oder sind ungültig", steps: [] };
  const parsed = species.map((s) => parseFormula(s.formula));
  const bad = parsed.find((p) => !p.ok);
  if (bad) return { z: null, estimated, error: `${bad.input}: ${bad.error}`, steps: [] };
  const sides = species.map((s) => s.side), mat = elementMatrix(parsed, sides);
  if (mat.values.some((row) => row.reduce((acc, a, j) => acc + a * coefficients[j]!, 0) !== 0)) return { z: null, estimated, error: "Gleichung nicht bilanziert (Atome oder Ladung)", steps: [] };
  for (let i = 0; i < species.length; i++) {
    const r = oxidationStates(species[i]!.formula, table);
    if (!r.ok) return { z: null, estimated, error: `${species[i]!.formula}: ${r.error}`, steps: [] };
    estimated ||= r.estimated;
    const sg = species[i]!.side === "produkt" ? 1 : -1, nu = coefficients[i]!;
    for (const a of r.atoms) delta.set(a.element, (delta.get(a.element) ?? Q.ZERO).add(a.ox.mul(Q.of(a.count * nu * sg))));
  }
  const up = [...delta.entries()].filter(([, d]) => d.sign() > 0), down = [...delta.entries()].filter(([, d]) => d.sign() < 0);
  const zUp = up.reduce((s, [, d]) => s.add(d), Q.ZERO), zDown = down.reduce((s, [, d]) => s.add(d), Q.ZERO).neg();
  if (!zUp.eq(zDown)) return { z: null, estimated, error: "Elektronenbilanz nicht ausgeglichen (Gleichung bilanziert?)", steps: [] };
  const s = step("CH-R08", "Übertragene Elektronen", "z = Σ_X max(0, Δ_X), Δ_X = Σ_rechts ν·n·OZ − Σ_links ν·n·OZ", `${[...up, ...down].map(([e, d]) => `Δ_${e} = ${d.toString(true)}`).join("; ") || "keine Änderung"} → z = ${zUp.toString()}`, zUp.toNumber(), "1");
  return { z: zUp.toNumber(), estimated, error: null, steps: [s] };
}
