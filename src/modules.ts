/**
 * Modulregister (ab 0.10.0): ein Kern, mehrere Werkzeuge. Jede Formel-ID gehört über ihr Präfix (Teil vor dem
 * ersten Bindestrich) zu genau einem Modul, jedes Modul zu einem Werkzeug (Werkbank oder Fachtools).
 * Quelle ist src/modules.json; die Skripte (Sync, Katalog, Freigabe, Gegenrechnung) lesen dieselbe Datei.
 * Keine Rechenwerte.
 */
import reg from "./modules.json";

export type ModuleId = "gemeinsam" | "festigkeit" | "ashby" | "fluid" | "verbindungen" | "dichtungen" | "stabwerke";
export type ToolId = "werkbank" | "fachtools";

export interface ModuleInfo {
  title: string;
  tool: ToolId;
  /** Formel-ID-Präfixe (Teil vor dem ersten Bindestrich). */
  prefixes: string[];
  /** Dateien oder Ordner unter src/, die das Modul bilden (für sync-to-app --modules). */
  paths: string[];
  /** Einheiten intern. */
  units: string;
  /** true, wenn das Modul Fachdaten aus fd_* (data/fd/) nutzt. */
  fd: boolean;
}
export interface ToolInfo { title: string; modules: ModuleId[] }

interface Registry { base: string[]; modules: Record<ModuleId, ModuleInfo>; reserved: string[]; tools: Record<ToolId, ToolInfo> }
const R = reg as unknown as Registry;

export const MODULES: Readonly<Record<ModuleId, ModuleInfo>> = R.modules;
export const TOOLS: Readonly<Record<ToolId, ToolInfo>> = R.tools;
export const MODULE_IDS = Object.keys(R.modules) as ModuleId[];
/** Reservierte Präfixe ohne Formeln (z. B. WL Wälzlager als Linkkarte). */
export const RESERVED_PREFIXES: readonly string[] = R.reserved;

const BY_PREFIX = new Map<string, ModuleId>(MODULE_IDS.flatMap((m) => R.modules[m].prefixes.map((p) => [p, m] as const)));

/** Präfix einer Formel-ID: "RH-LAM" → "RH", "Q-RH-I" → "Q". */
export function idPrefix(id: string): string {
  return id.split("-")[0] ?? "";
}

/** Modul einer Formel-ID oder null, wenn das Präfix nicht registriert ist. */
export function moduleOfId(id: string): ModuleId | null {
  return BY_PREFIX.get(idPrefix(id)) ?? null;
}

/** Werkzeug zu einem Anzeigenamen ("Ingenieur-Werkbank" → "werkbank"), sonst null. */
export function toolOfTitle(title: string): ToolId | null {
  return (Object.keys(R.tools) as ToolId[]).find((t) => R.tools[t].title === title) ?? null;
}

/** true, wenn eines der Module Fachdaten (fd_*) nutzt. */
export function usesFd(modules: readonly ModuleId[]): boolean {
  return modules.some((m) => R.modules[m]?.fd === true);
}
