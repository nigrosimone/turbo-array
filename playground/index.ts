import { turbo } from '../';

debugger;

const data = Array.from({ length: 30 }, (_, i) => i + 1);

const f = (item: number) => item % 2 === 0;
const m = (item: number) => item + 1;
const r = (acc: number, item: number) => acc + item;

const lFilterMap = turbo<number>()
    .filter(f)
    .map(m)
    .reduce(r, 0)
    .build();

console.log(lFilterMap.toString());

console.log(lFilterMap(data));