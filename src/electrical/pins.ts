/**
 * Pinstrom am Mikrocontroller (Modul elektrik, EL-A, ab 0.21.0, Konzept etechnik/konzept_v1_1.md Abschn. 3.3).
 *
 * Grenzwerte als Fachdaten (E-v11-8) aus data/fd/mcu_*.json (Supabase fd_mcu_*, Abzug `node scripts/pull-data.mjs --fd`).
 * Warnstufen (E-v11-9):
 *  - ATmega328P: Fehler über I_Pin,abs (Absolute Maximum Ratings), Warnung über I_ref (Prüfbedingung der Pegel),
 *    Fehler Summe über I_Summe (VCC und GND), mit Pinname zusätzlich Portgruppen.
 *  - ESP32: kein Absolutgrenzwert je Pin im Datenblatt; Warnung ab 0,8 der typischen Treiberfähigkeit (I_OH beim
 *    Quellen, I_OL beim Senken), Fehler darüber; Fehler Summe über I_Summe (kumuliert).
 * Pinstrom I_Pin = −I des Digitalpins (Verbraucherzählpfeil): > 0 Quellstrom (HIGH treibt), < 0 Senkstrom (LOW nimmt auf).
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import type { ElElement, ElFinding, ElNetlist } from "./network";
import boardsJson from "../../data/fd/mcu_boards.json";
import limitsJson from "../../data/fd/mcu_limits.json";
import portGroupsJson from "../../data/fd/mcu_port_groups.json";
import pinsJson from "../../data/fd/mcu_pins.json";

export interface FdMcuBoard { id: string; board: string; mcu: string; u_io_v: number; remark: string | null; source_id: string; source_locator: string }
export type McuQuantity = "i_pin_abs" | "i_pin_ref" | "i_oh_typ" | "i_ol_typ" | "i_sum";
export interface FdMcuLimit { id: string; mcu: string; quantity: McuQuantity; value_a: number; remark: string | null; source_id: string; source_locator: string }
export interface FdMcuPortGroup { id: string; mcu: string; direction: "source" | "sink"; ports: string[]; i_max_a: number; remark: string | null; source_id: string; source_locator: string }
export interface FdMcuPin { id: string; board: string; pin: string; port: string; remark: string | null; source_id: string; source_locator: string }

export const MCU_BOARDS = boardsJson as unknown as readonly FdMcuBoard[];
export const MCU_LIMITS = limitsJson as unknown as readonly FdMcuLimit[];
export const MCU_PORT_GROUPS = portGroupsJson as unknown as readonly FdMcuPortGroup[];
export const MCU_PINS = pinsJson as unknown as readonly FdMcuPin[];
/** Vorgabe-Board des Digitalpins ohne Angabe (E-v11-11). */
export const DEFAULT_BOARD = "Uno";
/** ESP32: Warnung ab diesem Anteil der Treiberfähigkeit (E-v11-9, wie UTIL_WARN). */
export const ESP_WARN = 0.8;

export const boardOf = (name: string): FdMcuBoard | undefined => MCU_BOARDS.find((b) => b.board === name);
export const limitOf = (mcu: string, q: McuQuantity): FdMcuLimit | undefined => MCU_LIMITS.find((l) => l.mcu === mcu && l.quantity === q);
export const portOf = (board: string, pin: string): string | undefined => MCU_PINS.find((p) => p.board === board && p.pin === pin)?.port;
/** HIGH-Spannung des Boards in V (E-v11-11), undefined bei unbekanntem Board. */
export const boardHighVoltage = (board: string): number | undefined => boardOf(board)?.u_io_v;

export interface PinCheck {
  board: string; mcu: string; pin: string | null; port: string | null;
  /** Pinstrom in A (> 0 Quellstrom). */
  i: number;
  /** Auslastung gegen den Absolutgrenzwert (null: keiner im Datenblatt) und gegen die Pegel- bzw. Treibergrenze. */
  aAbs: number | null; aRef: number | null;
  level: "ok" | "warn" | "fail";
}
export interface BoardSum { board: string; mcu: string; source: number; sink: number; limit: number; a: number }
export interface PinReport { pins: Record<string, PinCheck>; boards: BoardSum[]; steps: CalcStep[] }

const f6 = (x: number): string => fmt(x, 6);
const mA = (x: number): string => `${fmt(x * 1000, 3)} mA`;
const lbl = (e: ElElement): string => e.label ?? e.id;

