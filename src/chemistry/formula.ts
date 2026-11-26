/**
 * Formelparser (Modul chemie, CH-P01 bis CH-P07).
 * Elemente mit Index, Gruppen ( ) und [ ] verschachtelt, Hydrate mit ·, *, . oder •, Ladung nach CH-E1
 * (^2+, ²⁺, {2+}; Vorzeichen ohne Ziffer = ±1; Ziffer direkt vor einem Vorzeichen ohne ^ ist mehrdeutig und wird
 * mit beiden Lesarten gemeldet), Zustand (s), (l), (g), (aq), Elektron e⁻. Summenformel im Hill-System.
 * Keine Rechenwerte, keine Elementdaten außer der Symbolliste.
 */
import { step, type CalcStep } from "../trace";
import { CH_LIMITS, isSymbol } from "./constants";

export type ChState = "s" | "l" | "g" | "aq";
export type Composition = Record<string, number>;

/** Lesart einer mehrdeutigen Ladung (CH-E1). */
export interface ChargeReading { formula: string; display: string; composition: Composition; charge: number }

export interface ParsedFormula {
  ok: boolean;
  input: string;
  composition: Composition;
  charge: number;
  state: ChState | null;
  /** true für das Elektron e⁻. */
  electron: boolean;
  /** Summenformel im Hill-System, ASCII, Ladung als ^n±. */
  hill: string;
  /** Eingabe mit tiefgestellten Indizes und hochgestellter Ladung. */
  display: string;
  error: string | null;
  /** Nur bei mehrdeutiger Ladung: beide Lesarten zur Auswahl. */
  readings: ChargeReading[];
  steps: CalcStep[];
}

const SUB = "₀₁₂₃₄₅₆₇₈₉", SUPD = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const toSub = (s: string): string => s.replace(/\d/g, (c) => SUB[Number(c)]!);
const toSup = (s: string): string => s.replace(/\d/g, (c) => SUPD[Number(c)]!);
/** Ladung als hochgestellter Text: 2 → "²⁺", −1 → "⁻". */
export function chargeSup(q: number): string { return q === 0 ? "" : `${Math.abs(q) === 1 ? "" : toSup(String(Math.abs(q)))}${q > 0 ? "⁺" : "⁻"}`; }
/** Ladung als ASCII: 2 → "^2+", −1 → "^-". */
export function chargeAscii(q: number): string { return q === 0 ? "" : `^${Math.abs(q) === 1 ? "" : Math.abs(q)}${q > 0 ? "+" : "-"}`; }

/** CH-P07 Hill-System: mit C zuerst C, dann H, dann alphabetisch; ohne C alles alphabetisch. */
export function hillFormula(c: Composition, charge = 0): string {
  const els = Object.keys(c).filter((e) => (c[e] ?? 0) > 0);
  const order = els.includes("C") ? ["C", ...(els.includes("H") ? ["H"] : []), ...els.filter((e) => e !== "C" && e !== "H").sort()] : [...els].sort();
  return order.map((e) => `${e}${c[e] === 1 ? "" : c[e]}`).join("") + chargeAscii(charge);
}
export function totalAtoms(c: Composition): number { return Object.values(c).reduce((s, n) => s + n, 0); }

interface Body { ok: true; comp: Composition; pretty: string; groups: number; parts: number }
interface BodyErr { ok: false; error: string }

function add(into: Composition, from: Composition, k: number): void { for (const [e, n] of Object.entries(from)) into[e] = (into[e] ?? 0) + n * k; }

