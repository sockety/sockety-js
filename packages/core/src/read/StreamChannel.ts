import type { Buffer } from 'node:buffer';
import { BufferReader } from '@sockety/buffers';
import type { UUID } from '@sockety/uuid';
import {
  FileNameSizeBits,
  FileSizeBits,
  MessageActionSizeBits,
  MessageDataSizeBits,
  MessageFilesCountBits,
  MessageFilesSizeBits,
} from '../constants';
import { ConsumeData, ConsumeFile, ConsumeFilesHeader, ConsumeStream, EndStream } from '../symbols';
import { RawMessage } from './RawMessage';
import { RawResponse } from './RawResponse';

export interface StreamChannelOptions<M extends RawMessage, R extends RawResponse> {
  createMessage: (id: UUID, action: string, dataSize: number, filesCount: number, totalFilesSize: number, hasStream: boolean, expectsResponse: boolean) => M;
  createResponse: (id: UUID, parentId: UUID, dataSize: number, filesCount: number, totalFilesSize: number, hasStream: boolean, expectsResponse: boolean) => R;
}

const createMessageConsumer = new BufferReader()
  .uint8('flags').setInternal('flags')

  .uuid('id')

  .mask<'_actionSize', MessageActionSizeBits>('_actionSize', 'flags', 0b00000010).setInternal('_actionSize')
  .when('_actionSize', MessageActionSizeBits.Uint8, $ => $.uint8('actionSize').setInternal('actionSize'))
  .when('_actionSize', MessageActionSizeBits.Uint16, $ => $.uint16le('actionSize').setInternal('actionSize'))
  .utf8Dynamic('action', 'actionSize')

  .mask<'_dataSize', MessageDataSizeBits>('_dataSize', 'flags', 0b11000000).setInternal('_dataSize')
  .when('_dataSize', MessageDataSizeBits.None, $ => $.constant('dataSize', 0))
  .when('_dataSize', MessageDataSizeBits.Uint8, $ => $.uint8('dataSize'))
  .when('_dataSize', MessageDataSizeBits.Uint16, $ => $.uint16le('dataSize'))
  .when('_dataSize', MessageDataSizeBits.Uint48, $ => $.uint48le('dataSize'))

  .mask<'_filesCount', MessageFilesCountBits>('_filesCount', 'flags', 0b00110000).setInternal('_filesCount')
  .when('_filesCount', MessageFilesCountBits.None, $ => $.constant('filesCount', 0))
  .when('_filesCount', MessageFilesCountBits.Uint8, $ => $.uint8('filesCount'))
  .when('_filesCount', MessageFilesCountBits.Uint16, $ => $.uint16le('filesCount'))
  .when('_filesCount', MessageFilesCountBits.Uint24, $ => $.uint24le('filesCount'))

  .mask<'_filesSize', MessageFilesSizeBits>('_filesSize', 'flags', 0b00001100).setInternal('_filesSize')
  .compute<'__filesSize', number>('__filesSize', $ => `return ${$.read('_filesCount')} === ${MessageFilesCountBits.None} ? -1 : ${$.read('_filesSize')}`).setInternal('__filesSize')
  .when('__filesSize', -1, $ => $.constant('filesSize', 0))
  .when('__filesSize', MessageFilesSizeBits.Uint16, $ => $.uint16le('filesSize'))
  .when('__filesSize', MessageFilesSizeBits.Uint24, $ => $.uint24le('filesSize'))
  .when('__filesSize', MessageFilesSizeBits.Uint32, $ => $.uint32le('filesSize'))
  .when('__filesSize', MessageFilesSizeBits.Uint48, $ => $.uint48le('filesSize'))

  .arrayDynamic('filesHeader', 'filesCount', $ => $
    .uint8('header').setInternal('header')

    .mask<'_size', FileSizeBits>('_size', 'header', 0b00001100).setInternal('_size')
    .when('_size', FileSizeBits.Uint8, $ => $.uint8('size'))
    .when('_size', FileSizeBits.Uint16, $ => $.uint16le('size'))
    .when('_size', FileSizeBits.Uint24, $ => $.uint24le('size'))
    .when('_size', FileSizeBits.Uint48, $ => $.uint48le('size'))

    .mask<'_nameSize', FileNameSizeBits>('_nameSize', 'header', 0b00000010).setInternal('_nameSize')
    .when('_nameSize', FileNameSizeBits.Uint8, $ => $.uint8('nameSize').setInternal('nameSize'))
    .when('_nameSize', FileNameSizeBits.Uint16, $ => $.uint16le('nameSize').setInternal('nameSize'))
    .utf8Dynamic('name', 'nameSize')
  , true)

  .end();

