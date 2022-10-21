import { Writable } from 'node:stream';
import { UUID } from '@sockety/uuid';
import { DrainListener } from './DrainListener';

export interface BufferedWritableOptions {
  poolSize?: number;
  noZeroFillUtilizedBuffer?: boolean;
  reservedOversizeBytes?: number;
}

type Callback = (error: Error | null | undefined) => void;

const NONE = Buffer.allocUnsafe(0);

// TODO: Extract
class AggregatedCallback {
  #listeners: Callback[] | undefined = [];
  #error: Error | null | undefined = undefined;

  public add(callback?: Callback): void {
    if (!callback) {
      return;
    } else if (this.#listeners) {
      this.#listeners.push(callback);
    } else {
      // TODO: Consider nextTick
      callback(this.#error);
    }
  }

  public readonly callback: Callback = (error) => {
    if (!this.#listeners) {
      return;
    }
    this.#error = error;
    const listeners = this.#listeners;
    this.#listeners = undefined;

    // TODO: Consider nextTick
    listeners.forEach((listener) => listener(error));
  };

  public static done(error: Error | null | undefined): AggregatedCallback {
    const callback = new AggregatedCallback();
    callback.callback(error);
    return callback;
  }
}

// TODO: Handle backpressure?
// TODO: Consider boolean for all writes
export class BufferedWritable {
  readonly #writable: Writable;
  readonly #drain: DrainListener;
  readonly #zeroFillUtilizedBuffer: boolean;
  readonly #reservedOversizeBytes: number;
  readonly #poolSize: number;

  #corked = false;
  #scheduled = false;

  #pool = NONE;
  #poolCurrentSize = 0;
  #poolOffset = 0;
  #poolStart = 0;
  #empty = true;

  #prevCallback = AggregatedCallback.done(null);
  #callback = new AggregatedCallback();

  // This may be used, to detect if the buffer length should be notified or not
  // TODO: Consider options
  readonly #inlineBufferSize: number;
  readonly #inlineUtf8Size: number;

  public constructor(writable: Writable, options: BufferedWritableOptions = {}) {
    this.#writable = writable;
    this.#drain = new DrainListener(this.#writable);
    this.#zeroFillUtilizedBuffer = !options.noZeroFillUtilizedBuffer;
    this.#reservedOversizeBytes = options.reservedOversizeBytes ?? 20;
    this.#poolSize = options.poolSize ?? 16_384;
    this.#pool = Buffer.allocUnsafe(this.#poolSize);

    // TODO: Consider nicer way
    this.#inlineBufferSize = Math.min(this.#poolSize / 2, 64);
    this.#inlineUtf8Size = Math.min(this.#poolSize, 1000);
  }

  public get needsDrain(): boolean {
    return this.#writable.writableNeedDrain;
  }

  public drained(fn: (immediate: boolean) => void): void {
    if (this.needsDrain) {
      this.#drain.listen(() => fn(false));
    } else {
      fn(true);
    }
  }

  #write(data: Buffer | string, callback?: Callback): boolean {
    if (data.length === 0) {
      return !this.#writable.writableNeedDrain;
    }

    // Rebuild callback
    this.#callback.add(callback);
    this.#prevCallback = this.#callback;
    this.#callback = new AggregatedCallback();
    this.#empty = true;

    // Send
    this.#cork();
    return this.#writable.write(data, this.#prevCallback.callback);
  }

