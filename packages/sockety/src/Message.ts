import { once } from 'node:events';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import * as msgpack from 'msgpackr';
import { RawMessage } from '@sockety/core/src/read/RawMessage';
import { UUID } from '@sockety/uuid';
import { createResponse } from '@sockety/core/src/createResponse';
import { FastReply } from '@sockety/core/src/constants';
import { fastReply } from '@sockety/core/src/producers/fastReply';
import { Request } from './Request';
import { Connection } from './Connection';

// TODO: Extract type
type FileBufferSent = { name: string, buffer: Buffer };
type FileStreamSent = { name: string, size: number, stream: Readable };
type FileSent = FileBufferSent | FileStreamSent;

const NONE = Buffer.allocUnsafe(0);

interface RespondOptions {
  data?: Buffer;
  files?: FileSent[];
}

// TODO: Consider event emitter to hook to message lifecycle
// TODO: Avoid sending responses when it doesn't expect the response
export class Message extends RawMessage {
  readonly #connection: Connection;
  #respond = false;
  #dataBuffer?: Promise<Buffer>;
  #msgpack?: Promise<any>;

  public constructor(
    connection: Connection,
    id: UUID,
    action: string,
    dataSize: number,
    filesCount: number,
    totalFilesSize: number,
    hasStream: boolean,
    expectsResponse: boolean,
  ) {
    super(id, action, dataSize, filesCount, totalFilesSize, hasStream, expectsResponse);
    this.#connection = connection;
  }

  public get responded(): boolean {
    return this.#respond;
  }

  public get connection(): Connection {
    return this.#connection;
  }

  async #readDataBuffer(): Promise<Buffer> {
    const buffer = Buffer.allocUnsafe(this.dataSize);
    let offset = 0;
    this.data!.on('data', (data) => {
      offset = data.copy(buffer, offset);
    });
    await Promise.race([
      once(this.data!, 'end'),
      once(this.data!, 'error').then(Promise.reject),
    ]);
    return buffer;
  }

  public dataBuffer(): Promise<Buffer> {
    if (!this.data) {
      return Promise.resolve(NONE);
    } else if (!this.#dataBuffer) {
      this.#dataBuffer = this.#readDataBuffer();
    }
    return this.#dataBuffer;
  }

  async #readMsgpack(): Promise<any> {
    return this.dataBuffer().then(msgpack.decode);
  }

  public msgpack(): Promise<any> {
    if (!this.data) {
      return Promise.resolve(NONE);
    } else if (!this.#msgpack) {
      this.#msgpack = this.#readMsgpack();
    }
    return this.#msgpack;
  }

  // TODO: Support msgpack responses
  public respond<T extends true | false | undefined>(options: RespondOptions, hasStream?: T): T extends undefined ? Promise<Request<false>> : Promise<Request<T>> {
    this.#respond = true;
    return this.#connection.send(createResponse(options, Boolean(hasStream))(this.id)) as any;
  }

  public fastReply(code: FastReply | number): Promise<void> {
    this.#respond = true;
    return this.#connection.pass(fastReply(this.id, code));
  }

  public accept(): Promise<void> {
    return this.fastReply(FastReply.Accept);
  }

  public reject(): Promise<void> {
    return this.fastReply(FastReply.Reject);
  }
}
