/**
 * Datenstand der Werkstoffdaten in data/*.json.
 * data/ ist ein versionierter Abzug aus Supabase (Tabellen wa_*, Master seit WDB 1.0), erzeugt mit
 * `npm run data:pull`. Rechnungen und Golden-Tests bleiben damit reproduzierbar; die Version steht im Rechenweg.
 */
import snapshot from "../data/snapshot.json";

export const DATA_VERSION: string = snapshot.release.version;
export const DATA_RELEASED_AT: string | null = snapshot.release.released_at ?? null;
export const DATA_TITLE: string | null = snapshot.release.title ?? null;
