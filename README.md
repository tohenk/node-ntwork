# Nodejs queue and promise based work queue

## Queue Processing (queue.js)

Provide a queue mechanism.

```js
const { Queue } = require('@ntlab/work');

const queues = ['One', 'Two', 'Three'];
const q = new Queue(queues, seq => {
    console.log(seq);
    q.next();
});
```

## Promise Based Work Queue (work.js)

Provide promise queue mechanism for easy chaining. It accepts a function as its
worker. Its also accepts an array with signature of `[function, function]` which
the first element would be the worker and the second would be a state function
and must be evaluated to true for worker to be executed.

```js
const { Work } = require('@ntlab/work');
Work.works([
    [w => new Promise((resolve, reject) => {
        console.log('First work');
        resolve(false);
    })],
    [w => new Promise((resolve, reject) => {
        console.log('This will be skipped');
        resolve();
    }), w => w.getRes(0)],
    [w => new Promise((resolve, reject) => {
        console.log('It\'s done');
        resolve();
    })],
]);
```
