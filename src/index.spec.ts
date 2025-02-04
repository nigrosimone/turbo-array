import test from 'ava';

import { turbo } from './';

test('filter: cache', (t) => {
  const m = (item: number) => item % 2 === 0;
  const data: Array<number> = [1, 2, 3];
  const lfn = turbo<number>('cache')
    .filter(m)
    .build();

  for (let i = 0; i < 3; i++) {
    t.deepEqual(lfn(data), data.filter(m));
  }
});


test('filter: number', (t) => {
  const m = (item: number) => item % 2 === 0;
  const data: Array<number> = [1, 2, 3];
  const lfn = turbo<number>()
    .filter(m)
    .build();

  t.deepEqual(lfn(data), data.filter(m));
});

test('filter: context', (t) => {
  const context = { rnd: Math.random() };
  const m = (item: number) => item >= context.rnd;
  const data: Array<number> = [Math.random(), Math.random(), Math.random()];
  const lfn = turbo<number>()
    .filter(m)
    .build();

  t.deepEqual(lfn(data, context), data.filter(m));
});

test('filter: string', (t) => {
  const m = (item: string) => item.startsWith('b');
  const data: Array<string> = ['foo', 'bar', 'baz'];
  const lfn = turbo<string>()
    .filter(m)
    .build();

  t.deepEqual(lfn(data), data.filter(m));
});

test('filter: obj', (t) => {
  type Obj = { id: number };
  const m = (item: Obj) => item.id % 2 === 0;
  const data: Array<Obj> = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const lfn = turbo<Obj>()
    .filter(m)
    .build();

  t.deepEqual(lfn(data), data.filter(m));
});

test('find: obj', (t) => {
  type Obj = { id: number };
  const m = (item: Obj) => item.id % 2 === 0;
  const f = (item: Obj) => item.id === 2;
  const data: Array<Obj> = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const lfn = turbo<Obj>()
    .filter(m)
    .find(f)
    .build();

  t.deepEqual(lfn(data), { id: 2 });
  t.deepEqual(lfn(data), data.filter(m).find(f));
});

test('findIndex: obj', (t) => {
  type Obj = { id: number };
  const m = (item: Obj) => item.id % 2 === 0;
  const f = (item: Obj) => item.id === 2;
  const data: Array<Obj> = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const lfn = turbo<Obj>()
    .filter(m)
    .findIndex(f)
    .build();

  t.deepEqual(lfn(data), 0);
  t.deepEqual(lfn(data), data.filter(m).findIndex(f));
});

test('some: obj', (t) => {
  const context = { t: 2 };
  type Obj = { id: number };
  const m = (item: Obj) => item.id % 2 === 0;
  const s = (item: Obj) => item.id === context.t;
  const data: Array<Obj> = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const lfn = turbo<Obj>()
    .filter(m)
    .some(s)
    .build();

  t.deepEqual(lfn(data, { t: 3 }), false);
  t.deepEqual(lfn(data, context), true);
  t.deepEqual(lfn(data, context), data.filter(m).some(s));
});

test('every: obj', (t) => {
  type Obj = { id: number };
  const a = (item: Obj) => item.id % 2 === 0;

  const data: Array<Obj> = [{ id: 2 }, { id: 4 }, { id: 6 }];
  const lfn = turbo<Obj>()
    .every(a)
    .build();

  t.deepEqual(lfn([{ id: 2 }, { id: 4 }, { id: 6 }]), true);
  t.deepEqual(lfn([{ id: 2 }, { id: 4 }, { id: 5 }]), false);
  t.deepEqual(lfn(data), data.every(a));
  t.deepEqual(lfn([]), [].every(a));
});

test('join: number', (t) => {
  const data: Array<number> = [1, 2, 3];
  const lfn = turbo<number>().join(';').build();

  t.is(lfn(data), data.join(';'));
});

test('join: string ;', (t) => {
  const data: Array<string> = ['1', '2', '3'];
  const lfn = turbo<string>().join(';').build();

  t.is(lfn(data), data.join(';'));
});

test('join: string', (t) => {
  const data: Array<string> = ['1', '2', '3'];
  const lfn = turbo<string>().join().build();

  t.is(lfn(data), data.join());
});

test('map: number', (t) => {
  const m = (item: number): number => item + 1;
  const data: Array<number> = [1, 2, 3];
  const lfn = turbo<number>()
    .map(m)
    .build();

  t.deepEqual(lfn(data), data.map(m));
});

test('map: obj', (t) => {
  type Obj = { id: number };
  const m = (item: Obj): Obj => ({ id: item.id + 1 });
  const data: Array<Obj> = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const lfn = turbo<Obj>()
    .map(m)
    .build();

  t.deepEqual(lfn(data), data.map(m));
});

test('reduce: number', (t) => {
  const m = (acc: number, item: number): number => acc + item;
  const data: Array<number> = [1, 2, 3];
  const lfn = turbo<number>()
    .reduce<number>(m, 0)
    .build();

  t.is(lfn(data), data.reduce(m, 0));
});

test('reduce: string', (t) => {
  const m = (acc: string, item: number): string => acc + item;
  const data: Array<number> = [1, 2, 3];
  const lfn = turbo<number>()
    .reduce(m, '')
    .build();

  t.is(lfn(data), data.reduce(m, ''));
});

test('reduce: array', (t) => {
  const m = (acc: number[], item: number): number[] => [...acc, item * 2];
  const data: Array<number> = [1, 2, 3];
  const lfn = turbo<number>()
    .reduce<Array<number>>(m, [])
    .build();

  t.deepEqual(lfn(data), data.reduce(m, []));
});

test('reduce: obj', (t) => {
  type Obj = { id: number };
  const m = (acc: string, item: Obj): string => item.id + acc;
  const data: Array<Obj> = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const lfn = turbo<Obj>()
    .reduce<string>(m, '')
    .build();

  t.deepEqual(lfn(data), data.reduce(m, ''));
});

test('filter -> map -> reduce', (t) => {
  const lfn = turbo<number>()
    .filter((item) => item % 2 === 0)
    .map((item) => item + 1)
    .reduce((acc, item) => acc + item, 0)
    .build();

  t.is(lfn([1, 2, 3, 4]), 8);
});

test('build: undefined', (t) => {
  const lfn = turbo<number>().build();

  t.deepEqual(lfn([1, 2, 3, 4]), [1, 2, 3, 4]);
  t.throws(() => lfn(undefined as any));
});


test('build: same ref', (t) => {
  const l = turbo<number>();
  t.is(l.build() === l.build(), true);
});
