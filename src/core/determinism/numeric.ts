import { protocol } from "../messaging/contracts.ts";
export type Rounding = "floor" | "ceil" | "trunc";
export const TICK_RATE = 20;
export const TICK_MS = 50;
export const QUANTITY_SCALE = 1000;
export const PROBABILITY_SCALE = 10000;
export function checkedInteger(value: number): number {
  if (!Number.isSafeInteger(value)) protocol("NUMERIC_INVALID", "Expected a safe integer");
  return value === 0 ? 0 : value;
}
function result(value: number): number {
  if (!Number.isSafeInteger(value)) protocol("NUMERIC_OVERFLOW", "Unsafe arithmetic result or intermediate");
  return value === 0 ? 0 : value;
}
export function checkedAdd(a: number, b: number): number { return result(checkedInteger(a) + checkedInteger(b)); }
export function checkedSubtract(a: number, b: number): number { return result(checkedInteger(a) - checkedInteger(b)); }
export function checkedMultiply(a: number, b: number): number { return result(checkedInteger(a) * checkedInteger(b)); }
export function divideRounded(a: number, b: number, round: Rounding): number {
  checkedInteger(a); checkedInteger(b);
  if (b === 0 || !["floor", "ceil", "trunc"].includes(round)) protocol("NUMERIC_INVALID", "Nonzero divisor and explicit rounding required");
  // Computing floor(a/b) directly can round a fraction to an integer near 2^53.
  const remainder = a % b;
  const quotient = result((a - remainder) / b);
  const negative = (a < 0) !== (b < 0);
  if (remainder !== 0 && round === "floor" && negative) return checkedSubtract(quotient, 1);
  if (remainder !== 0 && round === "ceil" && !negative) return checkedAdd(quotient, 1);
  return quotient;
}
export function mulDiv(a: number, b: number, divisor: number, round: Rounding): number {
  return divideRounded(checkedMultiply(a, b), divisor, round);
}
function nonnegative(value: number): number {
  checkedInteger(value);
  if (value < 0) protocol("NUMERIC_INVALID", "Expected nonnegative duration");
  return value;
}
export function msToTicks(ms: number): number { return divideRounded(nonnegative(ms), TICK_MS, "ceil"); }
export function ticksToMs(ticks: number): number { return checkedMultiply(nonnegative(ticks), TICK_MS); }
export function parseScaledDecimal(text: string): number {
  if (typeof text !== "string" || !/^-?[0-9]+(?:\.[0-9]{1,3})?$/.test(text)) protocol("NUMERIC_INVALID", "Expected decimal text with at most three places");
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = (negative ? text.slice(1) : text).split(".");
  let value = 0;
  for (const digit of whole! + fraction.padEnd(3, "0")) value = checkedAdd(checkedMultiply(value, 10), Number(digit));
  return value === 0 ? 0 : negative ? -value : value;
}
