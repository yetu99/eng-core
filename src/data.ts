/** Werkstoffdaten: versionierter Abzug aus Supabase (data/*.json, siehe scripts/pull-data.mjs), gleiche Daten wie der Werkstoffatlas. */
import materials from "../data/materials.json";
import variants from "../data/variants.json";
import propertyValues from "../data/propertyValues.json";
import sources from "../data/sources.json";
import properties from "../data/properties.json";
import processes from "../data/processes.json";
import processability from "../data/processability.json";
import { createRepo, type MaterialData, type Repo } from "./materials";
import type { DetailData } from "./materialDetail";

export { DATA_VERSION, DATA_RELEASED_AT, DATA_TITLE } from "./dataVersion";
export const repo: Repo = createRepo({ materials, variants, propertyValues, sources } as unknown as MaterialData);
/** Vollständiger Abzug für die Detailansicht (materialDetail): Eigenschaften, Kennwerte mit Quelle, Verarbeitbarkeit. */
export const detailData: DetailData = { materials, variants, propertyValues, sources, properties, processes, processability } as unknown as DetailData;
