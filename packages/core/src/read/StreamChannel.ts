import type { Buffer } from 'node:buffer';
import type { UUID } from '@sockety/uuid';
import { createMessagePacketReader } from '../buffer-readers/createMessagePacketReader';
import { createResponsePacketReader } from '../buffer-readers/createResponsePacketReader';
import { ConsumeData, ConsumeFile, ConsumeFilesHeader, ConsumeStream, EndStream } from '../symbols';
import { RawMessage } from './RawMessage';
import { RawResponse } from './RawResponse';

export interface StreamChannelOptions<M extends RawMessage, R extends RawResponse> {
  // eslint-disable-next-line max-len
  createMessage: (id: UUID, action: string, dataSize: number, filesCount: number, totalFilesSize: number, hasStream: boolean, expectsResponse: boolean) => M;
  // eslint-disable-next-line max-len
  createResponse: (id: UUID, parentId: UUID, dataSize: number, filesCount: number, totalFilesSize: number, hasStream: boolean, expectsResponse: boolean) => R;
}

// TODO: Add option (callback?) to allow different file size than specified
// TODO: Extract finalization to separate method
export class StreamChannel<M extends RawMessage = RawMessage, R extends RawResponse = RawResponse> {
  readonly #createMessage: StreamChannelOptions<M, R>['createMessage'];
  readonly #createResponse: StreamChannelOptions<M, R>['createResponse'];

  #consumingMessage = false;
  #consumingResponse = false;
  #consumingStream = false;
  #consumingFiles = false;
  #consumingData = false;
  #expectsResponse = false;

  // TODO: Set optional?
  #message!: M | R;
  #parentId!: UUID;
  #id!: UUID;
  #action!: string;
  #dataSize!: number;
  #filesCount!: number;
  #filesSize!: number;
  #hasStream!: boolean;
  #fileIndex!: number;
  #filesToProcess = 0;

  public constructor(options: Partial<StreamChannelOptions<M, R>> = {}) {
    this.#createMessage = options.createMessage ?? ((...args: any) => new (RawMessage as any)(...args));
    this.#createResponse = options.createResponse ?? ((...args: any) => new (RawResponse as any)(...args));
  }