  #cork(): void {
    if (this.#corked) {
      return;
    }
    this.#writable.cork();
    this.#corked = true;
    this.#schedule();
  }

  #uncork(): void {
    if (!this.#corked) {
      return;
    }
    this.#corked = false;
    this.#writable.uncork();
  }

  #poolUpdated(): void {
    // TODO: Consider running this.#schedule() only for "safe" operations
    this.#schedule();
    this.#empty = false;
  }

  #schedule(): void {
    if (this.#scheduled) {
      return;
    }
    this.#scheduled = true;
    process.nextTick(() => this.#flush());
  }

  #flush(): void {
    this.#scheduled = false;
    this.#commit();
    this.#uncork();
  }

  #commit(): void {
    const pool = this.#pool;
    const start = this.#poolStart;
    const end = this.#poolOffset;

    if (start >= end) {
      return;
    }

    // Clear sensitive data when it is no longer needed
    const callback = this.#zeroFillUtilizedBuffer
      ? () => {
        // Do not need to clear, when there is new buffer pool - it should be GCed anyway
        // TODO: Confirm that
        if (this.#pool === pool) {
          pool.fill(0, start, end);
        }
      }
      : undefined;
    this.#write(pool.subarray(start, end), callback);
    this.#poolStart = this.#poolOffset;
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

    // Decide what size should the new pool have - either default, or oversize if not enough
    const poolSize = length > this.#poolSize ? length + this.#reservedOversizeBytes : this.#poolSize;

    // Apply current data
    this.#commit();

    // Regenerate pool
    this.#pool = Buffer.allocUnsafe(poolSize);
    this.#poolCurrentSize = poolSize;
    this.#poolStart = 0;
    this.#poolOffset = 0;
  }

  public shouldInlineBuffer(bufferLength: number): boolean {
    return bufferLength <= this.#inlineBufferSize;
  }

  public shouldInlineUtf8(byteLength: number): boolean {
    return byteLength < this.#inlineUtf8Size;
  }

  public write(data: Buffer, callback?: Callback): boolean {
    const length = data.length;
    if (!this.shouldInlineBuffer(length)) {
      this.#commit();
      return this.#write(data, callback);
    }
    this.arrangeSize(length);
    this.#poolOffset += data.copy(this.#pool, this.#poolOffset);
    this.#poolUpdated();
    this.addCallback(callback);
    // TODO: Consider writableDrain instead
    return true;
  }

  public unsafeWriteUint8(uint8: number, callback?: Callback): void {
    this.#pool[this.#poolOffset++] = uint8;
    this.#poolUpdated();
    this.addCallback(callback);
  }

  public writeUint8(uint8: number, callback?: Callback): void {
    this.arrangeSize(1);
    this.unsafeWriteUint8(uint8, callback);
  }

  public unsafeWriteUint16(uint16: number, callback?: Callback): void {
    this.#pool[this.#poolOffset++] = uint16 & 0x00ff;
    this.#pool[this.#poolOffset++] = uint16 >> 8;
    this.#poolUpdated();
    this.addCallback(callback);
  }

  public writeUint16(uint16: number, callback?: Callback): void {
    this.arrangeSize(2);
    this.unsafeWriteUint16(uint16, callback);
  }

  public unsafeWriteUint24(uint24: number, callback?: Callback): void {
    this.#pool[this.#poolOffset++] = uint24 & 0x0000ff;
    this.#pool[this.#poolOffset++] = uint24 >> 8;
    this.#pool[this.#poolOffset++] = uint24 >> 16;
    this.#poolUpdated();
    this.addCallback(callback);
  }

  public writeUint24(uint24: number, callback?: Callback): void {
    this.arrangeSize(3);
    this.unsafeWriteUint24(uint24, callback);
  }

  public unsafeWriteUint32(uint32: number, callback?: Callback): void {
    this.#pool[this.#poolOffset++] = uint32 & 0x000000ff;
    this.#pool[this.#poolOffset++] = uint32 >> 8;
    this.#pool[this.#poolOffset++] = uint32 >> 16;
    this.#pool[this.#poolOffset++] = uint32 >> 24;
    this.#poolUpdated();
    this.addCallback(callback);
  }

  public writeUint32(uint32: number, callback?: Callback): void {
    this.arrangeSize(4);
    this.unsafeWriteUint32(uint32, callback);
  }

  public unsafeWriteUint48(uint48: number, callback?: Callback): void {
    this.#pool.writeUintLE(uint48, this.#poolOffset, 6);
    this.#poolOffset += 6;
    this.#poolUpdated();
    this.addCallback(callback);
  }

  public writeUint48(uint48: number, callback?: Callback): void {
    this.arrangeSize(6);
    this.unsafeWriteUint48(uint48, callback);
  }

  public unsafeWriteUtf8(data: string, callback?: Callback): void {
    if (data.length === 0) {
      this.addCallback(callback);
      return;
    }
    this.#poolOffset += this.#pool.write(data, this.#poolOffset);
    this.#poolUpdated();
    this.addCallback(callback);
  }

  public writeUtf8(data: string, callback?: Callback): boolean {
    const length = Buffer.byteLength(data);
    if (!this.shouldInlineUtf8(length)) {
      this.#commit();
      this.#empty = false;
      return this.#write(data, callback);
    }
    this.arrangeSize(length);
    this.unsafeWriteUtf8(data, callback);
    // TODO: Consider writableDrain instead
    return true;
  }

  public unsafeWriteUuid(uuid: UUID, callback?: Callback): void {
    uuid.write(this.#pool, this.#poolOffset);
    this.#poolOffset += 16;
    this.#poolUpdated();
    this.addCallback(callback);
  }

  public writeUuid(uuid: UUID, callback?: Callback): void {
    this.arrangeSize(16);
    this.unsafeWriteUuid(uuid, callback);
  }
}
