import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const compiler=fileURLToPath(new URL("../node_modules/typescript/bin/tsc",import.meta.url));
for(const entry of readdirSync(new URL("../packages/",import.meta.url),{withFileTypes:true}).filter(e=>e.isDirectory())){
  console.log("Typecheck without emission: "+entry.name);
  const result=spawnSync(process.execPath,[compiler,"--noEmit","-p","packages/"+entry.name+"/tsconfig.json"],{cwd:root,stdio:"inherit"});
  if(result.status!==0)throw result.error??new Error("Package typecheck failed: "+entry.name);
}