  #setParentId = (id: UUID) => {
    this.#parentId = id;
  };

  #setId = (id: UUID) => {
    this.#id = id;
  };

  #setAction = (action: string) => {
    this.#action = action;
  };

  #setDataSize = (dataSize: number) => {
    this.#dataSize = dataSize;

    if (dataSize > 0) {
      this.#consumingData = true;
    }
  };

  #setFilesCount = (filesCount: number) => {
    this.#filesCount = filesCount;
    this.#filesToProcess = filesCount; // TODO: Ignore 0B files?

    if (filesCount > 0) {
      this.#consumingFiles = true;
    }
  };

  #setFilesSize = (filesSize: number) => {
    this.#filesSize = filesSize;
    if (this.#consumingMessage) {
      this.#message = this.#createMessage(
        this.#id,
        this.#action,
        this.#dataSize,
        this.#filesCount,
        this.#filesSize,
        this.#hasStream,
        this.#expectsResponse,
      );
    } else {
      this.#message = this.#createResponse(
        this.#id,
        this.#parentId,
        this.#dataSize,
        this.#filesCount,
        this.#filesSize,
        this.#hasStream,
        this.#expectsResponse,
      );
    }
  };

  #addFileHeader = ({ name, size }: { name: string, size: number }) => {
    this.#message[ConsumeFilesHeader](name, size);
  };

  #endMessageHeader = () => {
    this.#consumingMessage = false;
    this.#consumingResponse = false;
  };

  #consumeMessage = createMessagePacketReader({
    id: this.#setId,
    action: this.#setAction,
    dataSize: this.#setDataSize,
    filesCount: this.#setFilesCount,
    filesSize: this.#setFilesSize,
    filesHeader: this.#addFileHeader,
    _end: this.#endMessageHeader,
  }).readOne;

  #consumeResponse = createResponsePacketReader({
    parentId: this.#setParentId,
    id: this.#setId,
    dataSize: this.#setDataSize,
    filesCount: this.#setFilesCount,
    filesSize: this.#setFilesSize,
    filesHeader: this.#addFileHeader,
    _end: this.#endMessageHeader,
  }).readOne;

  #isConsuming(): boolean {
    return (
      this.#consumingMessage || this.#consumingResponse ||
      this.#consumingStream || this.#consumingFiles || this.#consumingData
    );
  }

  #endMessageIfReady(): void {
    if (!this.#isConsuming()) {
      // @ts-ignore: clean memory
      this.#message = undefined;
    }
  }

  public isMessage(): boolean {
    return this.#consumingMessage;
  }

  public startMessage(hasStream: boolean): void {
    if (this.#isConsuming()) {
      throw new Error('There is already packet in process.');
    }
    this.#hasStream = hasStream;
    this.#consumingMessage = true;
    this.#consumingStream = hasStream;
  }

  public startResponse(hasStream: boolean): void {
    if (this.#isConsuming()) {
      throw new Error('There is already packet in process.');
    }
    this.#consumingResponse = true;
    this.#consumingStream = hasStream;
  }

  public setExpectsResponse(expectsResponse: boolean): void {
    if (!this.#consumingMessage && !this.#consumingResponse) {
      throw new Error('There is no message in process.');
    }
    this.#expectsResponse = expectsResponse;
  }

  public consumeMessage(buffer: Buffer, offset: number, end: number): M | null {
    if (!this.#consumingMessage) {
      throw new Error('There is no message in process.');
    }
    const hadMessage = this.#message;
    if (this.#consumeMessage(buffer, offset, end) !== end) {
      throw new Error('The message packet size was malformed.');
    }
    const result = (!hadMessage && this.#message) || null;
    this.#endMessageIfReady();
    return result as any;
  }

  public consumeResponse(buffer: Buffer, offset: number, end: number): R | null {
    if (!this.#consumingResponse) {
      throw new Error('There is no response in process.');
    }
    const hadMessage = this.#message;
    if (this.#consumeResponse(buffer, offset, end) !== end) {
      throw new Error('The response packet size was malformed.');
    }
    const result = (!hadMessage && this.#message) || null;
    this.#endMessageIfReady();
    return result as any;
  }

  public consumeData(buffer: Buffer): void {
    if (!this.#consumingData) {
      throw new Error('There is no data expected.');
    }

    if (!this.#message[ConsumeData](buffer)) {
      this.#consumingData = false;
      this.#endMessageIfReady();
    }
  }

  public consumeStream(buffer: Buffer): void {
    if (!this.#consumingStream) {
      throw new Error('There is no stream in process.');
    }
    this.#message[ConsumeStream](buffer);
  }

  public finishStream(): void {
    if (!this.#consumingStream) {
      throw new Error('There is no stream in process.');
    }
    this.#consumingStream = false;
    if (this.#message) {
      this.#message[EndStream]();
      this.#endMessageIfReady();
    }
  }

  public abort(): void {
    // console.log('[ABORT]');
    // TODO: Reset #message
    // TODO: Inform #message
    // TODO: Reset state
  }

  public setFileIndex(index: number): void {
    if (index >= this.#filesCount) {
      throw new Error('Received File with index higher than in message.');
    } else if (!this.#message) {
      throw new Error('There is no message processed.');
    }
    this.#fileIndex = index;
  }

  public appendFileContent(content: Buffer): void {
    if (!this.#message) {
      throw new Error('There is no message processed.');
    }
    this.#message[ConsumeFile](this.#fileIndex, content);
  }

  public endFile(index: number): void {
    if (!this.#consumingFiles) {
      throw new Error('There is no message processed.');
    }

    if (!this.#message.files[index].loaded) {
      this.#filesToProcess--;
      if (this.#filesToProcess === 0) {
        this.#consumingFiles = false;
        this.#endMessageIfReady();
      }
    }
    // TODO: Verify size
  }
}
