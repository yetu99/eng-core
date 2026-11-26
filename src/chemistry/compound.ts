/**
 * Binäre Verbindung vorschlagen (Modul chemie, CH-V01 bis CH-V05, Modus C). Immer als Vorschlag gekennzeichnet.
 * Rollen nach Elektronegativität (Pauling), Varianten aus den üblichen Oxidationszahlen der Datenquelle (CH-E9: alle).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import { ELEMENT_FORM, HYDRIDE_ELEMENT_FIRST, NON_METALS, type ChTable } from "./constants";
import { balance } from "./balance";

export interface CompoundVariant { formula: string; cationOx: number; anionOx: number; equation: string; coefficients: number[]; note: string | null }
export interface CompoundResult { ok: boolean; cation: string | null; anion: string | null; variants: CompoundVariant[]; message: string | null; basis: string; steps: CalcStep[] }

const NOTE = "Vorschlag nach üblichen Oxidationszahlen laut Datenquelle, keine Aussage über Existenz oder Stabilität";

/** CH-V01 bis CH-V05. */
export function suggestCompound(a: string, b: string, table: ChTable): CompoundResult {
  const steps: CalcStep[] = [];
  const none = (message: string): CompoundResult => { steps.push(step("CH-V05", "Kein Vorschlag", "gleiches Element, fehlende Elektronegativität, keine negative übliche OZ, zwei Metalle → kein Vorschlag", `${a} + ${b}: ${message}`, 0, "1")); return { ok: false, cation: null, anion: null, variants: [], message, basis: NOTE, steps }; };
  const ea = table.get(a), eb = table.get(b);
  if (!ea || !eb) return none("Element unbekannt");
  if (a === b) return none("gleiches Element");
  if (ea.electronegativity === null || eb.electronegativity === null) return none(`Elektronegativität fehlt (${[ea, eb].filter((e) => e.electronegativity === null).map((e) => e.symbol).join(", ")})`);
  if (!NON_METALS.has(a) && !NON_METALS.has(b)) return none("zwei Metalle: intermetallische Phase oder Legierung");
  if (ea.electronegativity === eb.electronegativity) return none("gleiche Elektronegativität, Rollen nicht bestimmbar");
  const [cat, an] = ea.electronegativity < eb.electronegativity ? [ea, eb] : [eb, ea];
  const neg = an.oxCommon.filter((x) => x < 0);
  if (!neg.length) return none(`keine negative übliche Oxidationszahl für ${an.symbol}`);
  const bOx = Math.min(...neg);
  const pos = [...new Set(cat.oxCommon.filter((x) => x > 0))].sort((x, y) => x - y);
  if (!pos.length) return none(`keine positive übliche Oxidationszahl für ${cat.symbol}`);
  steps.push(step("CH-V01", "Rollen", "höhere Elektronegativität = Anion (negativste übliche OZ), anderes Element = Kation (alle positiven üblichen OZ)", `χ(${cat.symbol}) = ${fmt(cat.electronegativity, 3)} < χ(${an.symbol}) = ${fmt(an.electronegativity, 3)}: Kation ${cat.symbol} (${pos.map((x) => `+${x}`).join(", ")}), Anion ${an.symbol} (−${-bOx})`, pos.length, "1", "Pauling-Elektronegativität, Abzug ch_elements"));
  const variants: CompoundVariant[] = [];
  for (const q of pos) {
    const B = -bOx, g = gcd(q, B), x = B / g, y = q / g;
    const elFirst = cat.symbol === "H" && HYDRIDE_ELEMENT_FIRST.has(an.symbol);
    const part = (s: string, n: number) => `${s}${n === 1 ? "" : n}`;
    const formula = elFirst ? part(an.symbol, y) + part(cat.symbol, x) : part(cat.symbol, x) + part(an.symbol, y);
    steps.push(step("CH-V02", `Formel für ${cat.symbol} +${q}`, "K_x A_y mit x = |b| / ggT(a, |b|), y = a / ggT(a, |b|)", `a = +${q}, b = −${-bOx}: x = ${x}, y = ${y} → ${formula}`, x + y, "1"));
    if (elFirst) steps.push(step("CH-V03", "Schreibweise", "weniger elektronegatives Element zuerst; Hydride von B, C, Si, Ge, N, P, As, Sb mit Element zuerst", `${part(cat.symbol, x)}${part(an.symbol, y)} → ${formula}`, 1, "1", "IUPAC Red Book IR-4.4"));
    const fa = ELEMENT_FORM[cat.symbol] ?? cat.symbol, fb = ELEMENT_FORM[an.symbol] ?? an.symbol;
    const r = balance([{ formula: fa, side: "edukt" }, { formula: fb, side: "edukt" }, { formula, side: "produkt" }]);
    if (r.status !== "eindeutig") continue;
    steps.push(step("CH-V04", `Bildungsgleichung ${formula}`, "Elemente in Standardform (H₂, N₂, O₂, F₂, Cl₂, Br₂, I₂, P₄, S₈, sonst einatomig), Bilanz über CH-B", r.equation, r.coefficients.reduce((s, c) => s + c, 0), "1"));
    variants.push({ formula, cationOx: q, anionOx: bOx, equation: r.equation, coefficients: r.coefficients, note: elFirst ? "Hydrid: Element vor H geschrieben" : null });
  }
  return { ok: variants.length > 0, cation: cat.symbol, anion: an.symbol, variants, message: variants.length ? null : "kein Vorschlag", basis: NOTE, steps };
}

function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
