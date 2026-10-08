/** Werkstoffdaten der Werkstoffdatenbank v0.3 (JSON-Export, identisch mit dem Werkstoffatlas). */
import materials from "../data/materials.json";
import variants from "../data/variants.json";
import propertyValues from "../data/propertyValues.json";
import sources from "../data/sources.json";
import { createRepo, type MaterialData, type Repo } from "./materials";

export const DATA_VERSION = "WDB v0.3";
export const repo: Repo = createRepo({ materials, variants, propertyValues, sources } as unknown as MaterialData);