/** Hauptteil ohne Ladung und Zustand: Hydratteile, Gruppen, Elemente (CH-P01 bis CH-P03). */
function parseBody(src: string): Body | BodyErr {
  const parts = src.split("·");
  if (parts.some((p) => p === "")) return { ok: false, error: "leerer Teil im Hydrat (Trenner am Anfang, am Ende oder doppelt)" };
  const comp: Composition = {}; let pretty = ""; let groups = 0;
  for (let pi = 0; pi < parts.length; pi++) {
    let p = parts[pi]!; let mult = 1;
    const lead = /^\d+/.exec(p);
    if (lead) {
      if (pi === 0) return { ok: false, error: `Koeffizient ${lead[0]} gehört nicht in die Formel (Stoffe ohne Vorzahl eingeben)` };
      mult = Number(lead[0]); if (mult === 0) return { ok: false, error: "Vorfaktor 0 im Hydrat" };
      p = p.slice(lead[0].length); if (p === "") return { ok: false, error: "Vorfaktor ohne Formel im Hydrat" };
    }
    const stack: Array<{ comp: Composition; close: string }> = [{ comp: {}, close: "" }];
    let i = 0, pp = "";
    while (i < p.length) {
      const ch = p[i]!;
      if (ch === "(" || ch === "[") {
        if (stack.length > CH_LIMITS.depth) return { ok: false, error: `Klammertiefe über ${CH_LIMITS.depth}` };
        stack.push({ comp: {}, close: ch === "(" ? ")" : "]" }); groups++; pp += ch; i++; continue;
      }
      if (ch === ")" || ch === "]") {
        const top = stack.pop();
        if (!top || stack.length === 0 || top.close !== ch) return { ok: false, error: `Klammer ${ch} ohne passende öffnende Klammer` };
        i++; const m = /^\d+/.exec(p.slice(i)); const k = m ? Number(m[0]) : 1;
        if (k === 0) return { ok: false, error: "Index 0 nach Klammer" };
        if (Object.keys(top.comp).length === 0) return { ok: false, error: "leere Klammer" };
        add(stack[stack.length - 1]!.comp, top.comp, k); pp += ch + (m ? toSub(m[0]) : ""); i += m ? m[0].length : 0; continue;
      }
      if (/[A-Z]/.test(ch)) {
        const two = p.slice(i, i + 2), one = ch;
        let sym: string;
        if (/^[A-Z][a-z]$/.test(two)) {
          if (!isSymbol(two)) return { ok: false, error: `unbekanntes Elementsymbol ${two}` };
          sym = two;
        } else sym = one;
        if (!isSymbol(sym)) return { ok: false, error: `unbekanntes Elementsymbol ${sym}` };
        i += sym.length; const m = /^\d+/.exec(p.slice(i)); const k = m ? Number(m[0]) : 1;
        if (k === 0) return { ok: false, error: `Index 0 bei ${sym}` };
        const c = stack[stack.length - 1]!.comp; c[sym] = (c[sym] ?? 0) + k; pp += sym + (m ? toSub(m[0]) : ""); i += m ? m[0].length : 0; continue;
      }
      if (/[a-z]/.test(ch)) return { ok: false, error: `Kleinbuchstabe »${ch}« ohne Elementsymbol davor: Groß- und Kleinschreibung prüfen (z. B. Co für Cobalt, CO für Kohlenmonoxid)` };
      if (/\d/.test(ch)) return { ok: false, error: `Ziffer ${ch} an unerwarteter Stelle` };
      return { ok: false, error: `unerwartetes Zeichen »${ch}«` };
    }
    if (stack.length !== 1) return { ok: false, error: "offene Klammer" };
    add(comp, stack[0]!.comp, mult);
    pretty += (pi > 0 ? "·" : "") + (mult !== 1 ? String(mult) : "") + pp;
  }
  if (Object.keys(comp).length === 0) return { ok: false, error: "keine Elemente" };
  return { ok: true, comp, pretty, groups, parts: parts.length };
}

function fail(input: string, error: string, readings: ChargeReading[] = []): ParsedFormula {
  return { ok: false, input, composition: {}, charge: 0, state: null, electron: false, hill: "", display: input, error, readings,
    steps: [step("CH-P06", "Eingabefehler", "Formel nicht auswertbar → Meldung statt Rechnung", `»${input}«: ${error}`, 0, "1")] };
}

