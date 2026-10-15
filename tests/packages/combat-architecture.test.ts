import test from "node:test";import assert from "node:assert/strict";import {readdirSync,readFileSync} from "node:fs";import {fileURLToPath} from "node:url";import ts from "typescript";import {inspectPackageGraph} from "../../scripts/package-boundaries.ts";
const owners=["damage","weapons","perception","decision","battle"];
function violations(source:string):string[]{
 const bad:string[]=[],ast=ts.createSourceFile("actor.ts",source,ts.ScriptTarget.Latest,true);
 function visit(n:ts.Node):void{
  if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)){
   const s=n.moduleSpecifier.text;
   if(!s.startsWith("./")&&!/^@robots\/(system-api|protocol\/(application|navigation|damage|weapons|perception|decision|battle|presentation)\/v[12]|values\/(numeric|integers|hex-grid))$/.test(s))bad.push(s);
  }
  if(ts.isIdentifier(n)&&["Date","performance","fetch","window","document","Session","setTimeout","setInterval","requestAnimationFrame","crypto","process"].includes(n.text))bad.push(n.text);
  if(ts.isAwaitExpression(n)||n.kind===ts.SyntaxKind.AsyncKeyword||ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword)bad.push("async");
  if(ts.isPropertyAccessExpression(n)&&n.getText(ast)==="Math.random")bad.push("random");ts.forEachChild(n,visit);
 }visit(ast);return bad;
}
test("combat owners exclude runtime, neighboring actors, I/O, clocks and asynchronous work",()=>{
 for(const s of ['import {createDamageActor} from "@robots/damage";','import {Session} from "@robots/runtime";','import x from "../../weapons/src/index.ts";',"setTimeout(()=>{},50);","Math.random();","async function tick(){}","import(name)"])assert.ok(violations(s).length,s);
 for(const name of owners){const root=new URL("../../packages/"+name+"/src/",import.meta.url);for(const f of readdirSync(root).filter(f=>f.endsWith(".ts")))assert.deepEqual(violations(readFileSync(new URL(f,root),"utf8")),[],name+"/"+f);}
});
test("declaring a neighbor as dependency never grants cross-owner access",()=>{
 const root=fileURLToPath(new URL("../../",import.meta.url));
 for(const name of owners){const graph=inspectPackageGraph(root,{sources:{["packages/"+name+"/src/actor.ts"]:'import {createNavigationActor} from "@robots/navigation";'},dependencies:{["@robots/"+name]:{"@robots/navigation":"0.1.0"}}});assert.ok(graph.issues.some(s=>s.includes("Forbidden package dependency")));}
});
