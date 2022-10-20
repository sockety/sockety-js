import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

export const ABORT = Symbol();
export const PUSH = Symbol();
export const END = Symbol();

// TODO: Handle backpressure
export class IncomingMessageStream extends Readable {
  #buffer: Buffer[] = [];
  #waiting = false;
  #ended = false;

  public constructor() {
    super({ objectMode: true });
  }

  public _read(size: number): void {
    if (size === 0) {
      return;
    } else if (this.#buffer.length > 0) {
      this.push(this.#buffer.shift());
    } else if (this.#ended) {
      this.push(null);
    } else {
      this.#waiting = true;
    }
  }

  public [PUSH](data: Buffer): void {
    if (this.#waiting) {
      this.#waiting = false;
      this.push(data);
    } else {
      this.#buffer.push(data);
      this.emit('readable');
    }
  }

  public [END](): void {
    this.#ended = true;
    if (this.#waiting) {
      this.#waiting = false;
    }
    this.emit('end');
  }

  public [ABORT](): void {
    this.#buffer = [];
    this.emit('error', 'The incoming message was aborted');
  }
}
