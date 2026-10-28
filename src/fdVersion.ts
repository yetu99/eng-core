/**
 * Datenstand der Fachdaten in data/fd/*.json (ab 0.10.0).
 * data/fd/ ist ein versionierter Abzug aus Supabase (Tabellen fd_*, Freigabe in fd_releases), erzeugt mit
 * `node scripts/pull-data.mjs --fd`. Solange keine Fachdaten freigegeben sind, ist der Stand null.
 */
import snapshot from "../data/fd/snapshot.json";

interface FdSnapshot { release: { version: string; released_at: string | null; title: string | null } | null; files: Record<string, { rows: number; sha256: string }> }
const S = snapshot as unknown as FdSnapshot;

export const FD_VERSION: string | null = S.release?.version ?? null;
export const FD_RELEASED_AT: string | null = S.release?.released_at ?? null;
/** Dateien im Abzug (Tabellenname ohne Präfix → Zeilen, Prüfsumme). */
export const FD_FILES: Readonly<Record<string, { rows: number; sha256: string }>> = S.files;
