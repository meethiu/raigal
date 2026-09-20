#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod/v4";
import { AislopConfigSchema } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "..", "schema", "raigal.config.schema.json");

// Strip `required`/`additionalProperties:false` so partial user configs (every
// key has a default) validate, and allow the loader-handled `extends` key.
const relax = (node) => {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const item of node) relax(item);
		return;
	}
	delete node.required;
	if (node.additionalProperties === false) delete node.additionalProperties;
	for (const value of Object.values(node)) relax(value);
};

const jsonSchema = z.toJSONSchema(AislopConfigSchema, { target: "draft-2020-12" });
relax(jsonSchema);
jsonSchema.$id = "https://raigal.dev/schema/raigal.config.schema.json";
jsonSchema.title = "raigal configuration (.raigal/config.yml)";
jsonSchema.description = "Configuration schema for the raigal code-quality CLI.";
jsonSchema.properties.extends = {
	type: "string",
	description: "Path to a parent .raigal config to extend.",
};

writeFileSync(outPath, `${JSON.stringify(jsonSchema, null, "\t")}\n`);
process.stdout.write(`Wrote ${outPath}\n`);
