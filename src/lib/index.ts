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

type LastOperation<T = any, U = T> = { build: () => (array: T[], context?: Record<string, any>) => U };

type ToArray<T = any> = (array: T[], context?: Record<string, any>) => T[];

const cache = new Map<string, Turbo<any>>();

/**
 * The Turbo class provides a way to build a sequence of operations (filter, map, reduce, forEach)
 * that can be applied to an array in a lazy manner. The operations are stored and only executed
 * when the build method is called, which constructs and returns a function that performs the
 * accumulated operations on an array.
 */
class Turbo<T = any> {
  private readonly _operations: Array<Operation<T>> = [];
  private _hasReduce = false;
  private _hasFilter = false;
  private _fn: ToArray<T> | undefined;
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
  filter(predicate: (value: T, index: number) => unknown): Turbo<T> {
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
  some(predicate: (value: T, index: number) => boolean): LastOperation<T, boolean> {
    if (!this._fn) {
      this._operations.push({ type: 'some', fn: predicate });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<T, boolean>;
  }

  /**
   * Checks if every element in the array satisfies the provided predicate function.
   *
   * @param predicate - A function that accepts up to two arguments. The `every` method calls
   * the predicate function for each element in the array until the predicate returns true,
   * or until the end of the array.
   * @returns A `LastOperation` object containing the result of the `every` operation.
   */
  every(predicate: (value: T, index: number) => boolean): LastOperation<T, boolean> {
    if (!this._fn) {
      this._operations.push({ type: 'every', fn: predicate });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<T, boolean>;
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
  find(predicate: (value: T, index: number) => unknown): LastOperation<T | undefined, T | undefined> {
    if (!this._fn) {
      this._operations.push({ type: 'find', fn: predicate });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<T | undefined, T | undefined>;
  }

  /**
   * Finds the index of the first element in the array that satisfies the provided testing function.
   * If no elements satisfy the testing function, -1 is returned.
   *
   * @param predicate - A function that accepts up to two arguments. The findIndex method calls the predicate function once for each element in the array, in ascending order, until it finds one where predicate returns true. If such an element is found, findIndex immediately returns that element's index. Otherwise, findIndex returns -1.
   * @returns A `LastOperation` object containing the index of the first element in the array that passes the test. If no elements pass the test, the index will be -1.
   */
  findIndex(predicate: (value: T, index: number) => unknown): LastOperation<T | undefined, number> {
    if (!this._fn) {
      this._operations.push({ type: 'findIndex', fn: predicate });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<T | undefined, number>;
  }

  /**
   * Applies a mapping function to each element in the array and returns a new Turbo instance.
   *
   * @param mapper - A function that takes a value and its index, and returns a new value.
   * @returns A new Turbo instance with the mapping operation added to the operations queue.
   */
  map<U = T>(mapper: (value: T, index: number) => U): Turbo<U> {
    if (!this._fn) {
      this._operations.push({ type: 'map', fn: mapper });
    }
    return this as unknown as Turbo<U>;
  }

  /**
   * Adds a reduce operation to the list of operations to be performed on the array.
   *
   * @param reducer - A function that takes an accumulator, the current value, and the current index, and returns the new accumulator value.
   * @param initialValue - The initial value to be used as the first argument to the first call of the reducer function.
   * @returns An object with a `build` method that, when called, returns a function to execute the operations.
   */
  reduce<U>(reducer: (previousValue: U, currentValue: T, currentIndex: number) => U, initialValue: U): LastOperation<T, U> {
    if (!this._fn) {
      this._operations.push({ type: 'reduce', fn: reducer, initialValue });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<T, U>;
  }

  /**
   * Adds a join operation to the list of operations with the specified separator.
   *
   * @param separator - The string to use as a separator. Defaults to an empty string.
   * @returns An object with a `build` method that returns a function when called.
   */
  join(separator = ','): LastOperation<T, string> {
    if (!this._fn) {
      this._operations.push({ type: 'join', separator });
      this._hasReduce = true;
    }
    return this._lastOperation as unknown as LastOperation<T, string>;
  }

  /**
   * Adds a forEach operation to the list of operations to be performed on the array.
   *
   * @param callbackfn - A function that accepts up to two arguments. forEach calls the callbackfn function one time for each element in the array.
   * @returns The current instance of Turbo to allow for method chaining.
   */
  forEach(callbackfn: (value: T, index: number) => void): Turbo<T> {
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
   * @returns {ToArray<T>} The generated function that processes an array.
   */
  build(): ToArray<T> {
    if (this._fn) {
      return this._fn;
    }

    let method = 'if (!Array.isArray(array)) throw new Error("Invalid parameters");\n';
    let head = '';
    let body = '';
    let foot = '';

    if (this._operations.length > 0) {
      if (!this._hasReduce) {
        if (this._hasFilter) {
          head += 'const result = [];\n';
        } else {
          head += 'const result = new Array(array.length);\n';
        }
      } else {
        head += 'let result;\n';
      }

      body += 'let i = 0, e = array.length, last = e - 1, idx = 0, item;\n';
      if (this._hasFilter) {
        body += 'for (; i < e; i++, idx++) {\n';
      } else {
        body += 'for (; i < e; i++, idx = i) {\n';
      }
      body += '    item = array[i];\n';

      for (let i = 0, e = this._operations.length; i < e; i++) {
        const operation = this._operations[i];
        const fn = (operation as any)?.fn;
        if (typeof fn === 'function') {
          method += `const ${operation.type}_${i} = ${fn.toString()};\n`;
        }

        if (operation.type === 'reduce') {
          head += `result = ${JSON.stringify(operation.initialValue)};\n`;
        } else if (operation.type === 'join') {
          head += 'result = "";\n';
          head += `const separator = ${JSON.stringify(operation.separator)};\n`
        } else if (operation.type === 'find') {
          head += 'result = undefined;\n';
        } else if (operation.type === 'findIndex') {
          head += 'result = -1;\n';
        } else if (operation.type === 'some') {
          head += 'result = false;\n';
        } else if (operation.type === 'every') {
          head += 'result = true;\n';
        }

        if (operation.type === 'filter') {
          body += `    if (!${operation.type}_${i}(item, idx)) {\n`;
          body += '    idx--;\n';
          body += '    continue;\n';
          body += '    }\n';
        } else if (operation.type === 'map') {
          body += `    item = ${operation.type}_${i}(item, idx);\n`;
        } else if (operation.type === 'reduce') {
          body += `    result = ${operation.type}_${i}(result, item, idx);\n`;
        } else if (operation.type === 'forEach') {
          body += `${operation.type}_${i}(a, idx);\n`;
        } else if (operation.type === 'join') {
          body += '    result += item;\n';
          body += `    if (idx < last) result += separator;\n`;
        } else if (operation.type === 'find') {
          body += `    if (${operation.type}_${i}(item, idx)) return item;\n`;
        } else if (operation.type === 'findIndex') {
          body += `    if (${operation.type}_${i}(item, idx)) return idx;\n`;
        } else if (operation.type === 'some') {
          body += `    if (${operation.type}_${i}(item, idx)) return true;\n`;
        } else if (operation.type === 'every') {
          body += `    if (!${operation.type}_${i}(item, idx)) return false;\n`;
        }
      }

      if (!this._hasReduce) {
        if (this._hasFilter) {
          body += '    result.push(item);\n';
        } else {
          body += '    result[i] = item;\n';
        }
      }

      foot += '}\n'; // end for
      foot += 'return result;\n';
    } else {
      foot += 'return array;\n';
    }

    const code = method + head + body + foot;

    this._fn = new Function('array', 'context', code) as ToArray<T>;
    this._operations.length = 0;
    return this._fn;
  }
}

/**
 * Creates and returns a new instance of the Turbo class.
 * @param cacheKey - A key to store the instance in the cache.
 *
 * @returns {Turbo<T>} A new instance of the Turbo class.
 */
export function turbo<T = any>(cacheKey?: string): Turbo<T> {
  let result: Turbo<T> | undefined;
  if (cacheKey) {
    result = cache.get(cacheKey);
    if (result) {
      return result;
    }
  }
  result = new Turbo<T>();
  if (cacheKey) {
    cache.set(cacheKey, result);
  }
  return result;
}

/**
 * Creates and returns a new instance of the Turbo class.
 *
 * @returns {Turbo} A new instance of the Turbo class.
 */
export default turbo;
