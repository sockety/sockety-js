import { Writable } from 'node:stream';
import { StreamWriter } from './StreamWriter';
import { AttachStream } from './symbols';

type SendCallback = (error: Error | null | undefined) => void;
type WriteCallback = () => void;

const noop = () => {};

export class RequestStream extends Writable {
  readonly #writer: StreamWriter;
  #queued: (() => void)[] = [];
  #channel!: number;
  #sent!: SendCallback;
  #written?: WriteCallback;
  #attached = false;

  public constructor(writer: StreamWriter) {
    super({ objectMode: true });
    this.#writer = writer;
  }

  #write(chunk: Buffer | string, sent: SendCallback): void {
    this.#writer.channel(this.#channel);
    this.#writer.stream();
    if (typeof chunk === 'string') {
      this.#writer.writeUtf8(chunk, sent);
    } else {
      this.#writer.writeBuffer(chunk, sent);
    }
  }

  #end(callback: SendCallback): void {
    this.#writer.channel(this.#channel);
    this.#writer.endStream((error) => {
      this.#sent?.(error);
      callback(error);
    });
    this.#written?.();
  }

  public _write(chunk: any, encoding: BufferEncoding, sent: SendCallback): void {
    if (this.#attached) {
      this.#write(chunk, sent);
    } else {
      this.#queued.push(() => this.#write(chunk, sent));
    }
  }

  public _final(sent: SendCallback): void {
    if (this.#attached) {
      this.#end(sent);
    } else {
      this.#queued.push(() => this.#end(sent));
    }
  }

  public [AttachStream](channel: number, sent: SendCallback = noop, written?: WriteCallback): void {
    this.#written = written;
    this.#sent = sent;
    this.#attached = true;
    this.#channel = channel;
    this.#queued.forEach((op) => op());
    this.#queued = [];
  }
}
