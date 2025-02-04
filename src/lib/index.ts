type Operation<T = any, U = any> =
  | {
    type: 'filter';
    fn: (value: T, index: number) => unknown;
  } | {
    type: 'find';
    fn: (value: T, index: number, obj: T[]) => unknown;
  } | {
    type: 'some';
    fn: (value: T, index: number) => boolean;
  } | {
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

type LastOperation<T = any, U = T> = { build: () => ((array: T[], context?: Record<string, any>) => U) };

type ToArray<T = any> = ((array: T[], context?: Record<string, any>) => T[]);

const cache = new Map<string, Turbo<any>>();

/**
 * The Turbo class provides a way to build a sequence of operations (filter, map, reduce, forEach)
 * that can be applied to an array in a lazy manner. The operations are stored and only executed
 * when the build method is called, which constructs and returns a function that performs the
 * accumulated operations on an array.
 */
class Turbo<T = any> {
  #operations: Array<Operation<T>> = [];
  #hasReduce = false;
  #fn: ToArray<T> | undefined;
  #lastOperation = {
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
    if (!this.#fn) {
      this.#operations.push({ type: 'filter', fn: predicate });
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
    if (!this.#fn) {
      this.#operations.push({ type: 'some', fn: predicate });
      this.#hasReduce = true;
    }
    return this.#lastOperation as unknown as LastOperation<T, boolean>;
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
    if (!this.#fn) {
      this.#operations.push({ type: 'find', fn: predicate });
      this.#hasReduce = true;
    }
    return this.#lastOperation as unknown as LastOperation<T | undefined, T | undefined>;
  }

  /**
   * Applies a mapping function to each element in the array and returns a new Turbo instance.
   *
   * @param mapper - A function that takes a value and its index, and returns a new value.
   * @returns A new Turbo instance with the mapping operation added to the operations queue.
   */
  map<U = T>(mapper: (value: T, index: number) => U): Turbo<U> {
    if (!this.#fn) {
      this.#operations.push({ type: 'map', fn: mapper });
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
    if (!this.#fn) {
      this.#operations.push({ type: 'reduce', fn: reducer, initialValue });
      this.#hasReduce = true;
    }
    return this.#lastOperation as unknown as LastOperation<T, U>;
  }

  /**
   * Adds a join operation to the list of operations with the specified separator.
   *
   * @param separator - The string to use as a separator. Defaults to an empty string.
   * @returns An object with a `build` method that returns a function when called.
   */
  join(separator = ','): LastOperation<T, string> {
    if (!this.#fn) {
      this.#operations.push({ type: 'join', separator });
      this.#hasReduce = true;
    }
    return this.#lastOperation as unknown as LastOperation<T, string>;
  }

  /**
   * Adds a forEach operation to the list of operations to be performed on the array.
   *
   * @param callbackfn - A function that accepts up to two arguments. forEach calls the callbackfn function one time for each element in the array.
   * @returns The current instance of Turbo to allow for method chaining.
   */
  forEach(callbackfn: (value: T, index: number) => void): Turbo<T> {
    if (!this.#fn) {
      this.#operations.push({ type: 'forEach', fn: callbackfn });
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
    if (this.#fn) {
      return this.#fn;
    }

    let head = '';
    let body = '';
    let foot = '';

    if (this.#operations.length > 0) {
      if (!this.#hasReduce) {
        head += 'const r = [];';
      } else {
        head += 'let r;';
      }

      body += 'for (let i = 0, e = l.length, last = e - 1; i < e; i++) {';
      body += 'let a = l[i];';

      for (let i = 0, e = this.#operations.length; i < e; i++) {
        const operation = this.#operations[i];
        const fn = (operation as any)?.fn;
        if (typeof fn === 'function') {
          head += `const ${operation.type}_${i} = ${fn.toString()};`;
        }

        if (operation.type === 'reduce') {
          head += `r = ${JSON.stringify(operation.initialValue)};`;
        } else if (operation.type === 'join') {
          head += 'r = "";';
        } else if (operation.type === 'find') {
          head += 'r = undefined;';
        } else if (operation.type === 'some') {
          head += 'r = false;';
        }

        if (operation.type === 'filter') {
          body += `if (!${operation.type}_${i}(a, i)) continue;`;
        } else if (operation.type === 'map') {
          body += `a = ${operation.type}_${i}(a, i);`;
        } else if (operation.type === 'reduce') {
          body += `r = ${operation.type}_${i}(r, a, i);`;
        } else if (operation.type === 'forEach') {
          body += `${operation.type}_${i}(a, i);`;
        } else if (operation.type === 'join') {
          body += `r += a + (i < last ? ${JSON.stringify(operation.separator)} : '');`;
        } else if (operation.type === 'find') {
          body += `if (${operation.type}_${i}(a, i)) return a;`;
        } else if (operation.type === 'some') {
          body += `if (${operation.type}_${i}(a, i)) return true;`;
        }
      }

      if (!this.#hasReduce) {
        body += 'r.push(a);';
      }

      foot += '}'; // end for
      foot += 'return r;';
    } else {
      foot += 'return l;';
    }

    this.#fn = new Function('l', 'context', head + body + foot) as ToArray<T>;
    this.#operations = [];
    return this.#fn;
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