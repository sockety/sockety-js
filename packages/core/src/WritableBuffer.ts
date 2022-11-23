import { Writable } from 'node:stream';
import { UUID } from '@sockety/uuid';
import { DrainListener } from './DrainListener';
import { AggregatedCallback } from './AggregatedCallback';

type Callback = (error: Error | null | undefined) => void;

const NONE = Buffer.allocUnsafeSlow(0);

// TODO: Handle backpressure?
export class WritableBuffer {
  readonly #writable: Writable;
  readonly #drain: DrainListener;

  #pool = NONE;
  #poolCurrentSize = 0;
  #poolOffset = 0;
  #poolStart = 0;
  #empty = true;

  #prevCallback = AggregatedCallback.done(null);
  #callback = new AggregatedCallback();

  public constructor(writable: Writable) {
    this.#writable = writable;
    this.#drain = new DrainListener(this.#writable);
  }

  public get needsDrain(): boolean {
    return this.#writable.writableNeedDrain;
  }

  public drained(fn: () => void): void {
    if (this.needsDrain) {
      this.#drain.listen(fn);
    } else {
      fn();
    }
  }

  #write(data: Buffer | string, callback?: Callback): void {
    if (data.length === 0) {
      return;
    }

    // Rebuild callback
    this.#callback.add(callback);
    this.#prevCallback = this.#callback;
    this.#callback = new AggregatedCallback();
    this.#empty = true;

    // Send
    this.#writable.write(data, this.#prevCallback.callback);
  }

  #poolUpdated(): void {
    this.#empty = false;
  }

  #commit(): void {
    const pool = this.#pool;
    const start = this.#poolStart;
    const end = this.#poolOffset;

    if (start >= end) {
      return;
    }

    this.#write(pool.subarray(start, end));
    this.#poolStart = this.#poolOffset;
  }

  public send(): void {
    this.#commit();
  }

  public addCallback(callback?: Callback): void {
    const destination = this.#empty ? this.#prevCallback : this.#callback;
    destination.add(callback);
  }

  public arrangeSize(length: number): void {
    // Don't do anything, when there is enough space left in the current pool
    if (this.#poolOffset + length <= this.#poolCurrentSize) {
      return;
    }

    // Apply current data
    this.#commit();

    // Regenerate pool
    this.#pool = Buffer.allocUnsafeSlow(length);
    this.#poolCurrentSize = length;
    this.#poolStart = 0;
    this.#poolOffset = 0;
  }

  public writeBufferInline(data: Buffer): void {
    this.#poolOffset += data.copy(this.#pool, this.#poolOffset);
    this.#poolUpdated();
  }

  public writeBuffer(data: Buffer, callback?: Callback): void {
    this.#commit();
    this.#write(data, callback);
  }

  public writeUint8(uint8: number): void {
    this.#pool[this.#poolOffset++] = uint8;
    this.#poolUpdated();
  }

  public writeUint16(uint16: number): void {
    this.#pool[this.#poolOffset++] = uint16 & 0x00ff;
    this.#pool[this.#poolOffset++] = uint16 >> 8;
    this.#poolUpdated();
  }

  public writeUint24(uint24: number): void {
    this.#pool[this.#poolOffset++] = uint24 & 0x0000ff;
    this.#pool[this.#poolOffset++] = uint24 >> 8;
    this.#pool[this.#poolOffset++] = uint24 >> 16;
    this.#poolUpdated();
  }

  public writeUint32(uint32: number): void {
    this.#pool[this.#poolOffset++] = uint32 & 0x000000ff;
    this.#pool[this.#poolOffset++] = uint32 >> 8;
    this.#pool[this.#poolOffset++] = uint32 >> 16;
    this.#pool[this.#poolOffset++] = uint32 >> 24;
    this.#poolUpdated();
  }

  public writeUint48(uint48: number): void {
    this.#pool.writeUintLE(uint48, this.#poolOffset, 6);
    this.#poolOffset += 6;
    this.#poolUpdated();
  }

  public writeUint(uint: number, byteLength: number): void {
    if (byteLength === 1) {
      this.writeUint8(uint);
    } else if (byteLength === 2) {
      this.writeUint16(uint);
    } else if (byteLength === 3) {
      this.writeUint24(uint);
    } else if (byteLength === 4) {
      this.writeUint32(uint);
    } else if (byteLength === 6) {
      this.writeUint48(uint);
    } else {
      throw new Error('Only 1-4 and 6 bytes are supported.');
    }
  }

  public writeUtf8Inline(data: string): void {
    if (data.length === 0) {
      return;
    }
    this.#poolOffset += this.#pool.write(data, this.#poolOffset);
    this.#poolUpdated();
  }

  public writeUtf8(data: string, callback?: Callback): void {
    this.#commit();
    this.#write(data, callback);
  }

  public writeUuid(uuid: UUID): void {
    uuid.write(this.#pool, this.#poolOffset);
    this.#poolOffset += 16;
    this.#poolUpdated();
  }

  public destroy(): void {
    this.#pool = NONE;
    this.#poolStart = 0;
    this.#poolOffset = 0;
    this.#drain.destroy();
  }
}
