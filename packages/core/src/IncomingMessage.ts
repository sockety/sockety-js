import { Buffer } from 'node:buffer';
import { UUID } from '@sockety/uuid';
import { END, IncomingMessageStream, PUSH } from './IncomingMessageStream';
import { CONSUME, IncomingMessageFileStream, END as FILE_STREAM_END } from './IncomingMessageFileStream';

const NONE = Buffer.allocUnsafe(0);

export const END_STREAM = Symbol();
export const CONSUME_STREAM = Symbol();
export const CONSUME_DATA = Symbol();
export const CONSUME_FILE = Symbol();
export const END_FILE = Symbol();
export const CONSUME_FILES_HEADER = Symbol();

export class IncomingMessage {
  readonly #id: UUID;
  readonly #action: string;
  readonly #dataSize: number;
  readonly #filesCount: number;
  readonly #totalFilesSize: number;
  readonly #expectsResponse: boolean;
  readonly stream: IncomingMessageStream | null;
  readonly #files: IncomingMessageFileStream[] = [];

  public constructor(
    id: UUID,
    action: string,
    dataSize: number,
    filesCount: number,
    totalFilesSize: number,
    hasStream: boolean,
    expectsResponse: boolean,
  ) {
    this.#id = id;
    this.#action = action;
    this.#dataSize = dataSize;
    this.#filesCount = filesCount;
    this.#totalFilesSize = totalFilesSize;
    this.#expectsResponse = expectsResponse;
    this.stream = hasStream ? new IncomingMessageStream() : null;
  }

  public get id(): UUID {
    return this.#id;
  }

  public get action(): string {
    return this.#action;
  }

  public get dataSize(): number {
    return this.#dataSize;
  }

  public get filesCount(): number {
    return this.#filesCount;
  }

  public get totalFilesSize(): number {
    return this.#totalFilesSize;
  }

  public get expectsResponse(): boolean {
    return this.#expectsResponse;
  }

  public [CONSUME_STREAM](data: Buffer): void {
    if (!this.stream) {
      throw new Error('There is no stream expected.');
    }
    this.stream![PUSH](data);
  }

  public [END_STREAM](): void {
    this.stream?.[END]();
  }

  public [CONSUME_DATA](data: Buffer): void {
    // TODO: Create data stream
  }

  // TODO: Types
  // TODO: Add handler to read files header
  // TODO: Consider if files should have unique names
  // TODO: Paths in file names are required, for tasks like copying folder
  public [CONSUME_FILES_HEADER](name: string, size: number): void {
    // console.log('FILES HEADER', name, size);
    this.#files.push(new IncomingMessageFileStream(name, size));
  }

  // TODO: Consider boolean for backpressure?
  public [CONSUME_FILE](index: number, data: Buffer): void {
    const file = this.#files[index];
    if (!file) {
      throw new Error(`There is no file ${index} available yet.`);
    }
    // TODO: Verify size (disallow if it's over the expected, and it's not allowed)
    file[CONSUME](data);
  }

  public [END_FILE](index: number): void {
    const file = this.#files[index];
    if (!file) {
      throw new Error(`There is no file ${index} available yet.`);
    } else if (file.loaded) {
      throw new Error(`File has been already finished.`);
    }
    // TODO: Verify size (disallow if it's less than expected, and it's not allowed)
    file[FILE_STREAM_END]();
  }

  // TODO: Delete
  public get files(): IncomingMessageFileStream[] {
    return this.#files;
  }

  // TODO: Add option to yield files?
  // TODO: Add helpers for 'finish()'
  // TODO: Add helpers for ack/revoke
  // TODO: Support GOAWAY/ABORT, and pass that information to inner streams
}
