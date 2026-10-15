import { readdirSync, readFileSync, existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
export interface GraphOverrides {
  readonly sources?: Readonly<Record<string,string>>;
  readonly dependencies?: Readonly<Record<string,Readonly<Record<string,string>>>>;
}
interface Manifest { name:string; dependencies?:Record<string,string>; exports:Record<string,string> }
const permitted:Record<string,readonly string[]>={
  "@robots/damage":["@robots/system-api","@robots/protocol","@robots/values"],
  "@robots/weapons":["@robots/system-api","@robots/protocol","@robots/values"],
  "@robots/perception":["@robots/system-api","@robots/protocol","@robots/values"],
  "@robots/decision":["@robots/system-api","@robots/protocol","@robots/values"],
  "@robots/battle":["@robots/system-api","@robots/protocol","@robots/values"],
  "@robots/system-api":[],
  "@robots/values":["@robots/system-api"],
  "@robots/protocol":["@robots/system-api","@robots/values"],
  "@robots/runtime":["@robots/system-api","@robots/values"],
  "@robots/navigation":["@robots/system-api","@robots/protocol","@robots/values"],
  "@robots/presentation":["@robots/system-api","@robots/protocol","@robots/values"],
  "@robots/presentation-three":["@robots/protocol","three"],
  "@robots/content":["@robots/system-api","@robots/protocol","@robots/values"],
  "@robots/application-host":["@robots/system-api","@robots/protocol","@robots/values","@robots/runtime","@robots/content"]
};
const inside=(base:string,target:string)=>{const p=relative(base,target);return !isAbsolute(p)&&p!==".."&&!p.startsWith(".."+sep);};
const packageName=(specifier:string)=>specifier.startsWith("@")?specifier.split("/").slice(0,2).join("/"):specifier.split("/")[0]!;
export function inspectPackageGraph(root:string,overrides:GraphOverrides={}) {
  const issues:string[]=[];
  const manifests=new Map<string,{directory:string;data:Manifest}>();
  const directories=readdirSync(join(root,"packages"),{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>join(root,"packages",d.name));
  for(const directory of directories){
    const data=JSON.parse(readFileSync(join(directory,"package.json"),"utf8")) as Manifest;
    if(manifests.has(data.name))issues.push("Duplicate package name: "+data.name);
    if(overrides.dependencies?.[data.name])data.dependencies={...overrides.dependencies[data.name]};
    manifests.set(data.name,{directory:realpathSync(directory),data});
  }
  const checkTarget=(base:string,target:string,label:string)=>{
    if(!inside(base,target))issues.push(label+" escapes its package");
    else if(!existsSync(target))issues.push(label+" does not resolve: "+target);
    else if(!inside(base,realpathSync(target)))issues.push(label+" follows a symlink outside its package");
  };
  for(const [name,{directory,data}] of manifests){
    const allowed=new Set(permitted[name]??[]);
    if(!permitted[name])issues.push("Package has no boundary policy: "+name);
    for(const dependency of Object.keys(data.dependencies??{})){
      if(!allowed.has(dependency))issues.push("Forbidden package dependency: "+name+" -> "+dependency);
      if(dependency.startsWith("@robots/")&&!manifests.has(dependency))issues.push("Missing workspace dependency: "+dependency);
    }
    for(const [subpath,target] of Object.entries(data.exports)){
      if(!target.startsWith("./"))issues.push("Invalid public export: "+name+subpath);
      else checkTarget(directory,resolve(directory,target),"Export "+name+subpath);
    }
    const files=(folder:string):string[]=>readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{
      const p=join(folder,entry.name);
      if(entry.isSymbolicLink()){issues.push(name+" contains a source symlink: "+p);return [];}
      return entry.isDirectory()?files(p):entry.name.endsWith(".ts")?[p]:[];
    });
    for(const file of files(join(directory,"src"))){
      const key=relative(root,file).split(sep).join("/");
      const source=overrides.sources?.[key]??readFileSync(file,"utf8");
      const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
      const references:string[]=[];
      const visit=(node:ts.Node):void=>{
        if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))references.push(node.moduleSpecifier.text);
        if(ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument)&&ts.isStringLiteral(node.argument.literal))references.push(node.argument.literal.text);
        if(ts.isImportEqualsDeclaration(node))issues.push(name+" uses an unsupported import alias: "+key);
        if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==="require")){
          const arg=node.arguments[0];
          if(arg&&ts.isStringLiteral(arg))references.push(arg.text);
          else issues.push(name+" has an unresolved dynamic import: "+key);
        }
        ts.forEachChild(node,visit);
      };
      visit(ast);
      for(const specifier of references){
        if(specifier.startsWith(".")){
          if(!specifier.endsWith(".ts"))issues.push(name+" has an implicit/non-TypeScript local import: "+specifier);
          checkTarget(directory,resolve(dirname(file),specifier),name+" local import "+specifier);
        }else{
          const dependency=packageName(specifier);
          if(!allowed.has(dependency))issues.push("Forbidden package dependency: "+name+" -> "+dependency+" in "+key);
          if(!Object.hasOwn(data.dependencies??{},dependency))issues.push(name+" uses an undeclared dependency: "+dependency);
          const target=manifests.get(dependency);
          if(target){
            const subpath=specifier===dependency?".":"."+specifier.slice(dependency.length);
            const exported=target.data.exports[subpath];
            if(!exported)issues.push(name+" imports an unexported subpath: "+specifier);
            else checkTarget(target.directory,resolve(target.directory,exported),"Import "+specifier);
          }
        }
      }
    }
  }
  const visiting=new Set<string>(),complete=new Set<string>();
  const walk=(name:string,path:string[]):void=>{
    if(visiting.has(name)){issues.push("Dependency cycle: "+[...path,name].join(" -> "));return;}
    if(complete.has(name))return;
    visiting.add(name);
    for(const dependency of Object.keys(manifests.get(name)!.data.dependencies??{}))if(manifests.has(dependency))walk(dependency,[...path,name]);
    visiting.delete(name);complete.add(name);
  };
  for(const name of manifests.keys())walk(name,[]);
  return {packages:[...manifests.keys()].sort(),issues:[...new Set(issues)].sort()};
}
