type Operation<T = any, U = any> =
  | {
      type: 'filter';
      fn: (value: T, index: number) => unknown;
    }
  | {
      type: 'find';
      fn: (value: T, index: number, obj: T[]) => unknown;
    }
  | {
      type: 'findIndex';
      fn: (value: T, index: number, obj: T[]) => unknown;
    }
  | {
      type: 'some';
      fn: (value: T, index: number) => boolean;
    }
  | {
      type: 'every';
      fn: (value: T, index: number) => boolean;
    }
  | {
      type: 'map';
      fn: (value: T, index: number) => U;
    }
  | {
      type: 'reduce';
      fn: (previousValue: U, currentValue: T, currentIndex: number) => U;
      initialValue: U;
    }
  | {
      type: 'forEach';
      fn: (value: T, index: number) => void;
    }
  | {
      type: 'join';
      separator: string;
    };

/**
 * A built pipeline. `S` is the element type it consumes — the type the pipeline
 * started from, not the type the last operation produced — and `R` is what it
 * gives back.
 */
type Pipeline<S = any, R = S[], C extends Record<string, any> = Record<string, any>> = (array: S[], context?: C) => R;

type LastOperation<S = any, R = S, C extends Record<string, any> = Record<string, any>> = { build: () => Pipeline<S, R, C> };

type ToArray<S = any, R = S, C extends Record<string, any> = Record<string, any>> = Pipeline<S, R[], C>;

const cache = new Map<string, Turbo<any, any>>();

/** Matches the `toString()` output of native and bound functions, which cannot be inlined. */
const NATIVE_CODE = /\{\s*\[native code\]\s*\}/;

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
 * Source expression for the `reduce` seed.
 *
 * Primitives are inlined as literals, which keeps the generated function free of
 * any closure. Everything else is captured by the factory (`captured: true`) and
 * re-created on each invocation whenever it can be copied without losing its
 * prototype, so that the built function stays reusable.
 */
const seedExpression = (value: unknown): { readonly code: string; readonly captured: boolean } => {
  if (value === null) {
    return { code: 'null', captured: false };
  }
  if (value === undefined) {
    return { code: 'undefined', captured: false };
  }
  if (typeof value === 'boolean') {
    return { code: String(value), captured: false };
  }
  if (typeof value === 'number') {
    // `NaN`, `Infinity` and `-Infinity` all stringify to valid expressions.
    return { code: Object.is(value, -0) ? '-0' : String(value), captured: false };
  }
  if (typeof value === 'string') {
    return { code: JSON.stringify(value), captured: false };
  }
  if (Array.isArray(value) && value.length === 0) {
    return { code: '[]', captured: false };
  }
  if (isEmptyPlainObject(value)) {
    return { code: '{}', captured: false };
  }
  if (isObjectLike(value) && isCloneable(value)) {
    return { code: '__turboClone(__turboSeed)', captured: true };
  }
  // BigInt, symbols, class instances and anything holding a function.
  return { code: '__turboSeed', captured: true };
};

/**
 * The Turbo class provides a way to build a sequence of operations (filter, map, reduce, forEach)
 * that can be applied to an array in a lazy manner. The operations are stored and only executed
 * when the build method is called, which constructs and returns a function that performs the
 * accumulated operations on an array.
 */
class Turbo<T = any, C extends Record<string, any> = Record<string, any>, S = T> {
  private readonly _operations: Array<Operation<T>> = [];
  private _hasReduce = false;
  private _hasFilter = false;
  private _fn: ToArray<S, T, C> | undefined;
  private readonly _lastOperation = {
    build: this.build.bind(this),
  };

  /**
   * Adds a filter operation to the list of operations to be performed on the array.
   * The filter operation will include only the elements that satisfy the provided predicate function.
   *
   * @param predicate - A function that accepts up to two arguments. The filter method calls the predicate function one time for each element in the array.
   * @param predicate.value - The current element being processed in the array.
   * @param predicate.index - The index of the current element being processed in the array.
   * @returns The current instance of the Turbo class to allow for method chaining.
   */
  filter(predicate: (value: T, index: number) => unknown): Turbo<T, C, S> {
    if (!this._fn) {
      this._operations.push({ type: 'filter', fn: predicate });
      this._hasFilter = true;
    }
    return this;
  }

