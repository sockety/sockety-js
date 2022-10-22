import { Writable } from 'node:stream';
import { SocketWriter } from './SocketWriter';

export class RequestStream extends Writable {
  #channelId: number;
  #release: () => void;
  #writer: SocketWriter;

  public constructor(channelId: number, writer: SocketWriter, release: () => void) {
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

    this.#writer.ensureChannel(this.#channelId);
    if (typeof chunk === 'string') {
      this.#writer.writeStreamSignature(Buffer.byteLength(chunk));
      this.#writer.writeUtf8(chunk, callback);
    } else {
      this.#writer.writeStreamSignature(chunk.length);
      this.#writer.write(chunk, callback);
    }
  }

  public _final(callback: (error?: (Error | null)) => void) {
    this.#writer.writeStreamEnd(this.#channelId, callback);
    this.#release();
  }
}
