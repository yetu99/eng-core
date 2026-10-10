/** Werkstoffdaten: versionierter Abzug aus Supabase (data/*.json, siehe scripts/pull-data.mjs), gleiche Daten wie der Werkstoffatlas. */
import materials from "../data/materials.json";
import variants from "../data/variants.json";
import propertyValues from "../data/propertyValues.json";
import sources from "../data/sources.json";
import { createRepo, type MaterialData, type Repo } from "./materials";

export { DATA_VERSION, DATA_RELEASED_AT, DATA_TITLE } from "./dataVersion";
export const repo: Repo = createRepo({ materials, variants, propertyValues, sources } as unknown as MaterialData);