  /**
   * Adds a 'some' operation to the Turbo instance. The 'some' operation checks if at least one element in the array
   * satisfies the provided predicate function.
   *
   * @param predicate - A function that accepts up to two arguments. The 'some' method calls the predicate function
   * for each element in the array until the predicate returns a truthy value, or until the end of the array.
   * @returns The current Turbo instance with the 'some' operation added to the operations queue.
   */
  some(predicate: (value: T, index: number) => boolean): LastOperation<S, boolean, C> {
    if (!this._fn) {
      this._operations.push({ type: 'some', fn: predicate });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<S, boolean, C>;
  }

  /**
   * Checks if every element in the array satisfies the provided predicate function.
   *
   * @param predicate - A function that accepts up to two arguments. The `every` method calls
   * the predicate function for each element in the array until the predicate returns true,
   * or until the end of the array.
   * @returns A `LastOperation` object containing the result of the `every` operation.
   */
  every(predicate: (value: T, index: number) => boolean): LastOperation<S, boolean, C> {
    if (!this._fn) {
      this._operations.push({ type: 'every', fn: predicate });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<S, boolean, C>;
  }

  /**
   * Adds a find operation to the list of operations to be performed on the array.
   * The find operation returns the first element in the array that satisfies the provided predicate function.
   *
   * @param predicate - A function that accepts up to three arguments. The find method calls the predicate function one time for each element in the array.
   * @param predicate.value - The current element being processed in the array.
   * @param predicate.index - The index of the current element being processed in the array.
   * @returns An object with a `build` method that returns a function when called.
   */
  find(predicate: (value: T, index: number) => unknown): LastOperation<S, T | undefined, C> {
    if (!this._fn) {
      this._operations.push({ type: 'find', fn: predicate });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<S, T | undefined, C>;
  }

  /**
   * Finds the index of the first element in the array that satisfies the provided testing function.
   * If no elements satisfy the testing function, -1 is returned.
   *
   * @param predicate - A function that accepts up to two arguments. The findIndex method calls the predicate function once for each element in the array, in ascending order, until it finds one where predicate returns true. If such an element is found, findIndex immediately returns that element's index. Otherwise, findIndex returns -1.
   * @returns A `LastOperation` object containing the index of the first element in the array that passes the test. If no elements pass the test, the index will be -1.
   */
  findIndex(predicate: (value: T, index: number) => unknown): LastOperation<S, number, C> {
    if (!this._fn) {
      this._operations.push({ type: 'findIndex', fn: predicate });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<S, number, C>;
  }

  /**
   * Applies a mapping function to each element in the array and returns a new Turbo instance.
   *
   * @param mapper - A function that takes a value and its index, and returns a new value.
   * @returns A new Turbo instance with the mapping operation added to the operations queue.
   */
  map<U = T>(mapper: (value: T, index: number) => U): Turbo<U, C, S> {
    if (!this._fn) {
      this._operations.push({ type: 'map', fn: mapper });
    }
    return this as unknown as Turbo<U, C, S>;
  }

  /**
   * Adds a reduce operation to the list of operations to be performed on the array.
   *
   * The `initialValue` is captured once, at build time. Immutable values, plain
   * objects, arrays and any other structured-cloneable value (`Map`, `Set`,
   * `Date`, ...) are re-created on every invocation, so the built function stays
   * reusable. Values that cannot be cloned without losing their prototype
   * (class instances, values holding functions) are shared across invocations
   * instead: do not mutate them in the reducer.
   *
   * @param reducer - A function that takes an accumulator, the current value, and the current index, and returns the new accumulator value.
   * @param initialValue - The initial value to be used as the first argument to the first call of the reducer function.
   * @returns An object with a `build` method that, when called, returns a function to execute the operations.
   */
  reduce<U>(reducer: (previousValue: U, currentValue: T, currentIndex: number) => U, initialValue: U): LastOperation<S, U, C> {
    if (!this._fn) {
      this._operations.push({ type: 'reduce', fn: reducer, initialValue });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<S, U, C>;
  }

  /**
   * Adds a join operation to the list of operations with the specified separator.
   *
   * Like `Array.prototype.join`, `null` and `undefined` elements are rendered as
   * an empty string.
   *
   * @param separator - The string to use as a separator. Defaults to a comma.
   * @returns An object with a `build` method that returns a function when called.
   */
  join(separator = ','): LastOperation<S, string, C> {
    if (!this._fn) {
      this._operations.push({ type: 'join', separator });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<S, string, C>;
  }

  /**
   * Adds a forEach operation to the list of operations to be performed on the array.
   *
   * `forEach` is a pass-through stage: elements keep flowing to the next
   * operation of the pipeline, so it can be chained with `map`, `filter`,
   * `reduce`, and so on.
   *
   * @param callbackfn - A function that accepts up to two arguments. forEach calls the callbackfn function one time for each element in the array.
   * @returns The current instance of Turbo to allow for method chaining.
   */
  forEach(callbackfn: (value: T, index: number) => void): Turbo<T, C, S> {
    if (!this._fn) {
      this._operations.push({ type: 'forEach', fn: callbackfn });
    }
    return this;
  }

  /**
   * Builds and returns a function based on the operations defined in the instance.
   * The generated function processes an array according to the specified operations
   * (filter, map, reduce, forEach) and returns the result.
   *
   * @returns {ToArray<S, T, C>} The generated function that processes an array.
   */
  build(): ToArray<S, T, C> {
    if (this._fn) {
      return this._fn;
    }

    let method = '"use strict"; if (!Array.isArray(array)) throw new Error("Invalid parameters");\n';
    let head = '';
    let body = '';
    let foot = '';
    let seed: unknown;

    if (this._operations.length > 0) {
      if (!this._hasReduce) {
        if (this._hasFilter) {
          head += 'const result = [];\n';
        } else {
          head += 'const result = new Array(array.length);\n';
        }
      }

      body += 'let e = array.length, item;\n';
      body += 'let i = 0;\n';
      body += 'for (; i < e; i++) {\n';
      body += '    item = array[i];\n';

      // Every operation must see the index the element would have in the array
      // *as it reaches that operation*, exactly like a native
      // `arr.filter(...).map(...)` chain does. `i` is the source index, and each
      // filter opens a new stage whose counter is bumped only by the elements
      // that survive it.
      let indexName = 'i';
      let stage = 0;
      let finalResult = '';

      for (let k = 0, n = this._operations.length; k < n; k++) {
        const operation = this._operations[k];
        const fn = (operation as { readonly fn?: unknown }).fn;
        if (typeof fn === 'function') {
          const source = fn.toString();
          if (NATIVE_CODE.test(source)) {
            throw new TypeError(
              `turbo-array: ${operation.type}() got a native or bound function, which cannot be inlined. Wrap it, e.g. .${operation.type}((value) => Math.round(value)).`,
            );
          }
          method += `const ${operation.type}_${k} = ${source};\n`;
        }

        if (operation.type === 'reduce') {
          const { code, captured } = seedExpression(operation.initialValue);
          if (captured) {
            seed = operation.initialValue;
          }
          finalResult = `let result = ${code};\n`;
        } else if (operation.type === 'join') {
          finalResult = 'let result = "", joined = false;\n';
          head += `const separator = ${JSON.stringify(operation.separator)};\n`;
        } else if (operation.type === 'find') {
          finalResult = 'let result = undefined;\n';
        } else if (operation.type === 'findIndex') {
          finalResult = 'let result = -1;\n';
        } else if (operation.type === 'some') {
          finalResult = 'let result = false;\n';
        } else if (operation.type === 'every') {
          finalResult = 'let result = true;\n';
        }

        if (operation.type === 'filter') {
          body += `    if (!${operation.type}_${k}(item, ${indexName})) continue;\n`;
          if (this._needsIndexAfter(k)) {
            stage++;
            head += `let stage_${stage} = 0;\n`;
            body += `    const idx_${stage} = stage_${stage}++;\n`;
            indexName = `idx_${stage}`;
          }
        } else if (operation.type === 'map') {
          body += `    item = ${operation.type}_${k}(item, ${indexName});\n`;
        } else if (operation.type === 'reduce') {
          body += `    result = ${operation.type}_${k}(result, item, ${indexName});\n`;
        } else if (operation.type === 'forEach') {
          body += `    ${operation.type}_${k}(item, ${indexName});\n`;
        } else if (operation.type === 'join') {
          body += '    if (joined) result += separator; else joined = true;\n';
          body += "    result += item === null || item === undefined ? '' : `${item}`;\n";
        } else if (operation.type === 'find') {
          body += `    if (${operation.type}_${k}(item, ${indexName})) return item;\n`;
        } else if (operation.type === 'findIndex') {
          body += `    if (${operation.type}_${k}(item, ${indexName})) return ${indexName};\n`;
        } else if (operation.type === 'some') {
          body += `    if (${operation.type}_${k}(item, ${indexName})) return true;\n`;
        } else {
          // Every operation type is handled above, so this is `every`.
          body += `    if (!${operation.type}_${k}(item, ${indexName})) return false;\n`;
        }
      }
      head += finalResult;

      if (!this._hasReduce) {
        if (this._hasFilter) {
          body += '    result.push(item);\n';
        } else {
          body += `    result[${indexName}] = item;\n`;
        }
      }

      foot += '}\n'; // end for
      foot += 'return result;';
    } else {
      foot += 'return array;';
    }

    const code = method + head + body + foot;

    let factory: (seed: unknown, clone: typeof structuredClone) => ToArray<S, T, C>;
    try {
      factory = new Function('__turboSeed', '__turboClone', `return function (array, context) {\n${code}\n};`) as typeof factory;
    } catch (error) {
      // The operations are inlined as source code, so anything whose
      // `toString()` is not a standalone function expression (method shorthand,
      // minifier artifacts, ...) cannot be compiled.
      throw new TypeError(`turbo-array: the pipeline could not be compiled (${(error as Error).message}). Pass plain function expressions or arrow functions.`);
    }

    this._fn = factory(seed, structuredClone);
    this._operations.length = 0;
    return this._fn;
  }

  /**
   * Whether any operation after `position` consumes an element index. `join` is
   * the only operation that does not, so a filter followed exclusively by joins
   * does not need to open a new index stage.
   */
  private _needsIndexAfter(position: number): boolean {
    for (let k = position + 1, n = this._operations.length; k < n; k++) {
      if (this._operations[k].type !== 'join') {
        return true;
      }
    }
    return false;
  }
}

/**
 * Creates and returns a new instance of the Turbo class.
 * @param cacheKey - A key to store the instance in the cache.
 *
 * @returns {Turbo<T, C>} A new instance of the Turbo class.
 */
export function turbo<T = any, C extends Record<string, any> = Record<string, any>>(cacheKey?: string): Turbo<T, C> {
  let result: Turbo<T, C> | undefined;
  if (cacheKey) {
    result = cache.get(cacheKey);
    if (result) {
      return result;
    }
  }
  result = new Turbo<T, C>();
  if (cacheKey) {
    cache.set(cacheKey, result);
  }
  return result;
}

/**
 * Drops the pipelines kept by `turbo(cacheKey)`. Cached instances live for the
 * lifetime of the module, so call this to release them (for example between
 * test cases, or when the keys are derived from user input).
 *
 * @param cacheKey - The key to evict. When omitted, the whole cache is cleared.
 * @returns `true` when an entry was evicted, `false` otherwise.
 */
export function clearCache(cacheKey?: string): boolean {
  if (cacheKey === undefined) {
    const had = cache.size > 0;
    cache.clear();
    return had;
  }
  return cache.delete(cacheKey);
}

/**
 * Creates and returns a new instance of the Turbo class.
 *
 * @returns {Turbo} A new instance of the Turbo class.
 */
export default turbo;
