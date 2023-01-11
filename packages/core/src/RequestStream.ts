import { Writable } from 'node:stream';
import { StreamWriter } from './write/StreamWriter';
import { AttachStream } from './symbols';
import { noop } from './noop';

type SendCallback = (error: Error | null | undefined) => void;
type WriteCallback = () => void;

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

  // eslint-disable-next-line no-underscore-dangle
  public _write(chunk: any, encoding: any, sent: SendCallback): void {
    if (this.#attached) {
      this.#write(chunk, sent);
    } else {
      this.#queued.push(() => this.#write(chunk, sent));
    }
  }

  // eslint-disable-next-line no-underscore-dangle
  public _final(sent: SendCallback): void {
    if (this.#attached) {
      this.#end(sent);
    } else {
      this.#queued.push(() => this.#end(sent));
    }
  }

  public [AttachStream](channel: number, sent: SendCallback = noop, written: WriteCallback = noop): void {
    this.#written = written;
    this.#sent = sent;
    this.#attached = true;
    this.#channel = channel;
    this.#queued.forEach((op) => op());
    this.#queued = [];
  }
}
