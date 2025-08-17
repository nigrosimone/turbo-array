# Turbo Array

Turbo Array is a lightweight, high-performance, fast library that allows you to build lazy evaluation pipelines for arrays. It supports operations like `filter`, `map`, `reduce`, `forEach`, `find`, `some`, `every` and `join`, executing them efficiently.

A method build with Turbo Array is 4x faster than vanilla version.

See live example with benchmark: https://stackblitz.com/edit/turbo-array

## How it works

The `build` method constructs a function that processes the array in a single loop. This minimizes the number of iterations over the array, reducing the overhead compared to performing multiple passes for each operation.
The operations (`filter`, `map`, `reduce`, `forEach`, `join`) are inlined into the generated function. This reduces the overhead of function calls and allows the JavaScript engine to optimize the code more effectively. The generated function includes conditional logic to skip unnecessary operations (e.g., skipping elements that do not pass the filter condition).This ensures that only relevant operations are performed on each element.

## Installation

```sh
npm install turbo-array
```

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

If you need to pass a variable context to turbo method

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
function anonymous(array, context) {
  "use strict";
  if (!Array.isArray(array)) throw new Error("Invalid parameters");
  const filter_0 = (n) => n % 2 === 0;
  const map_1 = (n) => n \* 2;
  const reduce_2 = (acc, n) => acc + n;
  let result = 0;
  let e = array.length, item;
  let idx = 0, i = 0;
  for (; i < e; i++, idx++) {
    item = array[i];
    if (!filter_0(item, idx)) {
      idx--;
      continue;
    }
    item = map_1(item, idx);
    result = reduce_2(result, item, idx);
  }
  return result;
}
```

## Support

This is an open-source project. Star this [repository](https://github.com/nigrosimone/turbo-array), if you like it, or even [donate](https://www.paypal.com/paypalme/snwp). Thank you so much!
