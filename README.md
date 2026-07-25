# Turbo Array

Turbo Array is a lightweight, high-performance, fast library that allows you to build lazy evaluation pipelines for arrays. It supports operations like `filter`, `map`, `reduce`, `forEach`, `find`, `some`, `every` and `join`, executing them efficiently.

A method build with Turbo Array is 4x faster than vanilla version.

See the runnable example with benchmark in [example/](./example): `npm install && npm run example`.

## How it works

The `build` method constructs a function that processes the array in a single loop. This minimizes the number of iterations over the array, reducing the overhead compared to performing multiple passes for each operation.
The operations (`filter`, `map`, `reduce`, `forEach`, `join`) are inlined into the generated function. This reduces the overhead of function calls and allows the JavaScript engine to optimize the code more effectively. The generated function includes conditional logic to skip unnecessary operations (e.g., skipping elements that do not pass the filter condition).This ensures that only relevant operations are performed on each element.

## Installation

```sh
npm install turbo-array
```

Turbo Array requires Node.js 20 or newer (or any current browser).

## Usage

```typescript
import { turbo } from 'turbo-array';

// Create a pipeline (build it once)
const complexSum = turbo()
  .filter((n) => n % 2 === 0)
  .map((n) => n * 2)
  .reduce((acc, n) => acc + n, 0)
  .build(); // ⚡️ The build step optimizes the pipeline

// Reuse multiple times
complexSum([1, 2, 3, 4, 5]);
complexSum([6, 7, 8, 9, 10]);
```

Every operation mirrors the semantics of its `Array.prototype` counterpart, including the index each callback receives, so a pipeline always agrees with the equivalent vanilla chain:

```typescript
turbo().filter(f).map(m).join('-').build()(data) === data.filter(f).map(m).join('-');
```

### The context argument

The callbacks are inlined into the generated function, so **they cannot close over local variables**. Anything a callback needs must travel through `context`, the second argument of the built function:

```typescript
import { turbo } from 'turbo-array';

type Context = { multiply: number };
declare var context: Context;

// Create a pipeline (build it once)
const complexSum = turbo<number, Context>()
  .filter((n) => n % 2 === 0)
  .map((n) => n * context.multiply)
  .reduce((acc, n) => acc + n, 0)
  .build(); // ⚡️ The build step optimizes the pipeline

// Reuse multiple times
complexSum([1, 2, 3, 4, 5], { multiply: 2 });
complexSum([1, 2, 3, 4, 5], { multiply: 3 });
```

For the same reason the callbacks must be plain function expressions or arrow functions: native functions (`Math.round`), bound functions and shorthand methods cannot be inlined, and `build()` rejects them with an explicit error.

### Operations

| Operation                       | Returns                    | Notes                                                                           |
| ------------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `filter(predicate)`             | the pipeline, for chaining | The predicate receives the index the element has when it reaches this stage.    |
| `map(mapper)`                   | the pipeline, for chaining | May change the element type; the built function still consumes the source type. |
| `forEach(callback)`             | the pipeline, for chaining | A pass-through stage: elements keep flowing to the next operation.              |
| `reduce(reducer, initialValue)` | a terminal operation       | The seed is captured at build time, see below.                                  |
| `join(separator = ',')`         | a terminal operation       | Nullish elements render as an empty string, like `Array.prototype.join`.        |
| `find(predicate)`               | a terminal operation       | The matching element, or `undefined`.                                           |
| `findIndex(predicate)`          | a terminal operation       | The index within the filtered sequence, or `-1`.                                |
| `some(predicate)`               | a terminal operation       | `false` on an empty array.                                                      |
| `every(predicate)`              | a terminal operation       | `true` on an empty array.                                                       |

A terminal operation only exposes `build()`; anything chained after it is ignored.

The `reduce` seed is captured once, when the pipeline is built. Primitives, plain objects, arrays and any other structured-cloneable value (`Map`, `Set`, `Date`, ...) are re-created on every invocation, so the built function stays reusable. Values that cannot be copied without losing their prototype — class instances, or objects holding functions — are shared across invocations instead, so do not mutate them in the reducer.

### Caching a pipeline

`turbo(cacheKey)` returns the instance already stored under that key, so a module can build its pipeline lazily without generating the code twice:

```typescript
import { clearCache, turbo } from 'turbo-array';

const sum = turbo<number>('sum').reduce((acc, n) => acc + n, 0).build();

// Later, anywhere: same instance, same built function, no code generation.
turbo<number>('sum').build() === sum;

// The cache lives as long as the module. Release it when you are done:
clearCache('sum'); // one key
clearCache(); // everything
```

## How build works

The `build` method constructs a function that processes the array in a single loop. Eg.:

```typescript
import { turbo } from 'turbo-array';

const complexSum = turbo()
  .filter((n) => n % 2 === 0)
  .map((n) => n * 2)
  .reduce((acc, n) => acc + n, 0)
  .build();
```

The `complexSum()` method become:

```js
function (array, context) {
  'use strict';
  if (!Array.isArray(array)) throw new Error('Invalid parameters');
  const filter_0 = (n) => n % 2 === 0;
  const map_1 = (n) => n * 2;
  const reduce_2 = (acc, n) => acc + n;
  let stage_1 = 0;
  let result = 0;
  let e = array.length,
    item;
  let i = 0;
  for (; i < e; i++) {
    item = array[i];
    if (!filter_0(item, i)) continue;
    const idx_1 = stage_1++;
    item = map_1(item, idx_1);
    result = reduce_2(result, item, idx_1);
  }
  return result;
}
```

`i` is the index in the source array, which is what the `filter` predicate receives. Each filter then opens a new stage counter (`stage_1`), bumped only by the elements that survive it, so every later operation sees the index it would have in the filtered array — exactly like `array.filter(...).map(...)` does.

## Support

This is an open-source project. Star this [repository](https://github.com/nigrosimone/turbo-array), if you like it, or even [donate](https://www.paypal.com/paypalme/snwp). Thank you so much!
