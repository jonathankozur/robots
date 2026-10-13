import assert from "node:assert/strict";
import test from "node:test";
import { checkedInteger, checkedAdd, checkedSubtract, checkedMultiply, divideRounded, mulDiv, msToTicks, ticksToMs, parseScaledDecimal } from "../../src/core/determinism/numeric.ts";

test("durations use fixed 50ms ticks, ceil without overflowing an intermediate addition", () => {
  assert.deepEqual([0, 1, 49, 50, 51, 125].map(msToTicks), [0, 1, 1, 1, 2, 3]);
  assert.equal(msToTicks(Number.MAX_SAFE_INTEGER), Number((BigInt(Number.MAX_SAFE_INTEGER) + 49n) / 50n));
  assert.equal(ticksToMs(3), 150);
  for (const n of [-1, 0.5, NaN, Infinity, 2 ** 53]) assert.throws(() => msToTicks(n), { code: "NUMERIC_INVALID" });
  assert.throws(() => ticksToMs(Number.MAX_SAFE_INTEGER), { code: "NUMERIC_OVERFLOW" });
});
test("checked arithmetic rejects unsafe inputs and every unsafe intermediate", () => {
  assert.equal(checkedAdd(10000, -2345), 7655);
  assert.equal(checkedSubtract(-100, 200), -300);
  assert.equal(checkedMultiply(-12345, 100), -1234500);
  assert.equal(Object.is(checkedInteger(-0), -0), false);
  for (const n of [NaN, Infinity, 1.1, 2 ** 53]) assert.throws(() => checkedAdd(n, 0), { code: "NUMERIC_INVALID" });
  assert.throws(() => checkedAdd(Number.MAX_SAFE_INTEGER, 1), { code: "NUMERIC_OVERFLOW" });
  assert.throws(() => checkedSubtract(-Number.MAX_SAFE_INTEGER, 1), { code: "NUMERIC_OVERFLOW" });
  assert.throws(() => mulDiv(Number.MAX_SAFE_INTEGER, 2, 2, "floor"), { code: "NUMERIC_OVERFLOW" });
});
test("signed rounding agrees with exact integer oracle, including near precision boundary", () => {
  for (const a of [0, 1, -1, 13, -13, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]) {
    for (const b of [1, -1, 2, -2, 3, -3, 50, 10000, Number.MAX_SAFE_INTEGER - 1]) {
      const q = BigInt(a) / BigInt(b), rem = BigInt(a) % BigInt(b);
      const negative = (a < 0) !== (b < 0);
      for (const round of ["floor", "ceil", "trunc"] as const) {
        const expected = q + (rem && round === "floor" && negative ? -1n : rem && round === "ceil" && !negative ? 1n : 0n);
        assert.equal(divideRounded(a, b, round), Number(expected), [a, b, round].join("/"));
      }
    }
  }
  assert.equal(mulDiv(12345, 1250, 10000, "floor"), 1543);
  assert.throws(() => divideRounded(1, 0, "floor"), { code: "NUMERIC_INVALID" });
  assert.throws(() => divideRounded(1, 2, "nearest" as "floor"), { code: "NUMERIC_INVALID" });
});
test("decimal text parses to exact thousandths, no silent rounding or locale conversion", () => {
  for (const [s, expected] of [["12.345", 12345], ["-0.001", -1], ["12.3", 12300], ["0", 0], ["9007199254740.991", Number.MAX_SAFE_INTEGER]] as const) assert.equal(parseScaledDecimal(s), expected);
  for (const s of ["1.0000", "1e3", "12,3", " 1", ".1", "1.", "+1", "NaN", ""]) assert.throws(() => parseScaledDecimal(s), { code: "NUMERIC_INVALID" });
  assert.throws(() => parseScaledDecimal("9007199254740.992"), { code: "NUMERIC_OVERFLOW" });
});
