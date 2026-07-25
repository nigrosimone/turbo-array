import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';

import turboDefault, { clearCache, turbo } from './index';

afterEach(() => {
  clearCache();
});

describe('filter', () => {
  it('keeps the elements matching the predicate', () => {
    const m = (item: number) => item % 2 === 0;
    const data = [1, 2, 3];

    expect(turbo<number>().filter(m).build()(data)).toEqual(data.filter(m));
  });

  it('works on strings', () => {
    const m = (item: string) => item.startsWith('b');
    const data = ['foo', 'bar', 'baz'];

    expect(turbo<string>().filter(m).build()(data)).toEqual(data.filter(m));
  });

  it('works on objects', () => {
    type Obj = { id: number };
    const m = (item: Obj) => item.id % 2 === 0;
    const data: Obj[] = [{ id: 1 }, { id: 2 }, { id: 3 }];

    expect(turbo<Obj>().filter(m).build()(data)).toEqual(data.filter(m));
  });

  it('reads the runtime context', () => {
    const context = { rnd: Math.random() };
    const m = (item: number) => item >= context.rnd;
    const data = [Math.random(), Math.random(), Math.random()];

    expect(turbo<number>().filter(m).build()(data, context)).toEqual(data.filter(m));
  });

  // Regression: the predicate used to receive the index of the *surviving*
  // elements as soon as the pipeline had more than one operation, so an
  // index-based predicate silently dropped everything.
  it('passes the source index to the predicate, alone or chained', () => {
    const p = (_item: number, index: number) => index > 1;
    const data = [10, 20, 30, 40];

    expect(turbo<number>().filter(p).build()(data)).toEqual(data.filter(p));
    expect(
      turbo<number>()
        .filter(p)
        .map((item) => item)
        .build()(data),
    ).toEqual(data.filter(p).map((item) => item));
  });

  // Each filter re-bases the index for the operations that come after it,
  // exactly like `arr.filter(a).filter(b).map(c)` does.
  it('re-bases the index once per filter stage', () => {
    const p1 = (_item: number, index: number) => index !== 0;
    const p2 = (_item: number, index: number) => index !== 1;
    const p3 = (_item: number, index: number) => index !== 2;
    const label = (item: number, index: number) => `${item}:${index}`;
    const data = [1, 2, 3, 4, 5, 6, 7];

    expect(turbo<number>().filter(p1).filter(p2).filter(p3).map(label).build()(data)).toEqual(data.filter(p1).filter(p2).filter(p3).map(label));
  });

  it('chains two filters', () => {
    const p1 = (item: number) => item > 1;
    const p2 = (item: number) => item < 5;
    const data = [1, 2, 3, 4, 5];

    expect(turbo<number>().filter(p1).filter(p2).build()(data)).toEqual(data.filter(p1).filter(p2));
  });

  it('returns an empty array when nothing matches', () => {
    expect(
      turbo<number>()
        .filter((item) => item > 100)
        .build()([1, 2, 3]),
    ).toEqual([]);
  });
});

