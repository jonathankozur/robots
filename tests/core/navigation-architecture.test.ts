import test from "node:test";import assert from "node:assert/strict";import {readdirSync,readFileSync} from "node:fs";import ts from "typescript";
function violations(source:string,shared=false):string[]{
 const ast=ts.createSourceFile("system.ts",source,ts.ScriptTarget.Latest,true),found:string[]=[];
 const blocked=new Set(["Date","performance","fetch","process","document","window","crypto","setTimeout","setInterval","requestAnimationFrame","queueMicrotask","eval","globalThis","Function","Session"]);
 function visit(n:ts.Node):void{
  if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))if(n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)){
   const p=n.moduleSpecifier.text;if(!p.startsWith("./")&&!["../core/index.ts","../application/index.ts","../shared/hex-grid/index.ts","../../core/index.ts"].includes(p))found.push(p);
   if(shared&&p==="../application/index.ts")found.push("application");
  }
  if(ts.isIdentifier(n)&&blocked.has(n.text))found.push(n.text);
  if(ts.isPropertyAccessExpression(n)&&n.expression.getText(ast)==="Math"&&n.name.text==="random")found.push("random");
  if(ts.isAwaitExpression(n)||n.kind===ts.SyntaxKind.AsyncKeyword)found.push("async");
  if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword)found.push("dynamic");
  ts.forEachChild(n,visit);
 }visit(ast);return found;
}
test("navigation and hex utilities retain pure/public boundaries without foreign implementations or clocks",()=>{
 for(const code of ['import x from "../inventory/index.ts";','import {Session} from "../core/index.ts";','Date.now();','Math.random();','fetch("/");','async function loop(){}'])assert.ok(violations(code).length);
 for(const directory of ["../../src/navigation/","../../src/shared/hex-grid/"]){const url=new URL(directory,import.meta.url);for(const name of readdirSync(url).filter(n=>n.endsWith(".ts")))assert.deepEqual(violations(readFileSync(new URL(name,url),"utf8"),directory.includes("shared")),[],name);}
});

test("public navigation schemas and contract declarations are deeply immutable",async()=>{
 const {BOARD_FIELDS,STEP_FIELDS,navigationContracts}=await import('../../src/navigation/index.ts');
 function frozen(value:unknown):void{if(value!==null&&typeof value==='object'){assert.ok(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);}}
 frozen(BOARD_FIELDS);frozen(STEP_FIELDS);frozen(navigationContracts());
 assert.throws(()=>{(STEP_FIELDS.robotId as any).maxLength=1;},TypeError);
});