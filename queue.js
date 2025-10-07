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

const EventEmitter = require('events');

/**
 * Queue processing callback.
 *
 * @callback queueCallback
 * @param {any} queue The queue
 */

/**
 * Queue check callback.
 *
 * @callback checkCallback
 * @returns {boolean} Return true to continue otherwise will pending processing
 */

/**
 * Queue processing.
 * 
 * Usage:
 *
 * ```js
 * const { Queue } = require('@ntlab/work');
 *
 * const queues = ['One', 'Two', 'Three'];
 * const q = new Queue(queues, seq => {
 *     console.log(seq);
 *     q.next();
 * });
 * q.once('done', () => {
 *     console.log('Done');
 * });
 * ```
 *
 * @author Toha <tohenk@yahoo.com>
 */
class Queue extends EventEmitter {

    /**
     * Constructor.
     *
     * @param {any[]} queues The queues, will empty when done
     * @param {queueCallback} handler The processing callback
     * @param {checkCallback} check The check callback
     */
    constructor(queues, handler, check) {
        super();
        /** @type {any[]} */
        this.queues = queues || [];
        /** @type {queueCallback} */
        this.handler = handler;
        /** @type {checkCallback} */
        this.check = check;
        /** @type {boolean} */
        this.pending = false;
        /** @type {any} */
        this.queue = null;
        this.next();
    }

    /**
     * Consume queue by emitting `queue` event.
     *
     * @param {any} queue The queue
     */
    consume(queue) {
        process.nextTick(() => {
            this.queue = queue;
            this.once('queue', this.handler);
            this.emit('queue', queue);
        });
    }

    /**
     * Process next queue, if no queue available then it will emitting
     * `done` event.
     */
    next() {
        if (this.queues.length) {
            const nn = () => {
                setTimeout(() => {
                    process.nextTick(() => {
                        this.next();
                    });
                }, 0);
            }
            if (this.pending || (typeof this.check === 'function' && !this.check())) {
                return nn();
            }
            this.consume(this.queues.shift());
        } else {
            this.done();
        }
    }

    /**
     * Clear queue.
     */
    clear() {
        this.queues = [];
    }

    /**
     * Emit `done` event.
     */
    done() {
        process.nextTick(() => {
            this.emit('done');
            this.queue = null;
        });
    }

    /**
     * Add more queue either on top of existing queue or as next queue.
     *
     * @param {any[]} queues Queue to add
     * @param {boolean} top True to prioritize queue on top
     */
    requeue(queues, top) {
        const processNext = this.queues.length === 0 && this.queue === null;
        if (top) {
            this.queues.unshift(...queues);
        } else {
            this.queues.push(...queues);
        }
        if (processNext) {
            this.next();
        }
    }
}

module.exports = Queue;