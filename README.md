# Turbo Array

Turbo Array is a lightweight, high-performance library that allows you to build lazy evaluation pipelines for arrays. It supports operations like `filter`, `map`, `reduce`, `forEach`, and `join`, executing them efficiently only when needed.

## Installation

```sh
npm install turbo-array
```

## Usage

```typescript
import turbo from 'turbo-array';

const numbers = [1, 2, 3, 4, 5];

const f = turbo()
  .filter((n) => n % 2 === 0)
  .map((n) => n * 2)
  .reduce((acc, n) => acc + n, 0)
  .build();

console.log(f(numbers)); // Output: 12
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

## Example

```typescript
const words = ['hello', 'world'];

const sentence = turbo()
  .map((word) => word.toUpperCase())
  .join(' ')
  .build();

console.log(sentence(words)); // Output: "HELLO WORLD"
```