describe('map', () => {
  it('maps numbers', () => {
    const m = (item: number): number => item + 1;
    const data = [1, 2, 3];

    expect(turbo<number>().map(m).build()(data)).toEqual(data.map(m));
  });

  it('maps objects', () => {
    type Obj = { id: number };
    const m = (item: Obj): Obj => ({ id: item.id + 1 });
    const data: Obj[] = [{ id: 1 }, { id: 2 }, { id: 3 }];

    expect(turbo<Obj>().map(m).build()(data)).toEqual(data.map(m));
  });

  it('passes the source index to the mapper', () => {
    const m = (item: number, index: number) => item * index;
    const data = [5, 6, 7];

    expect(turbo<number>().map(m).build()(data)).toEqual(data.map(m));
  });

  it('chains after a filter', () => {
    const p = (item: number) => item % 2 === 0;
    const m = (item: number, index: number) => `${item}@${index}`;
    const data = [1, 2, 3, 4, 5, 6];

    expect(turbo<number>().filter(p).map(m).build()(data)).toEqual(data.filter(p).map(m));
  });

  // Regression: `build()` used to declare the *mapped* type as its input, so a
  // type changing map made the pipeline impossible to call with its own source
  // array. `expectTypeOf` is checked by `npm run test:types`.
  it('keeps the source element type after a type changing map', () => {
    const lfn = turbo<number>()
      .map((item) => `#${item}`)
      .build();

    expectTypeOf(lfn).parameter(0).toEqualTypeOf<number[]>();
    expectTypeOf(lfn([1])).toEqualTypeOf<string[]>();
    expect(lfn([1, 2])).toEqual(['#1', '#2']);
  });

  it('keeps the source element type for every terminal operation', () => {
    const stringify = <R>(op: (pipeline: ReturnType<typeof base>) => R) => op(base());
    const base = () =>
      turbo<number, { tag: string }>()
        .filter((item) => item > 0)
        .map((item) => `#${item}`);

    const joined = stringify((p) => p.join('-').build());
    const reduced = stringify((p) => p.reduce((acc: number, item) => acc + item.length, 0).build());
    const found = stringify((p) => p.find((item) => item === '#1').build());
    const foundIndex = stringify((p) => p.findIndex((item) => item === '#1').build());
    const someOf = stringify((p) => p.some((item) => item === '#1').build());
    const everyOf = stringify((p) => p.every((item) => item === '#1').build());

    expectTypeOf(joined).parameter(0).toEqualTypeOf<number[]>();
    expectTypeOf(reduced).parameter(0).toEqualTypeOf<number[]>();
    expectTypeOf(found).parameter(0).toEqualTypeOf<number[]>();
    expectTypeOf(foundIndex).parameter(0).toEqualTypeOf<number[]>();
    expectTypeOf(someOf).parameter(0).toEqualTypeOf<number[]>();
    expectTypeOf(everyOf).parameter(0).toEqualTypeOf<number[]>();

    expectTypeOf(joined([1])).toEqualTypeOf<string>();
    expectTypeOf(reduced([1])).toEqualTypeOf<number>();
    expectTypeOf(found([1])).toEqualTypeOf<string | undefined>();
    expectTypeOf(foundIndex([1])).toEqualTypeOf<number>();
    expectTypeOf(someOf([1])).toEqualTypeOf<boolean>();
    expectTypeOf(everyOf([1])).toEqualTypeOf<boolean>();

    expect(joined([1, 2])).toBe('#1-#2');
    expect(reduced([1, 2])).toBe(4);
    expect(found([1, 2])).toBe('#1');
    expect(foundIndex([1, 2])).toBe(0);
    expect(someOf([1, 2])).toBe(true);
    expect(everyOf([1, 2])).toBe(false);
  });
});

