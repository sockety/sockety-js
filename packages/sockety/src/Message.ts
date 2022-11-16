import { once } from 'node:events';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import * as msgpack from 'msgpackr';
import { RawMessage } from '@sockety/core/src/read/RawMessage';
import { UUID } from '@sockety/uuid';
import { createResponse } from '@sockety/core/src/createResponse';
import { accept } from '@sockety/core/src/producers/accept';
import { reject } from '@sockety/core/src/producers/reject';
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

export class Message extends RawMessage {
  readonly #connection: Connection;
  #respond = false;

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

  public async dataBuffer(): Promise<Buffer> {
    if (!this.data) {
      return NONE;
    }
    const buffer = Buffer.allocUnsafe(this.dataSize);
    let offset = 0;
    this.data.on('data', (data) => {
      offset = data.copy(buffer, offset);
    });
    await Promise.race([
      once(this.data, 'end'),
      once(this.data, 'error').then(Promise.reject),
    ]);
    return buffer;
  }

  public msgpack(): Promise<any> {
    if (!this.data) {
      return Promise.resolve(undefined);
    }
    return this.dataBuffer().then(msgpack.decode);
  }

  public respond<T extends true | false | undefined>(options: RespondOptions, hasStream?: T): T extends undefined ? Promise<Request<false>> : Promise<Request<T>> {
    this.#respond = true;
    return this.#connection.send(createResponse(options, Boolean(hasStream))(this.id)) as any;
  }

  // TODO: Support other fast replies too
  public accept(): Promise<void> {
    this.#respond = true;
    return this.#connection.pass(accept(this.id));
  }

  // TODO: Support other fast replies too
  public reject(): Promise<void> {
    this.#respond = true;
    return this.#connection.pass(reject(this.id));
  }
}
