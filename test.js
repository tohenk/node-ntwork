/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2022-2024 Toha <tohenk@yahoo.com>
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
    await t.test('create queue from array', async (t) => {
        const res = await new Promise((resolve) => {
            let res;
            const q = new Queue([9], a => {
                res = a;
                q.next();
            });
            q.once('done', () => resolve(res));
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
    await t.test('requeue after creation', async (t) => {
        const res = await new Promise((resolve) => {
            let res;
            const q = new Queue([], a => {
                res = a;
                q.next();
            });
            q.on('done', () => {
                if (res !== undefined) {
                    resolve(res);
                }
            });
            q.requeue([4]);
        });
        assert.strictEqual(res, 4);
    });
    await t.test('requeue long loop', async (t) => {
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
    await t.test('work queue worker is function', async (t) => {
        const res = await Work.works([() => Promise.resolve(true)]);
        assert.strictEqual(res, true);
    });
    await t.test('work queue worker is array', async (t) => {
        const res = await Work.works([[w => Promise.resolve(false)]]);
        assert.strictEqual(res, false);
    });
    await t.test('work queue worker can be skipped', async (t) => {
        const res = await Work.works([
            [w => Promise.resolve(1)],
            [w => Promise.resolve(2), w => w.getRes(0) < 1],
        ]);
        assert.strictEqual(res, 1);
    });
    await t.test('work queue worker can be named', async (t) => {
        const res = await Work.works([
            ['first', w => Promise.resolve(10)],
            ['second', w => Promise.resolve(20)],
            ['third', w => Promise.resolve(30)],
            ['fourth', w => Promise.resolve(w.getRes('second'))],
        ]);
        assert.strictEqual(res, 20);
    });
    await t.test('work queue will call done callback when finished', async (t) => {
        let res;
        await Work.works([() => Promise.resolve(19)], {
            async done(w, err) {
                res = w.getRes(0);
            }
        });
        assert.strictEqual(res, 19);
    });
    await t.test('work queue will call done callback on empty work', async (t) => {
        let res;
        await Work.works([], {
            async done(w, err) {
                res = true;
            }
        });
        assert.strictEqual(res, true);
    });
    await t.test('work queue will always be resolved regardless of rejection', async (t) => {
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
    await t.test('work queue will always be resolved regardless of error', async (t) => {
        let res;
        await new Promise((resolve, reject) => {
            Work.works([
                () => {
                    throw new Error('error is thrown');
                }
            ], {alwaysResolved: true})
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
    await t.test('work queue will call callback on each execution', async (t) => {
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
});