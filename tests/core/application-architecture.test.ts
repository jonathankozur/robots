import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync,readdirSync } from "node:fs";
import { ApplicationController } from "@robots/application-host";
import { fixtureRecipe } from "./application-fixture.ts";
import ts from "typescript";
const request=()=>({requestId:"one",seed:"0123456789abcdef",content:JSON.parse(readFileSync(new URL("../../content/fixtures/basic-v2.json",import.meta.url),"utf8")),selection:{robotId:"robot.scout",terrainId:"terrain.floor"}});
test("recipe selects actual equipment and rejects unarmed demo without invalidating catalog",()=>{
  const a=new ApplicationController({instanceId:"selection",runtime:"test",recipe:fixtureRecipe()});
  const unarmed=request();unarmed.selection.robotId="robot.unarmed";assert.equal(a.request(unarmed).ok,false);
  assert.equal(a.request({...request(),requestId:"armed"}).ok,true);
  a.advance();a.advance();
  const manifest=a.trace()!.manifest!.initialState as Record<string,any>;
  assert.equal(manifest.views["app-navigation-fixture"].locomotionId,"locomotion.wheels");
  assert.equal(manifest.views["app-combat-fixture"].weaponId,"weapon.pulse");
  assert.equal("weaponId" in manifest.views["app-navigation-fixture"],false);
});
function violations(source:string):string[] {
  const ast=ts.createSourceFile("application.ts",source,ts.ScriptTarget.Latest,true),errors:string[]=[];
  const allowed=new Set(["@robots/system-api","@robots/runtime","@robots/content","@robots/values/json","@robots/protocol/application/v1","@robots/protocol/content/v2","@robots/protocol/navigation/v1","@robots/protocol/presentation/v1"]);
  const blocked=new Set(["Date","performance","fetch","process","document","window","setTimeout","setInterval","requestAnimationFrame","eval","globalThis","Function"]);
  const visit=(node:ts.Node)=>{
    if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))if(node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
      const s=node.moduleSpecifier.text;
      if(!s.startsWith("./")&&!allowed.has(s))errors.push(s);
    }
    if(ts.isIdentifier(node)&&blocked.has(node.text))errors.push(node.text);
    if(ts.isPropertyAccessExpression(node)&&node.expression.getText(ast)==="Math"&&node.name.text==="random")errors.push("random");
    if(ts.isAwaitExpression(node)||node.kind===ts.SyntaxKind.AsyncKeyword)errors.push("async");
    ts.forEachChild(node,visit);
  };visit(ast);return errors;
}
test("application guard catches clock/I-O, neighboring systems and private core imports",()=>{
  for(const source of ['import x from "../core/scheduler/session.ts";','import x from "../damage/index.ts";','Date.now();','fetch("/");','Math.random();','async function tick() {}'])assert.ok(violations(source).length,source);
  for(const name of readdirSync(new URL("../../packages/application-host/src/",import.meta.url)).filter(n=>n.endsWith(".ts")))assert.deepEqual(violations(readFileSync(new URL("../../packages/application-host/src/"+name,import.meta.url),"utf8")),[],name);
});
test("invalid budgets, unsafe source data and unknown options never start a context",()=>{
  const a=new ApplicationController({instanceId:"invalid",runtime:"test",recipe:fixtureRecipe()});
  for(const extra of [{initializationMaxTicks:0},{initializationMaxTicks:10001},{debug:"yes"},{seed:"wrong"},{unknown:1}])assert.equal(a.request({...request(),requestId:JSON.stringify(extra),...extra}).ok,false);
  assert.equal(a.snapshot().state,"idle");
});

test("the observation bridge cannot expose mutable Map or Set state through its boundary types",()=>{
  function mutableCollections(source:string):string[] {
    const ast=ts.createSourceFile("boundary.ts",source,ts.ScriptTarget.Latest,true),found:string[]=[];
    function scan(node:ts.Node):void {if(ts.isTypeReferenceNode(node)&&["Map","Set"].includes(node.typeName.getText(ast)))found.push(node.typeName.getText(ast));ts.forEachChild(node,scan);}
    for(const statement of ast.statements)if(ts.isInterfaceDeclaration(statement)||ts.isTypeAliasDeclaration(statement))scan(statement);
    return found;
  }
  assert.deepEqual(mutableCollections("interface Boundary { pending: Set<string> }"),["Set"]);
  assert.deepEqual(mutableCollections(readFileSync(new URL(import.meta.resolve("@robots/application-host/assembly")),"utf8")),[]);
});
