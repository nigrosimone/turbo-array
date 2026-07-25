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

console.log('\n--- closures, and the codegen free path -----------------------');

// The default path compiles the callbacks into the generated loop, so they can
// no longer see the scope they were written in.
const threshold = 10;
try {
  turbo<number>()
    .filter((value) => value > threshold)
    .build()(data);
} catch (error) {
  console.log(`    default path:  ${(error as Error).message.split('.')[0]}.`);
}

// `{ compile: false }` skips code generation: closures work, nothing evaluates
// source at run time, and the pipeline is still one pass with no intermediates.
const closureSafe = turbo<number>({ compile: false })
  .filter((value) => value > threshold)
  .map((value) => value * 2)
  .build();
report(
  '{ compile: false } with a closure',
  closureSafe(data),
  data.filter((value) => value > threshold).map((value) => value * 2),
);

console.log('\n--- rough timing ---------------------------------------------');
console.log('    (see `npm run bench` for the real benchmark)\n');

const big = Array.from({ length: 100_000 }, (_, i) => i + 1);
const rounds = 200;

const runtimeSum = turbo<number>({ compile: false }).filter(isEven).map(double).reduce(sum, 0).build();

const time = (fn: () => unknown) => {
  for (let i = 0; i < 20; i++) fn();
  const started = performance.now();
  for (let i = 0; i < rounds; i++) fn();
  return performance.now() - started;
};

const vanillaMs = time(() => big.filter(isEven).map(double).reduce(sum, 0));
const turboMs = time(() => complexSum(big));
const runtimeMs = time(() => runtimeSum(big));

console.log(`    vanilla                    ${vanillaMs.toFixed(0).padStart(5)} ms   1.00x`);
console.log(`    turbo (compiled)           ${turboMs.toFixed(0).padStart(5)} ms  ${(vanillaMs / turboMs).toFixed(2).padStart(5)}x`);
console.log(`    turbo { compile: false }   ${runtimeMs.toFixed(0).padStart(5)} ms  ${(vanillaMs / runtimeMs).toFixed(2).padStart(5)}x\n`);
