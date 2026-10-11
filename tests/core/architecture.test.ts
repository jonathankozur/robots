import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { Session } from "../../src/core/index.ts";
import { options } from "./fixtures.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const forbidden = new Set([
  "Date", "performance", "crypto", "process", "window", "document", "fetch", "WebSocket",
  "Worker", "setTimeout", "setInterval", "queueMicrotask", "requestAnimationFrame", "console", "Buffer", "require", "eval",
]);
function violations(source: string, file: string): string[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const errors: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (specifier && ts.isStringLiteral(specifier) && (!specifier.text.startsWith(".") || !specifier.text.endsWith(".ts"))) {
        errors.push("External or implicit import: " + specifier.text);
      }
      if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith(".")) {
        const target = resolve(dirname(file), specifier.text);
        const path = relative(resolve(root, "src/core"), target);
        if (path.startsWith(".." + sep) || path === "..") errors.push("Core import escapes its boundary");
      }
    }
    if (ts.isIdentifier(node) && forbidden.has(node.text)) errors.push("Nondeterministic or external capability: " + node.text);
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Math" && node.name.text === "random") {
      errors.push("Implicit randomness");
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) errors.push("Dynamic import");
    if (ts.isAwaitExpression(node) || node.kind === ts.SyntaxKind.AsyncKeyword) errors.push("Async core execution");
    if (ts.isIdentifier(node) && (node.text === "globalThis" || node.text === "Function")) errors.push("Indirect capability access");
    ts.forEachChild(node, visit);
  }
  visit(ast); return [...new Set(errors)];
}
function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(resolve(folder, entry.name)) : entry.name.endsWith(".ts") ? [resolve(folder, entry.name)] : []);
}
test("architecture control detects forbidden capabilities and dependencies", () => {
  const path = resolve(root, "src/core/example.ts");
  for (const code of [
    'import { randomUUID } from "node:crypto";', 'import { Vector3 } from "three";',
    'import "../systems/navigation.ts";', 'const now = Date.now();', 'const value = Math.random();',
    'globalThis["fetch"]("url");', 'async function handler() { await task; }', 'import("./clock.ts");',
  ]) assert.ok(violations(code, path).length > 0, code);
  assert.deepEqual(violations('import type { Message } from "./messaging/contracts.ts"; const x = 1 + 2;', path), []);
});
test("core has only local imports and no visual, clock, I/O or randomness dependencies", () => {
  const core = files(resolve(root, "src/core"));
  assert.ok(core.length > 0);
  for (const path of core) assert.deepEqual(violations(readFileSync(path, "utf8"), path), [], relative(root, path));
});
test("system-facing port has only immutable send/emit capabilities", () => {
  const session = new Session(options());
  const port = session.publisher("producer");
  assert.deepEqual(Object.keys(port).sort(), ["emit", "send"]);
  assert.ok(Object.isFrozen(port));
  assert.throws(() => { (port as unknown as { advanceTick: () => void }).advanceTick = () => {}; }, TypeError);
});
test("contracts do not import infrastructure; infrastructure is absent from a publisher's public type", () => {
  const source = readFileSync(resolve(root, "src/core/messaging/contracts.ts"), "utf8");
  const ast = ts.createSourceFile("contracts.ts", source, ts.ScriptTarget.Latest, true);
  assert.ok(!ast.statements.some(node => ts.isImportDeclaration(node)));
  const publisher = ast.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === "Publisher");
  assert.ok(publisher && ts.isInterfaceDeclaration(publisher));
  assert.deepEqual(publisher.members.map(member => member.name?.getText(ast)).sort(), ["emit", "send"]);
});
