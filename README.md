# Turbo Array

Turbo Array is a lightweight, high-performance library that allows you to build lazy evaluation pipelines for arrays. It supports operations like `filter`, `map`, `reduce`, `forEach`, and `join`, executing them efficiently.

A method build with Turbo Array is 4x faster than vanilla version.

See live example with benchmark: https://stackblitz.com/edit/turbo-array

## How it works

The build method constructs a function that processes the array in a single loop. This minimizes the number of iterations over the array, reducing the overhead compared to performing multiple passes for each operation.
The operations (filter, map, reduce, forEach, join) are inlined into the generated function. This reduces the overhead of function calls and allows the JavaScript engine to optimize the code more effectively. The generated function includes conditional logic to skip unnecessary operations (e.g., skipping elements that do not pass the filter condition).This ensures that only relevant operations are performed on each element.

## Installation

```sh
npm install turbo-array
```

## Usage

```typescript
import { turbo } from 'turbo-array';

// Build one time a "turbo" method
const complexSum = turbo()
  .filter((n) => n % 2 === 0)
  .map((n) => n * 2)
  .reduce((acc, n) => acc + n, 0)
  .build();

// Reuse multiple times
complexSum([1, 2, 3, 4, 5]);
complexSum([6, 7, 8, 9, 10]);
```

## API

### `turbo<T>(): Turbo<T>`

Creates a new `Turbo` instance.

### `.filter(predicate: (value: T, index: number) => unknown): Turbo<T>`

Filters elements based on the predicate function.

### `.map<U>(mapper: (value: T, index: number) => U): Turbo<U>`

Applies a mapping function to each element.

### `.reduce<U>(reducer: (acc: U, value: T, index: number) => U, initialValue: U): LastOperation<T, U>`

Reduces elements to a single value.

### `.forEach(callback: (value: T, index: number) => void): Turbo<T>`

Executes a function on each element without modifying the array.

### `.join(separator?: string): LastOperation<T, string>`

Joins elements into a string using the provided separator.

### `.build(): (array: T[], context?: Record<string, any>) => T[] | U`

Compiles the operations into a function that can be executed on an array.

## Support

This is an open-source project. Star this [repository](https://github.com/nigrosimone/turbo-array), if you like it, or even [donate](https://www.paypal.com/paypalme/snwp). Thank you so much!
