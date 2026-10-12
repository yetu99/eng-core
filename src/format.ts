/**
 * Zahlen- und Symbolformatierung für Anzeige und Rechenweg.
 * Deutsche Notation: Dezimalkomma, keine Tausendertrennung, Zehnerpotenzen ab |x| ≥ 1e5 oder < 1e-3.
 */
const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

/** Formatiert eine Zahl mit `sig` signifikanten Stellen. Nicht endliche Werte → "–". */
export function fmt(x: number | null | undefined, sig = 4): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  if (x === 0) return "0";
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) {
    const e = Math.floor(Math.log10(ax));
    const m = x / Math.pow(10, e);
    const exp = String(e).split("").map((c) => SUP[c] ?? c).join("");
    return `${Number(m.toPrecision(sig)).toString().replace(".", ",")}·10${exp}`;
  }
  return Number(x.toPrecision(sig)).toString().replace(".", ",");
}

/**
 * Wandelt die Kurzschreibweise des Rechenwegs in HTML mit Indizes um:
 * "φ_B^e" → "φ<sub>B</sub><sup>e</sup>", "A^1,5" → "A<sup>1,5</sup>", "σ_θ" → "σ<sub>θ</sub>" (griechische Kleinbuchstaben im Index).
 * Eingaben stammen ausschließlich aus dem Rechenkern (keine Benutzereingaben).
 */
export function sym(t: string): string {
  return String(t)
    .replace(/_\{?([A-Za-z0-9,\u03b1-\u03c9]+(?:\.[a-z]+)?)\}?/g, "<sub>$1</sub>")
    .replace(/\^([A-Za-z0-9,½⅓⅔()/]+)/g, "<sup>$1</sup>");
}
