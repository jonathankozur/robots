import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { rngSnapshot, deriveStream, nextU32, nextInt, chance } from "@robots/values/rng";
import type { RngSnapshot } from "@robots/system-api";
const vectors = JSON.parse(readFileSync(new URL("./reference-vectors.json", import.meta.url), "utf8")) as {
  raw: { initial: number[]; values: number[]; final: number[] }[];
  derived: { seed: string; systemId: string; purpose: string; initial: number[]; values: number[]; final: number[] }[];
};
test("xoshiro128** 1.1 follows independent Python reference vectors and keeps snapshots immutable", () => {
  for (const vector of vectors.raw) {
    const source = [...vector.initial];
    const original = rngSnapshot(source);
    let state = original;
    const values = vector.values.map(() => { const draw = nextU32(state); state = draw.state; return draw.value; });
    assert.deepEqual(values, vector.values); assert.deepEqual(state.words, vector.final);
    assert.equal(state.draws, vector.values.length); assert.equal(original.draws, 0);
    assert.ok(Object.isFrozen(state) && Object.isFrozen(state.words));
    source[0] = 0; assert.notEqual(original.words[0], 0);
  }
});
test("UTF-8 seed derivation matches independently generated vectors", () => {
  for (const vector of vectors.derived) {
    let state = deriveStream(vector.seed, vector.systemId, vector.purpose);
    assert.deepEqual(state.words, vector.initial);
    const values = vector.values.map(() => { const draw = nextU32(state); state = draw.state; return draw.value; });
    assert.deepEqual(values, vector.values); assert.deepEqual(state.words, vector.final);
  }
});
test("invalid seeds, state, algorithm, counters and identifiers fail before advancing", () => {
  for (const words of [[0, 0, 0, 0], [1, 2, 3], [1, 2, 3, -1], [1, 2, 3, 2 ** 32], [1, 2, 3, 0.5]]) assert.throws(() => rngSnapshot(words), { code: "RNG_INVALID" });
  for (const draws of [-1, 0.5, 2 ** 53]) assert.throws(() => rngSnapshot([1, 2, 3, 4], draws), { code: "RNG_INVALID" });
  const state = rngSnapshot([1, 2, 3, 4], Number.MAX_SAFE_INTEGER);
  assert.throws(() => nextU32(state), { code: "RNG_EXHAUSTED" }); assert.equal(state.draws, Number.MAX_SAFE_INTEGER);
  assert.throws(() => nextU32({ ...state, algorithm: "other" } as unknown as RngSnapshot), { code: "RNG_INVALID" });
  for (const seed of ["", "123", "0123456789ABCDEF", "g123456789abcdef"]) assert.throws(() => deriveStream(seed, "a", "b"), { code: "RNG_INVALID" });
  for (const id of ["", "\ud800"]) assert.throws(() => deriveStream("0123456789abcdef", id, "b"), { code: "RNG_INVALID" });
});
test("uniform intervals discard raw samples and count every extraction; full uint32 interval works", () => {
  // c = b XOR a makes the next b zero: one rejected draw, then zero accepted.
  const s = rngSnapshot([1, 0x7fffffff, 0x7ffffffe, 4]);
  const first = nextU32(s); const second = nextU32(first.state);
  assert.ok(first.value >= 0x80000001); assert.ok(second.value < 0x80000001);
  const actual = nextInt(s, 0, 0x80000001);
  assert.equal(actual.value, second.value); assert.equal(actual.state.draws, 2);
  assert.deepEqual(nextInt(s, 0, 2 ** 32), first);
  assert.equal(nextInt(s, 17, 18).value, 17);
  for (const [min, max] of [[-1, 5], [5, 5], [5, 4], [0, 2 ** 32 + 1], [0, 0.5]]) assert.throws(() => nextInt(s, min!, max!), { code: "RNG_INVALID" });
  assert.equal(s.draws, 0);
});
test("valid probabilities consume a draw even at extremes; invalid requests consume nothing", () => {
  const state = rngSnapshot([1, 2, 3, 4]);
  assert.equal(chance(state, 0).value, false); assert.equal(chance(state, 10000).value, true);
  assert.equal(chance(state, 0).state.draws, 1); assert.deepEqual(chance(state, 5000).state, nextInt(state, 0, 10000).state);
  for (const threshold of [-1, 10001, 0.5, NaN]) assert.throws(() => chance(state, threshold), { code: "RNG_INVALID" });
  assert.equal(state.draws, 0);
});
test("different purposes and systems remain isolated under extra draws", () => {
  const a = deriveStream("0123456789abcdef", "a", "aim");
  const b = deriveStream("0123456789abcdef", "a", "loot");
  assert.notDeepEqual(a.words, b.words);
  let noise = b; for (let i = 0; i < 100; i++) noise = nextU32(noise).state;
  assert.deepEqual(nextU32(a), nextU32(deriveStream("0123456789abcdef", "a", "aim")));
  assert.notDeepEqual(a.words, deriveStream("0123456789abcdef", "b", "aim").words);
});
