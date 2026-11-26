/**
 * Oxidationszahlen ohne Strukturformel (Modul chemie, CH-O01 bis CH-O07).
 * Regelrang: 1 F = −1; 2 Alkali +1, Erdalkali +2, Al +3; 3 H = +1; 4 O = −2; 5 Cl, Br, I = −1 nur als
 * elektronegativstes Element. Rest über die Ladungsbilanz als Bruch (gemittelte OZ, Fe3O4 → +8/3).
 * Regelkonflikt: Regel mit niedrigstem Rang lösen (H2O2, NaH, OF2, KO2). Mehrere freie Elemente: Schätzung nach
 * Elektronegativität, markiert (CH-E8). Quellen: IUPAC Red Book 2005 IR-9.1; Riedel/Janiak Kap. Redoxreaktionen.
 */
import { step, type CalcStep } from "../trace";
import { ALKALI, ALKALINE_EARTH, HALOGENS_RULE, type ChTable } from "./constants";
import { parseFormula, type ParsedFormula } from "./formula";
import { Q } from "./rational";

export interface AtomOx { element: string; count: number; ox: Q; rule: string }
export interface OxResult {
  ok: boolean;
  formula: string;
  atoms: AtomOx[];
  /** true, wenn mindestens ein Wert geschätzt wurde (CH-O06). */
  estimated: boolean;
  error: string | null;
  steps: CalcStep[];
}

/** Regel und Rang eines Elements in der Spezies (CH-O03); null = keine feste Regel. */
function ruleOf(e: string, els: readonly string[], table: ChTable): { rank: number; ox: number; text: string } | null {
  if (e === "F") return { rank: 1, ox: -1, text: "F = −1" };
  if (ALKALI.has(e)) return { rank: 2, ox: 1, text: "Alkalimetall = +1" };
  if (ALKALINE_EARTH.has(e)) return { rank: 2, ox: 2, text: "Erdalkalimetall = +2" };
  if (e === "Al") return { rank: 2, ox: 3, text: "Al = +3" };
  if (e === "H") return { rank: 3, ox: 1, text: "H = +1" };
  if (e === "O") return { rank: 4, ox: -2, text: "O = −2" };
  if (HALOGENS_RULE.has(e)) {
    const en = table.get(e)?.electronegativity ?? null;
    const top = en !== null && els.every((x) => x === e || (table.get(x)?.electronegativity ?? -Infinity) < en);
    if (top) return { rank: 5, ox: -1, text: `${e} = −1 (elektronegativstes Element)` };
  }
  return null;
}

const sg = (x: number): string => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : "0");
const oxList = (atoms: readonly AtomOx[]): string => atoms.map((a) => `${a.element} ${a.ox.toString(true)}`).join(", ");

