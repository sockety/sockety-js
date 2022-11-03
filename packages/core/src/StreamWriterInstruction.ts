import { WritableBuffer } from './WritableBuffer';

const noop = () => {};

type ExecuteWrite = (buffer: WritableBuffer) => void;
type SendCallback = (error: Error | null | undefined) => void;
type WriteCallback = () => void;

// TODO: Consider flattening "written" calls
function createRunner(run: ExecuteWrite, sent: SendCallback, written: WriteCallback): ExecuteWrite {
  if (sent === noop && written == noop) {
    return run;
  } else if (sent === noop) {
    return (buffer) => {
      run(buffer);
      process.nextTick(written);
    };
  }
  return (buffer) => {
    run(buffer);
    buffer.addCallback(sent);
    process.nextTick(written);
  };
}

// TODO: Consider splitting information about bytes with bytes sent and bytes buffered
export class StreamWriterInstruction {
  #run: ExecuteWrite;
  public bytes: number;
  public next: StreamWriterInstruction | undefined;

  public constructor(run: ExecuteWrite, bytes: number, sent: SendCallback = noop, written: WriteCallback = noop) {
    this.bytes = bytes;
    this.#run = createRunner(run, sent, written);
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

  public replace(run: ExecuteWrite, bytes = this.bytes, sent: SendCallback = noop, written: WriteCallback = noop): void {
    this.bytes = bytes;
    this.#run = createRunner(run, sent, written);
  }

  public include(run: ExecuteWrite, bytes: number, sent: SendCallback = noop, written: WriteCallback = noop): void {
    const prev = this.#run;
    this.#run = createRunner((buffer) => {
      prev(buffer);
      run(buffer);
    }, sent, written);
  }

  public callback(sent: SendCallback = noop, written: WriteCallback = noop): void {
    this.#run = createRunner(this.#run, sent, written);
  }

  public run(buffer: WritableBuffer): void {
    this.#run(buffer);
  }
}
