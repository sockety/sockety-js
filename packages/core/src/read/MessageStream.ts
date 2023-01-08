import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { Ended, End, Push, Abort } from '../symbols';

// TODO: Handle backpressure
export class MessageStream extends Readable {
  [Ended] = false;
  #size = 0;
  #buffer: Buffer[] = [];
  #waiting = true;

  public constructor() {
    super({ objectMode: true });
  }

  // eslint-disable-next-line no-underscore-dangle
  public _read(size: number): void {
    if (size === 0) {
      // Ignore
    } else if (this.#buffer.length > 0) {
      this.push(this.#buffer.shift());
    } else if (this[Ended]) {
      this.push(null);
    } else {
      this.#waiting = true;
    }
  }

  public get receivedSize(): number {
    return this.#size;
  }

  public [Push](data: Buffer): void {
    this.#size += data.length;
    if (this.#waiting) {
      this.#waiting = false;
      this.push(data);
    } else {
      this.#buffer.push(data);
      this.emit('readable');
    }
  }

  public [End](): void {
    this[Ended] = true;
    if (this.#waiting) {
      this.#waiting = false;
    }
    this.push(null);
  }

  public [Abort](): void {
    this.#buffer = [];
    this.emit('error', 'The incoming message was aborted');
  }
}

export interface MessageStream {
  read(size?: number): Buffer | null;
  addListener(event: 'data', listener: (data: Buffer) => void): this;
  on(event: 'data', listener: (data: Buffer) => void): this;
  once(event: 'data', listener: (data: Buffer) => void): this;
  prependListener(event: 'data', listener: (data: Buffer) => void): this;
  prependOnceListener(event: 'data', listener: (data: Buffer) => void): this;
  removeListener(event: 'data', listener: (data: Buffer) => void): this;
  emit(event: 'data', data: Buffer): boolean;

  addListener(event: 'close', listener: () => void): this;
  addListener(event: 'data', listener: (chunk: any) => void): this;
  addListener(event: 'end', listener: () => void): this;
  addListener(event: 'error', listener: (err: Error) => void): this;
  addListener(event: 'pause', listener: () => void): this;
  addListener(event: 'readable', listener: () => void): this;
  addListener(event: 'resume', listener: () => void): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;

  emit(event: 'close'): boolean;
  emit(event: 'data', chunk: any): boolean;
  emit(event: 'end'): boolean;
  emit(event: 'error', err: Error): boolean;
  emit(event: 'pause'): boolean;
  emit(event: 'readable'): boolean;
  emit(event: 'resume'): boolean;
  emit(event: string | symbol, ...args: any[]): boolean;

  on(event: 'close', listener: () => void): this;
  on(event: 'data', listener: (chunk: any) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'pause', listener: () => void): this;
  on(event: 'readable', listener: () => void): this;
  on(event: 'resume', listener: () => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;

  once(event: 'close', listener: () => void): this;
  once(event: 'data', listener: (chunk: any) => void): this;
  once(event: 'end', listener: () => void): this;
  once(event: 'error', listener: (err: Error) => void): this;
  once(event: 'pause', listener: () => void): this;
  once(event: 'readable', listener: () => void): this;
  once(event: 'resume', listener: () => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;

  prependListener(event: 'close', listener: () => void): this;
  prependListener(event: 'data', listener: (chunk: any) => void): this;
  prependListener(event: 'end', listener: () => void): this;
  prependListener(event: 'error', listener: (err: Error) => void): this;
  prependListener(event: 'pause', listener: () => void): this;
  prependListener(event: 'readable', listener: () => void): this;
  prependListener(event: 'resume', listener: () => void): this;
  prependListener(event: string | symbol, listener: (...args: any[]) => void): this;

  prependOnceListener(event: 'close', listener: () => void): this;
  prependOnceListener(event: 'data', listener: (chunk: any) => void): this;
  prependOnceListener(event: 'end', listener: () => void): this;
  prependOnceListener(event: 'error', listener: (err: Error) => void): this;
  prependOnceListener(event: 'pause', listener: () => void): this;
  prependOnceListener(event: 'readable', listener: () => void): this;
  prependOnceListener(event: 'resume', listener: () => void): this;
  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;

  removeListener(event: 'close', listener: () => void): this;
  removeListener(event: 'data', listener: (chunk: any) => void): this;
  removeListener(event: 'end', listener: () => void): this;
  removeListener(event: 'error', listener: (err: Error) => void): this;
  removeListener(event: 'pause', listener: () => void): this;
  removeListener(event: 'readable', listener: () => void): this;
  removeListener(event: 'resume', listener: () => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
}
