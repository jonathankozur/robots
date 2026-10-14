import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { COMPONENT_CATEGORIES, CONTENT_LIMITS } from "@robots/protocol/content/v2";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const contentRoot = resolve(root, "packages/content/src");
const allowedHelpers = new Set(["@robots/system-api", "@robots/values/json", "@robots/values/numeric", "@robots/protocol/content/v2"]);
const forbidden = new Set(["Date", "performance", "crypto", "process", "window", "document", "fetch", "WebSocket", "Worker", "setTimeout", "setInterval", "requestAnimationFrame", "queueMicrotask", "console", "Buffer", "require", "eval", "globalThis", "Function"]);
function violations(source: string, file: string): string[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const errors: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        const target = resolve(dirname(file), specifier);
        const local = relative(contentRoot, target).replaceAll("\\", "/");
        const project = relative(root, target).replaceAll("\\", "/");
        if (specifier.startsWith(".") ? (!specifier.endsWith(".ts") || local === ".." || local.startsWith("../")) : !allowedHelpers.has(specifier)) errors.push("Forbidden dependency: " + specifier);
      }
    }
    if (ts.isIdentifier(node) && forbidden.has(node.text)) errors.push("External capability: " + node.text);
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Math" && node.name.text === "random") errors.push("Implicit randomness");
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) errors.push("Dynamic import");
    if (ts.isAwaitExpression(node) || node.kind === ts.SyntaxKind.AsyncKeyword) errors.push("Async content execution");
    ts.forEachChild(node, visit);
  }
  visit(ast); return errors;
}
test("content architecture guard rejects external effects, core capabilities and neighboring systems", () => {
  const file = resolve(contentRoot, "example.ts");
  for (const code of ['import { readFileSync } from "node:fs";', 'import { Session } from "../core/index.ts";', 'import { state } from "../game/robot.ts";', 'Math.random();', 'Date.now();', 'fetch("/content");', 'import("./plugin.ts");', 'async function run() { await work; }', 'globalThis["fetch"]("/")']) assert.ok(violations(code, file).length, code);
  assert.deepEqual(violations('import { checkedAdd } from "@robots/values/numeric"; const total = checkedAdd(1, 2);', file), []);
});
test("content modules depend only on data, their own implementation and approved pure helpers", () => {
  const entries = readdirSync(contentRoot).filter(name => name.endsWith(".ts")); assert.ok(entries.length > 0);
  for (const name of entries) { const file = resolve(contentRoot, name); assert.deepEqual(violations(readFileSync(file, "utf8"), file), [], name); }
  const contracts = ts.createSourceFile("contracts.ts", readFileSync(resolve(root, "packages/protocol/src/content/v2.ts"), "utf8"), ts.ScriptTarget.Latest, true);
  assert.ok(!contracts.statements.some(ts.isImportDeclaration));
});
test("shared content category and capacity constants are immutable at runtime, not only readonly types", () => {
  assert.ok(Object.isFrozen(CONTENT_LIMITS)); assert.ok(Object.isFrozen(COMPONENT_CATEGORIES));
  assert.throws(() => { (COMPONENT_CATEGORIES as unknown as string[]).push("unknown"); }, TypeError);
});
