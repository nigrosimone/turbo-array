import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearCache, turbo } from './index';

afterEach(() => {
  clearCache();
  vi.unstubAllGlobals();
});

type Factory = () => ReturnType<typeof turbo<any, any>>;

/**
 * Every scenario is run three ways — compiled, runtime, and the equivalent
 * vanilla chain — and all three have to agree. That is what makes the codegen
 * free path safe to fall back to: it is not a different implementation of the
 * same idea, it is the same observable behavior.
 */
const scenarios: Array<{
  readonly name: string;
  readonly data: readonly any[];
  readonly run: (make: Factory) => unknown;
  readonly native: (data: readonly any[]) => unknown;
}> = [
  {
    name: 'no operation',
    data: [1, 2, 3],
    run: (make) => make().build()([1, 2, 3]),
    native: (data) => [...data],
  },
  {
    name: 'filter',
    data: [1, 2, 3, 4, 5],
    run: (make) =>
      make()
        .filter((n: number) => n % 2 === 0)
        .build()([1, 2, 3, 4, 5]),
    native: (data) => data.filter((n) => n % 2 === 0),
  },
  {
    name: 'filter by index',
    data: [10, 20, 30, 40],
    run: (make) =>
      make()
        .filter((_n: number, i: number) => i > 1)
        .build()([10, 20, 30, 40]),
    native: (data) => data.filter((_n, i) => i > 1),
  },
  {
    name: 'map',
    data: [1, 2, 3],
    run: (make) =>
      make()
        .map((n: number) => n * 3)
        .build()([1, 2, 3]),
    native: (data) => data.map((n) => n * 3),
  },
  {
    name: 'map by index',
    data: [5, 6, 7],
    run: (make) =>
      make()
        .map((n: number, i: number) => n * i)
        .build()([5, 6, 7]),
    native: (data) => data.map((n, i) => n * i),
  },
  {
    name: 'map changing type',
    data: [1, 2, 3],
    run: (make) =>
      make()
        .map((n: number) => `#${n}`)
        .build()([1, 2, 3]),
    native: (data) => data.map((n) => `#${n}`),
  },
  {
    name: 'filter then map, index re-based',
    data: [1, 2, 3, 4, 5, 6],
    run: (make) =>
      make()
        .filter((n: number) => n % 2 === 0)
        .map((n: number, i: number) => `${n}@${i}`)
        .build()([1, 2, 3, 4, 5, 6]),
    native: (data) => data.filter((n) => n % 2 === 0).map((n, i) => `${n}@${i}`),
  },
  {
    name: 'three filters, index re-based at every stage',
    data: [1, 2, 3, 4, 5, 6, 7],
    run: (make) =>
      make()
        .filter((_n: number, i: number) => i !== 0)
        .filter((_n: number, i: number) => i !== 1)
        .filter((_n: number, i: number) => i !== 2)
        .map((n: number, i: number) => `${n}:${i}`)
        .build()([1, 2, 3, 4, 5, 6, 7]),
    native: (data) =>
      data
        .filter((_n, i) => i !== 0)
        .filter((_n, i) => i !== 1)
        .filter((_n, i) => i !== 2)
        .map((n, i) => `${n}:${i}`),
  },
  {
    name: 'map then filter',
    data: [1, 2, 3, 4],
    run: (make) =>
      make()
        .map((n: number) => n * 2)
        .filter((n: number) => n > 4)
        .build()([1, 2, 3, 4]),
    native: (data) => data.map((n) => n * 2).filter((n) => n > 4),
  },
  {
    name: 'reduce',
    data: [1, 2, 3, 4],
    run: (make) =>
      make()
        .reduce((acc: number, n: number) => acc + n, 0)
        .build()([1, 2, 3, 4]),
    native: (data) => data.reduce((acc, n) => acc + n, 0),
  },
  {
    name: 'reduce using the index',
    data: [1, 2, 3],
    run: (make) =>
      make()
        .reduce((acc: number, n: number, i: number) => acc + n * i, 0)
        .build()([1, 2, 3]),
    native: (data) => data.reduce((acc, n, i) => acc + n * i, 0),
  },
  {
    name: 'filter, map, reduce',
    data: [1, 2, 3, 4, 5, 6],
    run: (make) =>
      make()
        .filter((n: number) => n % 2 === 0)
        .map((n: number) => n + 1)
        .reduce((acc: number, n: number) => acc + n, 0)
        .build()([1, 2, 3, 4, 5, 6]),
    native: (data) =>
      data
        .filter((n) => n % 2 === 0)
        .map((n) => n + 1)
        .reduce((acc, n) => acc + n, 0),
  },
  {
    name: 'reduce into an array',
    data: [1, 2, 3],
    run: (make) =>
      make()
        .reduce((acc: number[], n: number) => [...acc, n * 2], [])
        .build()([1, 2, 3]),
    native: (data) => data.reduce<number[]>((acc, n) => [...acc, n * 2], []),
  },
  {
    name: 'join',
    data: [1, 2, 3],
    run: (make) => make().join(';').build()([1, 2, 3]),
    native: (data) => data.join(';'),
  },
  {
    name: 'join with the default separator',
    data: [1, 2, 3],
    run: (make) => make().join().build()([1, 2, 3]),
    native: (data) => data.join(),
  },
  {
    name: 'filter then join',
    data: [1, 2, 3, 4],
    run: (make) =>
      make()
        .filter((n: number) => n > 2)
        .join('-')
        .build()([1, 2, 3, 4]),
    native: (data) => data.filter((n) => n > 2).join('-'),
  },
  {
    name: 'join with nullish elements',
    data: [1, null, 3, undefined],
    run: (make) => make().join('-').build()([1, null, 3, undefined]),
    native: (data) => data.join('-'),
  },
  {
    name: 'join on an empty array',
    data: [],
    run: (make) => make().join('-').build()([]),
    native: (data) => data.join('-'),
  },
  {
    name: 'find',
    data: [1, 2, 3, 4],
    run: (make) =>
      make()
        .find((n: number) => n > 2)
        .build()([1, 2, 3, 4]),
    native: (data) => data.find((n) => n > 2),
  },
  {
    name: 'find with no match',
    data: [1, 2],
    run: (make) =>
      make()
        .find((n: number) => n > 99)
        .build()([1, 2]),
    native: (data) => data.find((n) => n > 99),
  },
  {
    name: 'filter then find',
    data: [1, 2, 3, 4],
    run: (make) =>
      make()
        .filter((n: number) => n % 2 === 0)
        .find((n: number) => n === 4)
        .build()([1, 2, 3, 4]),
    native: (data) => data.filter((n) => n % 2 === 0).find((n) => n === 4),
  },
  {
    name: 'findIndex within the filtered sequence',
    data: [1, 2, 3, 4],
    run: (make) =>
      make()
        .filter((n: number) => n % 2 === 0)
        .findIndex((n: number) => n === 4)
        .build()([1, 2, 3, 4]),
    native: (data) => data.filter((n) => n % 2 === 0).findIndex((n) => n === 4),
  },
  {
    name: 'findIndex with no match',
    data: [1, 2],
    run: (make) =>
      make()
        .findIndex((n: number) => n > 99)
        .build()([1, 2]),
    native: (data) => data.findIndex((n) => n > 99),
  },
  {
    name: 'some',
    data: [1, 2, 3],
    run: (make) =>
      make()
        .some((n: number) => n === 2)
        .build()([1, 2, 3]),
    native: (data) => data.some((n) => n === 2),
  },
  {
    name: 'some on an empty array',
    data: [],
    run: (make) =>
      make()
        .some((n: number) => n === 2)
        .build()([]),
    native: (data) => data.some((n) => n === 2),
  },
  {
    name: 'every',
    data: [2, 4, 6],
    run: (make) =>
      make()
        .every((n: number) => n % 2 === 0)
        .build()([2, 4, 6]),
    native: (data) => data.every((n) => n % 2 === 0),
  },
  {
    name: 'every failing',
    data: [2, 4, 5],
    run: (make) =>
      make()
        .every((n: number) => n % 2 === 0)
        .build()([2, 4, 5]),
    native: (data) => data.every((n) => n % 2 === 0),
  },
  {
    name: 'every on an empty array',
    data: [],
    run: (make) =>
      make()
        .every((n: number) => n % 2 === 0)
        .build()([]),
    native: (data) => data.every((n) => n % 2 === 0),
  },
  {
    name: 'forEach as a pass through stage',
    data: [1, 2, 3],
    run: (make) =>
      make()
        .forEach(() => undefined)
        .map((n: number) => n * 2)
        .build()([1, 2, 3]),
    native: (data) => data.map((n) => n * 2),
  },
  {
    name: 'forEach as the last operation',
    data: [1, 2, 3],
    run: (make) =>
      make()
        .forEach(() => undefined)
        .build()([1, 2, 3]),
    native: (data) => [...data],
  },
  {
    name: 'filter, forEach, reduce',
    data: [1, 2, 3, 4],
    run: (make) =>
      make()
        .filter((n: number) => n % 2 === 0)
        .forEach(() => undefined)
        .reduce((acc: number, n: number) => acc + n, 0)
        .build()([1, 2, 3, 4]),
    native: (data) => data.filter((n) => n % 2 === 0).reduce((acc, n) => acc + n, 0),
  },
  {
    name: 'everything filtered out',
    data: [1, 2, 3],
    run: (make) =>
      make()
        .filter((n: number) => n > 99)
        .map((n: number) => n)
        .build()([1, 2, 3]),
    native: (data) => data.filter((n) => n > 99).map((n) => n),
  },
  {
    name: 'empty input',
    data: [],
    run: (make) =>
      make()
        .filter((n: number) => n > 0)
        .map((n: number) => n * 2)
        .build()([]),
    native: (data) => data.filter((n) => n > 0).map((n) => n * 2),
  },
];

