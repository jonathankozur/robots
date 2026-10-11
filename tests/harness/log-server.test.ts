import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { LogStore } from "../browser/log-server.ts";

test("file log appends sequenced JSONL, retries idempotently and rejects gaps", async () => {
  const temporaryRoot = await realpath(tmpdir());
  const folder = await mkdtemp(join(temporaryRoot, "robots-debug-test-"));
  try {
    const store = new LogStore(folder); const log = await store.create();
    const records = [{ sequence: 1, kind: "trace", entry: { kind: "started" } }];
    await store.append(log.id, records); await store.append(log.id, records);
    const content = await readFile(log.path, "utf8");
    assert.equal(content.trim().split("\n").length, 1);
    await assert.rejects(store.append(log.id, [{ sequence: 3, kind: "trace", entry: { kind: "closed" } }]), /sequence/i);
    await assert.rejects(store.append("../escape", records), /Unknown/i);
  } finally {
    assert.equal(dirname(folder), temporaryRoot);
    assert.ok(basename(folder).startsWith("robots-debug-test-"));
    await rm(folder, { recursive: true, force: true });
  }
});
