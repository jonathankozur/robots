import { mkdirSync, writeFileSync } from "node:fs";
import { runEnvironmentReference, DEFAULT_SEED } from "./environment-fixture.ts";
const directory = new URL("../../debug-logs/", import.meta.url);
mkdirSync(directory, { recursive: true });
const path = new URL("node-environment-reference.json", directory);
writeFileSync(path, JSON.stringify(runEnvironmentReference(process.argv[2] ?? DEFAULT_SEED, "Node " + process.versions.node), null, 2) + "\n");
console.log(path.pathname);