describe('the compiled and the runtime path agree with each other and with native', () => {
  it.each(scenarios.map((s) => [s.name, s] as const))('%s', (_name, scenario) => {
    const compiled = scenario.run(() => turbo({ compile: true }));
    const runtime = scenario.run(() => turbo({ compile: false }));
    const expected = scenario.native(scenario.data);

    expect(compiled).toEqual(expected);
    expect(runtime).toEqual(expected);
  });
});

describe('the runtime path refreshes reduce seeds like the compiled one', () => {
  it.each([
    ['an empty array', [] as number[], [1, 2], [1, 2]],
    ['a non empty array', [0], [1], [0, 1]],
  ])('%s stays fresh across calls', (_label, seed, input, expected) => {
    for (const compile of [true, false]) {
      const lfn = turbo<number>({ compile })
        .reduce<number[]>((acc, n) => {
          acc.push(n);
          return acc;
        }, seed)
        .build();

      expect(lfn(input), `compile: ${compile}`).toEqual(expected);
      expect(lfn(input), `compile: ${compile} again`).toEqual(expected);
    }
  });

  it('keeps an empty object seed fresh on both paths', () => {
    for (const compile of [true, false]) {
      const lfn = turbo<number>({ compile })
        .reduce<Record<number, boolean>>((acc, n) => {
          acc[n] = true;
          return acc;
        }, {})
        .build();

      expect(lfn([1]), `compile: ${compile}`).toEqual({ 1: true });
      expect(lfn([2]), `compile: ${compile} again`).toEqual({ 2: true });
    }
  });

  it('keeps a Map seed fresh and typed on both paths', () => {
    for (const compile of [true, false]) {
      const lfn = turbo<number>({ compile })
        .reduce<Map<number, number>>((acc, n) => acc.set(n, n), new Map<number, number>())
        .build();

      expect([...lfn([1, 2])], `compile: ${compile}`).toEqual([
        [1, 1],
        [2, 2],
      ]);
      expect([...lfn([3])], `compile: ${compile} again`).toEqual([[3, 3]]);
    }
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['a bigint', 10n],
    ['null', null],
    ['undefined', undefined],
  ])('preserves a %s seed on both paths', (_label, seed) => {
    for (const compile of [true, false]) {
      const lfn = turbo<number>({ compile })
        .reduce<unknown>((acc) => acc, seed)
        .build();

      expect(lfn([1]), `compile: ${compile}`).toEqual(seed);
    }
  });
});

