const isObjectLike = (value: unknown): boolean => (typeof value === 'object' && value !== null) || typeof value === 'function';

const isEmptyPlainObject = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Object.keys(value).length === 0 &&
  Object.getOwnPropertySymbols(value).length === 0;

/**
 * Whether `structuredClone` can copy the value without losing its prototype.
 * Class instances survive the clone but come back as plain objects, so they are
 * rejected here and shared by reference instead of being silently degraded.
 */
const isCloneable = (value: unknown): boolean => {
  try {
    return Object.getPrototypeOf(structuredClone(value)) === Object.getPrototypeOf(value);
  } catch {
    return false;
  }
};

/**
 * How a `reduce` seed has to be produced on every invocation. Both execution
 * paths follow the same rules, so a pipeline reduces from the same starting
 * value whether it was compiled or not.
 *
 * - `literal`: an immutable value, or an empty array/object cheap to re-create.
 * - `clone`: mutable but copyable without losing its prototype, so re-created.
 * - `share`: cannot be copied faithfully, so the same reference every time.
 */
export type SeedStrategy = { readonly kind: 'literal'; readonly code: string } | { readonly kind: 'clone' } | { readonly kind: 'share' };

export const seedStrategy = (value: unknown): SeedStrategy => {
  if (value === null) {
    return { kind: 'literal', code: 'null' };
  }
  if (value === undefined) {
    return { kind: 'literal', code: 'undefined' };
  }
  if (typeof value === 'boolean') {
    return { kind: 'literal', code: String(value) };
  }
  if (typeof value === 'number') {
    // `NaN`, `Infinity` and `-Infinity` all stringify to valid expressions.
    return { kind: 'literal', code: Object.is(value, -0) ? '-0' : String(value) };
  }
  if (typeof value === 'string') {
    return { kind: 'literal', code: JSON.stringify(value) };
  }
  if (Array.isArray(value) && value.length === 0) {
    return { kind: 'literal', code: '[]' };
  }
  if (isEmptyPlainObject(value)) {
    return { kind: 'literal', code: '{}' };
  }
  if (isObjectLike(value) && isCloneable(value)) {
    return { kind: 'clone' };
  }
  // BigInt, symbols, class instances and anything holding a function.
  return { kind: 'share' };
};

/** A function producing the seed for one invocation, used by the runtime path. */
export const seedFactory = (value: unknown): (() => unknown) => {
  const strategy = seedStrategy(value);
  if (strategy.kind === 'clone') {
    return () => structuredClone(value);
  }
  if (strategy.kind === 'share') {
    return () => value;
  }
  // Empty containers must still be fresh on every call.
  if (Array.isArray(value)) {
    return () => [];
  }
  if (isEmptyPlainObject(value)) {
    return () => ({});
  }
  return () => value;
};
