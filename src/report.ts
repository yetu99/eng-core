/**
 * Prüfstatus und Berichtsangaben für Ausdrucke (PDF-Fußzeile, Prüfvermerk) und für jede andere App, die
 * Ergebnisse aus eng-core dokumentiert.
 *
 * Quelle ist src/pruefstatus.json. Die Datei wird von `npx tsx scripts/formelkatalog.ts` aus dem Formelkatalog,
 * formelstatus.json (Freigabe-Excel), verification/ergebnis.json (Python-Gegenrechnung) und
 * verification/abnahme.json (Stufen P5/P6) erzeugt und in CI auf Aktualität geprüft. Keine Rechenwerte.
 */
import ps from "./pruefstatus.json";
import { CORE_VERSION } from "./version";
import { DATA_VERSION, DATA_RELEASED_AT } from "./dataVersion";
import type { CalcStep } from "./trace";

/** Prüfstand einer Formel: freigegeben, abgelehnt, seit der Freigabe geändert, Entwurf (implementiert und gegengerechnet). */
export type FormulaState = "freigegeben" | "abgelehnt" | "geaendert" | "entwurf" | "unbekannt";

export interface StageStatus { status: "offen" | "bestanden" | "nicht bestanden"; text: string; datum?: string }

export interface PruefStatus {
  core: string;
  formulas: number;
  approved: number;
  rejected: number;
  stale: number;
  draft: number;
  lastApproval: string | null;
  verification: { passed: number; total: number };
  acceptance: { P5: StageStatus; P6: StageStatus };
  status: Record<string, Exclude<FormulaState, "unbekannt">>;
}

export const PRUEFSTATUS = ps as unknown as PruefStatus;

/** Katalog-ID eines Rechenschritts. Bemessungsschritte tragen das Maß im Namen (D-ERF-D → D-ERF). */
export function catalogId(stepId: string): string {
  return stepId.replace(/^D-(ERF|GEW)-.*/, "D-$1");
}

export function formulaState(stepId: string): FormulaState {
  return PRUEFSTATUS.status[catalogId(stepId)] ?? "unbekannt";
}

export interface TraceApproval {
  /** verschiedene Formeln im Rechenweg */
  used: number;
  approved: number;
  /** Katalog-IDs ohne gültige Freigabe, sortiert */
  open: string[];
}

/** Freigabestand der in einem Rechenweg verwendeten Formeln (jede Formel zählt einmal). */
export function traceApproval(steps: readonly CalcStep[]): TraceApproval {
  const ids = [...new Set(steps.map((s) => catalogId(s.id)))].sort((a, b) => a.localeCompare(b, "de"));
  const open = ids.filter((id) => formulaState(id) !== "freigegeben");
  return { used: ids.length, approved: ids.length - open.length, open };
}

export interface ReportMeta {
  tool: string;
  core: string;
  data: string;
  dataReleasedAt: string | null;
  formulas: number;
  approved: number;
  lastApproval: string | null;
  verification: { passed: number; total: number };
  acceptance: { P5: StageStatus; P6: StageStatus };
  /** true, wenn Kern und Prüfstatus zur selben Version gehören */
  consistent: boolean;
}

export function reportMeta(tool = "Ingenieur-Werkbank"): ReportMeta {
  return {
    tool, core: CORE_VERSION, data: DATA_VERSION, dataReleasedAt: DATA_RELEASED_AT,
    formulas: PRUEFSTATUS.formulas, approved: PRUEFSTATUS.approved, lastApproval: PRUEFSTATUS.lastApproval,
    verification: PRUEFSTATUS.verification, acceptance: PRUEFSTATUS.acceptance,
    consistent: PRUEFSTATUS.core === CORE_VERSION,
  };
}

const dateDe = (iso: string | null): string => {
  if (!iso) return "–";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

/** Eine Zeile für die Fußzeile des Ausdrucks (CSS @page), ohne Seitenzahl. */
export function reportFooter(meta: ReportMeta, usage?: TraceApproval): string {
  const parts = [
    meta.tool,
    `eng-core ${meta.core}`,
    `Werkstoffdaten ${meta.data}`,
    usage ? `Formeln im Blatt ${usage.approved}/${usage.used} freigegeben` : `Formeln ${meta.approved}/${meta.formulas} freigegeben`,
    `Gegenrechnung ${meta.verification.passed}/${meta.verification.total}`,
    `Abnahme P6 ${meta.acceptance.P6.status}`,
  ];
  return parts.join(" · ");
}

export interface ReportVerdict { level: "ok" | "warn" | "fail"; title: string; lines: string[] }

/**
 * Prüfvermerk für das Ende eines Berichts. Ehrlich nach Prüfstufen: Freigabe der Formeln (P1),
 * Gegenrechnung (P2), Tests (P3/P4 laufen in CI), Abgleich mit Vorlagen und FEM (P5), Abnahme (P6).
 */
export function reportVerdict(meta: ReportMeta, usage: TraceApproval): ReportVerdict {
  const lines: string[] = [];
  const allApproved = usage.open.length === 0;
  const verOk = meta.verification.passed === meta.verification.total;
  lines.push(allApproved
    ? `Formelfreigabe (P1): alle ${usage.used} verwendeten Formeln freigegeben, Katalog ${meta.approved}/${meta.formulas}, letzte Freigabe ${dateDe(meta.lastApproval)}.`
    : `Formelfreigabe (P1): ${usage.open.length} von ${usage.used} verwendeten Formeln ohne gültige Freigabe (${usage.open.join(", ")}).`);
  lines.push(`Unabhängige Gegenrechnung (P2): ${meta.verification.passed} von ${meta.verification.total} Prüfwerten innerhalb der Toleranz.`);
  lines.push(`Abgleich mit Vorlagen und FEM (P5): ${meta.acceptance.P5.status}${meta.acceptance.P5.datum ? `, ${dateDe(meta.acceptance.P5.datum)}` : ""}.`);
  lines.push(`Abnahme (P6): ${meta.acceptance.P6.status}${meta.acceptance.P6.datum ? `, ${dateDe(meta.acceptance.P6.datum)}` : ""}.`);
  lines.push(`Rechenkern eng-core ${meta.core}, Werkstoffdaten ${meta.data} (${dateDe(meta.dataReleasedAt)}).`);
  if (!meta.consistent) lines.push(`Achtung: Prüfstatus gehört zu eng-core ${PRUEFSTATUS.core}, nicht zu ${meta.core}.`);
  const accepted = meta.acceptance.P6.status === "bestanden";
  if (!allApproved || !verOk || !meta.consistent) return { level: "fail", title: "Rechenweg nicht vollständig geprüft", lines };
  if (!accepted) return { level: "warn", title: "Formeln freigegeben und gegengerechnet, Abnahme offen (nicht für verbindliche Auslegungen)", lines };
  return { level: "ok", title: "Geprüft und abgenommen", lines };
}
