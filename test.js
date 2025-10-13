/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2022-2025 Toha <tohenk@yahoo.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const assert = require('node:assert');
const test = require('node:test');
const Queue = require('./queue');
const Work = require('./work');
const debug = require('debug')('work:test');

test('queue', async (t) => {
    await t.test('can create queue from array', async (t) => {
        const res = await new Promise((resolve) => {
            let r;
            const q = new Queue([9], a => {
                r = a;
                q.next();
            });
            q.once('done', () => resolve(r));
        });
        assert.strictEqual(res, 9);
    });
    await t.test('array is empty once processed', async (t) => {
        const a = [1, 2, 3];
        await new Promise((resolve) => {
            const q = new Queue(a, a => q.next());
            q.once('done', () => resolve());
        });
        assert.strictEqual(a.length, 0);
    });
    await t.test('can process pending queue', async (t) => {
        const res = await new Promise((resolve) => {
            const r = [];
            const q = new Queue([1, 2], a => {
                r.push(a);
                if (a === 1) {
                    q.pending = true;
                }
                q.next();
            });
            setTimeout(() => {
                q.pending = false;
            }, 1000);
            q.once('done', () => resolve(r));
        });
        assert.deepEqual(res, [1, 2]);
    });
    await t.test('can process queue using check callback', async (t) => {
        const res = await new Promise((resolve) => {
            const r = [];
            let processing = true;
            const q = new Queue([1, 2], a => {
                r.push(a);
                if (a === 1) {
                    processing = false;
                }
                q.next();
            }, () => processing);
            setTimeout(() => {
                processing = true;
            }, 1000);
            q.once('done', () => resolve(r));
        });
        assert.deepEqual(res, [1, 2]);
    });
    await t.test('can re-queue after creation', async (t) => {
        const res = await new Promise((resolve) => {
            let r;
            const q = new Queue([], a => {
                r = a;
                q.next();
            });
            q.on('done', () => {
                if (r !== undefined) {
                    resolve(r);
                }
            });
            q.requeue([4]);
        });
        assert.strictEqual(res, 4);
    });
    await t.test('can re-queue on long loop', async (t) => {
        const a = [];
        const res = await new Promise((resolve) => {
            const n = 10;
            const d = 100;
            const q = new Queue(a, a => {
                debug(`Processing ${a}`);
                setTimeout(() => {
                    debug('Processing next');
                    q.next();
                }, d);
            });
            const addq = (odd = true) => {
                for (let i = 1; i <= parseInt(n / 2); i++) {
                    const seq = 2 * i - (odd ? 1 : 0);
                    debug(`Requeue ${seq}`);
                    q.requeue([seq]);
                }
            }
            addq();
            setTimeout(() => addq(false), d * 2);
            setTimeout(() => resolve(), (n + 1) * d);
        });
        assert.strictEqual(a.length, 0);
    });
});
test('work queue', async (t) => {
    await t.test('worker is function', async (t) => {
        const res = await Work.works([() => Promise.resolve(true)]);
        assert.strictEqual(res, true);
    });
    await t.test('worker is array', async (t) => {
        const res = await Work.works([[w => Promise.resolve(false)]]);
        assert.strictEqual(res, false);
    });
    await t.test('worker can be skipped', async (t) => {
        const res = await Work.works([
            [w => Promise.resolve(1)],
            [w => Promise.resolve(2), w => w.getRes(0) < 1],
        ]);
        assert.strictEqual(res, 1);
    });
    await t.test('worker can be named', async (t) => {
        const res = await Work.works([
            ['first', w => Promise.resolve(10)],
            ['second', w => Promise.resolve(20)],
            ['third', w => Promise.resolve(30)],
            ['fourth', w => Promise.resolve(w.getRes('second'))],
        ]);
        assert.strictEqual(res, 20);
    });
    await t.test('will call done callback when finished', async (t) => {
        let res;
        await Work.works([() => Promise.resolve(19)], {
            async done(w, err) {
                res = w.getRes(0);
            }
        });
        assert.strictEqual(res, 19);
    });
    await t.test('will call done callback on empty work', async (t) => {
        let res;
        await Work.works([], {
            async done(w, err) {
                res = true;
            }
        });
        assert.strictEqual(res, true);
    });
    await t.test('will always be resolved regardless of rejection', async (t) => {
        let res;
        await new Promise((resolve, reject) => {
            Work.works([() => Promise.reject('rejected')], {alwaysResolved: true})
                .then(() => {
                    res = true;
                    resolve();
                })
                .catch(err => {
                    res = false;
                    resolve();
                });
        });
        assert.strictEqual(res, true);
    });
    await t.test('will always be resolved regardless of error', async (t) => {
        let res;
        await new Promise((resolve, reject) => {
            Work.works([
                () => {
                    throw new Error('error is thrown');
                }
            ], {alwaysResolved: true, onerror: () => {}})
                .then(() => {
                    res = true;
                    resolve();
                })
                .catch(err => {
                    res = false;
                    resolve();
                });
        });
        assert.strictEqual(res, true);
    });
    await t.test('will call onwork before each execution', async (t) => {
        let res = 0;
        await Work.works([
            [() => Promise.resolve(1), () => false],
            [() => Promise.resolve(2)],
            [() => Promise.resolve(3)],
        ], {
            onwork(worker, w) {
                if (worker.isEnabled(w)) {
                    res++;
                }
            }
        });
        assert.strictEqual(res, 2);
    });
    await t.test('will call callback on each execution', async (t) => {
        let res = 0;
        await Work.works([
            [() => Promise.resolve(1)],
            [() => Promise.resolve(2)],
            [() => Promise.resolve(3)],
        ], {
            callback(next, w) {
                res += w.res;
                next();
            }
        });
        assert.strictEqual(res, 6);
    });
    await t.test('can use work initializer', async (t) => {
        let res;
        Work.setInitializer(options => {
            if (options.onerror === undefined) {
                options.onerror = w => res = w.err.message;
            }
        });
        await new Promise((resolve, reject) => {
            Work.works([
                [() => new Promise((resolve, reject) => {
                    throw new Error('This is an error');
                })],
            ])
            .then(() => resolve())
            .catch(() => resolve());
        });
        assert.strictEqual(res, 'This is an error');
    });
    await t.test('can use global error logger', async (t) => {
        let res;
        Work
            .setInitializer()
            .setOnError(w => res = w.err.message);
        await new Promise((resolve, reject) => {
            Work.works([
                [() => new Promise((resolve, reject) => {
                    throw new Error('This is an another error');
                })],
            ])
            .then(() => resolve())
            .catch(() => resolve());
        });
        assert.strictEqual(res, 'This is an another error');
    });
});