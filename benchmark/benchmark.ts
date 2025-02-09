import { Suite } from 'benchmark';

import { turbo } from '../';

const data = Array.from({ length: 30 }, (_, i) => i + 1);

const f = (item: number) => item % 2 === 0;
const m = (item: number) => item + 1;
const r = (acc: number, item: number) => acc + item;

const lFilterMap = turbo<number>()
    .filter(f)
    .map(m)
    .build();

const lFilterReduce = turbo<number>()
    .filter(f)
    .reduce(r, 0)
    .build();

const lFilterJoin = turbo<number>()
    .filter(f)
    .join()
    .build();

new Suite('filterMap')
    .add('turbo: filterMap', function () {
        lFilterMap(data);
    })
    .add('vanilla: filterMap', function () {
        data
            .filter(f)
            .map(m);
    })
    .on('cycle', function (event: any) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        // @ts-ignore
        console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .run();

new Suite('filterReduce')
    .add('turbo: filterReduce', function () {
        lFilterReduce(data);
    })
    .add('vanilla: filterReduce', function () {
        data
            .filter(f)
            .reduce(r, 0);
    })
    .on('cycle', function (event: any) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        // @ts-ignore
        console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .run();

new Suite('filterJoin')
    .add('turbo: filterJoin', function () {
        lFilterJoin(data);
    })
    .add('vanilla: filterJoin', function () {
        data
            .filter(f)
            .join();
    })
    .on('cycle', function (event: any) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        // @ts-ignore
        console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .run();


new Suite('cached')
    .add('turbo cached: filterJoin', function () {
        const lFilterJoin = turbo<number>('xxx')
            .filter(f)
            .join()
            .build();
        lFilterJoin(data);
    })
    .add('vanilla: filterJoin', function () {
        data
            .filter(f)
            .join();
    })
    .on('cycle', function (event: any) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        // @ts-ignore
        console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .run();