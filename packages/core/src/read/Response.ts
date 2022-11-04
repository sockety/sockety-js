import { Buffer } from 'node:buffer';
import { UUID } from '@sockety/uuid';
import { END_STREAM, CONSUME_STREAM, CONSUME_DATA, CONSUME_FILE, END_FILE, CONSUME_FILES_HEADER } from './Message';
import { END, MessageStream, PUSH } from './MessageStream';
import { MessageFileStream } from './MessageFileStream';
import { MessageDataStream } from './MessageDataStream';

export class Response {
  readonly #id: UUID;
  readonly #parentId: UUID;
  readonly #dataSize: number;
  readonly #filesCount: number;
  readonly #totalFilesSize: number;
  readonly #expectsResponse: boolean;
  readonly stream: MessageStream | null;
  readonly data: MessageDataStream | null;
  readonly #files: MessageFileStream[] = [];

  public constructor(
    id: UUID,
    parentId: UUID,
    dataSize: number,
    filesCount: number,
    totalFilesSize: number,
    hasStream: boolean,
    expectsResponse: boolean,
  ) {
    this.#id = id;
    this.#parentId = parentId;
    this.#dataSize = dataSize;
    this.#filesCount = filesCount;
    this.#totalFilesSize = totalFilesSize;
    this.#expectsResponse = expectsResponse;
    this.stream = hasStream ? new MessageStream() : null;
    this.data = dataSize === 0 ? null : new MessageDataStream(dataSize);
  }

  public get id(): UUID {
    return this.#id;
  }

  public get parentId(): UUID {
    return this.#parentId;
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
    this.stream[PUSH](data);
  }

  public [END_STREAM](): void {
    this.stream?.[END]();
  }

  public [CONSUME_DATA](data: Buffer): boolean {
    if (!this.data) {
      throw new Error('There is no data expected.');
    }

    const size = data.length + this.data.receivedSize;
    if (size > this.#dataSize) {
      throw new Error('Data sent over expected size.');
    }
    this.data[PUSH](data);
    if (size === this.#dataSize) {
      this.data[END]();
      return false;
    }
    return true;
  }

  // TODO: Types
  // TODO: Add handler to read files header
  // TODO: Consider if files should have unique names
  // TODO: Paths in file names are required, for tasks like copying folder
  public [CONSUME_FILES_HEADER](name: string, size: number): void {
    this.#files.push(new MessageFileStream(name, size));
  }

  // TODO: Consider boolean for backpressure?
  public [CONSUME_FILE](index: number, data: Buffer): void {
    const file = this.#files[index];
    if (!file) {
      throw new Error(`There is no file ${index} available yet.`);
    }
    // TODO: Verify size (disallow if it's over the expected, and it's not allowed)
    file[PUSH](data);
  }

  public [END_FILE](index: number): void {
    const file = this.#files[index];
    if (!file) {
      throw new Error(`There is no file ${index} available yet.`);
    } else if (file.loaded) {
      throw new Error(`File has been already finished.`);
    }
    // TODO: Verify size (disallow if it's less than expected, and it's not allowed)
    file[END]();
  }

  public get files(): MessageFileStream[] {
    return this.#files;
  }

  // TODO: Add option to yield files?
  // TODO: Add helpers for 'finish()'
  // TODO: Add helpers for ack/revoke
  // TODO: Support GOAWAY/ABORT, and pass that information to inner streams
}
