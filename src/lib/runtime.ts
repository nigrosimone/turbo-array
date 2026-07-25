import { seedFactory } from './seed';
import { INVALID_PARAMETERS, needsIndexAfter, type Operation, type ToArray } from './types';

/**
 * A pipeline step, pre-resolved so the per element loop only has to switch on a
 * small integer instead of inspecting the operation objects.
 */
type Step = {
  /** Index into the operation list, kept for the index staging below. */
  readonly kind: number;
  readonly fn: (...args: any[]) => any;
  /**
   * For a filter: which stage counter the surviving elements are numbered with,
   * or `-1` when nothing downstream consumes an index.
   */
  readonly counter: number;
};

const FILTER = 0;
const MAP = 1;
const FOR_EACH = 2;
const FIND = 3;
const FIND_INDEX = 4;
const SOME = 5;
const EVERY = 6;
const REDUCE = 7;
const JOIN = 8;

const KINDS: Readonly<Record<Operation['type'], number>> = {
  filter: FILTER,
  map: MAP,
  forEach: FOR_EACH,
  find: FIND,
  findIndex: FIND_INDEX,
  some: SOME,
  every: EVERY,
  reduce: REDUCE,
  join: JOIN,
};

/** `Array.prototype.join` renders nullish elements as an empty string. */
const asJoinable = (value: unknown): string => (value === null || value === undefined ? '' : `${value}`);

/**
 * Build a pipeline without generating any code.
 *
 * The operations are walked per element instead of being compiled into a
 * straight line loop, which is measurably slower than the compiled path but has
 * none of its constraints: callbacks may close over their surrounding scope, and
 * nothing needs `new Function`, so it also runs under a Content Security Policy
 * that forbids `unsafe-eval`.
 *
 * The observable behavior is identical to the compiled path, including the
 * index every callback receives and the way `reduce` seeds are refreshed.
 */
export const createRuntimePipeline = <S = any, R = any, C extends Record<string, any> = Record<string, any>>(
  operations: readonly Operation<any>[],
  hasReduce: boolean,
  hasFilter: boolean,
): ToArray<S, R, C> => {
  if (operations.length === 0) {
    return ((array: any[]) => {
      if (!Array.isArray(array)) {
        throw new Error(INVALID_PARAMETERS);
      }
      return array;
    }) as ToArray<S, R, C>;
  }

  // Pre-resolve the plan once, at build time.
  const steps: Step[] = [];
  let stageCount = 0;
  for (let k = 0; k < operations.length; k++) {
    const operation = operations[k];
    const kind = KINDS[operation.type];
    let counter = -1;
    if (kind === FILTER && needsIndexAfter(operations, k)) {
      counter = stageCount++;
    }
    steps.push({ kind, fn: (operation as { fn?: (...args: any[]) => any }).fn ?? asJoinable, counter });
  }

  const terminal = steps[steps.length - 1];
  const reduceOperation = operations.find((operation) => operation.type === 'reduce');
  const makeSeed = reduceOperation ? seedFactory(reduceOperation.initialValue) : undefined;
  const joinOperation = operations.find((operation) => operation.type === 'join');
  const separator = joinOperation ? joinOperation.separator : '';

  const stepCount = steps.length;
  const counters = new Array<number>(stageCount);

  return ((array: any[], context?: C) => {
    if (!Array.isArray(array)) {
      throw new Error(INVALID_PARAMETERS);
    }
    // `context` is what the compiled path exposes to the callbacks; here they
    // close over it themselves, so it is only referenced to keep the signature.
    void context;

    for (let c = 0; c < stageCount; c++) {
      counters[c] = 0;
    }

    const length = array.length;
    const collected: any[] = hasReduce ? (undefined as never) : hasFilter ? [] : new Array(length);

    let accumulator: any;
    switch (terminal.kind) {
      case REDUCE:
        accumulator = makeSeed!();
        break;
      case JOIN:
        accumulator = '';
        break;
      case FIND_INDEX:
        accumulator = -1;
        break;
      case SOME:
        accumulator = false;
        break;
      case EVERY:
        accumulator = true;
        break;
      default:
        accumulator = undefined;
    }
    let joined = false;

    for (let i = 0; i < length; i++) {
      let item = array[i];
      let index = i;
      let dropped = false;

      for (let s = 0; s < stepCount; s++) {
        const step = steps[s];
        switch (step.kind) {
          case FILTER:
            if (!step.fn(item, index)) {
              dropped = true;
            } else if (step.counter !== -1) {
              index = counters[step.counter]++;
            }
            break;
          case MAP:
            item = step.fn(item, index);
            break;
          case FOR_EACH:
            step.fn(item, index);
            break;
          case REDUCE:
            accumulator = step.fn(accumulator, item, index);
            break;
          case JOIN:
            if (joined) {
              accumulator += separator;
            } else {
              joined = true;
            }
            accumulator += asJoinable(item);
            break;
          case FIND:
            if (step.fn(item, index)) {
              return item;
            }
            break;
          case FIND_INDEX:
            if (step.fn(item, index)) {
              return index;
            }
            break;
          case SOME:
            if (step.fn(item, index)) {
              return true;
            }
            break;
          default:
            if (!step.fn(item, index)) {
              return false;
            }
        }
        if (dropped) {
          break;
        }
      }

      if (dropped) {
        continue;
      }
      if (!hasReduce) {
        if (hasFilter) {
          collected.push(item);
        } else {
          collected[index] = item;
        }
      }
    }

    return hasReduce ? accumulator : collected;
  }) as ToArray<S, R, C>;
};
