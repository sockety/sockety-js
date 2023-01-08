import { Buffer } from 'node:buffer';
import { UUID } from '@sockety/uuid';
import { End, Push, EndStream, ConsumeStream, ConsumeData, ConsumeFilesHeader, ConsumeFile, EndFile } from '../symbols';
import { MessageStream } from './MessageStream';
import { MessageFileStream } from './MessageFileStream';
import { MessageDataStream } from './MessageDataStream';

export class MessageBase {
  readonly #id: UUID;
  readonly #dataSize: number;
  readonly #filesCount: number;
  readonly #totalFilesSize: number;
  readonly #expectsResponse: boolean;
  readonly stream: MessageStream | null;
  readonly data: MessageDataStream | null;
  readonly #files: MessageFileStream[] = [];

  public constructor(
    id: UUID,
    dataSize: number,
    filesCount: number,
    totalFilesSize: number,
    hasStream: boolean,
    expectsResponse: boolean,
  ) {
    this.#id = id;
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

  public [ConsumeStream](data: Buffer): void {
    if (!this.stream) {
      throw new Error('There is no stream expected.');
    }
    this.stream[Push](data);
  }

  public [EndStream](): void {
    this.stream?.[End]();
  }

  public [ConsumeData](data: Buffer): boolean {
    if (!this.data) {
      throw new Error('There is no data expected.');
    }

    const size = data.length + this.data.receivedSize;
    if (size > this.#dataSize) {
      throw new Error('Data sent over expected size.');
    }
    this.data[Push](data);
    if (size === this.#dataSize) {
      this.data[End]();
      return false;
    }
    return true;
  }

  public [ConsumeFilesHeader](name: string, size: number): void {
    this.#files.push(new MessageFileStream(name, size));
  }

  public [ConsumeFile](index: number, data: Buffer): void {
    const file = this.#files[index];
    if (!file) {
      throw new Error(`There is no file ${index} available yet.`);
    }
    // TODO: Verify size (disallow if it's over the expected, and it's not allowed)
    file[Push](data);
  }

  public [EndFile](index: number): void {
    const file = this.#files[index];
    if (!file) {
      throw new Error(`There is no file ${index} available yet.`);
    } else if (file.loaded) {
      throw new Error('File has been already finished.');
    }
    // TODO: Verify size (disallow if it's less than expected, and it's not allowed)
    file[End]();
  }

  public get files(): MessageFileStream[] {
    return this.#files;
  }
  // TODO: Support GOAWAY/ABORT, and pass that information to inner streams
}