/** Parser mit Rechenweg (CH-P01 bis CH-P07). */
export function parseFormula(raw: string): ParsedFormula {
  const input = raw;
  let s = raw.replace(/\s+/g, "").replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c))).replace(/[−–]/g, "-").replace(/[*.•∙]/g, "·");
  if (s === "") return fail(input, "leere Eingabe");
  let state: ChState | null = null;
  const st = /\((s|l|g|aq)\)$/.exec(s);
  if (st) { state = st[1] as ChState; s = s.slice(0, st.index); }
  if (/^e(\^?-|⁻)$/.test(s)) {
    return { ok: true, input, composition: {}, charge: -1, state, electron: true, hill: "e^-", display: "e⁻", error: null, readings: [],
      steps: [step("CH-P04", "Ladung", "Elektron e⁻: keine Atome, Ladung −1", `${input} → e⁻, z = −1`, -1, "1")] };
  }
  let charge = 0, chargeText = "";
  let m: RegExpExecArray | null;
  if ((m = /\{(\d*)([+-])\}$/.exec(s)) || (m = /\^(\d*)([+-])$/.exec(s))) {
    const mag = m[1] === "" ? 1 : Number(m[1]); if (mag === 0) return fail(input, "Ladung 0 mit Vorzeichen");
    charge = m[2] === "+" ? mag : -mag; chargeText = m[0]; s = s.slice(0, m.index);
  } else if ((m = /\^([+-])(\d+)$/.exec(s))) {
    const mag = Number(m[2]); if (mag === 0) return fail(input, "Ladung 0 mit Vorzeichen");
    charge = m[1] === "+" ? mag : -mag; chargeText = m[0]; s = s.slice(0, m.index);
  } else if ((m = /([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/.exec(s))) {
    const mag = m[1] === "" ? 1 : Number(m[1]!.replace(/./g, (c) => String(SUPD.indexOf(c)))); if (mag === 0) return fail(input, "Ladung 0 mit Vorzeichen");
    charge = m[2] === "⁺" ? mag : -mag; chargeText = m[0]; s = s.slice(0, m.index);
  } else if ((m = /([+-])$/.exec(s))) {
    const sign = m[1] === "+" ? 1 : -1; const body = s.slice(0, m.index);
    if (/[+-]$/.test(body)) return fail(input, "mehrere Vorzeichen: Ladung als ^2+ oder ²⁺ schreiben");
    const dig = /(\d+)$/.exec(body);
    if (dig) {
      // CH-E1: Ziffer direkt vor dem Vorzeichen: Index oder Ladung? Beide Lesarten melden.
      const d = dig[1]!; const readings: ChargeReading[] = [];
      const a = parseBody(body);
      if (a.ok) readings.push({ formula: `${body}${sign > 0 ? "^+" : "^-"}`, display: a.pretty + chargeSup(sign), composition: a.comp, charge: sign });
      const magB = Number(d.slice(-1)), restB = body.slice(0, body.length - 1);
      if (magB >= 1 && restB !== "" && !/·$/.test(restB)) {
        const b = parseBody(restB);
        if (b.ok) readings.push({ formula: `${restB}^${magB === 1 ? "" : magB}${sign > 0 ? "+" : "-"}`, display: b.pretty + chargeSup(sign * magB), composition: b.comp, charge: sign * magB });
      }
      if (readings.length === 1) {
        const r = readings[0]!, core = r.formula.replace(/\^\d*[+-]$/, ""), rb = parseBody(core);
        if (rb.ok) return finish(input, rb.comp, r.charge, state, r.display, rb.groups, rb.parts, `${d}${m[1]}`);
      }
      if (readings.length === 0) return fail(input, a.ok ? "Ladung nicht lesbar" : a.error);
      return fail(input, `Ladung mehrdeutig (${readings.map((r) => r.display).join(" oder ")}): als ${readings.map((r) => r.formula).join(" bzw. ")} eingeben`, readings);
    }
    charge = sign; chargeText = m[1]!; s = body;
  }
  if (/[+\-⁺⁻^{}]/.test(s)) return fail(input, "Ladung nur am Ende der Formel");
  const b = parseBody(s);
  if (!b.ok) return fail(input, b.error);
  return finish(input, b.comp, charge, state, b.pretty + chargeSup(charge), b.groups, b.parts, chargeText);
}

function finish(input: string, comp: Composition, charge: number, state: ChState | null, prettyCore: string, groups: number, parts: number, chargeText: string): ParsedFormula {
  const steps: CalcStep[] = [];
  const els = Object.keys(comp), atoms = totalAtoms(comp);
  steps.push(step("CH-P01", "Elemente und Indizes", "Symbol aus 118 Elementen, Index ganze Zahl ≥ 1 (ohne Index 1)", `${input} → ${els.map((e) => `${e}: ${comp[e]}`).join(", ")}`, els.length, "1"));
  if (groups > 0) steps.push(step("CH-P02", "Gruppen", "(…)_k und […]_k: Inhalt · k", `${input}: ${groups} Gruppe(n) aufgelöst`, groups, "1"));
  if (parts > 1) steps.push(step("CH-P03", "Hydrat oder Addukt", "A·kB = A + k · B", `${input}: ${parts} Teile`, parts, "1"));
  if (charge !== 0) steps.push(step("CH-P04", "Ladung", "z aus ^n±, ⁿ⁺/ⁿ⁻, {n±}; Vorzeichen ohne Ziffer davor = ±1; Ziffer direkt vor dem Vorzeichen ohne ^ → Meldung mit beiden Lesarten (CH-E1)", `${chargeText} → z = ${charge > 0 ? "+" : "−"}${Math.abs(charge)}`, charge, "1"));
  if (state) steps.push(step("CH-P05", "Zustand", "(s), (l), (g), (aq): gespeichert, nicht gezählt", `(${state})`, 0, "1"));
  const hill = hillFormula(comp, charge);
  steps.push(step("CH-P07", "Summenformel (Hill)", "mit C: C, H, Rest alphabetisch; ohne C: alphabetisch", `${input} → ${hill}`, atoms, "1"));
  return { ok: true, input, composition: comp, charge, state, electron: false, hill, display: prettyCore + (state ? `(${state})` : ""), error: null, readings: [], steps };
}
