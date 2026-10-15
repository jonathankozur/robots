import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
interface Manifest {name:string;dependencies?:Record<string,string>;devDependencies?:Record<string,string>;exports:Record<string,string>}
const root=fileURLToPath(new URL("../../",import.meta.url));
const manifests=new Map(readdirSync(join(root,"packages")).map(folder=>{
  const m=JSON.parse(readFileSync(join(root,"packages",folder,"package.json"),"utf8")) as Manifest;
  return [m.name,{folder,m}] as const;
}));
const compiler=join(root,"node_modules","typescript","bin","tsc");
const childEnv={...process.env,NODE_PATH:"",NODE_OPTIONS:""};
function run(cwd:string,args:string[]) {
  const r=spawnSync(process.execPath,args,{cwd,env:childEnv,encoding:"utf8",maxBuffer:4*1024*1024});
  assert.equal(r.status,0,[r.error?.message,r.stdout,r.stderr].filter(Boolean).join("\n"));
}
function isolated(name:string) {
  const tempRoot=realpathSync(tmpdir()),sandbox=mkdtempSync(join(tempRoot,"robots-independence-"));
  const included=new Set<string>(),external=new Set<string>();
  function copyExternal(dependency:string) {
    if(dependency==="typescript"||external.has(dependency))return;
    const origin=join(root,"node_modules",dependency),target=join(sandbox,"node_modules",dependency);
    assert.ok(existsSync(join(origin,"package.json")),"Installed tool/library dependency: "+dependency);
    external.add(dependency);cpSync(origin,target,{recursive:true});
    const m=JSON.parse(readFileSync(join(origin,"package.json"),"utf8")) as Manifest;
    for(const child of Object.keys(m.dependencies??{}))copyExternal(child);
  }
  function copyWorkspace(dependency:string) {
    if(included.has(dependency))return;
    const info=manifests.get(dependency);assert.ok(info,"Known declared dependency: "+dependency);
    included.add(dependency);
    const target=join(sandbox,"packages",info.folder),origin=join(root,"packages",info.folder);
    mkdirSync(target,{recursive:true});
    for(const entry of ["package.json","tsconfig.json","src","test"])if(existsSync(join(origin,entry)))cpSync(join(origin,entry),join(target,entry),{recursive:true});
    const link=join(sandbox,"node_modules",dependency);mkdirSync(resolve(link,".."),{recursive:true});
    symlinkSync(target,link,process.platform==="win32"?"junction":"dir");
    for(const child of Object.keys(info.m.dependencies??{})){
      if(child.startsWith("@robots/"))copyWorkspace(child);else copyExternal(child);
    }
    for(const child of Object.keys(info.m.devDependencies??{}))copyExternal(child);
  }
  try {
    copyWorkspace(name);
    for(const neighbor of ["@robots/navigation","@robots/presentation","@robots/damage","@robots/weapons","@robots/perception","@robots/decision","@robots/battle","@robots/presentation-three","@robots/application-host","@robots/runtime"]){
      if(neighbor!==name&&!included.has(neighbor))assert.equal(existsSync(join(sandbox,"node_modules",neighbor)),false);
    }
    const info=manifests.get(name)!;
    const project=join(sandbox,"packages",info.folder);
    run(sandbox,[compiler,"--noEmit","-p",join(project,"tsconfig.json")]);
    const specifiers=Object.keys(info.m.exports).map(key=>key==="."?name:name+key.slice(1));
    run(project,["--input-type=module","-e","for(const name of "+JSON.stringify(specifiers)+")await import(name);"]);
    if(["@robots/navigation","@robots/presentation","@robots/damage","@robots/weapons","@robots/perception","@robots/decision","@robots/battle"].includes(name)){
      const absent=["@robots/navigation","@robots/presentation","@robots/damage","@robots/weapons","@robots/perception","@robots/decision","@robots/battle"].filter(n=>n!==name);
      run(project,["--input-type=module","-e","for(const n of "+JSON.stringify(absent)+"){try{await import(n);process.exit(1)}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e}}"]);
    }
    const tests=existsSync(join(project,"test"))?readdirSync(join(project,"test")).filter(n=>n.endsWith(".test.ts")):[];
    if(tests.length)run(project,["--test",...tests.map(t=>join(project,"test",t))]);
    return [...included].sort();
  } finally {
    // Delete only the uniquely created direct child of the system temp directory.
    const resolved=realpathSync(sandbox),rel=relative(tempRoot,resolved);
    assert.equal(rel,basename(resolved));assert.ok(basename(resolved).startsWith("robots-independence-"));
    assert.ok(!rel.startsWith(".."+sep));rmSync(resolved,{recursive:true,force:true});
  }
}
for(const name of manifests.keys())test("package typechecks and loads with only its declared dependencies in an isolated directory: "+name,()=>{
  const included=isolated(name);
  if(["@robots/navigation","@robots/presentation","@robots/damage","@robots/weapons","@robots/perception","@robots/decision","@robots/battle"].includes(name))assert.deepEqual(included,["@robots/protocol",name,"@robots/system-api","@robots/values"].sort());
  if(name==="@robots/protocol")assert.deepEqual(included,["@robots/protocol","@robots/system-api","@robots/values"]);
});
