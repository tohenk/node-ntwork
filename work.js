/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2022 Toha <tohenk@yahoo.com>
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

const EventEmitter = require('events');
const debug = require('debug')('work');

let seq = 0;

/**
 * Promise based worker for easy chaining.
 */
class Work extends EventEmitter {
    result = []
    seq = null

    constructor(works) {
        super();
        this.works = works;
        this.next();
    }

    start() {
        process.nextTick(() => {
            if (this.works.length) {
                const work = this.works.shift();
                this.emit('work', work);
            }
        });
    }

    next() {
        if (this.works.length) {
            if (this.pending) return;
            this.start();
        }
    }

    getRes(idx) {
        if (idx < 0 || idx >= this.result.length) {
            throw new Error('Result index is unavailable!');
        }
        return this.result[idx];
    }

    static works(workers, options) {
        if (typeof options == 'undefined') {
            options = {};
        }
        if (typeof options == 'function') {
            options = {callback: options};
        }
        const w = new this(workers);
        return new Promise((resolve, reject) => {
            let id = ++seq;
            w.seq = -1;
            // always handler, called both on resolve and on rejet
            const always = () => {
                if (typeof options.done == 'function') {
                    options.done(w);
                }
            } 
            // next handler or resolve when none left
            const next = res => {
                w.result.push(res);
                w.pres = w.res;
                w.res = res;
                if (w.works.length == 0) {
                    always(w);
                    debug('%d> resolved with %s', id, w.rres);
                    resolve(w.rres);
                } else {
                    w.once('work', f);
                    if (typeof options.callback == 'function') {
                        options.callback(() => w.next());
                    } else {
                        w.next();
                    }
                }
            }
            // on error handler
            const stop = err => {
                w.err = err;
                always(w);
                if (options.alwaysResolved) {
                    debug('%d> rejected but return as resolved', id);
                    resolve();
                } else {
                    debug('%d> rejected with %s', id, err);
                    reject(err);
                }
            }
            // worker main handler
            const f = worker => {
                let skip = false;
                // worker signature: [work, state]
                if (Array.isArray(worker)) {
                    // any state?
                    if (worker.length == 2) {
                        if (typeof worker[1] != 'function') {
                            return reject('Worker state must be a function!');
                        }
                        // state must be evaluated to true to be executed
                        let state = worker[1](w);
                        if (!state) {
                            skip = true;
                        }
                    }
                    worker = worker[0];
                }
                // worker must be function
                if (typeof worker != 'function') {
                    return reject('Worker must be a function!');
                }
                let winfo = worker.toString();
                try {
                    w.seq++;
                    if (skip) {
                        debug('%d> skip %s', id, winfo);
                        next(null);
                    } else {
                        debug('%d> call %s', id, winfo);
                        worker(w)
                            .then(res => {
                                debug('%d> return %s', id, res);
                                w.rres = res;
                                next(res);
                            })
                            .catch(err => {
                                stop(err);
                            })
                        ;
                    }
                } catch (err) {
                    if (winfo) console.error(winfo);
                    stop(err);
                }
            }
            w.once('work', f);
        });
    }
}

module.exports = Work;