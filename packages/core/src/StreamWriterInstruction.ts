import { WritableBuffer } from './WritableBuffer';
import { noop } from './noop';

type ExecuteWrite = (buffer: WritableBuffer) => void;
type SendCallback = (error: Error | null | undefined) => void;

function createRunner(run: ExecuteWrite, sent: SendCallback): ExecuteWrite {
  if (sent === noop) {
    return run;
  }
  return (buffer) => {
    run(buffer);
    buffer.addCallback(sent);
  };
}

// TODO: Consider splitting information about bytes with bytes sent and bytes buffered
export class StreamWriterInstruction {
  #run: ExecuteWrite;
  public bytes: number;
  public next: StreamWriterInstruction | undefined;

  public constructor(run: ExecuteWrite, bytes: number, sent: SendCallback = noop) {
    this.bytes = bytes;
    this.#run = createRunner(run, sent);
  }

  public decrementBytes(bytes: number): void {
    this.bytes -= bytes;
  }

  public incrementBytes(bytes: number): void {
    this.bytes += bytes;
  }

  public disable(): void {
    this.#run = noop;
    this.bytes = 0;
  }

  public replace(run: ExecuteWrite, bytes = this.bytes, sent: SendCallback = noop): void {
    this.bytes = bytes;
    this.#run = createRunner(run, sent);
  }

  public callback(sent: SendCallback = noop): void {
    this.#run = createRunner(this.#run, sent);
  }

  public run(buffer: WritableBuffer): void {
    this.#run(buffer);
  }
}
