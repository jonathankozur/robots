import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';
function violations(source: string): string[] {
    const ast = ts.createSourceFile('data.ts', source, ts.ScriptTarget.Latest, true), bad: string[] = [];
    const allowed = new Set(["@robots/protocol/weapons/v1","@robots/protocol/damage/v1","@robots/protocol/battle/v1","@robots/protocol/perception/v1","@robots/protocol/decision/v1","@robots/protocol/presentation/v2","@robots/protocol/application/v1","@robots/values/hex-grid",'@robots/system-api', '@robots/values/numeric', '@robots/values/integers', '@robots/protocol/navigation/v1', '@robots/protocol/presentation/v1', '@robots/protocol/presentation/manifest-v1']);
    function visit(n: ts.Node): void {
        if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
            const p = n.moduleSpecifier.text;
            if (!p.startsWith('./') && !allowed.has(p))
                bad.push(p);
            if (p === '@robots/application-host')
                bad.push('application implementation');
        }
        if (ts.isIdentifier(n) && ['Date', 'performance', 'fetch', 'window', 'document', 'Session', 'setTimeout', 'requestAnimationFrame', 'crypto', 'process'].includes(n.text))
            bad.push(n.text);
        if (ts.isAwaitExpression(n) || n.kind === ts.SyntaxKind.AsyncKeyword)
            bad.push('async');
        if (ts.isPropertyAccessExpression(n) && n.getText(ast) === 'Math.random')
            bad.push('random');
        ts.forEachChild(n, visit);
    }
    visit(ast);
    return bad;
}
test('presentation data owner excludes graphics, clocks, I/O and neighboring implementations', () => { for (const example of ["import * as T from 'three';", "import {createNavigationActor} from '../../navigation/index.ts';", 'performance.now();', 'async function handler(){}'])
    assert.ok(violations(example).length); const root = new URL('../../packages/presentation/src/', import.meta.url); for (const f of readdirSync(root).filter(f => f.endsWith('.ts')))
    assert.deepEqual(violations(readFileSync(new URL(f, root), 'utf8')), [], f); });
test('presentation public schemas are deeply immutable and hidden accessors never execute', async () => {
    const { INITIAL_FIELDS, PRESENTATION_MESSAGES } = await import('@robots/protocol/presentation/v1');
    const { frozen } = await import('@robots/presentation/plain');
    let executed = 0;
    const hostile = Object.defineProperty({}, 'view', { get() { executed++; return {}; }, enumerable: true });
    assert.throws(() => frozen(hostile));
    assert.equal(executed, 0);
    assert.throws(() => frozen([, 1]));
    assert.throws(() => frozen({ call: () => { } }));
    function deep(value: unknown): void { if (value && typeof value === 'object') {
        assert.ok(Object.isFrozen(value));
        for (const v of Object.values(value))
            deep(v);
    } }
    deep(INITIAL_FIELDS);
    deep(PRESENTATION_MESSAGES);
});
