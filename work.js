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

const EventEmitter = require('events');
const debug = require('debug')('work');

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
        if (this.works.length && !this.pending) {
            this.start();
        }
    }

    getRes(idx) {
        if (typeof idx === 'string') {
            const sidx = this.names[idx];
            if (sidx === undefined) {
                throw new Error(`Named index ${idx} doesn't exist!`);
            }
            idx = sidx;
        }
        if (idx < 0 || idx >= this.result.length) {
            throw new Error(`Index ${idx} is out of bound!`);
        }
        return this.result[idx];
    }

    getName(idx) {
        if (!this._indices) {
            this._indices = Object.values(this.names);
        }
        if (!this._names) {
            this._names = Object.keys(this.names);
        }
        if (this._indices.indexOf(idx) >= 0) {
            return this._names[this._indices.indexOf(idx)];
        }
    }

    static works(workers, options) {
        if (options === undefined) {
            options = {};
        }
        if (typeof options === 'function') {
            options = {callback: options};
        }
        const d = x => typeof options.dbg === 'function' ? options.dbg(x) : dbg(x);
        const w = new this(workers);
        return new Promise((resolve, reject) => {
            const id = ++seq;
            // always handler, called both on resolve and on reject
            const always = err => new Promise((resolve, reject) => {
                if (typeof options.done === 'function') {
                    options.done(w, err)
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
                const namedIdx = w.getName(idx);
                if (namedIdx) {
                    if (typeof w[namedIdx] !== 'function') {
                        w[namedIdx] = res;
                    }
                }
                const nnext = () => {
                    if (w.works.length === 0) {
                        always()
                            .then(() => {
                                debug('%d> [%d] resolved with %s', id, idx, d(w.rres));
                                resolve(w.rres);
                            })
                            .catch(err => reject(err))
                        ;
                    } else {
                        w.once('work', f);
                        w.next();
                    }
                }
                if (typeof options.callback === 'function') {
                    options.callback(nnext, w);
                } else {
                    nnext();
                }
            }
            // on error handler
            const stop = (idx, err) => {
                w.err = err;
                always(err)
                    .then(() => {
                        if (options.alwaysResolved) {
                            debug('%d> [%d] rejected but return as resolved', id, idx);
                            resolve();
                        } else {
                            debug('%d> [%d] rejected with %s', id, idx, d(err));
                            if (typeof options.onerror === 'function') {
                                options.onerror(w);
                            }
                            reject(err);
                        }
                    })
                    .catch(err => reject(err))
                ;
            }
            // worker main handler
            const f = worker => {
                w.current = worker;
                const idx = worker.idx;
                const winfo = worker.info;
                const skip = !worker.isEnabled(w);
                try {
                    if (skip) {
                        debug('%d> [%d] skip %s', id, idx, winfo);
                        next(idx, null);
                    } else {
                        debug('%d> [%d] call %s', id, idx, winfo);
                        worker.handler(w)
                            .then(res => {
                                debug('%d> [%d] return %s', id, idx, d(res));
                                w.rres = res;
                                next(idx, res);
                            })
                            .catch(err => {
                                stop(idx, err);
                            })
                        ;
                    }
                } catch (err) {
                    if (winfo && options.onerror === undefined) {
                        console.error('Got error %s:\n%s', err instanceof Error ? err.toString() : err, winfo);
                    }
                    stop(idx, err);
                }
            }
            w.once('work', f);
            // guard against empty work
            if (workers.length === 0) {
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
        if (typeof f === 'function') {
            dbg = f;
        }
    }
}

class Worker
{
    constructor(work) {
        if (typeof work === 'function') {
            this.handler = work;
        }
        if (Array.isArray(work)) {
            if (typeof work[0] === 'string') {
                this.name = work.shift();
            }
            if (typeof work[0] !== 'function') {
                throw Error(`Worker handler must be function, got ${typeof work[0]}!`);
            }
            this.handler = work[0];
            if (work.length > 1) {
                if (typeof work[1] !== 'function') {
                    throw Error(`Worker state handler must be function, got ${typeof work[1]}!`);
                }
                this.enabled = work[1];
            }
        }
        if (typeof this.handler !== 'function') {
            throw Error('Worker handler is required!');
        }
    }

    isEnabled(caller) {
        return typeof this.enabled === 'function' ? this.enabled(caller) : true;
    }

    get info() {
        return this.handler.toString();
    }

    static create(work) {
        if (work instanceof Worker) {
            return work;
        }
        return new this(work);
    }
}

module.exports = Work;