/** CH-O01 bis CH-O07 für eine Spezies. */
export function oxidationStates(formula: string | ParsedFormula, table: ChTable): OxResult {
  const p = typeof formula === "string" ? parseFormula(formula) : formula;
  const steps: CalcStep[] = [];
  if (!p.ok) return { ok: false, formula: p.input, atoms: [], estimated: false, error: p.error, steps: p.steps };
  if (p.electron) return { ok: true, formula: "e⁻", atoms: [], estimated: false, error: null, steps };
  const els = Object.keys(p.composition).sort(), c = p.composition, z = new Q(BigInt(p.charge));
  const name = p.display;
  if (els.length === 1) {
    const e = els[0]!, n = c[e]!, ox = z.div(Q.of(n));
    const atoms = [{ element: e, count: n, ox, rule: p.charge === 0 ? "elementar" : "Ion eines Elements" }];
    steps.push(p.charge === 0
      ? step("CH-O01", `Elementare Form ${name}`, "nur ein Element, Ladung 0 → OZ = 0", `${name}: OZ(${e}) = 0`, 0, "1", "IUPAC Red Book IR-9.1")
      : step("CH-O02", `Ion ${name}`, "OZ = Ladung / Anzahl", `OZ(${e}) = ${sg(p.charge)} / ${n}`, ox.toNumber(), "1", "IUPAC Red Book IR-9.1"));
    steps.push(step("CH-O07", `Probe ${name}`, "Σ Anzahl · OZ = Ladung", `${n} · (${ox.toString(true)}) = ${sg(p.charge)}`, 0, "1"));
    return { ok: true, formula: name, atoms, estimated: false, error: null, steps };
  }
  const fixed = new Map<string, { rank: number; ox: Q; text: string }>();
  for (const e of els) { const r = ruleOf(e, els, table); if (r) fixed.set(e, { rank: r.rank, ox: Q.of(r.ox), text: r.text }); }
  if (fixed.size) steps.push(step("CH-O03", `Feste Regeln ${name}`, "Rang 1 F −1; 2 Alkali +1, Erdalkali +2, Al +3; 3 H +1; 4 O −2; 5 Cl, Br, I −1 als elektronegativstes Element", [...fixed.entries()].map(([e, r]) => r.text).join("; "), fixed.size, "1", "IUPAC Red Book IR-9.1; Riedel/Janiak"));
  const sumFixed = (): Q => [...fixed.entries()].reduce((s, [e, r]) => s.add(r.ox.mul(Q.of(c[e]!))), Q.ZERO);
  let free = els.filter((e) => !fixed.has(e));
  let estimated = false;
  if (free.length === 0) {
    if (!sumFixed().eq(z)) {
      // CH-O05: Regel mit niedrigstem Rang lösen (bei gleichem Rang die geringere Elektronegativität)
      const loose = [...fixed.entries()].sort((a, b) => b[1].rank - a[1].rank || (table.get(a[0])?.electronegativity ?? 0) - (table.get(b[0])?.electronegativity ?? 0))[0]!;
      fixed.delete(loose[0]);
      const ox = z.sub(sumFixed()).div(Q.of(c[loose[0]]!));
      steps.push(step("CH-O05", `Regelkonflikt ${name}`, "Summe ≠ Ladung: Regel mit niedrigstem Rang lösen, Element über Ladungsbilanz", `Regel »${loose[1].text}« gelöst: OZ(${loose[0]}) = (${sg(p.charge)} − (${sumFixed().toString(true)})) / ${c[loose[0]]}`, ox.toNumber(), "1"));
      fixed.set(loose[0], { rank: 9, ox, text: `${loose[0]} aus Ladungsbilanz (Regel gelöst)` });
    }
  } else if (free.length >= 2) {
    // CH-O06: elektronegativstes freies Element erhält seine negativste übliche OZ, bis eines übrig ist
    while (free.length > 1) {
      const withEn = free.map((e) => ({ e, en: table.get(e)?.electronegativity ?? null }));
      if (withEn.some((x) => x.en === null)) return { ok: false, formula: name, atoms: [], estimated: false, error: `Oxidationszahlen nicht bestimmbar: Elektronegativität fehlt (${withEn.filter((x) => x.en === null).map((x) => x.e).join(", ")})`, steps };
      const top = withEn.sort((a, b) => b.en! - a.en!)[0]!.e;
      const list = table.get(top)?.oxCommon ?? [];
      if (!list.length) return { ok: false, formula: name, atoms: [], estimated: false, error: `Oxidationszahlen nicht bestimmbar: keine übliche OZ für ${top}`, steps };
      const ox = Math.min(...list);
      fixed.set(top, { rank: 8, ox: Q.of(ox), text: `${top} = ${sg(ox)} (geschätzt)` });
      steps.push(step("CH-O06", `Schätzung ${name}`, "mehrere freie Elemente: elektronegativstes erhält seine negativste übliche OZ (markiert)", `${top}: ${sg(ox)}, geschätzt, Strukturformel nötig`, ox, "1"));
      free = free.filter((e) => e !== top); estimated = true;
    }
  }
  if (free.length === 1) {
    const e = free[0]!, ox = z.sub(sumFixed()).div(Q.of(c[e]!));
    steps.push(step("CH-O04", `Ladungsbilanz ${name}`, "OZ = (Ladung − Σ festgelegt) / Anzahl", `OZ(${e}) = (${sg(p.charge)} − (${sumFixed().toString(true)})) / ${c[e]}`, ox.toNumber(), "1"));
    fixed.set(e, { rank: 9, ox, text: `${e} aus Ladungsbilanz` });
  }
  const atoms: AtomOx[] = els.map((e) => ({ element: e, count: c[e]!, ox: fixed.get(e)!.ox, rule: fixed.get(e)!.text }));
  const sum = atoms.reduce((s, a) => s.add(a.ox.mul(Q.of(a.count))), Q.ZERO);
  steps.push(step("CH-O07", `Probe ${name}`, "Σ Anzahl · OZ = Ladung", `${atoms.map((a) => `${a.count} · (${a.ox.toString(true)})`).join(" + ")} = ${sum.toString()}`, sum.sub(z).toNumber(), "1"));
  if (!sum.eq(z)) return { ok: false, formula: name, atoms, estimated, error: "Probe der Oxidationszahlen fehlgeschlagen", steps };
  return { ok: true, formula: name, atoms, estimated, error: null, steps };
}

export { oxList };