describe('the runtime path rejects a non array like the compiled one', () => {
  it.each([true, false])('compile: %s', (compile) => {
    expect(() => turbo<number>({ compile }).build()(undefined as never)).toThrow('Invalid parameters');
    expect(() =>
      turbo<number>({ compile })
        .map((n) => n)
        .build()('nope' as never),
    ).toThrow('Invalid parameters');
  });
});

describe('closures', () => {
  const threshold = 2;

  it('work on the runtime path', () => {
    const lfn = turbo<number>({ compile: false })
      .filter((n) => n > threshold)
      .map((n) => n * threshold)
      .build();

    expect(lfn([1, 2, 3, 4])).toEqual([6, 8]);
  });

  // Regression: this used to surface as a bare "threshold is not defined" from
  // inside a generated function, with no hint about what to do.
  it('explain themselves on the compiled path', () => {
    const lfn = turbo<number>()
      .filter((n) => n > threshold)
      .build();

    expect(() => lfn([1, 2, 3])).toThrow(TypeError);
    expect(() => lfn([1, 2, 3])).toThrow(/reads "threshold" from the scope it was written in/);
    expect(() => lfn([1, 2, 3])).toThrow(/turbo\(\{ compile: false \}\)/);
  });

  it('keep the original ReferenceError as the cause', () => {
    const lfn = turbo<number>()
      .filter((n) => n > threshold)
      .build();

    try {
      lfn([1]);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).cause).toBeInstanceOf(ReferenceError);
      expect(((error as Error).cause as Error).message).toBe('threshold is not defined');
    }
  });

  it('leave unrelated errors untouched', () => {
    // Constructed inline on purpose: a `throw someLocal` would itself be a lost
    // closure, which is the very thing being distinguished here.
    const lfn = turbo<number>()
      .map(() => {
        throw new RangeError('boom');
      })
      .build();

    expect(() => lfn([1])).toThrow(RangeError);
    expect(() => lfn([1])).toThrow('boom');
  });

  it('leave a ReferenceError that is not about a missing binding untouched', () => {
    const lfn = turbo<number>()
      .map(() => {
        throw new ReferenceError('something else entirely');
      })
      .build();

    expect(() => lfn([1])).toThrow(ReferenceError);
    expect(() => lfn([1])).toThrow('something else entirely');
  });
});

