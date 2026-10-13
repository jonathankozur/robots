import { protocol } from "../messaging/contracts.ts";
import type { RngSnapshot } from "../messaging/contracts.ts";
import { snapshotData } from "../messaging/immutable.ts";
export interface Draw<T> { readonly value: T; readonly state: RngSnapshot }
const U32_RANGE = 2 ** 32;
const MASK64 = (1n << 64n) - 1n;
export function rngSnapshot(words: readonly number[], draws = 0): RngSnapshot {
  let copied: readonly number[];
  try { copied = snapshotData(words, 1024) as unknown as readonly number[]; }
  catch { protocol("RNG_INVALID", "RNG words must be plain data"); }
  if (!Array.isArray(copied) || copied.length !== 4 || !copied.every(n => Number.isInteger(n) && n >= 0 && n < U32_RANGE)
    || copied.every(n => n === 0) || !Number.isSafeInteger(draws) || draws < 0) protocol("RNG_INVALID", "Nonzero uint32 state and safe extraction count required");
  const tuple: RngSnapshot["words"] = Object.freeze([copied[0]!, copied[1]!, copied[2]!, copied[3]!]);
  return Object.freeze({ version: 1, algorithm: "xoshiro128**-1.1", words: tuple, draws: draws === 0 ? 0 : draws });
}
export function streamIdentifier(id: string): string {
  if (typeof id !== "string" || !id || id.length > 128 || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(id)) protocol("RNG_INVALID", "Stream identifiers require 1..128 well-formed UTF-16 units");
  return id;
}
export function masterSeed(seed: string): string {
  if (typeof seed !== "string" || !/^[0-9a-f]{16}$/.test(seed)) protocol("RNG_INVALID", "Seed requires exactly 16 lowercase hexadecimal digits");
  return seed;
}
export function deriveStream(seed: string, systemId: string, purpose: string): RngSnapshot {
  const key = JSON.stringify(["env-v1", masterSeed(seed), streamIdentifier(systemId), streamIdentifier(purpose)]);
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(key)) hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & MASK64;
  const words: number[] = [];
  for (let i = 0; i < 2; i++) {
    hash = (hash + 0x9e3779b97f4a7c15n) & MASK64;
    let z = hash;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    z ^= z >> 31n;
    words.push(Number(z & 0xffffffffn), Number(z >> 32n));
  }
  return rngSnapshot(words);
}
function validated(state: RngSnapshot): RngSnapshot {
  let copied: RngSnapshot;
  try { copied = snapshotData(state, 2048) as unknown as RngSnapshot; }
  catch { protocol("RNG_INVALID", "RNG snapshot must be plain data"); }
  if (!copied || typeof copied !== "object" || Array.isArray(copied)
    || Object.keys(copied).sort().join(",") !== "algorithm,draws,version,words"
    || copied.version !== 1 || copied.algorithm !== "xoshiro128**-1.1") protocol("RNG_INVALID", "Unsupported RNG snapshot");
  return rngSnapshot(copied.words, copied.draws);
}
function rotate(value: number, bits: number): number { return ((value << bits) | (value >>> (32 - bits))) >>> 0; }
export function nextU32(state: RngSnapshot): Draw<number> {
  const current = validated(state);
  if (current.draws === Number.MAX_SAFE_INTEGER) protocol("RNG_EXHAUSTED", "RNG extraction counter exhausted");
  let [a, b, c, d] = current.words;
  const value = Math.imul(rotate(Math.imul(b, 5), 7), 9) >>> 0;
  const shifted = b << 9;
  c ^= a; d ^= b; b ^= c; a ^= d; c ^= shifted; d = rotate(d, 11);
  return Object.freeze({ value, state: rngSnapshot([a >>> 0, b >>> 0, c >>> 0, d >>> 0], current.draws + 1) });
}
export function nextInt(state: RngSnapshot, min: number, maxExclusive: number): Draw<number> {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(maxExclusive) || min < 0 || maxExclusive > U32_RANGE || maxExclusive <= min) protocol("RNG_INVALID", "Expected unsigned nonempty interval within uint32 range");
  const width = maxExclusive - min;
  const limit = U32_RANGE - U32_RANGE % width;
  let draw = nextU32(state);
  while (draw.value >= limit) draw = nextU32(draw.state);
  return Object.freeze({ value: min + draw.value % width, state: draw.state });
}
export function chance(state: RngSnapshot, threshold: number): Draw<boolean> {
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 10000) protocol("RNG_INVALID", "Probability must be in 0..10000 basis points");
  const draw = nextInt(state, 0, 10000);
  return Object.freeze({ value: draw.value < threshold, state: draw.state });
}
