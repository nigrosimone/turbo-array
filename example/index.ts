/**
 * Runnable tour of the turbo-array API.
 *
 *     npm install
 *     npm run example
 *
 * Every section prints the turbo result next to the vanilla one so you can
 * check they agree.
 */
import { clearCache, turbo } from '../src';

const data = Array.from({ length: 20 }, (_, i) => i + 1);

const report = (label: string, actual: unknown, expected: unknown) => {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${same ? '✔' : '✘'} ${label}\n    turbo   ${JSON.stringify(actual)}\n    vanilla ${JSON.stringify(expected)}`);
};

console.log('\n--- filter → map → reduce -------------------------------------');

const isEven = (value: number) => value % 2 === 0;
const double = (value: number) => value * 2;
const sum = (acc: number, value: number) => acc + value;

// Build the pipeline once...
const complexSum = turbo<number>().filter(isEven).map(double).reduce(sum, 0).build();

// ...then reuse it as many times as you like.
report('complexSum(1..20)', complexSum(data), data.filter(isEven).map(double).reduce(sum, 0));
report('complexSum(1..5)', complexSum([1, 2, 3, 4, 5]), [1, 2, 3, 4, 5].filter(isEven).map(double).reduce(sum, 0));

console.log('\n--- the context argument --------------------------------------');

// The pipeline callbacks are inlined into the generated function, so they
// cannot close over local variables: anything they need travels in `context`,
// the second argument of the built function. Declaring it keeps TypeScript
// happy while the real value is supplied at call time.
type Context = { multiply: number; seen: number[] };
declare const context: Context;

const scaledSum = turbo<number, Context>()
  .filter(isEven)
  .map((value) => value * context.multiply)
  .reduce(sum, 0)
  .build();

console.log(`    scaledSum(1..5, x2) = ${scaledSum([1, 2, 3, 4, 5], { multiply: 2, seen: [] })}`);
console.log(`    scaledSum(1..5, x3) = ${scaledSum([1, 2, 3, 4, 5], { multiply: 3, seen: [] })}`);

console.log('\n--- the other operations --------------------------------------');

const csv = turbo<number>().filter(isEven).join(' | ').build();
report('filter → join', csv(data), data.filter(isEven).join(' | '));

const firstBig = turbo<number>()
  .find((value) => value > 15)
  .build();
report(
  'find',
  firstBig(data),
  data.find((value) => value > 15),
);

const indexOfBig = turbo<number>()
  .findIndex((value) => value > 15)
  .build();
report(
  'findIndex',
  indexOfBig(data),
  data.findIndex((value) => value > 15),
);

const hasOdd = turbo<number>()
  .some((value) => value % 2 !== 0)
  .build();
report(
  'some',
  hasOdd(data),
  data.some((value) => value % 2 !== 0),
);

const allPositive = turbo<number>()
  .every((value) => value > 0)
  .build();
report(
  'every',
  allPositive(data),
  data.every((value) => value > 0),
);

// `forEach` is a pass-through stage: elements keep flowing downstream.
const tapped = turbo<number, Context>()
  .filter(isEven)
  .forEach((value) => context.seen.push(value))
  .map(double)
  .build();
const seen: number[] = [];
report('filter → forEach → map', tapped([1, 2, 3, 4], { multiply: 1, seen }), [2, 4].map(double));
console.log(`    forEach saw ${JSON.stringify(seen)}`);

console.log('\n--- caching a pipeline by key ---------------------------------');

// `turbo('some-key')` returns the very same instance, so a module can rebuild
// its pipeline lazily without paying for the code generation twice.
const first = turbo<number>('running-total');
console.log(`    same instance reused:  ${first === turbo<number>('running-total')}`);

const runningTotal = first.reduce(sum, 0).build();
console.log(`    same built function:   ${turbo<number>('running-total').reduce(sum, 0).build() === runningTotal}`);
console.log(`    runningTotal(1..20) =  ${runningTotal(data)}`);

clearCache('running-total');
console.log(`    after clearCache:      ${turbo<number>('running-total') !== first}`);

console.log('\n--- generated code -------------------------------------------\n');
console.log(complexSum.toString());

console.log('\n--- rough timing ---------------------------------------------');
console.log('    (see `npm run bench` for the real benchmark)\n');

const big = Array.from({ length: 100_000 }, (_, i) => i + 1);
const rounds = 200;

let started = performance.now();
for (let i = 0; i < rounds; i++) {
  complexSum(big);
}
const turboMs = performance.now() - started;

started = performance.now();
for (let i = 0; i < rounds; i++) {
  big.filter(isEven).map(double).reduce(sum, 0);
}
const vanillaMs = performance.now() - started;

console.log(`    turbo   ${turboMs.toFixed(0)} ms`);
console.log(`    vanilla ${vanillaMs.toFixed(0)} ms`);
console.log(`    speedup ${(vanillaMs / turboMs).toFixed(2)}x\n`);
