/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2024-2026 Toha <tohenk@yahoo.com>
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

import { EventEmitter } from 'events';

declare type WorkHandler = (w: Work) => Promise<any>;
declare type WorkState = (w: Work) => boolean;
declare type WorkNext = (next: Function, w: Work) => void;
declare type WorkBefore = (worker: Worker, w: Work) => void;
declare type WorkDone = (w: Work, err: string | Error) => Promise<any>;
declare type WorkError = (w: Work, options: object) => void;

declare interface WorkerData {
    [index: number]: string | WorkHandler | WorkState;
}

declare interface WorkOptions {
    alwaysResolved: boolean;
    onWork: WorkBefore;
    onNext: WorkNext;
    onDone: WorkDone;
    onError: WorkError;
}

declare class Worker {
    name: string;
    idx: number;
    handler: WorkHandler;
    isEnabled(caller: Work): boolean;
}

declare class Work extends EventEmitter {
    res: any;
    pres: any;
    getRes(idx: number | string): any;
    getName(idx: number): string;
    static works(works: Worker[] | WorkerData[], options?: WorkOptions): Promise<any>;
    static works(works: Worker[] | WorkerData[], onnext: WorkNext): Promise<any>;
    static setInitializer(f: Function): typeof Work;
    static setOnError(f: WorkError): typeof Work;
    static setDebugger(f: Function): typeof Work;
}

export = Work;