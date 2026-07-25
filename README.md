# Turbo Array

Turbo Array is a lightweight, high-performance library for building array pipelines that run as one fused loop. It supports `filter`, `map`, `reduce`, `forEach`, `find`, `findIndex`, `some`, `every` and `join`, and every operation mirrors the semantics of its `Array.prototype` counterpart — including the index each callback receives — so a pipeline always agrees with the equivalent vanilla chain.

A pipeline built with Turbo Array runs the whole chain in a single loop, with no
intermediate arrays. On 100k elements, `filter -> map -> reduce`:

|                                       | ms     | vs vanilla |
| ------------------------------------- | ------ | ---------- |
| `array.filter(f).map(m).reduce(r, 0)` | 645    | 1.00x      |
| **Turbo Array (default)**             | **64** | **10.15x** |
| Turbo Array, `{ compile: false }`     | 240    | 2.69x      |

The gain grows with the length of the chain — a six operation pipeline reaches
about 20x — and shrinks to roughly nothing for a single operation, where a
native call is already one pass. Reproduce it all with
`npm install && npm run example`, or see [example/](./example).

## Read this before you adopt it

By default the callbacks are **compiled into the generated loop as source code**,
which is where the speed comes from. Two consequences decide whether the default
path fits your codebase:

1. **A callback cannot read the scope it was written in.**

   ```ts
   const threshold = 2;
   turbo()
     .filter((n) => n > threshold)
     .build()(data);
   // TypeError: turbo-array: a callback reads "threshold" from the scope it was
   // written in, which the compiled pipeline cannot see. Pass it through the
   // context argument, or build with turbo({ compile: false }).
   ```

   Pass what the callback needs through [`context`](#the-context-argument), or
   opt out of compilation.

2. **It needs `new Function`.** Under a Content Security Policy without
   `unsafe-eval` — browser extensions, some single page apps, some edge runtimes
   — code generation is unavailable. Turbo Array detects that and falls back on
   its own, so it keeps working, at the slower speed shown above.

`turbo({ compile: false })` opts out of code generation entirely: callbacks may
close over anything, nothing evaluates source at runtime, and the pipeline is
still a single pass with no intermediate arrays. It lands between **1.2x and 3x**
a vanilla chain rather than 10x, and where it falls in that range depends on how
many distinct interpreted pipelines share the process: they run through one shared
loop, so its call sites stop being monomorphic as they multiply. Compiling gives
every pipeline its own machine code, which is the whole reason the default path
exists.

Behavior is otherwise identical. The test suite runs every scenario through both
paths and asserts they agree with each other and with the equivalent native
chain.

|                                      | compiled (default)          | `{ compile: false }` |
| ------------------------------------ | --------------------------- | -------------------- |
| Speed, 3 operation chain             | ~10x vanilla                | 1.2x - 3x vanilla    |
| Callbacks may close over their scope | no                          | **yes**              |
| Works without `unsafe-eval`          | no                          | **yes**              |
| Debuggable stack traces              | inside a generated function | normal               |

Use `turbo({ compile: true })` to require compilation and get an error instead of
the silent fallback.

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

For the same reason the callbacks must be plain function expressions or arrow functions: native functions (`Math.round`), bound functions and shorthand methods cannot be inlined, and `build()` rejects them with an explicit error. None of this applies to `turbo({ compile: false })`, where the callbacks are called as they are.

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

### Choosing the execution path

```ts
turbo(); // compile, fall back to the runtime path if unavailable
turbo({ compile: true }); // compile or throw
turbo({ compile: false }); // never generate code
turbo('cache-key'); // as before
turbo({ cacheKey: 'cache-key', compile: false }); // both
```

### Caching a pipeline

`turbo(cacheKey)` returns the instance already stored under that key, so a module can build its pipeline lazily without generating the code twice:

```typescript
import { clearCache, turbo } from 'turbo-array';

const sum = turbo<number>('sum')
  .reduce((acc, n) => acc + n, 0)
  .build();

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
