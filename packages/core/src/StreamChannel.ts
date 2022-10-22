import { Buffer } from 'node:buffer';
import { BufferReader } from '@sockety/buffers';
import { UUID } from '@sockety/uuid';
import {
  CONSUME_DATA,
  CONSUME_FILE,
  CONSUME_FILES_HEADER,
  CONSUME_STREAM,
  END_STREAM,
  IncomingMessage,
} from './IncomingMessage';
import {
  FileNameSizeBits,
  FileSizeBits,
  MessageActionSizeBits,
  MessageDataSizeBits,
  MessageFilesCountBits,
  MessageFilesSizeBits,
} from './constants';

function formatBuffer(buffer: Buffer): string {
  return Array.from(buffer.slice(0, 50)).map((x) => x.toString(16).padStart(2, '0')).join(' ') + (buffer.length > 50 ? ` [...${buffer.length-50}]` : '');
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

  // TODO: Consider ignoring when there is no data
  .arrayDynamic('filesHeader', 'filesCount', $ => $
    .uint8('header').setInternal('header')

    .mask<'_size', FileSizeBits>('_size', 'header', 0b00000011).setInternal('_size')
    .when('_size', FileSizeBits.Uint8, $ => $.uint8('size'))
    .when('_size', FileSizeBits.Uint16, $ => $.uint16le('size'))
    .when('_size', FileSizeBits.Uint24, $ => $.uint24le('size'))
    .when('_size', FileSizeBits.Uint48, $ => $.uint48le('size'))

    .mask<'_nameSize', FileNameSizeBits>('_nameSize', 'header', 0b00000100).setInternal('_nameSize')
    .when('_nameSize', FileNameSizeBits.Uint8, $ => $.uint8('nameSize').setInternal('nameSize'))
    .when('_nameSize', FileNameSizeBits.Uint16, $ => $.uint16le('nameSize').setInternal('nameSize'))
    .utf8Dynamic('name', 'nameSize') // TODO: Validate file name?
  , true)

  .end();

// TODO: Add option (callback?) to allow different file size than specified
// TODO: Extract finalization to separate method
export class StreamChannel {
  #consumingMessage = false;
  #consumingResponse = false;
  #consumingStream = false;
  #consumingFiles = false;
  #consumingData = false;
  #expectsResponse = false;

  // TODO: Set optional?
  #message!: IncomingMessage;
  #id!: UUID;
  #action!: string;
  #dataSize!: number;
  #filesCount!: number;
  #filesSize!: number;
  #hasStream!: boolean;
  #fileIndex!: number;
  #filesToProcess = 0;
  #dataLeft = 0;

  #setId = (id: UUID) => {
    // console.log(`  [ID] ${id}`);
    this.#id = id;
  };

  #setAction = (action: string) => {
    // console.log(`  [ACTION] ${action}`);
    this.#action = action;
  };

  #setDataSize = (dataSize: number) => {
    // console.log(`  [DATA SIZE] ${dataSize}B`);
    this.#dataSize = dataSize;
    this.#dataLeft = dataSize;

    if (dataSize > 0) {
      this.#consumingData = true;
    }
  };

  #setFilesCount = (filesCount: number) => {
    // console.trace(`  [FILES COUNT] ${filesCount}`, this.#id.toString());
    this.#filesCount = filesCount;
    this.#filesToProcess = filesCount; // TODO: Ignore 0B files?

    if (filesCount > 0) {
      this.#consumingFiles = true;
    }
  };

  #setFilesSize = (filesSize: number) => {
    // console.log(`  [FILES SIZE] ${filesSize}B`);
    this.#filesSize = filesSize;
    this.#message = new IncomingMessage(
      this.#id,
      this.#action,
      this.#dataSize,
      this.#filesCount,
      this.#filesSize,
      this.#hasStream,
      this.#expectsResponse,
    );
    // @ts-ignore: clean memory
    this.#id = undefined;
  };

  #addFileHeader = ({ name, size }: { name: string, size: number }) => {
    // console.log(name, size);
    this.#message[CONSUME_FILES_HEADER](name, size);
  };

  #endMessageHeader = () => {
    this.#consumingMessage = false;
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

  public startMessage(hasStream: boolean): void {
    if (this.#isConsuming()) {
      throw new Error('There is already packet in process.');
    }

    // console.log(`[MESSAGE] ${hasStream ? 'has' : 'no'} stream`);

    this.#hasStream = hasStream;
    this.#consumingMessage = true;
    this.#consumingStream = hasStream;
  }

  public startResponse(hasStream: boolean): void {
    if (this.#isConsuming()) {
      throw new Error('There is already packet in process.');
    }

    // console.log(`[RESPONSE] ${hasStream ? 'has' : 'no'} stream`);

    this.#consumingResponse = true;
    this.#consumingStream = hasStream;
  }

  public setExpectsResponse(expectsResponse: boolean): void {
    if (!this.#consumingMessage && !this.#consumingResponse) {
      throw new Error('There is no message in process.');
    }

    this.#expectsResponse = expectsResponse;
  }

  public consumeMessage(buffer: Buffer): IncomingMessage | null {
    if (!this.#consumingMessage) {
      throw new Error('There is no message in process.');
    }

    // console.log(`[MESSAGE CONTENT] ${formatBuffer(buffer)}`);

    const hadMessage = Boolean(this.#message);
    const index = this.#consumeMessage.readOne(buffer);

    if (index !== buffer.length) {
      throw new Error('The message packet size was malformed.');
    }

    const message = this.#message;

    this.#endMessageIfReady();

    return !hadMessage && message || null;
  }

  public consumeResponse(buffer: Buffer): IncomingMessage | null {
    if (!this.#consumingResponse) {
      throw new Error('There is no response in process.');
    }

    // console.log(`[RESPONSE CONTENT] ${formatBuffer(buffer)}`);

    // TODO: Clear consuming* and hasStream after finishing the response
    return null;
  }

  public consumeContinue(buffer: Buffer): IncomingMessage | null {
    if (this.#consumingMessage) {
      return this.consumeMessage(buffer);
    } else if (this.#consumingResponse) {
      return this.consumeResponse(buffer);
    }
    throw new Error('There is no packet in process.');
  }

  public consumeData(buffer: Buffer): void {
    if (!this.#consumingData) {
      throw new Error('There is no data expected.');
    }

    this.#dataLeft -= buffer.length;
    if (this.#dataLeft < 0) {
      throw new Error('The data packet size is malformed.');
    }

    this.#message[CONSUME_DATA](buffer);

    if (this.#dataLeft === 0) {
      this.#consumingData = false;
      this.#endMessageIfReady();
    }
  }

  public consumeStream(buffer: Buffer): void {
    if (!this.#message) {
      throw new Error('There is no message in process.');
    }
    this.#message[CONSUME_STREAM](buffer);
  }

  public finishStream(): void {
    this.#consumingStream = false;
    if (this.#message) {
      this.#message[END_STREAM]();
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
    // console.log(`[FILE ${this.#fileIndex}]`, formatBuffer(content));
    this.#message[CONSUME_FILE](this.#fileIndex, content);
  }

  public endFile(index: number): void {
    if (!this.#message) {
      throw new Error('There is no message processed.');
    }

    // TODO: Mark file as ended

    // TODO: Don't assume that there is exactly one FILE END per FILE?
    this.#filesToProcess--;
    if (this.#filesToProcess === 0) {
      this.#consumingFiles = false;
      this.#endMessageIfReady();
    }

    // console.log(`[FILE ${index}]`, 'END');
    // TODO: Verify size
    // TODO: End stream
    // TODO: End consumingStream if all done
  }
}