describe('find', () => {
  it('returns the first match', () => {
    type Obj = { id: number };
    const m = (item: Obj) => item.id % 2 === 0;
    const f = (item: Obj) => item.id === 2;
    const data: Obj[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const lfn = turbo<Obj>().filter(m).find(f).build();

    expect(lfn(data)).toEqual({ id: 2 });
    expect(lfn(data)).toEqual(data.filter(m).find(f));
  });

  it('returns undefined when nothing matches', () => {
    const f = (item: number) => item === 99;
    const data = [1, 2, 3];

    expect(turbo<number>().find(f).build()(data)).toBe(data.find(f));
  });

  it('sees the mapped value', () => {
    const m = (item: number) => item * 10;
    const f = (item: number) => item > 15;
    const data = [1, 2, 3];

    expect(turbo<number>().map(m).find(f).build()(data)).toBe(data.map(m).find(f));
  });
});

describe('findIndex', () => {
  it('returns the index within the filtered array', () => {
    type Obj = { id: number };
    const m = (item: Obj) => item.id % 2 === 0;
    const f = (item: Obj) => item.id === 2;
    const data: Obj[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const lfn = turbo<Obj>().filter(m).findIndex(f).build();

    expect(lfn(data)).toBe(0);
    expect(lfn(data)).toBe(data.filter(m).findIndex(f));
  });

  it('returns -1 when nothing matches', () => {
    const f = (item: number) => item === 99;
    const data = [1, 2, 3];

    expect(turbo<number>().findIndex(f).build()(data)).toBe(data.findIndex(f));
  });
});

describe('some', () => {
  it('reads the runtime context', () => {
    type Obj = { id: number };
    const context = { t: 2 };
    const m = (item: Obj) => item.id % 2 === 0;
    const s = (item: Obj) => item.id === context.t;
    const data: Obj[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const lfn = turbo<Obj>().filter(m).some(s).build();

    expect(lfn(data, { t: 3 })).toBe(false);
    expect(lfn(data, context)).toBe(true);
    expect(lfn(data, context)).toBe(data.filter(m).some(s));
  });

  it('is false on an empty array', () => {
    const s = (item: number) => item > 0;

    expect(turbo<number>().some(s).build()([])).toBe([].some(s));
  });
});

describe('every', () => {
  it('matches the native behavior', () => {
    type Obj = { id: number };
    const a = (item: Obj) => item.id % 2 === 0;
    const data: Obj[] = [{ id: 2 }, { id: 4 }, { id: 6 }];
    const lfn = turbo<Obj>().every(a).build();

    expect(lfn([{ id: 2 }, { id: 4 }, { id: 6 }])).toBe(true);
    expect(lfn([{ id: 2 }, { id: 4 }, { id: 5 }])).toBe(false);
    expect(lfn(data)).toBe(data.every(a));
  });

  it('is true on an empty array', () => {
    const a = (item: number) => item > 0;

    expect(turbo<number>().every(a).build()([])).toBe([].every(a));
  });
});

describe('join', () => {
  it('joins with an explicit separator', () => {
    const data = [1, 2, 3];

    expect(turbo<number>().join(';').build()(data)).toBe(data.join(';'));
  });

  it('joins strings', () => {
    const data = ['1', '2', '3'];

    expect(turbo<string>().join(';').build()(data)).toBe(data.join(';'));
  });

  it('defaults the separator to a comma', () => {
    const data = ['1', '2', '3'];

    expect(turbo<string>().join().build()(data)).toBe(data.join());
  });

  it('handles empty and single element arrays', () => {
    const lfn = turbo<number>().join('-').build();

    expect(lfn([])).toBe([].join('-'));
    expect(lfn([7])).toBe([7].join('-'));
  });

  // Regression: `last` was derived from the source array length, so any element
  // removed by a filter left a dangling separator at the end of the string.
  it('does not emit a trailing separator after a filter', () => {
    const p = (item: number) => item > 2;
    const data = [1, 2, 3, 4];

    expect(turbo<number>().filter(p).join('-').build()(data)).toBe(data.filter(p).join('-'));
  });

  it('does not emit a trailing separator after map + filter', () => {
    const m = (item: number) => item * 2;
    const p = (item: number) => item > 4;
    const data = [1, 2, 3, 4];

    expect(turbo<number>().map(m).filter(p).join('|').build()(data)).toBe(data.map(m).filter(p).join('|'));
  });

  it('does not emit a trailing separator after two filters', () => {
    const p1 = (item: number) => item > 1;
    const p2 = (item: number) => item < 5;
    const data = [1, 2, 3, 4, 5];

    expect(turbo<number>().filter(p1).filter(p2).join('-').build()(data)).toBe(data.filter(p1).filter(p2).join('-'));
  });

  it('returns an empty string when every element is filtered out', () => {
    const p = (item: number) => item > 100;
    const data = [1, 2];

    expect(turbo<number>().filter(p).join('-').build()(data)).toBe(data.filter(p).join('-'));
  });

  // Regression: `result += item` rendered nullish elements as "null"/"undefined".
  it('renders null and undefined as an empty string', () => {
    const data = [1, null, 3, undefined];

    expect(turbo().join('-').build()(data)).toBe(data.join('-'));
  });

  it('stringifies objects the way Array#join does', () => {
    // `Array#join` uses ToString, which prefers `toString` over `valueOf`.
    const data = [{ toString: () => 'x', valueOf: () => 5 }];

    expect(turbo().join('-').build()(data)).toBe(data.join('-'));
  });

  it('escapes separators that need quoting', () => {
    const data = ['a', 'b'];

    expect(turbo<string>().join('"\n\\').build()(data)).toBe(data.join('"\n\\'));
  });
});

describe('reduce', () => {
  it('reduces to a number', () => {
    const m = (acc: number, item: number): number => acc + item;
    const data = [1, 2, 3];

    expect(turbo<number>().reduce<number>(m, 0).build()(data)).toBe(data.reduce(m, 0));
  });

  it('reduces to a string', () => {
    const m = (acc: string, item: number): string => acc + item;
    const data = [1, 2, 3];

    expect(turbo<number>().reduce(m, '').build()(data)).toBe(data.reduce(m, ''));
  });

  it('reduces to an array', () => {
    const m = (acc: number[], item: number): number[] => [...acc, item * 2];
    const data = [1, 2, 3];

    expect(turbo<number>().reduce<number[]>(m, []).build()(data)).toEqual(data.reduce(m, []));
  });

  it('reduces objects', () => {
    type Obj = { id: number };
    const m = (acc: string, item: Obj): string => item.id + acc;
    const data: Obj[] = [{ id: 1 }, { id: 2 }, { id: 3 }];

    expect(turbo<Obj>().reduce<string>(m, '').build()(data)).toBe(data.reduce(m, ''));
  });

  it('passes the index to the reducer', () => {
    const m = (acc: number, item: number, index: number): number => acc + item * index;
    const data = [1, 2, 3];

    expect(turbo<number>().reduce<number>(m, 0).build()(data)).toBe(data.reduce(m, 0));
  });

  // Regression: the initial value was inlined through `JSON.stringify`, which
  // turns NaN/Infinity into null, drops prototypes and throws on BigInt.
  it('preserves a NaN initial value', () => {
    const m = (acc: number, item: number) => acc + item;

    expect(turbo<number>().reduce<number>(m, NaN).build()([1, 2])).toBeNaN();
  });

  it('preserves an Infinity initial value', () => {
    const m = (acc: number, item: number) => Math.min(acc, item);

    expect(turbo<number>().reduce<number>(m, Infinity).build()([5, 3])).toBe(3);
  });

  it.each([
    ['null', null, 'null1'],
    ['undefined', undefined, 'undefined1'],
    ['false', false, 'false1'],
    ['true', true, 'true1'],
    ['zero', 0, '01'],
    ['negative zero', -0, '01'],
    ['a float', 1.5, '1.51'],
  ])('inlines a %s initial value', (_label, initialValue, expected) => {
    const m = (acc: unknown, item: number) => `${acc}${item}`;

    expect(turbo<number>().reduce<unknown>(m, initialValue).build()([1])).toBe(expected);
  });

  it('keeps the sign of a negative zero seed', () => {
    const m = (acc: number) => acc;

    expect(Object.is(turbo<number>().reduce<number>(m, -0).build()([1]), -0)).toBe(true);
  });

  it('preserves a Symbol initial value', () => {
    const seed = Symbol('seed');
    const m = (acc: symbol) => acc;

    expect(turbo<number>().reduce<symbol>(m, seed).build()([1])).toBe(seed);
  });

  it('preserves a BigInt initial value', () => {
    const m = (acc: bigint, item: number) => acc + BigInt(item);

    expect(turbo<number>().reduce<bigint>(m, 10n).build()([1, 2])).toBe(13n);
  });

  it('preserves a Set initial value and keeps it fresh per call', () => {
    const m = (acc: Set<number>, item: number) => acc.add(item);
    const lfn = turbo<number>().reduce<Set<number>>(m, new Set<number>()).build();

    expect([...lfn([1, 2])]).toEqual([1, 2]);
    expect([...lfn([3])]).toEqual([3]);
  });

  it('preserves a Map initial value and keeps it fresh per call', () => {
    const m = (acc: Map<number, number>, item: number) => acc.set(item, item);
    const lfn = turbo<number>().reduce<Map<number, number>>(m, new Map<number, number>()).build();

    expect([...lfn([1, 2])]).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect([...lfn([3])]).toEqual([[3, 3]]);
  });

  it('starts from a fresh empty array on every call', () => {
    const m = (acc: number[], item: number) => {
      acc.push(item);
      return acc;
    };
    const lfn = turbo<number>().reduce<number[]>(m, []).build();

    expect(lfn([1, 2])).toEqual([1, 2]);
    expect(lfn([3, 4])).toEqual([3, 4]);
  });

  it('starts from a fresh empty object on every call', () => {
    const m = (acc: Record<number, boolean>, item: number) => {
      acc[item] = true;
      return acc;
    };
    const lfn = turbo<number>().reduce<Record<number, boolean>>(m, {}).build();

    expect(lfn([1])).toEqual({ 1: true });
    expect(lfn([2])).toEqual({ 2: true });
  });

  it('starts from a fresh copy of a non-empty seed on every call', () => {
    const m = (acc: number[], item: number) => {
      acc.push(item);
      return acc;
    };
    const lfn = turbo<number>().reduce<number[]>(m, [0]).build();

    expect(lfn([1])).toEqual([0, 1]);
    expect(lfn([2])).toEqual([0, 2]);
  });

  it('shares a seed that cannot be cloned without losing its prototype', () => {
    class Acc {
      total = 0;
    }
    const m = (acc: Acc, item: number) => {
      acc.total += item;
      return acc;
    };
    const lfn = turbo<number>().reduce<Acc>(m, new Acc()).build();

    // The class instance is shared, so it keeps accumulating across calls...
    expect(lfn([1, 2]).total).toBe(3);
    expect(lfn([3]).total).toBe(6);
    // ...but it is still a real `Acc`, not a degraded plain object.
    expect(lfn([])).toBeInstanceOf(Acc);
  });

  it('shares a seed holding a function', () => {
    const seed = { hits: 0, tap: () => undefined };
    const m = (acc: typeof seed, item: number) => {
      acc.hits += item;
      return acc;
    };
    const lfn = turbo<number>().reduce<typeof seed>(m, seed).build();

    expect(lfn([1, 2]).hits).toBe(3);
    expect(lfn([1]).hits).toBe(4);
  });
});

describe('forEach', () => {
  it('runs the callback for every element', () => {
    type Obj = { id: number };
    const context: { arr: string[] } = { arr: [] };
    const f = (item: Obj, index: number) => context.arr.push(item.id + '-' + index);
    const data: Obj[] = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const lfn = turbo<Obj>().forEach(f).build();

    const turboContext: { arr: string[] } = { arr: [] };
    lfn(data, turboContext);
    data.forEach(f);

    expect(turboContext).toEqual(context);
  });

  // Regression: forEach used to terminate the pipeline, so anything chained
  // after it was silently dropped and the built function returned undefined.
  it('is a pass-through stage', () => {
    const data = [1, 2, 3];
    const lfn = turbo<number>()
      .forEach(() => undefined)
      .map((item) => item * 2)
      .build();

    expect(lfn(data)).toEqual([2, 4, 6]);
  });

  it('returns a copy of the array when it is the last operation', () => {
    const data = [1, 2, 3];
    const lfn = turbo<number>()
      .forEach(() => undefined)
      .build();

    expect(lfn(data)).toEqual(data);
    expect(lfn(data)).not.toBe(data);
  });

  it('receives the re-based index after a filter', () => {
    const context: { seen: Array<[number, number]> } = { seen: [] };
    const f = (item: number, index: number) => {
      context.seen.push([item, index]);
    };
    const data = [1, 2, 3, 4];
    turbo<number>()
      .filter((item) => item % 2 === 0)
      .forEach(f)
      .build()(data, context);

    const expected: Array<[number, number]> = [];
    data.filter((item) => item % 2 === 0).forEach((item, index) => expected.push([item, index]));

    expect(context.seen).toEqual(expected);
  });

  it('keeps flowing into a filter', () => {
    const data = [1, 2, 3, 4];
    const lfn = turbo<number>()
      .forEach(() => undefined)
      .filter((item) => item % 2 === 0)
      .build();

    expect(lfn(data)).toEqual([2, 4]);
  });
});

describe('pipelines', () => {
  it('composes filter, map, forEach and reduce', () => {
    expect(
      turbo<number>()
        .filter((item) => item % 2 === 0)
        .map((item) => item + 1)
        .forEach(() => undefined)
        .reduce((acc, item) => acc + item, 0)
        .build()([1, 2, 3, 4]),
    ).toBe(8);

    expect(
      turbo<number>()
        .map((item) => item + 1)
        .filter((item) => item % 2 === 0)
        .forEach(() => undefined)
        .reduce((acc, item) => acc + item, 0)
        .build()([1, 2, 3, 4]),
    ).toBe(6);

    expect(
      turbo<number>()
        .map((item) => item + 1)
        .reduce((acc, item) => acc + item, 0)
        .build()([1, 2, 3, 4]),
    ).toBe(14);

    expect(
      turbo<number>()
        .filter((item) => item % 2 === 0)
        .reduce((acc, item) => acc + item, 0)
        .build()([1, 2, 3, 4]),
    ).toBe(6);
  });

  it('matches the native chain on a longer pipeline', () => {
    const p = (item: number, index: number) => item > 1 && index !== 3;
    const m = (item: number, index: number) => item * 10 + index;
    const r = (acc: number, item: number, index: number) => acc + item - index;
    const data = [0, 1, 2, 3, 4, 5, 6];

    expect(turbo<number>().filter(p).map(m).reduce(r, 100).build()(data)).toBe(data.filter(p).map(m).reduce(r, 100));
  });
});

describe('build', () => {
  it('returns the array untouched when there is no operation', () => {
    const lfn = turbo<number>().build();

    expect(lfn([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it('rejects a non-array input', () => {
    const lfn = turbo<number>().build();

    expect(() => lfn(undefined as never)).toThrow('Invalid parameters');
    expect(() =>
      turbo<number>()
        .map((item) => item)
        .build()('nope' as never),
    ).toThrow('Invalid parameters');
  });

  it('returns the very same function on every call', () => {
    const l = turbo<number>();

    expect(l.build()).toBe(l.build());
  });

  it('ignores operations added after the build', () => {
    const l = turbo<number>().filter((item) => item > 1);
    const lfn = l.build();

    l.map((item) => item * 1000);
    l.filter((item) => item > 1000);
    l.forEach(() => undefined);

    expect(l.build()).toBe(lfn);
    expect(lfn([1, 2, 3])).toEqual([2, 3]);
  });

  it('ignores terminal operations added after the build', () => {
    const l = turbo<number>().filter((item) => item > 1);
    const lfn = l.build();

    expect(l.some(() => false).build()).toBe(lfn);
    expect(l.every(() => false).build()).toBe(lfn);
    expect(l.find(() => false).build()).toBe(lfn);
    expect(l.findIndex(() => false).build()).toBe(lfn);
    expect(l.reduce(() => 0, 0).build()).toBe(lfn);
    expect(l.join('-').build()).toBe(lfn);
  });

  // Regression: a native function used to produce an opaque
  // "SyntaxError: Unexpected identifier 'code'".
  it('rejects native and bound functions with an actionable message', () => {
    expect(() => turbo<number>().map(Math.round).build()).toThrow(/native or bound function/);
    expect(() =>
      turbo<number>()
        .filter(((item: number) => item > 1).bind(null))
        .build(),
    ).toThrow(/native or bound function/);
  });

  it('rejects a function whose source is not a standalone expression', () => {
    const holder = {
      isEven(item: number) {
        return item % 2 === 0;
      },
    };

    expect(() => turbo<number>().filter(holder.isEven).build()).toThrow(/could not be compiled/);
  });
});

describe('turbo', () => {
  it('returns a new instance without a cache key', () => {
    expect(turbo()).not.toBe(turbo());
  });

  it('reuses the instance stored under a cache key', () => {
    const m = (item: number) => item % 2 === 0;
    const data = [1, 2, 3];
    const lfn = turbo<number>('cache').filter(m).build();

    for (let i = 0; i < 3; i++) {
      expect(lfn(data)).toEqual(data.filter(m));
    }

    expect(turbo<number>('cache')).toBe(turbo<number>('cache'));
    expect(turbo<number>('cache').build()).toBe(lfn);
  });

  it('is also available as a default export', () => {
    expect(turboDefault).toBe(turbo);
  });
});

describe('clearCache', () => {
  it('evicts a single key', () => {
    const first = turbo('key-a');

    expect(clearCache('key-a')).toBe(true);
    expect(clearCache('key-a')).toBe(false);
    expect(turbo('key-a')).not.toBe(first);
  });

  it('evicts everything', () => {
    const first = turbo('key-b');
    const second = turbo('key-c');

    expect(clearCache()).toBe(true);
    expect(clearCache()).toBe(false);
    expect(turbo('key-b')).not.toBe(first);
    expect(turbo('key-c')).not.toBe(second);
  });
});
