import { turbo } from '../';

debugger;

const data = Array.from({ length: 30 }, (_, i) => i + 1);

const f = (item: number) => item % 2 === 0;
const m = (item: number) => item + 1;
const r = (acc: number, item: number) => acc + item;
const fe = (item: number) => { };

console.time('build');
const method = turbo<number>()
    .filter(f)
    .map(m)
    .forEach(fe)
    .reduce(r, 0)
    .build();
console.timeEnd('build');

console.time('method');
const result = method(data);
console.timeEnd('method');
console.log(result);

console.log(method.toString());