const createResponseConsumer = new BufferReader()
  .uint8('flags').setInternal('flags')

  .uuid('parentId')
  .uuid('id')

  .mask<'_dataSize', MessageDataSizeBits>('_dataSize', 'flags', 0b11000000).setInternal('_dataSize')
  .when('_dataSize', MessageDataSizeBits.None, $ => $.constant('dataSize', 0))
  .when('_dataSize', MessageDataSizeBits.Uint8, $ => $.uint8('dataSize'))
  .when('_dataSize', MessageDataSizeBits.Uint16, $ => $.uint16le('dataSize'))
  .when('_dataSize', MessageDataSizeBits.Uint48, $ => $.uint48le('dataSize'))

  .mask<'_filesCount', MessageFilesCountBits>('_filesCount', 'flags', 0b00110000).setInternal('_filesCount')
  .when('_filesCount', MessageFilesCountBits.None, $ => $.constant('filesCount', 0))
  .when('_filesCount', MessageFilesCountBits.Uint8, $ => $.uint8('filesCount'))
  .when('_filesCount', MessageFilesCountBits.Uint16, $ => $.uint16le('filesCount'))
  .when('_filesCount', MessageFilesCountBits.Uint24, $ => $.uint24le('filesCount'))

  .mask<'_filesSize', MessageFilesSizeBits>('_filesSize', 'flags', 0b00001100).setInternal('_filesSize')
  .compute<'__filesSize', number>('__filesSize', $ => `return ${$.read('_filesCount')} === ${MessageFilesCountBits.None} ? -1 : ${$.read('_filesSize')}`).setInternal('__filesSize')
  .when('__filesSize', -1, $ => $.constant('filesSize', 0))
  .when('__filesSize', MessageFilesSizeBits.Uint16, $ => $.uint16le('filesSize'))
  .when('__filesSize', MessageFilesSizeBits.Uint24, $ => $.uint24le('filesSize'))
  .when('__filesSize', MessageFilesSizeBits.Uint32, $ => $.uint32le('filesSize'))
  .when('__filesSize', MessageFilesSizeBits.Uint48, $ => $.uint48le('filesSize'))

  // TODO: Consider ignoring when there is no data
  .arrayDynamic('filesHeader', 'filesCount', $ => $
    .uint8('header').setInternal('header')

    .mask<'_size', FileSizeBits>('_size', 'header', 0b00001100).setInternal('_size')
    .when('_size', FileSizeBits.Uint8, $ => $.uint8('size'))
    .when('_size', FileSizeBits.Uint16, $ => $.uint16le('size'))
    .when('_size', FileSizeBits.Uint24, $ => $.uint24le('size'))
    .when('_size', FileSizeBits.Uint48, $ => $.uint48le('size'))

    .mask<'_nameSize', FileNameSizeBits>('_nameSize', 'header', 0b00000010).setInternal('_nameSize')
    .when('_nameSize', FileNameSizeBits.Uint8, $ => $.uint8('nameSize').setInternal('nameSize'))
    .when('_nameSize', FileNameSizeBits.Uint16, $ => $.uint16le('nameSize').setInternal('nameSize'))
    .utf8Dynamic('name', 'nameSize')
  , true)

  .end();

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

  #consumeMessage = createMessageConsumer({
    id: this.#setId,
    action: this.#setAction,
    dataSize: this.#setDataSize,
    filesCount: this.#setFilesCount,
    filesSize: this.#setFilesSize,
    filesHeader: this.#addFileHeader,
    _end: this.#endMessageHeader,
  });

  #consumeResponse = createResponseConsumer({
    parentId: this.#setParentId,
    id: this.#setId,
    dataSize: this.#setDataSize,
    filesCount: this.#setFilesCount,
    filesSize: this.#setFilesSize,
    filesHeader: this.#addFileHeader,
    _end: this.#endMessageHeader,
  });

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
    const hadMessage = Boolean(this.#message);
    if (this.#consumeMessage.readOne(buffer, offset, end) !== end) {
      throw new Error('The message packet size was malformed.');
    }
    const result = !hadMessage && this.#message || null;
    this.#endMessageIfReady();
    return result as any;
  }

  public consumeResponse(buffer: Buffer, offset: number, end: number): R | null {
    if (!this.#consumingResponse) {
      throw new Error('There is no response in process.');
    }
    const hadMessage = Boolean(this.#message);
    if (this.#consumeResponse.readOne(buffer, offset, end) !== end) {
      throw new Error('The response packet size was malformed.');
    }
    const result = !hadMessage && this.#message || null;
    this.#endMessageIfReady();
    return result as any;
  }

  // TODO: Think if it shouldn't be in Message implementation
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

    // TODO: Mark file as ended

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
