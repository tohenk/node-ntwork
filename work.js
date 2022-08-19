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
const util = require('util');

let seq = 0;
let dbg = x => x;

/**
 * Promise based worker for easy chaining.
 */
class Work extends EventEmitter {
    result = []

    constructor(works) {
        super();
        let idx = 0;
        this.names = {};
        this.works = works.map(w => {
            const worker = Worker.create(w);
            worker.idx = idx++;
            if (worker.name) {
                this.names[worker.name] = worker.idx;
            }
            return worker;
        });
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
        if (typeof idx == 'string') {
            let sidx = this.names[idx];
            if (sidx == undefined) {
                throw new Error(util.format('Named index %s doesn\'t exist!', idx));
            }
            idx = sidx;
        }
        if (idx < 0 || idx >= this.result.length) {
            throw new Error(util.format('Index %d is out of bound!', idx));
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
            // always handler, called both on resolve and on reject
            const always = () => new Promise((resolve, reject) => {
                if (typeof options.done == 'function') {
                    options.done(w)
                        .then(() => resolve())
                        .catch(err => reject(err))
                    ;
                } else {
                    resolve();
                }
            });
            // next handler or resolve when none left
            const next = (idx, res) => {
                w.result.push(res);
                w.pres = w.res;
                w.res = res;
                if (w.works.length == 0) {
                    always()
                        .then(() => {
                            debug('%d> [%d] resolved with %s', id, idx, dbg(w.rres));
                            resolve(w.rres);
                        })
                        .catch(err => reject(err))
                    ;
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
            const stop = (idx, err) => {
                w.err = err;
                always()
                    .then(() => {
                        if (options.alwaysResolved) {
                            debug('%d> [%d] rejected but return as resolved', id, idx);
                            resolve();
                        } else {
                            debug('%d> [%d] rejected with %s', id, idx, dbg(err));
                            reject(err);
                        }
                    })
                    .catch(err => reject(err))
                ;
            }
            // worker main handler
            const f = worker => {
                const idx = worker.idx;
                const winfo = worker.handler.toString();
                const skip = !worker.isEnabled(w);
                try {
                    if (skip) {
                        debug('%d> [%d] skip %s', id, idx, winfo);
                        next(idx, null);
                    } else {
                        debug('%d> [%d] call %s', id, idx, winfo);
                        worker.handler(w)
                            .then(res => {
                                debug('%d> [%d] return %s', id, idx, dbg(res));
                                w.rres = res;
                                next(idx, res);
                            })
                            .catch(err => {
                                stop(idx, err);
                            })
                        ;
                    }
                } catch (err) {
                    if (winfo) console.error(winfo);
                    stop(idx, err);
                }
            }
            w.once('work', f);
            // guard against empty work
            if (workers.length == 0) {
                always()
                    .then(() => {
                        debug('%d> [-] empty work, resolving instead', id);
                        resolve();
                    })
                    .catch(err => reject(err))
                ;
            }
        });
    }

    static debug(f) {
        if (typeof f == 'function') {
            dbg = f;
        }
    }
}

class Worker
{
    constructor(work) {
        if (typeof work == 'function') {
            this.handler = work;
        }
        if (Array.isArray(work)) {
            if (typeof work[0] != 'function') {
                throw Error('First element of worker must be function!');
            }
            this.handler = work[0];
            if (work.length > 1) {
                if (typeof work[1] != 'function') {
                    throw Error('Second element of worker must be function!');
                }
                this.enabled = work[1];
            }
            if (work.length > 2) {
                this.name = work[2];
            }
        }
    }

    isEnabled(caller) {
        return typeof this.enabled == 'function' ? this.enabled(caller) : true;
    }

    static create(work) {
        if (work instanceof Worker) {
            return work;
        }
        return new this(work);
    }
}

module.exports = Work;