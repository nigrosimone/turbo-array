# turbo-array example

A runnable tour of the library: every operation, the `context` argument, the
pipeline cache, the generated source and a rough timing against the vanilla
`filter().map().reduce()` chain.

```sh
npm install
npm run example
```

The example imports the library straight from `../src`, so any change you make
to the source is picked up on the next run — no build step needed.

For the proper benchmark suite, run:

```sh
npm run bench
```
