import { once } from 'node:events';
import { Buffer } from 'node:buffer';
import * as msgpack from 'msgpackr';
import { UUID } from '@sockety/uuid';
import { RawMessage, FastReply, FileTransfer, ContentProducer, RequestBase } from '@sockety/core';
import { createResponse, fastReply } from '@sockety/core/producers';
import { Request } from './Request';
import { Connection } from './Connection';

const NONE = Buffer.allocUnsafe(0);

interface RespondOptions {
  data?: Buffer | string;
  files?: FileTransfer[];
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

  public respond<T extends boolean>(responseProducer: (parentId: UUID) => ContentProducer<RequestBase<T>>): Request<T> {
    this.#respond = true;
    return this.#connection.send(responseProducer(this.id));
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
