import { Writable } from 'node:stream';
import { StreamWriter } from './StreamWriter';

export class RequestStream extends Writable {
  readonly #channelId: number;
  readonly #release: () => void;
  readonly #writer: StreamWriter;

  public constructor(channelId: number, writer: StreamWriter, release: () => void) {
    super({ objectMode: true });
    this.#channelId = channelId;
    this.#writer = writer;
    this.#release = release;
  }

  public _write(chunk: any, encoding: BufferEncoding, callback: (error?: (Error | null)) => void): void {
    if (chunk.length === 0) {
      callback(null);
      return;
    }

    this.#writer.channel(this.#channelId);
    this.#writer.stream();
    if (typeof chunk === 'string') {
      this.#writer.writeUtf8(chunk, callback);
    } else {
      this.#writer.writeBuffer(chunk, callback);
    }
  }

  public _final(callback: (error?: (Error | null)) => void) {
    this.#writer.channel(this.#channelId);
    this.#writer.endStream(callback);
    this.#release();
  }
}