describe('when code generation is unavailable', () => {
  /** Stands in for a Content Security Policy that forbids `unsafe-eval`. */
  const forbidNewFunction = () => {
    vi.stubGlobal('Function', function Blocked() {
      throw new EvalError('call to Function() blocked by CSP');
    });
  };

  it('falls back to the runtime path by default', () => {
    forbidNewFunction();
    const lfn = turbo<number>()
      .filter((n) => n % 2 === 0)
      .map((n) => n * 2)
      .build();
    vi.unstubAllGlobals();

    expect(lfn([1, 2, 3, 4])).toEqual([4, 8]);
  });

  it('throws when the compiled path was required', () => {
    forbidNewFunction();
    let thrown: unknown;
    try {
      turbo<number>({ compile: true })
        .filter((n) => n % 2 === 0)
        .build();
    } catch (error) {
      thrown = error;
    }
    vi.unstubAllGlobals();

    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toMatch(/forbids the runtime fallback/);
  });

  it('still reports a callback that can never be inlined', () => {
    // A shorthand method is a syntax error wherever it is spliced in, so it is a
    // mistake to report rather than something to fall back around.
    const holder = {
      isEven(n: number) {
        return n % 2 === 0;
      },
    };

    expect(() => turbo<number>().filter(holder.isEven).build()).toThrow(/could not be compiled/);
  });
});

describe('the built function still shows what it compiled to', () => {
  it('reports the generated source, not the guard around it', () => {
    const source = turbo<number>()
      .filter((n) => n % 2 === 0)
      .map((n) => n * 2)
      .build()
      .toString();

    expect(source).toContain('const filter_0');
    expect(source).toContain('const map_1');
    expect(source).toContain('for (;');
    expect(source).not.toContain('explain(');
  });

  it('reports the runtime pipeline when nothing was compiled', () => {
    const source = turbo<number>({ compile: false })
      .filter((n) => n % 2 === 0)
      .build()
      .toString();

    expect(source).not.toContain('const filter_0');
  });
});

describe('turbo options', () => {
  it('accepts a cache key as a string, as before', () => {
    const first = turbo<number>('legacy');

    expect(turbo<number>('legacy')).toBe(first);
  });

  it('accepts a cache key in the options object', () => {
    const first = turbo<number>({ cacheKey: 'modern' });

    expect(turbo<number>({ cacheKey: 'modern' })).toBe(first);
    expect(clearCache('modern')).toBe(true);
  });

  it('keeps the compile setting of the cached instance', () => {
    const threshold = 3;
    const cached = turbo<number>({ cacheKey: 'runtime-cached', compile: false });
    const lfn = cached.filter((n) => n > threshold).build();

    expect(lfn([1, 2, 3, 4, 5])).toEqual([4, 5]);
    expect(turbo<number>({ cacheKey: 'runtime-cached' }).build()).toBe(lfn);
  });

  it('returns a new instance without a cache key', () => {
    expect(turbo({ compile: false })).not.toBe(turbo({ compile: false }));
  });
});
