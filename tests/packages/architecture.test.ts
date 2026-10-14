import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inspectPackageGraph } from "../../scripts/package-boundaries.ts";
const root=fileURLToPath(new URL("../../",import.meta.url));
test("every canonical package obeys its declared public dependency boundaries",()=>{
  const graph=inspectPackageGraph(root);
  assert.equal(graph.packages.length,9);assert.deepEqual(graph.issues,[]);
});
test("the graph rejects direct peer implementations even if someone declares that dependency",()=>{
  const graph=inspectPackageGraph(root,{
    sources:{"packages/presentation/src/actor.ts":'import {createNavigationActor} from "@robots/navigation";'},
    dependencies:{"@robots/presentation":{"@robots/navigation":"0.1.0"}}
  });
  assert.ok(graph.issues.some(s=>s.includes("Forbidden package dependency")));
});
test("shared protocols cannot reexport type-only system implementations",()=>{
  const graph=inspectPackageGraph(root,{sources:{"packages/protocol/src/navigation/v1.ts":'export type {Actor} from "@robots/navigation";'}});
  assert.ok(graph.issues.some(s=>s.includes("@robots/navigation")));
});
test("a neutral dependency cannot hide a transitive system import",()=>{
  const graph=inspectPackageGraph(root,{sources:{"packages/values/src/numeric.ts":'import {createNavigationActor} from "@robots/navigation";'}});
  assert.ok(graph.issues.some(s=>s.includes("@robots/values")&&s.includes("@robots/navigation")));
});
test("relative escapes, unexported subpaths and unresolved dynamic imports are violations",()=>{
  for(const source of [
    'export * from "../../presentation/src/actor.ts";',
    'import type {World} from "@robots/protocol/private/navigation";',
    'const moduleName="neighbor"; import(moduleName);'
  ])assert.ok(inspectPackageGraph(root,{sources:{"packages/navigation/src/actor.ts":source}}).issues.length,source);
});
test("workspace package dependency cycles are rejected",()=>{
  const graph=inspectPackageGraph(root,{dependencies:{"@robots/values":{"@robots/protocol":"0.1.0"}}});
  assert.ok(graph.issues.some(s=>s.includes("Dependency cycle")));
});
test("protocol definitions contain no fixture permissions or implementations",async()=>{
  const {NAVIGATION_MESSAGES}=await import("@robots/protocol/navigation/v1");
  const {PRESENTATION_MESSAGES}=await import("@robots/protocol/presentation/v1");
  for(const definition of [...NAVIGATION_MESSAGES,...PRESENTATION_MESSAGES]){
    assert.deepEqual(Object.keys(definition).sort(),["fields","kind","type","version"]);
    assert.ok(!JSON.stringify(definition).includes("navigation-agent-fixture"));
  }
  for(const p of ["navigation","presentation"]){
    const manifest=JSON.parse(readFileSync(join(root,"packages",p,"package.json"),"utf8"));
    assert.deepEqual(Object.keys(manifest.dependencies).sort(),["@robots/protocol","@robots/system-api","@robots/values"]);
  }
});
