export type Operation<T = any, U = any> =
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
export type Pipeline<S = any, R = S[], C extends Record<string, any> = Record<string, any>> = (array: S[], context?: C) => R;

export type LastOperation<S = any, R = S, C extends Record<string, any> = Record<string, any>> = { build: () => Pipeline<S, R, C> };

export type ToArray<S = any, R = S, C extends Record<string, any> = Record<string, any>> = Pipeline<S, R[], C>;

/** Message shared by both execution paths, so the two agree on the guard. */
export const INVALID_PARAMETERS = 'Invalid parameters';

/**
 * Whether any operation after `position` consumes an element index. `join` is
 * the only operation that does not, so a filter followed exclusively by joins
 * does not need to open a new index stage.
 *
 * Both execution paths use this, so the index a callback receives is identical
 * whether the pipeline was compiled or not.
 */
export const needsIndexAfter = (operations: readonly Operation<any>[], position: number): boolean => {
  for (let k = position + 1, n = operations.length; k < n; k++) {
    if (operations[k].type !== 'join') {
      return true;
    }
  }
  return false;
};
