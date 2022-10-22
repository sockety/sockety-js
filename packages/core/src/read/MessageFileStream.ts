import { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';

export const CONSUME = Symbol();
export const CLOSE = Symbol();
export const END = Symbol();

export class MessageFileStream extends Readable {
  public readonly name: string;
  public readonly size: number;
  #loaded = false;
  #size = 0;
  #buffer: Buffer[] = [];

  public constructor(name: string, size: number) {
    super();
    this.name = name;
    this.size = size;
  }

  public [CONSUME](data: Buffer): void {
    if (data.length > this.bytesLeft) {
      data = data.subarray(0, Number(this.bytesLeft));
    }
    this.#size += data.length;
    this.#buffer.push(data);
    this.push(Buffer.allocUnsafe(0));
  }

  public _read(size: number): void {
    while (size > 0 && this.#buffer.length > 0) {
      const length = this.#buffer[0].length;
      if (length > size) {
        this.push(this.#buffer[0].subarray(0, size));
        this.#buffer[0] = this.#buffer[0].subarray(size);
        break;
      } else {
        this.push(this.#buffer.shift());
        size -= length;
      }
    }
    if (this.loaded && this.#buffer.length === 0) {
      this.push(null);
    }
  }

  public get receivedSize(): number {
    return this.#size;
  }

  public get bytesLeft(): number {
    return this.size - this.#size;
  }

  public get loaded(): boolean {
    return this.#loaded;
  }

  public [END](): void {
    this.#loaded = true;
    this.push(null);
  }

  public [CLOSE](): void {
    if (!this.loaded) {
      this.emit('error', new Error('Message has been closed before file loaded'));
    }
  }
}