/** EL-A01 bis EL-A05 für alle Digitalpins des Netzes. iOf liefert den Strom I des Bauteils (Verbraucherzählpfeil). */
export function pinChecks(net: ElNetlist, iOf: (id: string) => number | undefined, findings: ElFinding[]): PinReport {
  const pins: Record<string, PinCheck> = {}, steps: CalcStep[] = [];
  const sums = new Map<string, { mcu: string; source: number; sink: number }>();
  const groups = new Map<string, number>();
  for (const e of net.elements) {
    if (e.kind !== "digitalpin") continue;
    const i0 = iOf(e.id); if (i0 === undefined) continue;
    const L = lbl(e), boardName = typeof e.params["board"] === "string" && e.params["board"] ? (e.params["board"] as string) : DEFAULT_BOARD;
    const board = boardOf(boardName);
    if (!board) { findings.push({ level: "warn", elementId: e.id, text: `${L}: Board ${boardName} unbekannt, Pinstrom nicht geprüft` }); continue; }
    const pinName = typeof e.params["pin"] === "string" && e.params["pin"] ? (e.params["pin"] as string) : null;
    const port = pinName ? portOf(board.board, pinName) ?? null : null;
    if (pinName && !port && board.mcu === "ATmega328P") findings.push({ level: "info", elementId: e.id, text: `${L}: Pin ${pinName} am ${board.board} unbekannt oder kein Ausgang, Portgruppe nicht geprüft` });
    const i = -i0, ai = Math.abs(i);
    steps.push(step("EL-A01", `Pinstrom ${L} (${board.board}, ${board.mcu}${pinName ? `, ${pinName}` : ""}; > 0 Quellstrom)`, "I_Pin = −I (Verbraucherzählpfeil des Digitalpins)", `I_Pin = −(${f6(i0)} A)`, i, "A"));
    let level: PinCheck["level"] = "ok", aAbs: number | null = null, aRef: number | null = null;
    const abs = limitOf(board.mcu, "i_pin_abs");
    if (abs) {
      aAbs = ai / abs.value_a;
      steps.push(step("EL-A02", `Auslastung ${L} gegen Absolutgrenzwert ${board.mcu} (${abs.source_locator})`, "a = |I_Pin| / I_Pin,abs", `a = ${f6(ai)} A / ${f6(abs.value_a)} A`, aAbs, "1"));
      if (aAbs > 1) { level = "fail"; findings.push({ level: "fail", elementId: e.id, text: `${L}: Pinstrom ${mA(ai)} über ${mA(abs.value_a)} (${board.mcu}, ${abs.source_locator})` }); }
    }
    const ref = limitOf(board.mcu, "i_pin_ref") ?? limitOf(board.mcu, i >= 0 ? "i_oh_typ" : "i_ol_typ");
    if (ref) {
      aRef = ai / ref.value_a;
      const esp = ref.quantity !== "i_pin_ref";
      steps.push(step("EL-A03", `Auslastung ${L} gegen ${esp ? `Treiberfähigkeit ${i >= 0 ? "I_OH" : "I_OL"}` : "Pegelgrenze (Prüfbedingung)"} ${board.mcu} (${ref.source_locator})`, "a = |I_Pin| / I_ref", `a = ${f6(ai)} A / ${f6(ref.value_a)} A`, aRef, "1"));
      if (esp) {
        if (aRef > 1) { level = "fail"; findings.push({ level: "fail", elementId: e.id, text: `${L}: Pinstrom ${mA(ai)} über ${mA(ref.value_a)} (${board.mcu}, ${ref.source_locator}): Pegel nicht mehr eingehalten, kein Absolutgrenzwert im Datenblatt` }); }
        else if (aRef > ESP_WARN) { if (level === "ok") level = "warn"; findings.push({ level: "warn", elementId: e.id, text: `${L}: Pinstrom ${mA(ai)}, ${Math.round(aRef * 100)} % der Treiberfähigkeit ${mA(ref.value_a)} (${board.mcu}, ${ref.source_locator})` }); }
      } else if (aRef > 1 && level !== "fail") { level = "warn"; findings.push({ level: "warn", elementId: e.id, text: `${L}: Pinstrom ${mA(ai)} über ${mA(ref.value_a)}, Pegel nicht mehr garantiert (${board.mcu}, ${ref.source_locator})` }); }
    }
    pins[e.id] = { board: board.board, mcu: board.mcu, pin: pinName, port, i, aAbs, aRef, level };
    const sm = sums.get(board.board) ?? { mcu: board.mcu, source: 0, sink: 0 };
    if (i >= 0) sm.source += i; else sm.sink -= i;
    sums.set(board.board, sm);
    if (port) for (const g of MCU_PORT_GROUPS) if (g.mcu === board.mcu && g.ports.includes(port) && (g.direction === "source") === (i >= 0)) groups.set(`${board.board}|${g.id}`, (groups.get(`${board.board}|${g.id}`) ?? 0) + ai);
  }
  const boards: BoardSum[] = [];
  for (const [bn, sm] of sums) {
    const lim = limitOf(sm.mcu, "i_sum"); if (!lim) continue;
    const a = Math.max(sm.source, sm.sink) / lim.value_a;
    boards.push({ board: bn, mcu: sm.mcu, source: sm.source, sink: sm.sink, limit: lim.value_a, a });
    steps.push(step("EL-A04", `Summenstrom ${bn} (${sm.mcu}, ${lim.source_locator})`, "a = max(Σ I_Quelle, Σ I_Senke) / I_Summe", `a = max(${f6(sm.source)} A, ${f6(sm.sink)} A) / ${f6(lim.value_a)} A`, a, "1"));
    if (a > 1) findings.push({ level: "fail", text: `${bn}: Summenstrom ${mA(Math.max(sm.source, sm.sink))} über ${mA(lim.value_a)} (${sm.mcu}, ${lim.source_locator})` });
  }
  for (const [key, sum] of groups) {
    const [bn, gid] = key.split("|") as [string, string], g = MCU_PORT_GROUPS.find((x) => x.id === gid)!;
    const a = sum / g.i_max_a;
    steps.push(step("EL-A05", `Portgruppe ${g.ports.join(", ")} am ${bn} (${g.direction === "source" ? "Σ I_OH" : "Σ I_OL"}, ${g.source_locator})`, "a = Σ |I_Pin| der Gruppe / I_Gruppe", `a = ${f6(sum)} A / ${f6(g.i_max_a)} A`, a, "1"));
    if (a > 1) findings.push({ level: "fail", text: `${bn}: Portgruppe ${g.ports.join(", ")} mit ${mA(sum)} über ${mA(g.i_max_a)} (${g.mcu}, ${g.source_locator})` });
  }
  return { pins, boards, steps };
}
